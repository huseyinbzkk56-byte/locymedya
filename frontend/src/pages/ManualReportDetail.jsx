import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';
import { PlatformIcon, detectPlatform } from '../utils/platform';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const STATUS_LABEL = { pending: 'Bekliyor', processing: 'İşleniyor', success: 'Başarılı', error: 'Hatalı' };
const STATUS_STYLE = {
  pending: 'bg-gray-100 text-gray-500',
  processing: 'bg-blue-50 text-blue-700',
  success: 'bg-emerald-50 text-emerald-700',
  error: 'bg-red-50 text-red-600'
};

function num(n) {
  return Number(n || 0).toLocaleString('tr-TR');
}
function formatCompact(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}B`;
  return n.toLocaleString('tr-TR');
}
function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ManualReportDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [singleForm, setSingleForm] = useState({ pageName: '', platform: 'instagram', url: '' });
  const [platformTouched, setPlatformTouched] = useState(false);
  const [addingSingle, setAddingSingle] = useState(false);

  const [bulkText, setBulkText] = useState('');
  const [bulkErrors, setBulkErrors] = useState([]);
  const [addingBulk, setAddingBulk] = useState(false);

  const [refreshingAll, setRefreshingAll] = useState(false);
  const [refreshingId, setRefreshingId] = useState(null);
  const pollRef = useRef(null);

  async function load() {
    const result = await apiFetch(`/manual-reports/${id}`);
    setData(result);
    return result;
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    return () => clearTimeout(pollRef.current);
  }, [id]);

  useEffect(() => {
    if (!data) return;
    const busy = data.summary.pendingCount > 0;
    if (busy) {
      pollRef.current = setTimeout(() => { load().catch(() => {}); }, 2500);
    }
    return () => clearTimeout(pollRef.current);
  }, [data]);

  function handleUrlChange(value) {
    setSingleForm((f) => ({ ...f, url: value }));
    if (!platformTouched && value.trim()) setSingleForm((f) => ({ ...f, platform: detectPlatform(value.trim()) }));
  }

  async function submitSingle(event) {
    event.preventDefault();
    setAddingSingle(true);
    setError('');
    try {
      await apiFetch(`/manual-reports/${id}/videos`, { method: 'POST', body: JSON.stringify(singleForm) });
      setSingleForm({ pageName: '', platform: 'instagram', url: '' });
      setPlatformTouched(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingSingle(false);
    }
  }

  async function submitBulk(event) {
    event.preventDefault();
    setAddingBulk(true);
    setError('');
    setBulkErrors([]);
    try {
      const result = await apiFetch(`/manual-reports/${id}/videos/bulk`, { method: 'POST', body: JSON.stringify({ text: bulkText }) });
      setBulkText('');
      if (result.lineErrors?.length) setBulkErrors(result.lineErrors);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setAddingBulk(false);
    }
  }

  async function refreshAll() {
    setRefreshingAll(true);
    setError('');
    try {
      await apiFetch(`/manual-reports/${id}/refresh-all`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshingAll(false);
    }
  }

  async function refreshOne(videoId) {
    setRefreshingId(videoId);
    setError('');
    try {
      await apiFetch(`/manual-reports/${id}/videos/${videoId}/refresh`, { method: 'POST' });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRefreshingId(null);
    }
  }

  async function removeVideo(videoId) {
    if (!window.confirm('Bu video kaydı silinsin mi?')) return;
    try {
      await apiFetch(`/manual-reports/${id}/videos/${videoId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadPdf() {
    try {
      const response = await fetch(`${API}/manual-reports/${id}/pdf`, { headers: { Authorization: `Bearer ${localStorage.getItem('locy_token')}` } });
      if (!response.ok) throw new Error('PDF oluşturulamadı');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `rapor-${id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  function copyLink() {
    if (!data) return;
    navigator.clipboard?.writeText(`${window.location.origin}/rapor/${data.report.public_token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!data) {
    return <Layout title="Manuel Rapor"><div className="max-w-6xl mx-auto text-sm text-gray-400">{error || 'Yükleniyor...'}</div></Layout>;
  }

  const { report, summary, videos } = data;
  const processedCount = summary.videoCount - summary.pendingCount;

  return (
    <Layout title={report.name}>
      <div className="max-w-6xl mx-auto">
        <Link to="/admin/manual-reports" className="text-sm text-gray-500 hover:text-gray-900">← Manuel Raporlar</Link>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">{report.name}</h1>
            <p className="mt-1 text-sm text-gray-500">{[report.artist_name, report.song_name].filter(Boolean).join(' · ') || 'Sanatçı/şarkı belirtilmedi'}{report.report_date ? ` · ${formatDate(report.report_date)}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copyLink} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-gray-50 transition whitespace-nowrap">{copied ? 'Kopyalandı ✓' : 'Paylaşılabilir Rapor Linki'}</button>
            <button onClick={downloadPdf} className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition whitespace-nowrap">↓ Raporu PDF İndir</button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {summary.pendingCount > 0 && (
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
            {summary.videoCount} videodan {processedCount}'i işlendi... (otomatik güncelleniyor)
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-2xl font-semibold">{summary.videoCount}</p><p className="text-xs text-gray-500 mt-1">Toplam Video</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-2xl font-semibold">{num(summary.totals.views)}</p><p className="text-xs text-gray-500 mt-1">Toplam Görüntülenme</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-2xl font-semibold">{num(summary.totals.likes)}</p><p className="text-xs text-gray-500 mt-1">Toplam Beğeni</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-2xl font-semibold">{num(summary.totals.comments)}</p><p className="text-xs text-gray-500 mt-1">Toplam Yorum</p></div>
        </div>

        {summary.pages.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Sayfa Bazlı Rapor</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {summary.pages.map((page) => (
                <div key={page.pageName} className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="font-medium text-gray-900">@{page.pageName}</p>
                  <p className="mt-1 text-sm text-gray-500">{page.videoCount} video</p>
                  <p className="mt-0.5 text-sm font-semibold text-gray-900">{num(page.views)} görüntülenme</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <form onSubmit={submitSingle} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h2 className="text-sm font-semibold text-gray-700">Tek Video Ekle</h2>
            <div className="mt-3 space-y-2.5">
              <input required placeholder="Sayfa adı (örn. raphouse.tr)" value={singleForm.pageName} onChange={(e) => setSingleForm({ ...singleForm, pageName: e.target.value })} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
              <div className="flex gap-2">
                <select value={singleForm.platform} onChange={(e) => { setSingleForm({ ...singleForm, platform: e.target.value }); setPlatformTouched(true); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
                  <option value="instagram">Instagram</option>
                  <option value="tiktok">TikTok</option>
                </select>
                <input required type="url" placeholder="Video linki" value={singleForm.url} onChange={(e) => handleUrlChange(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
              </div>
              <button disabled={addingSingle} className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition">{addingSingle ? 'Ekleniyor...' : '+ Video Ekle'}</button>
            </div>
          </form>

          <form onSubmit={submitBulk} className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <h2 className="text-sm font-semibold text-gray-700">Toplu Link Ekle</h2>
            <p className="mt-1 text-xs text-gray-500">Her satıra "sayfa adı | video linki" yazın. Platform otomatik algılanır.</p>
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={5} placeholder={'raphouse.tr | https://www.instagram.com/reel/xxxxx/\nrapsector | https://www.tiktok.com/@rapsector/video/xxxxx'} className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-mono" />
            <button disabled={addingBulk || !bulkText.trim()} className="mt-2.5 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition">{addingBulk ? 'Ekleniyor...' : '+ Toplu Ekle'}</button>
            {bulkErrors.length > 0 && (
              <ul className="mt-2.5 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                {bulkErrors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            )}
          </form>
        </section>

        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Videolar</h2>
            {videos.length > 0 && (
              <button onClick={refreshAll} disabled={refreshingAll} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 transition">{refreshingAll ? 'Başlatılıyor...' : 'Tümünü Güncelle'}</button>
            )}
          </div>
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-3">Video</th>
                  <th className="px-4 py-3">Sayfa</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3 text-right">İzlenme</th>
                  <th className="px-4 py-3 text-right">Beğeni</th>
                  <th className="px-4 py-3 text-right">Yorum</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {videos.map((v) => (
                  <tr key={v.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <a href={v.url} target="_blank" rel="noreferrer" className="group relative block h-14 w-14 overflow-hidden rounded-lg bg-gray-100">
                        {v.thumbnail_url ? (
                          <img src={v.thumbnail_url} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center"><PlatformIcon platform={v.platform} className="h-5 w-5 text-gray-300" /></span>
                        )}
                        {v.status === 'success' && (
                          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1 pb-0.5 pt-3 text-center text-[10px] font-semibold text-white">{formatCompact(v.views)}</span>
                        )}
                      </a>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900"><a href={v.url} target="_blank" rel="noreferrer" className="hover:underline">@{v.page_name}</a></td>
                    <td className="px-4 py-3 text-gray-500"><span className="inline-flex items-center gap-1.5"><PlatformIcon platform={v.platform} className="h-3.5 w-3.5" />{v.platform === 'instagram' ? 'Instagram' : 'TikTok'}</span></td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{v.status === 'success' ? num(v.views) : '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{v.status === 'success' ? (v.likes === null ? 'Gizli' : num(v.likes)) : '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{v.status === 'success' ? num(v.comments) : '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(v.posted_at || v.created_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[v.status]}`}>{STATUS_LABEL[v.status]}</span>
                      {v.status === 'error' && v.error_message && <p className="mt-1 max-w-[160px] text-[11px] text-red-500">{v.error_message}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-3 text-xs">
                        <button onClick={() => refreshOne(v.id)} disabled={refreshingId === v.id} className="text-gray-500 hover:text-gray-900 disabled:opacity-50">{refreshingId === v.id ? '...' : 'Tekrar Kontrol Et'}</button>
                        <button onClick={() => removeVideo(v.id)} className="text-red-500 hover:text-red-700">Sil</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!videos.length && <p className="p-8 text-center text-sm text-gray-400">Henüz video eklenmedi.</p>}
          </div>
        </section>
      </div>
    </Layout>
  );
}
