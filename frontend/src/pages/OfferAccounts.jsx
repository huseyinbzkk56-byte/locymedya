import { useEffect, useState } from 'react';
import { apiFetch } from '../api/client';
import { InstagramIcon, TikTokIcon } from '../components/PlatformIcons';

const EMPTY_PLATFORM = { enabled: false, profileUrl: '', followers: '', normalPrice: '', clientPrice: '' };
const EMPTY = { name: '', category: 'influencer', instagram: { ...EMPTY_PLATFORM }, tiktok: { ...EMPTY_PLATFORM } };
const CATEGORY_LABEL = { influencer: 'Influencer', rapmedia: 'Türkçe Rap Medyası', dizi: 'Dizi Edit Sayfası' };

function PlatformFields({ label, icon, value, onChange }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
        <input type="checkbox" checked={value.enabled} onChange={(e) => onChange({ ...value, enabled: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
        {icon} {label}
      </label>
      {value.enabled && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input required type="url" placeholder={`${label} profil linki`} value={value.profileUrl} onChange={(e) => onChange({ ...value, profileUrl: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-2" />
          <input required type="number" min="0" placeholder="Takipçi sayısı" value={value.followers} onChange={(e) => onChange({ ...value, followers: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <input required type="number" min="0" step="0.01" placeholder="Normal fiyat (TL)" value={value.normalPrice} onChange={(e) => onChange({ ...value, normalPrice: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm" />
          <input required type="number" min="0" step="0.01" placeholder="Müşteri fiyatı (TL)" value={value.clientPrice} onChange={(e) => onChange({ ...value, clientPrice: e.target.value })} className="rounded-lg border border-gray-200 px-3 py-2 text-sm sm:col-span-2" />
        </div>
      )}
    </div>
  );
}

function accountToForm(account) {
  const platform = (prefix) => account[`${prefix}_url`]
    ? { enabled: true, profileUrl: account[`${prefix}_url`], followers: account[`${prefix}_followers`], normalPrice: account[`${prefix}_normal_price`], clientPrice: account[`${prefix}_client_price`] }
    : { ...EMPTY_PLATFORM };
  return { name: account.name, category: account.category, instagram: platform('instagram'), tiktok: platform('tiktok') };
}

export default function OfferAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [platform, setPlatform] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (category) params.set('category', category);
    if (platform) params.set('platform', platform);
    const data = await apiFetch(`/offer-accounts?${params.toString()}`);
    setAccounts(data.accounts);
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, [search, category, platform]);

  function resetForm() {
    setForm(EMPTY);
    setEditingId(null);
    setShowForm(false);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.instagram.enabled && !form.tiktok.enabled) { setError('En az bir platform seçmelisiniz'); return; }
    setSaving(true);
    setError('');
    try {
      const path = editingId ? `/offer-accounts/${editingId}` : '/offer-accounts';
      await apiFetch(path, { method: editingId ? 'PUT' : 'POST', body: JSON.stringify(form) });
      resetForm();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(account) {
    setEditingId(account.id);
    setForm(accountToForm(account));
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeAccount(id) {
    if (!window.confirm('Bu hesap silinsin mi?')) return;
    try {
      await apiFetch(`/offer-accounts/${id}`, { method: 'DELETE' });
      setAccounts((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-gray-500">Influencer ve Türkçe Rap Medyası hesaplarının kataloğunu yönetin. Bir hesap Instagram ve TikTok'un ikisine birden sahip olabilir.</p>
        <button onClick={() => { setShowForm((current) => !current); if (editingId) resetForm(); }} className="inline-flex justify-center rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition">
          {showForm ? 'Kapat' : '+ Sayfa Ekle'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <input required placeholder="Hesap / Sayfa adı (örn. @ornekhesap)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">
              <option value="influencer">Influencer</option>
              <option value="rapmedia">Türkçe Rap Medyası</option>
              <option value="dizi">Dizi Edit Sayfası</option>
            </select>
          </div>

          <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Platformlar</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <PlatformFields label="Instagram" icon={<InstagramIcon />} value={form.instagram} onChange={(v) => setForm({ ...form, instagram: v })} />
            <PlatformFields label="TikTok" icon={<TikTokIcon />} value={form.tiktok} onChange={(v) => setForm({ ...form, tiktok: v })} />
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-3">
            <button disabled={saving} className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50 transition">{saving ? 'Kaydediliyor...' : editingId ? 'Güncelle' : 'Kaydet'}</button>
            <button type="button" onClick={resetForm} className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm hover:bg-gray-100">Vazgeç</button>
          </div>
        </form>
      )}

      {!showForm && error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <input placeholder="Hesap veya sayfa adına göre ara..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm sm:max-w-xs" />
        <div className="flex flex-wrap gap-2">
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
            {[['', 'Tümü'], ['influencer', 'Influencer'], ['rapmedia', 'Türkçe Rap Medyası'], ['dizi', 'Dizi Edit Sayfası']].map(([value, label]) => (
              <button key={value} onClick={() => setCategory(value)} className={`rounded-md px-2.5 py-1.5 transition ${category === value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{label}</button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1 text-xs">
            {[['', 'Tümü'], ['instagram', 'Instagram'], ['tiktok', 'TikTok']].map(([value, label]) => (
              <button key={value} onClick={() => setPlatform(value)} className={`rounded-md px-2.5 py-1.5 transition ${platform === value ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>{label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
            <tr>
              <th className="px-4 py-3">Hesap</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Instagram</th>
              <th className="px-4 py-3">TikTok</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {accounts.map((account) => (
              <tr key={account.id} className="transition-colors hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{account.name}</td>
                <td className="px-4 py-3 text-gray-500">{CATEGORY_LABEL[account.category]}</td>
                <td className="px-4 py-3 text-gray-500">
                  {account.instagram_url ? (
                    <span className="inline-flex items-center gap-1.5"><InstagramIcon className="text-pink-500" />{Number(account.instagram_followers).toLocaleString('tr-TR')} · <span className="font-medium text-gray-900">{Number(account.instagram_client_price).toLocaleString('tr-TR')} TL</span></span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {account.tiktok_url ? (
                    <span className="inline-flex items-center gap-1.5"><TikTokIcon className="text-slate-700" />{Number(account.tiktok_followers).toLocaleString('tr-TR')} · <span className="font-medium text-gray-900">{Number(account.tiktok_client_price).toLocaleString('tr-TR')} TL</span></span>
                  ) : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-right"><div className="flex justify-end gap-3 text-xs"><button onClick={() => beginEdit(account)} className="text-gray-500 transition-colors hover:text-gray-900">Düzenle</button><button onClick={() => removeAccount(account.id)} className="text-red-500 transition-colors hover:text-red-700">Sil</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!accounts.length && <p className="p-8 text-center text-sm text-gray-400">Kayıt bulunamadı.</p>}
      </div>
    </div>
  );
}
