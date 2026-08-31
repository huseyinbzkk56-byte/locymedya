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

// LEFT JOIN'ü her sorguda tekrar tekrar yazmamak için: her videonun en güncel ve en eski metrik satırı
const LATEST_METRIC_JOIN = 'LEFT JOIN video_metrics latest ON latest.id = (SELECT id FROM video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1)';
const FIRST_METRIC_JOIN = 'LEFT JOIN video_metrics first_m ON first_m.id = (SELECT id FROM video_metrics WHERE video_id = v.id ORDER BY scraped_at ASC, id ASC LIMIT 1)';

function pad2(n) { return String(n).padStart(2, '0'); }
function firstOfMonth(y, m) { return `${y}-${pad2(m)}-01`; } // m: 1-indexli ay

// range: 'month' (varsayılan, ?month=YYYY-MM ile birlikte), 'all', 'lastMonth', 'last3'
function resolveDateRange(range, monthParam) {
  const now = new Date();
  if (range === 'all') return null;
  if (range === 'lastMonth') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: firstOfMonth(d.getFullYear(), d.getMonth() + 1), to: firstOfMonth(to.getFullYear(), to.getMonth() + 1) };
  }
  if (range === 'last3') {
    const d = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return { from: firstOfMonth(d.getFullYear(), d.getMonth() + 1), to: firstOfMonth(to.getFullYear(), to.getMonth() + 1) };
  }
  const month = /^\d{4}-\d{2}$/.test(monthParam || '') ? monthParam : now.toISOString().slice(0, 7);
  const [y, m] = month.split('-').map(Number);
  const to = new Date(y, m, 1);
  return { from: firstOfMonth(y, m), to: firstOfMonth(to.getFullYear(), to.getMonth() + 1), month };
}

router.get('/owner-report', requireRole('admin'), async (req, res) => {
  const range = resolveDateRange(req.query.range, req.query.month);
  const rangeClause = range ? 'AND v.created_at >= ? AND v.created_at < ?' : '';
  const rangeArgs = range ? [range.from, range.to] : [];
  const rate = await getViewPaymentRate();

  // Sahip başına toplam (tüm zamanlar) rakamlar
  const totals = await db.prepare(`
    SELECT v.owner_user_id AS owner_id, COALESCE(u.display_name, u.username, 'Bilinmiyor') AS owner_name, u.username, u.role,
      COUNT(DISTINCT v.id) AS total_video_count,
      COUNT(DISTINCT v.project_id) AS total_project_count,
      COALESCE(SUM(latest.views), 0) AS total_views
    FROM videos v
    LEFT JOIN users u ON u.id = v.owner_user_id
    ${LATEST_METRIC_JOIN}
    WHERE v.project_id IS NOT NULL
    GROUP BY v.owner_user_id
  `).all();

  // Sahip başına seçilen aralığa özel rakamlar
  const rangeRows = await db.prepare(`
    SELECT v.owner_user_id AS owner_id,
      COUNT(DISTINCT v.id) AS range_video_count,
      COUNT(DISTINCT v.project_id) AS range_project_count,
      COALESCE(SUM(latest.views), 0) AS range_views
    FROM videos v
    ${LATEST_METRIC_JOIN}
    WHERE v.project_id IS NOT NULL ${rangeClause}
    GROUP BY v.owner_user_id
  `).all(...rangeArgs);
  const rangeMap = new Map(rangeRows.map((row) => [row.owner_id, row]));

  // Sahip başına en çok izlenen tek video (tüm zamanlar)
  const topVideoRows = await db.prepare(`
    SELECT owner_id, url, views FROM (
      SELECT v.owner_user_id AS owner_id, v.url, COALESCE(latest.views, 0) AS views,
        ROW_NUMBER() OVER (PARTITION BY v.owner_user_id ORDER BY COALESCE(latest.views, 0) DESC) AS rn
      FROM videos v
      ${LATEST_METRIC_JOIN}
      WHERE v.project_id IS NOT NULL
    ) WHERE rn = 1
  `).all();
  const topVideoMap = new Map(topVideoRows.map((row) => [row.owner_id, row]));

  // Sahip başına en çok katkı verdiği proje (tüm zamanlar)
  const topProjectRows = await db.prepare(`
    SELECT owner_id, project_id, project_name, views FROM (
      SELECT v.owner_user_id AS owner_id, v.project_id, p.name AS project_name,
        COALESCE(SUM(latest.views), 0) AS views,
        ROW_NUMBER() OVER (PARTITION BY v.owner_user_id ORDER BY SUM(COALESCE(latest.views, 0)) DESC) AS rn
      FROM videos v
      JOIN projects p ON p.id = v.project_id
      ${LATEST_METRIC_JOIN}
      GROUP BY v.owner_user_id, v.project_id
    ) WHERE rn = 1
  `).all();
  const topProjectMap = new Map(topProjectRows.map((row) => [row.owner_id, row]));

  const owners = totals.map((row) => {
    const r = rangeMap.get(row.owner_id) || { range_video_count: 0, range_project_count: 0, range_views: 0 };
    const topVideo = topVideoMap.get(row.owner_id) || null;
    const topProject = topProjectMap.get(row.owner_id) || null;
    return {
      owner_id: row.owner_id,
      owner_name: row.owner_name,
      username: row.username,
      role: row.role,
      total_video_count: row.total_video_count,
      total_project_count: row.total_project_count,
      total_views: row.total_views,
      total_payment: calculateEarningSync(row.total_views, rate),
      range_video_count: r.range_video_count,
      range_project_count: r.range_project_count,
      range_views: r.range_views,
      range_payment: calculateEarningSync(r.range_views, rate),
      top_video_url: topVideo?.url ?? null,
      top_video_views: topVideo?.views ?? 0,
      top_project_id: topProject?.project_id ?? null,
      top_project_name: topProject?.project_name ?? null,
      top_project_views: topProject?.views ?? 0,
      top_project_payment: calculateEarningSync(topProject?.views ?? 0, rate)
    };
  }).sort((a, b) => b.range_views - a.range_views);

  res.json({ range: range ? { from: range.from, to: range.to, month: range.month } : null, ratePerView: rate, owners });
});

