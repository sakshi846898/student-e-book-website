/* app.js - full polished frontend logic
   Place at ebook-library/scripts/app.js (replace existing)
*/

import { searchGutendex, searchGoogleBooks } from './services/api.js';
import { saveJSON, loadJSON, saveFavs, loadFavs, saveCounts, loadCounts, saveProgress, loadProgress, escapeHtml } from './utils.js';

// elements
const qIn = document.getElementById('q');
const searchBtn = document.getElementById('searchBtn');
const grid = document.getElementById('grid');
const continueRow = document.getElementById('continueRow');
const stat1 = document.getElementById('stat1');
const stat2 = document.getElementById('stat2');
const stat3 = document.getElementById('stat3');
const showFavsBtn = document.getElementById('showFavs');
const exportFavsBtn = document.getElementById('exportFavs');
const importFavsBtn = document.getElementById('importFavs');
const importFile = document.getElementById('importFile');
const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const themeToggle = document.getElementById('themeToggle');
const exploreBtn = document.getElementById('exploreBtn');
const libraryBtn = document.getElementById('libraryBtn');
const modal = document.getElementById('modal');
const modalContent = document.getElementById('modalContent');
const closeModal = document.getElementById('closeModal');
const filterSource = document.getElementById('filterSource');
const sortBy = document.getElementById('sortBy');
const GOOGLE_API_KEY = ''; // optional: paste Google Books API key

// state
let results = [];
let favorites = loadFavs();
let counts = loadCounts();
let progress = loadProgress();
let uploads = loadJSON('uploads', []);
let page = 1;
const PAGE_SIZE = 12;
let lastQuery = 'computer science';

// theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
if(themeToggle) themeToggle.checked = savedTheme === 'dark';
if(themeToggle) themeToggle.addEventListener('change', ()=>{
  const next = themeToggle.checked ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
});

