const express = require('express');
const path = require('path');
const PDFDocument = require('pdfkit');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { PLATFORMS } = require('../utils/platform');
const { getPdfHeaderTitle, getPdfHeaderSubtitle } = require('../utils/settings');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

const FONT_PATH = path.join(__dirname, '../assets/fonts/Manrope.ttf');
const PAGE_MARGIN = 48;
const COLOR = {
  pageBg: '#0A0A0F',
  cardBg: '#17171F',
  cardBorder: '#2A2A35',
  divider: '#232330',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#5B5F6E',
  chipText: '#0B0B0F',
  accent: '#D4A954'
};

function formatCompact(value) {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} Mn`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} B`;
  return n.toLocaleString('tr-TR');
}

const STATUS_LABEL = { draft: 'Taslak', active: 'Aktif', completed: 'Tamamlandı', cancelled: 'İptal' };

async function buildCampaign(projectId) {
  const project = await db.prepare(`
    SELECT p.*, COALESCE(p.artist_name, a.name) AS artist_name, COALESCE(p.song_name, s.title) AS song_title
    FROM projects p
    LEFT JOIN artists a ON a.id = p.artist_id
    LEFT JOIN songs s ON s.id = p.song_id
    WHERE p.id = ?
  `).get(projectId);
  if (!project) return null;

  const videos = await db.prepare(`
    SELECT v.id, v.platform, v.url, v.status, v.owner_user_id, v.created_at,
      MAX(COALESCE(vm.views, 0), 0) views, MAX(COALESCE(vm.likes, 0), 0) likes,
      MAX(COALESCE(vm.comments, 0), 0) comments, MAX(COALESCE(vm.shares, 0), 0) shares,
      COALESCE(u.display_name, u.username, 'Bilinmiyor') owner_name
    FROM videos v
    LEFT JOIN video_metrics vm ON vm.id = (SELECT id FROM video_metrics WHERE video_id = v.id ORDER BY scraped_at DESC, id DESC LIMIT 1)
    LEFT JOIN users u ON u.id = v.owner_user_id
    WHERE v.project_id = ? AND v.status = 'active'
    ORDER BY views DESC
  `).all(projectId);

  const totals = videos.reduce((acc, v) => {
    acc.views += v.views; acc.likes += v.likes; acc.comments += v.comments; acc.shares += v.shares;
    return acc;
  }, { views: 0, likes: 0, comments: 0, shares: 0 });
  const engagement = totals.likes + totals.comments + totals.shares;
  const engagementRate = totals.views ? (engagement / totals.views) * 100 : 0;

  const creatorMap = new Map();
  videos.forEach((v) => {
    if (!creatorMap.has(v.owner_user_id)) {
      creatorMap.set(v.owner_user_id, { id: v.owner_user_id, name: v.owner_name, videoCount: 0, views: 0, likes: 0, comments: 0, shares: 0, platforms: new Set() });
    }
    const c = creatorMap.get(v.owner_user_id);
    c.videoCount += 1; c.views += v.views; c.likes += v.likes; c.comments += v.comments; c.shares += v.shares;
    c.platforms.add(v.platform);
  });
  const creators = [...creatorMap.values()]
    .map((c) => ({
      ...c,
      platforms: [...c.platforms],
      engagement: c.likes + c.comments + c.shares,
      reachShare: totals.views ? (c.views / totals.views) * 100 : 0
    }))
    .sort((a, b) => b.views - a.views);

  const growth = await db.prepare(`
    SELECT day, SUM(day_views) total_views FROM (
      SELECT v.id video_id, date(vm.scraped_at) day, vm.views day_views,
        ROW_NUMBER() OVER (PARTITION BY v.id, date(vm.scraped_at) ORDER BY vm.scraped_at DESC) rn
      FROM video_metrics vm JOIN videos v ON v.id = vm.video_id
      WHERE v.project_id = ?
    ) WHERE rn = 1
    GROUP BY day ORDER BY day ASC
  `).all(projectId);

  return {
    project: {
      id: project.id,
      name: project.name,
      artistName: project.artist_name,
      songTitle: project.song_title,
      status: project.status,
      statusLabel: STATUS_LABEL[project.status] || project.status,
      startDate: project.start_date,
      endDate: project.end_date,
      createdAt: project.created_at
    },
    totals: { ...totals, engagement, engagementRate, videoCount: videos.length, creatorCount: creators.length },
    creators,
    topVideo: videos[0] || null,
    videos,
    growth
  };
}

