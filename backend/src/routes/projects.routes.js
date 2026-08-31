const express = require('express');
const db = require('../db/db');
const { authenticate, requireRole, requireFullAdmin } = require('../middleware/auth');

const router = express.Router();
const STATUSES = new Set(['draft', 'active', 'completed', 'cancelled']);

router.use(authenticate);

async function projectWithAssignments(id) {
  const project = await db.prepare(`
    SELECT p.*, COALESCE(p.artist_name, a.name) AS artist_name, COALESCE(p.song_name, s.title) AS song_title
    FROM projects p
    LEFT JOIN artists a ON a.id = p.artist_id
    LEFT JOIN songs s ON s.id = p.song_id
    WHERE p.id = ?
  `).get(id);
  if (!project) return null;
  project.influencers = await db.prepare(`SELECT i.id, i.name FROM influencers i JOIN project_influencers pi ON pi.influencer_id = i.id WHERE pi.project_id = ? ORDER BY i.name`).all(id);
  project.mediaAccounts = await db.prepare(`SELECT m.id, m.name FROM media_accounts m JOIN project_media_accounts pm ON pm.media_account_id = m.id WHERE pm.project_id = ? ORDER BY m.name`).all(id);
  return project;
}

router.get('/options', requireRole('admin'), async (req, res) => {
  res.json({
    influencers: await db.prepare('SELECT id, name FROM influencers ORDER BY name').all(),
    mediaAccounts: await db.prepare('SELECT id, name FROM media_accounts ORDER BY name').all()
  });
});

