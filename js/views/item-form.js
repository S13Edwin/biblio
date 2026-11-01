/**
 * @file item-form.js
 * Fiche d'un item (création/modification) : champs, issues contenues, séries, recherche d'infos, enregistrement.
 * Dépend de : components.js, covers.js, lookup.js, data.js
 */

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
  const cat = src?.category || (CATS[view] ? view : lastCat);
  const d = $('#dlg');
  d.innerHTML = `<form id="fm" method="dialog"><h2 style="margin:0">${it ? 'Modifier' : 'Ajouter'}</h2>
  <label>Catégorie<select name="category">${Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === cat ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
  <label id="lt">Titre<input name="title" required value="${esc(src?.title)}"></label>
  <label id="la">Auteur(s), séparés par des virgules<input name="authors" value="${esc(src?.authors?.join(', '))}"></label>
  <label class="r" id="li">Dessinateur(s)<input name="illustrators" value="${esc(src?.illustrators?.join(', '))}"></label>
  <div class="row rp"><label>Éditeur${optSel('publisher', src?.publisher)}</label><label>Collection${optSel('collection', src?.collection, src?.publisher)}</label></div>
  ${seriesReady ? `<div class="row r"><label>Série<select name="series_id"><option value="">—</option><option value="__new">➕ Nouvelle série…</option>${[...seriesList].filter(x => x.status !== 'terminee' || x.id === src?.series_id).sort((x, y) => ncmp(x.name, y.name)).map(x => `<option value="${x.id}" ${x.id === src?.series_id ? 'selected' : ''}>${esc(x.name)}${x.status === 'terminee' ? ' (terminée)' : ''}</option>`).join('')}</select></label>
    <label>Tome n°<input name="volume" inputmode="decimal" value="${src?.volume ?? ''}"></label></div>` : `<p class="s r">Pour les séries, lance d'abord <b>migration_v4.sql</b> dans Supabase.</p>`}
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
  <div class="blk"><div class="ihead"><b>Couverture et recherche d'infos</b></div>
  <label>ISBN / code-barres<input name="isbn" inputmode="numeric" value="${esc(it?.isbn)}"></label>
  <div class="row row3" style="margin-top:8px"><button type="button" id="scan">📷 Scanner</button><button type="button" id="look" title="Une seule requête">🔍 Chercher</button><button type="button" id="look10" title="Réessaie jusqu'à 10 fois si le service est indisponible">🔁 Chercher ×10</button></div>
  <div class="s" style="margin-top:4px">« Chercher » fait une seule requête. « ×10 » réessaie jusqu'à 10 fois si le service est indisponible.</div>
  <div class="msg" id="lk"></div><img id="pv" hidden alt="" style="height:90px;border-radius:4px;margin-top:8px">
  <label>Couverture (photo ou fichier, enregistrée chez toi)<input name="file" type="file" accept="image/*"></label>
  <label>…ou lien d'image (copié chez toi à l'enregistrement)<input name="cover_url" type="url" value="${esc(it?.cover_url)}"></label></div>
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
