/**
 * @file lookup.js
 * Recherche automatique d'infos et de couvertures : Google Books, Open Library, MusicBrainz, TMDB.
 * Dépend de : utils.js, config.js (GB_KEY, TMDB_KEY)
 */

const tok = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1);
const ov = (a, b) => { const B = new Set(b); return a.length ? a.filter(w => B.has(w)).length / a.length : 0; };
const sim = (a, b) => { const A = tok(a), B = tok(b); return Math.max(ov(A, B), ov(B, A)); };
const hasTmdb = () => typeof TMDB_KEY !== 'undefined' && TMDB_KEY;

async function gb(i) {
  const q = i.isbn ? 'isbn:' + i.isbn : `${i.title} ${i.authors[0] || ''}`;
  const key = typeof GB_KEY !== 'undefined' && GB_KEY ? '&key=' + GB_KEY : '', lang = i.isbn ? '' : '&langRestrict=' + (i.category === 'comics_vo' ? 'en' : 'fr');
  const res = await fetch('https://www.googleapis.com/books/v1/volumes?maxResults=5&q=' + encodeURIComponent(q) + lang + key), j = await res.json().catch(() => ({}));
  if (j.error || !res.ok) { const st = j.error?.code || res.status, e = new Error('Google Books (' + st + ') : ' + (j.error?.message || 'service indisponible')); e.status = st; throw e; }
  const best = (j.items || []).map(x => x.volumeInfo).map(v => ({ v, s: i.isbn ? 1 : sim(i.title, v.title + ' ' + (v.subtitle || '')) })).filter(x => x.s >= .5).sort((a, b) => b.s - a.s)[0];
  if (!best) return i.isbn ? gb({ ...i, isbn: '' }) : null;
  const v = best.v, l = v.imageLinks || {};
  return { cover: (l.thumbnail || l.smallThumbnail || '').replace('http://', 'https://').replace('&edge=curl', '') || null,
    summary: (v.description || '').replace(/<[^>]+>/g, ' ').trim() || null, isbn: v.industryIdentifiers?.find(x => x.type === 'ISBN_13')?.identifier,
    publisher: v.publisher, authors: v.authors, title: v.title };
}
async function ol(i) {
  const p = i.isbn ? 'isbn=' + i.isbn : 'q=' + encodeURIComponent(`${i.title} ${i.authors[0] || ''}`) + '&language=' + (i.category === 'comics_vo' ? 'eng' : 'fre');
  const res = await fetch('https://openlibrary.org/search.json?limit=5&fields=title,author_name,cover_i,isbn,publisher&' + p);
  if (!res.ok) { const e = new Error('Open Library (' + res.status + ')'); e.status = res.status; throw e; }
  const j = await res.json();
  const d = (j.docs || []).filter(x => x.cover_i && (i.isbn || sim(i.title, x.title) >= .5))[0];
  return d ? { cover: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`, isbn: d.isbn?.find(x => x.length === 13), publisher: d.publisher?.[0], authors: d.author_name, title: d.title } : null;
}
async function book(i, onTry, tries = 10) {
  let err; try { const r = await retry(() => gb(i), tries, onTry); if (r) return r; } catch (e) { err = e; }
  try { const r2 = await retry(() => ol(i), Math.min(tries, 3), onTry); if (r2) return r2; } catch (e) { err = err || e; }
  if (err) throw err; return null;
}
async function mb(i) {
  const q = i.isbn ? `barcode:${i.isbn}` : `release:"${i.title}"${i.authors[0] ? ` AND artist:"${i.authors[0]}"` : ''}`;
  const res = await fetch('https://musicbrainz.org/ws/2/release/?fmt=json&limit=5&query=' + encodeURIComponent(q));
  if (!res.ok) { const e = new Error('MusicBrainz (' + res.status + ')'); e.status = res.status; throw e; }
  const j = await res.json();
  for (const r of j.releases || []) {
    if (!i.isbn && sim(i.title, r.title) < .5) continue;
    try { const c = await (await fetch('https://coverartarchive.org/release/' + r.id)).json(); const im = c.images?.find(x => x.front) || c.images?.[0];
      if (im) return { cover: (im.thumbnails?.['500'] || im.thumbnails?.large || im.image).replace('http://', 'https://'), isbn: r.barcode, title: r.title }; } catch (e) {}
  }
  return null;
}
async function tmdb(i) {
  if (!hasTmdb()) return null;
  const res = await fetch(`https://api.themoviedb.org/3/search/multi?api_key=${TMDB_KEY}&language=fr-FR&query=${encodeURIComponent(i.title)}`);
  if (!res.ok) { const e = new Error('TMDB (' + res.status + ')'); e.status = res.status; throw e; }
  const j = await res.json();
  const r = (j.results || []).find(x => x.poster_path && sim(i.title, x.title || x.name) >= .5);
  return r ? { cover: 'https://image.tmdb.org/t/p/w500' + r.poster_path, summary: r.overview || null, title: r.title || r.name } : null;
}
const lookup = (i, onTry, tries = 10) => MUSIC.includes(i.category) ? retry(() => mb(i), tries, onTry) : i.category === 'dvd' ? retry(() => tmdb(i), tries, onTry) : book(i, onTry, tries);
