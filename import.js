const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = s => document.querySelector(s);
const CATS = {comics_vf:'Comics VF',comics_vo:'Comics VO',bd:'BD',livre:'Livres',manga:'Manga',vinyle:'Vinyles',cd:'CD',dvd:'DVD / Blu-ray'};
const norm = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const CATMAP = {livre:'livre',livres:'livre',comicsvf:'comics_vf',comicsvo:'comics_vo',bd:'bd',manga:'manga',vinyle:'vinyle',vinyl:'vinyle',cd:'cd',dvd:'dvd',bluray:'dvd',dvdbluray:'dvd',dvdbluray:'dvd'};
const MON = {};
'janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre'.split(' ').forEach((m, i) => MON[m] = i + 1);
'january february march april may june july august september october november december'.split(' ').forEach((m, i) => MON[m] = i + 1);
let rows = [], existing = new Set();

function parseCSV(t) {
  t = t.replace(/^\uFEFF/, ''); const out = []; let r = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { r.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; r.push(f); f = ''; out.push(r); r = []; }
    else f += c; }
  if (f || r.length) { r.push(f); out.push(r); }
  return out.filter(x => x.some(v => v.trim()));
}
const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
function pd(s) { s = (s || '').trim(); if (!s) return null; let m;
  if (m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)) return iso(m[1], m[2], m[3]);
  if (m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)) return iso(m[3], m[2], m[1]);
  if (m = s.match(/^(\d{1,2})\s+(\p{L}+)\.?\s+(\d{4})/u)) { const mo = MON[norm(m[2])]; return mo ? iso(m[3], mo, m[1]) : null; }
  if (m = s.match(/^(\p{L}+)\s+(\d{1,2}),?\s+(\d{4})/u)) { const mo = MON[norm(m[1])]; return mo ? iso(m[3], mo, m[2]) : null; }
  return null; }
const list = s => (s || '').split(/[,;]/).map(x => x.trim()).filter(Boolean);

async function start() {
  const { data } = await sb.auth.getSession();
  if (!data.session) { $('#auth').innerHTML = 'Tu n\'es pas connecté. <a href="./">Connecte-toi sur la page principale</a>, puis reviens ici.'; return; }
  $('#auth').innerHTML = '<span class="ok">Connecté.</span> Les éléments déjà présents ne seront pas dupliqués.';
  $('#step').hidden = false; $('#isb').hidden = false;
  const r = await sb.from('items').select('title,category').limit(5000);
  existing = new Set((r.data || []).map(i => i.category + '|' + i.title.toLowerCase().trim()));
}

$('#file').onchange = async e => {
  const t = await e.target.files[0].text(); const tab = parseCSV(t);
  const h = tab[0].map(norm); const col = n => h.indexOf(n);
  const g = (r, n) => (col(n) >= 0 ? (r[col(n)] || '').trim() : '');
  rows = tab.slice(1).map(r => ({ title: g(r, 'nom'), authors: list(g(r, 'auteur')), illustrators: list(g(r, 'dessinateur')),
    price: parseFloat(g(r, 'prix').replace(/\s/g, '').replace(',', '.')) || null, statut: norm(g(r, 'statut')),
    finished_on: pd(g(r, 'terminele')), type: g(r, 'type'), sel: g(r, 'selection') })).filter(r => r.title);
  draw();
};
$('#sel').onchange = () => rows.length && draw();

function cat(r) { return r.forcedCat || CATMAP[norm(r.type)] || ''; }
function draw() {
  const unknown = [...new Set(rows.filter(r => !cat(r)).map(r => r.type))];
  const ready = rows.filter(r => cat(r)), counts = {};
  ready.forEach(r => counts[cat(r)] = (counts[cat(r)] || 0) + 1);
  const dup = ready.filter(r => existing.has(cat(r) + '|' + r.title.toLowerCase())).length;
  $('#prev').innerHTML = `<div class="box"><b>2. Vérification</b><p>${rows.length} lignes lues.
  ${Object.entries(counts).map(([k, n]) => `${CATS[k]} : ${n}`).join(' · ')}</p>
  ${unknown.length ? `<p class="ko">Types non reconnus, choisis la catégorie :</p>` + unknown.map(u => `<p>« ${u || '(vide)'} » → <select data-t="${u}"><option value="">— ignorer —</option>${Object.entries(CATS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></p>`).join('') : ''}
  ${dup ? `<p class="s">${dup} déjà présents dans la base : ils seront ignorés.</p>` : ''}
  <table><tr><th>Titre</th><th>Catégorie</th><th>Prix</th><th>Statut</th></tr>${ready.slice(0, 6).map(r => `<tr><td>${r.title}</td><td>${CATS[cat(r)]}</td><td>${r.price ?? ''}</td><td>${r.statut}</td></tr>`).join('')}</table>
  <p><button id="go">Importer ${ready.length - dup} élément(s)</button> <span id="res"></span></p></div>`;
  document.querySelectorAll('select[data-t]').forEach(s => s.onchange = () => { rows.forEach(r => { if (r.type === s.dataset.t) r.forcedCat = s.value; }); draw(); });
  $('#go').onclick = async () => {
    $('#go').disabled = true;
    const keep = $('#sel').checked;
    const out = ready.filter(r => !existing.has(cat(r) + '|' + r.title.toLowerCase())).map(r => {
      const wish = r.statut.includes('acheter'), c = cat(r);
      return { category: c, title: r.title, authors: r.authors, illustrators: r.illustrators, price: r.price,
        collection: keep && r.sel ? r.sel : null, owned: !wish, wishlist: wish, finished_on: r.finished_on,
        read_status: r.statut.includes('termin') ? 'termine' : r.statut.includes('cours') ? 'en_cours' : 'non_commence' }; });
    for (let i = 0; i < out.length; i += 100) {
      const { error } = await sb.from('items').insert(out.slice(i, i + 100));
      if (error) { $('#res').innerHTML = `<span class="ko">Erreur : ${error.message}</span>`; $('#go').disabled = false; return; }
      $('#res').textContent = `${Math.min(i + 100, out.length)} / ${out.length}…`;
    }
    $('#res').innerHTML = `<span class="ok">Terminé : ${out.length} importés.</span> <a href="./">Retour à la bibliothèque</a>`;
  };
}
$('#f2').onchange = async e => {
  const tab = parseCSV(await e.target.files[0].text()), h = tab[0].map(norm), ci = ['lien', 'url'].map(n => h.indexOf(n)), ti = h.indexOf('nom'), map = new Map();
  tab.slice(1).forEach(r => { const m = ci.map(k => k >= 0 ? (r[k] || '').match(/97[89]\d{10}/) : null).find(Boolean); if (m) map.set((r[ti] || '').trim().toLowerCase(), m[0]); });
  const { data } = await sb.from('items').select('id,title,isbn').limit(5000);
  const todo = (data || []).filter(x => !x.isbn && map.has(x.title.trim().toLowerCase()));
  $('#r2').textContent = todo.length + ' ISBN trouvés…';
  for (let k = 0; k < todo.length; k += 10) {
    const rs = await Promise.all(todo.slice(k, k + 10).map(x => sb.from('items').update({ isbn: map.get(x.title.trim().toLowerCase()) }).eq('id', x.id)));
    const er = rs.find(r => r.error); if (er) { $('#r2').innerHTML = '<span class="ko">Erreur : ' + er.error.message + ' (migration V2 faite ?)</span>'; return; } }
  $('#r2').innerHTML = '<span class="ok">' + todo.length + ' ISBN renseignés.</span>';
};
start();
