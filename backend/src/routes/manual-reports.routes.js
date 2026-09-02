const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const db = require('../db/db');
const { authenticate, requireRole, requireFullAdmin } = require('../middleware/auth');
const { getPdfHeaderTitle, getPdfHeaderSubtitle } = require('../utils/settings');
const { fetchPublicMetrics } = require('../services/apify.service');
const { detectPlatform, PLATFORMS } = require('../utils/platform');
const { uploadBuffer, destroyByUrl } = require('../services/storage.service');

const router = express.Router();
const VIDEO_PLATFORMS = new Set(['instagram', 'tiktok']);
const IMAGE_FETCH_TIMEOUT = 6000;
const IMAGE_FOLDER = 'locymedya/manual-reports';
const imageAllowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const imageAllowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = imageAllowedTypes.has(file.mimetype) && imageAllowedExtensions.has(path.extname(file.originalname).toLowerCase());
    callback(allowed ? null : new Error('Görsel JPG, JPEG, PNG veya WEBP olmalı'), allowed);
  }
});

const FONT_PATH = path.join(__dirname, '../assets/fonts/Manrope.ttf');
const PAGE_MARGIN = 48;
const COLOR = {
  pageBg: '#0A0A0F',
  cardBg: '#17171F',
  cardBorder: '#2A2A35',
  divider: '#232330',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#5B5F6E',
  chipText: '#0B0B0F',
  accent: '#D4A954'
};

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function formatCompact(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mn`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} B`;
  return n.toLocaleString('tr-TR');
}

// "sayfa | url" satırlarını ayırır — Excel/Sheets'ten yapıştırılan sekme veya virgülle ayrılmış
// satırları da kabul eder, böylece ayrı bir dosya içe aktarma arayüzüne gerek kalmaz
function parseBulkLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.includes('|') ? line.split('|') : line.includes('\t') ? line.split('\t') : line.split(',');
      if (parts.length < 2) return { error: `Satır anlaşılamadı: "${line}"` };
      const pageName = parts[0].trim();
      const url = parts.slice(1).join('|').trim();
      if (!pageName || !url) return { error: `Satır eksik: "${line}"` };
      try {
        new URL(url);
      } catch {
        return { error: `Geçersiz link: "${url}"` };
      }
      const platform = detectPlatform(url);
      if (!VIDEO_PLATFORMS.has(platform)) return { error: `Sadece Instagram/TikTok destekleniyor: "${url}"` };
      return { pageName, url, platform };
    });
}

async function refreshOneManualVideo(video) {
  await db.prepare("UPDATE manual_report_videos SET status = 'processing' WHERE id = ?").run(video.id);
  try {
    const metrics = await fetchPublicMetrics({ platform: video.platform, url: video.url });
    if (metrics.unavailable) {
      const message = metrics.errorDescription || 'Video silinmiş veya artık herkese açık değil.';
      await db.prepare("UPDATE manual_report_videos SET status = 'error', error_message = ? WHERE id = ?").run(message, video.id);
      return { id: video.id, status: 'error', error: message };
    }
    await db.transaction(async (tx) => {
      await tx.prepare('INSERT INTO manual_report_video_metrics (video_id, views, likes, comments, shares) VALUES (?, ?, ?, ?, ?)')
        .run(video.id, metrics.views, metrics.likes, metrics.comments, metrics.shares);
      await tx.prepare("UPDATE manual_report_videos SET status = 'success', error_message = NULL, title = COALESCE(?, title), thumbnail_url = COALESCE(?, thumbnail_url), posted_at = COALESCE(?, posted_at) WHERE id = ?")
        .run(metrics.title || null, metrics.image || null, metrics.postedAt || null, video.id);
    });
    return { id: video.id, status: 'success', views: metrics.views };
  } catch (error) {
    await db.prepare("UPDATE manual_report_videos SET status = 'error', error_message = ? WHERE id = ?").run(error.message, video.id);
    return { id: video.id, status: 'error', error: error.message };
  }
}

// Sıralı çalışır (Apify serileştirme kilidi zaten var, ama sıra ile ilerlemek de garanti eder) —
// bir videonun başarısız olması diğerlerini durdurmaz
async function refreshManyInBackground(videos) {
  for (const video of videos) {
    try { await refreshOneManualVideo(video); } catch { /* zaten içeride yakalanıyor */ }
  }
}

