import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

const ROLE_LABEL = { influencer: 'Influencer', rapmedia: 'Rap Medya', admin: 'Admin' };
const QUICK_RANGES = [
  ['month', 'Bu Ay'],
  ['lastMonth', 'Geçen Ay'],
  ['last3', 'Son 3 Ay'],
  ['all', 'Tüm Zamanlar']
];
const SORT_OPTIONS = [
  ['range_views', 'En Çok İzlenme'],
  ['range_payment', 'En Yüksek Kazanç'],
  ['range_project_count', 'En Fazla Proje Katkısı'],
  ['range_video_count', 'En Fazla Video']
];

const AVATAR_COLORS = ['#D4A954', '#6E9BD1', '#8FB584', '#C77B5E', '#9B87C4', '#5EA8A0'];
function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function Avatar({ name, size = 36 }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div className="flex flex-none items-center justify-center rounded-full font-semibold text-white" style={{ width: size, height: size, background: colorFor(name || ''), fontSize: size * 0.42 }}>
      {initial}
    </div>
  );
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}
function tl(n) {
  return `${Number(n || 0).toLocaleString('tr-TR')} TL`;
}
function num(n) {
  return Number(n || 0).toLocaleString('tr-TR');
}

export default function VideoReports() {
  const [range, setRange] = useState('month');
  const [month, setMonth] = useState(currentMonth());
  const [owners, setOwners] = useState([]);
  const [ratePerView, setRatePerView] = useState(0);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('range_views');
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams({ range });
    if (range === 'month') params.set('month', month);
    apiFetch(`/videos/owner-report?${params.toString()}`)
      .then((data) => { setOwners(data.owners); setRatePerView(data.ratePerView); })
      .catch((err) => setError(err.message));
  }, [range, month]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? owners.filter((o) => o.owner_name?.toLowerCase().includes(q) || o.username?.toLowerCase().includes(q)) : owners;
    return [...list].sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
  }, [owners, search, sortKey]);

  const totalPayment = filtered.reduce((sum, row) => sum + (row.range_payment || 0), 0);
  const totalViews = filtered.reduce((sum, row) => sum + (row.range_views || 0), 0);

  return (
    <Layout title="Video Raporları">
      <div className="max-w-7xl mx-auto">
        <Link to="/admin" className="text-sm text-gray-500 hover:text-gray-900">← Admin paneli</Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Video Raporları</h1>
            <p className="mt-2 text-sm text-gray-500">Her hesabın ayrı istatistiklerini görün. Projesi silinmiş linkler hesaba dahil edilmez.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {range === 'month' && <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />}
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
              {QUICK_RANGES.map(([value, label]) => (
                <button key={value} onClick={() => setRange(value)} className={`rounded-md px-2.5 py-1.5 transition ${range === value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {filtered.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-2xl font-semibold">{filtered.length}</p><p className="text-xs text-gray-500 mt-1">Hesap</p></div>
            <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-2xl font-semibold">{num(totalViews)}</p><p className="text-xs text-gray-500 mt-1">Toplam İzlenme</p></div>
            <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-2xl font-semibold">{ratePerView.toLocaleString('tr-TR', { maximumFractionDigits: 4 })} TL</p><p className="text-xs text-gray-500 mt-1">İzlenme Başına Ücret</p></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-2xl font-semibold text-emerald-800">{tl(totalPayment)}</p><p className="text-xs text-emerald-600 mt-1">Toplam Ödenecek Tutar</p></div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input placeholder="Kullanıcı adına göre ara..." value={search} onChange={(event) => setSearch(event.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm sm:max-w-xs" />
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
            {SORT_OPTIONS.map(([value, label]) => (
              <button key={value} onClick={() => setSortKey(value)} className={`rounded-md px-2.5 py-1.5 transition ${sortKey === value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{label}</button>
            ))}
          </div>
        </div>

        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3">Hesap</th>
                <th className="px-4 py-3 text-right">İzlenme (Seçili Aralık)</th>
                <th className="px-4 py-3 text-right">Ödenecek</th>
                <th className="px-4 py-3 text-right">Toplam İzlenme</th>
                <th className="px-4 py-3 text-right">Proje (Aralık / Toplam)</th>
                <th className="px-4 py-3 text-right">Video (Aralık / Toplam)</th>
                <th className="px-4 py-3">En Çok İzlenen Video</th>
                <th className="px-4 py-3">En Fazla Katkı Verdiği Proje</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((row) => (
                <tr key={row.owner_id ?? 'unknown'} className="transition-colors hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={row.owner_name} />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">{row.owner_name}</p>
                        <p className="text-xs text-gray-400">{ROLE_LABEL[row.role] || '—'}{row.username ? ` · @${row.username}` : ''}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{num(row.range_views)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{tl(row.range_payment)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{num(row.total_views)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{row.range_project_count} / {row.total_project_count}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{row.range_video_count} / {row.total_video_count}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {row.top_video_url ? (
                      <a href={row.top_video_url} target="_blank" rel="noreferrer" className="text-gray-700 underline decoration-gray-300 hover:decoration-gray-900">{num(row.top_video_views)} izlenme</a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {row.top_project_name ? (
                      <span>{row.top_project_name} <span className="text-gray-400">({num(row.top_project_views)} · {tl(row.top_project_payment)})</span></span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right"><Link to={`/admin/video-reports/${row.owner_id}`} className="text-xs font-medium text-gray-900 hover:underline">Detay →</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <p className="p-8 text-center text-sm text-gray-400">Bu aralık için veri bulunmuyor.</p>}
        </div>
      </div>
    </Layout>
  );
}
