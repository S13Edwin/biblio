const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const CATS = {comics_vf:'Comics VF',comics_vo:'Comics VO',bd:'BD',livre:'Livres',manga:'Manga',vinyle:'Vinyles',cd:'CD',dvd:'DVD / Blu-ray'};
const READ = ['comics_vf','comics_vo','bd','livre','manga'], MUSIC = ['vinyle','cd'];
const STAT = {non_commence:'Pas commencé',en_cours:'En cours',termine:'Terminé'};
let items = [], options = [], view = 'comics_vf', q = '', sort = 'titre', session = null;
let issues = [], links = [], issuesReady = false, itemById = new Map(), issueById = new Map(), linksByItem = new Map(), linksByIssue = new Map();
const ISSUE_CATS = ['comics_vf', 'comics_vo'];
let seriesList = [], seriesReady = false, seriesById = new Map(), curSeries = null, serQ = '', serSt = '', serL = '', issL = '';
let issQ = '', issSt = '', openIss = new Set(), issDraw = null, issForce = false;
const serName = i => seriesById.get(i.series_id)?.name || '';
let layout = 'grid'; try { layout = localStorage.getItem('layout') || 'grid'; document.documentElement.dataset.t = localStorage.getItem('theme') || 'bleu'; } catch (e) {}
const $ = s => document.querySelector(s);
const defSort = v => v === 'wishlist' ? 'sortie' : MUSIC.includes(v) ? 'auteur' : 'titre';
function friendly(e) {
  const m = (e && e.message) || String(e || ''), c = e && e.code;
  if (c === '23505' || /duplicate key/i.test(m)) return 'Cette valeur existe déjà.';
  if (c === '22P02' || /invalid input syntax/i.test(m)) return 'Valeur refusée par la base. Vérifie que la mise à jour SQL a bien été lancée.';
  if (c === '23514' || /violates check constraint/i.test(m)) return 'Valeur non autorisée par la base. Vérifie que la mise à jour SQL a bien été lancée.';
  if (/row-level security|permission denied|JWT/i.test(m)) return 'Action refusée : reconnecte-toi puis réessaie.';
  if (/failed to fetch|networkerror|load failed/i.test(m)) return 'Connexion impossible. Vérifie ton réseau.';
  return m;
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  (document.querySelector('dialog[open]') || document.body).append(t); setTimeout(() => t.remove(), 3500);
}
const wait = ms => new Promise(r => setTimeout(r, ms));
// Relance fn tant que l'erreur est temporaire (service indisponible, réseau), jusqu'à `tries` essais.
async function retry(fn, tries = 10, onTry) {
  for (let n = 1; ; n++) {
    try { return await fn(); }
    catch (e) {
      const st = e.status, transient = (st === undefined || st >= 500 || (st === 429 && !/per day/i.test(e.message))) && st !== 400 && st !== 403 && st !== 404;
      if (!transient || n >= tries) { e.tries = n; throw e; }
      if (onTry) onTry(n + 1, tries);
      await wait(Math.min(500 * n, 2500));
    }
  }
}
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const eur = n => (+n || 0).toLocaleString('fr-FR', {style:'currency', currency:'EUR'});
const list = s => s.split(',').map(x => x.trim()).filter(Boolean);

async function init() {
  const { data } = await sb.auth.getSession();
  session = data.session;
  sb.auth.onAuthStateChange((_e, s) => { const was = session; session = s; if (!!s !== !!was) init(); });
  if (!session) return loginView();
  await load();
}

