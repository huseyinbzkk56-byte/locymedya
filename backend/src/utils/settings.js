const db = require('../db/db');

const VIEW_PAYMENT_RATE_KEY = 'view_payment_rate';
const PDF_BRAND_TITLE_KEY = 'pdf_brand_title';
const PDF_HEADER_TITLE_KEY = 'pdf_header_title';
const PDF_HEADER_SUBTITLE_KEY = 'pdf_header_subtitle';
const DEFAULT_HEADER_TITLE = 'LOCY MEDYA';
const DEFAULT_HEADER_SUBTITLE = 'PR & DIGITAL MEDIA';

function getViewPaymentRate() {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(VIEW_PAYMENT_RATE_KEY);
  return row ? Number(row.value) : 0.0015;
}

function setViewPaymentRate(rate) {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(VIEW_PAYMENT_RATE_KEY, String(rate));
}

function calculateEarning(views, rate = getViewPaymentRate()) {
  if (views === null || views === undefined) return null;
  return Math.round(Number(views) * rate * 100) / 100;
}

function getPdfBrandTitle() {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(PDF_BRAND_TITLE_KEY);
  return row ? row.value : '';
}

function setPdfBrandTitle(brandTitle) {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(PDF_BRAND_TITLE_KEY, String(brandTitle || '').trim().slice(0, 80));
}

function getPdfHeaderTitle() {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(PDF_HEADER_TITLE_KEY);
  return row && row.value ? row.value : DEFAULT_HEADER_TITLE;
}

function setPdfHeaderTitle(headerTitle) {
  const value = String(headerTitle || '').trim().slice(0, 80) || DEFAULT_HEADER_TITLE;
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(PDF_HEADER_TITLE_KEY, value);
}

function getPdfHeaderSubtitle() {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(PDF_HEADER_SUBTITLE_KEY);
  return row ? row.value : DEFAULT_HEADER_SUBTITLE;
}

function setPdfHeaderSubtitle(headerSubtitle) {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(PDF_HEADER_SUBTITLE_KEY, String(headerSubtitle || '').trim().slice(0, 80));
}

module.exports = {
  getViewPaymentRate, setViewPaymentRate, calculateEarning,
  getPdfBrandTitle, setPdfBrandTitle,
  getPdfHeaderTitle, setPdfHeaderTitle,
  getPdfHeaderSubtitle, setPdfHeaderSubtitle
};