// helper: placeholder svg
function placeholderSVG(w=400,h=240,text='No Cover'){
  const t = text.replace(/#/g,'%23').replace(/\n/g,'%0A');
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><rect width='100%' height='100%' fill='%23f3f4f6'/><text x='50%' y='50%' fill='%23888' font-size='18' text-anchor='middle' dominant-baseline='middle'>${t}</text></svg>`;
}

// small storage helpers
function persistAll(){ saveFavs(favorites); saveCounts(counts); saveProgress(progress); saveJSON('uploads', uploads); updateStats(); }

// rating helpers
function saveRating(id,val){ saveJSON('ratings', Object.assign(loadJSON('ratings', {}), { [id]: val })); }
function loadRating(id){ return loadJSON('ratings', {})[id] || 0; }

// merge dedupe
function mergeResults(gbooks, gutendex){
  const combined = [...gutendex, ...gbooks];
  const seen = new Set(); const out = [];
  combined.forEach(it => {
    const key = (it.title + '|' + (it.authors||'')).toLowerCase();
    if(!seen.has(key)){ seen.add(key); out.push(it); }
  });
  return out;
}

// update stats shown
function updateStats(){
  stat1 && (stat1.textContent = favorites.length || 0);
  stat2 && (stat2.textContent = (uploads.length || 0));
  stat3 && (stat3.textContent = Object.keys(loadJSON('notes_index', {})).length || 0);
}

// render continue reading
function renderContinue(){
  if(!continueRow) return;
  continueRow.innerHTML = '';
  const items = (uploads.slice(0,6).concat(results.slice(0,6))).slice(0,6);
  if(!items.length){
    continueRow.innerHTML = `<div style="color:var(--muted)">No saved reads yet — try searching books.</div>`;
    return;
  }
  items.forEach(it=>{
    const el = document.createElement('div'); el.className = 'book-card';
    const img = it.thumbnail || it.cover || placeholderSVG(200,280,'No Cover');
    el.innerHTML = `<div class="book-cover"><img loading="lazy" data-src="${img}" src="${placeholderSVG(200,280)}" alt=""></div>
      <div class="book-title">${escapeHtml(it.title)}</div>
      <div class="book-author">${escapeHtml(it.authors||it.author||'Unknown')}</div>`;
    continueRow.appendChild(el);

    // lazy swap
    const imgEl = el.querySelector('img[loading="lazy"]');
    if(imgEl && imgEl.dataset.src){
      const temp = new Image();
      temp.onload = ()=> { imgEl.src = imgEl.dataset.src; imgEl.removeAttribute('data-src'); };
      temp.onerror = ()=> {};
      setTimeout(()=> temp.src = imgEl.dataset.src, 40);
    }
  });
}

// render grid results
function render(list){
  results = Array.isArray(list) ? list : [];
  grid.innerHTML = '';
  if(!results.length){
    grid.innerHTML = `<div class="panel"><strong>No results</strong><div class="small-muted">Try "math", "programming", "austen".</div></div>`;
    renderContinue(); updateStats(); return;
  }

  results.forEach(item=>{
    const id = item.id;
    const isFav = favorites.includes(id);
    const dl = counts[id] || 0;
    const badge = item.source === 'gutendex' ? 'Gutendex' : item.source === 'google' ? 'Google' : 'Upload';
    const cover = item.thumbnail || item.cover || placeholderSVG(400,240);

    const card = document.createElement('article'); card.className = 'lib-card';
    card.innerHTML = `
      <div class="lib-cover"><img loading="lazy" data-src="${cover}" src="${placeholderSVG(400,240)}" alt="${escapeHtml(item.title)}"></div>
      <div class="lib-title">${escapeHtml(item.title)}</div>
      <div class="lib-author">${escapeHtml(item.authors||item.author||'Unknown')}</div>
      <div class="tags">${(item.tags||[]).slice(0,4).map(t=>`<span class="tag-chip">${escapeHtml(t)}</span>`).join('')}</div>
      <div style="display:flex;gap:8px;align-items:center;margin-top:auto">
        <div class="badge">${badge}</div>
        <div style="margin-left:auto;color:var(--muted);font-size:13px">Downloads: <strong>${dl}</strong></div>
      </div>
      <div class="card-row">
        ${item.pdf ? `<a class="btn" data-id="${id}" data-pdf href="${item.pdf}" target="_blank">PDF</a>` : ''}
        ${item.epub ? `<a class="btn" data-id="${id}" data-epub href="${item.epub}" target="_blank">EPUB</a>` : ''}
        <button class="btn" data-preview="${id}">Preview</button>
        <button class="btn" data-fav="${id}">${isFav ? 'Unfav' : 'Fav'}</button>
      </div>
    `;
    grid.appendChild(card);

    // lazy load
    const imgEl = card.querySelector('img[loading="lazy"]');
    if(imgEl && imgEl.dataset.src){
      const temp = new Image();
      temp.onload = ()=> { imgEl.src = imgEl.dataset.src; imgEl.removeAttribute('data-src'); };
      temp.onerror = ()=> {};
      setTimeout(()=> temp.src = imgEl.dataset.src, 40);
    }
  });

  renderContinue();
  updateStats();
}

// increment download counts
function incrementDownload(id){ counts[id] = (counts[id] || 0) + 1; saveCounts(counts); persistAll(); render(results); }

// open preview modal
function openPreview(item){
  if(!item) return;
  const authors = escapeHtml(item.authors || item.author || 'Unknown');
  const thumb = item.thumbnail || item.cover || placeholderSVG(200,280);
  const pdfBtn = item.pdf ? `<a href="${item.pdf}" target="_blank" class="btn">Open PDF</a>` : '';
  const epubBtn = item.epub ? `<a href="${item.epub}" target="_blank" class="btn">Open EPUB</a>` : '';
  modalContent.innerHTML = `
    <div style="display:flex;gap:16px;align-items:flex-start">
      <img src="${thumb}" style="width:140px;height:200px;object-fit:cover;border-radius:8px">
      <div style="flex:1">
        <h2 style="margin:0">${escapeHtml(item.title)}</h2>
        <div style="color:var(--muted);margin:6px 0">${authors}</div>
        <div style="margin-top:8px">${pdfBtn} ${epubBtn} ${item.previewLink ? `<a href="${item.previewLink}" target="_blank" class="btn">Google</a>` : ''}</div>
        <div style="margin-top:12px">
          <strong>Your notes</strong><br>
          <textarea id="noteArea" rows="4" style="width:100%;margin-top:8px">${loadJSON('notes_'+item.id,'') || ''}</textarea>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button id="saveNote" class="btn">Save Note</button>
            <button id="clearNote" class="btn ghost">Clear</button>
          </div>
        </div>
      </div>
    </div>
  `;
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');

  document.getElementById('saveNote')?.addEventListener('click', ()=>{
    const v = document.getElementById('noteArea').value;
    saveJSON('notes_'+item.id, v);
    // maintain index for stats
    const idx = loadJSON('notes_index', {});
    idx[item.id] = !!v;
    saveJSON('notes_index', idx);
    alert('Note saved locally');
    updateStats();
  });
  document.getElementById('clearNote')?.addEventListener('click', ()=>{
    document.getElementById('noteArea').value = '';
    saveJSON('notes_'+item.id, '');
    const idx = loadJSON('notes_index', {}); delete idx[item.id]; saveJSON('notes_index', idx);
    updateStats();
  });
}

// close modal
closeModal?.addEventListener('click', ()=>{ modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); });

// delegation for grid
grid.addEventListener('click', (e)=>{
  const p = e.target;
  if(p.matches('[data-preview]')){
    const id = p.getAttribute('data-preview');
    const item = results.find(r=>r.id===id) || uploads.find(u=>u.id===id);
    openPreview(item);
    return;
  }
  if(p.matches('[data-fav]')){
    const id = p.getAttribute('data-fav'); const i = favorites.indexOf(id);
    if(i===-1) favorites.push(id); else favorites.splice(i,1);
    saveFavs(favorites); persistAll(); render(results); return;
  }
  if(p.matches('a[data-pdf]')){ const id = p.getAttribute('data-id'); incrementDownload(id); return; }
  if(p.matches('a[data-epub]')){ const id = p.getAttribute('data-id'); incrementDownload(id); return; }
});

// search debounce
let searchTimer;
qIn?.addEventListener('input', ()=>{ clearTimeout(searchTimer); searchTimer = setTimeout(()=> runSearch(qIn.value.trim(),1), 450); });
searchBtn?.addEventListener('click', ()=> runSearch(qIn.value.trim(),1));
exploreBtn?.addEventListener('click', ()=> runSearch('computer science',1));
libraryBtn?.addEventListener('click', ()=> { render(loadJSON('uploads', [])); });

// filters & sort
filterSource?.addEventListener('change', ()=> applyFilterSort());
sortBy?.addEventListener('change', ()=> applyFilterSort());

// upload handling
uploadBtn?.addEventListener('click', ()=> fileInput.click());
fileInput?.addEventListener('change', async (ev)=>{
  const f = ev.target.files[0]; if(!f) return; if(f.type !== 'application/pdf'){ alert('Please select a PDF'); return; }
  const reader = new FileReader();
  reader.onload = ()=> {
    const data = reader.result;
    const title = prompt('Title for upload', f.name) || f.name;
    const author = prompt('Author', 'Unknown') || 'Unknown';
    const id = 'upload-' + Date.now();
    uploads.unshift({ id, title, authors: author, thumbnail:'', pdf: data, cover:'', source:'upload' });
    saveJSON('uploads', uploads);
    alert('Saved to My Uploads');
    updateStats();
  };
  reader.readAsDataURL(f);
});

// export/import
exportFavsBtn?.addEventListener('click', ()=>{
  const blob = new Blob([JSON.stringify({ favorites, counts, progress }, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'favorites.json'; a.click(); URL.revokeObjectURL(url);
});
importFavsBtn?.addEventListener('click', ()=> importFile.click());
importFile?.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if(!f) return;
  try{
    const txt = await f.text(); const data = JSON.parse(txt);
    if(Array.isArray(data.favorites)){ favorites = Array.from(new Set([...(favorites||[]), ...data.favorites])); saveFavs(favorites); persistAll(); alert('Imported favorites'); render(results); }
    else alert('Invalid import file (expected favorites array)');
  }catch(err){ alert('Import failed'); console.error(err); }
});

// filter & sort logic
function applyFilterSort(){
  let list = results.slice();
  const f = filterSource?.value || 'all';
  if(f !== 'all') list = list.filter(it => (it.source || 'upload') === f);
  const s = sortBy?.value || 'relevance';
  if(s === 'title') list.sort((a,b)=> (a.title||'').localeCompare(b.title||''));
  if(s === 'downloads') list.sort((a,b)=> (counts[b.id]||0) - (counts[a.id]||0));
  render(list);
}

// run search (calls both APIs)
async function runSearch(q, p=1){
  if(!q){ alert('Please enter a search term'); return; }
  lastQuery = q; page = p;
  // show skeletons
  grid.innerHTML = '';
  showSkeletons(6);
  try{
    const [gRes, gutRes] = await Promise.all([
      searchGoogleBooks(q, GOOGLE_API_KEY, (p-1)*PAGE_SIZE, PAGE_SIZE),
      searchGutendex(q, p, PAGE_SIZE)
    ]);
    const merged = mergeResults(gRes.results || [], gutRes.results || []);
    const matchedUploads = uploads.filter(u => (u.title||'').toLowerCase().includes(q.toLowerCase()));
    results = [...matchedUploads, ...merged];
    // apply filter/sort
    applyFilterSort();
  }catch(err){
    console.error(err); grid.innerHTML = `<div class="panel"><strong>Search failed</strong><div class="small-muted">Check network or API limits</div></div>`;
  }
}

// skeleton
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

// keyboard & accessibility
document.addEventListener('keydown', (e)=>{
  if(e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA'){ e.preventDefault(); qIn.focus(); }
  if(e.key === 'f'){ const firstFav = document.querySelector('[data-fav]'); firstFav && firstFav.click(); }
});

// initial load
window.addEventListener('load', ()=>{
  runSearch(lastQuery,1);
  updateStats();
  renderContinue();
});

// expose for debugging
window._ebook = { runSearch, results, favorites, counts, uploads, saveJSON, loadJSON };
