const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/db');
const { verifyPassword } = require('../utils/password');
const { hashPassword } = require('../utils/password');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Kullanıcı adı ve şifre zorunlu' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
  }

  if (!user.active || user.role === 'artist') return res.status(403).json({ error: 'Bu hesap aktif değil' });

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      displayName: user.display_name
    }
  });
});

router.post('/register', async (req, res) => {
  const { type, name, username, password, phone, instagramUrl, tiktokUrl, xUrl, desiredFee } = req.body;
  if (!['influencer', 'rapmedia'].includes(type)) return res.status(400).json({ error: 'Geçerli kullanıcı türü seçin' });
  if (!name?.trim() || !username?.trim() || !password) return res.status(400).json({ error: 'Ad, kullanıcı adı ve şifre zorunlu' });
  if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter olmalı' });
  try {
    const passwordHash = await hashPassword(password);
    const create = db.transaction(() => {
      const user = db.prepare('INSERT INTO users (username, password_hash, role, display_name, phone) VALUES (?, ?, ?, ?, ?)').run(username.trim(), passwordHash, type, name.trim(), phone?.trim() || null);
      if (type === 'influencer') db.prepare('INSERT INTO influencers (user_id, name, tiktok_url, phone, desired_fee) VALUES (?, ?, ?, ?, ?)').run(user.lastInsertRowid, name.trim(), tiktokUrl?.trim() || null, phone?.trim() || null, desiredFee === '' ? null : desiredFee ?? null);
      else db.prepare('INSERT INTO media_accounts (user_id, name, phone, instagram_url, tiktok_url, x_url) VALUES (?, ?, ?, ?, ?, ?)').run(user.lastInsertRowid, name.trim(), phone?.trim() || null, instagramUrl?.trim() || null, tiktokUrl?.trim() || null, xUrl?.trim() || null);
      return user.lastInsertRowid;
    });
    res.status(201).json({ id: create() });
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' });
    throw err;
  }
});

// Giriş yapmış kullanıcının kendi bilgisi (sayfa yenilendiğinde oturumu doğrulamak için)
router.get('/me', require('../middleware/auth').authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
