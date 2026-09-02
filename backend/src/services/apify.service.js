const db = require('../db/db');

const ACTOR_ENV = {
  tiktok: 'APIFY_TIKTOK_ACTOR_ID',
  instagram: 'APIFY_INSTAGRAM_ACTOR_ID',
  x: 'APIFY_X_ACTOR_ID'
};

// Instagram/TikTok -1 döndürür when a creator hides that count — gerçek bir değer değil, "bilinmiyor" demek
function numberValue(value) {
  let result = null;
  if (typeof value === 'number' && Number.isFinite(value)) result = Math.round(value);
  else if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9]/g, ''));
    result = Number.isFinite(parsed) ? parsed : null;
  }
  return result !== null && result < 0 ? null : result;
}

function extractMetrics(item) {
  // Instagram Post Scraper (apify/instagram-post-scraper): likesCount, commentsCount, videoPlayCount
  // TikTok Scraper (clockworks/tiktok-scraper): playCount, diggCount, commentCount, shareCount
  // Tweet Scraper V2 (apidojo/tweet-scraper): viewCount, likeCount, replyCount, retweetCount
  const views = numberValue(item.views ?? item.viewCount ?? item.playCount ?? item.videoPlayCount ?? item.videoViewCount ?? item.statistics?.playCount);
  return {
    views,
    likes: numberValue(item.likes ?? item.likeCount ?? item.likesCount ?? item.diggCount ?? item.statistics?.diggCount),
    comments: numberValue(item.comments ?? item.commentCount ?? item.commentsCount ?? item.replyCount ?? item.statistics?.commentCount),
    shares: numberValue(item.shares ?? item.shareCount ?? item.retweetCount ?? item.statistics?.shareCount),
    // Apify bazı actor'larda içerik yoksa error: "not_found" gibi bir string döndürür (boolean true değil) — her ikisini de yakala
    unavailable: item.isDeleted === true || item.status === 'deleted' || Boolean(item.error),
    errorDescription: item.errorDescription || null,
    postedAt: item.timestamp || item.createTimeISO || null,
    authorUsername: item.ownerUsername || item.authorMeta?.name || item.authorMeta?.uniqueId || null,
    authorName: item.ownerFullName || item.authorMeta?.nickName || null,
    authorAvatar: item.authorMeta?.avatar || null
  };
}

function previewImageOf(item) {
  return item.extendedEntities?.media?.[0]?.media_url_https
    || item.media?.[0]?.media_url_https
    || item.videoMeta?.coverUrl
    || item.videoMeta?.originalCoverUrl
    || item.displayUrl
    || null;
}

// Apify hesabı aynı anda sınırlı sayıda actor çalıştırabiliyor (ücretsiz/başlangıç planında düşük).
// Admin birden fazla "Apify ile güncelle"ye art arda basınca hepsi aynı anda Apify'a gidip
// birbirini kilitliyor ve bazıları yarım kalıp "Erişilemiyor" olarak yanlış işaretleniyordu.
// Bu kilit tüm Apify çağrılarını backend tarafında teker teker sıraya sokar.
let apifyQueue = Promise.resolve();
function runApifySerialized(fn) {
  const result = apifyQueue.then(fn, fn);
  apifyQueue = result.then(() => {}, () => {});
  return result;
}

function inputFor(video) {
  const input = process.env[`APIFY_${video.platform.toUpperCase()}_ACTOR_INPUT`];
  if (!input) return { videoURL: video.url, url: video.url, urls: [video.url] };
  try {
    return JSON.parse(input.replaceAll('{URL}', video.url));
  } catch {
    throw new Error(`${video.platform} actor input JSON geçersiz`);
  }
}

async function fetchPublicMetricsOnce(video) {
  const token = process.env.APIFY_API_TOKEN;
  const actorId = process.env[ACTOR_ENV[video.platform]];
  if (!token || !actorId) throw new Error('Apify token ve platform actor ID yapılandırılmamış');

  const runResponse = await fetch(`https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${encodeURIComponent(token)}&waitForFinish=120`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputFor(video))
  });
  if (!runResponse.ok) throw new Error(`Apify actor çalıştırılamadı (${runResponse.status})`);
  const run = await runResponse.json();
  // waitForFinish süresinde bitmediyse (ör. Apify hesabındaki eşzamanlı çalıştırma limiti doluysa
  // run sıraya girip zamanında tamamlanmamış olabilir) — bunu içerik silinmiş gibi göstermeyelim
  const runStatus = run.data?.status;
  if (runStatus && !['SUCCEEDED', 'FINISHED'].includes(runStatus)) {
    throw new Error(`Apify çalıştırması zamanında bitmedi (${runStatus}) — birazdan tekrar deneyin`);
  }
  const datasetId = run.data?.defaultDatasetId;
  if (!datasetId) throw new Error('Apify actor dataset döndürmedi');

  const datasetResponse = await fetch(`https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(token)}&clean=true`, { headers: { Accept: 'application/json' } });
  if (!datasetResponse.ok) throw new Error(`Apify dataset okunamadı (${datasetResponse.status})`);
  const items = await datasetResponse.json();
  const item = Array.isArray(items) ? items[0] : items;
  if (!item) throw new Error('Apify actor sonuç döndürmedi');
  const metrics = extractMetrics(item);
  if (metrics.views === null && !metrics.unavailable) throw new Error('Apify sonucunda views alanı bulunamadı');
  metrics.image = previewImageOf(item);
  metrics.title = item.fullText || item.text || item.caption || null;
  return metrics;
}

function fetchPublicMetrics(video) {
  return runApifySerialized(() => fetchPublicMetricsOnce(video));
}

async function refreshVideo(video) {
  try {
    const metrics = await fetchPublicMetrics(video);
    const status = metrics.unavailable ? 'deleted' : 'active';
    await db.prepare('UPDATE videos SET status = ? WHERE id = ?').run(status, video.id);
    await db.prepare('INSERT INTO video_metrics (video_id, views, likes, comments, shares) VALUES (?, ?, ?, ?, ?)').run(video.id, metrics.views, metrics.likes, metrics.comments, metrics.shares);
    return { id: video.id, status, views: metrics.views };
  } catch (error) {
    await db.prepare("UPDATE videos SET status = 'unreachable' WHERE id = ? AND status = 'active'").run(video.id);
    return { id: video.id, status: 'unreachable', error: error.message };
  }
}

async function refreshActiveVideos() {
  if (!process.env.APIFY_API_TOKEN) return { skipped: true, reason: 'APIFY_API_TOKEN tanımlı değil' };
  // 'unreachable' da tekrar denenir — Apify'da geçici bir hata (limit/timeout) yüzünden bu duruma
  // düşen bir video, admin elle "güncelle"ye basmadan bir sonraki saatlik taramada kendi kendine düzelsin
  const videos = await db.prepare("SELECT * FROM videos WHERE status IN ('active', 'unreachable')").all();
  const results = [];
  for (const video of videos) results.push(await refreshVideo(video));
  return { skipped: false, count: results.length, results };
}

module.exports = { refreshVideo, refreshActiveVideos, fetchPublicMetrics };
