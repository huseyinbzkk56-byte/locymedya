const express = require('express');
const path = require('path');
const crypto = require('crypto');
const PDFDocument = require('pdfkit');
const db = require('../db/db');
const { authenticate, requireRole, requireFullAdmin } = require('../middleware/auth');
const { getPdfHeaderTitle, getPdfHeaderSubtitle } = require('../utils/settings');

const router = express.Router();
const STATUSES = new Set(['draft', 'sent', 'archived']);
const CATEGORY_LABEL = { influencer: 'Influencer', rapmedia: 'Türkçe Rap Medyası', dizi: 'Dizi Edit Sayfası', futbol: 'Futbol Edit', araba: 'Araba Edit' };

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

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function shapeAccountPlatforms(row) {
  const instagram = row.instagram_url
    ? { profileUrl: row.instagram_url, followers: row.instagram_followers, normalPrice: row.instagram_normal_price, clientPrice: row.instagram_client_price }
    : null;
  const tiktok = row.tiktok_url
    ? { profileUrl: row.tiktok_url, followers: row.tiktok_followers, normalPrice: row.tiktok_normal_price, clientPrice: row.tiktok_client_price }
    : null;
  return { instagram, tiktok };
}

function defaultClientPrice(row) {
  return (row.instagram_client_price || 0) + (row.tiktok_client_price || 0);
}

function totalFollowers(row) {
  return (row.instagram_followers || 0) + (row.tiktok_followers || 0);
}

function totalNormalPrice(row) {
  return (row.instagram_normal_price || 0) + (row.tiktok_normal_price || 0);
}

// PDF ve /public/:token ile aynı — müşteriye asla normal fiyat/admin verisi sızmasın
async function getClientSafeItems(offerId) {
  const rows = await db.prepare(
    `SELECT oli.client_price, oli.sort_order, oa.name, oa.category,
            oa.instagram_url, oa.instagram_followers, oa.tiktok_url, oa.tiktok_followers
     FROM offer_list_items oli
     JOIN offer_accounts oa ON oa.id = oli.media_account_id
     WHERE oli.offer_id = ?
     ORDER BY oli.sort_order ASC, oli.id ASC`
  ).all(offerId);

  const autoBudget = rows.reduce((sum, row) => sum + row.client_price, 0);
  const items = rows.map((row) => ({
    name: row.name,
    category: row.category,
    followers: totalFollowers(row),
    instagram: row.instagram_url ? { profileUrl: row.instagram_url, followers: row.instagram_followers } : null,
    tiktok: row.tiktok_url ? { profileUrl: row.tiktok_url, followers: row.tiktok_followers } : null
  }));
  return { items, autoBudget };
}

async function getOfferItemsAdmin(offerId) {
  const rows = await db.prepare(
    `SELECT oli.id AS item_id, oli.client_price, oli.sort_order, oa.*
     FROM offer_list_items oli
     JOIN offer_accounts oa ON oa.id = oli.media_account_id
     WHERE oli.offer_id = ?
     ORDER BY oli.sort_order ASC, oli.id ASC`
  ).all(offerId);

  return rows.map((row) => ({
    id: row.item_id,
    accountId: row.id,
    name: row.name,
    category: row.category,
    clientPrice: row.client_price,
    sortOrder: row.sort_order,
    followers: totalFollowers(row),
    normalPrice: totalNormalPrice(row),
    ...shapeAccountPlatforms(row)
  }));
}

