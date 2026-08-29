import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SiteFooter from '../components/SiteFooter';
import { InstagramIcon, TikTokIcon } from '../components/PlatformIcons';
import logo from '../assets/logo-crop.png';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const CATEGORY_LABEL = { influencer: 'Influencer', rapmedia: 'Türkçe Rap Medyası', dizi: 'Dizi Edit Sayfası', futbol: 'Futbol Edit', araba: 'Araba Edit' };

function formatFollowers(count) {
  if (count >= 1000000) return `${(count / 1000000).toFixed(count % 1000000 === 0 ? 0 : 1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(count % 1000 === 0 ? 0 : 1)}K`;
  return String(count);
}

function formatCurrency(amount) {
  return `${Number(amount).toLocaleString('tr-TR')} TL`;
}

export default function PublicOffer() {
  const { token } = useParams();
  const [offer, setOffer] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/offers/public/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Bu teklif linki bulunamadı veya artık geçerli değil.' : 'Teklif yüklenemedi.');
        return res.json();
      })
      .then(setOffer)
      .catch((err) => setError(err.message));
  }, [token]);

  if (error) {
    return (
      <div className="site-shell flex min-h-screen flex-col items-center justify-center px-5 text-center">
        <img src={logo} alt="LOCYMEDYA" className="h-10 w-auto max-w-none" />
        <p className="mt-6 max-w-sm text-sm text-slate-500">{error}</p>
        <Link to="/" className="mt-6 text-sm font-medium text-purple-600 hover:text-purple-800">Ana sayfaya dön</Link>
      </div>
    );
  }

  if (!offer) {
    return <div className="site-shell flex min-h-screen items-center justify-center"><p className="text-sm text-slate-400">Yükleniyor...</p></div>;
  }

  const groups = ['rapmedia', 'dizi', 'futbol', 'araba', 'influencer']
    .map((category) => ({ category, items: offer.items.filter((item) => item.category === category) }))
    .filter((group) => group.items.length);

  return (
    <div className="site-shell min-h-screen text-gray-950">
      <header className="border-b border-gray-100 px-5 py-5">
        <div className="mx-auto max-w-6xl">
          <img src={logo} alt="LOCYMEDYA" className="h-9 w-auto max-w-none" />
        </div>
      </header>

      <main id="main-content">
        <section className="offer-hero px-5 py-14">
          <div className="mx-auto max-w-6xl">
            <p className="hero-reveal hero-eyebrow" style={{ background: 'rgba(255,255,255,.08)', borderColor: 'rgba(255,255,255,.14)', color: '#e9d5ff' }}>
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false"><path d="m6 1 .8 3.2L10 5l-3.2.8L6 9l-.8-3.2L2 5l3.2-.8L6 1Z" fill="currentColor" /></svg>
              MEDYA TEKLİFİ
            </p>
            <h1 className="hero-reveal hero-delay mt-5 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">{offer.name}</h1>
            <p className="hero-reveal hero-delay mt-2 text-sm text-slate-300">{offer.clientName} için hazırlandı</p>

            <div className="hero-reveal hero-delay-2 mt-9 grid grid-cols-3 gap-3 sm:max-w-xl sm:gap-4">
              <div className="offer-stat"><p>Toplam Hesap</p><p>{offer.totals.accountCount}</p></div>
              <div className="offer-stat"><p>Toplam Takipçi</p><p>{formatFollowers(offer.totals.totalFollowers)}</p></div>
              <div className="offer-stat"><p>Toplam Bütçe</p><p>{formatCurrency(offer.totals.totalBudget)}</p></div>
            </div>
          </div>
        </section>

        <section className="px-5 py-14">
          <div className="mx-auto max-w-6xl space-y-12">
            {groups.map((group) => (
              <div key={group.category}>
                <p className="offer-platform-label">{CATEGORY_LABEL[group.category]}</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="offer-card card-reveal" style={{ '--reveal-delay': `${Math.min(index * 70, 420)}ms` }}>
                      <p className="offer-card-name">{item.name}</p>
                      <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
                        {item.instagram && <p>Instagram: {formatFollowers(item.instagram.followers)}</p>}
                        {item.tiktok && <p>TikTok: {formatFollowers(item.tiktok.followers)}</p>}
                        {item.instagram && item.tiktok && <p className="font-medium text-gray-700">Toplam: {formatFollowers(item.followers)}</p>}
                      </div>
                      <div className="mt-3 flex gap-2">
                        {item.instagram && (
                          <a href={item.instagram.profileUrl} target="_blank" rel="noreferrer" aria-label={`${item.name} Instagram`} className="offer-platform-icon instagram">
                            <InstagramIcon />
                          </a>
                        )}
                        {item.tiktok && (
                          <a href={item.tiktok.profileUrl} target="_blank" rel="noreferrer" aria-label={`${item.name} TikTok`} className="offer-platform-icon tiktok">
                            <TikTokIcon />
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {!groups.length && <p className="text-sm text-slate-400">Bu teklife henüz hesap eklenmedi.</p>}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
