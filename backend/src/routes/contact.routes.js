const express = require('express');
const db = require('../db/db');
const { authenticate, requireRole, requireFullAdmin } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rate-limit');

const router = express.Router();
const STATUSES = new Set(['unread', 'read', 'archived']);

function validateMessage(body) {
  const firstName = String(body.firstName || '').trim();
  const lastName = String(body.lastName || '').trim();
  const phone = String(body.phone || '').trim();
  const subject = String(body.subject || '').trim();
  const message = String(body.message || '').trim();

  if (!firstName || firstName.length > 60) return 'İsim zorunlu ve 60 karakterden kısa olmalı';
  if (!lastName || lastName.length > 60) return 'Soyisim zorunlu ve 60 karakterden kısa olmalı';
  if (!phone || phone.length > 30 || !/^[0-9+\s()-]{6,30}$/.test(phone)) return 'Geçerli bir iletişim numarası girin';
  if (!subject || subject.length > 150) return 'Konu zorunlu ve 150 karakterden kısa olmalı';
  if (!message || message.length < 10 || message.length > 2000) return 'Mesaj 10-2000 karakter arasında olmalı';
  return null;
}

// Public: mesaj gönderme (kimlik doğrulama gerektirmez, rate-limit'li)
router.post('/', rateLimit({ windowMs: 10 * 60 * 1000, max: 5 }), (req, res) => {
  const error = validateMessage(req.body);
  if (error) return res.status(400).json({ error });

  const firstName = String(req.body.firstName).trim();
  const lastName = String(req.body.lastName).trim();
  const phone = String(req.body.phone).trim();
  const subject = String(req.body.subject).trim();
  const message = String(req.body.message).trim();

  const result = db.prepare(
    'INSERT INTO contact_messages (first_name, last_name, phone, subject, message) VALUES (?, ?, ?, ?, ?)'
  ).run(firstName, lastName, phone, subject, message);

  res.status(201).json({ id: result.lastInsertRowid });
});

// Bundan sonrası sadece tam yetkili admin
router.use(authenticate, requireRole('admin'), requireFullAdmin);

router.get('/', (req, res) => {
  const messages = db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC, id DESC').all();
  const unreadCount = db.prepare("SELECT COUNT(*) AS count FROM contact_messages WHERE status = 'unread'").get().count;
  res.json({ messages, unreadCount });
});

router.get('/unread-count', (req, res) => {
  const unreadCount = db.prepare("SELECT COUNT(*) AS count FROM contact_messages WHERE status = 'unread'").get().count;
  res.json({ unreadCount });
});

router.get('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Mesaj bulunamadı' });
  if (item.status === 'unread') {
    db.prepare("UPDATE contact_messages SET status = 'read' WHERE id = ?").run(req.params.id);
    item.status = 'read';
  }
  res.json({ message: item });
});

router.patch('/:id/status', (req, res) => {
  const status = String(req.body.status || '');
  if (!STATUSES.has(status)) return res.status(400).json({ error: 'Geçersiz durum' });
  const result = db.prepare('UPDATE contact_messages SET status = ? WHERE id = ?').run(status, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Mesaj bulunamadı' });
  res.json({ message: db.prepare('SELECT * FROM contact_messages WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM contact_messages WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Mesaj bulunamadı' });
  res.status(204).end();
});

module.exports = router;
