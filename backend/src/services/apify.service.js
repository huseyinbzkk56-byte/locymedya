const db = require('../db/db');

const ACTOR_ENV = {
  tiktok: 'APIFY_TIKTOK_ACTOR_ID',
  instagram: 'APIFY_INSTAGRAM_ACTOR_ID',
  x: 'APIFY_X_ACTOR_ID'
};

function numberValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  if (typeof value !== 'string') return null;
  const parsed = Number(value.replace(/[^0-9]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
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
    unavailable: item.isDeleted === true || item.status === 'deleted' || item.error === true
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

function inputFor(video) {
  const input = process.env[`APIFY_${video.platform.toUpperCase()}_ACTOR_INPUT`];
  if (!input) return { videoURL: video.url, url: video.url, urls: [video.url] };
  try {
    return JSON.parse(input.replaceAll('{URL}', video.url));
  } catch {
    throw new Error(`${video.platform} actor input JSON geçersiz`);
  }
}

async function fetchPublicMetrics(video) {
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
  const videos = await db.prepare("SELECT * FROM videos WHERE status = 'active'").all();
  const results = [];
  for (const video of videos) results.push(await refreshVideo(video));
  return { skipped: false, count: results.length, results };
}

module.exports = { refreshVideo, refreshActiveVideos, fetchPublicMetrics };
