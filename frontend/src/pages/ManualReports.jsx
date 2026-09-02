import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ManualReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', artistName: '', songName: '', reportDate: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  async function load() {
    const data = await apiFetch('/manual-reports');
    setReports(data.reports);
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await apiFetch('/manual-reports', { method: 'POST', body: JSON.stringify(form) });
      navigate(`/admin/manual-reports/${data.report.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm('Bu manuel rapor ve tüm videoları kalıcı olarak silinsin mi?')) return;
    try {
      await apiFetch(`/manual-reports/${id}`, { method: 'DELETE' });
      setReports((current) => current.filter((r) => r.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadPdf(id, name) {
    try {
      const response = await fetch(`${API}/manual-reports/${id}/pdf`, { headers: { Authorization: `Bearer ${localStorage.getItem('locy_token')}` } });
      if (!response.ok) throw new Error('PDF oluşturulamadı');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `rapor-${name}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  function copyLink(report) {
    const url = `${window.location.origin}/rapor/${report.public_token}`;
    navigator.clipboard?.writeText(url);
    setCopiedId(report.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <Layout title="Manuel Raporlar">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Manuel Raporlar</h1>
            <p className="mt-2 text-sm text-gray-500">Eski/kapanmış projeler için elle link girip Apify'dan otomatik rapor oluşturun. Mevcut PR proje sisteminden bağımsızdır.</p>
          </div>
          <button onClick={() => setShowForm((v) => !v)} className="inline-flex justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition">
            {showForm ? 'Kapat' : '+ Yeni Rapor'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <input required placeholder="Proje adı (örn. Aslar & Lessio - Kum Gibi)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm sm:col-span-2" />
              <input placeholder="Sanatçı adı" value={form.artistName} onChange={(e) => setForm({ ...form, artistName: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
              <input placeholder="Şarkı adı" value={form.songName} onChange={(e) => setForm({ ...form, songName: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
              <input type="date" value={form.reportDate} onChange={(e) => setForm({ ...form, reportDate: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
              <input placeholder="Not (opsiyonel)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            </div>
            <button disabled={saving} className="mt-3 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition">{saving ? 'Oluşturuluyor...' : 'Rapor Oluştur ve Video Ekle'}</button>
          </form>
        )}

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3">Proje</th>
                <th className="px-4 py-3">Sanatçı / Şarkı</th>
                <th className="px-4 py-3 text-right">Video</th>
                <th className="px-4 py-3 text-right">Görüntülenme</th>
                <th className="px-4 py-3">Tarih</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reports.map((report) => (
                <tr key={report.id} className="transition-colors hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    <Link to={`/admin/manual-reports/${report.id}`} className="hover:underline">{report.name}</Link>
                    {report.pendingCount > 0 && <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">{report.pendingCount} işleniyor</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{[report.artist_name, report.song_name].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{report.videoCount}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{Number(report.totalViews).toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(report.report_date || report.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-3 text-xs">
                      <Link to={`/admin/manual-reports/${report.id}`} className="text-gray-500 hover:text-gray-900">Görüntüle</Link>
                      <button onClick={() => downloadPdf(report.id, report.name)} className="text-gray-500 hover:text-gray-900">PDF</button>
                      <button onClick={() => copyLink(report)} className="text-gray-500 hover:text-gray-900">{copiedId === report.id ? 'Kopyalandı ✓' : 'Link'}</button>
                      <button onClick={() => remove(report.id)} className="text-red-500 hover:text-red-700">Sil</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!reports.length && <p className="p-8 text-center text-sm text-gray-400">Henüz manuel rapor oluşturulmadı.</p>}
        </div>
      </div>
    </Layout>
  );
}
