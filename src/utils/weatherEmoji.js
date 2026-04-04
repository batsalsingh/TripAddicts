/** Condition emoji from free-text (discover cards, descriptions) */
export function conditionEmojiFromText(text) {
  if (!text || typeof text !== 'string') return '🌡️';
  const c = text.toLowerCase();
  if (c.includes('thunder')) return '⛈️';
  if (c.includes('snow') || c.includes('sleet') || c.includes('blizzard')) return '❄️';
  if (c.includes('rain') || c.includes('drizzle') || c.includes('shower')) return '🌧️';
  if (c.includes('mist') || c.includes('fog') || c.includes('haze')) return '🌫️';
  if (c.includes('clear')) return '☀️';
  if (c.includes('cloud') || c.includes('overcast')) return '☁️';
  if (c.includes('wind')) return '💨';
  return '🌤️';
}

/** Condition emoji from OpenWeather-style payload */
export function conditionEmojiFromOpenWeather(weatherLike) {
  const w0 = weatherLike?.weather?.[0];
  if (!w0) return '🌡️';
  const main = (w0.main || '').toLowerCase();
  const desc = (w0.description || '').toLowerCase();
  if (main === 'snow') return '❄️';
  if (main === 'rain' || main === 'drizzle') return '🌧️';
  if (main === 'thunderstorm') return '⛈️';
  if (main === 'mist' || main === 'fog' || main === 'haze' || main === 'smoke') return '🌫️';
  if (main === 'clear') return '☀️';
  if (main === 'clouds') return desc.includes('few') || desc.includes('scattered') ? '🌤️' : '☁️';
  return conditionEmojiFromText(desc || main);
}

/** Temperature band emoji (complements condition) */
export function tempBandEmoji(tempC) {
  if (typeof tempC !== 'number' || Number.isNaN(tempC)) return '';
  if (tempC <= 0) return '🥶';
  if (tempC < 10) return '❄️';
  if (tempC < 18) return '🧥';
  if (tempC < 26) return '🌤️';
  if (tempC < 32) return '☀️';
  return '🔥';
}

/** Dashboard: condition + temp + band for compact display */
export function openWeatherEmojiLine(weatherLike) {
  const temp = weatherLike?.main?.temp;
  const feels = weatherLike?.main?.feels_like;
  const desc = weatherLike?.weather?.[0]?.description;
  const cEm = conditionEmojiFromOpenWeather(weatherLike);
  const tEm = tempBandEmoji(typeof temp === 'number' ? temp : NaN);
  const tempStr = typeof temp === 'number' ? `${Math.round(temp)}°C` : '';
  const feelsStr =
    typeof feels === 'number' && Math.round(feels) !== Math.round(temp ?? NaN)
      ? ` · feels ${Math.round(feels)}°C`
      : '';
  return {
    conditionEmoji: cEm,
    tempEmoji: tEm,
    description: desc,
    tempStr,
    feelsStr,
    title: [cEm, tempStr, tEm].filter(Boolean).join(' ') + feelsStr,
  };
}
