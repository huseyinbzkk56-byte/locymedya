const express = require('express');
const path = require('path');
const multer = require('multer');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadBuffer, destroyByUrl } = require('../services/storage.service');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = file.mimetype === 'audio/mpeg' || path.extname(file.originalname).toLowerCase() === '.mp3';
    callback(allowed ? null : new Error('Sadece MP3 dosyası yüklenebilir'), allowed);
  }
});

router.post('/songs/:id/audio', authenticate, requireRole('admin'), upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'MP3 dosyası zorunlu' });
  const song = await db.prepare('SELECT id, audio_url FROM songs WHERE id = ?').get(req.params.id);
  if (!song) return res.status(404).json({ error: 'Şarkı bulunamadı' });
  const result = await uploadBuffer(req.file.buffer, { folder: 'locymedya/audio', resourceType: 'video' });
  await destroyByUrl(song.audio_url, 'locymedya/audio', 'video');
  const audioUrl = result.secure_url;
  await db.prepare('UPDATE songs SET audio_url = ? WHERE id = ?').run(audioUrl, song.id);
  res.json({ audioUrl });
});

module.exports = router;
