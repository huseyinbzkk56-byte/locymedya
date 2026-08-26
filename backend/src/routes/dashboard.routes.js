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

router.get('/admin', authenticate, requireRole('admin'), async (req, res) => {
  const totalViews = (await db.prepare(LATEST_ACTIVE_VIEWS_SQL).get()).total;
  // Şirket hesabı (kısıtlı admin) kazanç yerine henüz ödenmemiş (bekleyen) tutarı görür
  const earningsFigure = req.user.adminScope === 'company'
    ? (await db.prepare("SELECT COALESCE(SUM(amount),0) c FROM payments WHERE status = 'pending'").get()).c
    : await calculateEarning(totalViews);
  res.json({
    activeProjects: (await db.prepare("SELECT COUNT(*) c FROM projects WHERE status = 'active'").get()).c,
    completedProjects: (await db.prepare("SELECT COUNT(*) c FROM projects WHERE status = 'completed'").get()).c,
    totalInfluencers: (await db.prepare('SELECT COUNT(*) c FROM influencers').get()).c,
    totalMediaAccounts: (await db.prepare('SELECT COUNT(*) c FROM media_accounts').get()).c,
    totalArtists: (await db.prepare('SELECT COUNT(*) c FROM artists').get()).c,
    totalVideos: (await db.prepare("SELECT COUNT(*) c FROM videos WHERE status = 'active'").get()).c,
    totalViews,
    totalPaid: (await db.prepare("SELECT COALESCE(SUM(amount),0) c FROM payments WHERE status = 'paid'").get()).c,
    estimatedEarnings: earningsFigure
  });
});

router.get('/influencer', authenticate, requireRole('influencer'), async (req, res) => {
  const influencer = await db.prepare('SELECT * FROM influencers WHERE user_id = ?').get(req.user.id);
  if (!influencer) return res.json({ influencer: null, payments: [], totalThisMonth: 0, totalViews: 0, estimatedEarnings: 0, ratePerView: await getViewPaymentRate() });

  const payments = await db
    .prepare("SELECT * FROM payments WHERE influencer_id = ? AND status = 'paid' ORDER BY paid_at DESC")
    .all(influencer.id);

  const totalThisMonth = (await db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) c FROM payments
      WHERE influencer_id = ? AND status = 'paid' AND strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now')`
    )
    .get(influencer.id)).c;

  const totalViews = (await db
    .prepare(
      `SELECT COALESCE(SUM(vm.views), 0) total
       FROM video_metrics vm
       JOIN (SELECT video_id, MAX(scraped_at) AS latest FROM video_metrics GROUP BY video_id) last
         ON last.video_id = vm.video_id AND last.latest = vm.scraped_at
       JOIN videos v ON v.id = vm.video_id
       WHERE v.status = 'active' AND v.owner_user_id = ?`
    )
    .get(req.user.id)).total;

  res.json({ influencer, payments, totalThisMonth, totalViews, estimatedEarnings: await calculateEarning(totalViews), ratePerView: await getViewPaymentRate() });
});

router.get('/rapmedia', authenticate, requireRole('rapmedia'), async (req, res) => {
  const account = await db.prepare('SELECT * FROM media_accounts WHERE user_id = ?').get(req.user.id);
  if (!account) return res.json({ account: null, projects: [], payments: [], totalThisMonth: 0 });

  const projects = await db
    .prepare(
      `SELECT p.* FROM projects p
       JOIN project_media_accounts pma ON pma.project_id = p.id
       WHERE pma.media_account_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(account.id);

  const payments = await db
    .prepare(`SELECT p.*, pr.name AS project_name FROM payments p LEFT JOIN projects pr ON pr.id = p.project_id WHERE p.media_account_id = ? AND p.status = 'paid' ORDER BY p.paid_at DESC`)
    .all(account.id);

  const totalThisMonth = (await db
    .prepare(
      `SELECT COALESCE(SUM(amount),0) c FROM payments
      WHERE media_account_id = ? AND status = 'paid' AND strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now')`
    )
    .get(account.id)).c;

  res.json({ account, projects, payments, totalThisMonth });
});

module.exports = router;
