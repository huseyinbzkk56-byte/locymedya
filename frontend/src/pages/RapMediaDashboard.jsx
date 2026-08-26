import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

export default function RapMediaDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/dashboard/rapmedia').then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <Layout title="Rap Medya Paneli">
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6 max-w-lg">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-semibold">{data?.totalThisMonth ?? 0} TL</p>
          <p className="text-xs text-gray-500 mt-1">Bu ay aldığım toplam ödeme</p>
        </div>
      </div>

      <h2 className="text-sm font-medium text-gray-500 mb-3">Atandığım PR projeleri</h2>
      <div className="space-y-2">
        {data?.projects?.length ? (
          data.projects.map((p) => (
            <div key={p.id} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition">
              <p className="font-medium">{p.name}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400">Henüz bir projeye atanmadınız.</p>
        )}
      </div>

      <h2 className="mt-8 text-sm font-medium text-gray-500 mb-3">Ödeme geçmişim</h2>
      <div className="space-y-2">
        {data?.payments?.length ? (
          data.payments.map((p) => (
            <div key={p.id} className="border border-gray-100 rounded-lg p-3 flex justify-between items-center text-sm hover:bg-gray-50 transition">
              <div>
                <p>{p.project_name || p.note || 'Proje ödemesi'}</p>
                <p className="text-xs text-gray-400">{p.paid_at}</p>
              </div>
              <span className="font-medium">{p.amount} TL</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400">Henüz ödeme kaydı yok.</p>
        )}
      </div>

      <div className="mt-8 border border-dashed border-gray-200 rounded-xl p-6 text-sm text-gray-400">
        Instagram/TikTok link ekleme özelliği bir sonraki aşamada bu panele eklenecek.
      </div>
    </Layout>
  );
}
