import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

const ROLE_LABEL = { influencer: 'Influencer', rapmedia: 'Rap Medya', admin: 'Admin' };
const STATUS_LABEL = { active: 'Aktif', deleted: 'Silinmiş', unreachable: 'Erişilemiyor' };
const STATUS_STYLE = { active: 'bg-emerald-50 text-emerald-700', deleted: 'bg-red-50 text-red-600', unreachable: 'bg-amber-50 text-amber-700' };
const MONTH_LABELS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function monthLabel(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTH_LABELS[m - 1]} ${y}`;
}
function tl(n) {
  return `${Number(n || 0).toLocaleString('tr-TR')} TL`;
}
function num(n) {
  return Number(n || 0).toLocaleString('tr-TR');
}
function formatDate(value) {
  if (!value) return '—';
  return new Date(value.replace(' ', 'T')).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function SummaryCard({ label, value, accent }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}>
      <p className={`text-2xl font-semibold ${accent ? 'text-emerald-800' : 'text-gray-900'}`}>{value}</p>
      <p className={`mt-1 text-xs ${accent ? 'text-emerald-600' : 'text-gray-500'}`}>{label}</p>
    </div>
  );
}

export default function VideoReportDetail() {
  const { ownerId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/videos/owner-report/${ownerId}`).then(setData).catch((err) => setError(err.message));
  }, [ownerId]);

  if (error) {
    return (
      <Layout title="Hesap Detayı">
        <div className="max-w-5xl mx-auto">
          <Link to="/admin/video-reports" className="text-sm text-gray-500 hover:text-gray-900">← Video Raporları</Link>
          <p className="mt-6 text-sm text-red-600">{error}</p>
        </div>
      </Layout>
    );
  }
  if (!data) return <Layout title="Hesap Detayı"><div className="max-w-5xl mx-auto text-sm text-gray-400">Yükleniyor...</div></Layout>;

  const { owner, summary, monthly, projects, videos } = data;

  return (
    <Layout title={owner.name}>
      <div className="max-w-6xl mx-auto">
        <Link to="/admin/video-reports" className="text-sm text-gray-500 hover:text-gray-900">← Video Raporları</Link>
        <div className="mt-3">
          <h1 className="text-3xl font-semibold tracking-tight">{owner.name}</h1>
          <p className="mt-1 text-sm text-gray-500">{ROLE_LABEL[owner.role] || owner.role}{owner.username ? ` · @${owner.username}` : ''}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <SummaryCard label="Bu Ay İzlenme" value={num(summary.monthViews)} />
          <SummaryCard label="Bu Ay Kazanç" value={tl(summary.monthPayment)} accent />
          <SummaryCard label="Toplam İzlenme" value={num(summary.totalViews)} />
          <SummaryCard label="Toplam Kazanç" value={tl(summary.totalPayment)} accent />
          <SummaryCard label="Proje Sayısı" value={summary.projectCount} />
          <SummaryCard label="Video Sayısı" value={summary.videoCount} />
        </div>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Aylık Rapor</h2>
          <div className="mt-3 space-y-2">
            {monthly.map((row) => (
              <div key={row.month} className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="font-medium text-gray-900">{monthLabel(row.month)}</p>
                <div className="flex flex-wrap gap-5 text-sm">
                  <span className="text-gray-500">İzlenme: <strong className="text-gray-900">{num(row.total_views)}</strong></span>
                  <span className="text-gray-500">Ödenecek: <strong className="text-emerald-700">{tl(row.total_payment)}</strong></span>
                  <span className="text-gray-500">Video: <strong className="text-gray-900">{row.video_count}</strong></span>
                  <span className="text-gray-500">Proje: <strong className="text-gray-900">{row.project_count}</strong></span>
                </div>
              </div>
            ))}
            {!monthly.length && <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">Henüz veri yok.</p>}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Proje Katkıları</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-3">Proje</th>
                  <th className="px-4 py-3 text-right">Video Sayısı</th>
                  <th className="px-4 py-3 text-right">İzlenme</th>
                  <th className="px-4 py-3 text-right">Kazanç</th>
                  <th className="px-4 py-3 text-right">Katkı Oranı</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {projects.map((p) => (
                  <tr key={p.project_id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.project_name}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{p.video_count} video</td>
                    <td className="px-4 py-3 text-right text-gray-900">{num(p.total_views)} izlenme</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{tl(p.total_payment)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">%{p.contribution_percent}</td>
                  </tr>
                ))}
                {!projects.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Henüz proje katkısı yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 mb-10">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Videolar</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                <tr>
                  <th className="px-4 py-3">Video / Link</th>
                  <th className="px-4 py-3">Proje</th>
                  <th className="px-4 py-3">Yüklenme</th>
                  <th className="px-4 py-3 text-right">Başlangıç</th>
                  <th className="px-4 py-3 text-right">Güncel</th>
                  <th className="px-4 py-3 text-right">Kazandırdığı</th>
                  <th className="px-4 py-3 text-right">Ödenecek</th>
                  <th className="px-4 py-3">Son Kontrol</th>
                  <th className="px-4 py-3">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {videos.map((v) => (
                  <tr key={v.id} className="transition-colors hover:bg-gray-50">
                    <td className="px-4 py-3"><a href={v.url} target="_blank" rel="noreferrer" className="capitalize text-gray-900 underline decoration-gray-300 hover:decoration-gray-900">{v.platform}</a></td>
                    <td className="px-4 py-3 text-gray-500">{v.project_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(v.created_at)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{num(v.start_views)}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">{num(v.current_views)}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{num(v.gained_views)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{tl(v.payment)}</td>
                    <td className="px-4 py-3 text-gray-500">{v.last_checked_at ? formatDate(v.last_checked_at) : '—'}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[v.status]}`}>{STATUS_LABEL[v.status]}</span></td>
                  </tr>
                ))}
                {!videos.length && <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Henüz video yok.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
}
