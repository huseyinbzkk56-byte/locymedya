import { Link } from 'react-router-dom';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';

export default function NotFound() {
  return (
    <div className="site-shell flex min-h-screen flex-col text-gray-950">
      <SiteHeader />
      <main id="main-content" className="flex flex-1 flex-col items-center justify-center px-5 pt-[100px] text-center">
        <p className="hero-reveal hero-title text-6xl font-semibold tracking-tight sm:text-7xl">4<span>0</span>4</p>
        <h1 className="hero-reveal hero-delay mt-5 text-xl font-semibold tracking-tight sm:text-2xl">Bu sayfa bulunamadı</h1>
        <p className="hero-reveal hero-delay mt-3 max-w-sm text-sm leading-6 text-slate-500">Aradığınız sayfa kaldırılmış veya hiç var olmamış olabilir. Adresi kontrol edin ya da ana sayfaya dönün.</p>
        <Link to="/" className="hero-reveal hero-delay-2 mt-8 inline-flex rounded-full bg-slate-950 px-7 py-3.5 text-sm font-medium text-white transition hover:-translate-y-1 hover:bg-slate-800">
          ANA SAYFAYA DÖN
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}
