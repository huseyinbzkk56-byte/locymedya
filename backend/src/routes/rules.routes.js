const express = require('express');
const { authenticate, requireRole, requireFullAdmin } = require('../middleware/auth');
const { getViewPaymentRate, setViewPaymentRate } = require('../utils/settings');

const router = express.Router();
router.use(authenticate, requireRole('admin'), requireFullAdmin);

router.get('/', async (req, res) => {
  res.json({ ratePerView: await getViewPaymentRate() });
});

router.put('/', async (req, res) => {
  const rate = Number(req.body.ratePerView);
  if (!Number.isFinite(rate) || rate < 0) return res.status(400).json({ error: 'Geçerli bir oran girin (0 veya üzeri)' });
  await setViewPaymentRate(rate);
  res.json({ ratePerView: await getViewPaymentRate() });
});

module.exports = router;
