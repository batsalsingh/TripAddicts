import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin, Calendar, IndianRupee, Users, Sparkles,
  ChevronDown, ChevronUp, Lightbulb, Hotel, Clock, Map,
  Copy, Share2,
} from 'lucide-react';
import { planService } from '../services/api.js';
import PreTripChecklist from '../components/PreTripChecklist.jsx';
import { buildItineraryExportText } from '../utils/itineraryExport.js';

const INTEREST_OPTIONS = [
  { value: 'adventure', label: '🏔️ Adventure' },
  { value: 'culture', label: '🏛️ Culture & History' },
  { value: 'food', label: '🍛 Food & Cuisine' },
  { value: 'nature', label: '🌿 Nature & Wildlife' },
  { value: 'shopping', label: '🛍️ Shopping' },
  { value: 'relaxation', label: '🧘 Relaxation' },
  { value: 'photography', label: '📸 Photography' },
  { value: 'spiritual', label: '🕌 Spiritual' },
];

const ACTIVITY_EMOJI = ['📍', '🍽️', '🎫', '🚶', '🌅', '🎉', '🛍️', '📸', '☕', '🎭'];

function withEmojiPrefix(text, i) {
  if (!text) return text;
  const t = text.trim();
  if (/^[\u{1F300}-\u{1FAFF}]/u.test(t)) return text;
  return `${ACTIVITY_EMOJI[i % ACTIVITY_EMOJI.length]} ${text}`;
}

