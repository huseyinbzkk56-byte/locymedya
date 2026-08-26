const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const PDFDocument = require('pdfkit');
const db = require('../db/db');
const { authenticate, requireRole } = require('../middleware/auth');
const { PLATFORMS } = require('../utils/platform');
const {
  getPdfBrandTitle, setPdfBrandTitle,
  getPdfHeaderTitle, setPdfHeaderTitle,
  getPdfHeaderSubtitle, setPdfHeaderSubtitle
} = require('../utils/settings');

const router = express.Router();
const FONT_PATH = path.join(__dirname, '../assets/fonts/Manrope.ttf');
const SCREENSHOT_DIR = path.join(__dirname, '../../data/link-screenshots');

const PAGE_MARGIN = 48;
const CARD_PAD = 20;
const FOOTER_HEIGHT = 40;
const FALLBACK_IMAGE_HEIGHT = 220;
const MAX_IMAGE_HEIGHT = 340;
const IMAGE_FETCH_TIMEOUT = 6000;

const COLOR = {
  pageBg: '#0A0A0F',
  cardBg: '#17171F',
  cardBorder: '#2A2A35',
  divider: '#232330',
  textPrimary: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#5B5F6E',
  chipText: '#0B0B0F'
};

function sectionTitle(brandTitle, config) {
  const base = `${config.label.toUpperCase()} PR ÇALIŞMALARI`;
  return brandTitle ? `${brandTitle.toUpperCase()} ${base}` : base;
}

function paintBackground(doc) {
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLOR.pageBg);
}

function newPage(doc) {
  doc.addPage();
  paintBackground(doc);
}

async function fetchRemoteImageBuffer(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LocyMedyaBot/1.0)' } });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!/jpeg|jpg|png/i.test(contentType)) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function imageKeyOf(item) {
  return item.screenshot_url || item.preview_image || null;
}

async function loadImageForKey(key) {
  if (key.startsWith('/uploads/link-screenshots/')) {
    try {
      return await fs.readFile(path.join(SCREENSHOT_DIR, path.basename(key)));
    } catch {
      return null;
    }
  }
  return fetchRemoteImageBuffer(key);
}

async function preloadImages(doc, linksList) {
  const map = new Map();
  const uniqueKeys = [...new Set(linksList.map(imageKeyOf).filter(Boolean))];
  await Promise.all(uniqueKeys.map(async (key) => {
    const buffer = await loadImageForKey(key);
    if (!buffer) return map.set(key, null);
    try {
      const info = doc.openImage(buffer);
      map.set(key, { buffer, width: info.width, height: info.height });
    } catch {
      map.set(key, null);
    }
  }));
  return map;
}

function statsParts(item) {
  const parts = [];
  if (item.stats_views !== null && item.stats_views !== undefined) parts.push({ label: 'İZLENME', value: Number(item.stats_views).toLocaleString('tr-TR') });
  if (item.stats_likes !== null && item.stats_likes !== undefined) parts.push({ label: 'BEĞENİ', value: Number(item.stats_likes).toLocaleString('tr-TR') });
  if (item.stats_comments !== null && item.stats_comments !== undefined) parts.push({ label: 'YORUM', value: Number(item.stats_comments).toLocaleString('tr-TR') });
  return parts;
}

function imageDisplaySize(image, innerWidth) {
  if (!image) return { w: innerWidth, h: FALLBACK_IMAGE_HEIGHT };
  let w = innerWidth;
  let h = innerWidth * (image.height / image.width);
  if (h > MAX_IMAGE_HEIGHT) {
    h = MAX_IMAGE_HEIGHT;
    w = MAX_IMAGE_HEIGHT * (image.width / image.height);
  }
  return { w, h };
}

function drawHeader(doc, brand, title, count, continued) {
  const top = PAGE_MARGIN;
  doc.font('Manrope').fontSize(continued ? 15 : 22).fillColor(COLOR.textPrimary).text(brand.headerTitle, PAGE_MARGIN, top, { continued: false });
  if (brand.headerSubtitle) {
    doc.fontSize(9).fillColor(COLOR.textSecondary).text(brand.headerSubtitle, PAGE_MARGIN, doc.y + (continued ? 0 : 2));
  }

  const pageWidth = doc.page.width - PAGE_MARGIN * 2;
  const lineY = doc.y + 12;
  doc.moveTo(PAGE_MARGIN, lineY).lineTo(PAGE_MARGIN + pageWidth, lineY).lineWidth(1).strokeColor(COLOR.divider).stroke();

  const rowY = lineY + 14;
  doc.fontSize(continued ? 12 : 16).fillColor(COLOR.textPrimary).text(title, PAGE_MARGIN, rowY, { width: pageWidth * 0.7, continued: false });
  const rightLabel = `${count} çalışma`;
  doc.fontSize(9.5).fillColor(COLOR.textSecondary).text(rightLabel, PAGE_MARGIN, rowY + 2, { width: pageWidth, align: 'right' });

  doc.y = Math.max(doc.y, rowY + (continued ? 20 : 26));
  doc.x = PAGE_MARGIN;
}

