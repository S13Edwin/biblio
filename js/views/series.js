/**
 * @file series.js
 * Vues Séries : grille de séries, détail d'une série, ajout d'un tome préremplie.
 * Dépend de : components.js, item-form.js
 */

const byVolume = (a, b) => (a.volume ?? 1e9) - (b.volume ?? 1e9) || ncmp(a.title, b.title);
const tomesOf = sid => items.filter(i => i.series_id === sid).sort(byVolume);

function seriesView() {
  if (!seriesReady) return noSeriesMsg('utiliser les séries', 'migration_v4.sql');
  if (curSeries && seriesById.has(curSeries)) return seriesDetail(seriesById.get(curSeries));
  curSeries = null;
  $('#main').innerHTML = `<div class="bar"><input id="sq" type="search" placeholder="Rechercher une série…" value="${esc(serQ)}">
    <select id="sst" style="flex:none;width:auto"><option value="">Toutes</option><option value="en_cours" ${serSt === 'en_cours' ? 'selected' : ''}>En cours</option><option value="terminee" ${serSt === 'terminee' ? 'selected' : ''}>Terminées</option></select></div>
    <div id="saz"></div><div id="sl" class="grid"></div><button class="primary fab" id="newser" aria-label="Nouvelle série">+</button>`;
  const draw = () => {
    const s = serQ.toLowerCase();
    const base = seriesList.filter(x => (!serSt || x.status === serSt) && (!s || x.name.toLowerCase().includes(s)));
    $('#saz').innerHTML = azBar(serL, new Set(base.map(x => initial(x.name))));
    const rows = base.filter(x => !serL || initial(x.name) === serL).sort((a, b) => ncmp(a.name, b.name));
    $('#sl').innerHTML = rows.map(x => {
      const t = tomesOf(x.id), own = t.filter(i => i.owned && !i.wishlist).length, wish = t.filter(i => i.wishlist).length;
      const st = x.status === 'terminee';
      return `<div class="it" data-sid="${x.id}"><div class="cv hasov">${imgHtml(t.find(i => i.cover_url) || {}, x.name) || esc(x.name)}<span class="tag two ov ${st ? 'termine' : 'en_cours'}"><span class="l1">${st ? 'Terminée' : 'En cours'}</span><span class="l2">${t.length} tome${t.length > 1 ? 's' : ''}</span></span></div>
        <div class="t">${esc(x.name)}</div><div class="s">${own} possédé${own > 1 ? 's' : ''}${wish ? ` · ${wish} à acheter` : ''}</div></div>`; }).join('')
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
    <div class="grid" id="st">${t.map(i => cardHtml(i, { pre: i.volume != null ? 'T' + i.volume + ' · ' : '', noRibbon: true })).join('') || '<p class="s">Aucun tome rattaché. Choisis cette série dans la fiche d\'un comics.</p>'}</div>
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
