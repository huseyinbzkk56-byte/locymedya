import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';

const CATEGORY_LABEL = { influencer: 'Influencer', rapmedia: 'Türkçe Rap Medyası', dizi: 'Dizi Edit Sayfası', futbol: 'Futbol Edit', araba: 'Araba Edit' };
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function AccountReports() {
  const [month, setMonth] = useState(currentMonth());
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    apiFetch(`/links/account-report?month=${month}`).then(setData).catch((err) => setError(err.message));
  }, [month]);

  async function downloadPdf() {
    setDownloading(true);
    setError('');
    try {
      const response = await fetch(`${API}/links/account-report/pdf?month=${month}`, { headers: { Authorization: `Bearer ${localStorage.getItem('locy_token')}` } });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'PDF oluşturulamadı');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `hesap-raporu-${month}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">Linklere atadığınız hesapların aylık istatistiklerini ayrı ayrı görün.</p>
        <div className="flex items-center gap-2">
          <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
          <button onClick={downloadPdf} disabled={downloading || !data?.accounts?.length} className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition whitespace-nowrap">
            {downloading ? 'Hazırlanıyor...' : '↓ PDF İndir'}
          </button>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {data?.unassignedCount > 0 && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          Bu ay eklenen {data.unassignedCount} link herhangi bir hesaba atanmamış, bu rapora dahil edilmedi. Link eklerken/düzenlerken hesap seçerek dahil edebilirsin.
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-4 py-3">Hesap</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3 text-right">Link</th>
              <th className="px-4 py-3 text-right">İzlenme</th>
              <th className="px-4 py-3 text-right">Beğeni</th>
              <th className="px-4 py-3 text-right">Yorum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(data?.accounts || []).map((row) => (
              <tr key={row.account_id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{row.name}</td>
                <td className="px-4 py-3 text-gray-500">{CATEGORY_LABEL[row.category] || row.category}</td>
                <td className="px-4 py-3 text-right text-gray-500">{row.link_count}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{Number(row.total_views).toLocaleString('tr-TR')}</td>
                <td className="px-4 py-3 text-right text-gray-500">{Number(row.total_likes).toLocaleString('tr-TR')}</td>
                <td className="px-4 py-3 text-right text-gray-500">{Number(row.total_comments).toLocaleString('tr-TR')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!data?.accounts?.length && <p className="p-8 text-center text-sm text-gray-400">{data?.monthLabel || ''} için hesap bazlı veri bulunmuyor.</p>}
      </div>
    </div>
  );
}