async function reportTotals(reportId) {
  const videos = await db.prepare(`
    SELECT v.id, v.page_name, v.platform, v.status, latest.views, latest.likes, latest.comments, latest.shares
    FROM manual_report_videos v
    LEFT JOIN manual_report_video_metrics latest ON latest.id = (
      SELECT id FROM manual_report_video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1
    )
    WHERE v.report_id = ?
  `).all(reportId);

  const totals = videos.reduce((acc, v) => {
    acc.views += v.views || 0;
    acc.likes += v.likes || 0;
    acc.comments += v.comments || 0;
    acc.shares += v.shares || 0;
    return acc;
  }, { views: 0, likes: 0, comments: 0, shares: 0 });

  const pageMap = new Map();
  videos.forEach((v) => {
    if (!pageMap.has(v.page_name)) pageMap.set(v.page_name, { pageName: v.page_name, videoCount: 0, views: 0, likes: 0, comments: 0 });
    const p = pageMap.get(v.page_name);
    p.videoCount += 1;
    p.views += v.views || 0;
    p.likes += v.likes || 0;
    p.comments += v.comments || 0;
  });
  const pages = [...pageMap.values()].sort((a, b) => b.views - a.views);

  return {
    videoCount: videos.length,
    successCount: videos.filter((v) => v.status === 'success').length,
    pendingCount: videos.filter((v) => v.status === 'pending' || v.status === 'processing').length,
    errorCount: videos.filter((v) => v.status === 'error').length,
    totals,
    pages
  };
}

function getReportImages(reportId) {
  return db.prepare('SELECT id, report_id, image_url, created_at FROM manual_report_images WHERE report_id = ? ORDER BY created_at ASC, id ASC').all(reportId);
}

async function fetchRemoteImageBuffer(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LocyMedyaBot/1.0)' } });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!/jpeg|jpg|png|webp/i.test(contentType)) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Ekran görüntülerini PDF'e gömmeden önce indirir ve boyutlarını okur — biri başarısız olursa diğerlerini etkilemez
async function preloadReportImages(doc, images) {
  const slots = await Promise.all(images.map(async (img) => {
    const buffer = await fetchRemoteImageBuffer(img.image_url);
    if (!buffer) return null;
    try {
      const info = doc.openImage(buffer);
      return { buffer, width: info.width, height: info.height };
    } catch {
      return null;
    }
  }));
  return slots.filter(Boolean);
}

// ---- Public: müşteriye gönderilen rapor görünümü (kimlik doğrulama gerektirmez) ----
router.get('/public/:token', async (req, res) => {
  const report = await db.prepare('SELECT id, name, artist_name, song_name, report_date, note FROM manual_reports WHERE public_token = ?').get(req.params.token);
  if (!report) return res.status(404).json({ error: 'Rapor bulunamadı' });
  const summary = await reportTotals(report.id);
  const videos = (await db.prepare(`
    SELECT v.id, v.page_name, v.platform, v.url, v.title, v.thumbnail_url, v.posted_at, v.status,
      latest.views, latest.likes, latest.comments, latest.shares
    FROM manual_report_videos v
    LEFT JOIN manual_report_video_metrics latest ON latest.id = (
      SELECT id FROM manual_report_video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1
    )
    WHERE v.report_id = ? AND v.status = 'success'
    ORDER BY latest.views DESC
  `).all(report.id));
  const images = await getReportImages(report.id);
  const brandTitle = await getPdfHeaderTitle();
  const brandSubtitle = await getPdfHeaderSubtitle();
  res.json({ report, summary, videos, images, brand: { title: brandTitle, subtitle: brandSubtitle } });
});

