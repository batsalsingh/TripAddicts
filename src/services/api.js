import axios from 'axios';

const API_URL = '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  signup: (userData) => api.post('/auth/signup', userData),
};

export const tripService = {
  createTrip: (tripData) => api.post('/trips', tripData),
  getTrips: () => api.get('/trips'),
  getTrip: (id) => api.get(`/trips/${id}`),
};

export const costService = {
  estimate: (distance) => api.post('/cost/estimate', { distance }),
};

export const weatherService = {
  /** Pass lat/lon from geocoding so weather matches the map pin (avoids ambiguous names like Manali). */
  getWeather: (city, coords) =>
    api.get(`/weather/${encodeURIComponent(city)}`, {
      params:
        coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lon)
          ? { lat: coords.lat, lon: coords.lon }
          : {},
    }),
};

export const planService = {
  generatePlan: (planParams) => api.post('/plan', planParams),
};

export const unsplashService = {
  searchPhoto: (q) => api.get('/unsplash/search', { params: { q } }),
};

export default api;
