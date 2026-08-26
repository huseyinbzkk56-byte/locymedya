import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { logout, getCurrentUser, apiFetch } from '../api/client';

export default function Layout({ title, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = getCurrentUser();
  const [unreadMessages, setUnreadMessages] = useState(0);

  const isCompanyAdmin = user?.role === 'admin' && user?.adminScope === 'company';

  useEffect(() => {
    if (user?.role !== 'admin' || isCompanyAdmin) return;
    apiFetch('/contact/unread-count').then((data) => setUnreadMessages(data.unreadCount)).catch(() => {});
  }, [user?.role, location.pathname]);

  const menus = {
    admin: [
      ['Dashboard', '/admin'], ['Projeler', '/admin/projects'], ['Rap Medyaları', '/admin/rap-media'],
      ['Influencerlar', '/admin/influencers'], ['Kullanıcılar', '/admin/users'],
      ...(isCompanyAdmin ? [] : [['Şarkılar', '/admin/songs']]),
      ['Videolar', '/admin/videos'], ['Raporlar', '/admin/reports'],
      ...(isCompanyAdmin ? [] : [['Ödemeler', '/admin/payments'], ['Ödeme Kuralları', '/admin/payment-rules']]),
      ['Link Listesi', '/admin/links'],
      ...(isCompanyAdmin ? [] : [['İletişim Mesajları', '/admin/contact-messages']]),
      ['Ayarlar', '/admin/profile']
    ],
    influencer: [['Dashboard', '/influencer'], ['Projelerim', '/influencer/projects'], ['Videolarım', '/influencer/videos'], ['Ödeme Geçmişim', '/influencer'], ['Profil', '/influencer/profile']],
    rapmedia: [['Dashboard', '/rap-media'], ['Atanan Projeler', '/rap-media/projects'], ['Görevler', '/rap-media/projects'], ['Link Ekle', '/rap-media/links'], ['Profil', '/rap-media/profile']]
  };

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="app-shell min-h-screen">
      <header className="app-header border-b border-gray-100 px-4 py-4 sm:px-8">
        <div>
          <p className="text-lg font-semibold tracking-tight">LOCYMEDYA</p>
          <p className="text-xs text-gray-500">{title}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-gray-500">
            {user?.displayName || user?.username}
          </span>
          <button
            onClick={handleLogout}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 active:scale-[0.98] transition"
          >
            Çıkış
          </button>
        </div>
      </header>
      <nav className="app-nav border-b border-gray-100 px-4 py-2 sm:px-8">
        <div className="flex min-w-max gap-1">
          {(menus[user?.role] || []).map(([label, path]) => (
            <Link key={`${label}-${path}`} to={path} className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition ${location.pathname === path ? 'active-nav-link' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
              {label}
              {path === '/admin/contact-messages' && unreadMessages > 0 && (
                <span className="inline-flex min-w-[1.15rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">{unreadMessages}</span>
              )}
            </Link>
          ))}
        </div>
      </nav>
      <main className="app-main px-4 py-6 sm:px-8">{children}</main>
    </div>
  );
}