// ---- Public: müşteri teklif görünümü (kimlik doğrulama gerektirmez) ----
// Sadece müşteriye gösterilmesi gereken alanlar döndürülür — normal fiyat, admin bilgisi asla dahil edilmez.
router.get('/public/:token', async (req, res) => {
  const offer = await db.prepare('SELECT id, name, client_name, status, total_price FROM offer_lists WHERE public_token = ?').get(req.params.token);
  if (!offer) return res.status(404).json({ error: 'Teklif bulunamadı' });

  const rows = await db.prepare(
    `SELECT oli.client_price, oli.sort_order, oa.name, oa.category,
            oa.instagram_url, oa.instagram_followers, oa.tiktok_url, oa.tiktok_followers
     FROM offer_list_items oli
     JOIN offer_accounts oa ON oa.id = oli.media_account_id
     WHERE oli.offer_id = ?
     ORDER BY oli.sort_order ASC, oli.id ASC`
  ).all(offer.id);

  const items = rows.map((row) => ({
    name: row.name,
    category: row.category,
    followers: totalFollowers(row),
    instagram: row.instagram_url ? { profileUrl: row.instagram_url, followers: row.instagram_followers } : null,
    tiktok: row.tiktok_url ? { profileUrl: row.tiktok_url, followers: row.tiktok_followers } : null
  }));

  const autoBudget = rows.reduce((sum, row) => sum + row.client_price, 0);
  const totals = {
    accountCount: items.length,
    totalFollowers: items.reduce((sum, item) => sum + item.followers, 0),
    totalBudget: offer.total_price ?? autoBudget
  };

  res.json({ name: offer.name, clientName: offer.client_name, items, totals });
});

// ---- Bundan sonrası sadece admin ----
router.use(authenticate, requireRole('admin'), requireFullAdmin);

router.get('/', async (req, res) => {
  const offers = await db.prepare(
    `SELECT ol.*, (SELECT COUNT(*) FROM offer_list_items WHERE offer_id = ol.id) AS item_count
     FROM offer_lists ol ORDER BY ol.created_at DESC, ol.id DESC`
  ).all();
  res.json({ offers });
});

router.post('/', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const clientName = String(req.body.clientName || '').trim();
  if (!name || !clientName) return res.status(400).json({ error: 'Teklif adı ve müşteri adı zorunlu' });

  let token;
  do { token = generateToken(); } while (await db.prepare('SELECT 1 FROM offer_lists WHERE public_token = ?').get(token));

  const result = await db.prepare('INSERT INTO offer_lists (name, client_name, public_token) VALUES (?, ?, ?)').run(name, clientName, token);
  res.status(201).json({ offer: await db.prepare('SELECT * FROM offer_lists WHERE id = ?').get(result.lastInsertRowid) });
});

