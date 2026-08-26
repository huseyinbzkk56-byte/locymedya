import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiFetch, getCurrentUser } from '../api/client';

const EMPTY = { username: '', password: '', role: 'influencer', displayName: '', adminScope: 'full' };
const ROLES = { admin: 'Admin', influencer: 'Influencer', rapmedia: 'Rap Medya' };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isCompanyAdmin = getCurrentUser()?.adminScope === 'company';
  async function load() { setUsers(await apiFetch('/users')); }
  useEffect(() => { load().catch((err) => setError(err.message)); }, []);
  async function submit(event) {
    event.preventDefault(); setLoading(true); setError('');
    try { await apiFetch('/users', { method: 'POST', body: JSON.stringify(form) }); setForm(EMPTY); await load(); } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  async function resetPassword(user) {
    const password = window.prompt(`${user.username} için yeni şifre:`);
    if (!password) return;
    try { await apiFetch(`/users/${user.id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }); } catch (err) { setError(err.message); }
  }
  async function remove(user) {
    if (!window.confirm(`${user.username} silinsin mi?`)) return;
    try { await apiFetch(`/users/${user.id}`, { method: 'DELETE' }); setUsers((current) => current.filter((item) => item.id !== user.id)); } catch (err) { setError(err.message); }
  }
  return <Layout title="Kullanıcılar"><div className="max-w-6xl mx-auto"><h1 className="text-3xl font-semibold tracking-tight">Kullanıcılar</h1><p className="mt-2 text-sm text-gray-500">Rolleri ve giriş hesaplarını yönetin. Şifreler backend'de hash'lenir.</p>{!isCompanyAdmin && <form onSubmit={submit} className="mt-6 grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-5"><input required placeholder="Kullanıcı adı" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" /><input required type="password" placeholder="İlk şifre" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" /><input placeholder="Görünen ad" value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm" /><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm">{Object.entries(ROLES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{form.role === 'admin' ? <select value={form.adminScope} onChange={(event) => setForm({ ...form, adminScope: event.target.value })} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm"><option value="full">Tam yetkili admin</option><option value="company">Şirket hesabı (kısıtlı)</option></select> : <button disabled={loading} className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">Kullanıcı oluştur</button>}{form.role === 'admin' && <button disabled={loading} className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">Kullanıcı oluştur</button>}</form>}{error && <p className="mt-4 text-sm text-red-600">{error}</p>}<div className="mt-6 space-y-2">{users.map((user) => <div key={user.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-medium">{user.display_name || user.username}</p><p className="text-sm text-gray-500">@{user.username} · {user.role === 'admin' ? (user.admin_scope === 'company' ? 'Admin' : 'Creator') : ROLES[user.role]}{user.role === 'admin' && user.admin_scope === 'company' && ' · Şirket hesabı'}</p></div>{!isCompanyAdmin && <div className="flex gap-3 text-sm"><button onClick={() => resetPassword(user)} className="text-gray-600 hover:text-gray-900">Şifre sıfırla</button><button onClick={() => remove(user)} className="text-red-500 hover:text-red-700">Sil</button></div>}</div>)}</div></div></Layout>;
}
