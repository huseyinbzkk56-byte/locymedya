import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const EMPTY = { type: 'rapmedia', name: '', username: '', password: '', passwordAgain: '', phone: '', instagramUrl: '', tiktokUrl: '', xUrl: '', desiredFee: '' };

export default function Register() {
  const [type, setType] = useState('rapmedia');
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const navigate = useNavigate();

  function update(event) { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); }

  async function submit(event) {
    event.preventDefault(); setError('');
    if (form.password !== form.passwordAgain) { setError('Şifreler eşleşmiyor'); return; }
    const response = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, type }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || 'Kayıt oluşturulamadı'); return; }
    setDone(true); window.setTimeout(() => navigate('/login'), 1200);
  }

  return (
    <div className="auth-shell min-h-screen px-4 py-10">
      <form onSubmit={submit} className="auth-card mx-auto w-full max-w-xl rounded-2xl border p-6 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-xs uppercase tracking-[0.2em] text-gray-400">LOCYMEDYA</p><h1 className="mt-2 text-3xl font-semibold">Kayıt Ol</h1></div>
          <div className="flex items-center gap-3"><Link to="/" className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Ana Menü</Link><Link to="/login" className="text-sm text-gray-500 underline">Giriş yap</Link></div>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1"><button type="button" onClick={() => setType('rapmedia')} className={`rounded-lg px-3 py-2 text-sm ${type === 'rapmedia' ? 'bg-white font-medium shadow-sm' : 'text-gray-500'}`}>RAP MEDYASI</button><button type="button" onClick={() => setType('influencer')} className={`rounded-lg px-3 py-2 text-sm ${type === 'influencer' ? 'bg-white font-medium shadow-sm' : 'text-gray-500'}`}>INFLUENCER</button></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <input required name="name" value={form.name} onChange={update} placeholder={type === 'rapmedia' ? 'Rap medya adı' : 'Influencer hesap adı'} className="auth-input rounded-lg border px-3 py-2.5 text-sm" />
          <input required name="username" value={form.username} onChange={update} placeholder="Kullanıcı adı" className="auth-input rounded-lg border px-3 py-2.5 text-sm" />
          <input required minLength="6" type="password" name="password" value={form.password} onChange={update} placeholder="Şifre" className="auth-input rounded-lg border px-3 py-2.5 text-sm" />
          <input required minLength="6" type="password" name="passwordAgain" value={form.passwordAgain} onChange={update} placeholder="Şifre tekrar" className="auth-input rounded-lg border px-3 py-2.5 text-sm" />
          <input name="phone" value={form.phone} onChange={update} placeholder="Telefon numarası" className="auth-input rounded-lg border px-3 py-2.5 text-sm sm:col-span-2" />
          {type === 'rapmedia' ? <><input type="url" name="instagramUrl" value={form.instagramUrl} onChange={update} placeholder="Instagram linki (opsiyonel)" className="auth-input rounded-lg border px-3 py-2.5 text-sm" /><input type="url" name="tiktokUrl" value={form.tiktokUrl} onChange={update} placeholder="TikTok linki (opsiyonel)" className="auth-input rounded-lg border px-3 py-2.5 text-sm" /><input type="url" name="xUrl" value={form.xUrl} onChange={update} placeholder="X linki (opsiyonel)" className="auth-input rounded-lg border px-3 py-2.5 text-sm sm:col-span-2" /></> : <><input type="url" name="tiktokUrl" value={form.tiktokUrl} onChange={update} placeholder="TikTok hesap linki" className="auth-input rounded-lg border px-3 py-2.5 text-sm" /><input type="number" min="0" step="0.01" name="desiredFee" value={form.desiredFee} onChange={update} placeholder="Video başına istediği ücret (TL)" className="auth-input rounded-lg border px-3 py-2.5 text-sm" /></>}
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        {done && <p className="mt-4 text-sm text-green-700">Kayıt tamamlandı. Giriş sayfasına yönlendiriliyorsunuz.</p>}
        <button disabled={done} className="mt-6 w-full rounded-lg bg-slate-950 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">Kayıt Ol</button>
      </form>
    </div>
  );
}