import { searchGutendex, searchGoogleBooks } from './services/api.js';
import { saveFavs, loadFavs, saveCounts, loadCounts, saveJSON, loadJSON, saveProgress, loadProgress, escapeHtml } from './utils.js';

// elements
const qIn = document.getElementById('q');
const searchBtn = document.getElementById('searchBtn');
const grid = document.getElementById('grid');
const info = document.getElementById('info');
const showFavsBtn = document.getElementById('showFavs');
const showAllBtn = document.getElementById('showAll');
const exportFavsBtn = document.getElementById('exportFavs');
const importBtn = document.getElementById('importFavs');
const importFile = document.getElementById('importFile');
const darkToggle = document.getElementById('darkToggle');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const pager = { prev: document.getElementById('prevPage'), next: document.getElementById('nextPage'), info: document.getElementById('pageInfo') };
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.getElementById('closeModal');
const recommendationBox = document.getElementById('recommendation');
const filterSource = document.getElementById('filterSource');
const sortBy = document.getElementById('sortBy');
const GOOGLE_API_KEY = ""; // optional: paste your Google Books API key here

// state
let results = [];
let favorites = loadFavs();
let counts = loadCounts();
let progress = loadProgress();
let page = 1;
const PAGE_SIZE = 12;
let lastQuery = 'computer science';
let totalResults = 0;

// theme
const theme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', theme);
darkToggle && (darkToggle.textContent = theme === 'light' ? '🌙' : '☀️');

// utils
function setInfo(t){ if(info) info.textContent = t; }
function persistAll(){ saveFavs(favorites); saveCounts(counts); saveProgress(progress); }

// Ratings helpers (localStorage)
function saveRating(id, val){
  saveJSON('ratings', Object.assign(loadJSON('ratings', {}), { [id]: val }));
}
function loadRating(id){
  return loadJSON('ratings', {})[id] || 0;
}

// merge prefer gutendex then google, dedupe by title+author
function mergeResults(gbooks, gutendex){
  const combined = [...gutendex, ...gbooks];
  const seen = new Set(); const out = [];
  combined.forEach(it => {
    const key = (it.title + '|' + (it.authors||'')).toLowerCase();
    if(!seen.has(key)){ seen.add(key); out.push(it); }
  });
  return out;
}