function loginView() {
  $('#app').innerHTML = `<form class="login" id="lf"><h1>Ma bibliothèque</h1>
  <label>E-mail<input name="email" type="email" required autocomplete="username"></label>
  <label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label>
  <p><button class="primary" id="go">Se connecter</button></p><div class="msg" id="lm"></div></form>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); $('#lm').textContent = 'Connexion…';
    const f = e.target;
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    if (error) $('#lm').textContent = 'Erreur : ' + (error.message === 'Invalid login credentials' ? 'e-mail ou mot de passe incorrect.' : error.message);
  };
}

// Supabase renvoie 1000 lignes maximum par requête : on lit par tranches.
async function fetchAll(table, orders) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select('*'); orders.forEach(([c, asc]) => q = q.order(c, { ascending: asc }));
    const r = await q.range(from, from + 999);
    if (r.error) return { data: out, error: r.error };
    out.push(...r.data); if (r.data.length < 1000) break;
  }
  return { data: out };
}
const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
const ncmp = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'fr', { numeric: true });
const today = () => new Date().toLocaleDateString('sv-SE');
function indexIssues() {
  itemById = new Map(items.map(i => [i.id, i])); issueById = new Map(issues.map(i => [i.id, i])); linksByItem = new Map(); linksByIssue = new Map();
  links.forEach(l => { push(linksByItem, l.item_id, l.issue_id); push(linksByIssue, l.issue_id, l.item_id); });
}
const itemIssues = id => (linksByItem.get(id) || []).map(x => issueById.get(x)).filter(Boolean).sort((a, b) => ncmp(a.series, b.series) || ncmp(a.number, b.number));
const progress = id => { const L = (linksByItem.get(id) || []).map(x => issueById.get(x)).filter(Boolean); return { total: L.length, read: L.filter(x => x.read).length }; };
function derive(L, existing) {
  const n = L.filter(x => x.read).length;
  return { status: n === 0 ? 'non_commence' : n === L.length ? 'termine' : 'en_cours', last: L.map(x => x.read_on).filter(Boolean).sort().pop() || existing || today() };
}

async function load() {
  const [a, o, iss, lk, se] = await Promise.all([fetchAll('items', [['created_at', false], ['id', true]]), sb.from('options').select('*').order('name'),
    fetchAll('issues', [['series', true], ['id', true]]), fetchAll('item_issues', [['item_id', true], ['issue_id', true]]), sb.from('series').select('*').order('name')]);
  if (a.error) toast('Chargement impossible : ' + friendly(a.error));
  items = a.data; options = o.data || [];
  issuesReady = !iss.error && !lk.error; issues = issuesReady ? iss.data : []; links = issuesReady ? lk.data : [];
  seriesReady = !se.error; seriesList = seriesReady ? se.data : []; seriesById = new Map(seriesList.map(x => [x.id, x]));
  indexIssues();
  render();
}
// Recalcule le statut des comics qui ont des issues (tout lu = Terminé, une partie = En cours).
async function resync(ids) {
  const ups = [];
  ids.forEach(id => {
    const it = itemById.get(id), L = itemIssues(id); if (!it || !L.length || !ISSUE_CATS.includes(it.category)) return;
    const d = derive(L, it.finished_on), fin = d.status === 'termine' ? d.last : null;
    if (it.read_status !== d.status || (it.finished_on || null) !== fin) ups.push(sb.from('items').update({ read_status: d.status, finished_on: fin }).eq('id', id));
  });
  if (ups.length) { await Promise.all(ups); await load(); }
}

function render() {
  const tabs = Object.entries(CATS).map(([k, v]) => `<button data-v="${k}" class="${view === k ? 'on' : ''}">${v}</button>`).join('')
    + `<button data-v="wishlist" class="${view === 'wishlist' ? 'on' : ''}">À acheter</button><button data-v="series" class="${view === 'series' ? 'on' : ''}">Séries</button><button data-v="issues" class="${view === 'issues' ? 'on' : ''}">Issues</button><button data-v="recap" class="${view === 'recap' ? 'on' : ''}">Récap</button><button data-v="settings" class="${view === 'settings' ? 'on' : ''}">Paramètres</button>`;
  $('#app').innerHTML = `<header><h1>Ma bibliothèque</h1></header><nav>${tabs}</nav><main id="main"></main>`;
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => { view = b.dataset.v; q = ''; sort = defSort(view); curSeries = null; render(); });
  view === 'recap' ? recap() : view === 'settings' ? settings() : view === 'series' ? seriesView() : view === 'issues' ? issuesView() : grid();
}

const stars = n => n ? `<span class="st" style="--p:${n * 20}%" title="${String(n).replace('.', ',')} / 5">★★★★★</span>` : '';
const starTxt = n => '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '');
const fd = d => d ? new Date(d + 'T00:00').toLocaleDateString('fr-FR') : '';
const imgHtml = (i, fb) => i.cover_url ? `<img loading="lazy" src="${esc(i.cover_url)}" alt="" data-fb="${esc(fb)}" onerror="this.replaceWith(document.createTextNode(this.dataset.fb))">` : '';
// Étiquette de lecture. Ligne 1 = statut du tome. Ligne 2 (si besoin) = issues lues + « non possédé » (le cas rare).
function tagHtml(i, ov, wl) {
  if (wl) return `<span class="tag">${CATS[i.category]}</span>${i.release_date ? ` <span class="tag">Sortie ${fd(i.release_date)}</span>` : ''}`;
  if (!READ.includes(i.category)) return '';
  const p = progress(i.id), own = i.owned ? '' : '<span class="np-l">non possédé</span><span class="np-s">non poss.</span>';
  const l2 = [p.total ? `${p.read}/${p.total} lues` : '', own].filter(Boolean).join(' · ');
  return `<span class="tag two ${ov ? 'ov ' : ''}${i.read_status}"><span class="l1">${STAT[i.read_status]}</span>${l2 ? `<span class="l2">${l2}</span>` : ''}</span>`;
}
const SORTS = {titre:'Titre A→Z',auteur:'Auteur A→Z',serie:'Série, tome',recent:'Plus récents',prix:'Prix ↓',fin:'Fin de lecture ↓',note:'Note ↓',sortie:'Date de sortie'};

function grid() {
  const wl = view === 'wishlist';
  const base = items.filter(i => wl ? i.wishlist : (!i.wishlist && i.category === view));
  const uniq = k => [...new Set(base.map(i => i[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const sel = (id, label, vals) => vals.length ? `<select id="${id}"><option value="">${label}</option>${vals.map(v => `<option>${esc(v)}</option>`).join('')}</select>` : '';
  $('#main').innerHTML = `<div class="bar"><input id="q" type="search" placeholder="Rechercher…" value="${esc(q)}"><button type="button" id="lay" style="flex:none">${layout === 'grid' ? '☰ Liste' : '▦ Couvertures'}</button></div>
  <div class="bar">${!wl && READ.includes(view) ? `<select id="f"><option value="">Tous statuts</option>${Object.entries(STAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}<option value="_np">Non possédés</option></select>` : ''}${sel('fc', 'Collection', uniq('collection'))}${sel('fp', 'Éditeur', uniq('publisher'))}${sel('fs', 'Série', [...new Set(base.map(serName).filter(Boolean))].sort(ncmp))}
  <select id="so">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${sort === k ? 'selected' : ''}>${k === 'auteur' && MUSIC.includes(view) ? 'Artiste A→Z' : v}</option>`).join('')}</select></div>
  <div id="g" class="${layout === 'list' ? 'list' : 'grid'}"></div><button class="primary fab" id="add" aria-label="Ajouter">+</button>`;
  const tag = (i, ov) => tagHtml(i, ov, wl), img = imgHtml;
  const draw = () => {
    const f = $('#f')?.value || '', c = $('#fc')?.value || '', p = $('#fp')?.value || '', sr = $('#fs')?.value || '', s = q.toLowerCase();
    const cs = (a, b) => (a || '').localeCompare(b || '', 'fr', { numeric: true }), nm = k => (a, b) => (b[k] ?? -1) - (a[k] ?? -1);
    const S = { recent: () => 0, titre: (a, b) => cs(a.title, b.title), auteur: (a, b) => cs(a.authors[0], b.authors[0]) || cs(a.title, b.title),
      serie: (a, b) => cs(serName(a) || '\uffff', serName(b) || '\uffff') || ((a.volume ?? 1e9) - (b.volume ?? 1e9)) || cs(a.title, b.title),
      prix: nm('price'), note: nm('rating'), fin: (a, b) => cs(b.finished_on, a.finished_on), sortie: (a, b) => cs(a.release_date || '9999', b.release_date || '9999') };
    const rows = base.filter(i => (!f || (f === '_np' ? !i.owned : i.read_status === f)) && (!c || i.collection === c) && (!p || i.publisher === p) && (!sr || serName(i) === sr)
      && (!s || [i.title, serName(i), i.collection, i.publisher, ...i.authors, ...i.illustrators, ...(linksByItem.get(i.id) || []).map(x => { const k = issueById.get(x); return k ? `${k.series} #${k.number} ${k.title || ''}` : ''; })].join(' ').toLowerCase().includes(s))).sort(S[sort]);
    $('#g').innerHTML = rows.map(i => layout === 'list'
      ? `<div class="it" data-id="${i.id}"><div class="th">${img(i, '📖') || '📖'}</div><div style="flex:1;min-width:0"><div class="t">${i.favorite ? '♥ ' : ''}${esc(i.title)}</div><div class="s">${esc([i.authors.join(', '), i.collection].filter(Boolean).join(' · '))}</div>${tag(i)}</div><div class="s" style="text-align:right;white-space:nowrap">${stars(i.rating)}<br>${i.price != null ? eur(i.price) : ''}</div></div>`
      : `<div class="it ${MUSIC.includes(i.category) ? 'square' : ''}" data-id="${i.id}"><div class="cv${READ.includes(i.category) && !wl ? ' hasov' : ''}">${img(i, i.title) || esc(i.title)}${wl ? '' : tag(i, true)}</div><div class="t">${i.favorite ? '♥ ' : ''}${esc(i.title)}</div><div class="s">${esc(i.authors.join(', '))}</div>${i.rating ? `<div class="s">${stars(i.rating)}</div>` : ''}${wl ? tag(i) : ''}</div>`).join('')
      || '<p class="s">Aucun résultat.</p>';
    document.querySelectorAll('.it').forEach(e => e.onclick = () => form(items.find(i => i.id === e.dataset.id)));
  };
  $('#q').oninput = e => { q = e.target.value; draw(); };
  ['f', 'fc', 'fp', 'fs'].forEach(id => { if ($('#' + id)) $('#' + id).onchange = draw; });
  $('#so').onchange = e => { sort = e.target.value; draw(); };
  $('#lay').onclick = () => { layout = layout === 'grid' ? 'list' : 'grid'; try { localStorage.setItem('layout', layout); } catch (e) {} render(); };
  $('#add').onclick = () => form(null);
  draw();
}

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

function scan() {
  return new Promise(async resolve => {
    const d = document.createElement('dialog');
    d.innerHTML = '<video playsinline muted style="width:100%;border-radius:8px"></video><p class="s">Place le code-barres devant la caméra.</p><button type="button">Annuler</button>';
    document.body.append(d); d.showModal();
    const v = d.querySelector('video'); let stop = false, stream, rd;
    const end = r => { stop = true; stream?.getTracks().forEach(t => t.stop()); try { rd?.reset(); } catch (e) {} d.close(); d.remove(); resolve(r); };
    d.querySelector('button').onclick = () => end(null);
    try {
      if ('BarcodeDetector' in window) {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); v.srcObject = stream; await v.play();
        const bd = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
        const tick = async () => { if (stop) return; try { const r = await bd.detect(v); if (r[0]) return end(r[0].rawValue); } catch (e) {} setTimeout(tick, 250); }; tick();
      } else {
        await new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'; sc.onload = ok; sc.onerror = ko; document.head.append(sc); });
        rd = new ZXing.BrowserMultiFormatReader(); rd.decodeFromVideoDevice(undefined, v, r => { if (r && !stop) end(r.getText()); });
      }
    } catch (e) { toast('Caméra indisponible : ' + e.message); end(null); }
  });
}

