const express = require('express');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const STATUSES = new Set(['draft', 'active', 'completed', 'cancelled']);

router.use(authenticate);

function projectWithAssignments(id) {
  const project = db.prepare(`
    SELECT p.*, COALESCE(p.artist_name, a.name) AS artist_name, COALESCE(p.song_name, s.title) AS song_title
    FROM projects p
    LEFT JOIN artists a ON a.id = p.artist_id
    LEFT JOIN songs s ON s.id = p.song_id
    WHERE p.id = ?
  `).get(id);
  if (!project) return null;
  project.influencers = db.prepare(`SELECT i.id, i.name FROM influencers i JOIN project_influencers pi ON pi.influencer_id = i.id WHERE pi.project_id = ? ORDER BY i.name`).all(id);
  project.mediaAccounts = db.prepare(`SELECT m.id, m.name FROM media_accounts m JOIN project_media_accounts pm ON pm.media_account_id = m.id WHERE pm.project_id = ? ORDER BY m.name`).all(id);
  return project;
}

router.get('/options', requireRole('admin'), (req, res) => {
  res.json({
    influencers: db.prepare('SELECT id, name FROM influencers ORDER BY name').all(),
    mediaAccounts: db.prepare('SELECT id, name FROM media_accounts ORDER BY name').all()
  });
});

router.get('/', (req, res) => {
  if (req.user.role === 'admin') return res.json({
    projects: db.prepare(`
      SELECT p.*, COALESCE(p.artist_name, a.name) AS artist_name, COALESCE(p.song_name, s.title) AS song_title,
        (SELECT GROUP_CONCAT(i.name, ', ') FROM influencers i JOIN project_influencers pi ON pi.influencer_id = i.id WHERE pi.project_id = p.id) AS influencer_names,
        (SELECT GROUP_CONCAT(m.name, ', ') FROM media_accounts m JOIN project_media_accounts pm ON pm.media_account_id = m.id WHERE pm.project_id = p.id) AS media_account_names
      FROM projects p
      LEFT JOIN artists a ON a.id = p.artist_id
      LEFT JOIN songs s ON s.id = p.song_id
      ORDER BY p.created_at DESC
    `).all()
  });
  if (req.user.role === 'artist') {
    const artist = db.prepare('SELECT id FROM artists WHERE user_id = ?').get(req.user.id);
    return res.json({ projects: artist ? db.prepare('SELECT p.*, COALESCE(p.artist_name, a.name) AS artist_name, COALESCE(p.song_name, s.title) AS song_title FROM projects p JOIN artists a ON a.id = p.artist_id LEFT JOIN songs s ON s.id = p.song_id WHERE p.artist_id = ? ORDER BY p.created_at DESC').all(artist.id) : [] });
  }
  if (req.user.role === 'influencer') {
    const influencer = db.prepare('SELECT id FROM influencers WHERE user_id = ?').get(req.user.id);
    return res.json({ projects: influencer ? db.prepare('SELECT p.*, COALESCE(p.artist_name, a.name) AS artist_name, COALESCE(p.song_name, s.title) AS song_title FROM projects p JOIN project_influencers pi ON pi.project_id = p.id LEFT JOIN artists a ON a.id = p.artist_id LEFT JOIN songs s ON s.id = p.song_id WHERE pi.influencer_id = ? ORDER BY p.created_at DESC').all(influencer.id) : [] });
  }
  const account = db.prepare('SELECT id FROM media_accounts WHERE user_id = ?').get(req.user.id);
  return res.json({ projects: account ? db.prepare('SELECT p.*, COALESCE(p.artist_name, a.name) AS artist_name, COALESCE(p.song_name, s.title) AS song_title FROM projects p JOIN project_media_accounts pm ON pm.project_id = p.id LEFT JOIN artists a ON a.id = p.artist_id LEFT JOIN songs s ON s.id = p.song_id WHERE pm.media_account_id = ? ORDER BY p.created_at DESC').all(account.id) : [] });
});

router.get('/:id', requireRole('admin'), (req, res) => {
  const project = projectWithAssignments(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı' });
  res.json({ project });
});

router.post('/', requireRole('admin'), (req, res) => {
  const { name, artistName, songName, startDate, endDate, status = 'draft', budget, coverUrl, description, publicUrl, showOnHome, influencerIds = [], mediaAccountIds = [] } = req.body;
  if (!name || !artistName?.trim() || !songName?.trim() || !STATUSES.has(status)) return res.status(400).json({ error: 'Proje adı, sanatçı adı, şarkı adı ve geçerli durum zorunlu' });
  const create = db.transaction(() => {
    const result = db.prepare('INSERT INTO projects (name, artist_name, song_name, start_date, end_date, status, budget, cover_url, description, public_url, show_on_home) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name.trim(), artistName?.trim() || null, songName?.trim() || null, startDate || null, endDate || null, status, budget === '' ? null : budget ?? null, coverUrl || null, description || null, publicUrl || null, showOnHome ? 1 : 0);
    const projectId = result.lastInsertRowid;
    const addInfluencer = db.prepare('INSERT OR IGNORE INTO project_influencers (project_id, influencer_id) VALUES (?, ?)');
    const addMedia = db.prepare('INSERT OR IGNORE INTO project_media_accounts (project_id, media_account_id) VALUES (?, ?)');
    influencerIds.forEach((id) => addInfluencer.run(projectId, id));
    mediaAccountIds.forEach((id) => addMedia.run(projectId, id));
    return projectId;
  });
  res.status(201).json({ project: projectWithAssignments(create()) });
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const { name, artistName, songName, startDate, endDate, status, budget, coverUrl, description, publicUrl, showOnHome, influencerIds = [], mediaAccountIds = [] } = req.body;
  if (!name || !artistName?.trim() || !songName?.trim() || !STATUSES.has(status)) return res.status(400).json({ error: 'Proje adı, sanatçı adı, şarkı adı ve geçerli durum zorunlu' });
  const update = db.transaction(() => {
    const result = db.prepare('UPDATE projects SET name = ?, artist_id = NULL, song_id = NULL, artist_name = ?, song_name = ?, start_date = ?, end_date = ?, status = ?, budget = ?, cover_url = ?, description = ?, public_url = ?, show_on_home = ? WHERE id = ?').run(name.trim(), artistName?.trim() || null, songName?.trim() || null, startDate || null, endDate || null, status, budget === '' ? null : budget ?? null, coverUrl || null, description || null, publicUrl || null, showOnHome ? 1 : 0, req.params.id);
    if (!result.changes) return false;
    db.prepare('DELETE FROM project_influencers WHERE project_id = ?').run(req.params.id);
    db.prepare('DELETE FROM project_media_accounts WHERE project_id = ?').run(req.params.id);
    const addInfluencer = db.prepare('INSERT OR IGNORE INTO project_influencers (project_id, influencer_id) VALUES (?, ?)');
    const addMedia = db.prepare('INSERT OR IGNORE INTO project_media_accounts (project_id, media_account_id) VALUES (?, ?)');
    influencerIds.forEach((id) => addInfluencer.run(req.params.id, id));
    mediaAccountIds.forEach((id) => addMedia.run(req.params.id, id));
    return true;
  })();
  if (!update) return res.status(404).json({ error: 'Proje bulunamadı' });
  res.json({ project: projectWithAssignments(req.params.id) });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const result = db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Proje bulunamadı' });
  res.status(204).end();
});

module.exports = router;
