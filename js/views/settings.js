/**
 * @file settings.js
 * Page « Plus » (menu à gauche + contenu à droite sur PC) : éditeurs, collections (création/modification), apparence, couvertures, stockage, patchnote.
 * Dépend de : components.js, covers.js, patchnote.js, recap.js
 */

// Modifie un éditeur ou une collection ; répercute le changement sur les fiches qui l'utilisent.
function editOption(o) {
  if (!o) return; const pubs = options.filter(x => x.kind === 'publisher'), isCol = o.kind === 'collection', d = $('#dlg');
  d.innerHTML = `<form id="eo" method="dialog"><h2 style="margin:0">Modifier ${isCol ? 'la collection' : "l'éditeur"}</h2>
    <label>Nom<input name="name" required value="${esc(o.name)}"></label>
    ${isCol ? `<label>Éditeur<select name="parent"><option value="">—</option>${pubs.map(p => `<option ${p.name === o.parent ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>` : ''}
    <p class="s">Les fiches qui utilisent ${isCol ? 'cette collection' : 'cet éditeur'} sont mises à jour automatiquement.</p>
    <div class="acts"><span></span><span><button type="button" id="eocx">Annuler</button> <button class="primary" id="eosv">Enregistrer</button></span></div><div class="msg" id="eom"></div></form>`;
  $('#eocx').onclick = () => d.close();
  $('#eo').onsubmit = async e => {
    e.preventDefault(); const f = e.target, name = f.name.value.trim(), parent = isCol ? (f.parent.value || null) : null; if (!name) return;
    if (options.some(x => x.id !== o.id && x.kind === o.kind && x.name.toLowerCase() === name.toLowerCase() && (x.parent || null) === parent)) { $('#eom').textContent = '« ' + name + ' » existe déjà' + (parent ? ' pour ' + parent : '') + '.'; return; }
    $('#eosv').disabled = true;
    try {
      const r = await sb.from('options').update(isCol ? { name, parent } : { name }).eq('id', o.id); if (r.error) throw r.error;
      if (!isCol && name !== o.name) {
        let r2 = await sb.from('items').update({ publisher: name }).eq('publisher', o.name); if (r2.error) throw r2.error;
        r2 = await sb.from('options').update({ parent: name }).eq('kind', 'collection').eq('parent', o.name); if (r2.error) throw r2.error;
      }
      if (isCol && (name !== o.name || parent !== (o.parent || null))) {
        const patch = { collection: name }; if (parent !== (o.parent || null) && parent) patch.publisher = parent;
        let q = sb.from('items').update(patch).eq('collection', o.name); if (o.parent) q = q.eq('publisher', o.parent);
        const r2 = await q; if (r2.error) throw r2.error;
      }
      d.close(); toast('Modifié.'); load();
    } catch (err) { $('#eom').textContent = 'Erreur : ' + friendly(err); $('#eosv').disabled = false; }
  };
  d.showModal();
}

const APP_VERSION = typeof CHANGELOG !== 'undefined' && CHANGELOG[0] ? CHANGELOG[0].v : '';
function settings() {
  const chip = o => `<span class="chip">${esc(o.name)}<button class="link" data-edit="${o.id}" aria-label="Modifier ${esc(o.name)}" title="Modifier">✎</button><button class="link" data-del="${o.id}" data-name="${esc(o.name)}" aria-label="Supprimer ${esc(o.name)}">×</button></span>`;
  const pubs = options.filter(o => o.kind === 'publisher'), cols = options.filter(o => o.kind === 'collection');
  const addRow = (kind, extra) => `<div class="row" style="margin-top:10px;flex-wrap:wrap">${extra || ''}<input id="n_${kind}" placeholder="Nouvelle valeur"><button class="primary" data-add="${kind}" style="flex:none">Ajouter</button></div>`;
  const groups = {}; cols.forEach(o => (groups[o.parent || ''] = groups[o.parent || ''] || []).push(o));
  const colAdd = addRow('collection', `<select id="np_collection"><option value="">Éditeur…</option>${pubs.map(o => `<option>${esc(o.name)}</option>`).join('')}</select>`);
  const colBody = colAdd + (Object.keys(groups).sort((a, b) => (a || '￿').localeCompare(b || '￿', 'fr')).map(p => `<div class="s" style="margin:8px 0 4px">${p ? esc(p) : 'Sans éditeur'}</div>${groups[p].map(chip).join('')}`).join('') || '<span class="s">Aucune valeur pour le moment.</span>')
  ;
  const TH = { bleu: 'Bleu nuit', vert: 'Vert', bordeaux: 'Bordeaux', graphite: 'Graphite' }, cur = document.documentElement.dataset.t || 'bleu';
  const nocov = items.filter(needsCover).length;
  const S = {
    recap: ['Récapitulatif', '📊', '', recapHtml(), true],
    theme: ['Apparence', '🎨', TH[cur], Object.entries(TH).map(([k, v]) => `<button data-th="${k}" class="${k === cur ? 'on' : ''}">${v}</button>`).join(' ')],
    publisher: ['Éditeurs', '🏢', pubs.length, addRow('publisher') + (pubs.map(chip).join('') || '<span class="s">Aucune valeur pour le moment.</span>')],
    collection: ['Collections', '🗂', cols.length, colBody],
    covers: ['Couvertures et infos', '🖼', `${nocov} à traiter`, `<p class="s" style="margin:0 0 12px">Deux outils indépendants, qui peuvent durer plusieurs minutes : garde cette page ouverte.</p>
      <div class="tool"><b>Copier les couvertures chez moi</b><p class="s">Rapatrie dans ta base les images encore hébergées ailleurs (liens externes, import Notion). <b>${toCopy().length}</b> à copier.</p><button class="primary" id="bkcopy" type="button">Lancer la copie</button></div>
      <div class="tool"><b>Chercher les couvertures manquantes</b><p class="s">Interroge Google Books, Open Library, MusicBrainz ou TMDB pour les fiches sans image ou au lien mort, puis enregistre l'image chez toi. <b>${toFind().length}</b> fiche${toFind().length > 1 ? 's' : ''} sans couverture.</p><button class="primary" id="bkfind" type="button">Lancer la recherche</button></div>
      <p><button id="bkstop" type="button">⏹ Arrêter</button></p><p class="s" id="bk" aria-live="polite"></p>`],
    patch: ['Patchnote', '📝', 'v' + APP_VERSION, patchHtml()],
    storage: ['Stockage des couvertures', '💾', '', `<div id="stbody" class="s">Calcul en cours…</div><p style="margin:10px 0 0"><button type="button" id="strf">Actualiser</button></p>`] };
  // PC (≥ 900 px) : menu à gauche, contenu de la rubrique à droite. Téléphone : liste, puis page dédiée.
  const wide = matchMedia('(min-width:900px)').matches;
  const row = (id, ic, t, sub) => `<button type="button" class="mrow ${wide && id === moreSub ? 'on' : ''}" data-sub="${id}" ${wide && id === moreSub ? 'aria-current="true"' : ''}><span class="mi" aria-hidden="true">${ic}</span><span class="mt">${t}</span><span class="s">${sub}</span><span class="chev" aria-hidden="true">›</span></button>`;
  const sr = id => row(id, S[id][1], S[id][0], S[id][2]);
  const menu = `<div class="mgrp">Affichage</div><div class="mlist">${sr('theme')}</div>
      <div class="mgrp">Ma bibliothèque</div><div class="mlist">${sr('recap')}${sr('publisher')}${sr('collection')}</div>
      <div class="mgrp">Outils</div><div class="mlist">${sr('covers')}${sr('storage')}<a class="mrow" href="import.html"><span class="mi" aria-hidden="true">📥</span><span class="mt">Importer depuis Notion</span><span class="s"></span><span class="chev" aria-hidden="true">›</span></a></div>
      <div class="mgrp">À propos</div><div class="mlist">${sr('patch')}</div>
      <div class="mgrp">Compte</div><div class="mlist"><div class="mrow"><span class="mi" aria-hidden="true">👤</span><span class="mt">Connecté</span><span class="s">${esc(session?.user?.email || '')}</span></div></div>
      <button class="primary logout" id="out" type="button">Se déconnecter</button><p class="s" style="text-align:center;margin-top:14px">Version ${APP_VERSION}</p>`;
  if (wide) {
    if (!S[moreSub]) moreSub = 'theme';
    $('#main').innerHTML = `<div class="plus2"><aside class="side">${menu}</aside><section class="panel"><h2>${S[moreSub][0]}</h2>${S[moreSub][4] ? S[moreSub][3] : `<div class="box">${S[moreSub][3]}</div>`}</section></div>`;
  } else if (moreSub && S[moreSub]) {
    $('#main').innerHTML = `<div class="more">${backHdr(S[moreSub][0])}${S[moreSub][4] ? S[moreSub][3] : `<div class="box">${S[moreSub][3]}</div>`}</div>`; bindBack();
    $('#mback').onclick = () => { moreSub = ''; settings(); window.scrollTo(0, 0); };
  } else {
    moreSub = '';
    $('#main').innerHTML = `<div class="more"><h2 style="margin:0 0 4px;font-size:1.3rem">Plus</h2>${menu}</div>`;
  }
  document.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { moreSub = b.dataset.sub; settings(); if (!wide) window.scrollTo(0, 0); });
  document.querySelectorAll('[data-add]').forEach(b => {
    const input = $('#n_' + b.dataset.add); input.onkeydown = e => { if (e.key === 'Enter') b.click(); };
    b.onclick = async () => {
      const kind = b.dataset.add, n = input.value.trim(); if (!n) return;
      const par = kind === 'collection' ? ($('#np_collection').value || null) : null;
      if (options.some(o => o.kind === kind && o.name.toLowerCase() === n.toLowerCase() && (o.parent || null) === par)) return toast('« ' + n + ' » existe déjà' + (par ? ' pour ' + par : '') + '.');
      const r = await sb.from('options').insert({ kind, name: n, parent: par }); if (r.error) return toast(friendly(r.error));
      toast('« ' + n + ' » ajouté.'); load(); }; });
  if ($('#strf')) { $('#strf').onclick = () => { $('#stbody').textContent = 'Calcul en cours…'; showStorage(true); }; showStorage(); }
  if ($('#bkcopy')) { $('#bkcopy').onclick = () => bulk('copy'); $('#bkfind').onclick = () => bulk('find'); $('#bkstop').onclick = () => { bulkStop = true; }; }
  if ($('#out')) $('#out').onclick = () => sb.auth.signOut();
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editOption(options.find(o => o.id === b.dataset.edit)));
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Retirer « ' + b.dataset.name + ' » de la liste ? Les fiches déjà enregistrées gardent leur valeur.')) return;
    const r = await sb.from('options').delete().eq('id', b.dataset.del); if (r.error) return toast(friendly(r.error)); load(); });
  document.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { try { localStorage.setItem('theme', b.dataset.th); } catch (e) {} document.documentElement.dataset.t = b.dataset.th; settings(); });
}

// Si la fenêtre passe de téléphone à PC (ou l'inverse) pendant qu'on est dans Plus, on redessine.
matchMedia('(min-width:900px)').addEventListener('change', () => { if (view === 'settings') settings(); });
