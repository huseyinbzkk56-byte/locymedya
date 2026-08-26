import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiFetch, getCurrentUser } from '../api/client';

const EMPTY = { name: '', username: '', password: '', phone: '', instagramUrl: '', tiktokUrl: '', xUrl: '', desiredFee: '', active: true, projectIds: [] };

export default function AdminMembers({ kind, title }) {
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const isInfluencer = kind === 'influencers';
  const isCompanyAdmin = getCurrentUser()?.adminScope === 'company';

  async function load() { setUsers((await apiFetch(`/admin-members/${kind}`)).users); }
  useEffect(() => {
    load().catch((err) => setError(err.message));
    apiFetch('/projects').then((data) => setProjects(data.projects)).catch(() => {});
  }, [kind]);

  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }
  function toggleProject(id) {
    setForm((current) => ({
      ...current,
      projectIds: current.projectIds.includes(id) ? current.projectIds.filter((x) => x !== id) : [...current.projectIds, id]
    }));
  }
  function resetForm() { setForm(EMPTY); setEditing(null); setProjectSearch(''); }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const path = editing ? `/admin-members/${kind}/${editing}` : `/admin-members/${kind}`;
      await apiFetch(path, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) });
      resetForm();
      await load();
    } catch (err) { setError(err.message); }
  }

  function edit(user) {
    setEditing(user.user_id);
    setForm({
      ...EMPTY,
      name: user.name || user.display_name,
      username: user.username,
      phone: user.phone || user.user_phone || '',
      instagramUrl: user.instagram_url || '',
      tiktokUrl: user.tiktok_url || '',
      xUrl: user.x_url || '',
      desiredFee: user.desired_fee ?? '',
      active: Boolean(user.active && user.user_active),
      password: '',
      projectIds: (user.projects || []).map((p) => p.id)
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function remove(user) {
    if (!window.confirm(`${user.name || user.username} silinsin mi?`)) return;
    try { await apiFetch(`/admin-members/${kind}/${user.user_id}`, { method: 'DELETE' }); setUsers((current) => current.filter((item) => item.user_id !== user.user_id)); } catch (err) { setError(err.message); }
  }

  async function resetPassword(user) {
    const password = window.prompt(`${user.username} için yeni şifre:`);
    if (!password) return;
    try { await apiFetch(`/users/${user.user_id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }); } catch (err) { setError(err.message); }
  }

  const filteredProjects = projects.filter((p) => p.name.toLowerCase().includes(projectSearch.trim().toLowerCase()));

  return (
    <Layout title={title}>
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-gray-500">Bu panel yalnızca {isInfluencer ? 'influencer' : 'rap medya'} kullanıcılarını yönetir.</p>

        {!isCompanyAdmin && <form onSubmit={submit} className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <input required name="name" value={form.name} onChange={update} placeholder={isInfluencer ? 'Influencer hesap adı' : 'Rap medya adı'} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            <input required disabled={Boolean(editing)} name="username" value={form.username} onChange={update} placeholder="Kullanıcı adı" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm disabled:bg-gray-100" />
            {!editing && <input required minLength="6" type="password" name="password" value={form.password} onChange={update} placeholder="Şifre" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />}
            <input name="phone" value={form.phone} onChange={update} placeholder="Telefon" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            {isInfluencer ? (
              <>
                <input type="url" name="tiktokUrl" value={form.tiktokUrl} onChange={update} placeholder="TikTok linki" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
                <input type="number" min="0" step="0.01" name="desiredFee" value={form.desiredFee} onChange={update} placeholder="Video başına istediği ücret" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
              </>
            ) : (
              <>
                <input type="url" name="instagramUrl" value={form.instagramUrl} onChange={update} placeholder="Instagram linki" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
                <input type="url" name="tiktokUrl" value={form.tiktokUrl} onChange={update} placeholder="TikTok linki" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
                <input type="url" name="xUrl" value={form.xUrl} onChange={update} placeholder="X linki" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
              </>
            )}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="active" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} /> Aktif</label>
          </div>

          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">Projeler</p>
              {form.projectIds.length > 0 && <span className="text-xs text-gray-400">{form.projectIds.length} seçili</span>}
            </div>
            <input value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} type="text" placeholder="Proje ara..." className="mb-2 w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm" />
            <div className="grid max-h-40 gap-1.5 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => (
                <label key={project.id} className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={form.projectIds.includes(project.id)} onChange={() => toggleProject(project.id)} />
                  {project.name}
                </label>
              ))}
            </div>
            {!projects.length && <p className="text-xs text-gray-400">Henüz proje oluşturulmadı.</p>}
            {projects.length > 0 && !filteredProjects.length && <p className="text-xs text-gray-400">Sonuç bulunamadı.</p>}
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white">{editing ? 'Güncelle' : 'Ekle'}</button>
            {editing && <button type="button" onClick={resetForm} className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm">Vazgeç</button>}
          </div>
        </form>}

        <div className="mt-6 space-y-2">
          {users.map((user) => (
            <article key={user.user_id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-medium">{user.name || user.display_name}</h2>
                  <p className="text-sm text-gray-500">@{user.username} · {user.phone || user.user_phone || 'Telefon yok'} · {user.active && user.user_active ? 'Aktif' : 'Pasif'}</p>
                  <p className="mt-1 text-xs text-gray-400">{new Date(user.created_at).toLocaleDateString('tr-TR')}{isInfluencer && user.desired_fee !== null ? ` · ${user.desired_fee} TL/video` : ''}</p>
                  {user.projects?.length > 0 && <p className="mt-1 text-xs text-gray-500">Projeler: {user.projects.map((p) => p.name).join(', ')}</p>}
                </div>
                {!isCompanyAdmin && <div className="flex flex-wrap gap-3 text-sm">
                  <button onClick={() => edit(user)} className="text-gray-600">Düzenle</button>
                  <button onClick={() => resetPassword(user)} className="text-gray-600">Şifre sıfırla</button>
                  <button onClick={() => remove(user)} className="text-red-500">Sil</button>
                </div>}
              </div>
            </article>
          ))}
        </div>
      </div>
    </Layout>
  );
}
