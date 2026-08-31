const express = require('express');
const path = require('path');
const multer = require('multer');
const PDFDocument = require('pdfkit');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { PLATFORMS, detectPlatform } = require('../utils/platform');
const { fetchPublicMetrics } = require('../services/apify.service');
const { uploadBuffer, destroyByUrl } = require('../services/storage.service');
const { getPdfHeaderTitle, getPdfHeaderSubtitle } = require('../utils/settings');

const router = express.Router();
const STATS_PLATFORMS = new Set(['instagram', 'tiktok']);
const CATEGORY_LABEL = { influencer: 'Influencer', rapmedia: 'Türkçe Rap Medyası', dizi: 'Dizi Edit Sayfası', futbol: 'Futbol Edit', araba: 'Araba Edit' };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Sadece 31 Ağustos 2026 için tek seferlik istisna: o gün eklenen linkler Ağustos yerine Eylül raporuna sayılır
const MONTH_EXCEPTION_DATE = '2026-08-31';
const MONTH_EXCEPTION_TARGET = '2026-09';
const EFFECTIVE_MONTH_SQL = `CASE WHEN date(l.created_at) = '${MONTH_EXCEPTION_DATE}' THEN '${MONTH_EXCEPTION_TARGET}' ELSE strftime('%Y-%m', l.created_at) END`;

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
  accent: '#D4A954'
};

const SCREENSHOT_FOLDER = 'locymedya/link-screenshots';
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = allowedTypes.has(file.mimetype) && allowedExtensions.has(path.extname(file.originalname).toLowerCase());
    callback(allowed ? null : new Error('Ekran görüntüsü JPG, PNG veya WEBP olmalı'), allowed);
  }
});

async function refreshStats(link) {
  const metrics = await fetchPublicMetrics(link);
  await db.prepare('UPDATE links SET stats_views = ?, stats_likes = ?, stats_comments = ?, stats_fetched_at = ? WHERE id = ?')
    .run(metrics.views, metrics.likes, metrics.comments, new Date().toISOString(), link.id);
  if (metrics.title) await db.prepare('UPDATE links SET preview_title = ? WHERE id = ?').run(metrics.title, link.id);
  return metrics;
}

function validateLink(platform, url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return 'Link geçerli bir HTTPS adresi olmalı';
  } catch {
    return 'Geçerli bir link girin';
  }
  if (!Object.keys(PLATFORMS).includes(platform)) return 'Geçersiz platform';
  return null;
}

router.use(authenticate);

async function resolveAccountId(rawAccountId) {
  if (rawAccountId === undefined || rawAccountId === null || rawAccountId === '') return { accountId: null };
  const accountId = Number(rawAccountId);
  if (!Number.isInteger(accountId)) return { error: 'Geçersiz hesap' };
  const account = await db.prepare('SELECT id FROM offer_accounts WHERE id = ?').get(accountId);
  if (!account) return { error: 'Hesap bulunamadı' };
  return { accountId };
}

router.get('/', requireRole('admin'), async (req, res) => {
  const links = await db.prepare(`
    SELECT l.*, oa.name AS account_name, oa.category AS account_category
    FROM links l
    LEFT JOIN offer_accounts oa ON oa.id = l.account_id
    ORDER BY l.created_at DESC, l.id DESC
  `).all();
  res.json({ links });
});

