const express = require('express');
const db = require('../db/db');

const router = express.Router();

router.get('/content', async (req, res) => {
  const projects = await db.prepare(`
    SELECT p.id, p.name, p.cover_url, p.description, p.public_url, p.start_date,
           COALESCE(p.artist_name, a.name) AS artist_name, COALESCE(p.song_name, s.title) AS song_title
    FROM projects p
    LEFT JOIN artists a ON a.id = p.artist_id
    LEFT JOIN songs s ON s.id = p.song_id
    WHERE p.show_on_home = 1
    ORDER BY p.start_date DESC, p.created_at DESC
  `).all();
  const songs = await db.prepare(`
    SELECT s.id, s.title, s.cover_url, s.audio_url, s.description, s.spotify_url,
           s.youtube_url, s.other_url, COALESCE(s.artist_name, a.name) AS artist_name
    FROM songs s
    LEFT JOIN artists a ON a.id = s.artist_id
    WHERE s.show_on_home = 1
    ORDER BY s.created_at DESC
  `).all();
  res.json({ projects, songs });
});

module.exports = router;