async function drawManualReportPdf(res, report, summary, videos, images, brandTitle, brandSubtitle) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="rapor-${report.id}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true, info: { Title: `${brandTitle} - ${report.name}`, Author: brandTitle } });
  doc.registerFont('Manrope', FONT_PATH);
  doc.pipe(res);

  const pageWidth = () => doc.page.width - PAGE_MARGIN * 2;
  function paintBg() { doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLOR.pageBg); }
  paintBg();

  doc.font('Manrope').fontSize(20).fillColor(COLOR.textPrimary).text(brandTitle, PAGE_MARGIN, PAGE_MARGIN);
  if (brandSubtitle) doc.fontSize(9).fillColor(COLOR.textSecondary).text(brandSubtitle, PAGE_MARGIN, doc.y + 2);
  doc.fontSize(9).fillColor(COLOR.accent).text('PROJE RAPORU', PAGE_MARGIN, doc.y + 2);
  const lineY1 = doc.y + 12;
  doc.moveTo(PAGE_MARGIN, lineY1).lineTo(PAGE_MARGIN + pageWidth(), lineY1).lineWidth(1).strokeColor(COLOR.divider).stroke();
  doc.y = lineY1 + 16;

  doc.font('Manrope').fontSize(22).fillColor(COLOR.textPrimary).text(report.song_name || report.name, PAGE_MARGIN, doc.y, { width: pageWidth() });
  const metaParts = [report.artist_name, report.report_date ? new Date(report.report_date).toLocaleDateString('tr-TR') : null].filter(Boolean);
  if (metaParts.length) doc.fontSize(11).fillColor(COLOR.textSecondary).text(metaParts.join(' · '), PAGE_MARGIN, doc.y + 4);
  doc.y += 20;

  const stats = [
    ['TOPLAM VİDEO', String(summary.videoCount)],
    ['TOPLAM GÖRÜNTÜLENME', formatCompact(summary.totals.views)],
    ['TOPLAM BEĞENİ', formatCompact(summary.totals.likes)],
    ['TOPLAM YORUM', formatCompact(summary.totals.comments)]
  ];
  const tileGap = 12;
  const tileW = (pageWidth() - tileGap * (stats.length - 1)) / stats.length;
  const tileY = doc.y;
  stats.forEach((stat, i) => {
    const x = PAGE_MARGIN + i * (tileW + tileGap);
    doc.roundedRect(x, tileY, tileW, 62, 10).lineWidth(1).fillAndStroke(COLOR.cardBg, COLOR.cardBorder);
    doc.font('Manrope').fontSize(18).fillColor(COLOR.textPrimary).text(stat[1], x + 12, tileY + 14, { width: tileW - 24 });
    doc.fontSize(7).fillColor(COLOR.textSecondary).text(stat[0], x + 12, tileY + 40, { width: tileW - 24 });
  });
  doc.y = tileY + 62 + 24;

  const contentBottom = () => doc.page.height - PAGE_MARGIN - 40;

  // Sayfa performansları
  if (summary.pages.length) {
    doc.font('Manrope').fontSize(14).fillColor(COLOR.textPrimary).text('Sayfa Performansları', PAGE_MARGIN, doc.y);
    doc.y += 10;
    summary.pages.forEach((p) => {
      if (doc.y + 22 > contentBottom()) { doc.addPage(); paintBg(); doc.y = PAGE_MARGIN; }
      const y = doc.y;
      doc.font('Manrope').fontSize(10.5).fillColor(COLOR.textPrimary).text(`@${p.pageName}`, PAGE_MARGIN, y, { width: pageWidth() * 0.4, continued: false });
      doc.fontSize(9).fillColor(COLOR.textSecondary).text(`${p.videoCount} video`, PAGE_MARGIN + pageWidth() * 0.4, y, { width: pageWidth() * 0.3 });
      doc.fillColor(COLOR.textPrimary).text(`${formatCompact(p.views)} izlenme`, PAGE_MARGIN, y, { width: pageWidth() - 20, align: 'right' });
      doc.y = y + 22;
    });
    doc.y += 14;
  }

  // Video detayları
  if (doc.y + 40 > contentBottom()) { doc.addPage(); paintBg(); doc.y = PAGE_MARGIN; }
  doc.font('Manrope').fontSize(14).fillColor(COLOR.textPrimary).text('Video Detayları', PAGE_MARGIN, doc.y);
  doc.y += 12;

  function drawHeaderRow() {
    const y = doc.y;
    doc.font('Manrope').fontSize(8).fillColor(COLOR.textMuted);
    doc.text('SAYFA', PAGE_MARGIN, y, { width: pageWidth() * 0.3 });
    doc.text('PLATFORM', PAGE_MARGIN + pageWidth() * 0.3, y, { width: pageWidth() * 0.2 });
    doc.text('İZLENME', PAGE_MARGIN, y, { width: pageWidth() * 0.63, align: 'right' });
    doc.text('BEĞENİ / YORUM', PAGE_MARGIN, y, { width: pageWidth(), align: 'right' });
    doc.y = y + 14;
    const lineY = doc.y;
    doc.moveTo(PAGE_MARGIN, lineY).lineTo(PAGE_MARGIN + pageWidth(), lineY).lineWidth(1).strokeColor(COLOR.divider).stroke();
    doc.y = lineY + 10;
  }
  drawHeaderRow();

  videos.forEach((v) => {
    if (doc.y + 24 > contentBottom()) { doc.addPage(); paintBg(); doc.y = PAGE_MARGIN; drawHeaderRow(); }
    const y = doc.y;
    const config = PLATFORMS[v.platform] || PLATFORMS.web;
    doc.font('Manrope').fontSize(10).fillColor(COLOR.accent).text(`@${v.page_name}`, PAGE_MARGIN, y, { width: pageWidth() * 0.3, link: v.url, underline: true });
    doc.fontSize(9).fillColor(COLOR.textSecondary).text(config.label, PAGE_MARGIN + pageWidth() * 0.3, y, { width: pageWidth() * 0.2 });
    doc.font('Manrope').fontSize(10).fillColor(COLOR.textPrimary).text(formatCompact(v.views), PAGE_MARGIN, y, { width: pageWidth() * 0.63, align: 'right' });
    doc.fontSize(9).fillColor(COLOR.textSecondary).text(`${formatCompact(v.likes)} / ${formatCompact(v.comments)}`, PAGE_MARGIN, y, { width: pageWidth(), align: 'right' });
    doc.y = y + 24;
  });

  // Ekran görüntüleri (SS) — 2 sütunlu ızgara, en-boy oranı korunur
  if (images.length) {
    const loadedImages = await preloadReportImages(doc, images);
    if (loadedImages.length) {
      if (doc.y + 40 > contentBottom()) { doc.addPage(); paintBg(); doc.y = PAGE_MARGIN; }
      doc.font('Manrope').fontSize(14).fillColor(COLOR.textPrimary).text('Ses Performansları', PAGE_MARGIN, doc.y);
      doc.y += 14;
      const gap = 12;
      const colW = (pageWidth() - gap) / 2;
      const maxImgH = 220;
      for (let i = 0; i < loadedImages.length; i += 2) {
        const pair = [loadedImages[i], loadedImages[i + 1]].filter(Boolean);
        const sized = pair.map((img) => {
          const scale = Math.min(colW / img.width, maxImgH / img.height, 1);
          return { ...img, w: img.width * scale, h: img.height * scale };
        });
        const rowH = Math.max(...sized.map((img) => img.h));
        if (doc.y + rowH > contentBottom()) { doc.addPage(); paintBg(); doc.y = PAGE_MARGIN; }
        sized.forEach((img, idx) => {
          const x = PAGE_MARGIN + idx * (colW + gap);
          doc.image(img.buffer, x, doc.y, { width: img.w, height: img.h });
        });
        doc.y += rowH + gap;
      }
    }
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - PAGE_MARGIN - 20;
    doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + pageWidth(), y).lineWidth(1).strokeColor(COLOR.divider).stroke();
    doc.font('Manrope').fontSize(8.5).fillColor(COLOR.textSecondary).text(brandTitle, PAGE_MARGIN, y + 8, { width: pageWidth() / 2 });
    doc.fontSize(8.5).text(`Sayfa ${i + 1} / ${range.count}`, PAGE_MARGIN, y + 8, { width: pageWidth(), align: 'right' });
  }
  doc.end();
}

