const express = require('express');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { calculateEarning, getViewPaymentRate } = require('../utils/settings');

const router = express.Router();

// En güncel metrik snapshot'ını, silinmiş videoları hariç tutarak toplayan yardımcı sorgu
const LATEST_ACTIVE_VIEWS_SQL = `
  SELECT COALESCE(SUM(vm.views), 0) AS total
  FROM video_metrics vm
  JOIN (
    SELECT video_id, MAX(scraped_at) AS latest
    FROM video_metrics
    GROUP BY video_id
  ) last ON last.video_id = vm.video_id AND last.latest = vm.scraped_at
  JOIN videos v ON v.id = vm.video_id
  WHERE v.status = 'active'
`;

router.get('/admin', authenticate, requireRole('admin'), (req, res) => {
  const totalViews = db.prepare(LATEST_ACTIVE_VIEWS_SQL).get().total;
  res.json({
    activeProjects: db.prepare("SELECT COUNT(*) c FROM projects WHERE status = 'active'").get().c,
    completedProjects: db.prepare("SELECT COUNT(*) c FROM projects WHERE status = 'completed'").get().c,
    totalInfluencers: db.prepare('SELECT COUNT(*) c FROM influencers').get().c,
    totalMediaAccounts: db.prepare('SELECT COUNT(*) c FROM media_accounts').get().c,
    totalArtists: db.prepare('SELECT COUNT(*) c FROM artists').get().c,
    totalVideos: db.prepare("SELECT COUNT(*) c FROM videos WHERE status = 'active'").get().c,
    totalViews,
    totalPaid: db.prepare("SELECT COALESCE(SUM(amount),0) c FROM payments WHERE status = 'paid'").get().c,
    estimatedEarnings: calculateEarning(totalViews)
  });
});

router.get('/influencer', authenticate, requireRole('influencer'), (req, res) => {
  const influencer = db.prepare('SELECT * FROM influencers WHERE user_id = ?').get(req.user.id);
  if (!influencer) return res.json({ influencer: null, payments: [], totalThisMonth: 0, totalViews: 0, estimatedEarnings: 0, ratePerView: getViewPaymentRate() });

  const payments = db
    .prepare("SELECT * FROM payments WHERE influencer_id = ? AND status = 'paid' ORDER BY paid_at DESC")
    .all(influencer.id);

  const totalThisMonth = db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) c FROM payments
      WHERE influencer_id = ? AND status = 'paid' AND strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now')`
    )
    .get(influencer.id).c;

  const totalViews = db
    .prepare(
      `SELECT COALESCE(SUM(vm.views), 0) total
       FROM video_metrics vm
       JOIN (SELECT video_id, MAX(scraped_at) AS latest FROM video_metrics GROUP BY video_id) last
         ON last.video_id = vm.video_id AND last.latest = vm.scraped_at
       JOIN videos v ON v.id = vm.video_id
       WHERE v.status = 'active' AND v.owner_user_id = ?`
    )
    .get(req.user.id).total;

  res.json({ influencer, payments, totalThisMonth, totalViews, estimatedEarnings: calculateEarning(totalViews), ratePerView: getViewPaymentRate() });
});

router.get('/rapmedia', authenticate, requireRole('rapmedia'), (req, res) => {
  const account = db.prepare('SELECT * FROM media_accounts WHERE user_id = ?').get(req.user.id);
  if (!account) return res.json({ account: null, projects: [], payments: [], totalThisMonth: 0 });

  const projects = db
    .prepare(
      `SELECT p.* FROM projects p
       JOIN project_media_accounts pma ON pma.project_id = p.id
       WHERE pma.media_account_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(account.id);

  const payments = db
    .prepare(`SELECT p.*, pr.name AS project_name FROM payments p LEFT JOIN projects pr ON pr.id = p.project_id WHERE p.media_account_id = ? AND p.status = 'paid' ORDER BY p.paid_at DESC`)
    .all(account.id);

  const totalThisMonth = db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) c FROM payments
      WHERE media_account_id = ? AND status = 'paid' AND strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now')`
    )
    .get(account.id).c;

  res.json({ account, projects, payments, totalThisMonth });
});

module.exports = router;