function drawFooter(doc, brand, pageNumber, pageCount) {
  const y = doc.page.height - PAGE_MARGIN - FOOTER_HEIGHT + 14;
  const pageWidth = doc.page.width - PAGE_MARGIN * 2;
  const footerLabel = brand.headerSubtitle ? `${brand.headerTitle} · ${brand.headerSubtitle}` : brand.headerTitle;
  doc.moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + pageWidth, y).lineWidth(1).strokeColor(COLOR.divider).stroke();
  doc.font('Manrope').fontSize(8.5).fillColor(COLOR.textSecondary).text(footerLabel, PAGE_MARGIN, y + 10, { continued: false, width: pageWidth / 2 });
  doc.fontSize(8.5).fillColor(COLOR.textSecondary).text(`Sayfa ${pageNumber} / ${pageCount}`, PAGE_MARGIN, y + 10, { width: pageWidth, align: 'right' });
}

const contentBottomOf = (doc) => doc.page.height - PAGE_MARGIN - FOOTER_HEIGHT;
const cardWidthOf = (doc) => doc.page.width - PAGE_MARGIN * 2;

function renderSection(doc, brand, config, title, links, imageMap) {
  drawHeader(doc, brand, title, links.length, false);

  const contentBottom = contentBottomOf(doc);
  const cardWidth = cardWidthOf(doc);
  const innerWidth = cardWidth - CARD_PAD * 2;

  if (!links.length) {
    doc.font('Manrope').fontSize(11).fillColor(COLOR.textSecondary).text('Bu platform için henüz link eklenmedi.', PAGE_MARGIN, doc.y + 20);
    return;
  }

  function cardHeight(item) {
    const displayTitle = item.title || item.preview_title || `${config.label} Paylaşımı`;
    doc.font('Manrope').fontSize(13.5);
    const titleH = doc.heightOfString(displayTitle, { width: innerWidth, lineGap: 2 });
    const stats = statsParts(item);
    const statsH = stats.length ? 44 : 0;
    const image = imageMap.get(imageKeyOf(item));
    const { h: imageH } = imageDisplaySize(image, innerWidth);
    return CARD_PAD * 2 + 24 + 12 + imageH + 18 + statsH + titleH + 16 + 32;
  }

  function drawCard(item, index, x, y) {
    const displayTitle = item.title || item.preview_title || `${config.label} Paylaşımı`;
    const h = cardHeight(item);

    doc.roundedRect(x, y, cardWidth, h, 14).lineWidth(1).fillAndStroke(COLOR.cardBg, COLOR.cardBorder);

    let cy = y + CARD_PAD;
    doc.font('Manrope').fontSize(11).fillColor(COLOR.textMuted).text(String(index + 1).padStart(2, '0'), x + CARD_PAD, cy + 4, { continued: false });

    const badgeText = config.label;
    doc.font('Manrope').fontSize(9.5);
    const badgeTextW = doc.widthOfString(badgeText);
    const badgeW = badgeTextW + 20;
    const badgeX = x + cardWidth - CARD_PAD - badgeW;
    doc.roundedRect(badgeX, cy - 2, badgeW, 20, 10).fill(config.accent);
    doc.fillColor(COLOR.chipText).text(badgeText, badgeX + 10, cy + 3, { continued: false });

    cy += 36;
    const image = imageMap.get(imageKeyOf(item));
    const { w: imageW, h: imageH } = imageDisplaySize(image, innerWidth);
    const imageX = x + CARD_PAD + (innerWidth - imageW) / 2;
    let imageDrawn = false;
    if (image) {
      try {
        doc.save();
        doc.roundedRect(imageX, cy, imageW, imageH, 10).clip();
        doc.image(image.buffer, imageX, cy, { width: imageW, height: imageH });
        doc.restore();
        imageDrawn = true;
      } catch {
        doc.restore();
      }
    }
    if (!imageDrawn) {
      doc.roundedRect(imageX, cy, imageW, imageH, 10).fill('#1E1E28');
      doc.font('Manrope').fontSize(48).fillColor(config.accent)
        .text(config.label[0], imageX, cy + imageH / 2 - 28, { width: imageW, align: 'center' });
    }
    cy += imageH + 18;

    const stats = statsParts(item);
    if (stats.length) {
      const blockGap = 44;
      let bx = x + CARD_PAD;
      stats.forEach((stat) => {
        doc.font('Manrope').fontSize(22).fillColor(COLOR.textPrimary).text(stat.value, bx, cy, { continued: false });
        doc.font('Manrope').fontSize(9).fillColor(COLOR.textSecondary).text(stat.label, bx, cy + 27, { continued: false });
        bx += Math.max(doc.widthOfString(stat.value), doc.widthOfString(stat.label)) + blockGap;
      });
      cy += 44 + 18;
    }

    doc.font('Manrope').fontSize(13.5).fillColor(COLOR.textPrimary).text(displayTitle, x + CARD_PAD, cy, { width: innerWidth, lineGap: 2 });
    const titleH = doc.heightOfString(displayTitle, { width: innerWidth, lineGap: 2 });
    cy += titleH + 16;

    const btnLabel = 'Görüntüle  →';
    doc.font('Manrope').fontSize(11);
    const btnTextW = doc.widthOfString(btnLabel);
    const btnW = btnTextW + 32;
    doc.roundedRect(x + CARD_PAD, cy, btnW, 32, 16).fill(config.accent);
    doc.fillColor(COLOR.chipText).text(btnLabel, x + CARD_PAD + 16, cy + 10, { link: item.url, underline: false, continued: false });

    return h;
  }

  links.forEach((item, index) => {
    const h = cardHeight(item);
    if (doc.y + h > contentBottom) {
      newPage(doc);
      drawHeader(doc, brand, title, links.length, true);
    }
    const y = doc.y;
    drawCard(item, index, PAGE_MARGIN, y);
    doc.y = y + h + 18;
  });
}

