const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const CATS = {comics_vf:'Comics VF',comics_vo:'Comics VO',bd:'BD',livre:'Livres',manga:'Manga',vinyle:'Vinyles',cd:'CD',dvd:'DVD / Blu-ray'};
const READ = ['comics_vf','comics_vo','bd','livre','manga'], MUSIC = ['vinyle','cd'];
const STAT = {non_commence:'Pas commencé',en_cours:'En cours',termine:'Terminé'};
let items = [], options = [], view = 'comics_vf', q = '', sort = 'titre', session = null;
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

async function load() {
  const { data, error } = await sb.from('items').select('*').order('created_at', { ascending: false }).limit(5000);
  if (error) toast('Chargement impossible : ' + friendly(error));
  items = data || [];
  const o = await sb.from('options').select('*').order('name'); options = o.data || [];
  render();
}

function render() {
  const tabs = Object.entries(CATS).map(([k, v]) => `<button data-v="${k}" class="${view === k ? 'on' : ''}">${v}</button>`).join('')
    + `<button data-v="wishlist" class="${view === 'wishlist' ? 'on' : ''}">À acheter</button><button data-v="recap" class="${view === 'recap' ? 'on' : ''}">Récap</button><button data-v="settings" class="${view === 'settings' ? 'on' : ''}">Paramètres</button>`;
  $('#app').innerHTML = `<header><h1>Ma bibliothèque</h1></header><nav>${tabs}</nav><main id="main"></main>`;
  document.querySelectorAll('nav button').forEach(b => b.onclick = () => { view = b.dataset.v; q = ''; sort = defSort(view); render(); });
  view === 'recap' ? recap() : view === 'settings' ? settings() : grid();
}

const stars = n => n ? `<span class="st" style="--p:${n * 20}%" title="${String(n).replace('.', ',')} / 5">★★★★★</span>` : '';
const starTxt = n => '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '');
const fd = d => d ? new Date(d + 'T00:00').toLocaleDateString('fr-FR') : '';
const SORTS = {titre:'Titre A→Z',auteur:'Auteur A→Z',recent:'Plus récents',prix:'Prix ↓',fin:'Fin de lecture ↓',note:'Note ↓',sortie:'Date de sortie'};

