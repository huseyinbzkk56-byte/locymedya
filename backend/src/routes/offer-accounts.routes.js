const express = require('express');
const db = require('../db/db');
const { authenticate, requireRole, requireFullAdmin } = require('../middleware/auth');

const router = express.Router();
const CATEGORIES = new Set(['influencer', 'rapmedia', 'dizi']);

function validatePlatform(input, label) {
  if (!input || !input.enabled) return null;
  const url = String(input.profileUrl || '').trim();
  const followers = Number(input.followers);
  const normalPrice = Number(input.normalPrice);
  const clientPrice = Number(input.clientPrice);
  if (!url || !/^https?:\/\//i.test(url)) return `${label} profil linki geçerli bir URL olmalı`;
  if (!Number.isFinite(followers) || followers < 0) return `${label} takipçi sayısı geçerli bir değer olmalı`;
  if (!Number.isFinite(normalPrice) || normalPrice < 0) return `${label} normal fiyatı geçerli bir değer olmalı`;
  if (!Number.isFinite(clientPrice) || clientPrice < 0) return `${label} müşteri fiyatı geçerli bir değer olmalı`;
  return null;
}

function validateAccount(body) {
  const name = String(body.name || '').trim();
  const category = String(body.category || '').trim();
  if (!name || name.length > 120) return 'Hesap/sayfa adı zorunlu ve 120 karakterden kısa olmalı';
  if (!CATEGORIES.has(category)) return 'Kategori Influencer, Türkçe Rap Medyası veya Dizi Edit Sayfası olmalı';

  const instagramEnabled = !!body.instagram?.enabled;
  const tiktokEnabled = !!body.tiktok?.enabled;
  if (!instagramEnabled && !tiktokEnabled) return 'En az bir platform (Instagram veya TikTok) seçilmeli';

  return validatePlatform(body.instagram, 'Instagram') || validatePlatform(body.tiktok, 'TikTok');
}

function platformFields(input) {
  if (!input || !input.enabled) return { url: null, followers: null, normalPrice: null, clientPrice: null };
  return {
    url: String(input.profileUrl).trim(),
    followers: Number(input.followers),
    normalPrice: Number(input.normalPrice),
    clientPrice: Number(input.clientPrice)
  };
}

router.use(authenticate, requireRole('admin'), requireFullAdmin);

router.get('/', (req, res) => {
  const { search = '', category = '', platform = '' } = req.query;
  const clauses = [];
  const params = [];

  if (search.trim()) {
    clauses.push('name LIKE ?');
    params.push(`%${search.trim()}%`);
  }
  if (CATEGORIES.has(category)) {
    clauses.push('category = ?');
    params.push(category);
  }
  if (platform === 'instagram') clauses.push('instagram_url IS NOT NULL');
  if (platform === 'tiktok') clauses.push('tiktok_url IS NOT NULL');

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const accounts = db.prepare(`SELECT * FROM offer_accounts ${where} ORDER BY created_at DESC, id DESC`).all(...params);
  res.json({ accounts });
});

router.post('/', (req, res) => {
  const error = validateAccount(req.body);
  if (error) return res.status(400).json({ error });

  const ig = platformFields(req.body.instagram);
  const tt = platformFields(req.body.tiktok);
  const result = db.prepare(`
    INSERT INTO offer_accounts
      (name, category, instagram_url, instagram_followers, instagram_normal_price, instagram_client_price,
       tiktok_url, tiktok_followers, tiktok_normal_price, tiktok_client_price)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    String(req.body.name).trim(), req.body.category,
    ig.url, ig.followers, ig.normalPrice, ig.clientPrice,
    tt.url, tt.followers, tt.normalPrice, tt.clientPrice
  );

  res.status(201).json({ account: db.prepare('SELECT * FROM offer_accounts WHERE id = ?').get(result.lastInsertRowid) });
});

router.put('/:id', (req, res) => {
  const error = validateAccount(req.body);
  if (error) return res.status(400).json({ error });

  const ig = platformFields(req.body.instagram);
  const tt = platformFields(req.body.tiktok);
  const result = db.prepare(`
    UPDATE offer_accounts SET
      name = ?, category = ?,
      instagram_url = ?, instagram_followers = ?, instagram_normal_price = ?, instagram_client_price = ?,
      tiktok_url = ?, tiktok_followers = ?, tiktok_normal_price = ?, tiktok_client_price = ?,
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    String(req.body.name).trim(), req.body.category,
    ig.url, ig.followers, ig.normalPrice, ig.clientPrice,
    tt.url, tt.followers, tt.normalPrice, tt.clientPrice,
    req.params.id
  );

  if (!result.changes) return res.status(404).json({ error: 'Hesap bulunamadı' });
  res.json({ account: db.prepare('SELECT * FROM offer_accounts WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', (req, res) => {
  const usedInOffer = db.prepare('SELECT COUNT(*) AS count FROM offer_list_items WHERE media_account_id = ?').get(req.params.id).count;
  if (usedInOffer) return res.status(400).json({ error: 'Bu hesap bir veya daha fazla teklifte kullanılıyor, önce tekliflerden kaldırın' });

  const result = db.prepare('DELETE FROM offer_accounts WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Hesap bulunamadı' });
  res.status(204).end();
});

module.exports = router;