function DayCard({ day, index }) {
  const [open, setOpen] = useState(index === 0);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            D{day.day}
          </div>
          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider">Day {day.day}</p>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">{day.theme || `Explore & Discover`}</h3>
          </div>
        </div>
        <div className="text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">
          {open ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-3 border-t border-slate-100 dark:border-gray-800 pt-4">
              {day.activities.map((act, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm">
                    {i + 1}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    {withEmojiPrefix(act, i)}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ItineraryPage() {
  const [form, setForm] = useState({
    destination: '',
    budget: '',
    startDate: '',
    endDate: '',
    people: 1,
    interests: [],
  });
  const [itinerary, setItinerary] = useState(null);
  const [hotels, setHotels] = useState([]);
  const [tips, setTips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportHint, setExportHint] = useState('');

  const toggleInterest = (val) => {
    setForm((f) => ({
      ...f,
      interests: f.interests.includes(val)
        ? f.interests.filter((i) => i !== val)
        : [...f.interests, val],
    }));
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!form.destination.trim()) return;
    setLoading(true);
    setError('');
    setItinerary(null);
    try {
      const res = await planService.generatePlan({
        destination: form.destination,
        budget: form.budget,
        startDate: form.startDate,
        endDate: form.endDate,
        people: form.people,
        preferences: form.interests.join(', '),
      });
      setItinerary(res.data.itinerary || []);
      setHotels(res.data.hotels || []);
      setTips(res.data.tips || []);
    } catch (err) {
      setError('Failed to generate itinerary. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const days = form.startDate && form.endDate
    ? Math.ceil((new Date(form.endDate) - new Date(form.startDate)) / (1000 * 60 * 60 * 24))
    : null;

  const tripMapHref = useMemo(() => {
    const q = new URLSearchParams();
    const dest = form.destination?.trim();
    if (dest) q.set('destination', dest);
    if (form.startDate) q.set('start', form.startDate);
    if (form.endDate) q.set('end', form.endDate);
    const s = q.toString();
    return s ? `/dashboard?${s}` : '/dashboard';
  }, [form.destination, form.startDate, form.endDate]);

  const exportPayload = useMemo(
    () => ({
      destination: form.destination,
      days,
      people: form.people,
      budget: form.budget,
      itinerary,
      hotels,
      tips,
    }),
    [form.destination, form.people, form.budget, days, itinerary, hotels, tips]
  );

  const handleCopyItinerary = async () => {
    if (!itinerary?.length) return;
    const text = buildItineraryExportText(exportPayload);
    try {
      await navigator.clipboard.writeText(text);
      setExportHint('Copied to clipboard');
      setTimeout(() => setExportHint(''), 2500);
    } catch {
      setExportHint('Could not copy — try another browser');
      setTimeout(() => setExportHint(''), 3000);
    }
  };

  const handleShareItinerary = async () => {
    if (!itinerary?.length) return;
    const text = buildItineraryExportText(exportPayload);
    const title = `Trip — ${form.destination || 'TripAddicts'}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        setExportHint('Shared');
        setTimeout(() => setExportHint(''), 2000);
      } else {
        await handleCopyItinerary();
      }
    } catch (err) {
      if (err?.name !== 'AbortError') await handleCopyItinerary();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-gray-800 py-10 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 text-purple-600 dark:text-purple-400 text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              Smart AI itinerary
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-2">
              🤖 AI Itinerary Generator
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              Get a personalized, day-by-day travel plan crafted by AI
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link
                to={tripMapHref}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-bold shadow-md hover:opacity-90 transition-opacity"
              >
                <Map className="w-4 h-4" />
                Open trip map
              </Link>
              <span className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
                Uses destination & dates when set — routes & costs on the map 🗺️
              </span>
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form */}
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl p-6 shadow-sm sticky top-24"
            >
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-cyan-500" />
                Trip Details
              </h2>

              <form onSubmit={handleGenerate} className="space-y-4">
                {/* Destination */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Destination *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.destination}
                    onChange={(e) => setForm({ ...form, destination: e.target.value })}
                    placeholder="e.g. Shimla, Goa, Jaipur"
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all placeholder-slate-400"
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      <Calendar className="w-3 h-3 inline mr-1" />Start
                    </label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      <Calendar className="w-3 h-3 inline mr-1" />End
                    </label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Budget + People */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      <IndianRupee className="w-3 h-3 inline mr-1" />Budget
                    </label>
                    <input
                      type="number"
                      value={form.budget}
                      onChange={(e) => setForm({ ...form, budget: e.target.value })}
                      placeholder="20000"
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                      <Users className="w-3 h-3 inline mr-1" />People
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.people}
                      onChange={(e) => setForm({ ...form, people: e.target.value })}
                      className="w-full px-3 py-2.5 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all"
                    />
                  </div>
                </div>

                {/* Interests */}
                <div>
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    Interests
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleInterest(opt.value)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          form.interests.includes(opt.value)
                            ? 'bg-cyan-500 text-white shadow-sm'
                            : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs rounded-xl border border-red-100 dark:border-red-800">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !form.destination.trim()}
                  className="w-full py-3 bg-gradient-to-r from-purple-500 to-cyan-500 text-white rounded-xl font-bold text-sm transition-all shadow-md hover:shadow-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      Generate Itinerary
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6">
                <PreTripChecklist />
              </div>
            </motion.div>
          </div>

          {/* Results */}
          <div className="lg:col-span-3 space-y-6">
            {loading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20"
              >
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-4 border-purple-200 dark:border-purple-800 animate-spin border-t-purple-500"></div>
                  <div className="absolute inset-0 flex items-center justify-center text-2xl">🤖</div>
                </div>
                <p className="mt-6 text-slate-600 dark:text-slate-400 font-medium">
                  AI is crafting your perfect itinerary...
                </p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">This may take a few seconds</p>
              </motion.div>
            )}

            {!loading && !itinerary && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="text-6xl mb-4">🗺️</div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Ready to plan your trip?</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm">
                  Fill in your destination and preferences, then let AI create your perfect travel itinerary.
                </p>
              </motion.div>
            )}

            {!loading && itinerary && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {/* Summary Banner */}
                <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 dark:from-purple-900/30 dark:to-cyan-900/30 border border-purple-100 dark:border-purple-800/50 rounded-2xl p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <MapPin className="w-4 h-4 text-cyan-500" />
                      <span className="font-bold">{form.destination}</span>
                    </div>
                    {days && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
                        <Clock className="w-4 h-4" />
                        <span>{days} days</span>
                      </div>
                    )}
                    {form.people > 1 && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
                        <Users className="w-4 h-4" />
                        <span>{form.people} people</span>
                      </div>
                    )}
                    {form.budget && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
                        <IndianRupee className="w-4 h-4" />
                        <span>₹{parseInt(form.budget).toLocaleString('en-IN')}</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyItinerary}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold hover:opacity-90 transition-opacity"
                    >
                      <Copy className="w-4 h-4" />
                      Copy plan
                    </button>
                    <button
                      type="button"
                      onClick={handleShareItinerary}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </button>
                    {exportHint && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">{exportHint}</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    ✨ Export as plain text — paste into notes, mail, or chat
                  </p>
                </div>

                {/* Day Cards */}
                <div className="space-y-3">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    📅 Your Itinerary
                  </h2>
                  {itinerary.map((day, i) => (
                    <DayCard key={day.day} day={day} index={i} />
                  ))}
                </div>

                {/* Hotels */}
                {hotels.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Hotel className="w-5 h-5 text-cyan-500" />
                      Suggested Stays 🏨
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {hotels.map((hotel, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-xl shadow-sm"
                        >
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white text-sm">{hotel.name}</p>
                            <span className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-gray-800 px-2 py-0.5 rounded-full">{hotel.type}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-slate-900 dark:text-white">₹{hotel.price?.toLocaleString('en-IN')}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">per night</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tips */}
                {tips.length > 0 && (
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                      Travel Tips 💡
                    </h2>
                    <div className="space-y-2">
                      {tips.map((tip, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/30 rounded-xl"
                        >
                          <span className="text-amber-500 font-bold text-sm flex-shrink-0 mt-0.5">{i + 1}.</span>
                          <p className="text-sm text-slate-700 dark:text-slate-300">{tip}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