function grid() {
  const wl = view === 'wishlist';
  const base = items.filter(i => wl ? i.wishlist : (!i.wishlist && i.category === view));
  const uniq = k => [...new Set(base.map(i => i[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const sel = (id, label, vals) => vals.length ? `<select id="${id}"><option value="">${label}</option>${vals.map(v => `<option>${esc(v)}</option>`).join('')}</select>` : '';
  $('#main').innerHTML = `<div class="bar"><input id="q" type="search" placeholder="Rechercher…" value="${esc(q)}"><button type="button" id="lay" style="flex:none">${layout === 'grid' ? '☰ Liste' : '▦ Couvertures'}</button></div>
  <div class="bar">${!wl && READ.includes(view) ? `<select id="f"><option value="">Tous statuts</option>${Object.entries(STAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}<option value="_np">Non possédés</option></select>` : ''}${sel('fc', 'Collection', uniq('collection'))}${sel('fp', 'Éditeur', uniq('publisher'))}
  <select id="so">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${sort === k ? 'selected' : ''}>${k === 'auteur' && MUSIC.includes(view) ? 'Artiste A→Z' : v}</option>`).join('')}</select></div>
  <div id="g" class="${layout === 'list' ? 'list' : 'grid'}"></div><button class="fab fab2" id="scanadd" aria-label="Scanner pour ajouter">📷</button><button class="primary fab" id="add" aria-label="Ajouter">+</button>`;
  const tag = i => wl ? `<span class="tag">${CATS[i.category]}</span>${i.release_date ? ` <span class="tag">Sortie ${fd(i.release_date)}</span>` : ''}` : READ.includes(i.category) ? `<span class="tag ${i.read_status}">${STAT[i.read_status]}${i.owned ? '' : ' · non possédé'}</span>` : '';
  const img = i => i.cover_url ? `<img loading="lazy" src="${esc(i.cover_url)}" alt="">` : '';
  const draw = () => {
    const f = $('#f')?.value || '', c = $('#fc')?.value || '', p = $('#fp')?.value || '', s = q.toLowerCase();
    const cs = (a, b) => (a || '').localeCompare(b || '', 'fr', { numeric: true }), nm = k => (a, b) => (b[k] ?? -1) - (a[k] ?? -1);
    const S = { recent: () => 0, titre: (a, b) => cs(a.title, b.title), auteur: (a, b) => cs(a.authors[0], b.authors[0]) || cs(a.title, b.title),
      prix: nm('price'), note: nm('rating'), fin: (a, b) => cs(b.finished_on, a.finished_on), sortie: (a, b) => cs(a.release_date || '9999', b.release_date || '9999') };
    const rows = base.filter(i => (!f || (f === '_np' ? !i.owned : i.read_status === f)) && (!c || i.collection === c) && (!p || i.publisher === p)
      && (!s || [i.title, i.collection, i.publisher, i.contents, ...i.authors, ...i.illustrators].join(' ').toLowerCase().includes(s))).sort(S[sort]);
    $('#g').innerHTML = rows.map(i => layout === 'list'
      ? `<div class="it" data-id="${i.id}"><div class="th">${img(i) || '📖'}</div><div style="flex:1;min-width:0"><div class="t">${i.favorite ? '♥ ' : ''}${esc(i.title)}</div><div class="s">${esc([i.authors.join(', '), i.collection].filter(Boolean).join(' · '))}</div>${tag(i)}</div><div class="s" style="text-align:right;white-space:nowrap">${stars(i.rating)}<br>${i.price != null ? eur(i.price) : ''}</div></div>`
      : `<div class="it ${MUSIC.includes(i.category) ? 'square' : ''}" data-id="${i.id}"><div class="cv">${img(i) || esc(i.title)}</div><div class="t">${i.favorite ? '♥ ' : ''}${esc(i.title)}</div><div class="s">${esc(i.authors.join(', '))}</div>${i.rating ? `<div class="s">${stars(i.rating)}</div>` : ''}${tag(i)}</div>`).join('')
      || '<p class="s">Aucun résultat.</p>';
    document.querySelectorAll('.it').forEach(e => e.onclick = () => form(items.find(i => i.id === e.dataset.id)));
  };
  $('#q').oninput = e => { q = e.target.value; draw(); };
  ['f', 'fc', 'fp'].forEach(id => { if ($('#' + id)) $('#' + id).onchange = draw; });
  $('#so').onchange = e => { sort = e.target.value; draw(); };
  $('#lay').onclick = () => { layout = layout === 'grid' ? 'list' : 'grid'; try { localStorage.setItem('layout', layout); } catch (e) {} render(); };
  $('#add').onclick = () => form(null);
  $('#scanadd').onclick = () => { form(null); $('#scan').click(); };
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

let bulkStop = false;
async function bulk() {
  const todo = items.filter(i => !i.cover_url), set = t => { const e = $('#bk'); if (e) e.textContent = t; };
  let ok = 0, miss = 0, streak = 0, lastErr = ''; bulkStop = false;
  for (let n = 0; n < todo.length && !bulkStop; n++) {
    if (!$('#bk')) break;
    set(`${n}/${todo.length} traités · ${ok} complétés · ${miss} sans résultat`);
    let thrown = false; const i = todo[n], r = await lookup(i, null, 3).catch(e => { lastErr = e.message; thrown = true; return null; });
    streak = thrown ? streak + 1 : 0;
    if (streak >= 5) { set('Arrêt après 5 erreurs de suite : ' + lastErr); return; }
    if (r?.cover) {
      const u = { cover_url: r.cover }; if (!i.summary && r.summary) u.summary = r.summary; if (!i.isbn && r.isbn) u.isbn = r.isbn; if (!i.publisher && r.publisher) u.publisher = r.publisher;
      const e = await sb.from('items').update(u).eq('id', i.id); if (!e.error) { Object.assign(i, u); ok++; } else miss++;
    } else miss++;
    await new Promise(k => setTimeout(k, MUSIC.includes(i.category) ? 1100 : 350));
  }
  set(`Terminé : ${ok} complétés, ${miss} sans résultat (à compléter à la main ou via le scan).`);
}

function optSel(kind, cur, pub) {
  let names = options.filter(o => o.kind === kind && (kind !== 'collection' || !pub || !o.parent || o.parent === pub)).map(o => o.name);
  names = [...new Set(names)]; if (cur && !names.includes(cur)) names.push(cur);
  names.sort((a, b) => a.localeCompare(b, 'fr'));
  return `<select name="${kind}" data-opt="${kind}"><option value="">—</option><option value="__new">➕ Nouvelle valeur…</option>${names.map(n => `<option ${n === cur ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
}

function form(it) {
  const wlNew = !it && view === 'wishlist';
  const cat = it?.category || (CATS[view] ? view : 'comics_vf');
  const d = $('#dlg');
  d.innerHTML = `<form id="fm" method="dialog"><h2 style="margin:0">${it ? 'Modifier' : 'Ajouter'}</h2>
  <label>Catégorie<select name="category">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
  <label id="lt">Titre<input name="title" required value="${esc(it?.title)}"></label>
  <label id="la">Auteur(s), séparés par des virgules<input name="authors" value="${esc(it?.authors.join(', '))}"></label>
  <label class="r" id="li">Dessinateur(s)<input name="illustrators" value="${esc(it?.illustrators.join(', '))}"></label>
  <div class="row r"><label>Éditeur${optSel('publisher', it?.publisher)}</label><label>Collection${optSel('collection', it?.collection, it?.publisher)}</label></div>
  <label>ISBN / code-barres<input name="isbn" inputmode="numeric" value="${esc(it?.isbn)}"></label>
  <div class="row" style="margin-top:8px"><button type="button" id="scan">📷 Scanner</button><button type="button" id="look">🔍 Chercher infos</button></div>
  <div class="msg" id="lk"></div><img id="pv" hidden alt="" style="height:90px;border-radius:4px;margin-top:8px">
  <div class="row"><label>Note<select name="rating"><option value="">—</option>${[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(n => `<option value="${n}" ${+it?.rating === n ? 'selected' : ''}>${starTxt(n)} (${String(n).replace('.', ',')})</option>`).join('')}</select></label>
  <label class="ck" style="margin-top:28px"><input type="checkbox" name="favorite" ${it?.favorite ? 'checked' : ''}>Coup de cœur ♥</label></div>
  <label id="lr">Date de sortie<input name="release_date" type="date" value="${it?.release_date || ''}"></label>
  <label>Résumé<textarea name="summary" rows="4">${esc(it?.summary)}</textarea></label>
  <label class="r">Sommaire (épisodes contenus)<textarea name="contents" rows="3">${esc(it?.contents)}</textarea></label>
  <label class="v">Format<select name="format">${['DVD','Blu-ray','4K'].map(f => `<option ${it?.format === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
  <label>Prix d'achat (€)<input name="price" type="number" step="0.01" min="0" value="${it?.price ?? ''}"></label>
  <div class="r"><div class="row"><label>Statut de lecture<select name="read_status">${Object.entries(STAT).map(([k, v]) => `<option value="${k}" ${it?.read_status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
  <label>Fin de lecture<input name="finished_on" type="date" value="${it?.finished_on || ''}"></label></div>
  <label class="ck"><input type="checkbox" name="owned" ${it ? (it.owned ? 'checked' : '') : (wlNew ? '' : 'checked')}>Je le possède</label></div>
  <label class="ck"><input type="checkbox" name="wishlist" ${it?.wishlist || wlNew ? 'checked' : ''}>Dans ma liste d'achats</label>
  <label>Couverture (photo ou fichier)<input name="file" type="file" accept="image/*"></label>
  <label>…ou lien d'image<input name="cover_url" type="url" value="${esc(it?.cover_url)}"></label>
  <div class="acts"><span>${it ? '<button type="button" class="danger" id="del">Supprimer</button>' : ''}${it?.wishlist ? ' <button type="button" id="bought">Acheté</button>' : ''}</span>
  <span><button type="button" id="cx">Annuler</button> <button class="primary" id="sv">Enregistrer</button></span></div><div class="msg" id="em"></div></form>`;
  const f = $('#fm');
  const adapt = () => { const c = f.category.value;
    f.querySelectorAll('.r').forEach(e => e.hidden = !READ.includes(c));
    f.querySelectorAll('.v').forEach(e => e.hidden = c !== 'dvd'); $('#lr').hidden = !f.wishlist.checked;
    $('#li').hidden = !READ.includes(c);
    $('#lt').firstChild.textContent = MUSIC.includes(c) ? "Nom de l'album" : 'Titre';
    $('#la').firstChild.textContent = MUSIC.includes(c) ? 'Artiste(s), séparés par des virgules' : c === 'dvd' ? 'Réalisateur (facultatif)' : 'Auteur(s), séparés par des virgules'; };
  f.category.onchange = adapt; f.wishlist.onchange = adapt; adapt();
  const fillCol = () => { const cs = f.collection, cur = cs.value, pub = f.publisher.value, t = document.createElement('div');
    t.innerHTML = optSel('collection', cur, pub === '__new' ? '' : pub); cs.innerHTML = t.firstChild.innerHTML; cs.value = cur; };
  f.publisher.addEventListener('change', fillCol);
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
    f.isbn.value = code; $('#look').click(); };
  $('#look').onclick = async () => {
    const c = f.category.value; $('#lk').textContent = 'Recherche…';
    let err = ''; const r = await lookup({ category: c, title: f.title.value.trim(), authors: list(f.authors.value), isbn: f.isbn.value.trim() },
      (n, t) => { $('#lk').textContent = `Service indisponible, nouvel essai ${n}/${t}…`; }).catch(e => { err = e.status >= 500 ? `service indisponible après ${e.tries || 10} essais. Réessaie dans quelques minutes.` : friendly(e); return null; });
    if (!r || (!r.cover && !r.summary)) { $('#lk').textContent = c === 'dvd' && !hasTmdb() ? 'Pour les DVD, ajoute une clé TMDB dans config.js.' : (err ? 'Erreur : ' + err : 'Rien trouvé : complète à la main.'); return; }
    if (r.cover && !f.cover_url.value) f.cover_url.value = r.cover;
    if (r.summary && !f.summary.value) f.summary.value = r.summary;
    if (r.isbn && !f.isbn.value) f.isbn.value = r.isbn;
    if (!f.title.value && r.title) f.title.value = r.title;
    if (!f.authors.value && r.authors?.length) f.authors.value = r.authors.join(', ');
    const cv = f.cover_url.value; if (cv) { $('#pv').src = cv; $('#pv').hidden = false; }
    $('#lk').textContent = 'Trouvé : ' + (r.title || '') + (r.cover ? '' : ' (sans couverture)'); };
  $('#cx').onclick = () => d.close();
  if (it) $('#del').onclick = async () => { if (confirm('Supprimer « ' + it.title + ' » ?')) { await sb.from('items').delete().eq('id', it.id); d.close(); load(); } };
  if (it?.wishlist) $('#bought').onclick = async () => {
    const p = prompt('Prix payé (€) ?', it.price ?? ''); if (p === null) return;
    await sb.from('items').update({ wishlist: false, owned: true, price: p === '' ? null : +p.replace(',', '.') }).eq('id', it.id); d.close(); load(); };
  f.onsubmit = async e => {
    e.preventDefault(); $('#sv').disabled = true; $('#em').textContent = 'Enregistrement…';
    try {
      let cover = f.cover_url.value.trim() || null;
      const file = f.file.files[0];
      if (file) {
        const path = `${session.user.id}/${crypto.randomUUID()}.${(file.name.split('.').pop() || 'jpg').toLowerCase()}`;
        const up = await sb.storage.from('covers').upload(path, file, { contentType: file.type });
        if (up.error) throw up.error;
        cover = sb.storage.from('covers').getPublicUrl(path).data.publicUrl;
      }
      const c = f.category.value, read = READ.includes(c);
      const row = { category: c, title: f.title.value.trim(), authors: list(f.authors.value), illustrators: read ? list(f.illustrators.value) : [],
        collection: read || MUSIC.includes(c) ? f.collection.value.trim() || null : null, publisher: f.publisher.value.trim() || null,
        price: f.price.value === '' ? null : +f.price.value, cover_url: cover, owned: f.owned.checked || !read, wishlist: f.wishlist.checked,
        read_status: read ? f.read_status.value : 'non_commence', finished_on: read && f.finished_on.value ? f.finished_on.value : null,
        format: c === 'dvd' ? f.format.value : null,
        isbn: f.isbn.value.trim() || null, rating: +f.rating.value || null, favorite: f.favorite.checked,
        summary: f.summary.value.trim() || null, contents: f.contents.value.trim() || null, release_date: f.release_date.value || null };
      if (row.wishlist) row.owned = false;
      const r = it ? await sb.from('items').update(row).eq('id', it.id) : await sb.from('items').insert(row);
      if (r.error) throw r.error;
      d.close(); load();
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
  const nocov = items.filter(i => !i.cover_url).length;
  $('#main').innerHTML =
    sec('publisher', 'Éditeurs', pubs.length, (pubs.map(chip).join('') || '<span class="s">Aucune valeur pour le moment.</span>') + addRow('publisher')) +
    sec('collection', 'Collections', cols.length, colBody) +
    sec('theme', 'Apparence', TH[cur], Object.entries(TH).map(([k, v]) => `<button data-th="${k}" class="${k === cur ? 'on' : ''}">${v}</button>`).join(' ')) +
    sec('covers', 'Couvertures et infos', `${nocov} sans couverture`, `<p class="s" style="margin:0 0 10px">Recherche automatique pour les éléments sans couverture (livres : Google Books, musique : MusicBrainz, DVD : TMDB). Peut durer plusieurs minutes : garde cet onglet ouvert.</p>
      <button class="primary" id="bkgo" type="button">Lancer</button> <button id="bkstop" type="button">Arrêter</button><p class="s" id="bk"></p>`) +
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
  $('#bkgo').onclick = bulk; $('#bkstop').onclick = () => { bulkStop = true; };
  $('#out').onclick = () => sb.auth.signOut();
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Retirer « ' + b.dataset.name + ' » de la liste ? Les fiches déjà enregistrées gardent leur valeur.')) return;
    const r = await sb.from('options').delete().eq('id', b.dataset.del); if (r.error) return toast(friendly(r.error)); load(); });
  document.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { try { localStorage.setItem('theme', b.dataset.th); } catch (e) {} document.documentElement.dataset.t = b.dataset.th; settings(); });
}

function recap() {
  const have = items.filter(i => !i.wishlist && i.owned), wish = items.filter(i => i.wishlist);
  const spent = have.reduce((s, i) => s + (+i.price || 0), 0);
  const done = items.filter(i => !i.wishlist && READ.includes(i.category) && i.read_status === 'termine');
  const byYear = {}; done.forEach(i => { const y = i.finished_on?.slice(0, 4) || 'Sans date'; byYear[y] = (byYear[y] || 0) + 1; });
  const rows = Object.entries(CATS).map(([k, v]) => {
    const h = have.filter(i => i.category === k), r = READ.includes(k) ? items.filter(i => !i.wishlist && i.category === k && i.read_status === 'termine').length : null;
    return `<tr><td>${v}</td><td>${h.length}${r !== null ? ` · ${r} lus` : ''}</td><td>${eur(h.reduce((s, i) => s + (+i.price || 0), 0))}</td></tr>`; }).join('');
  $('#main').innerHTML = `<div class="stats">
  <div class="box"><div class="big">${eur(spent)}</div><div class="s">dépensés au total</div></div>
  <div class="box"><div class="big">${have.length}</div><div class="s">objets chez moi</div></div>
  <div class="box"><div class="big">${done.length}</div><div class="s">lectures terminées (dont ${done.filter(i => !i.owned).length} non possédées)</div></div>
  <div class="box"><div class="big">${eur(wish.reduce((s, i) => s + (+i.price || 0), 0))}</div><div class="s">pour ${wish.length} objet(s) à acheter</div></div></div>
  <div class="stats" style="margin-top:12px"><div class="box"><table><tr><th>Catégorie</th><th>Possédés</th><th>Dépensé</th></tr>${rows}</table></div>
  <div class="box"><table><tr><th>Lectures terminées par année</th><th></th></tr>${Object.entries(byYear).sort().reverse().map(([y, n]) => `<tr><td>${y}</td><td>${n}</td></tr>`).join('') || '<tr><td colspan=2 class="s">Aucune lecture terminée.</td></tr>'}</table></div></div>`;
}

init();
