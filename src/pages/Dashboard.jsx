import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Map as MapIcon,
  Cloud,
  Navigation,
  Calendar,
  DollarSign,
  Users,
  Hotel,
  Plus,
  Search,
  Bus,
  Train,
  Plane,
  Car,
  Save,
  CheckCircle
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { costService, weatherService, tripService, planService } from '../services/api.js';
import { openWeatherEmojiLine, conditionEmojiFromOpenWeather, tempBandEmoji } from '../utils/weatherEmoji.js';
import { resolveTouristCanonicalCoords } from '../data/indiaTouristCanonical.js';

/** India-first search + northern tie-break for duplicate names (e.g. Manali HP vs MH). */
async function geocodeCity(query) {
  const trimmed = query.trim();
  if (!trimmed) throw new Error('Empty place name');

  const canon = resolveTouristCanonicalCoords(trimmed);
  if (canon) return canon;

  const tryQueries = trimmed.includes(',')
    ? [trimmed, `${trimmed.split(',')[0].trim()}, India`]
    : [`${trimmed}, India`, trimmed];

  const stem = trimmed.split(',')[0].trim().toLowerCase();

  for (const q of tryQueries) {
    const params = new URLSearchParams({
      q,
      format: 'jsonv2',
      limit: '12',
      countrycodes: 'in',
    });
    const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'TripAddicts/1.0' },
    });
    const geoData = await geoRes.json();
    if (!Array.isArray(geoData) || !geoData.length) continue;

    let rows = geoData.filter((d) => (d.name || '').toLowerCase() === stem);
    if (!rows.length) rows = geoData;
    if (rows.length > 1) {
      rows = [...rows].sort((a, b) => parseFloat(b.lat) - parseFloat(a.lat));
    }

    const pick = rows[0];
    if (pick?.lat != null && pick?.lon != null) {
      return { lat: parseFloat(pick.lat), lon: parseFloat(pick.lon) };
    }
  }

  throw new Error(`Could not find location: "${query}"`);
}

