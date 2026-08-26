import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../api/client';

const STATUS_LABEL = { draft: 'Taslak', sent: 'Gönderildi', archived: 'Arşivlendi' };
const STATUS_STYLE = { draft: 'bg-gray-100 text-gray-600', sent: 'bg-emerald-50 text-emerald-700', archived: 'bg-amber-50 text-amber-700' };

export default function OfferList() {
  const [offers, setOffers] = useState([]);
  const [form, setForm] = useState({ name: '', clientName: '' });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const data = await apiFetch('/offers');
    setOffers(data.offers);
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/offers', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', clientName: '' });
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeOffer(id) {
    if (!window.confirm('Bu teklif kalıcı olarak silinsin mi?')) return;
    try {
      await apiFetch(`/offers/${id}`, { method: 'DELETE' });
      setOffers((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">Müşterilere gönderilecek teklif/link listelerini oluşturun ve yönetin.</p>
        <button onClick={() => setShowForm((current) => !current)} className="inline-flex justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition">
          {showForm ? 'Kapat' : '+ Yeni Teklif'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input required placeholder="Teklif adı (örn. Haziran PR Çalışması)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            <input required placeholder="Müşteri adı (örn. ABC MUSIC)" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
          </div>
          <button disabled={saving} className="mt-3 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition">{saving ? 'Oluşturuluyor...' : 'Teklif Oluştur'}</button>
        </form>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((offer) => (
          <div key={offer.id} className="rounded-xl border border-gray-200 bg-white p-4 transition hover:shadow-md">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-medium text-gray-900">{offer.name}</p>
                <p className="mt-0.5 text-sm text-gray-500">{offer.client_name}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLE[offer.status]}`}>{STATUS_LABEL[offer.status]}</span>
            </div>
            <p className="mt-3 text-xs text-gray-400">{offer.item_count} hesap</p>
            <div className="mt-4 flex gap-3 text-xs">
              <Link to={`/admin/offers/${offer.id}`} className="font-medium text-gray-900 hover:underline">Düzenle</Link>
              <button onClick={() => removeOffer(offer.id)} className="text-red-500 hover:text-red-700">Sil</button>
            </div>
          </div>
        ))}
      </div>
      {!offers.length && <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-400">Henüz teklif oluşturulmadı.</p>}
    </div>
  );
}
