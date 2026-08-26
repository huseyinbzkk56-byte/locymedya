import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';
import OfferAccounts from './OfferAccounts';
import OfferList from './OfferList';
import { PLATFORMS, detectPlatform, PlatformIcon } from '../utils/platform';

const TABS = [
  ['catalog', 'Hesap Kataloğu'],
  ['offers', 'Teklifler'],
  ['presentation', 'Sunum Linkleri']
];

const GROUPS = Object.entries(PLATFORMS).map(([key, cfg]) => ({ key, label: cfg.label, accent: cfg.badge }));
const STATS_PLATFORMS = new Set(['instagram', 'tiktok']);

function formatStatNumber(value) {
  if (value === null || value === undefined) return null;
  return Number(value).toLocaleString('tr-TR');
}

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const ORIGIN = API.replace(/\/api\/?$/, '');

function LinkThumbnail({ link, groupKey }) {
  const [errored, setErrored] = useState(false);
  const src = link.screenshot_url ? `${ORIGIN}${link.screenshot_url}` : link.preview_image;
  if (src && !errored) {
    return <img src={src} alt="" onError={() => setErrored(true)} className="block w-full h-auto" />;
  }
  return (
    <div className="flex h-40 w-full items-center justify-center bg-gray-100 text-gray-300">
      <PlatformIcon platform={groupKey} className="h-10 w-10" />
    </div>
  );
}

