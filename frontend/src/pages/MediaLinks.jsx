import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

export default function MediaLinks() {
  const [projects, setProjects] = useState([]);
  const [form, setForm] = useState({ projectId: '', platform: 'instagram', url: '' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch('/projects').then((data) => setProjects(data.projects)).catch(() => {});
  }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await apiFetch('/videos', { method: 'POST', body: JSON.stringify(form) });
      setForm({ projectId: '', platform: 'instagram', url: '' });
      setMessage('Link eklendi, proje raporlarına düştü.');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout title="Link Ekle">
      <div className="max-w-xl mx-auto">
        <h1 className="text-3xl font-semibold">Link Ekle</h1>
        <p className="mt-2 text-sm text-gray-500">Gönderi linkini, atandığınız projeye ekleyin.</p>
        <form onSubmit={submit} className="mt-6 space-y-3 rounded-xl border border-gray-200 p-4">
          <select required value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm">
            <option value="">Proje seç</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <select value={form.platform} onChange={(event) => setForm({ ...form, platform: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm">
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
          </select>
          <input required type="url" placeholder="https://..." value={form.url} onChange={(event) => setForm({ ...form, url: event.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
          <button disabled={saving} className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{saving ? 'Gönderiliyor...' : 'Link gönder'}</button>
          {message && <p className="text-sm text-gray-600">{message}</p>}
          {!projects.length && <p className="text-sm text-amber-600">Henüz atanmış bir projeniz yok, admin sizi bir projeye atadıktan sonra link ekleyebilirsiniz.</p>}
        </form>
      </div>
    </Layout>
  );
}
