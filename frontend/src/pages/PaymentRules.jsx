import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

const EXAMPLES = [1, 1000, 10000, 100000, 1000000];

function formatTl(amount) {
  return `${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} TL`;
}

export default function PaymentRules() {
  const [rate, setRate] = useState(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function load() {
    const data = await apiFetch('/payment-rules');
    setRate(data.ratePerView);
    setDraft(String(data.ratePerView));
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const data = await apiFetch('/payment-rules', { method: 'PUT', body: JSON.stringify({ ratePerView: Number(draft) }) });
      setRate(data.ratePerView);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const previewRate = Number(draft) || 0;

  return (
    <Layout title="Ödeme Kuralları">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold">Ödeme Kuralları</h1>
        <p className="mt-2 text-sm text-gray-500">
          Sistemdeki tüm izlenme bazlı kazanç hesaplamaları (video kazançları, influencer tahmini kazancı, raporlar)
          bu tek orandan otomatik hesaplanır. Oranı değiştirdiğinde tüm sistemde anında geçerli olur.
        </p>

        <form onSubmit={submit} className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-5">
          <label className="block text-sm font-medium text-gray-700">İzlenme başına ödeme (TL)</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              required
              type="number"
              min="0"
              step="0.0001"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="w-full max-w-xs rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm sm:w-48"
            />
            <button disabled={saving} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition">
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            {saved && <span className="fade-in-fast text-sm text-emerald-600">Kaydedildi ✓</span>}
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {rate !== null && (
            <p className="mt-4 text-sm text-gray-600">
              Şu anki oran: <strong>İzlenme başına ödeme: {formatTl(rate)}</strong>
            </p>
          )}
        </form>

        <h2 className="mt-8 text-sm font-medium text-gray-500">Örnek hesaplamalar</h2>
        <div className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
              <tr><th className="px-4 py-3">İzlenme</th><th className="px-4 py-3">Ödeme</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {EXAMPLES.map((views) => (
                <tr key={views}>
                  <td className="px-4 py-3 text-gray-600">{views.toLocaleString('tr-TR')}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatTl(views * previewRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-400">Hesaplama: izlenme × {formatTl(previewRate)} = ödeme. Bu tablo, aşağıdaki oran kaydedilmeden önce anlık önizlemedir.</p>
      </div>
    </Layout>
  );
}