router.get('/', async (req, res) => {
  if (req.user.role === 'admin') return res.json({
    projects: await db.prepare(`
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
    const artist = await db.prepare('SELECT id FROM artists WHERE user_id = ?').get(req.user.id);
    return res.json({ projects: artist ? await db.prepare('SELECT p.*, COALESCE(p.artist_name, a.name) AS artist_name, COALESCE(p.song_name, s.title) AS song_title FROM projects p JOIN artists a ON a.id = p.artist_id LEFT JOIN songs s ON s.id = p.song_id WHERE p.artist_id = ? ORDER BY p.created_at DESC').all(artist.id) : [] });
  }
  if (req.user.role === 'influencer') {
    const influencer = await db.prepare('SELECT id FROM influencers WHERE user_id = ?').get(req.user.id);
    return res.json({ projects: influencer ? await db.prepare('SELECT p.*, COALESCE(p.artist_name, a.name) AS artist_name, COALESCE(p.song_name, s.title) AS song_title FROM projects p JOIN project_influencers pi ON pi.project_id = p.id LEFT JOIN artists a ON a.id = p.artist_id LEFT JOIN songs s ON s.id = p.song_id WHERE pi.influencer_id = ? ORDER BY p.created_at DESC').all(influencer.id) : [] });
  }
  const account = await db.prepare('SELECT id FROM media_accounts WHERE user_id = ?').get(req.user.id);
  return res.json({ projects: account ? await db.prepare('SELECT p.*, COALESCE(p.artist_name, a.name) AS artist_name, COALESCE(p.song_name, s.title) AS song_title FROM projects p JOIN project_media_accounts pm ON pm.project_id = p.id LEFT JOIN artists a ON a.id = p.artist_id LEFT JOIN songs s ON s.id = p.song_id WHERE pm.media_account_id = ? ORDER BY p.created_at DESC').all(account.id) : [] });
});

router.get('/:id', requireRole('admin'), async (req, res) => {
  const project = await projectWithAssignments(req.params.id);
  if (!project) return res.status(404).json({ error: 'Proje bulunamadı' });
  res.json({ project });
});

router.post('/', requireRole('admin'), requireFullAdmin, async (req, res) => {
  const { name, artistName, songName, startDate, endDate, status = 'draft', budget, coverUrl, description, publicUrl, showOnHome, influencerIds = [], mediaAccountIds = [] } = req.body;
  if (!name || !artistName?.trim() || !songName?.trim() || !STATUSES.has(status)) return res.status(400).json({ error: 'Proje adı, sanatçı adı, şarkı adı ve geçerli durum zorunlu' });
  const projectId = await db.transaction(async (tx) => {
    const result = await tx.prepare('INSERT INTO projects (name, artist_name, song_name, start_date, end_date, status, budget, cover_url, description, public_url, show_on_home) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(name.trim(), artistName?.trim() || null, songName?.trim() || null, startDate || null, endDate || null, status, budget === '' ? null : budget ?? null, coverUrl || null, description || null, publicUrl || null, showOnHome ? 1 : 0);
    const id = result.lastInsertRowid;
    const addInfluencer = tx.prepare('INSERT OR IGNORE INTO project_influencers (project_id, influencer_id) VALUES (?, ?)');
    const addMedia = tx.prepare('INSERT OR IGNORE INTO project_media_accounts (project_id, media_account_id) VALUES (?, ?)');
    for (const influencerId of influencerIds) await addInfluencer.run(id, influencerId);
    for (const mediaAccountId of mediaAccountIds) await addMedia.run(id, mediaAccountId);
    return id;
  });
  res.status(201).json({ project: await projectWithAssignments(projectId) });
});

router.put('/:id', requireRole('admin'), requireFullAdmin, async (req, res) => {
  const { name, artistName, songName, startDate, endDate, status, budget, coverUrl, description, publicUrl, showOnHome, influencerIds = [], mediaAccountIds = [] } = req.body;
  if (!name || !artistName?.trim() || !songName?.trim() || !STATUSES.has(status)) return res.status(400).json({ error: 'Proje adı, sanatçı adı, şarkı adı ve geçerli durum zorunlu' });
  const update = await db.transaction(async (tx) => {
    const result = await tx.prepare('UPDATE projects SET name = ?, artist_id = NULL, song_id = NULL, artist_name = ?, song_name = ?, start_date = ?, end_date = ?, status = ?, budget = ?, cover_url = ?, description = ?, public_url = ?, show_on_home = ? WHERE id = ?').run(name.trim(), artistName?.trim() || null, songName?.trim() || null, startDate || null, endDate || null, status, budget === '' ? null : budget ?? null, coverUrl || null, description || null, publicUrl || null, showOnHome ? 1 : 0, req.params.id);
    if (!result.changes) return false;
    await tx.prepare('DELETE FROM project_influencers WHERE project_id = ?').run(req.params.id);
    await tx.prepare('DELETE FROM project_media_accounts WHERE project_id = ?').run(req.params.id);
    const addInfluencer = tx.prepare('INSERT OR IGNORE INTO project_influencers (project_id, influencer_id) VALUES (?, ?)');
    const addMedia = tx.prepare('INSERT OR IGNORE INTO project_media_accounts (project_id, media_account_id) VALUES (?, ?)');
    for (const influencerId of influencerIds) await addInfluencer.run(req.params.id, influencerId);
    for (const mediaAccountId of mediaAccountIds) await addMedia.run(req.params.id, mediaAccountId);
    return true;
  });
  if (!update) return res.status(404).json({ error: 'Proje bulunamadı' });
  res.json({ project: await projectWithAssignments(req.params.id) });
});

router.delete('/:id', requireRole('admin'), requireFullAdmin, async (req, res) => {
  // Videolar silinmez, projeden ayrılır (izlenme geçmişi kaybolmasın) — ödemeler projeyle birlikte silinir
  const result = await db.transaction(async (tx) => {
    await tx.prepare('UPDATE videos SET project_id = NULL WHERE project_id = ?').run(req.params.id);
    await tx.prepare('DELETE FROM payments WHERE project_id = ?').run(req.params.id);
    await tx.prepare('DELETE FROM project_influencers WHERE project_id = ?').run(req.params.id);
    await tx.prepare('DELETE FROM project_media_accounts WHERE project_id = ?').run(req.params.id);
    return tx.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  });
  if (!result.changes) return res.status(404).json({ error: 'Proje bulunamadı' });
  res.status(204).end();
});

module.exports = router;