export default function LinkList() {
  const [links, setLinks] = useState([]);
  const [platform, setPlatform] = useState('instagram');
  const [platformTouched, setPlatformTouched] = useState(false);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('catalog');
  const [brandTitle, setBrandTitle] = useState('');
  const [headerTitle, setHeaderTitle] = useState('');
  const [headerSubtitle, setHeaderSubtitle] = useState('');
  const [brandTitleSaving, setBrandTitleSaving] = useState(false);
  const [brandTitleSaved, setBrandTitleSaved] = useState(false);

  async function loadLinks() {
    const data = await apiFetch('/links');
    setLinks(data.links);
  }

  useEffect(() => {
    loadLinks().catch((err) => setError(err.message));
    apiFetch('/presentations/brand-title').then((data) => {
      setBrandTitle(data.brandTitle || '');
      setHeaderTitle(data.headerTitle || '');
      setHeaderSubtitle(data.headerSubtitle || '');
    }).catch(() => {});
  }, []);

  async function saveBrandTitle() {
    setBrandTitleSaving(true);
    try {
      const data = await apiFetch('/presentations/brand-title', { method: 'PUT', body: JSON.stringify({ brandTitle, headerTitle, headerSubtitle }) });
      setBrandTitle(data.brandTitle || '');
      setHeaderTitle(data.headerTitle || '');
      setHeaderSubtitle(data.headerSubtitle || '');
      setBrandTitleSaved(true);
      setTimeout(() => setBrandTitleSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBrandTitleSaving(false);
    }
  }

  const [archiveView, setArchiveView] = useState(false);
  const visibleLinks = useMemo(() => links.filter((link) => Boolean(link.archived) === archiveView), [links, archiveView]);
  const archivedCount = useMemo(() => links.filter((link) => link.archived).length, [links]);

  const groupedLinks = useMemo(
    () => Object.fromEntries(GROUPS.map((group) => [group.key, visibleLinks.filter((link) => link.platform === group.key)])),
    [visibleLinks]
  );

  function resetForm() {
    setPlatform('instagram');
    setPlatformTouched(false);
    setUrl('');
    setTitle('');
    setEditingId(null);
  }

  function handleUrlChange(value) {
    setUrl(value);
    if (!platformTouched && value.trim()) setPlatform(detectPlatform(value.trim()));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const path = editingId ? `/links/${editingId}` : '/links';
      await apiFetch(path, {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({ platform, url, title })
      });
      resetForm();
      await loadLinks();
      setTimeout(() => loadLinks().catch(() => {}), 2500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const [statsRefreshingId, setStatsRefreshingId] = useState(null);
  async function refreshStats(id) {
    setStatsRefreshingId(id);
    setError('');
    try {
      await apiFetch(`/links/${id}/refresh-stats`, { method: 'POST' });
      await loadLinks();
    } catch (err) {
      setError(err.message);
    } finally {
      setStatsRefreshingId(null);
    }
  }

  const [bulkStatsRefreshing, setBulkStatsRefreshing] = useState(false);
  async function refreshAllStats() {
    setBulkStatsRefreshing(true);
    setError('');
    try {
      await apiFetch('/links/refresh-stats', { method: 'POST' });
      await loadLinks();
    } catch (err) {
      setError(err.message);
    } finally {
      setBulkStatsRefreshing(false);
    }
  }

  const missingStatsCount = links.filter((link) => !link.archived && STATS_PLATFORMS.has(link.platform) && !link.stats_fetched_at).length;
  const activeCount = links.filter((link) => !link.archived).length;

  const [uploadingId, setUploadingId] = useState(null);
  async function uploadScreenshot(id, file) {
    if (!file) return;
    setUploadingId(id);
    setError('');
    try {
      const body = new FormData();
      body.append('screenshot', file);
      const response = await fetch(`${API}/links/${id}/screenshot`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('locy_token')}` },
        body
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ekran görüntüsü yüklenemedi');
      await loadLinks();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  function beginEdit(link) {
    setEditingId(link.id);
    setPlatform(link.platform);
    setPlatformTouched(true);
    setUrl(link.url);
    setTitle(link.title || '');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function archiveLink(id) {
    try {
      await apiFetch(`/links/${id}/archive`, { method: 'POST' });
      await loadLinks();
    } catch (err) {
      setError(err.message);
    }
  }

  async function unarchiveLink(id) {
    try {
      await apiFetch(`/links/${id}/unarchive`, { method: 'POST' });
      await loadLinks();
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeLink(id) {
    if (!window.confirm('Bu link silinsin mi?')) return;
    try {
      await apiFetch(`/links/${id}`, { method: 'DELETE' });
      setLinks((current) => current.filter((link) => link.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadPdf(path, filename) {
    setError('');
    try {
      const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem('locy_token')}` } });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'PDF oluşturulamadı');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
  }

  const downloadPresentation = (group) => downloadPdf(`/presentations/${group.key}.pdf`, `locy-medya-${group.key}-sunumu.pdf`);
  const downloadAllPresentations = () => downloadPdf('/presentations/all.pdf', 'locy-medya-tum-calismalar.pdf');

  return (
    <Layout title="Link Listesi">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <Link to="/admin" className="text-sm text-gray-500 hover:text-gray-900">← Admin paneli</Link>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">Link Listesi</h1>
            <p className="mt-2 text-sm text-gray-500">PR çalışmalarını platformlarına göre düzenleyin ve sunuma aktarın.</p>
          </div>
          <span className="text-sm text-gray-500">{links.length} kayıt</span>
        </div>

        <div className="mb-6 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm w-fit">
          {TABS.map(([value, label]) => (
            <button key={value} onClick={() => setActiveTab(value)} className={`rounded-md px-3.5 py-2 transition ${activeTab === value ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>{label}</button>
          ))}
        </div>

        {activeTab === 'catalog' && <OfferAccounts />}
        {activeTab === 'offers' && <OfferList />}

        {activeTab === 'presentation' && (
        <>
        <div className="mb-4 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm w-fit">
          <button onClick={() => setArchiveView(false)} className={`rounded-md px-3.5 py-2 transition ${!archiveView ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>Aktif</button>
          <button onClick={() => setArchiveView(true)} className={`rounded-md px-3.5 py-2 transition ${archiveView ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>Arşiv ({archivedCount})</button>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 mb-4">
          <p className="text-xs font-medium text-gray-500 mb-3">PDF marka ayarları — başka bir firma adına hazırladığınızda PDF'te Locy Medya değil, o firmanın adı görünsün.</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Üst başlık (ör. Fellas Müzik)</label>
              <input value={headerTitle} onChange={(event) => setHeaderTitle(event.target.value)} type="text" placeholder="LOCY MEDYA" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-shadow focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Alt başlık</label>
              <input value={headerSubtitle} onChange={(event) => setHeaderSubtitle(event.target.value)} type="text" placeholder="PR & DIGITAL MEDIA" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-shadow focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Bölüm başlığı öneki (ör. BAR BİA)</label>
              <input value={brandTitle} onChange={(event) => setBrandTitle(event.target.value)} type="text" placeholder="Opsiyonel" className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-shadow focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" />
            </div>
          </div>
          <div className="mt-3 flex gap-3">
            <button onClick={saveBrandTitle} disabled={brandTitleSaving} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition whitespace-nowrap">
              {brandTitleSaving ? 'Kaydediliyor...' : brandTitleSaved ? 'Kaydedildi ✓' : 'Ayarları Kaydet'}
            </button>
            {activeCount > 0 && (
              <button onClick={downloadAllPresentations} className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition whitespace-nowrap">Tümünü İndir (PDF)</button>
            )}
            {missingStatsCount > 0 && (
              <button onClick={refreshAllStats} disabled={bulkStatsRefreshing} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition whitespace-nowrap">
                {bulkStatsRefreshing ? 'Çekiliyor...' : `İstatistikleri Çek (${missingStatsCount})`}
              </button>
            )}
          </div>
        </div>

        {!archiveView && (
        <form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5 mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={platform} onChange={(event) => { setPlatform(event.target.value); setPlatformTouched(true); }} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
              {GROUPS.map((group) => <option key={group.key} value={group.key}>{group.label}</option>)}
            </select>
            <input value={url} onChange={(event) => handleUrlChange(event.target.value)} type="url" required placeholder="https://..." className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-shadow focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" />
          </div>
          <div className="mt-3 flex flex-col sm:flex-row gap-3">
            <input value={title} onChange={(event) => setTitle(event.target.value)} type="text" placeholder="Başlık (ör. Ünlü Sanatçı - Yeni Klip)" className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-shadow focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10" />
            <button disabled={saving} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition">{saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : '+ Link Ekle'}</button>
            {editingId && <button type="button" onClick={resetForm} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm hover:bg-gray-100">Vazgeç</button>}
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </form>
        )}
        {archiveView && error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {GROUPS.filter((group) => groupedLinks[group.key].length).map((group) => (
            <section key={group.key} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-4">
                <div className="flex items-center gap-2">
                  <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${group.accent}`}>
                    <PlatformIcon platform={group.key} className="h-3.5 w-3.5" />
                    {group.label}
                  </span>
                  <span className="text-xs text-gray-400">{groupedLinks[group.key].length}</span>
                </div>
                {!archiveView && <button onClick={() => downloadPresentation(group)} className="text-xs font-medium text-gray-600 hover:text-gray-900">PDF indir</button>}
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-1">
                {groupedLinks[group.key].map((link, index) => (
                  <div key={link.id} className="group overflow-hidden rounded-xl border border-gray-100 bg-gray-50/60 transition hover:-translate-y-0.5 hover:border-gray-300 hover:bg-white hover:shadow-md">
                    <div className="relative w-full bg-gray-100">
                      <LinkThumbnail link={link} groupKey={group.key} />
                      <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-2.5">
                        <span className="rounded-full bg-black/40 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">{String(index + 1).padStart(2, '0')}</span>
                        <div className="flex gap-2 text-xs opacity-0 transition group-hover:opacity-100">
                          {STATS_PLATFORMS.has(link.platform) && (
                            <button onClick={() => refreshStats(link.id)} disabled={statsRefreshingId === link.id} title="İstatistikleri çek" className="rounded-full bg-black/40 px-2 py-0.5 text-white backdrop-blur-sm hover:bg-black/60 disabled:opacity-50">
                              {statsRefreshingId === link.id ? '…' : '📊'}
                            </button>
                          )}
                          <button onClick={() => beginEdit(link)} className="rounded-full bg-black/40 px-2 py-0.5 text-white backdrop-blur-sm hover:bg-black/60">Düzenle</button>
                          {archiveView ? (
                            <button onClick={() => unarchiveLink(link.id)} className="rounded-full bg-black/40 px-2 py-0.5 text-white backdrop-blur-sm hover:bg-black/60">Geri Yükle</button>
                          ) : (
                            <button onClick={() => archiveLink(link.id)} className="rounded-full bg-black/40 px-2 py-0.5 text-white backdrop-blur-sm hover:bg-black/60">Arşivle</button>
                          )}
                          <button onClick={() => removeLink(link.id)} className="rounded-full bg-black/40 px-2 py-0.5 text-white backdrop-blur-sm hover:bg-red-600">Sil</button>
                        </div>
                      </div>
                      <label className="absolute bottom-2.5 right-2.5 cursor-pointer rounded-full bg-black/60 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-sm transition hover:bg-black/80">
                        {uploadingId === link.id ? 'Yükleniyor...' : '📷 Ekran Görüntüsü'}
                        <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => uploadScreenshot(link.id, event.target.files?.[0])} />
                      </label>
                    </div>
                    <div className="p-4">
                      <p className="break-words text-base font-semibold text-gray-900" style={{ overflowWrap: 'anywhere' }}>{link.title || link.preview_title || `${group.label} Paylaşımı`}</p>
                      {link.stats_fetched_at && (
                        <div className="mt-3 flex gap-5">
                          {formatStatNumber(link.stats_views) !== null && (
                            <div><div className="text-xl font-bold text-gray-900">{formatStatNumber(link.stats_views)}</div><div className="text-xs text-gray-500">👁 İzlenme</div></div>
                          )}
                          {formatStatNumber(link.stats_likes) !== null && (
                            <div><div className="text-xl font-bold text-gray-900">{formatStatNumber(link.stats_likes)}</div><div className="text-xs text-gray-500">❤ Beğeni</div></div>
                          )}
                          {formatStatNumber(link.stats_comments) !== null && (
                            <div><div className="text-xl font-bold text-gray-900">{formatStatNumber(link.stats_comments)}</div><div className="text-xs text-gray-500">💬 Yorum</div></div>
                          )}
                        </div>
                      )}
                      <a href={link.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-4 transition hover:decoration-gray-900">
                        Görüntüle
                        <span className="transition group-hover:translate-x-0.5">→</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {!visibleLinks.length && (
            <p className="col-span-full rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
              {archiveView ? 'Arşivde link yok.' : 'Henüz link eklenmedi.'}
            </p>
          )}
        </div>
        </>
        )}
      </div>
    </Layout>
  );
}
