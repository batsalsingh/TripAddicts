import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, IndianRupee, Heart } from 'lucide-react';
import { unsplashService } from '../services/api.js';
import {
  getFavoriteDestinations,
  toggleFavoriteDestination,
  addRecentDestination,
  getRecentDestinations,
} from '../utils/localTravelData.js';
import { conditionEmojiFromText, tempBandEmoji } from '../utils/weatherEmoji.js';
import { INDIA_DESTINATIONS as DESTINATIONS } from '../data/indiaDestinations.js';

const WEATHER_OPTIONS = [
  { value: 'any',  label: 'Any Weather 🌍' },
  { value: 'snowy', label: 'Snowy / winter ❄️' },
  { value: 'cool', label: 'Cool (5–15°C) 🧊' },
  { value: 'warm', label: 'Warm (15–29°C) 🌤️' },
  { value: 'hot',  label: 'Hot (29°C+) 🔥' },
];

/** Short queries reduce empty results and help stay under Unsplash rate limits (demo tier). */
function buildUnsplashQuery(dest, weatherPref) {
  const mood =
    weatherPref === 'snowy'
      ? 'snow winter'
      : weatherPref === 'cool'
        ? 'mountains hills'
        : weatherPref === 'warm'
          ? 'travel nature'
          : weatherPref === 'hot'
            ? 'landscape india'
            : 'travel';
  return `${dest.name} ${dest.state} India ${mood}`.trim();
}

function filterDestinationsByWeather(weatherPref, all) {
  if (weatherPref === 'any') return all;
  if (weatherPref === 'snowy') return all.filter((d) => d.snowy);
  return all.filter((d) => d.weatherType === weatherPref);
}

