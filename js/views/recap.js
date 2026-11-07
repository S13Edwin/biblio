/**
 * @file recap.js
 * Récapitulatif : dépenses, lectures, issues lues. Affiché dans « Plus » (panneau de droite sur PC, sous-page sur téléphone).
 * Dépend de : components.js
 */

/** Retourne le HTML du récapitulatif (injecté par settings.js). */
function recapHtml() {
  const have = items.filter(i => !i.wishlist && i.owned), wish = items.filter(i => i.wishlist);
  const spent = have.reduce((s, i) => s + (+i.price || 0), 0);
  const done = items.filter(i => !i.wishlist && READ.includes(i.category) && i.read_status === 'termine');
  const byYear = {}; done.forEach(i => { const y = i.finished_on?.slice(0, 4) || 'Sans date'; byYear[y] = (byYear[y] || 0) + 1; });
  const rows = Object.entries(CATS).map(([k, v]) => {
    const h = have.filter(i => i.category === k), r = READ.includes(k) ? items.filter(i => !i.wishlist && i.category === k && i.read_status === 'termine').length : null;
    return `<tr><td>${v}</td><td>${h.length}${r !== null ? ` · ${r} lus` : ''}</td><td>${eur(h.reduce((s, i) => s + (+i.price || 0), 0))}</td></tr>`; }).join('');
  const kp = (big, lab, sub) => `<div class="box kpi"><div class="big">${big}</div><div class="lab">${lab}</div><div class="s">${sub || '&nbsp;'}</div></div>`;
  const multi = [...linksByIssue.values()].filter(v => v.length > 1).length, nwo = done.filter(i => !i.owned).length;
  return `<div class="kpis" style="--n:${issues.length ? 5 : 4}">
  ${kp(eur(spent), 'dépensés', 'sur ' + have.length + ' objets')}
  ${kp(have.length, 'objets chez moi', '')}
  ${kp(done.length, 'lectures terminées', nwo ? 'dont ' + nwo + ' non possédées' : '')}
  ${kp(eur(wish.reduce((s, i) => s + (+i.price || 0), 0)), 'à acheter', wish.length + ' objet' + (wish.length > 1 ? 's' : ''))}
  ${issues.length ? kp(issues.filter(x => x.read).length + '/' + issues.length, 'issues lues', multi ? multi + ' dans plusieurs comics' : '') : ''}</div>
  <div class="stats2"><div class="box"><table><tr><th>Catégorie</th><th>Possédés</th><th>Dépensé</th></tr>${rows}</table></div>
  <div class="box"><table><tr><th>Lectures terminées par année</th><th></th></tr>${Object.entries(byYear).sort().reverse().map(([y, n]) => `<tr><td>${y}</td><td>${n}</td></tr>`).join('') || '<tr><td colspan=2 class="s">Aucune lecture terminée.</td></tr>'}</table></div></div>`;
}
