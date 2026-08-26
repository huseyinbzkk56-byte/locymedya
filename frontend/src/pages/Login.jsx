import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api/client';
import { Link } from 'react-router-dom';

const ROLE_HOME = {
  admin: '/admin',
  influencer: '/influencer',
  rapmedia: '/rap-media'
};

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(username, password);
      navigate(ROLE_HOME[user.role] || '/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-shell min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="auth-card w-full max-w-sm rounded-2xl border p-8"
      >
        <h1 className="text-2xl font-semibold tracking-tight text-center mb-1">LOCYMEDYA</h1>
        <p className="text-sm text-gray-500 text-center mb-6">Hesabınıza giriş yapın</p>

        <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı adı</label>
        <input
          className="auth-input w-full mb-4 rounded-lg border px-3 py-2 outline-none transition"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
        <input
          type="password"
          className="auth-input w-full mb-6 rounded-lg border px-3 py-2 outline-none transition"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-slate-950 py-2.5 font-medium text-white hover:bg-slate-800 active:scale-[0.98] transition disabled:opacity-50"
        >
          {loading ? 'Giriş yapılıyor...' : 'Giriş yap'}
        </button>
        <Link to="/" className="mt-3 flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50">Ana Menü</Link>
        <p className="mt-5 text-center text-sm text-gray-500">Hesabın yok mu? <Link to="/register" className="font-medium text-gray-900 underline">KAYIT OL</Link></p>
      </form>
    </div>
  );
}