router.post('/', requireRole('admin', 'rapmedia'), async (req, res) => {
  const url = String(req.body.url || '').trim();
  const title = String(req.body.title || '').trim().slice(0, 200);
  const platform = String(req.body.platform || '').toLowerCase() || detectPlatform(url);
  const error = validateLink(platform, url);
  if (error) return res.status(400).json({ error });
  const resolved = await resolveAccountId(req.body.accountId);
  if (resolved?.error) return res.status(400).json({ error: resolved.error });

  const result = await db.prepare('INSERT INTO links (platform, url, title, account_id) VALUES (?, ?, ?, ?)').run(platform, url, title || null, resolved.accountId);
  res.status(201).json({ link: await db.prepare('SELECT * FROM links WHERE id = ?').get(result.lastInsertRowid) });
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const url = String(req.body.url || '').trim();
  const title = String(req.body.title || '').trim().slice(0, 200);
  const platform = String(req.body.platform || '').toLowerCase() || detectPlatform(url);
  const error = validateLink(platform, url);
  if (error) return res.status(400).json({ error });
  const resolved = await resolveAccountId(req.body.accountId);
  if (resolved?.error) return res.status(400).json({ error: resolved.error });

  const result = await db.prepare('UPDATE links SET platform = ?, url = ?, title = ?, account_id = ? WHERE id = ?').run(platform, url, title || null, resolved.accountId, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Link bulunamadı' });
  res.json({ link: await db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const result = await db.prepare('DELETE FROM links WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Link bulunamadı' });
  res.status(204).end();
});

router.post('/:id/refresh-stats', requireRole('admin'), async (req, res) => {
  const link = await db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Link bulunamadı' });
  if (!STATS_PLATFORMS.has(link.platform)) return res.status(400).json({ error: 'Bu platform için istatistik desteği yok' });
  try {
    await refreshStats(link);
    res.json({ link: await db.prepare('SELECT * FROM links WHERE id = ?').get(link.id) });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

router.post('/refresh-stats', requireRole('admin'), async (req, res) => {
  const pending = (await db.prepare('SELECT * FROM links WHERE stats_fetched_at IS NULL AND archived = 0').all()).filter((link) => STATS_PLATFORMS.has(link.platform));
  let updated = 0;
  let failed = 0;
  for (const [index, link] of pending.entries()) {
    try {
      await refreshStats(link);
      updated += 1;
    } catch {
      await db.prepare('UPDATE links SET stats_fetched_at = ? WHERE id = ?').run(new Date().toISOString(), link.id);
      failed += 1;
    }
    if (index < pending.length - 1) await sleep(3000);
  }
  res.json({ updated, failed });
});

router.post('/:id/screenshot', requireRole('admin'), screenshotUpload.single('screenshot'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Ekran görüntüsü zorunlu' });
  const link = await db.prepare('SELECT id, screenshot_url FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Link bulunamadı' });
  const result = await uploadBuffer(req.file.buffer, { folder: SCREENSHOT_FOLDER, resourceType: 'image' });
  await destroyByUrl(link.screenshot_url, SCREENSHOT_FOLDER, 'image');
  const screenshotUrl = result.secure_url;
  await db.prepare('UPDATE links SET screenshot_url = ? WHERE id = ?').run(screenshotUrl, link.id);
  res.json({ link: await db.prepare('SELECT * FROM links WHERE id = ?').get(link.id) });
});

router.delete('/:id/screenshot', requireRole('admin'), async (req, res) => {
  const link = await db.prepare('SELECT id, screenshot_url FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Link bulunamadı' });
  await destroyByUrl(link.screenshot_url, SCREENSHOT_FOLDER, 'image');
  await db.prepare('UPDATE links SET screenshot_url = NULL WHERE id = ?').run(link.id);
  res.json({ link: await db.prepare('SELECT * FROM links WHERE id = ?').get(link.id) });
});

router.post('/:id/archive', requireRole('admin'), async (req, res) => {
  const result = await db.prepare('UPDATE links SET archived = 1 WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Link bulunamadı' });
  res.json({ link: await db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id) });
});

router.post('/:id/unarchive', requireRole('admin'), async (req, res) => {
  const result = await db.prepare('UPDATE links SET archived = 0 WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Link bulunamadı' });
  res.json({ link: await db.prepare('SELECT * FROM links WHERE id = ?').get(req.params.id) });
});

