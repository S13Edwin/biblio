/**
 * @file issues.js
 * Vue Issues : lecture, dates, modification des numéros/titres, renommage de séries d'issues, filtre A-Z.
 * Dépend de : components.js, data.js
 */

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
    issForce = !!(issQ || issSt) && list.length <= 150;
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