export default function Discover() {
  const navigate = useNavigate();
  const [weatherPref, setWeatherPref] = useState('warm');
  const [tripDuration, setTripDuration] = useState(5);
  const [photoById, setPhotoById] = useState({});
  const [photoLoading, setPhotoLoading] = useState(false);
  const [favorites, setFavorites] = useState(() => getFavoriteDestinations());
  const [recent, setRecent] = useState(() => getRecentDestinations());

  const displayed = useMemo(
    () => filterDestinationsByWeather(weatherPref, DESTINATIONS),
    [weatherPref]
  );

  const favoriteDestinations = useMemo(() => {
    const ids = new Set(favorites.map((f) => f.id));
    return DESTINATIONS.filter((d) => ids.has(d.id));
  }, [favorites]);

  const handleFavoriteClick = (e, dest) => {
    e.stopPropagation();
    e.preventDefault();
    setFavorites(toggleFavoriteDestination(dest));
  };

  useEffect(() => {
    let cancelled = false;
    const BATCH = 4;
    const PAUSE_MS = 400;

    (async () => {
      setPhotoLoading(true);
      setPhotoById({});
      const acc = {};
      for (let i = 0; i < displayed.length; i += BATCH) {
        if (cancelled) break;
        const chunk = displayed.slice(i, i + BATCH);
        await Promise.all(
          chunk.map(async (d) => {
            try {
              const { data } = await unsplashService.searchPhoto(buildUnsplashQuery(d, weatherPref));
              acc[d.id] = data?.url && typeof data.url === 'string' ? data.url : d.fallbackImage;
            } catch {
              acc[d.id] = d.fallbackImage;
            }
          })
        );
        if (!cancelled) setPhotoById((prev) => ({ ...prev, ...acc }));
        await new Promise((r) => setTimeout(r, PAUSE_MS));
      }
      if (!cancelled) setPhotoLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [displayed, weatherPref]);

  const handleDestinationClick = (dest) => {
    addRecentDestination(dest.name);
    setRecent(getRecentDestinations());
    const today = new Date();
    const end = new Date();
    end.setDate(today.getDate() + tripDuration);
    const fmt = (d) => d.toISOString().split('T')[0];
    navigate(
      `/dashboard?destination=${encodeURIComponent(dest.name)}&duration=${tripDuration}&start=${fmt(today)}&end=${fmt(end)}`
    );
  };

  const openRecentName = (name) => {
    const dest = DESTINATIONS.find((d) => d.name === name);
    if (dest) handleDestinationClick(dest);
    else {
      addRecentDestination(name);
      setRecent(getRecentDestinations());
      const today = new Date();
      const end = new Date();
      end.setDate(today.getDate() + tripDuration);
      const fmt = (d) => d.toISOString().split('T')[0];
      navigate(
        `/dashboard?destination=${encodeURIComponent(name)}&duration=${tripDuration}&start=${fmt(today)}&end=${fmt(end)}`
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950">
      {/* Hero / Search Section */}
      <div className="bg-white dark:bg-gray-900 border-b border-slate-100 dark:border-gray-800 py-14 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-3"
          >
            ✈️ Discover Your Next Destination
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-500 dark:text-slate-400 text-lg mb-10"
          >
            Find perfect destinations based on your weather preferences and travel duration
          </motion.p>

          {recent.length > 0 && (
            <div className="mb-8 text-left max-w-3xl mx-auto">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Recently opened 🕐
              </p>
              <div className="flex flex-wrap gap-2">
                {recent.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => openRecentName(name)}
                    className="px-3 py-1.5 rounded-full text-sm bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-600 text-slate-700 dark:text-slate-200 hover:border-cyan-500/60 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Preferences Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-700 rounded-2xl p-6 text-left shadow-sm"
          >
            <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-0.5">🔍 Search Preferences</h3>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">
              Tell us what kind of weather you prefer and how long you want to travel
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Weather Preference
                </label>
                <select
                  value={weatherPref}
                  onChange={(e) => setWeatherPref(e.target.value)}
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all text-sm"
                >
                  {WEATHER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Trip Duration (days)
                </label>
                <input
                  type="number"
                  value={tripDuration}
                  onChange={(e) => setTripDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  max="30"
                  className="w-full px-4 py-3 bg-white dark:bg-gray-700 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-all text-sm"
                />
              </div>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mt-1">
              The list below updates as you change weather — showing all matching places ({displayed.length} right now).
            </p>
          </motion.div>
        </div>
      </div>

      {/* Destinations Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {favoriteDestinations.length > 0 && (
          <div className="mb-10">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Heart className="w-5 h-5 text-rose-500 fill-rose-500/30" />
              Saved favorites
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoriteDestinations.map((dest) => (
                <button
                  key={dest.id}
                  type="button"
                  onClick={() => handleDestinationClick(dest)}
                  className="text-left p-4 rounded-2xl bg-rose-50/80 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/40 hover:shadow-md transition-all"
                >
                  <p className="font-bold text-slate-900 dark:text-white">{dest.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{dest.state}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            🎯 Destinations for your weather
          </h2>
          <div className="flex items-center gap-2">
            {photoLoading && (
              <span className="text-xs text-cyan-600 dark:text-cyan-400 animate-pulse">📷 Loading photos…</span>
            )}
            <span className="text-sm text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-gray-800 px-3 py-1 rounded-full">
              {displayed.length} places
            </span>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {displayed.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              <div className="text-6xl mb-4">🏜️</div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No destinations found</h3>
              <p className="text-slate-500 dark:text-slate-400">Try a different weather preference</p>
            </motion.div>
          ) : (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {displayed.map((dest, i) => {
                const estimatedCost = dest.costPerDay * tripDuration;
                return (
                  <motion.div
                    key={dest.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 0.45) }}
                    whileHover={{ y: -4 }}
                    onClick={() => handleDestinationClick(dest)}
                    className="bg-white dark:bg-gray-900 border border-slate-100 dark:border-gray-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl dark:hover:shadow-cyan-900/20 transition-all cursor-pointer group"
                  >
                    {/* Image */}
                    <div className="relative h-52 overflow-hidden bg-gradient-to-br from-slate-200 to-slate-300 dark:from-gray-700 dark:to-gray-800">
                      <button
                        type="button"
                        onClick={(e) => handleFavoriteClick(e, dest)}
                        className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full bg-black/40 hover:bg-black/55 backdrop-blur-sm flex items-center justify-center transition-colors"
                        title={favorites.some((f) => f.id === dest.id) ? 'Remove from favorites' : 'Save place'}
                      >
                        <Heart
                          className={`w-5 h-5 ${
                            favorites.some((f) => f.id === dest.id)
                              ? 'text-rose-400 fill-rose-500'
                              : 'text-white/90'
                          }`}
                        />
                      </button>
                      <img
                        src={photoById[dest.id] || dest.fallbackImage}
                        alt={dest.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          e.currentTarget.src = dest.fallbackImage;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                      {/* Tags */}
                      <div className="absolute bottom-3 left-3 flex flex-wrap gap-1">
                        {dest.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-xs bg-black/30 backdrop-blur-sm text-white px-2 py-0.5 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Card Content */}
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-4 h-4 text-cyan-500 flex-shrink-0" />
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">{dest.name}</h3>
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 ml-5">{dest.state}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xl" title={dest.condition}>
                              {conditionEmojiFromText(dest.condition)}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                              {dest.temp}°C {tempBandEmoji(dest.temp)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 dark:text-slate-500 capitalize text-right">{dest.condition}</p>
                        </div>
                      </div>

                      {/* Cost */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-gray-800">
                        <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <IndianRupee className="w-3.5 h-3.5" />
                          <span className="text-xs">Estimated Cost</span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">
                            ₹{estimatedCost.toLocaleString('en-IN')}
                          </span>
                          <p className="text-xs text-slate-400 dark:text-slate-500">for {tripDuration} days</p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
