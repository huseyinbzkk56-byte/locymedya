require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const db = require('./db/db');

const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const linksRoutes = require('./routes/links.routes');
const projectsRoutes = require('./routes/projects.routes');
const videosRoutes = require('./routes/videos.routes');
const cron = require('node-cron');
const { refreshActiveVideos } = require('./services/apify.service');
const paymentsRoutes = require('./routes/payments.routes');
const reportsRoutes = require('./routes/reports.routes');
const rulesRoutes = require('./routes/rules.routes');
const songsRoutes = require('./routes/songs.routes');
const publicRoutes = require('./routes/public.routes');
const adminMembersRoutes = require('./routes/admin-members.routes');
const presentationsRoutes = require('./routes/presentations.routes');
const audioRoutes = require('./routes/audio.routes');
const projectAssetsRoutes = require('./routes/project-assets.routes');
const coverRoutes = require('./routes/cover.routes');
const contactRoutes = require('./routes/contact.routes');
const offerAccountsRoutes = require('./routes/offer-accounts.routes');
const offersRoutes = require('./routes/offers.routes');
const campaignReportRoutes = require('./routes/campaign-report.routes');
const manualReportsRoutes = require('./routes/manual-reports.routes');
const { refreshAllManualReportVideos } = require('./routes/manual-reports.routes');
const path = require('path');

if (!process.env.JWT_SECRET) {
  console.error('HATA: .env dosyasında JWT_SECRET tanımlı değil. .env.example dosyasına bakın.');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../data')));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/links', linksRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/videos', videosRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/payment-rules', rulesRoutes);
app.use('/api/songs', songsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/admin-members', adminMembersRoutes);
app.use('/api/presentations', presentationsRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/project-assets', projectAssetsRoutes);
app.use('/api/covers', coverRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/offer-accounts', offerAccountsRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/campaign-reports', campaignReportRoutes);
app.use('/api/manual-reports', manualReportsRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

cron.schedule('0 * * * *', async () => {
  const result = await refreshActiveVideos();
  if (!result.skipped) console.log(`Apify metrik kontrolü tamamlandı: ${result.count} video`);
  const manualResult = await refreshAllManualReportVideos();
  if (!manualResult.skipped) console.log(`Manuel rapor metrik kontrolü tamamlandı: ${manualResult.count} video`);
});

// Genel hata yakalayıcı
app.use((err, req, res, next) => {
  console.error(err);
  if (err instanceof require('multer').MulterError || err.message?.includes('Kapak') || err.message?.includes('MP3')) return res.status(400).json({ error: err.message });
  res.status(500).json({ error: 'Sunucu hatası' });
});

const PORT = process.env.PORT || 4000;
db.init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`LOCYMEDYA backend http://localhost:${PORT} adresinde çalışıyor`);
    });
  })
  .catch((err) => {
    console.error('Veritabanı başlatılamadı:', err);
    process.exit(1);
  });
