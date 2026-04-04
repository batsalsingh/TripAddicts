import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { jsonrepair } from 'jsonrepair';

const router = express.Router();

function ruleBasedPlan(destination, budget, numDays, origin) {
  const itinerary = Array.from({ length: Math.min(Math.max(numDays, 1), 14) }, (_, i) => ({
    day: i + 1,
    theme: i === 0 ? '🛬 Arrival & orientation' : i === numDays - 1 ? '🧳 Departure day' : `🌟 Day ${i + 1} highlights`,
    activities: [
      `🌅 Morning: local breakfast & ${destination} neighborhood walk`,
      `📍 Midday: landmark visit & photos`,
      `🌙 Evening: dinner & relaxed stroll`,
    ],
  }));

  const hotels = [
    { name: 'Skyline Luxury Hotel', price: 5500, type: 'Luxury' },
    { name: 'Heritage Boutique Stay', price: 3800, type: 'Boutique' },
    { name: 'Comfort Inn & Suites', price: 2500, type: 'Budget' },
    { name: 'Backpackers Paradise', price: 1200, type: 'Hostel' },
  ];

  const filteredHotels = budget
    ? hotels.filter((h) => h.price * 3 < budget * 0.4)
    : hotels;

  return {
    itinerary,
    hotels: filteredHotels.length > 0 ? filteredHotels : hotels.slice(-2),
    tips: [
      ...(origin?.trim()
        ? [`🚗 You're coming from ${origin.trim()} — check trains, buses, or flights into ${destination} early.`]
        : []),
      `💧 Stay hydrated — ${destination} can surprise you with the weather!`,
      '📱 Download offline maps for backup navigation.',
      '🧾 Keep digital copies of IDs and bookings.',
    ],
  };
}

/**
 * LLMs often emit raw line breaks or tabs inside JSON string literals (invalid for JSON.parse).
 * Keeps \\n escape sequences intact by skipping chars after backslash inside strings.
 */
function sanitizeStringLiterals(jsonLike) {
  let out = '';
  let inString = false;
  for (let i = 0; i < jsonLike.length; i++) {
    const c = jsonLike[i];
    if (c === '\\' && inString) {
      out += c + (jsonLike[i + 1] ?? '');
      i++;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      out += c;
      continue;
    }
    if (inString) {
      if (c === '\n' || c === '\r') {
        out += ' ';
        if (c === '\r' && jsonLike[i + 1] === '\n') i++;
        continue;
      }
      if (c === '\t') {
        out += ' ';
        continue;
      }
    }
    out += c;
  }
  return out;
}

/** First `{` … matching `}` outside of quoted strings (handles extra prose around JSON). */
function extractBalancedJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (c === '\\' && inString) {
      i++;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function parseAiJson(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty AI response');
  }

  let raw = text.replace(/^\uFEFF/, '').trim();
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();

  raw = raw
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'");

  const stripTrailingCommas = (s) => s.replace(/,\s*(\]|\})/g, '$1');
  const stripLineComments = (s) => s.replace(/^\s*\/\/[^\n]*$/gm, '');

  const candidates = [];
  candidates.push(raw);
  const balanced = extractBalancedJsonObject(raw);
  if (balanced && balanced !== raw) candidates.push(balanced);

  const tryParse = (v) => {
    try {
      const parsed = JSON.parse(v);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {
      /* try jsonrepair */
    }
    try {
      const repaired = jsonrepair(v);
      const parsed = JSON.parse(repaired);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch (_) {
      /* next variant */
    }
    return null;
  };

  for (const c of candidates) {
    const variants = new Set([
      c,
      sanitizeStringLiterals(c),
      stripLineComments(c),
      stripTrailingCommas(c),
      stripTrailingCommas(stripLineComments(c)),
      stripTrailingCommas(sanitizeStringLiterals(c)),
      stripTrailingCommas(stripLineComments(sanitizeStringLiterals(c))),
    ]);
    for (const v of variants) {
      const parsed = tryParse(v);
      if (parsed) return parsed;
    }
  }

  throw new Error('Could not parse AI JSON');
}

router.post('/', async (req, res) => {
  const {
    origin,
    destination,
    budget,
    startDate,
    endDate,
    people,
    preferences,
  } = req.body;

  if (!destination) {
    return res.status(400).json({ message: 'Destination is required' });
  }

  let numDays = 3;
  if (startDate && endDate) {
    const d0 = new Date(startDate);
    const d1 = new Date(endDate);
    const diff = Math.ceil((d1 - d0) / (1000 * 60 * 60 * 24));
    if (!Number.isNaN(diff) && diff > 0) numDays = Math.min(diff, 14);
  }

  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prefs =
        typeof preferences === 'string' && preferences.trim()
          ? preferences
          : 'general sightseeing';

      const fromLine = origin?.trim()
        ? `The trip starts from "${origin.trim()}" and the main destination is "${destination}".`
        : `Destination: "${destination}".`;

      const prompt = `You are a travel expert. Create a ${numDays}-day itinerary.
${fromLine}
Travelers: ${people || 1}. Budget hint (INR): ${budget || 'flexible'}.
Interests/preferences: ${prefs}.
If a starting city is given, mention realistic transport from there to ${destination} where relevant (day 1 context).

Return ONLY one JSON object. Valid JSON: double quotes on keys/strings, no trailing commas, no markdown fences. Every string value must be a single line — use spaces instead of line breaks inside activities or tips.

Shape:
{
  "itinerary": [{"day": 1, "theme": "emoji label", "activities": ["emoji + text"]}],
  "hotels": [{"name": "Hotel", "price": 2500, "type": "Boutique"}],
  "tips": ["tip1", "tip2", "tip3"]
}

Content rules:
- Exactly ${numDays} days in itinerary; 3–5 activities per day for ${destination}.
- 3–4 hotels, varied INR prices.
- At least 3 practical tips.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      const text = response.text;
      if (!text) {
        throw new Error('Empty AI response');
      }

      const parsed = parseAiJson(text);
      if (!parsed.itinerary || !Array.isArray(parsed.itinerary)) {
        throw new Error('Invalid AI JSON shape');
      }

      return res.json({
        itinerary: parsed.itinerary,
        hotels: Array.isArray(parsed.hotels) ? parsed.hotels : [],
        tips: Array.isArray(parsed.tips) ? parsed.tips : [],
      });
    } catch (err) {
      console.warn('AI plan: rule-based fallback —', err?.message || err);
      const fallback = ruleBasedPlan(destination, budget, numDays, origin);
      return res.json(fallback);
    }
  }

  const fallback = ruleBasedPlan(destination, budget, numDays, origin);
  return res.json(fallback);
});

export default router;
