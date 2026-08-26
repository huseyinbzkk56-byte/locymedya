const express = require('express');
const db = require('../db/db');
const fs = require('fs');
const path = require('path');
const { authenticate, requireRole, requireFullAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

router.get('/', (req, res) => {
  if (req.user.role === 'admin' && req.user.adminScope !== 'company') return res.json({ songs: db.prepare('SELECT s.*, COALESCE(s.artist_name, a.name) artist_name FROM songs s LEFT JOIN artists a ON a.id = s.artist_id ORDER BY s.created_at DESC').all() });
  if (req.user.role !== 'artist') return res.json({ songs: [] });
  const artist = db.prepare('SELECT id FROM artists WHERE user_id = ?').get(req.user.id);
  res.json({ songs: artist ? db.prepare('SELECT * FROM songs WHERE artist_id = ? ORDER BY created_at DESC').all(artist.id) : [] });
});

router.post('/', requireRole('admin'), requireFullAdmin, (req, res) => {
  const { artistName, title, description, spotifyUrl, youtubeUrl, otherUrl, showOnHome } = req.body;
  if (!artistName?.trim() || !title) return res.status(400).json({ error: 'Sanatçı adı ve şarkı adı zorunlu' });
  const result = db.prepare('INSERT INTO songs (artist_id, artist_name, title, description, spotify_url, youtube_url, other_url, show_on_home) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?)').run(artistName.trim(), title.trim(), description || null, spotifyUrl || null, youtubeUrl || null, otherUrl || null, showOnHome ? 1 : 0);
  res.status(201).json({ song: db.prepare('SELECT * FROM songs WHERE id = ?').get(result.lastInsertRowid) });
});

router.put('/:id', requireRole('admin'), requireFullAdmin, (req, res) => {
  const { artistName, title, description, spotifyUrl, youtubeUrl, otherUrl, showOnHome } = req.body;
  if (!artistName?.trim() || !title) return res.status(400).json({ error: 'Sanatçı adı ve şarkı adı zorunlu' });
  const result = db.prepare('UPDATE songs SET artist_id = NULL, artist_name = ?, title = ?, description = ?, spotify_url = ?, youtube_url = ?, other_url = ?, show_on_home = ? WHERE id = ?').run(artistName.trim(), title.trim(), description || null, spotifyUrl || null, youtubeUrl || null, otherUrl || null, showOnHome ? 1 : 0, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Şarkı bulunamadı' });
  res.json({ song: db.prepare('SELECT * FROM songs WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', requireRole('admin'), requireFullAdmin, (req, res) => {
  const song = db.prepare('SELECT cover_url, audio_url FROM songs WHERE id = ?').get(req.params.id);
  const result = db.prepare('DELETE FROM songs WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Şarkı bulunamadı' });
  for (const storedUrl of [song.cover_url, song.audio_url]) {
    if (storedUrl?.startsWith('/uploads/')) fs.rmSync(path.join(__dirname, '../../data', storedUrl.replace('/uploads/', '')), { force: true });
  }
  res.status(204).end();
});

module.exports = router;
