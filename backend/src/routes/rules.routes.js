const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const { getViewPaymentRate, setViewPaymentRate } = require('../utils/settings');

const router = express.Router();
router.use(authenticate, requireRole('admin'));

router.get('/', (req, res) => {
  res.json({ ratePerView: getViewPaymentRate() });
});

router.put('/', (req, res) => {
  const rate = Number(req.body.ratePerView);
  if (!Number.isFinite(rate) || rate < 0) return res.status(400).json({ error: 'Geçerli bir oran girin (0 veya üzeri)' });
  setViewPaymentRate(rate);
  res.json({ ratePerView: getViewPaymentRate() });
});

module.exports = router;