// render
function render(list){
  results = list || [];
  grid.innerHTML = '';
  if(!results.length){ document.getElementById('empty').classList.remove('hidden'); setInfo('No results'); return; }
  document.getElementById('empty').classList.add('hidden');
  setInfo(`Showing ${results.length} results — Click Preview, Download or ❤ to favorite.`);
  results.forEach(item => {
    const div = document.createElement('div'); div.className = 'card';
    const thumb = item.thumbnail || '';
    const title = escapeHtml(item.title || 'No title');
    const authors = escapeHtml(item.authors || 'Unknown');
    const isFav = favorites.includes(item.id);
    const dlCount = counts[item.id] || 0;
    const uploadedTag = item.source === 'upload' ? '<span class="badge">My Upload</span>' : '';
    const hotBadge = (dlCount >= 3) ? `<span class="badge hot">Top</span>` : '';
    div.innerHTML = `
      <img class="cover" loading="lazy" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='240'><rect width='100%' height='100%' fill='%23e6eef8'/><text x='50%' y='50%' fill='%23888' font-size='18' text-anchor='middle' dominant-baseline='middle'>No Cover</text></svg>" data-src="${thumb}" alt="${title}">
      <div class="title">${title}</div>
      <div class="meta">${authors} ${uploadedTag} ${hotBadge}</div>
      <div class="tags">${(item.tags||[]).slice(0,6).map(t=>`<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
      <div class="meta">Source: <span class="badge">${item.source === 'google' ? 'Google Books' : item.source === 'gutendex' ? 'Gutendex' : 'Upload'}</span></div>

      <div class="rating" data-id="${item.id}" aria-label="rating">
        <span class="star" data-value="1">☆</span>
        <span class="star" data-value="2">☆</span>
        <span class="star" data-value="3">☆</span>
        <span class="star" data-value="4">☆</span>
        <span class="star" data-value="5">☆</span>
      </div>

      <div class="row">
        ${item.pdf ? `<a class="btn" data-pdf="${item.pdf}" data-id="${item.id}" href="${item.pdf}" target="_blank"><button class="btn btn-light">📄 Download PDF</button></a>` : ''}
        ${item.epub ? `<a class="btn" data-epub="${item.epub}" data-id="${item.id}" href="${item.epub}" target="_blank"><button class="btn btn-light">📘 Download EPUB</button></a>` : ''}
        ${item.previewLink ? `<button class="btn btn-light preview" data-id="${item.id}">👁 Preview</button>` : ''}
        <button class="fav ${isFav ? 'active' : ''}" data-id="${item.id}" aria-label="favorite">${isFav ? '❤' : '♡'}</button>
        <div style="margin-left:auto;color:var(--muted);font-size:13px">Downloads: <strong>${dlCount}</strong></div>
      </div>
    `;
    grid.appendChild(div);

    // lazy swap: set the real image if available
    const img = div.querySelector('img[loading="lazy"]');
    if(img && img.dataset.src) img.src = img.dataset.src;

    // set rating stars state + click handlers
    const ratingEl = div.querySelector('.rating');
    if(ratingEl){
      const id = ratingEl.dataset.id;
      const current = loadRating(id);
      const stars = ratingEl.querySelectorAll('.star');
      stars.forEach(s => {
        const val = Number(s.dataset.value);
        s.classList.toggle('active', val <= current);
        s.addEventListener('click', ()=>{
          saveRating(id, val);
          stars.forEach(ss => ss.classList.toggle('active', Number(ss.dataset.value) <= val));
        });
      });
    }

    // fade-in animation
    requestAnimationFrame(()=> div.classList.add('visible'));
  });
}

// increment download
function incrementDownload(id){ counts[id] = (counts[id] || 0) + 1; saveCounts(counts); render(results); }

// open preview modal (includes in-page PDF reader & notes)
function openPreview(item){
  if(!item) return;
  const authors = escapeHtml(item.authors || 'Unknown');
  const thumb = item.thumbnail || '';
  const source = item.source === 'google' ? 'Google Books' : item.source === 'gutendex' ? 'Gutendex (public domain)' : 'My Upload';
  const pdfBtn = item.pdf ? `<a href="${item.pdf}" target="_blank" class="btn"><button class="btn btn-light">Open PDF in new tab</button></a>` : '';
  const epubBtn = item.epub ? `<a href="${item.epub}" target="_blank" class="btn"><button class="btn btn-light">Open EPUB</button></a>` : '';
  const saved = progress[item.id] || {pos:0, updated:0};
  const note = loadJSON('notes_'+item.id, '');
  modalContent.innerHTML = `
    <div style="display:flex;gap:14px">
      <img src="${thumb}" style="width:140px;height:200px;object-fit:cover;border-radius:8px">
      <div style="flex:1">
        <h2 style="margin:0 0 6px">${escapeHtml(item.title)}</h2>
        <div style="color:var(--muted);margin-bottom:8px">${authors}</div>
        <div style="color:var(--muted);margin-bottom:10px">Source: ${source}</div>
        <div style="display:flex;gap:8px">${pdfBtn} ${epubBtn} ${item.previewLink ? `<a href="${item.previewLink}" target="_blank" class="btn"><button class="btn btn-light">Open Preview</button></a>` : ''}</div>
        <div class="note-area">
          <label><strong>Your Notes</strong></label>
          <textarea id="noteArea" rows="4" style="width:100%;margin-top:6px">${note || ''}</textarea>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button id="saveNote" class="btn btn-light">Save Note</button>
            <button id="clearNote" class="btn btn-light">Clear Note</button>
            <div style="margin-left:auto;color:var(--muted)">Saved: ${saved.updated ? new Date(saved.updated).toLocaleString() : '—'}</div>
          </div>
        </div>
        ${item.pdf ? `<div style="margin-top:10px"><strong>Reading progress:</strong> <span id="progressLabel">${Math.round((saved.pos||0)*100)}%</span> <button id="openReader" class="btn btn-light">Open Reader</button></div>` : ''}
        <div style="margin-top:10px;color:var(--muted);font-size:13px">Share: <button id="shareBtn" class="btn btn-light">Copy Link</button></div>
      </div>
    </div>
  `;
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');

  // notes handlers
  document.getElementById('saveNote')?.addEventListener('click', ()=>{
    const v = document.getElementById('noteArea').value;
    saveJSON('notes_'+item.id, v);
    alert('Note saved');
  });
  document.getElementById('clearNote')?.addEventListener('click', ()=>{
    document.getElementById('noteArea').value = '';
    saveJSON('notes_'+item.id, '');
  });
  document.getElementById('openReader')?.addEventListener('click', ()=> openReaderModal(item));
  document.getElementById('shareBtn')?.addEventListener('click', ()=>{
    const base = location.origin + location.pathname;
    const payload = btoa(JSON.stringify({ id: item.id, title: item.title }));
    const url = `${base}?book=${payload}`;
    navigator.clipboard?.writeText(url).then(()=> alert('Share link copied to clipboard'));
  });
}

function openReaderModal(item){
  modalContent.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;gap:8px;align-items:center">
        <h2 style="margin:0">${escapeHtml(item.title)}</h2>
        <div style="margin-left:auto;color:var(--muted)">Clicks to Download: ${counts[item.id]||0}</div>
      </div>
      <iframe id="pdfReader" src="${item.pdf}" style="width:100%;height:70vh;border-radius:8px"></iframe>
      <div style="display:flex;gap:8px;align-items:center">
        <progress id="readProg" value="${(progress[item.id] && progress[item.id].pos) ? progress[item.id].pos : 0}" max="1" style="flex:1"></progress>
        <button id="saveProg" class="btn btn-light">Save progress</button>
      </div>
    </div>
  `;
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
  document.getElementById('saveProg')?.addEventListener('click', ()=>{
    const val = prompt('Enter reading progress percent (0-100)', Math.round((progress[item.id]?.pos||0)*100));
    if(val !== null){
      const p = Math.min(100, Math.max(0, Number(val)));
      progress[item.id] = { pos: p/100, updated: Date.now() };
      saveProgress(progress);
      alert('Progress saved: ' + p + '%');
      render(results);
    }
  });
}

// close modal
closeModal?.addEventListener('click', ()=>{ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); });

// grid click delegation
grid.addEventListener('click', (e)=>{
  const favBtn = e.target.closest('.fav');
  if(favBtn){ const id = favBtn.getAttribute('data-id'); const i = favorites.indexOf(id); if(i===-1) favorites.push(id); else favorites.splice(i,1); saveFavs(favorites); render(results); return; }
  const previewBtn = e.target.closest('.preview');
  if(previewBtn){ const id = previewBtn.getAttribute('data-id'); const item = results.find(r=>r.id===id); openPreview(item); return; }
  const dlLink = e.target.closest('a[data-pdf], a[data-epub]');
  if(dlLink){ const id = dlLink.getAttribute('data-id'); incrementDownload(id); return; }
});

// search flow with pagination
let searchTimer;
qIn?.addEventListener('input', ()=>{ clearTimeout(searchTimer); searchTimer = setTimeout(()=> runSearch(qIn.value.trim(),1), 450); });
searchBtn?.addEventListener('click', ()=> runSearch(qIn.value.trim(),1));
pager.prev?.addEventListener('click', ()=> { if(page>1) runSearch(lastQuery, page-1); });
pager.next?.addEventListener('click', ()=> runSearch(lastQuery, page+1));
showFavsBtn?.addEventListener('click', showFavorites);
showAllBtn?.addEventListener('click', ()=> render(results));
exportFavsBtn?.addEventListener('click', ()=> {
  const data = { favorites, counts, progress };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'favorites.json'; a.click();
  URL.revokeObjectURL(url);
});

// Import favorites handlers
importBtn?.addEventListener('click', ()=> importFile.click());
importFile?.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if(!f) return;
  try{
    const text = await f.text();
    const data = JSON.parse(text);
    if(Array.isArray(data.favorites)){
      const newFavs = Array.from(new Set([...(favorites||[]), ...data.favorites]));
      saveFavs(newFavs);
      favorites = loadFavs();
      alert('Favorites imported — saved locally');
      render(results);
    } else {
      alert('Invalid file: expected JSON with "favorites" array');
    }
  }catch(err){
    alert('Failed to import file');
    console.error(err);
  }
});

