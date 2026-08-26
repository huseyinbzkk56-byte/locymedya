const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../data/covers');
fs.mkdirSync(uploadDir, { recursive: true });
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = allowedTypes.has(file.mimetype) && allowedExtensions.has(path.extname(file.originalname).toLowerCase());
    callback(allowed ? null : new Error('Kapak JPG, JPEG, PNG veya WEBP olmalı'), allowed);
  }
});

router.post('/songs/:id/cover', authenticate, requireRole('admin'), upload.single('cover'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kapak görseli zorunlu' });
  const song = await db.prepare('SELECT id, cover_url FROM songs WHERE id = ?').get(req.params.id);
  if (!song) {
    fs.rmSync(req.file.path, { force: true });
    return res.status(404).json({ error: 'Şarkı bulunamadı' });
  }
  if (song.cover_url?.startsWith('/uploads/covers/')) fs.rmSync(path.join(uploadDir, path.basename(song.cover_url)), { force: true });
  const coverUrl = `/uploads/covers/${req.file.filename}`;
  await db.prepare('UPDATE songs SET cover_url = ? WHERE id = ?').run(coverUrl, song.id);
  res.json({ coverUrl });
});

module.exports = router;
