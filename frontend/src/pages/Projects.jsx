import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

const EMPTY_FORM = { name: '', artistName: '', songName: '', startDate: '', endDate: '', status: 'draft', coverUrl: '', description: '', publicUrl: '', showOnHome: false, influencerIds: [], mediaAccountIds: [] };
const STATUSES = { draft: 'Taslak', active: 'Aktif', completed: 'Tamamlandı', cancelled: 'İptal' };

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [options, setOptions] = useState({ influencers: [], mediaAccounts: [] });
  const [influencerSearch, setInfluencerSearch] = useState('');
  const [mediaSearch, setMediaSearch] = useState('');

  async function load() {
    const projectData = await apiFetch('/projects');
    setProjects(projectData.projects);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    apiFetch('/projects/options').then(setOptions).catch(() => {});
  }, []);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function toggleAssignment(field, id) {
    setForm((current) => ({
      ...current,
      [field]: current[field].includes(id) ? current[field].filter((x) => x !== id) : [...current[field], id]
    }));
  }

  async function uploadCover(event) {
    const file = event.target.files[0];
    if (!file) return;
    setUploadingCover(true);
    setError('');
    try {
      const body = new FormData();
      body.append('cover', file);
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/project-assets/cover`, { method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('locy_token')}` }, body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Kapak yüklenemedi');
      setForm((current) => ({ ...current, coverUrl: data.coverUrl }));
    } catch (err) { setError(err.message); } finally { setUploadingCover(false); }
  }

  function reset() { setForm(EMPTY_FORM); setEditingId(null); setInfluencerSearch(''); setMediaSearch(''); }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch(editingId ? `/projects/${editingId}` : '/projects', { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(form) });
      reset();
      await load();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }

  async function remove(id) {
    if (!window.confirm('Bu proje silinsin mi?')) return;
    try { await apiFetch(`/projects/${id}`, { method: 'DELETE' }); setProjects((current) => current.filter((project) => project.id !== id)); } catch (err) { setError(err.message); }
  }

  async function edit(project) {
    const detail = await apiFetch(`/projects/${project.id}`);
    setEditingId(project.id);
    setForm({
      name: detail.project.name,
      artistName: detail.project.artist_name || '',
      songName: detail.project.song_name || detail.project.song_title || '',
      startDate: detail.project.start_date || '',
      endDate: detail.project.end_date || '',
      status: detail.project.status,
      coverUrl: detail.project.cover_url || '',
      description: detail.project.description || '',
      publicUrl: detail.project.public_url || '',
      showOnHome: Boolean(detail.project.show_on_home),
      influencerIds: detail.project.influencers.map((i) => i.id),
      mediaAccountIds: detail.project.mediaAccounts.map((m) => m.id)
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <Layout title="PR Projeleri">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8"><Link to="/admin" className="text-sm text-gray-500 hover:text-gray-900">← Admin paneli</Link><h1 className="mt-3 text-3xl font-semibold tracking-tight">PR Projeleri</h1><p className="mt-2 text-sm text-gray-500">Sanatçı, bütçe, tarih ve ekip atamalarını tek yerden yönetin.</p></div>
        <form onSubmit={submit} className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5 mb-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input name="name" value={form.name} onChange={updateField} required placeholder="Proje adı" className="sm:col-span-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            <input name="artistName" value={form.artistName} onChange={updateField} required placeholder="Sanatçı adı" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            <input name="songName" value={form.songName} onChange={updateField} required placeholder="Şarkı adı" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            <input name="startDate" value={form.startDate} onChange={updateField} type="date" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            <input name="endDate" value={form.endDate} onChange={updateField} type="date" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            <select name="status" value={form.status} onChange={updateField} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">{Object.entries(STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
            <label className="sm:col-span-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600">{uploadingCover ? 'Kapak yükleniyor...' : form.coverUrl ? 'Kapak seçildi' : 'Kapak görseli'}<input type="file" accept="image/*" onChange={uploadCover} className="mt-2 block w-full text-xs" /></label>
            <input name="publicUrl" value={form.publicUrl} onChange={updateField} type="url" placeholder="İsteğe bağlı proje linki" className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            <textarea name="description" value={form.description} onChange={updateField} placeholder="Kısa açıklama" className="sm:col-span-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            <label className="flex items-center gap-2 text-sm text-gray-700"><input name="showOnHome" type="checkbox" checked={form.showOnHome} onChange={(event) => setForm((current) => ({ ...current, showOnHome: event.target.checked }))} /> Ana sayfada göster</label>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">Influencerlar</p>
                {form.influencerIds.length > 0 && <span className="text-xs text-gray-400">{form.influencerIds.length} seçili</span>}
              </div>
              <input value={influencerSearch} onChange={(event) => setInfluencerSearch(event.target.value)} type="text" placeholder="Influencer ara..." className="mb-2 w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm" />
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {options.influencers
                  .filter((inf) => inf.name.toLowerCase().includes(influencerSearch.trim().toLowerCase()))
                  .map((inf) => (
                    <label key={inf.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={form.influencerIds.includes(inf.id)} onChange={() => toggleAssignment('influencerIds', inf.id)} />
                      {inf.name}
                    </label>
                  ))}
                {!options.influencers.length && <p className="text-xs text-gray-400">Henüz influencer eklenmedi.</p>}
                {options.influencers.length > 0 && !options.influencers.some((inf) => inf.name.toLowerCase().includes(influencerSearch.trim().toLowerCase())) && (
                  <p className="text-xs text-gray-400">Sonuç bulunamadı.</p>
                )}
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">Rap Medyaları</p>
                {form.mediaAccountIds.length > 0 && <span className="text-xs text-gray-400">{form.mediaAccountIds.length} seçili</span>}
              </div>
              <input value={mediaSearch} onChange={(event) => setMediaSearch(event.target.value)} type="text" placeholder="Rap medyası ara..." className="mb-2 w-full rounded-md border border-gray-200 px-2.5 py-1.5 text-sm" />
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {options.mediaAccounts
                  .filter((acc) => acc.name.toLowerCase().includes(mediaSearch.trim().toLowerCase()))
                  .map((acc) => (
                    <label key={acc.id} className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={form.mediaAccountIds.includes(acc.id)} onChange={() => toggleAssignment('mediaAccountIds', acc.id)} />
                      {acc.name}
                    </label>
                  ))}
                {!options.mediaAccounts.length && <p className="text-xs text-gray-400">Henüz rap medyası eklenmedi.</p>}
                {options.mediaAccounts.length > 0 && !options.mediaAccounts.some((acc) => acc.name.toLowerCase().includes(mediaSearch.trim().toLowerCase())) && (
                  <p className="text-xs text-gray-400">Sonuç bulunamadı.</p>
                )}
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
          <div className="mt-5 flex flex-wrap gap-2"><button disabled={saving} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50">{saving ? 'Kaydediliyor...' : editingId ? 'Projeyi güncelle' : 'Proje oluştur'}</button>{editingId && <button type="button" onClick={reset} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm">Vazgeç</button>}</div>
        </form>
        <div className="space-y-3">{projects.map((project) => <article key={project.id} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 hover:-translate-y-0.5 hover:shadow-sm transition"><div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"><div><div className="flex items-center gap-2"><h2 className="font-medium">{project.name}</h2><span className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">{STATUSES[project.status]}</span></div><p className="mt-1 text-sm text-gray-500">{project.artist_name || 'Sanatçı atanmamış'} · {project.start_date || 'Başlangıç yok'}{project.end_date ? ` - ${project.end_date}` : ''}</p>{(project.influencer_names || project.media_account_names) && <p className="mt-1.5 text-xs text-gray-500">{project.influencer_names && <span>Influencer: {project.influencer_names}</span>}{project.influencer_names && project.media_account_names && ' · '}{project.media_account_names && <span>Rap Medyası: {project.media_account_names}</span>}</p>}</div><div className="flex gap-3 text-sm"><Link to={`/admin/projects/${project.id}/report`} className="text-gray-600 hover:text-gray-900">Kampanya Raporu</Link><button onClick={() => edit(project)} className="text-gray-600 hover:text-gray-900">Düzenle</button><button onClick={() => remove(project.id)} className="text-red-500 hover:text-red-700">Sil</button></div></div>{project.budget !== null && <p className="mt-4 text-sm font-medium">{Number(project.budget).toLocaleString('tr-TR')} TL bütçe</p>}</article>)}{!projects.length && <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">Henüz proje oluşturulmadı.</p>}</div>
      </div>
    </Layout>
  );
}
