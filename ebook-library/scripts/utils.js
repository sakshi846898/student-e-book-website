export function saveJSON(key, obj){ localStorage.setItem(key, JSON.stringify(obj)); }
export function loadJSON(key, fallback){ return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); }
export function saveFavs(arr){ saveJSON('favBooks', arr); }
export function loadFavs(){ return loadJSON('favBooks', []); }
export function saveCounts(obj){ saveJSON('downloadCounts', obj); }
export function loadCounts(){ return loadJSON('downloadCounts', {}); }
export function saveProgress(obj){ saveJSON('readProgress', obj); }
export function loadProgress(){ return loadJSON('readProgress', {}); }
export function escapeHtml(t){ return String(t||'').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