router.get('/:id/pdf', async (req, res) => {
  const offer = await db.prepare('SELECT * FROM offer_lists WHERE id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Teklif bulunamadı' });
  const { items, autoBudget } = await getClientSafeItems(offer.id);

  const totals = {
    accountCount: items.length,
    totalFollowers: items.reduce((sum, item) => sum + item.followers, 0),
    totalBudget: offer.total_price ?? autoBudget
  };

  const brandTitle = await getPdfHeaderTitle();
  const brandSubtitle = await getPdfHeaderSubtitle();

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="teklif-${offer.id}.pdf"`);
  const doc = new PDFDocument({ size: 'A4', margin: PAGE_MARGIN, bufferPages: true, info: { Title: `${brandTitle} - ${offer.name}`, Author: brandTitle } });
  doc.registerFont('Manrope', FONT_PATH);
  doc.pipe(res);

  const pageWidth = () => doc.page.width - PAGE_MARGIN * 2;
  function paintBg() { doc.rect(0, 0, doc.page.width, doc.page.height).fill(COLOR.pageBg); }
  paintBg();

  doc.font('Manrope').fontSize(20).fillColor(COLOR.textPrimary).text(brandTitle, PAGE_MARGIN, PAGE_MARGIN);
  if (brandSubtitle) doc.fontSize(9).fillColor(COLOR.textSecondary).text(brandSubtitle, PAGE_MARGIN, doc.y + 2);
  const lineY1 = doc.y + 12;
  doc.moveTo(PAGE_MARGIN, lineY1).lineTo(PAGE_MARGIN + pageWidth(), lineY1).lineWidth(1).strokeColor(COLOR.divider).stroke();
  doc.y = lineY1 + 16;

  doc.font('Manrope').fontSize(22).fillColor(COLOR.textPrimary).text(offer.name, PAGE_MARGIN, doc.y, { width: pageWidth() });
  doc.fontSize(11).fillColor(COLOR.textSecondary).text(`Müşteri: ${offer.client_name}`, PAGE_MARGIN, doc.y + 4);
  doc.y += 20;

  const stats = [
    ['HESAP', String(totals.accountCount)],
    ['TOPLAM TAKİPÇİ', totals.totalFollowers.toLocaleString('tr-TR')],
    ['MÜŞTERİ BÜTÇESİ', `${totals.totalBudget.toLocaleString('tr-TR')} TL`]
  ];
  const tileGap = 12;
  const tileW = (pageWidth() - tileGap * (stats.length - 1)) / stats.length;
  const tileY = doc.y;
  stats.forEach((stat, i) => {
    const x = PAGE_MARGIN + i * (tileW + tileGap);
    doc.roundedRect(x, tileY, tileW, 56, 10).lineWidth(1).fillAndStroke(COLOR.cardBg, COLOR.cardBorder);
    doc.font('Manrope').fontSize(16).fillColor(COLOR.textPrimary).text(stat[1], x + 12, tileY + 12, { width: tileW - 24 });
    doc.fontSize(7).fillColor(COLOR.textSecondary).text(stat[0], x + 12, tileY + 36, { width: tileW - 24 });
  });
  doc.y = tileY + 56 + 24;

  const contentBottom = () => doc.page.height - PAGE_MARGIN - 40;
  items.forEach((item, index) => {
    const platforms = [];
    if (item.instagram) platforms.push({ label: 'Instagram', url: item.instagram.profileUrl, followers: item.instagram.followers });
    if (item.tiktok) platforms.push({ label: 'TikTok', url: item.tiktok.profileUrl, followers: item.tiktok.followers });
    const rowH = 48;
    if (doc.y + rowH > contentBottom()) { doc.addPage(); paintBg(); doc.y = PAGE_MARGIN; }
    const y = doc.y;
    doc.roundedRect(PAGE_MARGIN, y, pageWidth(), rowH, 10).lineWidth(1).fillAndStroke(COLOR.cardBg, COLOR.cardBorder);
    doc.font('Manrope').fontSize(9).fillColor(COLOR.textMuted).text(String(index + 1).padStart(2, '0'), PAGE_MARGIN + 14, y + 10, { continued: false });
    doc.font('Manrope').fontSize(12).fillColor(COLOR.textPrimary).text(item.name, PAGE_MARGIN + 40, y + 9, { width: pageWidth() * 0.4 });

    doc.font('Manrope').fontSize(8.5).fillColor(COLOR.textSecondary)
      .text(`${CATEGORY_LABEL[item.category] || item.category} · `, PAGE_MARGIN + 40, y + 26, { continued: platforms.length > 0, width: pageWidth() * 0.5 });
    if (!platforms.length) {
      doc.text('Platform yok', { continued: false });
    } else {
      platforms.forEach((platform, i) => {
        doc.fillColor(COLOR.accent).text(platform.label, { continued: true, underline: true, link: platform.url });
        const isLast = i === platforms.length - 1;
        doc.fillColor(COLOR.textSecondary).text(` ${platform.followers.toLocaleString('tr-TR')}${isLast ? '' : ' · '}`, { continued: !isLast, underline: false });
      });
    }

    doc.y = y + rowH + 10;
  });

  if (!items.length) {
    doc.font('Manrope').fontSize(11).fillColor(COLOR.textSecondary).text('Bu teklife henüz hesap eklenmedi.', PAGE_MARGIN, doc.y + 10);
  }

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

router.get('/:id', async (req, res) => {
  const offer = await db.prepare('SELECT * FROM offer_lists WHERE id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Teklif bulunamadı' });
  res.json({ offer, items: await getOfferItemsAdmin(offer.id) });
});

router.put('/:id', async (req, res) => {
  const name = String(req.body.name || '').trim();
  const clientName = String(req.body.clientName || '').trim();
  const status = String(req.body.status || 'draft');
  if (!name || !clientName) return res.status(400).json({ error: 'Teklif adı ve müşteri adı zorunlu' });
  if (!STATUSES.has(status)) return res.status(400).json({ error: 'Geçersiz durum' });

  let totalPrice = null;
  if (req.body.totalPrice !== undefined && req.body.totalPrice !== '' && req.body.totalPrice !== null) {
    totalPrice = Number(req.body.totalPrice);
    if (!Number.isFinite(totalPrice) || totalPrice < 0) return res.status(400).json({ error: 'Teklif fiyatı geçerli bir değer olmalı' });
  }

  const result = await db.prepare(
    "UPDATE offer_lists SET name = ?, client_name = ?, status = ?, total_price = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(name, clientName, status, totalPrice, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Teklif bulunamadı' });
  res.json({ offer: await db.prepare('SELECT * FROM offer_lists WHERE id = ?').get(req.params.id) });
});

router.delete('/:id', async (req, res) => {
  const result = await db.prepare('DELETE FROM offer_lists WHERE id = ?').run(req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Teklif bulunamadı' });
  res.status(204).end();
});

router.post('/:id/items', async (req, res) => {
  const offer = await db.prepare('SELECT id FROM offer_lists WHERE id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Teklif bulunamadı' });

  const mediaAccountId = Number(req.body.mediaAccountId);
  const account = await db.prepare('SELECT * FROM offer_accounts WHERE id = ?').get(mediaAccountId);
  if (!account) return res.status(400).json({ error: 'Hesap bulunamadı' });

  const alreadyAdded = await db.prepare('SELECT 1 FROM offer_list_items WHERE offer_id = ? AND media_account_id = ?').get(offer.id, mediaAccountId);
  if (alreadyAdded) return res.status(400).json({ error: 'Bu hesap zaten teklifte mevcut' });

  const clientPrice = req.body.clientPrice !== undefined ? Number(req.body.clientPrice) : defaultClientPrice(account);
  if (!Number.isFinite(clientPrice) || clientPrice < 0) return res.status(400).json({ error: 'Müşteri fiyatı geçerli bir değer olmalı' });

  const maxOrder = (await db.prepare('SELECT COALESCE(MAX(sort_order), -1) AS max FROM offer_list_items WHERE offer_id = ?').get(offer.id)).max;
  const result = await db.prepare(
    'INSERT INTO offer_list_items (offer_id, media_account_id, client_price, sort_order) VALUES (?, ?, ?, ?)'
  ).run(offer.id, mediaAccountId, clientPrice, maxOrder + 1);

  await db.prepare("UPDATE offer_lists SET updated_at = datetime('now') WHERE id = ?").run(offer.id);
  res.status(201).json({ items: await getOfferItemsAdmin(offer.id), itemId: result.lastInsertRowid });
});

router.put('/:id/items/:itemId', async (req, res) => {
  const item = await db.prepare('SELECT * FROM offer_list_items WHERE id = ? AND offer_id = ?').get(req.params.itemId, req.params.id);
  if (!item) return res.status(404).json({ error: 'Kalem bulunamadı' });

  const clientPrice = req.body.clientPrice !== undefined ? Number(req.body.clientPrice) : item.client_price;
  const sortOrder = req.body.sortOrder !== undefined ? Number(req.body.sortOrder) : item.sort_order;
  if (!Number.isFinite(clientPrice) || clientPrice < 0) return res.status(400).json({ error: 'Müşteri fiyatı geçerli bir değer olmalı' });

  await db.prepare('UPDATE offer_list_items SET client_price = ?, sort_order = ? WHERE id = ?').run(clientPrice, sortOrder, item.id);
  await db.prepare("UPDATE offer_lists SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ items: await getOfferItemsAdmin(req.params.id) });
});

router.delete('/:id/items/:itemId', async (req, res) => {
  const result = await db.prepare('DELETE FROM offer_list_items WHERE id = ? AND offer_id = ?').run(req.params.itemId, req.params.id);
  if (!result.changes) return res.status(404).json({ error: 'Kalem bulunamadı' });
  await db.prepare("UPDATE offer_lists SET updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ items: await getOfferItemsAdmin(req.params.id) });
});

module.exports = router;
