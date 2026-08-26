import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

const EMPTY = { payeeId: '', projectId: '', amount: '', paidAt: new Date().toISOString().slice(0, 10), note: '', status: 'paid' };
const TABS = [['influencer', 'İnfluencerlar'], ['rapmedia', 'Türkçe Rap Medyası']];
const STATUS_LABEL = { paid: 'Ödendi', pending: 'Bekliyor', cancelled: 'İptal' };

export default function Payments() {
  const [data, setData] = useState({ payments: [], influencers: [], mediaAccounts: [], projects: [] });
  const [tab, setTab] = useState('influencer');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  async function load() { setData(await apiFetch('/payments')); }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);

  function resetForm() { setForm(EMPTY); }

  async function submit(event) {
    event.preventDefault();
    setError('');
    try {
      const body = {
        influencerId: tab === 'influencer' ? form.payeeId : null,
        mediaAccountId: tab === 'rapmedia' ? form.payeeId : null,
        projectId: form.projectId,
        amount: form.amount,
        paidAt: form.paidAt,
        note: form.note,
        status: form.status
      };
      await apiFetch('/payments', { method: 'POST', body: JSON.stringify(body) });
      resetForm();
      await load();
    } catch (err) { setError(err.message); }
  }

  async function remove(id) {
    if (!window.confirm('Ödeme kaydı silinsin mi?')) return;
    await apiFetch(`/payments/${id}`, { method: 'DELETE' });
    setData((current) => ({ ...current, payments: current.payments.filter((item) => item.id !== id) }));
  }

  const payeeOptions = tab === 'influencer' ? data.influencers : data.mediaAccounts;
  const filteredPayments = data.payments.filter((p) => p.payee_type === tab);

  return (
    <Layout title="Ödemeler">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-semibold">Ödemeler</h1>
        <p className="mt-2 text-sm text-gray-500">Sadece gerçekten yapılan manuel ödemeleri kaydedin. Otomatik hak ediş hesaplanmaz.</p>

        <div className="mt-6 flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm w-fit">
          {TABS.map(([value, label]) => (
            <button key={value} onClick={() => { setTab(value); resetForm(); }} className={`rounded-md px-3.5 py-2 transition ${tab === value ? 'bg-white shadow-sm font-medium text-gray-900' : 'text-gray-500 hover:text-gray-800'}`}>{label}</button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <select required value={form.payeeId} onChange={(event) => setForm({ ...form, payeeId: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
            <option value="">{tab === 'influencer' ? 'Influencer' : 'Rap Medyası'}</option>
            {payeeOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select required value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
            <option value="">Proje</option>
            {data.projects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <input required type="number" min="0" step="0.01" placeholder="Tutar (TL)" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
          <input type="date" value={form.paidAt} onChange={(event) => setForm({ ...form, paidAt: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
            <option value="paid">Ödendi</option>
            <option value="pending">Bekliyor</option>
            <option value="cancelled">İptal</option>
          </select>
          <input placeholder="Açıklama" value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
          <button className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white">Ödeme kaydet</button>
        </form>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 space-y-2">
          {filteredPayments.map((payment) => (
            <div key={payment.id} className="flex flex-col gap-2 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{payment.payee_name || 'Bilinmeyen'} · {payment.project_name}</p>
                <p className="text-sm text-gray-500">{payment.paid_at} · {payment.note || 'Açıklama yok'} · {STATUS_LABEL[payment.status]}</p>
              </div>
              <div className="flex items-center gap-4">
                <strong>{Number(payment.amount).toLocaleString('tr-TR')} TL</strong>
                <button onClick={() => remove(payment.id)} className="text-sm text-red-500">Sil</button>
              </div>
            </div>
          ))}
          {!filteredPayments.length && <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">{tab === 'influencer' ? 'Henüz influencer ödemesi yok.' : 'Henüz rap medyası ödemesi yok.'}</p>}
        </div>
      </div>
    </Layout>
  );
}