function finalizeDoc(doc, brand) {
  const range = doc.bufferedPageRange();
  const pageCount = range.count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(range.start + i);
    drawFooter(doc, brand, i + 1, pageCount);
  }
  doc.end();
}

function createDoc(res, filename, pdfTitle, brand) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const doc = new PDFDocument({
    size: 'A4',
    margin: PAGE_MARGIN,
    bufferPages: true,
    info: { Title: `${brand.headerTitle} - ${pdfTitle}`, Author: brand.headerTitle }
  });
  doc.registerFont('Manrope', FONT_PATH);
  doc.pipe(res);
  paintBackground(doc);
  return doc;
}

async function getBrand() {
  return { headerTitle: await getPdfHeaderTitle(), headerSubtitle: await getPdfHeaderSubtitle() };
}

const LINK_SELECT = 'title, url, preview_title, preview_image, screenshot_url, stats_views, stats_likes, stats_comments';

router.get('/brand-title', authenticate, requireRole('admin'), async (req, res) => {
  res.json({ brandTitle: await getPdfBrandTitle(), headerTitle: await getPdfHeaderTitle(), headerSubtitle: await getPdfHeaderSubtitle() });
});

router.put('/brand-title', authenticate, requireRole('admin'), async (req, res) => {
  if (req.body.brandTitle !== undefined) await setPdfBrandTitle(req.body.brandTitle);
  if (req.body.headerTitle !== undefined) await setPdfHeaderTitle(req.body.headerTitle);
  if (req.body.headerSubtitle !== undefined) await setPdfHeaderSubtitle(req.body.headerSubtitle);
  res.json({ brandTitle: await getPdfBrandTitle(), headerTitle: await getPdfHeaderTitle(), headerSubtitle: await getPdfHeaderSubtitle() });
});

router.get('/all.pdf', authenticate, requireRole('admin'), async (req, res) => {
  const counts = await db.prepare('SELECT platform, COUNT(*) as cnt FROM links WHERE archived = 0 GROUP BY platform ORDER BY cnt DESC, platform ASC').all();
  const brandTitle = await getPdfBrandTitle();
  const brand = await getBrand();
  const platformsInOrder = counts.map((row) => row.platform).filter((key) => PLATFORMS[key]);

  if (!platformsInOrder.length) {
    return res.status(400).json({ error: 'Henüz hiç link eklenmedi' });
  }

  const sections = [];
  for (const platformKey of platformsInOrder) {
    sections.push({
      platformKey,
      links: await db.prepare(`SELECT ${LINK_SELECT} FROM links WHERE platform = ? AND archived = 0 ORDER BY created_at ASC, id ASC`).all(platformKey)
    });
  }

  const doc = createDoc(res, 'locy-medya-tum-calismalar.pdf', brandTitle ? `${brandTitle.toUpperCase()} PR ÇALIŞMALARI` : 'PR ÇALIŞMALARI', brand);
  const imageMap = await preloadImages(doc, sections.flatMap((s) => s.links));

  sections.forEach(({ platformKey, links }, index) => {
    const config = PLATFORMS[platformKey];
    if (index > 0) newPage(doc);
    renderSection(doc, brand, config, sectionTitle(brandTitle, config), links, imageMap);
  });

  finalizeDoc(doc, brand);
});

router.get('/:platform.pdf', authenticate, requireRole('admin'), async (req, res) => {
  const platform = String(req.params.platform).toLowerCase();
  const config = PLATFORMS[platform];
  if (!config) return res.status(400).json({ error: 'Geçersiz platform' });

  const links = await db.prepare(`SELECT ${LINK_SELECT} FROM links WHERE platform = ? AND archived = 0 ORDER BY created_at ASC, id ASC`).all(platform);
  const brandTitle = await getPdfBrandTitle();
  const brand = await getBrand();
  const title = sectionTitle(brandTitle, config);
  const doc = createDoc(res, `locy-medya-${platform}-sunumu.pdf`, title, brand);
  const imageMap = await preloadImages(doc, links);

  renderSection(doc, brand, config, title, links, imageMap);
  finalizeDoc(doc, brand);
});

module.exports = router;
