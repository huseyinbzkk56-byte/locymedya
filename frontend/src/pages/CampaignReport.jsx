import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiFetch } from '../api/client';
import { PLATFORMS, PlatformIcon } from '../utils/platform';

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const TABS = [['overview', 'Genel Bakış'], ['creators', 'İçerik Üreticileri'], ['videos', 'İçerikler']];
const STATUS_LABEL = { draft: 'Taslak', active: 'Aktif', completed: 'Tamamlandı', cancelled: 'İptal' };
const GOLD = '#D4A954';

function formatCompact(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mn`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} B`;
  return n.toLocaleString('tr-TR');
}

function formatPercent(value) {
  return `%${Number(value || 0).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`;
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
}

const AVATAR_COLORS = ['#D4A954', '#6E9BD1', '#8FB584', '#C77B5E', '#9B87C4', '#5EA8A0'];
function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ name, size = 36 }) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <div
      className="flex flex-none items-center justify-center rounded-full border-2 border-[#0C0C10] font-semibold text-white"
      style={{ width: size, height: size, background: colorFor(name || ''), fontSize: size * 0.4 }}
      title={name}
    >
      {initial}
    </div>
  );
}

function MetricPill({ value, label }) {
  return (
    <div className="min-w-[104px] rounded-lg border border-white/10 px-4 py-3">
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function RankRow({ rank, name, sub, value, share }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="w-5 flex-none font-mono text-xs text-slate-600">{String(rank).padStart(2, '0')}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between text-sm">
          <span className="truncate text-slate-200">{name}</span>
          <span className="ml-2 flex-none font-medium text-white">{value}</span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <div className="h-full rounded-full" style={{ width: `${Math.max(share, 2)}%`, background: GOLD }} />
        </div>
      </div>
      {sub}
    </div>
  );
}

function ContributionBar({ likes, comments, shares }) {
  const total = likes + comments + shares || 1;
  const segs = [
    { label: 'Beğeni', value: likes, color: GOLD },
    { label: 'Yorum', value: comments, color: '#6E9BD1' },
    { label: 'Paylaşım', value: shares, color: '#5EA8A0' }
  ];
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.06]">
        {segs.map((s) => s.value > 0 && (
          <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {segs.map((s) => (
          <div key={s.label}>
            <div className="flex items-center gap-1.5 text-xs text-slate-400"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</div>
            <div className="mt-1 text-lg font-bold text-white">{formatCompact(s.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricColumns({ views, likes, comments, shares }) {
  const bars = [
    { label: 'İzlenme', value: views, color: GOLD },
    { label: 'Beğeni', value: likes, color: '#C77B5E' },
    { label: 'Yorum', value: comments, color: '#6E9BD1' },
    { label: 'Paylaşım', value: shares, color: '#5EA8A0' }
  ];
  const maxSqrt = Math.sqrt(Math.max(...bars.map((b) => b.value), 1));
  return (
    <div className="flex h-48 items-end justify-around gap-6 sm:gap-10">
      {bars.map((b) => {
        const fraction = b.value > 0 ? Math.max(Math.sqrt(b.value) / maxSqrt, 0.06) : 0;
        return (
          <div key={b.label} className="flex h-full flex-1 flex-col items-center justify-end">
            <div className="text-sm font-bold text-white">{formatCompact(b.value)}</div>
            <div className="mt-1.5 w-full max-w-[64px] rounded-t transition-all" style={{ height: `${fraction * 100}%`, background: b.color, minHeight: b.value > 0 ? 4 : 0 }} />
            <div className="mt-2 text-[11px] uppercase tracking-wider text-slate-500">{b.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function GrowthBars({ growth }) {
  if (growth.length < 2) return <p className="text-sm text-slate-500">En az iki günlük veri gerektiğinden büyüme henüz hesaplanamıyor.</p>;
  const values = growth.map((g) => g.total_views);
  const max = Math.max(...values, 1);
  const multiplier = values[0] > 0 ? values[values.length - 1] / values[0] : null;
  return (
    <div>
      <div className="flex items-end gap-6">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">İlk Ölçüm</div>
          <div className="text-xl font-bold text-white">{formatCompact(values[0])}</div>
        </div>
        <div className="pb-0.5 text-slate-600">→</div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Son Ölçüm</div>
          <div className="text-xl font-bold text-white">{formatCompact(values[values.length - 1])}</div>
        </div>
        {multiplier !== null && (
          <div className="ml-auto rounded-full px-3 py-1 text-xs font-semibold" style={{ background: `${GOLD}22`, color: GOLD }}>
            {multiplier >= 1 ? '+' : ''}{((multiplier - 1) * 100).toLocaleString('tr-TR', { maximumFractionDigits: 0 })}%
          </div>
        )}
      </div>
      <div className="mt-5 flex h-32 items-end gap-1.5">
        {growth.map((g, i) => (
          <div key={i} className="group relative flex-1">
            <div className="rounded-t transition group-hover:opacity-80" style={{ height: `${Math.max((g.total_views / max) * 100, 3)}%`, background: GOLD }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-500">
        <span>{formatDate(growth[0].day)}</span>
        <span>{formatDate(growth[growth.length - 1].day)}</span>
      </div>
    </div>
  );
}

function PlatformChip({ platform, href }) {
  const config = PLATFORMS[platform] || PLATFORMS.web;
  const className = 'inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-200 transition' + (href ? ' hover:border-white/30 hover:text-white' : '');
  const content = (
    <>
      <PlatformIcon platform={platform} className="h-3 w-3" style={{ color: config.accent }} />
      {config.label}
    </>
  );
  if (href) {
    return <a href={href} target="_blank" rel="noreferrer" className={className}>{content}</a>;
  }
  return <span className={className}>{content}</span>;
}

export default function CampaignReport() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [downloading, setDownloading] = useState(false);
  const [generatedAt] = useState(() => new Date());

  useEffect(() => {
    apiFetch(`/campaign-reports/${id}`).then(setData).catch((err) => setError(err.message));
  }, [id]);

  async function downloadPdf() {
    setDownloading(true);
    setError('');
    try {
      const response = await fetch(`${API}/campaign-reports/${id}/pdf`, { headers: { Authorization: `Bearer ${localStorage.getItem('locy_token')}` } });
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || 'PDF oluşturulamadı');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `kampanya-raporu-${id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setDownloading(false);
    }
  }

  const platformsInCampaign = useMemo(() => data ? [...new Set(data.videos.map((v) => v.platform))] : [], [data]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#0C0C10] p-8 text-white">
        <Link to="/admin/projects" className="text-sm text-slate-400 hover:text-white">← Projeler</Link>
        <p className="mt-6 text-sm text-red-400">{error}</p>
      </div>
    );
  }
  if (!data) return <div className="min-h-screen bg-[#0C0C10] p-8 text-sm text-slate-400">Yükleniyor...</div>;

  const { project, totals, creators, topVideo, videos, growth } = data;

  return (
    <div className="min-h-screen bg-[#0C0C10] pb-24 text-white">
      <div className="mx-auto max-w-5xl px-6 pt-8">
        <div className="flex items-center justify-between">
          <Link to="/admin/projects" className="text-sm text-slate-400 hover:text-white">← Projeler</Link>
          <button onClick={downloadPdf} disabled={downloading} className="rounded-lg px-4 py-2 text-sm font-medium text-[#0C0C10] transition disabled:opacity-50" style={{ background: GOLD }}>
            {downloading ? 'Hazırlanıyor...' : '↓ Rapor PDF'}
          </button>
        </div>

        <div className="mt-8 flex flex-col gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider" style={{ color: GOLD }}>{project.artistName || 'Sanatçı atanmamış'}</div>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{project.songTitle || project.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {platformsInCampaign.map((p) => <PlatformChip key={p} platform={p} />)}
              <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-400">{STATUS_LABEL[project.status] || project.status}</span>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              {formatDate(project.startDate)} – {formatDate(project.endDate)} · Rapor {formatDate(generatedAt)}
            </div>
          </div>
          {creators.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {creators.slice(0, 6).map((c) => <Avatar key={c.id} name={c.name} />)}
                {creators.length > 6 && <div className="flex h-9 w-9 flex-none items-center justify-center rounded-full border-2 border-[#0C0C10] bg-white/10 text-xs font-semibold">+{creators.length - 6}</div>}
              </div>
              <span className="text-xs text-slate-500">{totals.creatorCount} üretici</span>
            </div>
          )}
        </div>

        <div className="mt-8 flex flex-col gap-6 sm:flex-row sm:items-center">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-slate-500">Toplam İzlenme</div>
            <div className="mt-1 text-5xl font-bold tracking-tight">{formatCompact(totals.views)}</div>
          </div>
          <div className="flex flex-1 flex-wrap gap-2.5">
            <MetricPill value={formatPercent(totals.engagementRate)} label="Etkileşim Oranı" />
            <MetricPill value={totals.creatorCount} label="Üretici" />
            <MetricPill value={totals.videoCount} label="İçerik" />
            <MetricPill value={formatCompact(totals.likes)} label="Beğeni" />
            <MetricPill value={formatCompact(totals.comments)} label="Yorum" />
            <MetricPill value={formatCompact(totals.shares)} label="Paylaşım" />
          </div>
        </div>

        <div className="mt-8 flex gap-1 border-b border-white/10 text-sm">
          {TABS.map(([value, label]) => (
            <button key={value} onClick={() => setTab(value)} className="relative px-4 py-3 transition" style={{ color: tab === value ? '#fff' : '#64748B' }}>
              {label}
              {tab === value && <span className="absolute inset-x-4 bottom-0 h-0.5 rounded-full" style={{ background: GOLD }} />}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 mt-10 space-y-10">
        {tab === 'overview' && (
          <>
            {topVideo && (
              <section className="rounded-xl border border-white/10 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">En Çok Konuşulan İçerik</h2>
                  <a href={topVideo.url} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline" style={{ color: GOLD }}>Görüntüle →</a>
                </div>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-3">
                    <Avatar name={topVideo.owner_name} size={44} />
                    <div>
                      <div className="font-medium text-white">@{topVideo.owner_name}</div>
                      <PlatformChip platform={topVideo.platform} href={topVideo.url} />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-wrap gap-6 sm:justify-end">
                    <div><div className="text-[10px] uppercase tracking-wider text-slate-500">İzlenme</div><div className="text-xl font-bold text-white">{formatCompact(topVideo.views)}</div></div>
                    <div><div className="text-[10px] uppercase tracking-wider text-slate-500">Beğeni</div><div className="text-xl font-bold text-white">{formatCompact(topVideo.likes)}</div></div>
                    <div><div className="text-[10px] uppercase tracking-wider text-slate-500">Yorum</div><div className="text-xl font-bold text-white">{formatCompact(topVideo.comments)}</div></div>
                    <div><div className="text-[10px] uppercase tracking-wider text-slate-500">Paylaşım</div><div className="text-xl font-bold text-white">{formatCompact(topVideo.shares)}</div></div>
                  </div>
                </div>
              </section>
            )}

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-white/10 p-5">
                <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">Üretici Katkısı</h2>
                <p className="mb-3 text-xs text-slate-500">İzlenmeye göre sıralı erişim payı</p>
                <div className="divide-y divide-white/5">
                  {creators.slice(0, 8).map((c, i) => (
                    <RankRow key={c.id} rank={i + 1} name={`@${c.name}`} value={formatCompact(c.views)} share={c.reachShare} />
                  ))}
                  {!creators.length && <p className="py-6 text-center text-sm text-slate-500">Henüz veri yok.</p>}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 p-5">
                <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">Etkileşim Bileşenleri</h2>
                <p className="mb-4 text-xs text-slate-500">Toplam {formatCompact(totals.engagement)} etkileşimin dağılımı</p>
                <ContributionBar likes={totals.likes} comments={totals.comments} shares={totals.shares} />
              </div>
            </section>

            <section className="rounded-xl border border-white/10 p-5">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">İzlenme Seyri</h2>
              <p className="mb-4 text-xs text-slate-500">Kampanya süresince günlük toplam izlenme</p>
              <GrowthBars growth={growth} />
            </section>

            <section className="rounded-xl border border-white/10 p-5">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-400">Metrik Karşılaştırması</h2>
              <p className="mb-4 text-xs text-slate-500">İzlenme, beğeni, yorum ve paylaşım sütun grafiği</p>
              <MetricColumns views={totals.views} likes={totals.likes} comments={totals.comments} shares={totals.shares} />
            </section>
          </>
        )}

        {tab === 'creators' && (
          <section className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Üretici</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3 text-right">İçerik</th>
                  <th className="px-4 py-3 text-right">İzlenme</th>
                  <th className="px-4 py-3 text-right">Etkileşim</th>
                  <th className="px-4 py-3 text-right">Erişim Payı</th>
                </tr>
              </thead>
              <tbody>
                {creators.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><Avatar name={c.name} size={26} /><span className="font-medium text-white">@{c.name}</span></div></td>
                    <td className="px-4 py-3"><div className="flex gap-1">{c.platforms.map((p) => <PlatformChip key={p} platform={p} />)}</div></td>
                    <td className="px-4 py-3 text-right text-slate-300">{c.videoCount}</td>
                    <td className="px-4 py-3 text-right font-medium text-white">{formatCompact(c.views)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{formatCompact(c.engagement)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{formatPercent(c.reachShare)}</td>
                  </tr>
                ))}
                {!creators.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-500">Henüz içerik üreticisi yok.</td></tr>}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'videos' && (
          <section className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Üretici</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3 text-right">İzlenme</th>
                  <th className="px-4 py-3 text-right">Beğeni</th>
                  <th className="px-4 py-3 text-right">Yorum</th>
                  <th className="px-4 py-3 text-right">Paylaşım</th>
                  <th className="px-4 py-3 text-right">Yayın</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {videos.map((v) => (
                  <tr key={v.id} className="border-b border-white/5 last:border-0">
                    <td className="px-4 py-3 font-medium text-white">@{v.owner_name}</td>
                    <td className="px-4 py-3"><PlatformChip platform={v.platform} href={v.url} /></td>
                    <td className="px-4 py-3 text-right font-medium text-white">{formatCompact(v.views)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{formatCompact(v.likes)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{formatCompact(v.comments)}</td>
                    <td className="px-4 py-3 text-right text-slate-300">{formatCompact(v.shares)}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatDate(v.created_at)}</td>
                    <td className="px-4 py-3 text-right"><a href={v.url} target="_blank" rel="noreferrer" style={{ color: GOLD }} className="hover:underline">Görüntüle →</a></td>
                  </tr>
                ))}
                {!videos.length && <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">Henüz içerik yok.</td></tr>}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </div>
  );
}
