import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';
import { InstagramIcon, TikTokIcon } from '../components/PlatformIcons';

const CATEGORY_LABEL = { influencer: 'Influencer', rapmedia: 'Türkçe Rap Medyası', dizi: 'Dizi Edit Sayfası' };
const PUBLIC_BASE = window.location.origin;
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function PlatformBadge({ icon, followers }) {
  return <span className="inline-flex items-center gap-1 text-gray-600">{icon}{Number(followers).toLocaleString('tr-TR')}</span>;
}

export default function OfferDetail() {
  const { id } = useParams();
  const [offer, setOffer] = useState(null);
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ name: '', clientName: '', status: 'draft', totalPrice: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [platform, setPlatform] = useState('');
  const [results, setResults] = useState([]);
  const [priceDrafts, setPriceDrafts] = useState({});

  async function load() {
    const data = await apiFetch(`/offers/${id}`);
    setOffer(data.offer);
    setItems(data.items);
    setMeta({ name: data.offer.name, clientName: data.offer.client_name, status: data.offer.status, totalPrice: data.offer.total_price ?? '' });
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, [id]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (category) params.set('category', category);
    if (platform) params.set('platform', platform);
    apiFetch(`/offer-accounts?${params.toString()}`).then((data) => setResults(data.accounts)).catch((err) => setError(err.message));
  }, [search, category, platform]);

  async function saveMeta(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/offers/${id}`, { method: 'PUT', body: JSON.stringify(meta) });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function addAccount(accountId) {
    try {
      const data = await apiFetch(`/offers/${id}/items`, { method: 'POST', body: JSON.stringify({ mediaAccountId: accountId }) });
      setItems(data.items);
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateItemPrice(itemId) {
    const value = priceDrafts[itemId];
    if (value === undefined) return;
    try {
      const data = await apiFetch(`/offers/${id}/items/${itemId}`, { method: 'PUT', body: JSON.stringify({ clientPrice: Number(value) }) });
      setItems(data.items);
      setPriceDrafts((current) => { const next = { ...current }; delete next[itemId]; return next; });
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeItem(itemId) {
    try {
      const data = await apiFetch(`/offers/${id}/items/${itemId}`, { method: 'DELETE' });
      setItems(data.items);
    } catch (err) {
      setError(err.message);
    }
  }

  function copyLink() {
    navigator.clipboard.writeText(`${PUBLIC_BASE}/teklif/${offer.public_token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  const [downloadingPdf, setDownloadingPdf] = useState(false);
  async function downloadPdf() {
    setDownloadingPdf(true);
    setError('');
    try {
      const response = await fetch(`${API}/offers/${id}/pdf`, { headers: { Authorization: `Bearer ${localStorage.getItem('locy_token')}` } });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'PDF oluşturulamadı');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `teklif-${id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloadingPdf(false);
    }
  }

  if (!offer) return <Layout title="Teklif"><p className="text-sm text-gray-400">Yükleniyor...</p></Layout>;

  const addedIds = new Set(items.map((item) => item.accountId));
  const addableResults = results.filter((account) => !addedIds.has(account.id));
  const totalFollowers = items.reduce((sum, item) => sum + item.followers, 0);
  const totalClient = items.reduce((sum, item) => sum + item.clientPrice, 0);
  const totalNormal = items.reduce((sum, item) => sum + item.normalPrice, 0);

  return (
    <Layout title="Teklif Düzenle">
      <div className="mx-auto max-w-6xl">
        <Link to="/admin/links" className="text-sm text-gray-500 hover:text-gray-900">← Link Listesi</Link>

        <form onSubmit={saveMeta} className="mt-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1.3fr,1fr,auto,auto,auto]">
            <input required value={meta.name} onChange={(e) => setMeta({ ...meta, name: e.target.value })} placeholder="Teklif adı" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            <input required value={meta.clientName} onChange={(e) => setMeta({ ...meta, clientName: e.target.value })} placeholder="Müşteri adı" className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            <input type="number" min="0" step="0.01" value={meta.totalPrice} onChange={(e) => setMeta({ ...meta, totalPrice: e.target.value })} placeholder="Teklif fiyatı (TL)" className="w-40 rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            <select value={meta.status} onChange={(e) => setMeta({ ...meta, status: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm">
              <option value="draft">Taslak</option>
              <option value="sent">Gönderildi</option>
              <option value="archived">Arşivlendi</option>
            </select>
            <button disabled={saving} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          </div>
          <p className="mt-2 text-xs text-gray-400">Teklif fiyatı boş bırakılırsa, müşteriye hesap fiyatlarının toplamı gösterilir. Doldurursan müşteri sadece bu tek fiyatı görür — hesap bazlı fiyatlar müşteriye hiç gösterilmez, sadece aşağıdaki tabloda senin takibin için durur.</p>
        </form>

        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-purple-100 bg-purple-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">Müşteri Linki</p>
            <p className="truncate text-sm text-purple-900">{PUBLIC_BASE}/teklif/{offer.public_token}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={copyLink} className="press-feedback rounded-lg border border-purple-200 bg-white px-3 py-2 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100"><span key={copied ? 'copied' : 'idle'} className="fade-in-fast inline-block">{copied ? 'Kopyalandı ✓' : 'Linki Kopyala'}</span></button>
            <a href={`/teklif/${offer.public_token}`} target="_blank" rel="noreferrer" className="rounded-lg bg-purple-600 px-3 py-2 text-xs font-medium text-white hover:bg-purple-700">Önizle</a>
            <button onClick={downloadPdf} disabled={downloadingPdf} className="rounded-lg border border-purple-200 bg-white px-3 py-2 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50">{downloadingPdf ? 'Hazırlanıyor...' : '↓ PDF İndir'}</button>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-2xl font-semibold">{items.length}</p><p className="text-xs text-gray-500 mt-1">Hesap</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-2xl font-semibold">{totalFollowers.toLocaleString('tr-TR')}</p><p className="text-xs text-gray-500 mt-1">Toplam Takipçi</p></div>
          <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-2xl font-semibold">{totalClient.toLocaleString('tr-TR')} TL</p><p className="text-xs text-gray-500 mt-1">Hesap Fiyatları Toplamı <span className="text-gray-400">(normal: {totalNormal.toLocaleString('tr-TR')} TL)</span></p></div>
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4"><p className="text-2xl font-semibold text-purple-900">{(meta.totalPrice !== '' ? Number(meta.totalPrice) : totalClient).toLocaleString('tr-TR')} TL</p><p className="text-xs text-purple-500 mt-1">Müşterinin Gördüğü Fiyat</p></div>
        </div>

        <h2 className="mt-8 text-lg font-semibold">Teklifteki Hesaplar</h2>
        <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
              <tr><th className="px-4 py-3">Hesap</th><th className="px-4 py-3">Platformlar</th><th className="px-4 py-3">Normal</th><th className="px-4 py-3">Müşteri Fiyatı</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{item.name}<span className="ml-2 text-xs font-normal text-gray-400">{CATEGORY_LABEL[item.category]}</span></td>
                  <td className="px-4 py-3 text-gray-500">
                    <div className="flex flex-col gap-1">
                      {item.instagram && <PlatformBadge icon={<InstagramIcon className="text-pink-500" />} followers={item.instagram.followers} />}
                      {item.tiktok && <PlatformBadge icon={<TikTokIcon className="text-slate-700" />} followers={item.tiktok.followers} />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{Number(item.normalPrice).toLocaleString('tr-TR')} TL</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <input type="number" min="0" step="0.01" value={priceDrafts[item.id] ?? item.clientPrice} onChange={(e) => setPriceDrafts((current) => ({ ...current, [item.id]: e.target.value }))} className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm" />
                      {priceDrafts[item.id] !== undefined && priceDrafts[item.id] != item.clientPrice && <button onClick={() => updateItemPrice(item.id)} className="text-xs font-medium text-gray-900 hover:underline">Kaydet</button>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right"><button onClick={() => removeItem(item.id)} className="text-xs text-red-500 hover:text-red-700">Kaldır</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && <p className="p-8 text-center text-sm text-gray-400">Bu teklife henüz hesap eklenmedi.</p>}
        </div>

        <h2 className="mt-8 text-lg font-semibold">Hesap Ekle</h2>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input placeholder="Hesap ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm sm:max-w-xs" />
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
              {[['', 'Tümü'], ['influencer', 'Influencer'], ['rapmedia', 'Türkçe Rap Medyası'], ['dizi', 'Dizi Edit Sayfası']].map(([value, label]) => (
                <button key={value} onClick={() => setCategory(value)} className={`rounded-md px-2.5 py-1.5 transition ${category === value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{label}</button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
              {[['', 'Tümü'], ['instagram', 'Instagram'], ['tiktok', 'TikTok']].map(([value, label]) => (
                <button key={value} onClick={() => setPlatform(value)} className={`rounded-md px-2.5 py-1.5 transition ${platform === value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {addableResults.map((account) => {
            const defaultPrice = (account.instagram_client_price || 0) + (account.tiktok_client_price || 0);
            return (
              <div key={account.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{account.name} <span className="ml-1 text-xs font-normal text-gray-400">{CATEGORY_LABEL[account.category]}</span></p>
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                    {account.instagram_url && <PlatformBadge icon={<InstagramIcon className="text-pink-500" />} followers={account.instagram_followers} />}
                    {account.tiktok_url && <PlatformBadge icon={<TikTokIcon className="text-slate-700" />} followers={account.tiktok_followers} />}
                    <span>Müşteri fiyatı: <span className="font-medium text-gray-900">{defaultPrice.toLocaleString('tr-TR')} TL</span></span>
                  </div>
                </div>
                <button onClick={() => addAccount(account.id)} className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium hover:bg-gray-900 hover:text-white transition">EKLE</button>
              </div>
            );
          })}
          {!addableResults.length && <p className="p-6 text-center text-sm text-gray-400">Eklenebilecek hesap bulunamadı.</p>}
        </div>
      </div>
    </Layout>
  );
}
