const express = require('express');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const STATUSES = new Set(['paid', 'pending', 'cancelled']);
router.use(authenticate);

function validatePayee(influencerId, mediaAccountId) {
  if (influencerId && mediaAccountId) return 'Aynı ödeme hem influencer hem rap medyasına ait olamaz';
  if (!influencerId && !mediaAccountId) return 'Influencer veya rap medyası seçilmeli';
  return null;
}

router.get('/', requireRole('admin'), (req, res) => {
  const payments = db.prepare(`
    SELECT p.*, i.name AS influencer_name, m.name AS media_account_name, pr.name AS project_name,
      CASE WHEN p.influencer_id IS NOT NULL THEN 'influencer' ELSE 'rapmedia' END AS payee_type,
      COALESCE(i.name, m.name) AS payee_name
    FROM payments p
    LEFT JOIN influencers i ON i.id = p.influencer_id
    LEFT JOIN media_accounts m ON m.id = p.media_account_id
    LEFT JOIN projects pr ON pr.id = p.project_id
    ORDER BY p.paid_at DESC, p.id DESC
  `).all();
  res.json({
    payments,
    influencers: db.prepare('SELECT id, name FROM influencers ORDER BY name').all(),
    mediaAccounts: db.prepare('SELECT id, name FROM media_accounts ORDER BY name').all(),
    projects: db.prepare('SELECT id, name FROM projects ORDER BY created_at DESC').all()
  });
});

router.post('/', requireRole('admin'), (req, res) => {
  const { influencerId, mediaAccountId, projectId, amount, paidAt, note, status = 'paid' } = req.body;
  const payeeError = validatePayee(influencerId, mediaAccountId);
  if (payeeError || !projectId || amount === undefined || Number(amount) < 0 || !STATUSES.has(status)) {
    return res.status(400).json({ error: payeeError || 'Proje, geçerli tutar ve durum zorunlu' });
  }
  const result = db.prepare('INSERT INTO payments (influencer_id, media_account_id, project_id, amount, paid_at, note, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(influencerId || null, mediaAccountId || null, projectId, amount, paidAt || new Date().toISOString(), note || null, status);
  res.status(201).json({ payment: db.prepare('SELECT * FROM payments WHERE id = ?').get(result.lastInsertRowid) });
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const { influencerId, mediaAccountId, projectId, amount, paidAt, note, status = 'paid' } = req.body;
  const payeeError = validatePayee(influencerId, mediaAccountId);
  if (payeeError || !projectId || amount === undefined || Number(amount) < 0 || !STATUSES.has(status)) {
    return res.status(400).json({ error: payeeError || 'Proje, geçerli tutar ve durum zorunlu' });
  }
  const result = db.prepare('UPDATE payments SET influencer_id = ?, media_account_id = ?, project_id = ?, amount = ?, paid_at = ?, note = ?, status = ? WHERE id = ?')
    .run(influencerId || null, mediaAccountId || null, projectId, amount, paidAt, note || null, status, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Ödeme bulunamadı' });
  res.json({ payment: db.prepare('SELECT * FROM payments WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const result = db.prepare('DELETE FROM payments WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Ödeme bulunamadı' });
  res.status(204).end();
});

module.exports = router;
