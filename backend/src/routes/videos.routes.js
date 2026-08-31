const express = require('express');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { refreshVideo } = require('../services/apify.service');
const { getViewPaymentRate, calculateEarningSync } = require('../utils/settings');

const router = express.Router();
const PLATFORMS = new Set(['instagram', 'tiktok']);

router.use(authenticate);

async function currentOwner(req) {
  if (req.user.role === 'influencer') return (await db.prepare('SELECT id FROM influencers WHERE user_id = ?').get(req.user.id))?.id;
  if (req.user.role === 'rapmedia') return (await db.prepare('SELECT id FROM media_accounts WHERE user_id = ?').get(req.user.id))?.id;
  return null;
}

router.get('/', requireRole('admin', 'influencer', 'artist', 'rapmedia'), async (req, res) => {
  const latest = 'LEFT JOIN video_metrics latest ON latest.id = (SELECT id FROM video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1)';
  const rows = req.user.role === 'admin'
    ? await db.prepare(`SELECT v.*, p.name AS project_name, u.display_name AS owner_name, latest.views, latest.likes, latest.comments FROM videos v LEFT JOIN projects p ON p.id = v.project_id LEFT JOIN users u ON u.id = v.owner_user_id ${latest} ORDER BY v.created_at DESC`).all()
    : await db.prepare(`SELECT v.*, p.name AS project_name, latest.views, latest.likes, latest.comments FROM videos v LEFT JOIN projects p ON p.id = v.project_id ${latest} WHERE v.owner_user_id = ? ORDER BY v.created_at DESC`).all(req.user.id);
  const rate = await getViewPaymentRate();
  res.json({ videos: rows.map((row) => ({ ...row, earning: calculateEarningSync(row.views, rate) })) });
});

router.post('/', requireRole('admin', 'influencer', 'rapmedia'), async (req, res) => {
  const { projectId, platform, url } = req.body;
  if (!PLATFORMS.has(platform) || !url) return res.status(400).json({ error: 'Instagram veya TikTok linki zorunlu' });
  const project = await db.prepare('SELECT id FROM projects WHERE id = ?').get(projectId);
  if (!project) return res.status(400).json({ error: 'Proje bulunamadı' });
  const ownerId = req.user.role === 'admin' ? req.body.ownerUserId : req.user.id;
  if (!ownerId) return res.status(400).json({ error: 'Video sahibi zorunlu' });
  if (req.user.role === 'influencer') {
    const influencer = await db.prepare('SELECT id FROM influencers WHERE user_id = ?').get(req.user.id);
    const assigned = influencer && await db.prepare('SELECT 1 FROM project_influencers WHERE project_id = ? AND influencer_id = ?').get(projectId, influencer.id);
    if (!assigned) return res.status(403).json({ error: 'Bu projeye video ekleme yetkiniz yok' });
  }
  if (req.user.role === 'rapmedia') {
    const account = await db.prepare('SELECT id FROM media_accounts WHERE user_id = ?').get(req.user.id);
    const assigned = account && await db.prepare('SELECT 1 FROM project_media_accounts WHERE project_id = ? AND media_account_id = ?').get(projectId, account.id);
    if (!assigned) return res.status(403).json({ error: 'Bu projeye video ekleme yetkiniz yok' });
  }
  const result = await db.prepare('INSERT INTO videos (project_id, owner_user_id, platform, url) VALUES (?, ?, ?, ?)').run(projectId, ownerId, platform, url.trim());
  res.status(201).json({ video: await db.prepare('SELECT * FROM videos WHERE id = ?').get(result.lastInsertRowid) });
});

router.post('/:id/refresh', requireRole('admin', 'influencer', 'rapmedia'), async (req, res, next) => {
  try {
    const video = await db.prepare('SELECT * FROM videos WHERE id = ?').get(req.params.id);
    if (!video) return res.status(404).json({ error: 'Video bulunamadı' });
    if (req.user.role !== 'admin' && video.owner_user_id !== req.user.id) return res.status(403).json({ error: 'Bu videoya erişim yetkiniz yok' });
    res.json({ result: await refreshVideo(video) });
  } catch (error) { next(error); }
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const result = await db.transaction(async (tx) => {
    await tx.prepare('DELETE FROM video_metrics WHERE video_id = ?').run(req.params.id);
    return tx.prepare('DELETE FROM videos WHERE id = ?').run(req.params.id);
  });
  if (!result.changes) return res.status(404).json({ error: 'Video bulunamadı' });
  res.status(204).end();
});

router.get('/owner-report', requireRole('admin'), async (req, res) => {
  const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : new Date().toISOString().slice(0, 7);
  // Projesi silinmiş (project_id NULL) videolar rapora ve ödeme tutarına dahil edilmez
  const rows = await db.prepare(`
    SELECT v.owner_user_id AS owner_id, COALESCE(u.display_name, u.username, 'Bilinmiyor') AS owner_name, u.role,
      COUNT(v.id) AS video_count,
      COALESCE(SUM(latest.views), 0) AS total_views,
      COALESCE(SUM(latest.likes), 0) AS total_likes,
      COALESCE(SUM(latest.comments), 0) AS total_comments
    FROM videos v
    LEFT JOIN users u ON u.id = v.owner_user_id
    LEFT JOIN video_metrics latest ON latest.id = (SELECT id FROM video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1)
    WHERE strftime('%Y-%m', v.created_at) = ? AND v.project_id IS NOT NULL
    GROUP BY v.owner_user_id
    ORDER BY total_views DESC
  `).all(month);
  const rate = await getViewPaymentRate();
  const owners = rows.map((row) => ({ ...row, estimated_payment: calculateEarningSync(row.total_views, rate) }));
  res.json({ month, ratePerView: rate, owners });
});

module.exports = router;
