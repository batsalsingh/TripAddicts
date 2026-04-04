# TripAddicts

Travel planning app: discover places by weather, generate AI itineraries, split group expenses, and plan routes on an interactive map.

## Run locally

**Prerequisites:** Node.js 20+

1. Install dependencies: `npm install`
2. Environment variables (see `.env.example`):
   - `GEMINI_API_KEY` — optional; enables AI-generated itineraries on the server
   - `UNSPLASH_ACCESS_KEY` — optional; dynamic destination photos in Discover
   - `MONGODB_URI`, `JWT_SECRET` — auth and saved trips
3. Start dev server: `npm run dev`
4. Production build: `npm run build` then `npm start` (or serve `dist` with your host)

## Stack

React (Vite), Express, MongoDB, Tailwind CSS, Leaflet map.
