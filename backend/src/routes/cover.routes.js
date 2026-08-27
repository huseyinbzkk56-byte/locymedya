const express = require('express');
const path = require('path');
const multer = require('multer');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadBuffer, destroyByUrl } = require('../services/storage.service');

const router = express.Router();
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = allowedTypes.has(file.mimetype) && allowedExtensions.has(path.extname(file.originalname).toLowerCase());
    callback(allowed ? null : new Error('Kapak JPG, JPEG, PNG veya WEBP olmalı'), allowed);
  }
});

router.post('/songs/:id/cover', authenticate, requireRole('admin'), upload.single('cover'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kapak görseli zorunlu' });
  const song = await db.prepare('SELECT id, cover_url FROM songs WHERE id = ?').get(req.params.id);
  if (!song) return res.status(404).json({ error: 'Şarkı bulunamadı' });
  const result = await uploadBuffer(req.file.buffer, { folder: 'locymedya/covers', resourceType: 'image' });
  await destroyByUrl(song.cover_url, 'locymedya/covers', 'image');
  const coverUrl = result.secure_url;
  await db.prepare('UPDATE songs SET cover_url = ? WHERE id = ?').run(coverUrl, song.id);
  res.json({ coverUrl });
});

module.exports = router;
