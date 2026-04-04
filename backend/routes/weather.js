import express from 'express';
import axios from 'axios';
import { resolveTouristCanonicalCoords } from '../../src/data/indiaTouristCanonical.js';

const router = express.Router();

const NORTHERNMOST_TIEBREAK = new Set(['manali']);

function getOpenWeatherKey() {
  const raw = process.env.OPENWEATHER_API_KEY || process.env.VITE_OPENWEATHER_API_KEY;
  return typeof raw === 'string' ? raw.trim() : '';
}

function wmoToWeatherShape(code) {
  const c = Number(code);
  if (c === 0) return { main: 'Clear', description: 'clear sky' };
  if ([1, 2, 3].includes(c)) return { main: 'Clouds', description: 'partly cloudy' };
  if ([45, 48].includes(c)) return { main: 'Fog', description: 'fog' };
  if ([51, 53, 55, 56, 57].includes(c)) return { main: 'Drizzle', description: 'drizzle' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(c)) return { main: 'Rain', description: 'rain' };
  if ([71, 73, 75, 77, 85, 86].includes(c)) return { main: 'Snow', description: 'snow' };
  if ([95, 96, 99].includes(c)) return { main: 'Thunderstorm', description: 'thunderstorm' };
  return { main: 'Clouds', description: 'clouds' };
}

function mockWeather(city) {
  return {
    main: { temp: 25, humidity: 60 },
    weather: [{ main: 'Clear', description: 'clear sky', icon: '01d' }],
    wind: { speed: 3 },
    name: city,
    isMock: true,
  };
}

function parseCoord(value) {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

function normalizeOpenWeatherResponse(data, cityLabel) {
  if (!data?.main || !Array.isArray(data.weather) || !data.weather.length) return null;
  return {
    ...data,
    name: data.name || cityLabel,
    isMock: false,
    source: 'openweather',
  };
}

async function fetchOpenWeatherCurrent(lat, lon, apiKey) {
  const { data } = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
    params: { lat, lon, units: 'metric', appid: apiKey },
    timeout: 12000,
  });
  return data;
}

/** Raw Open-Meteo snapshot for elevation-aware temperature blending */
async function fetchOpenMeteoSnapshot(lat, lon) {
  const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m',
      wind_speed_unit: 'ms',
    },
    timeout: 12000,
  });
  return data;
}

/**
 * OpenWeather often tracks lowland stations; at high elevation Open-Meteo is closer to hill reality.
 * Blend when elevation is high and models disagree. Disable with WEATHER_BLEND_ELEVATION=false.
 */
function applyElevationBlend(normalizedOw, omData) {
  if (process.env.WEATHER_BLEND_ELEVATION === 'false') return normalizedOw;

  const owTemp = normalizedOw?.main?.temp;
  const omTemp = omData?.current?.temperature_2m;
  const elev = omData?.elevation;

  if (typeof owTemp !== 'number' || typeof omTemp !== 'number' || elev == null) return normalizedOw;

  const diff = Math.abs(owTemp - omTemp);
  if (elev < 850 || diff < 2.5) return normalizedOw;

  const omWeight = diff >= 7 ? 0.65 : 0.55;
  const blended = (1 - omWeight) * owTemp + omWeight * omTemp;

  return {
    ...normalizedOw,
    main: {
      ...normalizedOw.main,
      temp: Math.round(blended * 10) / 10,
      temp_station_rough: owTemp,
    },
    source: 'openweather',
    elevation_blend: true,
    elevation_m: elev,
  };
}

async function nominatimGeocode(cityLabel) {
  const trimmed = (cityLabel || '').trim();
  if (!trimmed) return null;

  const tryQueries = trimmed.includes(',')
    ? [trimmed, `${trimmed.split(',')[0].trim()}, India`]
    : [`${trimmed}, India`, trimmed];

  for (const q of tryQueries) {
    const geoRes = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: { q, format: 'jsonv2', limit: 12, countrycodes: 'in' },
      headers: { 'User-Agent': 'TripAddicts/1.0 (travel planning; contact: local dev)' },
      timeout: 12000,
      validateStatus: () => true,
    });
    const data = Array.isArray(geoRes.data) ? geoRes.data : [];
    if (!data.length) continue;

    const stem = trimmed.split(',')[0].trim().toLowerCase();
    let rows = data.filter((d) => (d.name || '').toLowerCase() === stem);
    if (!rows.length) rows = data;

    if (rows.length > 1) {
      rows = [...rows].sort((a, b) => parseFloat(b.lat) - parseFloat(a.lat));
    }

    const pick = rows[0];
    if (pick && pick.lat != null && pick.lon != null) {
      return { lat: parseFloat(pick.lat), lon: parseFloat(pick.lon) };
    }
  }

  return null;
}

