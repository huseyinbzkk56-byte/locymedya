const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { PLATFORMS, detectPlatform } = require('../utils/platform');
const { fetchPublicMetrics } = require('../services/apify.service');

const router = express.Router();
const STATS_PLATFORMS = new Set(['instagram', 'tiktok']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const screenshotDir = path.join(__dirname, '../../data/link-screenshots');
fs.mkdirSync(screenshotDir, { recursive: true });
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const screenshotUpload = multer({
  storage: multer.diskStorage({
    destination: screenshotDir,
    filename: (req, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`)
  }),
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

router.get('/', requireRole('admin'), async (req, res) => {
  const links = await db.prepare('SELECT * FROM links ORDER BY created_at DESC, id DESC').all();
  res.json({ links });
});

router.post('/', requireRole('admin', 'rapmedia'), async (req, res) => {
  const url = String(req.body.url || '').trim();
  const title = String(req.body.title || '').trim().slice(0, 200);
  const platform = String(req.body.platform || '').toLowerCase() || detectPlatform(url);
  const error = validateLink(platform, url);
  if (error) return res.status(400).json({ error });

  const result = await db.prepare('INSERT INTO links (platform, url, title) VALUES (?, ?, ?)').run(platform, url, title || null);
  res.status(201).json({ link: await db.prepare('SELECT * FROM links WHERE id = ?').get(result.lastInsertRowid) });
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const url = String(req.body.url || '').trim();
  const title = String(req.body.title || '').trim().slice(0, 200);
  const platform = String(req.body.platform || '').toLowerCase() || detectPlatform(url);
  const error = validateLink(platform, url);
  if (error) return res.status(400).json({ error });

  const result = await db.prepare('UPDATE links SET platform = ?, url = ?, title = ? WHERE id = ?').run(platform, url, title || null, req.params.id);
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
  if (!link) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(404).json({ error: 'Link bulunamadı' });
  }
  if (link.screenshot_url?.startsWith('/uploads/link-screenshots/')) {
    fs.rmSync(path.join(screenshotDir, path.basename(link.screenshot_url)), { force: true });
  }
  const screenshotUrl = `/uploads/link-screenshots/${req.file.filename}`;
  await db.prepare('UPDATE links SET screenshot_url = ? WHERE id = ?').run(screenshotUrl, link.id);
  res.json({ link: await db.prepare('SELECT * FROM links WHERE id = ?').get(link.id) });
});

router.delete('/:id/screenshot', requireRole('admin'), async (req, res) => {
  const link = await db.prepare('SELECT id, screenshot_url FROM links WHERE id = ?').get(req.params.id);
  if (!link) return res.status(404).json({ error: 'Link bulunamadı' });
  if (link.screenshot_url?.startsWith('/uploads/link-screenshots/')) {
    fs.rmSync(path.join(screenshotDir, path.basename(link.screenshot_url)), { force: true });
  }
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

module.exports = router;
