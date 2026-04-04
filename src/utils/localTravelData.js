const NS = 'tripaddicts';
const LEGACY_NS = 'wanderease';

function migrateLegacyKey(key) {
  try {
    const legacy = localStorage.getItem(`${LEGACY_NS}:${key}`);
    if (!legacy) return;
    if (localStorage.getItem(`${NS}:${key}`)) return;
    localStorage.setItem(`${NS}:${key}`, legacy);
  } catch {
    /* ignore */
  }
}

function readJson(key, fallback) {
  migrateLegacyKey(key);
  try {
    const raw = localStorage.getItem(`${NS}:${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(`${NS}:${key}`, JSON.stringify(value));
  } catch {
    /* ignore quota */
  }
}

/** @returns {{id:number,name:string,state:string}[]} */
export function getFavoriteDestinations() {
  return readJson('favorites', []);
}

/** @param {{id:number,name:string,state:string}} dest */
export function isFavoriteDestination(dest) {
  return getFavoriteDestinations().some((f) => f.id === dest.id);
}

/** @param {{id:number,name:string,state:string}} dest */
export function toggleFavoriteDestination(dest) {
  const list = getFavoriteDestinations();
  const idx = list.findIndex((f) => f.id === dest.id);
  if (idx >= 0) list.splice(idx, 1);
  else list.push({ id: dest.id, name: dest.name, state: dest.state });
  writeJson('favorites', list);
  return [...list];
}

/** @param {string} name */
export function addRecentDestination(name) {
  const n = name?.trim();
  if (!n) return;
  let list = readJson('recentDestinations', []);
  list = [n, ...list.filter((x) => x !== n)].slice(0, 10);
  writeJson('recentDestinations', list);
}

export function getRecentDestinations() {
  return readJson('recentDestinations', []);
}

const CHECKLIST_KEY = 'preTripChecklist';

/** @returns {Record<string, boolean>} */
export function getPreTripChecklist() {
  return readJson(CHECKLIST_KEY, {});
}

/** @param {Record<string, boolean>} next */
export function savePreTripChecklist(next) {
  writeJson(CHECKLIST_KEY, next);
}