// filter/sort event listeners
if (filterSource) filterSource.addEventListener('change', () => applyFilterSort());
if (sortBy) sortBy.addEventListener('change', () => applyFilterSort());

// dark toggle
darkToggle?.addEventListener('click', ()=> {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next); localStorage.setItem('theme', next);
  darkToggle.textContent = next === 'light' ? '🌙' : '☀️';
});

// upload PDF (client-side: store base64 in localStorage for demo)
uploadBtn?.addEventListener('click', ()=> fileInput.click());
fileInput?.addEventListener('change', async (ev)=> {
  const f = ev.target.files[0];
  if(!f) return;
  if(f.type !== 'application/pdf'){ alert('Please select a PDF file'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result;
    const title = prompt('Enter title for uploaded PDF', f.name) || f.name;
    const author = prompt('Enter author', 'Unknown') || 'Unknown';
    const id = 'upload-' + Date.now();
    const uploads = loadJSON('uploads', []);
    uploads.unshift({ id, title, authors: author, thumbnail: '', pdf: dataUrl, source: 'upload' });
    saveJSON('uploads', uploads);
    alert('Upload saved to My Uploads. Search for the title to view.');
  };
  reader.readAsDataURL(f);
});

// show favorites (try to show favorites from results + uploads)
function showFavorites(){
  const uploads = loadJSON('uploads', []);
  const favItems = [];
  favorites.forEach(id => {
    const found = results.find(r=>r.id===id);
    if(found) favItems.push(found);
    else {
      const up = uploads.find(u=>u.id===id);
      if(up) favItems.push(up);
    }
  });
  render(favItems);
}

// recommendations
function showRecommendations(){
  if(!favorites.length) { recommendationBox.classList.add('hidden'); return; }
  const favAuthors = [];
  favorites.forEach(id=>{
    const f = results.find(r=>r.id===id);
    if(f && f.authors) favAuthors.push(...f.authors.split(',').map(s=>s.trim()));
  });
  const uniq = [...new Set(favAuthors)].slice(0,3);
  if(!uniq.length){ recommendationBox.classList.add('hidden'); return; }
  recommendationBox.classList.remove('hidden');
  recommendationBox.textContent = `Because you liked authors: ${uniq.join(', ')} — try searching their names or related topics.`;
}

// FILTER & SORT helper
function applyFilterSort(){
  let list = Array.isArray(results) ? [...results] : [];
  const f = (filterSource && filterSource.value) || 'all';
  if(f !== 'all'){
    list = list.filter(it => (it.source || 'upload') === f);
  }
  const s = (sortBy && sortBy.value) || 'relevance';
  if(s === 'title'){
    list.sort((a,b) => (a.title||'').localeCompare(b.title||''));
  } else if(s === 'downloads'){
    list.sort((a,b) => (counts[b.id]||0) - (counts[a.id]||0));
  }
  render(list);
}

// runSearch: calls both APIs for current page
async function runSearch(q, p=1){
  if(!q){ setInfo('Please enter search term'); return; }
  lastQuery = q; page = p;
  setInfo('Searching...');
  showSkeletons();

  try{
    const [gRes, gutRes] = await Promise.all([
      searchGoogleBooks(q, GOOGLE_API_KEY, (p-1)*PAGE_SIZE, PAGE_SIZE),
      searchGutendex(q, p, PAGE_SIZE)
    ]);
    const merged = mergeResults((gRes.results || []), (gutRes.results || []));
    const uploads = loadJSON('uploads', []);
    const matchedUploads = uploads.filter(u => (u.title||'').toLowerCase().includes(q.toLowerCase()));
    const final = [...matchedUploads, ...merged];
    results = final;
    totalResults = Math.max(gRes.total || 0, gutRes.total || 0);

    // render respecting current filter/sort
    if (typeof applyFilterSort === 'function') applyFilterSort(); else render(results);

    pager.info && (pager.info.textContent = `Page ${page} — showing ${results.length}`);
    showRecommendations();
  }catch(err){ console.error(err); setInfo('Search failed — check internet'); }
}

// keyboard shortcuts
document.addEventListener('keydown', (e)=>{
  if(e.key === 'f'){ const first = document.querySelector('.fav'); if(first) first.click(); }
  if(e.key === 'Enter' && document.activeElement === qIn){ runSearch(qIn.value.trim(),1); }
  if(e.key === '?'){ qIn.focus(); }
});

// initial search
runSearch(lastQuery,1);

// expose some for console debugging
window._ebook = { runSearch, results, favorites, counts, progress, saveJSON, loadJSON };

// skeleton helpers
function showSkeletons(n=6){
  const html = new Array(n).fill(0).map(()=>`
    <div class="skel-card">
      <div class="skel-thumb"></div>
      <div class="skel-line mid"></div>
      <div class="skel-line short"></div>
      <div style="margin-top:auto" class="skel-line mid"></div>
    </div>`).join('');
  grid.innerHTML = `<div class="skeleton-grid">${html}</div>`;
}
function hideSkeletons(){ /* render() will replace skeletons */ }