router.get('/:projectId', async (req, res) => {
  const campaign = await buildCampaign(req.params.projectId);
  if (!campaign) return res.status(404).json({ error: 'Proje bulunamadı' });
  res.json(campaign);
});

router.get('/:projectId/pdf', async (req, res) => {
  const campaign = await buildCampaign(req.params.projectId);
  if (!campaign) return res.status(404).json({ error: 'Proje bulunamadı' });
  const { project, totals, creators, topVideo, growth } = campaign;

  const brandTitle = await getPdfHeaderTitle();
  const brandSubtitle = await getPdfHeaderSubtitle();
  const title = `${(project.songTitle || project.name || '').toUpperCase()} KAMPANYA RAPORU`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="kampanya-raporu-${project.id}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true, info: { Title: `${brandTitle} - ${title}`, Author: brandTitle } });
  doc.registerFont('Manrope', FONT_PATH);
  doc.pipe(res);

  const pageWidth = () => doc.page.width - PAGE_MARGIN * 2;
  function paintBg() { doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLOR.pageBg); }
  paintBg();

  // Header
  doc.font('Manrope').fontSize(20).fillColor(COLOR.textPrimary).text(brandTitle, PAGE_MARGIN, PAGE_MARGIN, { continued: false });
  if (brandSubtitle) doc.fontSize(9).fillColor(COLOR.textSecondary).text(brandSubtitle, PAGE_MARGIN, doc.y + 2);
  const lineY1 = doc.y + 12;
  doc.moveTo(PAGE_MARGIN, lineY1).lineTo(PAGE_MARGIN + pageWidth(), lineY1).lineWidth(1).strokeColor(COLOR.divider).stroke();
  doc.y = lineY1 + 16;

  doc.font('Manrope').fontSize(22).fillColor(COLOR.textPrimary).text(project.songTitle || project.name, PAGE_MARGIN, doc.y, { width: pageWidth() });
  doc.fontSize(11).fillColor(COLOR.textSecondary).text(`${project.artistName || 'Sanatçı yok'} · ${project.statusLabel}`, PAGE_MARGIN, doc.y + 4);
  doc.y += 16;

  // Hero
  doc.fontSize(9).fillColor(COLOR.textSecondary).text('TOPLAM İZLENME', PAGE_MARGIN, doc.y, { width: pageWidth(), align: 'center' });
  doc.font('Manrope').fontSize(44).fillColor(COLOR.textPrimary).text(formatCompact(totals.views), PAGE_MARGIN, doc.y + 4, { width: pageWidth(), align: 'center' });
  doc.y += 16;

  // Stat tiles
  const stats = [
    ['ETKİLEŞİM ORANI', `%${totals.engagementRate.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`],
    ['İÇERİK ÜRETİCİSİ', String(totals.creatorCount)],
    ['İÇERİK', String(totals.videoCount)],
    ['BEĞENİ', formatCompact(totals.likes)],
    ['YORUM', formatCompact(totals.comments)],
    ['PAYLAŞIM', formatCompact(totals.shares)]
  ];
  const tileGap = 12;
  const tileW = (pageWidth() - tileGap * (stats.length - 1)) / stats.length;
  const tileY = doc.y;
  stats.forEach((stat, i) => {
    const x = PAGE_MARGIN + i * (tileW + tileGap);
    doc.roundedRect(x, tileY, tileW, 62, 10).lineWidth(1).fillAndStroke(COLOR.cardBg, COLOR.cardBorder);
    doc.font('Manrope').fontSize(16).fillColor(COLOR.textPrimary).text(stat[1], x + 10, tileY + 12, { width: tileW - 20 });
    doc.fontSize(7).fillColor(COLOR.textSecondary).text(stat[0], x + 10, tileY + 40, { width: tileW - 20 });
  });
  doc.y = tileY + 62 + 24;

  // Creators
  doc.font('Manrope').fontSize(14).fillColor(COLOR.textPrimary).text('Üretici Katkısı', PAGE_MARGIN, doc.y);
  doc.y += 10;
  creators.slice(0, 10).forEach((creator) => {
    const rowY = doc.y;
    doc.font('Manrope').fontSize(10).fillColor(COLOR.textPrimary).text(`@${creator.name}`, PAGE_MARGIN, rowY, { width: pageWidth() * 0.35, continued: false });
    doc.fontSize(9).fillColor(COLOR.textSecondary).text(`${creator.videoCount} içerik`, PAGE_MARGIN + pageWidth() * 0.35, rowY, { width: pageWidth() * 0.2 });
    doc.fillColor(COLOR.textPrimary).text(formatCompact(creator.views), PAGE_MARGIN + pageWidth() * 0.55, rowY, { width: pageWidth() * 0.2, align: 'right' });
    doc.fillColor(COLOR.textSecondary).text(`%${creator.reachShare.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}`, PAGE_MARGIN + pageWidth() * 0.8, rowY, { width: pageWidth() * 0.2, align: 'right' });
    doc.y = rowY + 20;
    if (doc.y > doc.page.height - PAGE_MARGIN - 40) { doc.addPage(); paintBg(); doc.y = PAGE_MARGIN; }
  });

  // Top content
  if (topVideo) {
    doc.y += 12;
    doc.font('Manrope').fontSize(14).fillColor(COLOR.textPrimary).text('En Çok Konuşulan İçerik', PAGE_MARGIN, doc.y);
    doc.y += 10;
    const cardH = 90;
    doc.roundedRect(PAGE_MARGIN, doc.y, pageWidth(), cardH, 12).lineWidth(1).fillAndStroke(COLOR.cardBg, COLOR.cardBorder);
    const config = PLATFORMS[topVideo.platform] || PLATFORMS.web;
    const py = doc.y + 16;
    doc.font('Manrope').fontSize(11).fillColor(COLOR.textPrimary).text(`@${topVideo.owner_name}`, PAGE_MARGIN + 16, py);
    doc.fontSize(9).fillColor(COLOR.textSecondary).text(config.label, PAGE_MARGIN + 16, py + 16);
    doc.font('Manrope').fontSize(20).fillColor(COLOR.textPrimary).text(formatCompact(topVideo.views), PAGE_MARGIN + 16, py + 34);
    doc.fontSize(8).fillColor(COLOR.textSecondary).text('İZLENME', PAGE_MARGIN + 16, py + 58);
    doc.font('Manrope').fontSize(10).fillColor(COLOR.textPrimary)
      .text('Videoyu Görüntüle  →', PAGE_MARGIN + pageWidth() - 180, py + 34, { link: topVideo.url, width: 180, align: 'right', underline: false });
    doc.y += cardH + 20;
  }

  // Growth
  if (growth.length > 1) {
    if (doc.y > doc.page.height - PAGE_MARGIN - 180) { doc.addPage(); paintBg(); doc.y = PAGE_MARGIN; }
    doc.font('Manrope').fontSize(14).fillColor(COLOR.textPrimary).text('İzlenme Seyri', PAGE_MARGIN, doc.y);
    doc.y += 10;
    const chartH = 120;
    const chartW = pageWidth();
    const chartX = PAGE_MARGIN;
    const chartY = doc.y;
    doc.roundedRect(chartX, chartY, chartW, chartH, 12).lineWidth(1).fillAndStroke(COLOR.cardBg, COLOR.cardBorder);
    const values = growth.map((g) => g.total_views);
    const maxV = Math.max(...values, 1);
    const padX = 20; const padY = 20; const labelH = 16;
    const plotW = chartW - padX * 2; const plotH = chartH - padY * 2 - labelH;
    const barGap = 4;
    const barW = Math.max((plotW - barGap * (growth.length - 1)) / growth.length, 2);
    growth.forEach((g, i) => {
      const barH = Math.max((g.total_views / maxV) * plotH, 2);
      const x = chartX + padX + i * (barW + barGap);
      const y = chartY + padY + plotH - barH;
      doc.rect(x, y, barW, barH).fill(COLOR.accent);
    });
    doc.fontSize(8).fillColor(COLOR.textSecondary).text(`İlk: ${formatCompact(values[0])}`, chartX + padX, chartY + chartH - 14);
    doc.text(`Son: ${formatCompact(values[values.length - 1])}`, chartX + chartW - padX - 120, chartY + chartH - 14, { width: 120, align: 'right' });
    doc.y = chartY + chartH + 20;
  }

  // Metric comparison columns
  if (doc.y > doc.page.height - PAGE_MARGIN - 190) { doc.addPage(); paintBg(); doc.y = PAGE_MARGIN; }
  doc.font('Manrope').fontSize(14).fillColor(COLOR.textPrimary).text('Metrik Karşılaştırması', PAGE_MARGIN, doc.y);
  doc.y += 10;
  {
    const chartH = 150;
    const chartW = pageWidth();
    const chartX = PAGE_MARGIN;
    const chartY = doc.y;
    doc.roundedRect(chartX, chartY, chartW, chartH, 12).lineWidth(1).fillAndStroke(COLOR.cardBg, COLOR.cardBorder);
    const cols = [
      { label: 'İZLENME', value: totals.views, color: COLOR.accent },
      { label: 'BEĞENİ', value: totals.likes, color: '#C77B5E' },
      { label: 'YORUM', value: totals.comments, color: '#6E9BD1' },
      { label: 'PAYLAŞIM', value: totals.shares, color: '#5EA8A0' }
    ];
    const maxSqrt = Math.sqrt(Math.max(...cols.map((c) => c.value), 1));
    const padX = 30; const padTop = 28; const labelH = 34;
    const plotW = chartW - padX * 2;
    const plotH = chartH - padTop - labelH;
    const colGap = 30;
    const colW = Math.min((plotW - colGap * (cols.length - 1)) / cols.length, 70);
    const rowWidth = colW * cols.length + colGap * (cols.length - 1);
    const startX = chartX + (chartW - rowWidth) / 2;
    cols.forEach((c, i) => {
      const fraction = c.value > 0 ? Math.max(Math.sqrt(c.value) / maxSqrt, 0.06) : 0;
      const barH = fraction * plotH;
      const x = startX + i * (colW + colGap);
      const y = chartY + padTop + plotH - barH;
      doc.font('Manrope').fontSize(10).fillColor(COLOR.textPrimary).text(formatCompact(c.value), x, chartY + padTop + plotH - barH - 16, { width: colW, align: 'center' });
      if (barH > 0) doc.roundedRect(x, y, colW, barH, 3).fill(c.color);
      doc.fontSize(7.5).fillColor(COLOR.textSecondary).text(c.label, x, chartY + padTop + plotH + 8, { width: colW, align: 'center' });
    });
    doc.y = chartY + chartH + 20;
  }

  // Footer on all pages
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const y = doc.page.height - PAGE_MARGIN - 20;
    doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + pageWidth(), y).lineWidth(1).strokeColor(COLOR.divider).stroke();
    doc.font('Manrope').fontSize(8.5).fillColor(COLOR.textSecondary).text(brandTitle, PAGE_MARGIN, y + 8, { width: pageWidth() / 2 });
    doc.fontSize(8.5).text(`Sayfa ${i + 1} / ${range.count}`, PAGE_MARGIN, y + 8, { width: pageWidth(), align: 'right' });
  }

  doc.end();
});

module.exports = router;