router.get('/public/:token/pdf', async (req, res) => {
  const report = await db.prepare('SELECT * FROM manual_reports WHERE public_token = ?').get(req.params.token);
  if (!report) return res.status(404).json({ error: 'Rapor bulunamadı' });
  const summary = await reportTotals(report.id);
  const videos = await db.prepare(`
    SELECT v.page_name, v.platform, v.url, latest.views, latest.likes, latest.comments
    FROM manual_report_videos v
    LEFT JOIN manual_report_video_metrics latest ON latest.id = (
      SELECT id FROM manual_report_video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1
    )
    WHERE v.report_id = ? AND v.status = 'success'
    ORDER BY latest.views DESC
  `).all(report.id);
  const images = await getReportImages(report.id);
  const brandTitle = await getPdfHeaderTitle();
  const brandSubtitle = await getPdfHeaderSubtitle();
  await drawManualReportPdf(res, report, summary, videos, images, brandTitle, brandSubtitle);
});

// ---- Bundan sonrası sadece admin ----
router.use(authenticate, requireRole('admin'), requireFullAdmin);

router.get('/', async (req, res) => {
  const reports = await db.prepare('SELECT * FROM manual_reports ORDER BY created_at DESC, id DESC').all();
  const withSummary = [];
  for (const report of reports) {
    const summary = await reportTotals(report.id);
    withSummary.push({ ...report, videoCount: summary.videoCount, totalViews: summary.totals.views, pendingCount: summary.pendingCount });
  }
  res.json({ reports: withSummary });
});

