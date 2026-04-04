import express from 'express';

const router = express.Router();

// Distance-based cost estimation logic
router.post('/estimate', (req, res) => {
  const { distance } = req.body; // distance in km
  const km = Number(distance);

  if (!Number.isFinite(km) || km < 0) {
    return res.status(400).json({ message: 'Valid distance in km is required' });
  }

  const d = Math.max(km, 0.5); // avoid zero breaking display; treat as short hop

  // Rates in ₹ per km
  const rates = {
    bus: 2.5,
    train: 1.8,
    flight: 8.0, // Base + distance factor
    cab: 15.0
  };

  const costs = {
    bus: Math.round(d * rates.bus),
    train: Math.round(d * rates.train),
    flight: Math.round(3000 + d * rates.flight), // Base ₹3000 for flights
    cab: Math.round(d * rates.cab),
  };

  res.json(costs);
});

export default router;