const STORAGE_QUOTA = 1024 * 1024 * 1024;   // limite de l'offre gratuite Supabase : 1 Go de fichiers
let stInfo = null, stAt = 0;
async function storageUsage(force) {
  if (!force && stInfo && Date.now() - stAt < 60000) return stInfo;
  let bytes = 0, count = 0;
  for (let off = 0; ; off += 1000) {
    const r = await sb.storage.from('covers').list(session.user.id, { limit: 1000, offset: off });
    if (r.error) throw r.error;
    r.data.forEach(f => { if (f.metadata && f.metadata.size != null) { bytes += +f.metadata.size; count++; } });
    if (r.data.length < 1000) break;
  }
  stInfo = { bytes, count }; stAt = Date.now(); return stInfo;
}
const fmtSize = b => b >= 1000 * 1048576 ? (b / 1073741824).toFixed(2).replace('.', ',') + ' Go' : b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(b / 1024)) + ' Ko';
async function showStorage(force) {
  const box = $('#stbody'); if (!box) return;
  try {
    const u = await storageUsage(force); if (!$('#stbody')) return;
    const pct = u.bytes / STORAGE_QUOTA * 100, left = Math.max(0, STORAGE_QUOTA - u.bytes), avg = u.count ? u.bytes / u.count : 50 * 1024, ext = items.filter(i => i.cover_url && !isOurs(i.cover_url)).length;
    const pTxt = pct < 0.1 ? '< 0,1' : pct.toFixed(1).replace('.', ',');
    $('#stsub').textContent = `${pTxt} % utilisé`;
    box.innerHTML = `<div class="meter" role="progressbar" aria-label="Espace utilisé" aria-valuenow="${pct.toFixed(1)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.max(pct, 0.6)}%;${pct > 80 ? 'background:var(--warn)' : ''}"></span></div>
      <p style="margin:6px 0"><b>${fmtSize(u.bytes)}</b> utilisés sur ${fmtSize(STORAGE_QUOTA)} · <b>${fmtSize(left)}</b> restants</p>
      <p class="s" style="margin:0">${u.count} couverture${u.count > 1 ? 's' : ''} stockée${u.count > 1 ? 's' : ''}, environ ${fmtSize(avg)} en moyenne : place pour ${Math.floor(left / avg).toLocaleString('fr-FR')} de plus.${ext ? ` ${ext} couverture${ext > 1 ? 's sont encore hébergées' : ' est encore hébergée'} ailleurs (non comptée${ext > 1 ? 's' : ''}).` : ''}</p>`;
  } catch (e) { if ($('#stbody')) $('#stbody').textContent = 'Lecture du stockage impossible : ' + friendly(e); }
}
const COVER_PATH = '/storage/v1/object/public/covers/';
const isOurs = u => !!u && u.includes(COVER_PATH);
const needsCover = i => !i.cover_url || !isOurs(i.cover_url);
// Réduit l'image (600 px max, JPEG) : une photo de téléphone de 4 Mo devient ~50 Ko.
async function toJpeg(blob, maxW = 600, quality = .82) {
  const bmp = await createImageBitmap(blob), k = Math.min(1, maxW / bmp.width), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(bmp, 0, 0, w, h);
  return new Promise((ok, ko) => c.toBlob(b => b ? ok(b) : ko(new Error('Image illisible')), 'image/jpeg', quality));
}
async function putCover(blob) {
  const jpg = await toJpeg(blob), path = `${session.user.id}/${crypto.randomUUID()}.jpg`;
  const up = await sb.storage.from('covers').upload(path, jpg, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (up.error) throw up.error;
  return sb.storage.from('covers').getPublicUrl(path).data.publicUrl;
}
// Télécharge une image distante : en direct, sinon via le relais gratuit wsrv.nl (qui autorise le téléchargement depuis un navigateur).
async function fetchImg(url) {
  const get = async u => {
    const r = await fetch(u, { signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const b = await r.blob(); if (!/^image\//.test(b.type) || b.size < 500) throw new Error('Pas une image'); return b;
  };
  try { return await get(url); } catch (e) { return get('https://wsrv.nl/?url=' + encodeURIComponent(url) + '&w=800&output=jpg&q=85'); }
}
async function rehost(url) {
  if (!url || isOurs(url)) return url;
  try { return await putCover(await fetchImg(url)); } catch (e) { return null; }
}

let bulkStop = false;
async function bulk() {
  const todo = items.filter(needsCover), set = t => { const e = $('#bk'); if (e) e.textContent = t; };
  let copied = 0, found = 0, miss = 0, streak = 0, lastErr = ''; bulkStop = false;
  for (let n = 0; n < todo.length && !bulkStop; n++) {
    if (!$('#bk')) break;
    set(`${n}/${todo.length} traités · ${copied} copiées · ${found} retrouvées · ${miss} sans résultat`);
    const i = todo[n]; let u = null, kind = '';
    if (i.cover_url) { const mine = await rehost(i.cover_url); if (mine) { u = { cover_url: mine }; kind = 'copied'; } }
    if (!u) {
      let thrown = false; const r = await lookup(i, null, 3).catch(e => { lastErr = e.message; thrown = true; return null; });
      streak = thrown ? streak + 1 : 0;
      if (streak >= 5) { set('Arrêt après 5 erreurs de suite : ' + lastErr); return; }
      const mine = r?.cover ? await rehost(r.cover) : null;
      if (mine) { u = { cover_url: mine }; kind = 'found'; if (!i.summary && r.summary) u.summary = r.summary; if (!i.isbn && r.isbn) u.isbn = r.isbn; if (!i.publisher && r.publisher) u.publisher = r.publisher; }
      await wait(MUSIC.includes(i.category) ? 1100 : 350);
    }
    if (u) { const e = await sb.from('items').update(u).eq('id', i.id); if (!e.error) { Object.assign(i, u); kind === 'copied' ? copied++ : found++; } else miss++; } else miss++;
  }
  set(`Terminé : ${copied} copiées chez toi, ${found} retrouvées, ${miss} sans résultat (à compléter à la main ou via le scan).`);
}

function optSel(kind, cur, pub) {
  let names = options.filter(o => o.kind === kind && (kind !== 'collection' || !pub || !o.parent || o.parent === pub)).map(o => o.name);
  names = [...new Set(names)]; if (cur && !names.includes(cur)) names.push(cur);
  names.sort((a, b) => a.localeCompare(b, 'fr'));
  return `<select name="${kind}" data-opt="${kind}"><option value="">—</option><option value="__new">➕ Nouvelle valeur…</option>${names.map(n => `<option ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
}

// Enregistre les issues d'un comics : crée les nouvelles, met à jour la lecture, ajoute/retire les liens.
async function saveIssues(itemId, L, orig) {
  const uid = session.user.id, k = x => x.series.trim().toLowerCase() + '\u0001' + String(x.number).trim().toLowerCase();
  const fresh = L.filter(x => !x.id);
  if (fresh.length) {
    const r = await sb.from('issues').upsert(fresh.map(x => ({ user_id: uid, series: x.series, number: x.number, title: x.title, read: x.read, read_on: x.read_on })), { onConflict: 'user_id,series,number' }).select();
    if (r.error) throw r.error;
    r.data.forEach(row => { const x = fresh.find(y => k(y) === k(row)); if (x) x.id = row.id; });
  }
  const changed = L.filter(x => { const g = issueById.get(x.id); return g && (g.read !== x.read || (g.read_on || null) !== (x.read_on || null) || (g.title || null) !== (x.title || null)); });
  const rs = await Promise.all(changed.map(x => sb.from('issues').update({ read: x.read, read_on: x.read_on, title: x.title }).eq('id', x.id)));
  const bad = rs.find(r => r.error); if (bad) throw bad.error;
  const now = new Set(L.map(x => x.id).filter(Boolean)), add = [...now].filter(id => !orig.has(id)), rem = [...orig].filter(id => !now.has(id));
  if (add.length) { const r = await sb.from('item_issues').upsert(add.map(id => ({ item_id: itemId, issue_id: id, user_id: uid })), { onConflict: 'item_id,issue_id', ignoreDuplicates: true }); if (r.error) throw r.error; }
  if (rem.length) { const r = await sb.from('item_issues').delete().eq('item_id', itemId).in('issue_id', rem); if (r.error) throw r.error; }
  orig.clear(); now.forEach(id => orig.add(id));
  return changed.map(x => x.id);
}

const seriesDefaults = sid => items.filter(i => i.series_id === sid).sort((a, b) => (b.volume ?? -1) - (a.volume ?? -1) || String(b.created_at).localeCompare(String(a.created_at)))[0] || null;
const nextVolume = sid => { const all = items.filter(i => i.series_id === sid), v = all.map(i => i.volume).filter(x => x != null).map(Number); return String(v.length ? Math.floor(Math.max(...v)) + 1 : all.length + 1); };
const setSel = (sel, val) => { if (!val) return; if (![...sel.options].some(o => o.value === val)) sel.insertBefore(new Option(val, val), sel.options[2] || null); sel.value = val; };

function form(it, pre) {
  const wlNew = !it && view === 'wishlist';
  const src = it || pre || null;
  const cat = src?.category || (CATS[view] ? view : 'comics_vf');
  const d = $('#dlg');
  d.innerHTML = `<form id="fm" method="dialog"><h2 style="margin:0">${it ? 'Modifier' : 'Ajouter'}</h2>
  <label>Catégorie<select name="category">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
  <label id="lt">Titre<input name="title" required value="${esc(src?.title)}"></label>
  <label id="la">Auteur(s), séparés par des virgules<input name="authors" value="${esc(src?.authors?.join(', '))}"></label>
  <label class="r" id="li">Dessinateur(s)<input name="illustrators" value="${esc(src?.illustrators?.join(', '))}"></label>
  <div class="row rp"><label>Éditeur${optSel('publisher', src?.publisher)}</label><label>Collection${optSel('collection', src?.collection, src?.publisher)}</label></div>
  ${seriesReady ? `<div class="row r"><label>Série<select name="series_id"><option value="">—</option><option value="__new">➕ Nouvelle série…</option>${[...seriesList].filter(x => x.status !== 'terminee' || x.id === src?.series_id).sort((x, y) => ncmp(x.name, y.name)).map(x => `<option value="${x.id}" ${x.id === src?.series_id ? 'selected' : ''}>${esc(x.name)}${x.status === 'terminee' ? ' (terminée)' : ''}</option>`).join('')}</select></label>
    <label>Tome n°<input name="volume" inputmode="decimal" value="${src?.volume ?? ''}"></label></div>` : `<p class="s r">Pour les séries, lance d'abord <b>migration_v4.sql</b> dans Supabase.</p>`}
  <label>ISBN / code-barres<input name="isbn" inputmode="numeric" value="${esc(it?.isbn)}"></label>
  <div class="row row3" style="margin-top:8px"><button type="button" id="scan">📷 Scanner</button><button type="button" id="look" title="Une seule requête">🔍 Chercher</button><button type="button" id="look10" title="Réessaie jusqu'à 10 fois si le service est indisponible">🔁 Chercher ×10</button></div>
  <div class="s" style="margin-top:4px">« Chercher » fait une seule requête. « ×10 » réessaie jusqu'à 10 fois si le service est indisponible.</div>
  <div class="msg" id="lk"></div><img id="pv" hidden alt="" style="height:90px;border-radius:4px;margin-top:8px">
  <div class="row"><label>Note<select name="rating"><option value="">—</option>${[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(n => `<option value="${n}" ${+it?.rating === n ? 'selected' : ''}>${starTxt(n)} (${String(n).replace('.', ',')})</option>`).join('')}</select></label>
  <label class="ck" style="margin-top:28px"><input type="checkbox" name="favorite" ${it?.favorite ? 'checked' : ''}>Coup de cœur ♥</label></div>
  <label id="lr">Date de sortie<input name="release_date" type="date" value="${it?.release_date || ''}"></label>
  <label>Résumé<textarea name="summary" rows="4">${esc(it?.summary)}</textarea></label>
  <div id="isec" class="isec" hidden>
    <div class="ihead"><b>Issues contenues</b><span class="s" id="icount"></span></div>
    ${issuesReady ? `<div id="ilist"></div><div class="s" id="inote"></div>
    <details id="iadd"><summary>➕ Ajouter des issues</summary>
      <label>Série<input id="i_series" list="series_dl" autocomplete="off" placeholder="Batman (2011)"></label>
      <datalist id="series_dl">${[...new Set(issues.map(x => x.series))].sort(ncmp).map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <div class="row"><label>De l'issue n°<input id="i_from" placeholder="1"></label><label>à n° (facultatif)<input id="i_to" placeholder="12"></label></div>
      <label>Titre de l'issue (facultatif, pour une seule issue)<input id="i_title"></label>
      <p><button type="button" id="i_go">Ajouter à ce comics</button></p>
    </details>` : `<p class="s">Pour lier des issues, lance d'abord la mise à jour SQL <b>migration_v3.sql</b> dans Supabase.</p>`}
  </div>
  <label class="v">Format<select name="format">${['DVD','Blu-ray','4K'].map(f => `<option ${it?.format === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
  <label>Prix d'achat (€)<input name="price" type="number" step="0.01" min="0" value="${it?.price ?? ''}"></label>
  <div class="r"><div class="row"><label>Statut de lecture<select name="read_status">${Object.entries(STAT).map(([k, v]) => `<option value="${k}" ${it?.read_status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
  <label>Fin de lecture<input name="finished_on" type="date" value="${it?.finished_on || ''}"></label></div>
  <label class="ck"><input type="checkbox" name="owned" ${it ? (it.owned ? 'checked' : '') : (wlNew ? '' : 'checked')}>Je le possède</label></div>
  <label class="ck"><input type="checkbox" name="wishlist" ${it?.wishlist || wlNew ? 'checked' : ''}>Dans ma liste d'achats</label>
  <label>Couverture (photo ou fichier, enregistrée chez toi)<input name="file" type="file" accept="image/*"></label>
  <label>…ou lien d'image (copié chez toi à l'enregistrement)<input name="cover_url" type="url" value="${esc(it?.cover_url)}"></label>
  <div class="acts"><span>${it ? '<button type="button" class="danger" id="del">Supprimer</button>' : ''}${it?.wishlist ? ' <button type="button" id="bought">Acheté</button>' : ''}</span>
  <span><button type="button" id="cx">Annuler</button> <button class="primary" id="sv">Enregistrer</button></span></div><div class="msg" id="em"></div></form>`;
  const f = $('#fm');
  let savedId = it?.id || null;
  // ── issues : copie de travail, enregistrée avec la fiche ──
  const L = it && issuesReady ? itemIssues(it.id).map(x => ({ ...x })) : [], orig = new Set(L.map(x => x.id));
  const keyOf = (se, n) => se.trim().toLowerCase() + '\u0001' + String(n).trim().toLowerCase();
  const gKey = new Map(issues.map(x => [keyOf(x.series, x.number), x]));
  const syncStatus = () => {
    const has = issuesReady && L.length > 0 && ISSUE_CATS.includes(f.category.value); f.read_status.disabled = has;
    if (!has) return;
    const d = derive(L, f.finished_on.value); f.read_status.value = d.status;
    f.finished_on.value = d.status === 'termine' ? d.last : '';
  };
  const renderIssues = () => {
    if (!issuesReady) return;
    L.sort((a, b) => ncmp(a.series, b.series) || ncmp(a.number, b.number));
    $('#icount').textContent = L.length ? `${L.filter(x => x.read).length}/${L.length} lues` : '';
    const groups = []; L.forEach((x, i) => { const g = groups.find(y => y.series === x.series) || groups[groups.push({ series: x.series, rows: [] }) - 1]; g.rows.push([x, i]); });
    $('#ilist').innerHTML = groups.map(g => `<div class="iser"><span>${esc(g.series)}</span><button type="button" class="link" data-all="${esc(g.series)}">${g.rows.every(([x]) => x.read) ? 'Tout décocher' : 'Tout cocher'}</button></div>`
      + g.rows.map(([x, i]) => { const oth = (x.id ? linksByIssue.get(x.id) || [] : []).filter(id => id !== it?.id).map(id => itemById.get(id)?.title).filter(Boolean);
        return `<div class="iss"><label class="ck"><input type="checkbox" data-i="${i}" ${x.read ? 'checked' : ''}><span>#${esc(x.number)}${x.title ? ' — ' + esc(x.title) : ''}</span></label>${x.read ? `<button type="button" class="link dt" data-d="${i}" title="Modifier la date de lecture">${x.read_on ? 'lu le ' + fd(x.read_on) : 'date ?'}</button>` : ''}<button type="button" class="link" data-rm="${i}" aria-label="Retirer l'issue ${esc(x.number)}">×</button>${oth.length ? `<div class="s sh">Aussi dans : ${esc(oth.slice(0, 2).join(', '))}${oth.length > 2 ? ' +' + (oth.length - 2) : ''}</div>` : ''}</div>`; }).join('')).join('')
      || '<p class="s">Aucune issue liée pour le moment.</p>';
    syncStatus();
  };
  const setRead = (x, v) => { x.read = v; x.read_on = v ? (x.read_on || today()) : null; };
  const addIssues = () => {
    const series = $('#i_series').value.trim(), a = $('#i_from').value.trim().replace(/^#/, ''), b = $('#i_to').value.trim().replace(/^#/, ''), title = $('#i_title').value.trim();
    if (!series || !a) return toast('Indique la série et le numéro de l\'issue.');
    let nums = [a];
    if (b) { const x = +a, y = +b; if (!Number.isInteger(x) || !Number.isInteger(y) || y < x) return toast('Pour une plage, utilise deux nombres entiers (ex. 1 à 12).'); if (y - x > 199) return toast('200 issues maximum à la fois.'); nums = Array.from({ length: y - x + 1 }, (_, k) => String(x + k)); }
    const wasDone = f.read_status.value === 'termine' && L.length === 0, shared = new Set(); let added = 0, same = 0;
    nums.forEach(n => {
      const k = keyOf(series, n); if (L.some(x => keyOf(x.series, x.number) === k)) { same++; return; }
      const g = gKey.get(k);
      if (g) { (linksByIssue.get(g.id) || []).filter(id => id !== it?.id).forEach(id => { const t = itemById.get(id)?.title; if (t) shared.add(t); }); L.push({ ...g, title: g.title || (nums.length === 1 && title) || null }); }
      else L.push({ id: null, series, number: String(n), title: nums.length === 1 && title ? title : null, read: wasDone, read_on: wasDone ? (f.finished_on.value || today()) : null });
      added++;
    });
    $('#inote').textContent = [`${added} issue(s) ajoutée(s).`, same ? `${same} déjà dans cette liste.` : '', shared.size ? `Déjà présentes dans : ${[...shared].slice(0, 3).join(', ')}${shared.size > 3 ? '…' : ''}` : ''].filter(Boolean).join(' ');
    $('#i_from').value = ''; $('#i_to').value = ''; $('#i_title').value = ''; renderIssues();
  };
  if (issuesReady) {
    $('#ilist').onchange = e => { const c = e.target.closest('input[data-i]'); if (!c) return; setRead(L[+c.dataset.i], c.checked); renderIssues(); };
    $('#ilist').onclick = e => {
      const rm = e.target.closest('[data-rm]'), all = e.target.closest('[data-all]'), dt = e.target.closest('[data-d]');
      if (dt) {
        const x = L[+dt.dataset.d], inp = document.createElement('input'); inp.type = 'date'; inp.className = 'dti'; inp.value = x.read_on || ''; inp.max = today(); inp.setAttribute('aria-label', 'Date de lecture');
        inp.onchange = () => { x.read_on = inp.value || null; renderIssues(); };
        dt.replaceWith(inp); inp.focus(); try { inp.showPicker(); } catch (err) {}
      }
      if (rm) { L.splice(+rm.dataset.rm, 1); renderIssues(); }
      if (all) { const g = L.filter(x => x.series === all.dataset.all), v = !g.every(x => x.read); g.forEach(x => setRead(x, v)); renderIssues(); }
    };
    $('#i_go').onclick = addIssues;
    $('#isec').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); addIssues(); } });
  }
  const adapt = () => { const c = f.category.value;
    $('#isec').hidden = !ISSUE_CATS.includes(c); if (ISSUE_CATS.includes(c)) renderIssues(); else f.read_status.disabled = false;
    f.querySelectorAll('.r').forEach(e => e.hidden = !READ.includes(c)); f.querySelectorAll('.rp').forEach(e => e.hidden = !(READ.includes(c) || MUSIC.includes(c)));
    f.querySelectorAll('.v').forEach(e => e.hidden = c !== 'dvd'); $('#lr').hidden = !f.wishlist.checked;
    $('#li').hidden = !READ.includes(c);
    $('#lt').firstChild.textContent = MUSIC.includes(c) ? "Nom de l'album" : 'Titre';
    $('#la').firstChild.textContent = MUSIC.includes(c) ? 'Artiste(s), séparés par des virgules' : c === 'dvd' ? 'Réalisateur (facultatif)' : 'Auteur(s), séparés par des virgules'; };
  f.category.onchange = adapt; f.wishlist.onchange = adapt; adapt();
  const fillCol = () => { const cs = f.collection, cur = cs.value, pub = f.publisher.value, t = document.createElement('div');
    t.innerHTML = optSel('collection', cur, pub === '__new' ? '' : pub); cs.innerHTML = t.firstChild.innerHTML; cs.value = cur; };
  f.publisher.addEventListener('change', fillCol);
  if (seriesReady) f.series_id.onchange = async () => {
    const sl = f.series_id;
    if (sl.value === '__new') {
      const n = (prompt('Nom de la série :') || '').trim(); if (!n) { sl.value = ''; return; }
      const ex = seriesList.find(x => x.name.toLowerCase() === n.toLowerCase());
      if (ex) { toast('« ' + ex.name + ' » existe déjà : sélectionnée.'); sl.value = ex.id; }
      else {
        const r = await sb.from('series').insert({ name: n, status: 'en_cours' }).select().single();
        if (r.error) { toast(friendly(r.error)); sl.value = ''; return; }
        seriesList.push(r.data); seriesById.set(r.data.id, r.data); sl.insertBefore(new Option(n, r.data.id), sl.options[2] || null); sl.value = r.data.id;
      }
    }
    const sid = sl.value, sr = seriesById.get(sid); if (!sid || !sr) return;
    const df = seriesDefaults(sid);
    if (!f.volume.value) f.volume.value = nextVolume(sid);
    if (!it) {   // nouveau tome : on reprend les infos des tomes déjà saisis
      if (df && df.category && f.category.value !== df.category) { f.category.value = df.category; adapt(); }
      if (df && !f.publisher.value && df.publisher) { setSel(f.publisher, df.publisher); fillCol(); }
      if (df && !f.collection.value && df.collection) setSel(f.collection, df.collection);
      if (df && !f.authors.value && df.authors?.length) f.authors.value = df.authors.join(', ');
      if (df && !f.illustrators.value && df.illustrators?.length) f.illustrators.value = df.illustrators.join(', ');
      if (!f.title.value) f.title.value = `${sr.name} ${f.volume.value}`.trim();
    }
  };
  f.querySelectorAll('select[data-opt]').forEach(sl => sl.onchange = async () => {
    if (sl.value !== '__new') return;
    const n = (prompt('Nouvelle valeur :') || '').trim(); if (!n) { sl.value = ''; return; }
    const par = sl.dataset.opt === 'collection' && f.publisher.value && f.publisher.value !== '__new' ? f.publisher.value : null;
    const ex = options.find(o => o.kind === sl.dataset.opt && o.name.toLowerCase() === n.toLowerCase() && (o.parent || null) === par);
    if (ex) { toast('« ' + ex.name + ' » existe déjà : sélectionnée.'); const op = [...sl.options].find(x => x.value === ex.name); if (op) sl.value = ex.name; else { sl.insertBefore(new Option(ex.name, ex.name), sl.options[2]); sl.value = ex.name; } return; }
    const r = await sb.from('options').insert({ kind: sl.dataset.opt, name: n, parent: sl.dataset.opt === 'collection' && f.publisher.value && f.publisher.value !== '__new' ? f.publisher.value : null }).select().single();
    if (r.error) { toast(friendly(r.error)); sl.value = ''; return; }
    options.push(r.data); sl.insertBefore(new Option(n, n), sl.options[2]); sl.value = n; if (sl.dataset.opt === 'publisher') fillCol(); });
  $('#scan').onclick = async () => {
    const code = await scan(); if (!code) return;
    const dup = items.find(x => x.isbn === code && x.id !== it?.id); if (dup) toast('Déjà dans ta bibliothèque : « ' + dup.title + ' »');
    f.isbn.value = code; $('#look10').click(); };
  const runLookup = async tries => {
    const c = f.category.value; $('#lk').textContent = 'Recherche…'; $('#look').disabled = $('#look10').disabled = true;
    let err = ''; const r = await lookup({ category: c, title: f.title.value.trim(), authors: list(f.authors.value), isbn: f.isbn.value.trim() },
      (n, t) => { $('#lk').textContent = `Service indisponible, nouvel essai ${n}/${t}…`; }, tries)
      .catch(e => { err = e.status >= 500 ? (tries === 1 ? 'service indisponible. Réessaie, ou utilise « Chercher ×10 ».' : `service indisponible après ${e.tries || tries} essais. Réessaie dans quelques minutes.`) : friendly(e); return null; })
      .finally(() => { $('#look').disabled = $('#look10').disabled = false; });
    if (!r || (!r.cover && !r.summary)) { $('#lk').textContent = c === 'dvd' && !hasTmdb() ? 'Pour les DVD, ajoute une clé TMDB dans config.js.' : (err ? 'Erreur : ' + err : 'Rien trouvé : complète à la main.'); return; }
    if (r.cover && !f.cover_url.value) f.cover_url.value = r.cover;
    if (r.summary && !f.summary.value) f.summary.value = r.summary;
    if (r.isbn && !f.isbn.value) f.isbn.value = r.isbn;
    if (!f.title.value && r.title) f.title.value = r.title;
    if (!f.authors.value && r.authors?.length) f.authors.value = r.authors.join(', ');
    showPv(f.cover_url.value);
    $('#lk').textContent = 'Trouvé : ' + (r.title || '') + (r.cover ? '' : ' (sans couverture)'); };
  $('#look').onclick = () => runLookup(1);
  $('#look10').onclick = () => runLookup(10);
  const showPv = u => { const p = $('#pv'); if (u) { p.src = u; p.hidden = false; } else p.hidden = true; };
  $('#pv').onerror = () => { $('#pv').hidden = true; };
  showPv(it?.cover_url);
  f.cover_url.addEventListener('change', () => showPv(f.cover_url.value.trim()));
  f.file.addEventListener('change', () => { const x = f.file.files[0]; if (x) showPv(URL.createObjectURL(x)); });
  $('#cx').onclick = () => d.close();
  if (it) $('#del').onclick = async () => { if (confirm('Supprimer « ' + it.title + ' » ?')) { await sb.from('items').delete().eq('id', it.id); d.close(); load(); } };
  if (it?.wishlist) $('#bought').onclick = async () => {
    const p = prompt('Prix payé (€) ?', it.price ?? ''); if (p === null) return;
    await sb.from('items').update({ wishlist: false, owned: true, price: p === '' ? null : +p.replace(',', '.') }).eq('id', it.id); d.close(); load(); };
  f.onsubmit = async e => {
    e.preventDefault(); $('#sv').disabled = true; $('#em').textContent = 'Enregistrement…';
    let note = '';
    try {
      let cover = f.cover_url.value.trim() || null;
      const file = f.file.files[0];
      if (file) { $('#em').textContent = 'Enregistrement de la couverture…'; cover = await putCover(file); }
      else if (cover && !isOurs(cover)) {
        $('#em').textContent = 'Copie de la couverture…';
        const mine = await rehost(cover); if (mine) cover = mine; else note = 'Couverture non copiée (lien injoignable) : le lien d\'origine est conservé.';
      }
      $('#em').textContent = 'Enregistrement…';
      const c = f.category.value, read = READ.includes(c);
      const row = { category: c, title: f.title.value.trim(), authors: list(f.authors.value), illustrators: read ? list(f.illustrators.value) : [],
        collection: read || MUSIC.includes(c) ? f.collection.value.trim() || null : null, publisher: f.publisher.value.trim() || null,
        price: f.price.value === '' ? null : +f.price.value, cover_url: cover, owned: f.owned.checked || !read, wishlist: f.wishlist.checked,
        read_status: read ? f.read_status.value : 'non_commence', finished_on: read && f.finished_on.value ? f.finished_on.value : null,
        format: c === 'dvd' ? f.format.value : null,
        isbn: f.isbn.value.trim() || null, rating: +f.rating.value || null, favorite: f.favorite.checked,
        summary: f.summary.value.trim() || null, release_date: f.release_date.value || null };
      if (row.wishlist) row.owned = false;
      if (seriesReady) { row.series_id = read && f.series_id.value && f.series_id.value !== '__new' ? f.series_id.value : null; row.volume = read && f.volume.value.trim() ? (parseFloat(f.volume.value.replace(',', '.')) || null) : null; }
      if (savedId) { const r = await sb.from('items').update(row).eq('id', savedId); if (r.error) throw r.error; }
      else { const r = await sb.from('items').insert(row).select().single(); if (r.error) throw r.error; savedId = r.data.id; }
      let changed = [];
      if (issuesReady && ISSUE_CATS.includes(c)) changed = await saveIssues(savedId, L, orig);
      d.close(); await load();
      const aff = new Set([savedId]); changed.forEach(id => (linksByIssue.get(id) || []).forEach(x => aff.add(x)));
      await resync(aff);
      if (note) toast(note);
    } catch (err) { $('#em').textContent = 'Erreur : ' + friendly(err); $('#sv').disabled = false; }
  };
  d.showModal();
}

const openSec = new Set();
function settings() {
  const sec = (id, title, sub, body) => `<details class="sec" data-sec="${id}" ${openSec.has(id) ? 'open' : ''}><summary><span>${title}</span><span class="s">${sub}</span></summary><div class="secb">${body}</div></details>`;
  const chip = o => `<span class="chip">${esc(o.name)}<button class="link" data-del="${o.id}" data-name="${esc(o.name)}" aria-label="Supprimer ${esc(o.name)}">×</button></span>`;
  const pubs = options.filter(o => o.kind === 'publisher'), cols = options.filter(o => o.kind === 'collection');
  const addRow = (kind, extra) => `<div class="row" style="margin-top:10px;flex-wrap:wrap">${extra || ''}<input id="n_${kind}" placeholder="Nouvelle valeur"><button class="primary" data-add="${kind}" style="flex:none">Ajouter</button></div>`;
  const groups = {}; cols.forEach(o => (groups[o.parent || ''] = groups[o.parent || ''] || []).push(o));
  const colBody = (Object.keys(groups).sort((a, b) => (a || '￿').localeCompare(b || '￿', 'fr')).map(p => `<div class="s" style="margin:8px 0 4px">${p ? esc(p) : 'Sans éditeur'}</div>${groups[p].map(chip).join('')}`).join('') || '<span class="s">Aucune valeur pour le moment.</span>')
    + addRow('collection', `<select id="np_collection"><option value="">Éditeur…</option>${pubs.map(o => `<option>${esc(o.name)}</option>`).join('')}</select>`);
  const TH = { bleu: 'Bleu nuit', vert: 'Vert', bordeaux: 'Bordeaux', graphite: 'Graphite' }, cur = document.documentElement.dataset.t || 'bleu';
  const nocov = items.filter(needsCover).length;
  $('#main').innerHTML =
    sec('publisher', 'Éditeurs', pubs.length, (pubs.map(chip).join('') || '<span class="s">Aucune valeur pour le moment.</span>') + addRow('publisher')) +
    sec('collection', 'Collections', cols.length, colBody) +
    sec('theme', 'Apparence', TH[cur], Object.entries(TH).map(([k, v]) => `<button data-th="${k}" class="${k === cur ? 'on' : ''}">${v}</button>`).join(' ')) +
    sec('covers', 'Couvertures et infos', `${nocov} à copier ou chercher`, `<p class="s" style="margin:0 0 10px">Copie chez toi les couvertures encore hébergées ailleurs, et cherche automatiquement celles qui manquent ou dont le lien est mort (livres : Google Books, musique : MusicBrainz, DVD : TMDB). Peut durer plusieurs minutes : garde cet onglet ouvert.</p>
      <button class="primary" id="bkgo" type="button">Copier et réparer</button> <button id="bkstop" type="button">Arrêter</button><p class="s" id="bk"></p>`) +
    sec('storage', 'Stockage des couvertures', '<span id="stsub">…</span>', `<div id="stbody" class="s">Calcul en cours…</div><p style="margin:10px 0 0"><button type="button" id="strf">Actualiser</button></p>`) +
    sec('data', 'Données', 'Import', `<p class="s" style="margin:0 0 10px">Importer une bibliothèque depuis un export CSV de Notion.</p><a href="import.html"><button class="primary" type="button">Importer depuis Notion</button></a>`) +
    sec('account', 'Compte', esc(session?.user?.email || ''), `<button class="danger" id="out" type="button">Se déconnecter</button>`);
  document.querySelectorAll('details.sec').forEach(d => d.addEventListener('toggle', () => d.open ? openSec.add(d.dataset.sec) : openSec.delete(d.dataset.sec)));
  document.querySelectorAll('[data-add]').forEach(b => {
    const input = $('#n_' + b.dataset.add); input.onkeydown = e => { if (e.key === 'Enter') b.click(); };
    b.onclick = async () => {
      const kind = b.dataset.add, n = input.value.trim(); if (!n) return;
      const par = kind === 'collection' ? ($('#np_collection').value || null) : null;
      if (options.some(o => o.kind === kind && o.name.toLowerCase() === n.toLowerCase() && (o.parent || null) === par)) return toast('« ' + n + ' » existe déjà' + (par ? ' pour ' + par : '') + '.');
      const r = await sb.from('options').insert({ kind, name: n, parent: par }); if (r.error) return toast(friendly(r.error));
      toast('« ' + n + ' » ajouté.'); load(); }; });
  $('#strf').onclick = () => { $('#stbody').textContent = 'Calcul en cours…'; showStorage(true); };
  showStorage();
  $('#bkgo').onclick = bulk; $('#bkstop').onclick = () => { bulkStop = true; };
  $('#out').onclick = () => sb.auth.signOut();
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Retirer « ' + b.dataset.name + ' » de la liste ? Les fiches déjà enregistrées gardent leur valeur.')) return;
    const r = await sb.from('options').delete().eq('id', b.dataset.del); if (r.error) return toast(friendly(r.error)); load(); });
  document.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { try { localStorage.setItem('theme', b.dataset.th); } catch (e) {} document.documentElement.dataset.t = b.dataset.th; settings(); });
}