const MONTH_LABELS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
function monthLabel(month) {
  const [year, m] = month.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]} ${year}`;
}

async function accountReportRows(month) {
  return db.prepare(`
    SELECT oa.id AS account_id, oa.name, oa.category,
      COUNT(l.id) AS link_count,
      COALESCE(SUM(l.stats_views), 0) AS total_views,
      COALESCE(SUM(l.stats_likes), 0) AS total_likes,
      COALESCE(SUM(l.stats_comments), 0) AS total_comments
    FROM links l
    JOIN offer_accounts oa ON oa.id = l.account_id
    WHERE ${EFFECTIVE_MONTH_SQL} = ?
    GROUP BY oa.id
    ORDER BY total_views DESC, oa.name ASC
  `).all(month);
}

router.get('/account-report', requireRole('admin'), async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
  const rows = await accountReportRows(month);
  const unassignedCount = (await db.prepare(`SELECT COUNT(*) c FROM links l WHERE l.account_id IS NULL AND ${EFFECTIVE_MONTH_SQL} = ?`).get(month)).c;
  res.json({ month, monthLabel: monthLabel(month), accounts: rows, unassignedCount });
});

router.get('/account-report/pdf', requireRole('admin'), async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
  const rows = await accountReportRows(month);
  const brandTitle = await getPdfHeaderTitle();
  const brandSubtitle = await getPdfHeaderSubtitle();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="hesap-raporu-${month}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true, info: { Title: `${brandTitle} - Hesap Raporu ${month}`, Author: brandTitle } });
  doc.registerFont('Manrope', FONT_PATH);
  doc.pipe(res);

  const pageWidth = () => doc.page.width - PAGE_MARGIN * 2;
  function paintBg() { doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLOR.pageBg); }
  paintBg();

  doc.font('Manrope').fontSize(20).fillColor(COLOR.textPrimary).text(brandTitle, PAGE_MARGIN, PAGE_MARGIN);
  if (brandSubtitle) doc.fontSize(9).fillColor(COLOR.textSecondary).text(brandSubtitle, PAGE_MARGIN, doc.y + 2);
  const lineY1 = doc.y + 12;
  doc.moveTo(PAGE_MARGIN, lineY1).lineTo(PAGE_MARGIN + pageWidth(), lineY1).lineWidth(1).strokeColor(COLOR.divider).stroke();
  doc.y = lineY1 + 16;

  doc.font('Manrope').fontSize(22).fillColor(COLOR.textPrimary).text(`Hesap Raporu — ${monthLabel(month)}`, PAGE_MARGIN, doc.y, { width: pageWidth() });
  doc.y += 24;

  const cols = [
    { label: 'HESAP', width: 0.34 },
    { label: 'KATEGORİ', width: 0.18 },
    { label: 'LİNK', width: 0.1 },
    { label: 'İZLENME', width: 0.13 },
    { label: 'BEĞENİ', width: 0.13 },
    { label: 'YORUM', width: 0.12 }
  ];
  const contentBottom = () => doc.page.height - PAGE_MARGIN - 40;

  function drawHeaderRow() {
    const y = doc.y;
    let x = PAGE_MARGIN;
    doc.font('Manrope').fontSize(8).fillColor(COLOR.textMuted);
    cols.forEach((col) => {
      doc.text(col.label, x, y, { width: pageWidth() * col.width, align: col.label === 'HESAP' || col.label === 'KATEGORİ' ? 'left' : 'right' });
      x += pageWidth() * col.width;
    });
    doc.y = y + 16;
    const lineY = doc.y;
    doc.moveTo(PAGE_MARGIN, lineY).lineTo(PAGE_MARGIN + pageWidth(), lineY).lineWidth(1).strokeColor(COLOR.divider).stroke();
    doc.y = lineY + 10;
  }

  drawHeaderRow();

  rows.forEach((row) => {
    if (doc.y + 24 > contentBottom()) { doc.addPage(); paintBg(); doc.y = PAGE_MARGIN; drawHeaderRow(); }
    const y = doc.y;
    let x = PAGE_MARGIN;
    const values = [row.name, CATEGORY_LABEL[row.category] || row.category, String(row.link_count), row.total_views.toLocaleString('tr-TR'), row.total_likes.toLocaleString('tr-TR'), row.total_comments.toLocaleString('tr-TR')];
    doc.font('Manrope').fontSize(10).fillColor(COLOR.textPrimary);
    values.forEach((value, i) => {
      doc.text(value, x, y, { width: pageWidth() * cols[i].width, align: i <= 1 ? 'left' : 'right' });
      x += pageWidth() * cols[i].width;
    });
    doc.y = y + 22;
  });

  if (!rows.length) {
    doc.font('Manrope').fontSize(11).fillColor(COLOR.textSecondary).text('Bu ay için hesap bazlı veri bulunmuyor.', PAGE_MARGIN, doc.y + 10);
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
});

module.exports = router;
