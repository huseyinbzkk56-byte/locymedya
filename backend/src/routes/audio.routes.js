const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../data/audio');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.mp3`)
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = file.mimetype === 'audio/mpeg' || path.extname(file.originalname).toLowerCase() === '.mp3';
    callback(allowed ? null : new Error('Sadece MP3 dosyası yüklenebilir'), allowed);
  }
});

function removeStoredAudio(audioUrl) {
  if (audioUrl?.startsWith('/uploads/audio/')) fs.rmSync(path.join(uploadDir, path.basename(audioUrl)), { force: true });
}

router.post('/songs/:id/audio', authenticate, requireRole('admin'), upload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'MP3 dosyası zorunlu' });
  const song = db.prepare('SELECT id, audio_url FROM songs WHERE id = ?').get(req.params.id);
  if (!song) return res.status(404).json({ error: 'Şarkı bulunamadı' });
  removeStoredAudio(song.audio_url);
  const audioUrl = `/uploads/audio/${req.file.filename}`;
  db.prepare('UPDATE songs SET audio_url = ? WHERE id = ?').run(audioUrl, song.id);
  res.json({ audioUrl });
});

module.exports = router;