async function openWeatherGeocodeDirect(cityLabel, apiKey) {
  const trimmed = (cityLabel || '').trim();
  if (!trimmed || !apiKey) return null;

  const tryQueries = trimmed.includes(',') ? [trimmed, trimmed.split(',')[0].trim()] : [`${trimmed},IN`, trimmed];
  const searchStem = trimmed.split(',')[0].trim().toLowerCase();

  for (const q of tryQueries) {
    const geoRes = await axios.get('https://api.openweathermap.org/geo/1.0/direct', {
      params: { q, limit: 10, appid: apiKey },
      timeout: 12000,
    });
    const data = Array.isArray(geoRes.data) ? geoRes.data : [];
    if (!data.length) continue;

    let rows = data.filter((r) => (r.name || '').toLowerCase() === searchStem);
    if (!rows.length) rows = data;

    if (rows.length > 1 && NORTHERNMOST_TIEBREAK.has(searchStem)) {
      rows = [...rows].sort((a, b) => (b.lat || 0) - (a.lat || 0));
    }

    const pick = rows[0];
    if (pick && Number.isFinite(pick.lat) && Number.isFinite(pick.lon)) {
      return { lat: pick.lat, lon: pick.lon };
    }
  }

  return null;
}

async function fetchOpenMeteoCurrent(lat, lon, cityName) {
  const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: lat,
      longitude: lon,
      current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m',
      wind_speed_unit: 'ms',
    },
    timeout: 12000,
  });

  const cur = data?.current;
  if (!cur || typeof cur.temperature_2m !== 'number') return null;

  const { main, description } = wmoToWeatherShape(cur.weather_code);
  return {
    main: {
      temp: cur.temperature_2m,
      humidity: cur.relative_humidity_2m ?? 60,
    },
    weather: [{ main, description, icon: '01d' }],
    wind: { speed: cur.wind_speed_10m ?? 3 },
    name: cityName,
    isMock: false,
    source: 'open-meteo',
    elevation_m: data?.elevation,
  };
}

async function resolveCoords(cityParam, queryLat, queryLon, apiKey) {
  const canon = resolveTouristCanonicalCoords(cityParam);
  if (canon) return canon;

  let lat = parseCoord(queryLat);
  let lon = parseCoord(queryLon);
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };

  let g = await nominatimGeocode(cityParam);
  if (!g && apiKey) g = await openWeatherGeocodeDirect(cityParam, apiKey);
  return g;
}

router.get('/:city', async (req, res) => {
  const city = req.params.city;
  const apiKey = getOpenWeatherKey();

  try {
    const coords = await resolveCoords(city, req.query.lat, req.query.lon, apiKey);
    if (!coords) {
      return res.json(mockWeather(city));
    }

    const { lat, lon } = coords;

    if (apiKey) {
      try {
        const [ow, omSnap] = await Promise.all([
          fetchOpenWeatherCurrent(lat, lon, apiKey),
          fetchOpenMeteoSnapshot(lat, lon).catch(() => null),
        ]);
        const normalized = normalizeOpenWeatherResponse(ow, city);
        if (normalized) {
          const blended = omSnap ? applyElevationBlend(normalized, omSnap) : normalized;
          return res.json(blended);
        }
      } catch (err) {
        console.warn('OpenWeather failed — trying fallback for', city, err.message || err);
      }
    }

    const om = await fetchOpenMeteoCurrent(lat, lon, city);
    if (om) return res.json(om);
  } catch (err) {
    console.warn('Weather fetch failed for', city, err.message || err);
  }

  return res.json(mockWeather(city));
});

export default router;
