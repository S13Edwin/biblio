/**
 * @file collection.js
 * Vue Collection : pastilles de catégories, recherche, filtres, tris, grille de couvertures ou liste.
 * Dépend de : components.js
 */

const SORTS = {titre:'Titre A→Z',auteur:'Auteur A→Z',serie:'Série, tome',recent:'Plus récents',prix:'Prix ↓',fin:'Fin de lecture ↓',note:'Note ↓',sortie:'Date de sortie'};

function grid() {
  const wl = view === 'wishlist'; if (CATS[view]) lastCat = view;
  const base = items.filter(i => wl ? i.wishlist : (!i.wishlist && i.category === view));
  const uniq = k => [...new Set(base.map(i => i[k]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
  const sel = (id, label, vals) => vals.length ? `<select id="${id}"><option value="">${label}</option>${vals.map(v => `<option>${esc(v)}</option>`).join('')}</select>` : '';
  $('#main').innerHTML = (wl ? backHdr('À acheter') : `<div class="cats">${Object.entries(CATS).map(([k, v]) => `<button type="button" data-cat="${k}" class="${view === k ? 'on' : ''}">${v}</button>`).join('')}</div>`) + `<div class="bar"><input id="q" type="search" placeholder="Rechercher…" value="${esc(q)}"><button type="button" id="lay" style="flex:none">${layout === 'grid' ? '☰ Liste' : '▦ Couvertures'}</button></div>
  <div class="bar">${!wl && READ.includes(view) ? `<select id="f"><option value="">Tous statuts</option>${Object.entries(STAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}<option value="_np">Non possédés</option></select>` : ''}${sel('fc', 'Collection', uniq('collection'))}${sel('fp', 'Éditeur', uniq('publisher'))}${sel('fs', 'Série', [...new Set(base.map(serName).filter(Boolean))].sort(ncmp))}
  <select id="so">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${sort === k ? 'selected' : ''}>${k === 'auteur' && MUSIC.includes(view) ? 'Artiste A→Z' : v}</option>`).join('')}</select></div>
  <div id="g" class="${layout === 'list' ? 'list' : 'grid'}"></div>`;
  bindBack(); document.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { view = b.dataset.cat; q = ''; sort = defSort(view); render(); });
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
      : `<div class="it ${MUSIC.includes(i.category) ? 'square' : ''}" data-id="${i.id}"><div class="cv${READ.includes(i.category) && !wl ? ' hasov' : ''}">${img(i, i.title) || esc(i.title)}${serBadge(i)}${wl ? '' : tag(i, true)}</div><div class="t">${i.favorite ? '♥ ' : ''}${esc(i.title)}</div><div class="s">${esc(i.authors.join(', '))}</div>${i.rating ? `<div class="s">${stars(i.rating)}</div>` : ''}${wl ? tag(i) : ''}</div>`).join('')
      || '<p class="s">Aucun résultat.</p>';
    document.querySelectorAll('.it').forEach(e => e.onclick = () => form(items.find(i => i.id === e.dataset.id)));
  };
  $('#q').oninput = e => { q = e.target.value; draw(); };
  ['f', 'fc', 'fp', 'fs'].forEach(id => { if ($('#' + id)) $('#' + id).onchange = draw; });
  $('#so').onchange = e => { sort = e.target.value; draw(); };
  $('#lay').onclick = () => { layout = layout === 'grid' ? 'list' : 'grid'; try { localStorage.setItem('layout', layout); } catch (e) {} render(); };
  draw();
}
