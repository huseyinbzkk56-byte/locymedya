import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

const CARD_LABELS = {
  activeProjects: 'Aktif PR Projesi',
  completedProjects: 'Tamamlanan Proje',
  totalInfluencers: 'Influencer',
  totalMediaAccounts: 'Rap Medya Hesabı',
  totalArtists: 'Sanatçı',
  totalVideos: 'Aktif Video/Link',
  totalViews: 'Toplam İzlenme',
  totalPaid: 'Yapılan Ödeme (TL)',
  estimatedEarnings: 'Tahmini Kazanç (TL)'
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/dashboard/admin').then(setStats).catch((e) => setError(e.message));
  }, []);

  return (
    <Layout title="Admin Paneli">
      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats &&
          Object.entries(CARD_LABELS).map(([key, label]) => (
            <div
              key={key}
              className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <p className="text-2xl font-semibold">{stats[key] ?? 0}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
      </div>

      <div className="mt-10 border border-dashed border-gray-200 rounded-xl p-6 text-sm text-gray-400">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div>
              <p className="text-gray-900 font-medium">PR çalışma alanı</p>
              <p className="mt-1">Projeleri ve sosyal medya çalışmalarını ayrı akışlarda yönetin.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/admin/projects" className="inline-flex justify-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition">Projeler</Link>
              <Link to="/admin/links" className="inline-flex justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-100 transition">Link Listesi</Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
