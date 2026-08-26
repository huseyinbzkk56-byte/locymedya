import { Link } from 'react-router-dom';

export default function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-5 py-10 text-sm text-slate-400">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <span>LOCYMEDYA</span>
        <Link to="/iletisim" className="transition hover:text-slate-700">İletişim</Link>
        <span>PR / MUSIC / CULTURE</span>
      </div>
    </footer>
  );
}