router.get('/owner-report/:ownerId', requireRole('admin'), async (req, res) => {
  const ownerId = Number(req.params.ownerId);
  const owner = await db.prepare("SELECT id, COALESCE(display_name, username, 'Bilinmiyor') AS name, username, role FROM users WHERE id = ?").get(ownerId);
  if (!owner) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  const rate = await getViewPaymentRate();

  const totals = (await db.prepare(`
    SELECT COUNT(DISTINCT v.id) AS video_count, COUNT(DISTINCT v.project_id) AS project_count, COALESCE(SUM(latest.views), 0) AS total_views
    FROM videos v ${LATEST_METRIC_JOIN}
    WHERE v.owner_user_id = ? AND v.project_id IS NOT NULL
  `).get(ownerId)) || { video_count: 0, project_count: 0, total_views: 0 };

  const currentMonth = new Date().toISOString().slice(0, 7);
  const thisMonthRow = (await db.prepare(`
    SELECT COALESCE(SUM(latest.views), 0) AS views
    FROM videos v ${LATEST_METRIC_JOIN}
    WHERE v.owner_user_id = ? AND v.project_id IS NOT NULL AND strftime('%Y-%m', v.created_at) = ?
  `).get(ownerId, currentMonth)) || { views: 0 };

  const monthly = (await db.prepare(`
    SELECT strftime('%Y-%m', v.created_at) AS month,
      COUNT(DISTINCT v.id) AS video_count, COUNT(DISTINCT v.project_id) AS project_count,
      COALESCE(SUM(latest.views), 0) AS total_views
    FROM videos v ${LATEST_METRIC_JOIN}
    WHERE v.owner_user_id = ? AND v.project_id IS NOT NULL
    GROUP BY month ORDER BY month DESC
  `).all(ownerId)).map((row) => ({ ...row, total_payment: calculateEarningSync(row.total_views, rate) }));

  const projects = (await db.prepare(`
    SELECT v.project_id, p.name AS project_name, COUNT(v.id) AS video_count, COALESCE(SUM(latest.views), 0) AS total_views
    FROM videos v
    JOIN projects p ON p.id = v.project_id
    ${LATEST_METRIC_JOIN}
    WHERE v.owner_user_id = ?
    GROUP BY v.project_id ORDER BY total_views DESC
  `).all(ownerId)).map((row) => ({ ...row, total_payment: calculateEarningSync(row.total_views, rate) }));
  const projectViewsSum = projects.reduce((sum, p) => sum + p.total_views, 0) || 1;
  projects.forEach((p) => { p.contribution_percent = Math.round((p.total_views / projectViewsSum) * 1000) / 10; });

  const videos = (await db.prepare(`
    SELECT v.id, v.url, v.platform, v.status, v.created_at, p.name AS project_name,
      COALESCE(first_m.views, 0) AS start_views, latest.views AS current_views,
      latest.likes, latest.comments, latest.scraped_at AS last_checked_at
    FROM videos v
    LEFT JOIN projects p ON p.id = v.project_id
    ${FIRST_METRIC_JOIN}
    ${LATEST_METRIC_JOIN}
    WHERE v.owner_user_id = ? AND v.project_id IS NOT NULL
    ORDER BY v.created_at DESC
  `).all(ownerId)).map((row) => ({
    ...row,
    current_views: row.current_views ?? 0,
    gained_views: Math.max((row.current_views ?? 0) - row.start_views, 0),
    payment: calculateEarningSync(row.current_views ?? 0, rate)
  }));

  res.json({
    owner,
    ratePerView: rate,
    summary: {
      totalViews: totals.total_views,
      totalPayment: calculateEarningSync(totals.total_views, rate),
      monthViews: thisMonthRow.views,
      monthPayment: calculateEarningSync(thisMonthRow.views, rate),
      projectCount: totals.project_count,
      videoCount: totals.video_count
    },
    monthly,
    projects,
    videos
  });
});

module.exports = router;
