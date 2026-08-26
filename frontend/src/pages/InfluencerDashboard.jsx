import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

export default function InfluencerDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/dashboard/influencer').then(setData).catch((e) => setError(e.message));
  }, []);

  return (
    <Layout title="Influencer Paneli">
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6 max-w-lg">
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-semibold">{data?.totalThisMonth ?? 0} TL</p>
          <p className="text-xs text-gray-500 mt-1">Bu ay aldığım toplam ödeme</p>
        </div>
        <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
          <p className="text-2xl font-semibold">{data?.estimatedEarnings ?? 0} TL</p>
          <p className="text-xs text-gray-500 mt-1">Tahmini kazanç ({(data?.totalViews ?? 0).toLocaleString('tr-TR')} izlenme × {data?.ratePerView ?? 0} TL)</p>
        </div>
      </div>

      <h2 className="text-sm font-medium text-gray-500 mb-3">Ödeme geçmişim</h2>
      <div className="space-y-2">
        {data?.payments?.length ? (
          data.payments.map((p) => (
            <div
              key={p.id}
              className="border border-gray-100 rounded-lg p-3 flex justify-between items-center text-sm hover:bg-gray-50 transition"
            >
              <div>
                <p>{p.note || 'Proje ödemesi'}</p>
                <p className="text-xs text-gray-400">{p.paid_at}</p>
              </div>
              <span className="font-medium">{p.amount} TL</span>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-400">Henüz ödeme kaydı yok.</p>
        )}
      </div>
    </Layout>
  );
}
