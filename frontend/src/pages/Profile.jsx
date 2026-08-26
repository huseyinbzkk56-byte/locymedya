import { useState } from 'react';
import Layout from '../components/Layout';
import { apiFetch, getCurrentUser, logout } from '../api/client';
import { useNavigate } from 'react-router-dom';

const ROLE_LABEL = { admin: 'Admin', influencer: 'Influencer', rapmedia: 'Rap Medya' };

export default function Profile() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const [userForm, setUserForm] = useState({ currentPassword: '', newUsername: user?.username || '' });
  const [userSaving, setUserSaving] = useState(false);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');

  async function submitPassword(event) {
    event.preventDefault();
    setPwError(''); setPwSuccess('');
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwError('Yeni şifreler eşleşmiyor'); return; }
    setPwSaving(true);
    try {
      await apiFetch('/auth/me/password', { method: 'PUT', body: JSON.stringify({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword }) });
      setPwSuccess('Şifreniz güncellendi.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) { setPwError(err.message); } finally { setPwSaving(false); }
  }

  async function submitUsername(event) {
    event.preventDefault();
    setUserError(''); setUserSuccess('');
    setUserSaving(true);
    try {
      await apiFetch('/auth/me/username', { method: 'PUT', body: JSON.stringify({ currentPassword: userForm.currentPassword, newUsername: userForm.newUsername }) });
      setUserSuccess('Kullanıcı adınız güncellendi. Değişikliğin geçerli olması için tekrar giriş yapmanız gerekiyor.');
      const updated = { ...user, username: userForm.newUsername.trim() };
      localStorage.setItem('locy_user', JSON.stringify(updated));
      setUserForm({ currentPassword: '', newUsername: userForm.newUsername.trim() });
    } catch (err) { setUserError(err.message); } finally { setUserSaving(false); }
  }

  function handleLogoutNow() { logout(); navigate('/login'); }

  return (
    <Layout title="Ayarlar">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="rounded-xl border border-gray-200 p-5">
          <p className="text-xs uppercase tracking-wide text-gray-500">Hesap</p>
          <h1 className="mt-2 text-2xl font-semibold">{user?.displayName || user?.username}</h1>
          <p className="mt-2 text-sm text-gray-500">Kullanıcı adı: {user?.username}</p>
          <p className="mt-1 text-sm text-gray-500">Rol: {isAdmin ? (user?.adminScope === 'company' ? 'Admin (Şirket hesabı)' : 'Creator') : ROLE_LABEL[user?.role] || user?.role}</p>
        </div>

        {isAdmin && (
          <form onSubmit={submitUsername} className="rounded-xl border border-gray-200 p-5">
            <h2 className="font-medium">Kullanıcı adını değiştir</h2>
            <div className="mt-4 space-y-3">
              <input required value={userForm.newUsername} onChange={(e) => setUserForm({ ...userForm, newUsername: e.target.value })} placeholder="Yeni kullanıcı adı" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
              <input required type="password" value={userForm.currentPassword} onChange={(e) => setUserForm({ ...userForm, currentPassword: e.target.value })} placeholder="Mevcut şifreniz" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            </div>
            {userError && <p className="mt-3 text-sm text-red-600">{userError}</p>}
            {userSuccess && <p className="mt-3 text-sm text-green-600">{userSuccess}</p>}
            <button disabled={userSaving} className="mt-4 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{userSaving ? 'Kaydediliyor...' : 'Kullanıcı adını güncelle'}</button>
          </form>
        )}

        <form onSubmit={submitPassword} className="rounded-xl border border-gray-200 p-5">
          <h2 className="font-medium">Şifreni değiştir</h2>
          <div className="mt-4 space-y-3">
            <input required type="password" value={pwForm.currentPassword} onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })} placeholder="Mevcut şifreniz" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            <input required minLength="6" type="password" value={pwForm.newPassword} onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })} placeholder="Yeni şifre (en az 6 karakter)" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
            <input required minLength="6" type="password" value={pwForm.confirmPassword} onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })} placeholder="Yeni şifre (tekrar)" className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm" />
          </div>
          {pwError && <p className="mt-3 text-sm text-red-600">{pwError}</p>}
          {pwSuccess && <p className="mt-3 text-sm text-green-600">{pwSuccess}</p>}
          <button disabled={pwSaving} className="mt-4 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">{pwSaving ? 'Kaydediliyor...' : 'Şifreyi güncelle'}</button>
        </form>

        {(userSuccess || pwSuccess) && <button onClick={handleLogoutNow} className="text-sm text-gray-500 underline hover:text-gray-800">Yeniden giriş yapmak için çıkış yap</button>}
      </div>
    </Layout>
  );
}
