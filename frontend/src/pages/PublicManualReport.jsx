import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import SiteFooter from '../components/SiteFooter';
import { PlatformIcon } from '../utils/platform';
import logo from '../assets/logo-crop.png';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function formatCompact(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}M`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}B`;
  return n.toLocaleString('tr-TR');
}
function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function PublicManualReport() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API}/manual-reports/public/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? 'Bu rapor linki bulunamadı veya artık geçerli değil.' : 'Rapor yüklenemedi.');
        return res.json();
      })
      .then(setData)
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
  if (!data) return <div className="site-shell flex min-h-screen items-center justify-center"><p className="text-sm text-slate-400">Yükleniyor...</p></div>;

  const { report, summary, videos, images = [], brand } = data;

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
              {brand?.title || 'PROJE RAPORU'}
            </p>
            <h1 className="hero-reveal hero-delay mt-5 max-w-2xl text-3xl font-bold tracking-tight text-white sm:text-4xl">{report.song_name || report.name}</h1>
            <p className="hero-reveal hero-delay mt-2 text-sm text-slate-300">
              {[report.artist_name, report.report_date ? formatDate(report.report_date) : null].filter(Boolean).join(' · ')}
            </p>

            <div className="hero-reveal hero-delay-2 mt-9 grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-4 sm:gap-4">
              <div className="offer-stat"><p>Toplam Video</p><p>{summary.videoCount}</p></div>
              <div className="offer-stat"><p>Görüntülenme</p><p>{formatCompact(summary.totals.views)}</p></div>
              <div className="offer-stat"><p>Beğeni</p><p>{formatCompact(summary.totals.likes)}</p></div>
              <div className="offer-stat"><p>Yorum</p><p>{formatCompact(summary.totals.comments)}</p></div>
            </div>
          </div>
        </section>

        <section className="px-5 py-14">
          <div className="mx-auto max-w-6xl space-y-12">
            {summary.pages.length > 0 && (
              <div>
                <p className="offer-platform-label">Sayfa Performansları</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {summary.pages.map((page, index) => (
                    <div key={page.pageName} className="offer-card card-reveal" style={{ '--reveal-delay': `${Math.min(index * 70, 420)}ms` }}>
                      <p className="offer-card-name">@{page.pageName}</p>
                      <div className="mt-1.5 space-y-0.5 text-xs text-gray-500">
                        <p>{page.videoCount} video</p>
                        <p className="font-medium text-gray-700">{formatCompact(page.views)} görüntülenme</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="offer-platform-label">Video Detayları</p>
              <div className="mt-4 overflow-x-auto rounded-xl border border-gray-100">
                <table className="min-w-full divide-y divide-gray-100 text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Sayfa</th>
                      <th className="px-4 py-3">Platform</th>
                      <th className="px-4 py-3 text-right">İzlenme</th>
                      <th className="px-4 py-3 text-right">Beğeni</th>
                      <th className="px-4 py-3 text-right">Yorum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {videos.map((v) => (
                      <tr key={v.id} className="transition-colors hover:bg-gray-50">
                        <td className="px-4 py-3"><a href={v.url} target="_blank" rel="noreferrer" className="font-medium text-gray-900 underline decoration-gray-300 hover:decoration-gray-900">@{v.page_name}</a></td>
                        <td className="px-4 py-3 text-gray-500"><span className="inline-flex items-center gap-1.5"><PlatformIcon platform={v.platform} className="h-3.5 w-3.5" /> {v.platform === 'instagram' ? 'Instagram' : 'TikTok'}</span></td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">{formatCompact(v.views)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{v.likes === null ? 'Gizli' : formatCompact(v.likes)}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{formatCompact(v.comments)}</td>
                      </tr>
                    ))}
                    {!videos.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Henüz veri yok.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {images?.length > 0 && (
              <div>
                <p className="offer-platform-label">Ses Performansları</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map((img, index) => (
                    <a key={img.id} href={img.image_url} target="_blank" rel="noreferrer" className="offer-card card-reveal block overflow-hidden !p-0" style={{ '--reveal-delay': `${Math.min(index * 70, 420)}ms` }}>
                      <img src={img.image_url} alt="" className="aspect-video w-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {report.note && (
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-5 text-sm text-gray-600">{report.note}</div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