router.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Proje adı zorunlu' });
  let token;
  do { token = generateToken(); } while (await db.prepare('SELECT 1 FROM manual_reports WHERE public_token = ?').get(token));
  const result = await db.prepare('INSERT INTO manual_reports (name, artist_name, song_name, report_date, note, public_token) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, req.body.artistName?.trim() || null, req.body.songName?.trim() || null, req.body.reportDate || null, req.body.note?.trim() || null, token);
  res.status(201).json({ report: await db.prepare('SELECT * FROM manual_reports WHERE id = ?').get(result.lastInsertRowid) });
});

router.get('/:id', async (req, res) => {
  const report = await db.prepare('SELECT * FROM manual_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Rapor bulunamadı' });
  const summary = await reportTotals(report.id);
  const videos = await db.prepare(`
    SELECT v.*, latest.views, latest.likes, latest.comments, latest.shares
    FROM manual_report_videos v
    LEFT JOIN manual_report_video_metrics latest ON latest.id = (
      SELECT id FROM manual_report_video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1
    )
    WHERE v.report_id = ?
    ORDER BY v.created_at DESC, v.id DESC
  `).all(report.id);
  const images = await getReportImages(report.id);
  res.json({ report, summary, videos, images });
});

router.put('/:id', async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Proje adı zorunlu' });
  const result = await db.prepare("UPDATE manual_reports SET name = ?, artist_name = ?, song_name = ?, report_date = ?, note = ?, updated_at = datetime('now') WHERE id = ?")
    .run(name, req.body.artistName?.trim() || null, req.body.songName?.trim() || null, req.body.reportDate || null, req.body.note?.trim() || null, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Rapor bulunamadı' });
  res.json({ report: await db.prepare('SELECT * FROM manual_reports WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', async (req, res) => {
  const images = await getReportImages(req.params.id);
  const result = await db.transaction(async (tx) => {
    await tx.prepare('DELETE FROM manual_report_video_metrics WHERE video_id IN (SELECT id FROM manual_report_videos WHERE report_id = ?)').run(req.params.id);
    await tx.prepare('DELETE FROM manual_report_videos WHERE report_id = ?').run(req.params.id);
    await tx.prepare('DELETE FROM manual_report_images WHERE report_id = ?').run(req.params.id);
    return tx.prepare('DELETE FROM manual_reports WHERE id = ?').run(req.params.id);
  });
  if (!result.changes) return res.status(404).json({ error: 'Rapor bulunamadı' });
  Promise.all(images.map((img) => destroyByUrl(img.image_url, IMAGE_FOLDER, 'image'))).catch(() => {});
  res.status(204).end();
});

router.post('/:id/images', uploadImage.single('image'), async (req, res) => {
  const report = await db.prepare('SELECT id FROM manual_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Rapor bulunamadı' });
  if (!req.file) return res.status(400).json({ error: 'Görsel zorunlu' });
  const result = await uploadBuffer(req.file.buffer, { folder: IMAGE_FOLDER, resourceType: 'image' });
  const insert = await db.prepare('INSERT INTO manual_report_images (report_id, image_url) VALUES (?, ?)').run(report.id, result.secure_url);
  res.status(201).json({ image: await db.prepare('SELECT * FROM manual_report_images WHERE id = ?').get(insert.lastInsertRowid) });
});

router.delete('/:id/images/:imageId', async (req, res) => {
  const image = await db.prepare('SELECT * FROM manual_report_images WHERE id = ? AND report_id = ?').get(req.params.imageId, req.params.id);
  if (!image) return res.status(404).json({ error: 'Görsel bulunamadı' });
  await db.prepare('DELETE FROM manual_report_images WHERE id = ?').run(req.params.imageId);
  destroyByUrl(image.image_url, IMAGE_FOLDER, 'image').catch(() => {});
  res.status(204).end();
});

router.post('/:id/videos', async (req, res) => {
  const report = await db.prepare('SELECT id FROM manual_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Rapor bulunamadı' });
  const pageName = String(req.body.pageName || '').trim();
  const url = String(req.body.url || '').trim();
  if (!pageName || !url) return res.status(400).json({ error: 'Sayfa adı ve video linki zorunlu' });
  const platform = VIDEO_PLATFORMS.has(req.body.platform) ? req.body.platform : detectPlatform(url);
  if (!VIDEO_PLATFORMS.has(platform)) return res.status(400).json({ error: 'Sadece Instagram/TikTok linki eklenebilir' });
  const result = await db.prepare('INSERT INTO manual_report_videos (report_id, page_name, platform, url) VALUES (?, ?, ?, ?)').run(report.id, pageName, platform, url);
  const video = await db.prepare('SELECT * FROM manual_report_videos WHERE id = ?').get(result.lastInsertRowid);
  refreshOneManualVideo(video).catch(() => {});
  res.status(201).json({ video });
});

router.post('/:id/videos/bulk', async (req, res) => {
  const report = await db.prepare('SELECT id FROM manual_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Rapor bulunamadı' });
  const parsed = parseBulkLines(req.body.text);
  const errors = parsed.filter((row) => row.error).map((row) => row.error);
  const valid = parsed.filter((row) => !row.error);
  if (!valid.length) return res.status(400).json({ error: 'Geçerli satır bulunamadı', lineErrors: errors });

  const inserted = [];
  for (const row of valid) {
    const result = await db.prepare('INSERT INTO manual_report_videos (report_id, page_name, platform, url) VALUES (?, ?, ?, ?)').run(report.id, row.pageName, row.platform, row.url);
    inserted.push(await db.prepare('SELECT * FROM manual_report_videos WHERE id = ?').get(result.lastInsertRowid));
  }
  refreshManyInBackground(inserted).catch(() => {});
  res.status(201).json({ inserted: inserted.length, lineErrors: errors });
});

router.delete('/:id/videos/:videoId', async (req, res) => {
  const result = await db.transaction(async (tx) => {
    await tx.prepare('DELETE FROM manual_report_video_metrics WHERE video_id = ?').run(req.params.videoId);
    return tx.prepare('DELETE FROM manual_report_videos WHERE id = ? AND report_id = ?').run(req.params.videoId, req.params.id);
  });
  if (!result.changes) return res.status(404).json({ error: 'Video bulunamadı' });
  res.status(204).end();
});

router.post('/:id/videos/:videoId/refresh', async (req, res) => {
  const video = await db.prepare('SELECT * FROM manual_report_videos WHERE id = ? AND report_id = ?').get(req.params.videoId, req.params.id);
  if (!video) return res.status(404).json({ error: 'Video bulunamadı' });
  const result = await refreshOneManualVideo(video);
  res.json({ result });
});

router.post('/:id/refresh-all', async (req, res) => {
  const videos = await db.prepare('SELECT * FROM manual_report_videos WHERE report_id = ?').all(req.params.id);
  if (!videos.length) return res.json({ started: false, count: 0 });
  refreshManyInBackground(videos).catch(() => {});
  res.json({ started: true, count: videos.length });
});

router.get('/:id/pdf', async (req, res) => {
  const report = await db.prepare('SELECT * FROM manual_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Rapor bulunamadı' });
  const summary = await reportTotals(report.id);
  const videos = await db.prepare(`
    SELECT v.page_name, v.platform, v.url, latest.views, latest.likes, latest.comments
    FROM manual_report_videos v
    LEFT JOIN manual_report_video_metrics latest ON latest.id = (
      SELECT id FROM manual_report_video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1
    )
    WHERE v.report_id = ? AND v.status = 'success'
    ORDER BY latest.views DESC
  `).all(report.id);
  const images = await getReportImages(report.id);
  const brandTitle = await getPdfHeaderTitle();
  const brandSubtitle = await getPdfHeaderSubtitle();
  await drawManualReportPdf(res, report, summary, videos, images, brandTitle, brandSubtitle);
});

module.exports = router;
module.exports.refreshAllManualReportVideos = async function refreshAllManualReportVideos() {
  if (!process.env.APIFY_API_TOKEN) return { skipped: true };
  const videos = await db.prepare("SELECT * FROM manual_report_videos WHERE status IN ('success', 'error')").all();
  await refreshManyInBackground(videos);
  return { skipped: false, count: videos.length };
};
