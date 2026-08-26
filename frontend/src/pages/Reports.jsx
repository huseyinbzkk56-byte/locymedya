import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiFetch, getCurrentUser } from '../api/client';

const MONTH_LABELS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

function YearlyStats() {
  const [yearly, setYearly] = useState(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/reports/yearly?year=${year}`).then(setYearly).catch((err) => setError(err.message));
  }, [year]);

  const maxMonthViews = Math.max(...(yearly?.monthly || []).map((m) => m.total_views), 1);

  return (
    <div className="mt-10 rounded-xl border border-gray-200 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Yıllık İstatistikler</h2>
        <select value={year} onChange={(event) => setYear(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm">
          {(yearly?.availableYears || [year]).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-gray-100 p-4">
          <p className="text-2xl font-semibold">{(yearly?.totalViews ?? 0).toLocaleString('tr-TR')}</p>
          <p className="mt-1 text-xs text-gray-500">{year} toplam izlenme</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-4">
          <p className="text-2xl font-semibold">{(yearly?.totalEngagement ?? 0).toLocaleString('tr-TR')}</p>
          <p className="mt-1 text-xs text-gray-500">Toplam etkileşim</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-4">
          <p className="text-2xl font-semibold">{yearly?.projectCount ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">Proje sayısı</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-4">
          <p className="text-2xl font-semibold">{yearly?.videoCount ?? 0}</p>
          <p className="mt-1 text-xs text-gray-500">Video sayısı</p>
        </div>
      </div>

      {yearly?.topProject && (
        <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-4">
          <p className="text-xs font-medium text-gray-500">En çok etkileşim alan proje</p>
          <p className="mt-1 text-lg font-semibold">{yearly.topProject.name}</p>
          <p className="mt-1 text-sm text-gray-600">{yearly.topProject.engagement.toLocaleString('tr-TR')} etkileşim · {yearly.topProject.views.toLocaleString('tr-TR')} izlenme · {yearly.topProject.videoCount} video</p>
        </div>
      )}

      {yearly?.monthly?.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-gray-500">Aylık izlenme dağılımı</p>
          <div className="flex h-24 items-end gap-1.5">
            {yearly.monthly.map((m) => (
              <div key={m.month} className="group relative flex-1">
                <div className="rounded-t bg-gray-900 transition group-hover:bg-gray-700" style={{ height: `${Math.max((m.total_views / maxMonthViews) * 100, 2)}%` }} title={`${m.total_views.toLocaleString('tr-TR')} izlenme`} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1.5 text-[10px] text-gray-400">
            {yearly.monthly.map((m) => <div key={m.month} className="flex-1 text-center">{MONTH_LABELS[Number(m.month) - 1]}</div>)}
          </div>
        </div>
      )}

      {yearly?.projects?.length > 1 && (
        <div className="mt-5">
          <p className="mb-2 text-xs font-medium text-gray-500">Proje bazında etkileşim</p>
          <div className="space-y-2">
            {yearly.projects.slice(0, 6).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700">{p.name}</span>
                <span className="text-gray-500">{p.engagement.toLocaleString('tr-TR')} etkileşim</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {yearly && !yearly.videoCount && <p className="mt-4 text-sm text-gray-400">{year} yılında henüz PR videosu yok.</p>}
    </div>
  );
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const isCompanyAdmin = getCurrentUser()?.adminScope === 'company';
  const earningsSuffix = isCompanyAdmin ? 'ödenecek ücret' : 'TL';
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/reports`, { headers: { Authorization: `Bearer ${localStorage.getItem('locy_token')}` } }).then((res) => res.json()).then(setData).catch((err) => setError(err.message));
  }, []);
  return (
    <Layout title="Raporlar">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-semibold">Raporlar</h1>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[['totalViews', 'Toplam izlenme'], ['videoCount', 'Video sayısı'], ['activeVideoCount', 'Aktif video'], ['unavailableVideoCount', 'Erişilemeyen / silinen'], ['totalEstimatedEarnings', isCompanyAdmin ? 'Ödenecek toplam ücret (TL)' : 'Tahmini toplam kazanç (TL)']].map(([key, label]) => (
            <div key={key} className="rounded-xl border border-gray-200 p-4">
              <p className="text-2xl font-semibold">{data?.summary?.[key] ?? 0}</p>
              <p className="mt-1 text-xs text-gray-500">{label}</p>
            </div>
          ))}
        </div>

        <YearlyStats />

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <ReportList title="En çok izlenenler" rows={data?.topVideos} render={(row) => `${row.influencer_name || 'Bilinmeyen'} · ${row.platform} · ${Number(row.views).toLocaleString('tr-TR')} views · ${Number(row.estimated_earnings ?? 0).toLocaleString('tr-TR')} ${earningsSuffix}`} />
          <ReportList title="Influencer performansı" rows={data?.influencers} render={(row) => `${row.influencer_name || 'Bilinmeyen'} · ${row.video_count} video · ${Number(row.total_views).toLocaleString('tr-TR')} views · ${Number(row.estimated_earnings ?? 0).toLocaleString('tr-TR')} ${earningsSuffix}`} />
          <ReportList title="Proje performansı" rows={data?.projects} render={(row) => `${row.project_name} · ${row.video_count} video · ${Number(row.total_views).toLocaleString('tr-TR')} views · ${Number(row.estimated_earnings ?? 0).toLocaleString('tr-TR')} ${earningsSuffix}`} />
          <ReportList title="Aylık / platform dağılımı" rows={data?.monthly} render={(row) => `${row.month} · ${row.platform} · ${row.video_count} video · ${Number(row.total_views).toLocaleString('tr-TR')} views`} />
        </div>
      </div>
    </Layout>
  );
}

function ReportList({ title, rows = [], render }) {
  return (
    <section className="rounded-xl border border-gray-200 p-4">
      <h2 className="font-medium">{title}</h2>
      <div className="mt-3 space-y-2">
        {rows.length ? rows.map((row, index) => <p key={`${title}-${index}`} className="border-b border-gray-100 pb-2 text-sm text-gray-600">{render(row)}</p>) : <p className="text-sm text-gray-400">Henüz metrik yok.</p>}
      </div>
    </section>
  );
}