// Fix Leaflet default marker icon broken paths in Vite
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Colored circle marker factory
const createColoredMarker = (color) =>
  L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35)"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -14],
  });

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('itinerary');
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [budget, setBudget] = useState('');
  const [dates, setDates] = useState({ start: '', end: '' });
  const [peopleCount, setPeopleCount] = useState(1);
  const [error, setError] = useState('');

  const [tripData, setTripData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [userLocation, setUserLocation] = useState(null); // [lng, lat]

  const mapContainer = useRef(null);
  const map = useRef(null);
  const markersRef = useRef([]);
  const routeLineRef = useRef(null);

  const handleSaveTrip = async () => {
    if (!tripData) return;
    setSaving(true);
    try {
      await tripService.createTrip({
        origin: tripData.origin || '',
        destination: tripData.destination,
        budget: parseInt(budget),
        startDate: dates.start,
        endDate: dates.end,
        itinerary: tripData.itinerary,
        costs: tripData.costs,
        weather: tripData.weather,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving trip:', err);
    } finally {
      setSaving(false);
    }
  };

  // Deep-link from Discover / Itinerary (prefill only — map code unchanged)
  useEffect(() => {
    const from = searchParams.get('from');
    const dest = searchParams.get('destination');
    const start = searchParams.get('start');
    const end = searchParams.get('end');
    if (from) setOrigin((o) => o || from);
    if (dest) setDestination((d) => d || dest);
    if (start || end) {
      setDates((prev) => ({
        ...prev,
        ...(start ? { start } : {}),
        ...(end ? { end } : {}),
      }));
    }
  }, [searchParams]);

  // Get user geolocation once on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation([pos.coords.longitude, pos.coords.latitude]),
        (err) => console.warn('Geolocation unavailable:', err.message)
      );
    }
  }, []);

  // Initialize Leaflet map once
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = L.map(mapContainer.current, { zoomControl: true }).setView(
      [28.6139, 77.209], // Default: New Delhi
      9
    );

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map.current);

    return () => {
      map.current.remove();
      map.current = null;
    };
  }, []);

  // Pan to user location when it arrives (without recreating the map)
  useEffect(() => {
    if (userLocation && map.current) {
      map.current.setView([userLocation[1], userLocation[0]], 10);
    }
  }, [userLocation]);

  const handlePlanTrip = async (e) => {
    e.preventDefault();
    if (!origin.trim() || !destination.trim()) {
      setError('Please enter both where you are traveling from and where you are going.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const fromLabel = origin.trim();
      const toLabel = destination.trim();

      const [geoFrom, geoTo] = await Promise.all([
        geocodeCity(fromLabel),
        geocodeCity(toLabel),
      ]);

      const originLat = geoFrom.lat;
      const originLon = geoFrom.lon;
      const destLat = geoTo.lat;
      const destLon = geoTo.lon;
      const destCoords = [destLon, destLat]; // [lng, lat] for internal consistency
      const originCoords = [originLon, originLat];

      const distance = calculateDistance(originLat, originLon, destLat, destLon);

      // 3. Get cost estimates
      const costRes = await costService.estimate(distance);

      // 4. Get weather
      const weatherRes = await weatherService.getWeather(toLabel, { lat: destLat, lon: destLon });

      // 5. Generate itinerary & hotels from backend
      const planRes = await planService.generatePlan({
        origin: fromLabel,
        destination: toLabel,
        budget,
        startDate: dates.start,
        endDate: dates.end,
      });
      const { itinerary, hotels: suggestedHotels } = planRes.data;

      // 6. Scatter hotel coords near destination
      const hotels = suggestedHotels.map((h) => ({
        ...h,
        coords: [
          destLon + (Math.random() - 0.5) * 0.04,
          destLat + (Math.random() - 0.5) * 0.04,
        ],
      }));

      setTripData({
        origin: fromLabel,
        destination: toLabel,
        originCoords,
        destCoords,
        distance: Math.round(distance),
        costs: costRes.data,
        weather: weatherRes.data,
        itinerary,
        hotels,
      });

      // 7. Update Leaflet map
      if (map.current) {
        // Clear old markers and route
        markersRef.current.forEach((m) => m.remove());
        markersRef.current = [];
        if (routeLineRef.current) {
          routeLineRef.current.remove();
          routeLineRef.current = null;
        }

        const bounds = L.latLngBounds(
          [originLat, originLon],
          [destLat, destLon]
        );
        map.current.fitBounds(bounds, { padding: [56, 56], maxZoom: 12 });

        const originMarker = L.marker([originLat, originLon], {
          icon: createColoredMarker('#10b981'),
        })
          .bindPopup(`<strong style="font-size:14px">From: ${fromLabel}</strong>`)
          .addTo(map.current);
        markersRef.current.push(originMarker);

        const destMarker = L.marker([destLat, destLon], {
          icon: createColoredMarker('#4f46e5'),
        })
          .bindPopup(`<strong style="font-size:14px">To: ${toLabel}</strong>`)
          .addTo(map.current);
        markersRef.current.push(destMarker);

        // Hotel markers (purple)
        hotels.forEach((hotel) => {
          const hotelMarker = L.marker([hotel.coords[1], hotel.coords[0]], {
            icon: createColoredMarker('#9333ea'),
          })
            .bindPopup(
              `<strong>${hotel.name}</strong><br/>₹${hotel.price}/night`
            )
            .addTo(map.current);
          markersRef.current.push(hotelMarker);
        });

        // Route line from origin to destination
        routeLineRef.current = L.polyline(
          [
            [originLat, originLon],
            [destLat, destLon],
          ],
          { color: '#4f46e5', weight: 4, dashArray: '10, 6', opacity: 0.8 }
        ).addTo(map.current);
      }
    } catch (err) {
      console.error('Error planning trip:', err);
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Something went wrong. Please try again.';
      setError(typeof msg === 'string' ? msg : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 text-slate-900 dark:text-slate-100">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Planning Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 p-6">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 flex items-center">
              <Plus className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
              Plan New Trip
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
              Map + quick plan here. For interests &amp; full AI details →{' '}
              <Link to="/itinerary" className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline">
                AI Itinerary ✨
              </Link>
            </p>
            <form onSubmit={handlePlanTrip} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Traveling from</label>
                <div className="relative">
                  <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    placeholder="City or place you're leaving from"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Going to</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="Destination city or place"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Budget (₹)</label>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="e.g. 20000"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">People</label>
                  <input
                    type="number"
                    value={peopleCount}
                    onChange={(e) => setPeopleCount(e.target.value)}
                    min="1"
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
                  <input
                    type="date"
                    value={dates.start}
                    onChange={(e) => setDates({...dates, start: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">End Date</label>
                  <input
                    type="date"
                    value={dates.end}
                    onChange={(e) => setDates({...dates, end: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 dark:bg-gray-800 border border-slate-200 dark:border-gray-600 rounded-xl text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-xl text-sm font-medium border border-red-100 dark:border-red-900/50">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 dark:bg-indigo-500 text-white rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all shadow-sm disabled:opacity-50"
              >
                {loading ? 'Analyzing...' : 'Generate Plan'}
              </button>
            </form>
          </div>

          {tripData && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 p-6"
            >
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center">
                <Navigation className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" />
                Trip Summary
              </h3>
              <div className="space-y-4">
                <div className="p-3 bg-slate-50 dark:bg-gray-800/80 rounded-xl space-y-1">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Route</span>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">
                    <span className="text-emerald-600 dark:text-emerald-400">{tripData.origin}</span>
                    <span className="text-slate-400 dark:text-slate-500 mx-1.5">→</span>
                    <span className="text-indigo-600 dark:text-indigo-400">{tripData.destination}</span>
                  </p>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-gray-800/80 rounded-xl">
                  <span className="text-slate-600 dark:text-slate-400">Distance</span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{tripData.distance} km</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-gray-800/80 rounded-xl">
                  <span className="text-slate-600 dark:text-slate-400">Weather (destination)</span>
                  <div className="flex flex-col items-end text-right">
                    {(() => {
                      const { title, description } = openWeatherEmojiLine(tripData.weather);
                      return (
                        <>
                          <span className="font-bold text-slate-900 dark:text-white" title={description}>
                            {title}
                          </span>
                          <span className="text-sm text-slate-500 dark:text-slate-400 capitalize">{description}</span>
                          {tripData.weather.elevation_m != null && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 block">
                              Model elevation ~{Math.round(tripData.weather.elevation_m)} m
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-100 dark:border-gray-700">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 uppercase tracking-wider">Travel Estimates</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 border border-slate-100 dark:border-gray-700 rounded-xl flex flex-col items-center">
                      <Bus className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">Bus</span>
                      <span className="font-bold text-slate-900 dark:text-white">₹{tripData.costs.bus}</span>
                    </div>
                    <div className="p-3 border border-slate-100 dark:border-gray-700 rounded-xl flex flex-col items-center">
                      <Train className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">Train</span>
                      <span className="font-bold text-slate-900 dark:text-white">₹{tripData.costs.train}</span>
                    </div>
                    <div className="p-3 border border-slate-100 dark:border-gray-700 rounded-xl flex flex-col items-center">
                      <Plane className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">Flight</span>
                      <span className="font-bold text-slate-900 dark:text-white">₹{tripData.costs.flight}</span>
                    </div>
                    <div className="p-3 border border-slate-100 dark:border-gray-700 rounded-xl flex flex-col items-center">
                      <Car className="w-5 h-5 text-slate-400 mb-1" />
                      <span className="text-xs text-slate-500 dark:text-slate-400">Cab</span>
                      <span className="font-bold text-slate-900 dark:text-white">₹{tripData.costs.cab}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleSaveTrip}
                  disabled={saving}
                  className={`w-full py-3 rounded-xl font-bold transition-all flex items-center justify-center space-x-2 ${
                    saveSuccess 
                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' 
                    : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-100 dark:border-indigo-800'
                  }`}
                >
                  {saveSuccess ? (
                    <>
                      <CheckCircle className="w-5 h-5" />
                      <span>Trip Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      <span>{saving ? 'Saving...' : 'Save to My Trips'}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right Column: Map and Tabs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Map Container */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden h-[400px] relative">
            <div ref={mapContainer} className="w-full h-full" />
            {!tripData && (
              <div className="absolute inset-0 bg-slate-900/10 dark:bg-black/30 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                <div className="bg-white/90 dark:bg-gray-800/95 px-6 py-3 rounded-full shadow-lg border border-white/50 dark:border-gray-600 flex items-center space-x-2">
                  <MapIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <span className="font-medium text-slate-700 dark:text-slate-200">Enter where you&apos;re leaving from and where you&apos;re going</span>
                </div>
              </div>
            )}
          </div>

          {/* Tabs Section */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-slate-200 dark:border-gray-700 overflow-hidden">
            <div className="flex border-b border-slate-100 dark:border-gray-700 overflow-x-auto">
              {[
                { id: 'itinerary', icon: <Calendar className="w-4 h-4" />, label: 'Itinerary' },
                { id: 'budget', icon: <DollarSign className="w-4 h-4" />, label: 'Budget' },
                { id: 'weather', icon: <Cloud className="w-4 h-4" />, label: 'Weather' },
                { id: 'splitter', icon: <Users className="w-4 h-4" />, label: 'Splitter' },
                { id: 'hotels', icon: <Hotel className="w-4 h-4" />, label: 'Hotels' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-6 py-4 text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 dark:border-indigo-400 bg-indigo-50/30 dark:bg-indigo-950/30'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-gray-800'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="p-6 dark:text-slate-200">
              {activeTab === 'splitter' ? (
                <div className="text-center py-10 px-4 max-w-md mx-auto">
                  <div className="text-4xl mb-3">💚</div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Split expenses (Splitwise-style)</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
                    Balances and settle-up live on the full splitter page — open it for the full Splitwise-like experience.
                  </p>
                  <Link
                    to="/splitter"
                    className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white bg-[#1CC29F] hover:bg-[#18a889] transition-colors shadow-md"
                  >
                    Open expense splitter →
                  </Link>
                </div>
              ) : !tripData ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8 text-slate-300 dark:text-slate-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">No trip data yet</h3>
                  <p className="text-slate-500 dark:text-slate-400 mb-4">Fill out the form and generate a plan, or start with the AI itinerary builder.</p>
                  <Link
                    to="/itinerary"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cyan-500 hover:bg-cyan-600 text-white text-sm font-bold shadow"
                  >
                    🤖 AI Itinerary &amp; export
                  </Link>
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'itinerary' && (
                      <div className="space-y-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-gray-700">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Quick plan for the map · Full AI + interests on{' '}
                            <Link to="/itinerary" className="text-cyan-600 dark:text-cyan-400 font-semibold hover:underline">
                              AI Itinerary
                            </Link>
                          </p>
                        </div>
                        {tripData.itinerary.map((day) => (
                          <div
                            key={day.day}
                            className="relative pl-8 border-l-2 border-indigo-100 dark:border-indigo-900 pb-6 last:pb-0"
                          >
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-600 border-4 border-white dark:border-gray-900 shadow-sm" />
                            <h4 className="font-bold text-slate-900 dark:text-white mb-1">
                              📅 Day {day.day}
                              {day.theme ? (
                                <span className="block text-sm font-normal text-slate-600 dark:text-slate-400 mt-1">
                                  {day.theme}
                                </span>
                              ) : null}
                            </h4>
                            <ul className="space-y-2 mt-3">
                              {day.activities.map((act, i) => (
                                <li key={i} className="flex items-start text-slate-600 dark:text-slate-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-2 mr-3 flex-shrink-0" />
                                  {act}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === 'budget' && (
                      <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 rounded-2xl border border-indigo-100 dark:border-indigo-900">
                            <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Transport</span>
                            <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mt-1">₹{tripData.costs.train}</p>
                            <span className="text-xs text-indigo-500 dark:text-indigo-400">Estimated (Train)</span>
                          </div>
                          <div className="p-4 bg-purple-50 dark:bg-purple-950/40 rounded-2xl border border-purple-100 dark:border-purple-900">
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Accommodation</span>
                            <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-1">₹{3500 * 2}</p>
                            <span className="text-xs text-purple-500 dark:text-purple-400">2 Nights Average</span>
                          </div>
                          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-2xl border border-emerald-100 dark:border-emerald-900">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Total Est.</span>
                            <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">₹{tripData.costs.train + (3500 * 2) + 5000}</p>
                            <span className="text-xs text-emerald-500 dark:text-emerald-400">Incl. Daily Expenses</span>
                          </div>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-gray-800/80 rounded-2xl border border-slate-100 dark:border-gray-700">
                          <h4 className="font-bold text-slate-900 dark:text-white mb-2">Budget Status</h4>
                          <div className="w-full bg-slate-200 dark:bg-gray-700 rounded-full h-2.5 mb-2">
                            <div
                              className="bg-indigo-600 h-2.5 rounded-full"
                              style={{
                                width: `${Math.min(((tripData.costs.train + 12000) / (Number(budget) || 1)) * 100, 100)}%`,
                              }}
                            />
                          </div>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            You are using{' '}
                            {Math.round(((tripData.costs.train + 12000) / (Number(budget) || 1)) * 100)}% of your ₹
                            {budget || '—'} budget.
                          </p>
                        </div>
                      </div>
                    )}

                    {activeTab === 'weather' && (
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="text-6xl mb-4" title={tripData.weather.weather[0].description}>
                          {conditionEmojiFromOpenWeather(tripData.weather)}
                        </div>
                        <h3 className="text-4xl font-bold text-slate-900 dark:text-white">
                          {Math.round(tripData.weather.main.temp)}°C {tempBandEmoji(tripData.weather.main?.temp)}
                        </h3>
                        <p className="text-xl text-slate-500 dark:text-slate-400 capitalize mb-2">
                          {tripData.weather.weather[0].description}
                          {tripData.weather.isMock ? ' (estimate)' : ''}
                        </p>
                        {typeof tripData.weather.main?.feels_like === 'number' && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                            Feels like {Math.round(tripData.weather.main.feels_like)}°C
                            {tripData.weather.elevation_blend ? ' · temp adjusted for hill elevation' : ''}
                          </p>
                        )}
                        <div className={`grid grid-cols-2 gap-8 w-full max-w-md ${typeof tripData.weather.main?.feels_like !== 'number' ? 'mt-6' : ''}`}>
                          <div className="text-center">
                            <span className="text-sm text-slate-400 uppercase">Humidity</span>
                            <p className="text-xl font-bold text-slate-700 dark:text-slate-200">
                              {tripData.weather.main.humidity}%
                            </p>
                          </div>
                          <div className="text-center">
                            <span className="text-sm text-slate-400 uppercase">Wind Speed</span>
                            <p className="text-xl font-bold text-slate-700 dark:text-slate-200">
                              {tripData.weather.wind?.speed || 5} m/s
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeTab === 'hotels' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tripData.hotels.map((hotel, index) => (
                          <div
                            key={index}
                            className="p-4 bg-white dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md transition-all flex justify-between items-center group"
                          >
                            <div>
                              <h4 className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                {hotel.name}
                              </h4>
                              <p className="text-sm text-slate-500 dark:text-slate-400">Near {tripData.destination}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-slate-900 dark:text-white">₹{hotel.price}</p>
                              <span className="text-xs text-slate-400">per night</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
