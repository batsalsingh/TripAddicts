import express from 'express';
import auth from '../middleware/auth.js';
import Trip from '../models/Trip.js';

const router = express.Router();

router.post('/', auth, async (req, res) => {
  try {
    const { origin, destination, budget, startDate, endDate, itinerary, costs, weather } = req.body;
    const newTrip = new Trip({
      userId: req.user,
      origin: origin || '',
      destination,
      budget,
      startDate,
      endDate,
      itinerary,
      costs,
      weather
    });
    const savedTrip = await newTrip.save();
    res.json(savedTrip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', auth, async (req, res) => {
  try {
    const trips = await Trip.find({ userId: req.user }).sort({ createdAt: -1 });
    res.json(trips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const trip = await Trip.findOne({ _id: req.params.id, userId: req.user });
    if (!trip) return res.status(404).json({ message: 'Trip not found' });
    res.json(trip);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
