const express = require('express');
const db = require('../db/db');
const { authenticate, requireRole, requireFullAdmin } = require('../middleware/auth');
const { hashPassword } = require('../utils/password');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const config = {
  influencers: { role: 'influencer', table: 'influencers', joinTable: 'project_influencers', joinColumn: 'influencer_id' },
  'rap-media': { role: 'rapmedia', table: 'media_accounts', joinTable: 'project_media_accounts', joinColumn: 'media_account_id' }
};
function getConfig(kind, res) { const value = config[kind]; if (!value) res.status(404).json({ error: 'Geçersiz kullanıcı türü' }); return value; }

async function projectsFor(value, profileId) {
  return db.prepare(`SELECT p.id, p.name FROM projects p JOIN ${value.joinTable} j ON j.project_id = p.id WHERE j.${value.joinColumn} = ? ORDER BY p.name`).all(profileId);
}

async function setProjects(dbLike, value, profileId, projectIds) {
  await dbLike.prepare(`DELETE FROM ${value.joinTable} WHERE ${value.joinColumn} = ?`).run(profileId);
  const insert = dbLike.prepare(`INSERT OR IGNORE INTO ${value.joinTable} (project_id, ${value.joinColumn}) VALUES (?, ?)`);
  for (const projectId of (projectIds || [])) await insert.run(projectId, profileId);
}

router.get('/:kind', async (req, res) => {
  const value = getConfig(req.params.kind, res); if (!value) return;
  const rows = value.role === 'influencer'
    ? await db.prepare(`SELECT u.id AS user_id, i.id AS profile_id, u.username, u.display_name, u.phone AS user_phone, u.active AS user_active, u.created_at, i.name, i.phone, i.tiktok_url, i.desired_fee, i.active FROM users u JOIN influencers i ON i.user_id = u.id WHERE u.role = ? ORDER BY u.created_at DESC`).all(value.role)
    : await db.prepare(`SELECT u.id AS user_id, m.id AS profile_id, u.username, u.display_name, u.phone AS user_phone, u.active AS user_active, u.created_at, m.name, m.phone, m.instagram_url, m.tiktok_url, m.x_url, m.active FROM users u JOIN media_accounts m ON m.user_id = u.id WHERE u.role = ? ORDER BY u.created_at DESC`).all(value.role);
  for (const row of rows) row.projects = await projectsFor(value, row.profile_id);
  res.json({ users: rows });
});

router.post('/:kind', requireFullAdmin, async (req, res) => {
  const value = getConfig(req.params.kind, res); if (!value) return;
  const { username, password, name, phone, active = 1, tiktokUrl, instagramUrl, xUrl, desiredFee, projectIds } = req.body;
  if (!username?.trim() || !password || !name?.trim()) return res.status(400).json({ error: 'Ad, kullanıcı adı ve şifre zorunlu' });
  try {
    const passwordHash = await hashPassword(password);
    const id = await db.transaction(async (tx) => {
      const user = await tx.prepare('INSERT INTO users (username, password_hash, role, display_name, phone, active) VALUES (?, ?, ?, ?, ?, ?)').run(username.trim(), passwordHash, value.role, name.trim(), phone || null, active ? 1 : 0);
      let profileId;
      if (value.role === 'influencer') {
        profileId = (await tx.prepare('INSERT INTO influencers (user_id, name, phone, tiktok_url, desired_fee, active) VALUES (?, ?, ?, ?, ?, ?)').run(user.lastInsertRowid, name.trim(), phone || null, tiktokUrl || null, desiredFee === '' ? null : desiredFee ?? null, active ? 1 : 0)).lastInsertRowid;
      } else {
        profileId = (await tx.prepare('INSERT INTO media_accounts (user_id, name, phone, instagram_url, tiktok_url, x_url, active) VALUES (?, ?, ?, ?, ?, ?, ?)').run(user.lastInsertRowid, name.trim(), phone || null, instagramUrl || null, tiktokUrl || null, xUrl || null, active ? 1 : 0)).lastInsertRowid;
      }
      await setProjects(tx, value, profileId, projectIds);
      return user.lastInsertRowid;
    });
    res.status(201).json({ id });
  } catch (err) { if (String(err.message).includes('UNIQUE')) return res.status(409).json({ error: 'Bu kullanıcı adı zaten kullanılıyor' }); throw err; }
});

router.put('/:kind/:id', requireFullAdmin, async (req, res) => {
  const value = getConfig(req.params.kind, res); if (!value) return;
  const { name, phone, active = 1, tiktokUrl, instagramUrl, xUrl, desiredFee, projectIds } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Ad zorunlu' });
  const user = await db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(req.params.id, value.role);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  await db.transaction(async (tx) => {
    await tx.prepare('UPDATE users SET display_name = ?, phone = ?, active = ? WHERE id = ?').run(name.trim(), phone || null, active ? 1 : 0, req.params.id);
    let profileId;
    if (value.role === 'influencer') {
      await tx.prepare('UPDATE influencers SET name = ?, phone = ?, tiktok_url = ?, desired_fee = ?, active = ? WHERE user_id = ?').run(name.trim(), phone || null, tiktokUrl || null, desiredFee === '' ? null : desiredFee ?? null, active ? 1 : 0, req.params.id);
      profileId = (await tx.prepare('SELECT id FROM influencers WHERE user_id = ?').get(req.params.id)).id;
    } else {
      await tx.prepare('UPDATE media_accounts SET name = ?, phone = ?, instagram_url = ?, tiktok_url = ?, x_url = ?, active = ? WHERE user_id = ?').run(name.trim(), phone || null, instagramUrl || null, tiktokUrl || null, xUrl || null, active ? 1 : 0, req.params.id);
      profileId = (await tx.prepare('SELECT id FROM media_accounts WHERE user_id = ?').get(req.params.id)).id;
    }
    await setProjects(tx, value, profileId, projectIds);
  });
  res.json({ ok: true });
});

router.delete('/:kind/:id', requireFullAdmin, async (req, res) => {
  const value = getConfig(req.params.kind, res); if (!value) return;
  const user = await db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(req.params.id, value.role);
  if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
  await db.transaction(async (tx) => {
    if (value.role === 'influencer') { const profile = await tx.prepare('SELECT id FROM influencers WHERE user_id = ?').get(req.params.id); if (profile) { await tx.prepare('DELETE FROM payments WHERE influencer_id = ?').run(profile.id); await tx.prepare('DELETE FROM project_influencers WHERE influencer_id = ?').run(profile.id); await tx.prepare('DELETE FROM influencers WHERE id = ?').run(profile.id); } }
    else { const profile = await tx.prepare('SELECT id FROM media_accounts WHERE user_id = ?').get(req.params.id); if (profile) { await tx.prepare('DELETE FROM project_media_accounts WHERE media_account_id = ?').run(profile.id); await tx.prepare('DELETE FROM media_accounts WHERE id = ?').run(profile.id); } }
    await tx.prepare('UPDATE videos SET owner_user_id = NULL WHERE owner_user_id = ?').run(req.params.id);
    await tx.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  });
  res.status(204).end();
});

module.exports = router;