const byVolume = (a, b) => (a.volume ?? 1e9) - (b.volume ?? 1e9) || ncmp(a.title, b.title);
const tomesOf = sid => items.filter(i => i.series_id === sid).sort(byVolume);
const initial = n => { const c = String(n ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
const AZ = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
const azBar = (cur, have) => `<div class="az" role="group" aria-label="Filtrer par lettre"><button type="button" data-az="" class="${cur ? '' : 'on'}">Tout</button>${AZ.map(l => `<button type="button" data-az="${l}" class="${cur === l ? 'on' : ''}" ${have.has(l) || cur === l ? '' : 'data-empty'} aria-label="Commençant par ${l}">${l}</button>`).join('')}</div>`;
const noSeriesMsg = (what, mig) => { $('#main').innerHTML = `<div class="box"><p class="s" style="margin:0">Pour ${what}, lance d'abord la mise à jour SQL <b>${mig}</b> dans Supabase.</p></div>`; };

function seriesView() {
  if (!seriesReady) return noSeriesMsg('utiliser les séries', 'migration_v4.sql');
  if (curSeries && seriesById.has(curSeries)) return seriesDetail(seriesById.get(curSeries));
  curSeries = null;
  $('#main').innerHTML = `<div class="bar"><input id="sq" type="search" placeholder="Rechercher une série…" value="${esc(serQ)}">
    <select id="sst" style="flex:none;width:auto"><option value="">Toutes</option><option value="en_cours" ${serSt === 'en_cours' ? 'selected' : ''}>En cours</option><option value="terminee" ${serSt === 'terminee' ? 'selected' : ''}>Terminées</option></select></div>
    <div id="saz"></div><div id="sl" class="list"></div><button class="primary fab" id="newser" aria-label="Nouvelle série">+</button>`;
  const draw = () => {
    const s = serQ.toLowerCase();
    const base = seriesList.filter(x => (!serSt || x.status === serSt) && (!s || x.name.toLowerCase().includes(s)));
    $('#saz').innerHTML = azBar(serL, new Set(base.map(x => initial(x.name))));
    const rows = base.filter(x => !serL || initial(x.name) === serL).sort((a, b) => ncmp(a.name, b.name));
    $('#sl').innerHTML = rows.map(x => {
      const t = tomesOf(x.id), own = t.filter(i => i.owned && !i.wishlist).length, wish = t.filter(i => i.wishlist).length;
      return `<div class="it" data-sid="${x.id}"><div class="th">${imgHtml(t.find(i => i.cover_url) || {}, '📚') || '📚'}</div><div style="flex:1;min-width:0"><div class="t">${esc(x.name)}</div>
        <div class="s">${t.length} tome${t.length > 1 ? 's' : ''} · ${own} possédé${own > 1 ? 's' : ''}${wish ? ` · ${wish} à acheter` : ''}</div></div>
        <span class="tag ${x.status === 'terminee' ? 'termine' : 'en_cours'}">${x.status === 'terminee' ? 'Terminée' : 'En cours'}</span></div>`; }).join('')
      || `<p class="s">${seriesList.length ? 'Aucune série ne correspond.' : 'Aucune série pour le moment. Utilise le bouton + pour en créer une.'}</p>`;
    document.querySelectorAll('#sl .it').forEach(e => e.onclick = () => { curSeries = e.dataset.sid; seriesView(); window.scrollTo(0, 0); });
  };
  $('#sq').oninput = e => { serQ = e.target.value; draw(); };
  $('#saz').onclick = e => { const b = e.target.closest('[data-az]'); if (!b) return; serL = b.dataset.az === serL ? '' : b.dataset.az; draw(); };
  $('#sst').onchange = e => { serSt = e.target.value; draw(); };
  $('#newser').onclick = async () => {
    const n = (prompt('Nom de la nouvelle série :') || '').trim(); if (!n) return;
    const ex = seriesList.find(x => x.name.toLowerCase() === n.toLowerCase()); if (ex) { toast('« ' + ex.name + ' » existe déjà.'); curSeries = ex.id; return seriesView(); }
    const r = await sb.from('series').insert({ name: n, status: 'en_cours' }).select().single(); if (r.error) return toast(friendly(r.error));
    curSeries = r.data.id; await load();
  };
  draw();
}

function seriesDetail(s) {
  const t = tomesOf(s.id), vols = t.filter(i => i.volume != null), have = new Set(vols.filter(i => i.owned && !i.wishlist).map(i => Math.floor(i.volume)));
  const max = Math.max(0, ...vols.map(i => Math.floor(i.volume))), miss = []; for (let v = 1; v <= max; v++) if (!have.has(v)) miss.push(v);
  $('#main').innerHTML = `<p style="margin:0 0 6px"><button class="link" id="sback">← Toutes les séries</button></p>
    <div class="ihead"><h2 style="margin:0;font-size:1.3rem">${esc(s.name)}</h2><button class="link" id="sren">✎ Renommer</button></div>
    <div class="bar" style="margin:10px 0 6px"><button data-sst="en_cours" class="${s.status !== 'terminee' ? 'on' : ''}">En cours</button><button data-sst="terminee" class="${s.status === 'terminee' ? 'on' : ''}">Terminée</button></div>
    <p class="s" style="margin:6px 0">${t.length} tome${t.length > 1 ? 's' : ''}${miss.length && s.status === 'terminee' ? ` · tomes que tu n'as pas : ${miss.map(v => 'T' + v).join(', ')}` : ''}</p>
    ${s.status !== 'terminee' ? '<p><button class="primary" id="sadd">➕ Ajouter un tome</button></p>' : '<p class="s">Série terminée : repasse-la « En cours » pour ajouter un tome.</p>'}
    <div class="list" id="st">${t.map(i => `<div class="it" data-id="${i.id}"><div class="th">${imgHtml(i, '📖') || '📖'}</div><div style="flex:1;min-width:0"><div class="t">${i.volume != null ? 'T' + i.volume + ' · ' : ''}${esc(i.title)}</div>${tagHtml(i, false, i.wishlist)}</div></div>`).join('') || '<p class="s">Aucun tome rattaché. Choisis cette série dans la fiche d\'un comics.</p>'}</div>
    <p style="margin-top:20px"><button class="danger" id="sdel">Supprimer la série</button></p>`;
  document.querySelectorAll('#st .it').forEach(e => e.onclick = () => form(items.find(i => i.id === e.dataset.id)));
  $('#sback').onclick = () => { curSeries = null; seriesView(); };
  $('#sren').onclick = async () => {
    const n = (prompt('Nouveau nom :', s.name) || '').trim(); if (!n || n === s.name) return;
    const r = await sb.from('series').update({ name: n }).eq('id', s.id); if (r.error) return toast(friendly(r.error)); load(); };
  document.querySelectorAll('[data-sst]').forEach(b => b.onclick = async () => {
    if (b.dataset.sst === s.status) return;
    const r = await sb.from('series').update({ status: b.dataset.sst }).eq('id', s.id); if (r.error) return toast(friendly(r.error)); load(); });
  if ($('#sadd')) $('#sadd').onclick = () => {
    const df = seriesDefaults(s.id), nv = nextVolume(s.id);
    form(null, { category: df?.category || 'comics_vf', title: `${s.name} ${nv}`, authors: df?.authors || [], illustrators: df?.illustrators || [], publisher: df?.publisher || null, collection: df?.collection || null, series_id: s.id, volume: +nv }); };
  $('#sdel').onclick = async () => {
    if (!confirm('Supprimer la série « ' + s.name + ' » ? Les ' + t.length + ' tome(s) sont conservés, simplement détachés de la série.')) return;
    const r = await sb.from('series').delete().eq('id', s.id); if (r.error) return toast(friendly(r.error)); curSeries = null; toast('Série supprimée.'); load(); };
}

// ───── onglet Issues : suivi de toutes les issues, avec lecture modifiable directement ─────
async function editIssue(id) {
  const x = issueById.get(id); if (!x) return;
  const num = prompt("Numéro de l'issue :", x.number); if (num === null) return;
  const n = num.trim(); if (!n) return toast('Le numéro ne peut pas être vide.');
  const t = prompt("Titre de l'issue (facultatif, laisse vide pour l'effacer) :", x.title || ''); if (t === null) return;
  if (n !== x.number && issues.some(y => y.id !== id && y.series === x.series && y.number === n)) return toast('Une issue n°' + n + ' existe déjà dans « ' + x.series + ' ».');
  const r = await sb.from('issues').update({ number: n, title: t.trim() || null }).eq('id', id); if (r.error) return toast(friendly(r.error));
  load();
}
async function renameIssueSeries(old) {
  const n = (prompt("Nouveau nom de la série d'issues :", old) || '').trim(); if (!n || n === old) return;
  const nums = new Set(issues.filter(x => x.series === old).map(x => x.number)), clash = issues.filter(x => x.series === n && nums.has(x.number)).map(x => x.number);
  if (clash.length) return toast('Impossible : « ' + n + ' » contient déjà les issues n°' + clash.slice(0, 5).join(', ') + (clash.length > 5 ? '…' : '') + '.');
  if (issues.some(x => x.series === n) && !confirm('« ' + n + ' » existe déjà : fusionner les deux séries ?')) return;
  const r = await sb.from('issues').update({ series: n }).eq('series', old); if (r.error) return toast(friendly(r.error));
  if (openIss.delete(old)) openIss.add(n);
  load();
}
async function patchIssue(id, patch) {
  const x = issueById.get(id), prev = { read: x.read, read_on: x.read_on };
  Object.assign(x, patch); if (issDraw) issDraw();
  const r = await sb.from('issues').update(patch).eq('id', id);
  if (r.error) { Object.assign(x, prev); if (issDraw) issDraw(); return toast(friendly(r.error)); }
  await resync(new Set(linksByIssue.get(id) || []));
}
function issuesView() {
  if (!issuesReady) return noSeriesMsg('suivre les issues', 'migration_v3.sql');
  $('#main').innerHTML = `<div class="bar"><input id="iq" type="search" placeholder="Rechercher une série, une issue, un comics…" value="${esc(issQ)}">
    <select id="ist" style="flex:none;width:auto"><option value="">Toutes</option><option value="unread" ${issSt === 'unread' ? 'selected' : ''}>Non lues</option><option value="read" ${issSt === 'read' ? 'selected' : ''}>Lues</option></select></div>
    <div id="iaz"></div><p class="s" id="isum" style="margin:0 0 10px"></p><div id="ig"></div>`;
  let groups = [];
  const body = g => `<div class="iser"><span class="s">${g.rows.length} issue${g.rows.length > 1 ? 's' : ''}</span><button type="button" class="link" data-gren="${esc(g.name)}">✎ Renommer la série</button></div>` + g.rows.map(x => { const inn = (linksByIssue.get(x.id) || []).map(id => itemById.get(id)?.title).filter(Boolean);
    const sd = d => fd(d).replace(/\/20(\d\d)$/, '/$1');
    return `<div class="iss2"><input type="checkbox" data-iid="${x.id}" ${x.read ? 'checked' : ''} aria-label="Issue ${esc(x.number)} lue"><button type="button" class="ix" data-ix title="Voir les comics qui la contiennent"><b class="no">#${esc(x.number)}</b><span class="ti">${esc(x.title || '')}</span>${inn.length > 1 ? `<span class="nb" title="Présente dans ${inn.length} comics">×${inn.length}</span>` : ''}</button>${x.read ? `<button type="button" class="link dt" data-idate="${x.id}" title="Date de lecture : cliquer pour modifier">${x.read_on ? sd(x.read_on) : 'date ?'}</button>` : '<span></span>'}<button type="button" class="link ed" data-ied="${x.id}" aria-label="Modifier le numéro ou le titre de l'issue ${esc(x.number)}" title="Modifier le numéro ou le titre">✎</button><div class="s sh" hidden>${x.title ? esc(x.title) + '<br>' : ''}${inn.length ? 'Dans : ' + esc(inn.join(', ')) : 'Aucun comics lié'}</div></div>`; }).join('');
  const draw = issDraw = () => {
    const s = issQ.toLowerCase(), by = new Map();
    const pre = issues.filter(x => (issSt === 'read' ? x.read : issSt === 'unread' ? !x.read : true)
      && (!s || `${x.series} ${x.number} ${x.title || ''} ${(linksByIssue.get(x.id) || []).map(id => itemById.get(id)?.title || '').join(' ')}`.toLowerCase().includes(s)));
    $('#iaz').innerHTML = azBar(issL, new Set(pre.map(x => initial(x.series))));
    const list = issL ? pre.filter(x => initial(x.series) === issL) : pre;
    list.forEach(x => push(by, x.series, x));
    groups = [...by.entries()].sort((a, b) => ncmp(a[0], b[0])).map(([name, rows]) => ({ name, rows: rows.sort((a, b) => ncmp(a.number, b.number)) }));
    issForce = !!(issQ || issSt || issL) && list.length <= 150;
    $('#isum').textContent = `${issues.filter(x => x.read).length}/${issues.length} issues lues · ${new Set(issues.map(x => x.series)).size} séries${issQ || issSt || issL ? ` · ${list.length} résultat${list.length > 1 ? 's' : ''}` : ''}`;
    $('#ig').innerHTML = groups.map(g => { const open = issForce || openIss.has(g.name);
      return `<details class="sec" data-g="${esc(g.name)}" ${open ? 'open' : ''}><summary><span>${esc(g.name)}</span><span class="s">${g.rows.filter(x => x.read).length}/${g.rows.length}</span></summary><div class="secb">${open ? body(g) : ''}</div></details>`; }).join('')
      || `<p class="s">${issues.length ? 'Aucune issue ne correspond.' : 'Aucune issue pour le moment. Ajoute-en depuis la fiche d\'un comics VF.'}</p>`;
    document.querySelectorAll('#ig details').forEach(d => d.addEventListener('toggle', () => {
      const g = groups.find(x => x.name === d.dataset.g); if (!g) return;
      if (d.open) { if (!issForce) openIss.add(g.name); const b = d.querySelector('.secb'); if (!b.innerHTML.trim()) b.innerHTML = body(g); } else if (!issForce) openIss.delete(g.name);
    }));
  };
  $('#iq').oninput = e => { issQ = e.target.value; draw(); };
  $('#ist').onchange = e => { issSt = e.target.value; draw(); };
  $('#iaz').onclick = e => { const b = e.target.closest('[data-az]'); if (!b) return; issL = b.dataset.az === issL ? '' : b.dataset.az; draw(); };
  $('#ig').onchange = e => { const c = e.target.closest('input[data-iid]'); if (!c) return; const x = issueById.get(c.dataset.iid); patchIssue(x.id, { read: c.checked, read_on: c.checked ? (x.read_on || today()) : null }); };
  $('#ig').onclick = e => {
    const ix = e.target.closest('[data-ix]'); if (ix) { const h = ix.parentElement.querySelector('.sh'); h.hidden = !h.hidden; return; }
    const ed = e.target.closest('[data-ied]'), gr = e.target.closest('[data-gren]');
    if (ed) return editIssue(ed.dataset.ied);
    if (gr) return renameIssueSeries(gr.dataset.gren);
    const b = e.target.closest('[data-idate]'); if (!b) return;
    const x = issueById.get(b.dataset.idate), inp = document.createElement('input'); inp.type = 'date'; inp.className = 'dti'; inp.value = x.read_on || ''; inp.max = today(); inp.setAttribute('aria-label', 'Date de lecture');
    inp.onchange = () => patchIssue(x.id, { read_on: inp.value || null });
    b.replaceWith(inp); inp.focus(); try { inp.showPicker(); } catch (err) {}
  };
  draw();
}

function recap() {
  const have = items.filter(i => !i.wishlist && i.owned), wish = items.filter(i => i.wishlist);
  const spent = have.reduce((s, i) => s + (+i.price || 0), 0);
  const done = items.filter(i => !i.wishlist && READ.includes(i.category) && i.read_status === 'termine');
  const byYear = {}; done.forEach(i => { const y = i.finished_on?.slice(0, 4) || 'Sans date'; byYear[y] = (byYear[y] || 0) + 1; });
  const rows = Object.entries(CATS).map(([k, v]) => {
    const h = have.filter(i => i.category === k), r = READ.includes(k) ? items.filter(i => !i.wishlist && i.category === k && i.read_status === 'termine').length : null;
    return `<tr><td>${v}</td><td>${h.length}${r !== null ? ` · ${r} lus` : ''}</td><td>${eur(h.reduce((s, i) => s + (+i.price || 0), 0))}</td></tr>`; }).join('');
  const kp = (big, lab, sub) => `<div class="box kpi"><div class="big">${big}</div><div class="lab">${lab}</div><div class="s">${sub || '&nbsp;'}</div></div>`;
  const multi = [...linksByIssue.values()].filter(v => v.length > 1).length, nwo = done.filter(i => !i.owned).length;
  $('#main').innerHTML = `<div class="kpis" style="--n:${issues.length ? 5 : 4}">
  ${kp(eur(spent), 'dépensés', 'sur ' + have.length + ' objets')}
  ${kp(have.length, 'objets chez moi', '')}
  ${kp(done.length, 'lectures terminées', nwo ? 'dont ' + nwo + ' non possédées' : '')}
  ${kp(eur(wish.reduce((s, i) => s + (+i.price || 0), 0)), 'à acheter', wish.length + ' objet' + (wish.length > 1 ? 's' : ''))}
  ${issues.length ? kp(issues.filter(x => x.read).length + '/' + issues.length, 'issues lues', multi ? multi + ' dans plusieurs comics' : '') : ''}</div>
  <div class="stats2"><div class="box"><table><tr><th>Catégorie</th><th>Possédés</th><th>Dépensé</th></tr>${rows}</table></div>
  <div class="box"><table><tr><th>Lectures terminées par année</th><th></th></tr>${Object.entries(byYear).sort().reverse().map(([y, n]) => `<tr><td>${y}</td><td>${n}</td></tr>`).join('') || '<tr><td colspan=2 class="s">Aucune lecture terminée.</td></tr>'}</table></div></div>`;
}

// Bouton « remonter en haut » : apparaît dès qu'on a défilé, en bas à droite au-dessus du bouton +.
(function () {
  const up = document.createElement('button'); up.id = 'up'; up.type = 'button'; up.className = 'fab fabup'; up.textContent = '↑'; up.hidden = true; up.setAttribute('aria-label', 'Remonter en haut de la page');
  up.onclick = () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  document.body.append(up);
  addEventListener('scroll', () => { up.hidden = window.scrollY < 500; }, { passive: true });
})();

init();
