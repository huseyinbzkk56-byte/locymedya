import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '../assets/logo-crop.png';

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 12);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
    <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-sm focus:text-white">İçeriğe atla</a>
    <header className={`home-header fixed inset-x-0 top-0 z-20 h-24 border-b pl-1 pr-2 backdrop-blur-md overflow-hidden ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between">
        <Link to="/" className="hero-reveal flex h-full min-w-0 items-center py-[22px]">
          <span className="block h-full w-[220px] max-w-[30vw] overflow-hidden sm:max-w-none">
            <img src={logo} alt="LOCYMEDYA" className="h-full w-full object-contain object-left" />
          </span>
        </Link>
        <nav className="hidden gap-6 text-sm text-slate-600 md:flex">
          <Link to="/#top" className="transition hover:text-slate-950">Ana Sayfa</Link>
          <Link to="/#songs" className="transition hover:text-slate-950">Şarkılar</Link>
          <Link to="/iletisim" className="transition hover:text-slate-950">İletişim</Link>
          <Link to="/login" className="transition hover:text-slate-950">Giriş Yap</Link>
        </nav>
        <Link to="/login" className="rounded-full border border-slate-300 px-4 py-2 text-xs text-slate-700 md:hidden">Giriş Yap</Link>
      </div>
    </header>
    </>
  );
}
