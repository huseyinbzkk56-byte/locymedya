import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { apiFetch } from '../api/client';

const STATUS_LABEL = { active: 'Aktif', deleted: 'Silinmiş', unreachable: 'Erişilemiyor' };
const STATUS_STYLE = { active: 'bg-emerald-50 text-emerald-700', deleted: 'bg-red-50 text-red-600', unreachable: 'bg-amber-50 text-amber-700' };

function VideoMetrics({ video }) {
  if (video.views === null || video.views === undefined) return <p className="mt-1 text-xs text-gray-400">Henüz veri yok — "Metrikleri yenile"ye basın</p>;
  const likesText = video.likes === null || video.likes === undefined ? 'Gizli' : Number(video.likes).toLocaleString('tr-TR');
  return <p className="mt-1 text-xs text-gray-600">İzlenme: <strong>{Number(video.views).toLocaleString('tr-TR')}</strong> · Beğeni: <strong>{likesText}</strong> · Yorum: <strong>{Number(video.comments ?? 0).toLocaleString('tr-TR')}</strong> · Tahmini kazanç: <strong className="text-emerald-700">{Number(video.earning ?? 0).toLocaleString('tr-TR')} TL</strong></p>;
}

export default function MyVideos() { const [videos, setVideos] = useState([]); const [error, setError] = useState(''); async function load() { setVideos((await apiFetch('/videos')).videos); } useEffect(() => { load().catch((err) => setError(err.message)); }, []); async function refresh(id) { try { await apiFetch(`/videos/${id}/refresh`, { method: 'POST' }); await load(); } catch (err) { setError(err.message); } } return <Layout title="Videolarım"><div className="max-w-5xl mx-auto"><h1 className="text-3xl font-semibold">Videolarım</h1><p className="mt-2 text-sm text-gray-500">Yalnızca hesabınıza bağlı video ve metrikler görünür.</p>{error && <p className="mt-4 text-sm text-red-600">{error}</p>}<div className="mt-6 space-y-2">{videos.map((video) => <div key={video.id} className={`flex flex-col gap-3 rounded-xl border border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between transition ${video.status !== 'active' ? 'opacity-55 grayscale-[35%]' : ''}`}><div className="min-w-0"><p className="flex flex-wrap items-center gap-2 font-medium"><span className="capitalize">{video.platform}</span><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[video.status]}`}>{STATUS_LABEL[video.status]}</span></p><a href={video.url} target="_blank" rel="noreferrer" className="block truncate text-sm text-gray-500 underline">{video.url}</a><VideoMetrics video={video} /></div><button onClick={() => refresh(video.id)} className="shrink-0 rounded-lg border border-gray-200 px-3 py-2 text-sm">Metrikleri yenile</button></div>)}{!videos.length && <p className="text-sm text-gray-400">Henüz video yok.</p>}</div></div></Layout>; }
