const express = require('express');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { hashPassword } = require('../utils/password');

const router = express.Router();
const VALID_ROLES = ['admin', 'influencer', 'rapmedia'];

router.use(authenticate, requireRole('admin'));

// Kullanıcı listesi (şifre hash'i asla dönmez)
router.get('/', (req, res) => {
  const users = db
    .prepare("SELECT id, username, role, display_name, phone, active, created_at FROM users WHERE role IN ('admin','influencer','rapmedia') ORDER BY created_at DESC")
    .all();
  res.json(users);
});

// Yeni kullanıcı oluştur (influencer / sanatçı / rap medya / admin)
router.post('/', async (req, res) => {
  const { username, password, role, displayName, phone, active = 1, tiktokUrl, instagramUrl, xUrl, desiredFee } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password ve role zorunlu' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Geçersiz rol' });
  }

  const passwordHash = await hashPassword(password);
  try {
    const result = db
      .prepare('INSERT INTO users (username, password_hash, role, display_name, phone, active) VALUES (?, ?, ?, ?, ?, ?)')
      .run(username, passwordHash, role, displayName || username, phone || null, active ? 1 : 0);

    // Role'e göre ilişkili kayıt oluştur (influencer/artist/rapmedia panelinin veriyi bulabilmesi için)
    if (role === 'influencer') {
      db.prepare('INSERT INTO influencers (user_id, name, tiktok_url, phone, desired_fee, active) VALUES (?, ?, ?, ?, ?, ?)').run(result.lastInsertRowid, displayName || username, tiktokUrl || null, phone || null, desiredFee === '' ? null : desiredFee ?? null, active ? 1 : 0);
    } else if (role === 'rapmedia') {
      db.prepare('INSERT INTO media_accounts (user_id, name, phone, instagram_url, tiktok_url, x_url, active) VALUES (?, ?, ?, ?, ?, ?, ?)').run(result.lastInsertRowid, displayName || username, phone || null, instagramUrl || null, tiktokUrl || null, xUrl || null, active ? 1 : 0);
    }

    res.status(201).json({ id: result.lastInsertRowid });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
    }
    throw err;
  }
});

// Admin şifre sıfırlama (kullanıcı şifresini unutursa)
router.put('/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Yeni şifre zorunlu' });
  const passwordHash = await hashPassword(password);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, req.params.id);
  res.json({ ok: true });
});

router.put('/:id', (req, res) => {
  const { displayName, phone, active } = req.body;
  db.prepare('UPDATE users SET display_name = ?, phone = ?, active = ? WHERE id = ?').run(displayName || null, phone || null, active ? 1 : 0, req.params.id);
  const user = db.prepare('SELECT role FROM users WHERE id = ?').get(req.params.id);
  if (user?.role === 'influencer') db.prepare('UPDATE influencers SET name = ?, phone = ?, active = ? WHERE user_id = ?').run(displayName || null, phone || null, active ? 1 : 0, req.params.id);
  if (user?.role === 'rapmedia') db.prepare('UPDATE media_accounts SET name = ?, phone = ?, active = ? WHERE user_id = ?').run(displayName || null, phone || null, active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const removeUser = db.transaction(() => {
    const influencer = db.prepare('SELECT id FROM influencers WHERE user_id = ?').get(req.params.id);
    const artist = db.prepare('SELECT id FROM artists WHERE user_id = ?').get(req.params.id);
    const mediaAccount = db.prepare('SELECT id FROM media_accounts WHERE user_id = ?').get(req.params.id);
    if (influencer) {
      db.prepare('DELETE FROM payments WHERE influencer_id = ?').run(influencer.id);
      db.prepare('DELETE FROM project_influencers WHERE influencer_id = ?').run(influencer.id);
      db.prepare('DELETE FROM influencers WHERE id = ?').run(influencer.id);
    }
    if (artist) db.prepare('DELETE FROM artists WHERE id = ?').run(artist.id);
    if (mediaAccount) {
      db.prepare('DELETE FROM project_media_accounts WHERE media_account_id = ?').run(mediaAccount.id);
      db.prepare('DELETE FROM media_accounts WHERE id = ?').run(mediaAccount.id);
    }
    db.prepare('UPDATE videos SET owner_user_id = NULL WHERE owner_user_id = ?').run(req.params.id);
    return db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  });
  const result = removeUser();
  if (!result.changes) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  res.json({ ok: true });
});

module.exports = router;
