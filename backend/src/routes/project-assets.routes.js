const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { authenticate, requireRole } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../data/project-covers');
fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, callback) => callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${path.extname(file.originalname).toLowerCase()}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = file.mimetype.startsWith('image/');
    callback(allowed ? null : new Error('Sadece görsel dosyası yüklenebilir'), allowed);
  }
});

router.post('/cover', authenticate, requireRole('admin'), upload.single('cover'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kapak görseli zorunlu' });
  res.status(201).json({ coverUrl: `/uploads/project-covers/${req.file.filename}` });
});

module.exports = router;
