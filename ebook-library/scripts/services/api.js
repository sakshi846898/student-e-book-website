export async function searchGutendex(q, page = 1, page_size = 12) {
  if (!q) return { results: [], total: 0 };
  const url = `https://gutendex.com/books?search=${encodeURIComponent(q)}&page=${page}&page_size=${page_size}`;
  const res = await fetch(url);
  if (!res.ok) return { results: [], total: 0 };
  const data = await res.json();

  const results = data.results.map(b => {
    const formats = b.formats || {};
    return {
      id: `gut-${b.id}`,
      title: b.title,
      authors: (b.authors || []).map(a => a.name).join(', '),
      thumbnail: formats['image/jpeg'] || "",
      pdf: formats['application/pdf'] || null,
      epub: formats['application/epub+zip'] || null,
      source: 'gutendex'
    };
  });

  return { results, total: data.count };
}

export async function searchGoogleBooks(q, apiKey = "", startIndex = 0, maxResults = 12) {
  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&startIndex=${startIndex}&maxResults=${maxResults}`;
  const res = await fetch(url);
  if (!res.ok) return { results: [], total: 0 };
  const data = await res.json();

  const items = data.items || [];
  const results = items.map(it => ({
    id: `gbook-${it.id}`,
    title: it.volumeInfo.title,
    authors: (it.volumeInfo.authors || []).join(', '),
    thumbnail: it.volumeInfo.imageLinks?.thumbnail || "",
    previewLink: it.volumeInfo.previewLink,
    source: 'google'
  }));

  return { results, total: data.totalItems || 0 };
}
