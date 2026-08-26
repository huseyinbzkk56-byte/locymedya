const hits = new Map();

function rateLimit({ windowMs, max }) {
  return (req, res, next) => {
    const key = req.ip;
    const now = Date.now();
    const timestamps = (hits.get(key) || []).filter((time) => now - time < windowMs);
    if (timestamps.length >= max) {
      return res.status(429).json({ error: 'Çok fazla istek gönderdiniz. Lütfen biraz sonra tekrar deneyin.' });
    }
    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}

module.exports = { rateLimit };
