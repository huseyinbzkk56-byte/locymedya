import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

export default function RoleProjects({ title = 'Projelerim' }) {
  const [projects, setProjects] = useState([]);
  const [videos, setVideos] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ projectId: '', platform: 'instagram', url: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function load() {
    const [projectData, videoData] = await Promise.all([apiFetch('/projects'), apiFetch('/videos')]);
    setProjects(projectData.projects);
    setVideos(videoData.videos);
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch('/videos', { method: 'POST', body: JSON.stringify(form) });
      setForm({ projectId: '', platform: 'instagram', url: '' });
      setMessage('Link eklendi.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout title={title}>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-semibold">{title}</h1>

        {projects.length > 0 && (
          <form onSubmit={submit} className="mt-6 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-4">
            <select required value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
              <option value="">Proje seç</option>
              {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
            </select>
            <select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
            <input required type="url" placeholder="Video linki" value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm sm:col-span-2" />
            <button disabled={saving} className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition sm:col-span-4">{saving ? 'Ekleniyor...' : '+ Link Ekle'}</button>
          </form>
        )}
        {message && <p className="mt-3 text-sm text-emerald-600">{message}</p>}
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 space-y-3">
          {projects.map((project) => (
            <article key={project.id} className="rounded-xl border border-gray-200 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-medium">{project.name}</h2>
                  <p className="text-sm text-gray-500">{project.artist_name || 'Sanatçı'} · {project.start_date || 'Tarih yok'}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600">{project.status}</span>
              </div>
              <div className="mt-3 text-sm text-gray-500">{videos.filter((video) => video.project_id === project.id).length} video kaydı</div>
            </article>
          ))}
          {!projects.length && <p className="text-sm text-gray-400">Henüz atanmış proje yok.</p>}
        </div>
      </div>
    </Layout>
  );
}
