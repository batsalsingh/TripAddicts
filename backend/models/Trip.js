import mongoose from 'mongoose';

const tripSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  origin: { type: String, default: '' },
  destination: { type: String, required: true },
  budget: { type: Number, required: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  itinerary: [{
    day: Number,
    activities: [String]
  }],
  costs: {
    bus: Number,
    train: Number,
    flight: Number,
    cab: Number
  },
  weather: Object,
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Trip', tripSchema);
