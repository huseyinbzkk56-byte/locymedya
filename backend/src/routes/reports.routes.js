const express = require('express');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { calculateEarning, getViewPaymentRate } = require('../utils/settings');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/', (req, res) => {
  const latest = `JOIN (SELECT video_id, MAX(scraped_at) AS latest FROM video_metrics GROUP BY video_id) last ON last.video_id = vm.video_id AND last.latest = vm.scraped_at`;
  const totalViews = db.prepare(`SELECT COALESCE(SUM(vm.views), 0) value FROM video_metrics vm ${latest} JOIN videos v ON v.id = vm.video_id WHERE v.status = 'active'`).get().value;
  const summary = {
    totalViews,
    videoCount: db.prepare('SELECT COUNT(*) value FROM videos').get().value,
    activeVideoCount: db.prepare("SELECT COUNT(*) value FROM videos WHERE status = 'active'").get().value,
    unavailableVideoCount: db.prepare("SELECT COUNT(*) value FROM videos WHERE status IN ('deleted','unreachable')").get().value,
    ratePerView: getViewPaymentRate(),
    totalEstimatedEarnings: calculateEarning(totalViews)
  };
  const topVideos = db.prepare(`SELECT v.id, v.url, v.platform, v.status, COALESCE(vm.views, 0) views, u.display_name AS influencer_name, p.name AS project_name FROM videos v LEFT JOIN video_metrics vm ON vm.id = (SELECT id FROM video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1) LEFT JOIN users u ON u.id = v.owner_user_id LEFT JOIN projects p ON p.id = v.project_id ORDER BY views DESC LIMIT 10`).all()
    .map((row) => ({ ...row, estimated_earnings: calculateEarning(row.views) }));
  const monthly = db.prepare(`SELECT strftime('%Y-%m', vm.scraped_at) month, COUNT(DISTINCT v.id) video_count, COALESCE(SUM(vm.views), 0) total_views, v.platform FROM video_metrics vm JOIN videos v ON v.id = vm.video_id GROUP BY month, v.platform ORDER BY month DESC`).all();
  const influencers = db.prepare(`SELECT COALESCE(u.display_name, u.username) influencer_name, COUNT(DISTINCT v.id) video_count, COALESCE(SUM(vm.views), 0) total_views FROM videos v LEFT JOIN users u ON u.id = v.owner_user_id LEFT JOIN video_metrics vm ON vm.id = (SELECT id FROM video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1) GROUP BY v.owner_user_id ORDER BY total_views DESC`).all()
    .map((row) => ({ ...row, estimated_earnings: calculateEarning(row.total_views) }));
  const projects = db.prepare(`SELECT p.name project_name, COUNT(DISTINCT v.id) video_count, COALESCE(SUM(vm.views), 0) total_views FROM projects p LEFT JOIN videos v ON v.project_id = p.id LEFT JOIN video_metrics vm ON vm.id = (SELECT id FROM video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1) GROUP BY p.id ORDER BY total_views DESC`).all()
    .map((row) => ({ ...row, estimated_earnings: calculateEarning(row.total_views) }));
  const platforms = db.prepare(`SELECT v.platform, COUNT(DISTINCT v.id) video_count, COALESCE(SUM(vm.views), 0) total_views FROM videos v LEFT JOIN video_metrics vm ON vm.id = (SELECT id FROM video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1) GROUP BY v.platform`).all();
  res.json({ summary, topVideos, monthly, influencers, projects, platforms });
});

router.get('/yearly', (req, res) => {
  const year = String(req.query.year || new Date().getFullYear());

  const videos = db.prepare(`
    SELECT v.id, v.project_id, p.name AS project_name,
      MAX(COALESCE(vm.views, 0), 0) views, MAX(COALESCE(vm.likes, 0), 0) likes,
      MAX(COALESCE(vm.comments, 0), 0) comments, MAX(COALESCE(vm.shares, 0), 0) shares
    FROM videos v
    LEFT JOIN video_metrics vm ON vm.id = (SELECT id FROM video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1)
    LEFT JOIN projects p ON p.id = v.project_id
    WHERE v.status = 'active' AND strftime('%Y', v.created_at) = ?
  `).all(year);

  const totals = videos.reduce((acc, v) => {
    acc.views += v.views;
    acc.engagement += v.likes + v.comments + v.shares;
    return acc;
  }, { views: 0, engagement: 0 });

  const projectMap = new Map();
  videos.forEach((v) => {
    if (!v.project_id) return;
    if (!projectMap.has(v.project_id)) projectMap.set(v.project_id, { id: v.project_id, name: v.project_name, views: 0, engagement: 0, videoCount: 0 });
    const p = projectMap.get(v.project_id);
    p.views += v.views;
    p.engagement += v.likes + v.comments + v.shares;
    p.videoCount += 1;
  });
  const projects = [...projectMap.values()].sort((a, b) => b.engagement - a.engagement);

  const monthly = db.prepare(`
    SELECT strftime('%m', vm.scraped_at) month, COALESCE(SUM(vm.views), 0) total_views
    FROM video_metrics vm JOIN videos v ON v.id = vm.video_id
    WHERE strftime('%Y', vm.scraped_at) = ? AND v.status = 'active'
    GROUP BY month ORDER BY month ASC
  `).all(year);

  const availableYears = db.prepare(`SELECT DISTINCT strftime('%Y', created_at) y FROM videos ORDER BY y DESC`).all().map((r) => r.y).filter(Boolean);

  res.json({
    year,
    availableYears: availableYears.length ? availableYears : [year],
    totalViews: totals.views,
    totalEngagement: totals.engagement,
    videoCount: videos.length,
    projectCount: projects.length,
    topProject: projects[0] || null,
    projects,
    monthly
  });
});

module.exports = router;
