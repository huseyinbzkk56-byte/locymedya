import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

const ROLE_LABEL = { influencer: 'Influencer', rapmedia: 'Rap Medya', admin: 'Admin' };

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function VideoReports() {
  const [month, setMonth] = useState(currentMonth());
  const [owners, setOwners] = useState([]);
  const [ratePerView, setRatePerView] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/videos/owner-report?month=${month}`)
      .then((data) => { setOwners(data.owners); setRatePerView(data.ratePerView); })
      .catch((err) => setError(err.message));
  }, [month]);

  const totalPayment = owners.reduce((sum, row) => sum + (row.estimated_payment || 0), 0);

  return (
    <Layout title="Video Raporları">
      <div className="max-w-5xl mx-auto">
        <Link to="/admin" className="text-sm text-gray-500 hover:text-gray-900">← Admin paneli</Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Video Raporları</h1>
            <p className="mt-2 text-sm text-gray-500">Bu ay kimin kaç video paylaştığını, toplam izlenmesini ve ödenecek tutarı görün. Projesi silinmiş linkler dahil edilmez.</p>
          </div>
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
        </div>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        {owners.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-2xl font-semibold">{owners.length}</p><p className="text-xs text-gray-500 mt-1">Kişi</p></div>
            <div className="rounded-xl border border-gray-200 bg-white p-4"><p className="text-2xl font-semibold">{ratePerView.toLocaleString('tr-TR', { maximumFractionDigits: 4 })} TL</p><p className="text-xs text-gray-500 mt-1">İzlenme Başına Ücret</p></div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-2xl font-semibold text-emerald-800">{totalPayment.toLocaleString('tr-TR')} TL</p><p className="text-xs text-emerald-600 mt-1">Toplam Ödenecek Tutar</p></div>
          </div>
        )}

        <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-4 py-3">Kişi</th>
                <th className="px-4 py-3">Rol</th>
                <th className="px-4 py-3 text-right">Video</th>
                <th className="px-4 py-3 text-right">İzlenme</th>
                <th className="px-4 py-3 text-right">Beğeni</th>
                <th className="px-4 py-3 text-right">Yorum</th>
                <th className="px-4 py-3 text-right">Ödenecek Tutar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {owners.map((row) => (
                <tr key={row.owner_id ?? 'unknown'} className="transition-colors hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{row.owner_name}</td>
                  <td className="px-4 py-3 text-gray-500">{ROLE_LABEL[row.role] || '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{row.video_count}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">{Number(row.total_views).toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{Number(row.total_likes).toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{Number(row.total_comments).toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700">{Number(row.estimated_payment || 0).toLocaleString('tr-TR')} TL</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!owners.length && <p className="p-8 text-center text-sm text-gray-400">Bu ay için video kaydı bulunmuyor.</p>}
        </div>
      </div>
    </Layout>
  );
}
