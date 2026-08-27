const express = require('express');
const multer = require('multer');
const { authenticate, requireRole } = require('../middleware/auth');
const { uploadBuffer } = require('../services/storage.service');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const allowed = file.mimetype.startsWith('image/');
    callback(allowed ? null : new Error('Sadece görsel dosyası yüklenebilir'), allowed);
  }
});

router.post('/cover', authenticate, requireRole('admin'), upload.single('cover'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Kapak görseli zorunlu' });
  const result = await uploadBuffer(req.file.buffer, { folder: 'locymedya/project-covers', resourceType: 'image' });
  res.status(201).json({ coverUrl: result.secure_url });
});

module.exports = router;
