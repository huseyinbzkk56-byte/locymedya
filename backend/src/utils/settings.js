const db = require('../db/db');

const VIEW_PAYMENT_RATE_KEY = 'view_payment_rate';
const PDF_BRAND_TITLE_KEY = 'pdf_brand_title';
const PDF_HEADER_TITLE_KEY = 'pdf_header_title';
const PDF_HEADER_SUBTITLE_KEY = 'pdf_header_subtitle';
const DEFAULT_HEADER_TITLE = 'LOCY MEDYA';
const DEFAULT_HEADER_SUBTITLE = 'PR & DIGITAL MEDIA';

async function getViewPaymentRate() {
  const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?').get(VIEW_PAYMENT_RATE_KEY);
  return row ? Number(row.value) : 0.0015;
}

async function setViewPaymentRate(rate) {
  await db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(VIEW_PAYMENT_RATE_KEY, String(rate));
}

function calculateEarningSync(views, rate) {
  if (views === null || views === undefined) return null;
  return Math.round(Number(views) * rate * 100) / 100;
}

async function calculateEarning(views) {
  const rate = await getViewPaymentRate();
  return calculateEarningSync(views, rate);
}

async function getPdfBrandTitle() {
  const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?').get(PDF_BRAND_TITLE_KEY);
  return row ? row.value : '';
}

async function setPdfBrandTitle(brandTitle) {
  await db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(PDF_BRAND_TITLE_KEY, String(brandTitle || '').trim().slice(0, 80));
}

async function getPdfHeaderTitle() {
  const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?').get(PDF_HEADER_TITLE_KEY);
  return row && row.value ? row.value : DEFAULT_HEADER_TITLE;
}

async function setPdfHeaderTitle(headerTitle) {
  const value = String(headerTitle || '').trim().slice(0, 80) || DEFAULT_HEADER_TITLE;
  await db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(PDF_HEADER_TITLE_KEY, value);
}

async function getPdfHeaderSubtitle() {
  const row = await db.prepare('SELECT value FROM app_settings WHERE key = ?').get(PDF_HEADER_SUBTITLE_KEY);
  return row ? row.value : DEFAULT_HEADER_SUBTITLE;
}

async function setPdfHeaderSubtitle(headerSubtitle) {
  await db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(PDF_HEADER_SUBTITLE_KEY, String(headerSubtitle || '').trim().slice(0, 80));
}

module.exports = {
  getViewPaymentRate, setViewPaymentRate, calculateEarning, calculateEarningSync,
  getPdfBrandTitle, setPdfBrandTitle,
  getPdfHeaderTitle, setPdfHeaderTitle,
  getPdfHeaderSubtitle, setPdfHeaderSubtitle
};
