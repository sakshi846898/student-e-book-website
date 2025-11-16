
# Student E-Book Library (Frontend)

Static frontend project that uses:
- Gutendex API for public-domain book files (PDF/EPUB)
- Google Books API for metadata & previews (optional API key supported)

Features:
- Search (combined results)
- Dark mode toggle
- Responsive polished cards + animations
- Favorites (stored in localStorage)
- Download counter per book (stored in localStorage)
- In-page preview modal, notes, reading progress (manual), share links
- Upload local PDF (stored in browser for demo)
- Simple service worker for caching assets

How to run:
1. Open folder in VS Code.
2. Install Live Server extension (optional).
3. Open `index.html` with Live Server or run a local static server:
   - `python -m http.server 5500` and open `http://localhost:5500`
4. (Optional) Add Google Books API key: paste into `scripts/app.js` at `GOOGLE_API_KEY`.

Legal:
- Only public-domain books are downloadable. For modern copyrighted books we show previews/links.
