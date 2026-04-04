import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Map } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

const features = [
  { emoji: '🗺️', title: 'Smart mapping', description: 'Interactive maps with routes — open Trip Map anytime from the nav.' },
  { emoji: '🤖', title: 'AI itineraries', description: 'Day-by-day plans from our AI engine — tuned to your dates, budget, and interests.' },
  { emoji: '🌤️', title: 'Weather-smart discover', description: 'Pick a climate, browse places, and see photos matched to the vibe.' },
  { emoji: '❤️', title: 'Favorites & recents', description: 'Save places you love and jump back to recent destinations — stored on your device.' },
  { emoji: '📋', title: 'Export & checklist', description: 'Copy or share your full plan as text, plus a pre-trip checklist.' },
  { emoji: '💸', title: 'Split expenses', description: 'Splitwise-style balances & settle-up for group trips.' },
];

export default function Home() {
  const { user } = useAuth();

  const discoverTo = user ? '/discover' : '/login';
  const planTo = user ? '/itinerary' : '/login';
  const mapTo = user ? '/dashboard' : '/login';

  return (
    <div className="relative overflow-hidden">
      <section className="relative min-h-[calc(100vh-64px)] flex items-center justify-center px-4 bg-gradient-to-b from-slate-100 to-slate-200 dark:from-[#1a2238] dark:to-[#0f1424] text-slate-900 dark:text-white">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/5 w-[420px] h-[420px] bg-[#00a8e8]/20 dark:bg-[#00a8e8]/15 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/5 w-[380px] h-[380px] bg-indigo-400/15 dark:bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto text-center py-16 md:py-24">
          <motion.div initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75 }}>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-tight">
              <span className="text-slate-900 dark:text-white">Plan Your Perfect </span>
              <span className="bg-gradient-to-r from-teal-600 via-[#00a8e8] to-sky-500 dark:from-[#5eead4] dark:via-[#00a8e8] dark:to-[#38bdf8] bg-clip-text text-transparent">
                Journey ✈️
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
              Discover destinations based on weather ☀️, create detailed itineraries 📝, and manage group trips with ease.
              Your adventure starts here! 🎉
            </p>

            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-center gap-3 max-w-2xl mx-auto">
              <Link
                to={discoverTo}
                className="w-full sm:flex-1 sm:min-w-[200px] px-6 py-4 bg-[#00a8e8] hover:bg-[#0096cf] text-white rounded-full font-bold text-base sm:text-lg transition-all shadow-lg shadow-[#00a8e8]/25 flex items-center justify-center gap-2"
              >
                <MapPin className="w-5 h-5 shrink-0" />
                Discover
              </Link>
              <Link
                to={planTo}
                className="w-full sm:flex-1 sm:min-w-[200px] px-6 py-4 bg-transparent border-2 border-slate-400 dark:border-slate-500/80 text-slate-800 dark:text-white rounded-full font-bold text-base sm:text-lg hover:bg-white/60 dark:hover:bg-white/5 hover:border-slate-500 dark:hover:border-slate-400 transition-all flex items-center justify-center gap-2"
              >
                <Calendar className="w-5 h-5 shrink-0" />
                Plan a Trip
              </Link>
              <Link
                to={mapTo}
                className="w-full sm:flex-1 sm:min-w-[200px] px-6 py-4 bg-slate-800/90 dark:bg-slate-700/90 text-white rounded-full font-bold text-base sm:text-lg border border-slate-600/50 hover:bg-slate-700 dark:hover:bg-slate-600 transition-all flex items-center justify-center gap-2 shadow-md"
              >
                <Map className="w-5 h-5 shrink-0" />
                Trip map
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-500 max-w-md mx-auto">
              Plan a Trip opens the AI itinerary; Trip map opens routes & costs on the interactive map 🗺️
            </p>

            {!user && (
              <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
                New here?{' '}
                <Link to="/signup" className="text-[#00a8e8] dark:text-[#5eead4] font-semibold hover:underline">
                  Create an account
                </Link>{' '}
                to unlock Discover & AI planning 🔓
              </p>
            )}
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-slate-100 dark:bg-[#0b1120] border-t border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">
              Why TripAddicts? 🌍
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto text-lg">
              Everything you need for a perfect trip — in one calm, beautiful hub.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.08 }}
                whileHover={{ y: -3 }}
                className="p-6 rounded-2xl bg-white dark:bg-[#151d32] border border-slate-200/80 dark:border-slate-700/80 hover:border-[#00a8e8]/40 transition-all shadow-sm"
              >
                <div className="text-4xl mb-3">{feature.emoji}</div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">{feature.title}</h3>
                <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
