/**
 * @file shell.js
 * Coquille de l'application : barre de navigation (bas sur mobile, haut sur PC) et aiguillage vers les vues.
 * Dépend de : components.js, toutes les vues
 */

const tabOf = v => v === 'home' ? 'home' : CATS[v] ? 'coll' : v === 'series' ? 'series' : v === 'issues' ? 'issues' : 'more';
const DOCK = [['home', '⌂', 'Accueil'], ['coll', '📚', 'Collection'], ['add', '＋', 'Ajouter'], ['series', '🧩', 'Séries'], ['issues', '📑', 'Issues'], ['more', '⚙️', 'Plus']];
function render() {
  const t = tabOf(view);
  const dock = DOCK.map(([k, ic, l]) => `<button type="button" data-tab="${k}" class="${k === t ? 'on' : ''}" ${k === t ? 'aria-current="page"' : ''}><span class="ic" aria-hidden="true">${ic}</span><span>${l}</span></button>`).join('');
  $('#app').innerHTML = `<div class="top"><header><h1>Ma bibliothèque</h1><a class="hubback" href="/">← Hub</a></header><nav class="dock" aria-label="Navigation principale">${dock}</nav></div><main id="main"></main>`;
  document.querySelectorAll('nav.dock button').forEach(b => b.onclick = () => {
    const k = b.dataset.tab; if (k === 'add') return form(null);
    view = k === 'home' ? 'home' : k === 'coll' ? lastCat : k === 'more' ? 'settings' : k;
    if (k === 'more') moreSub = '';
    q = ''; sort = defSort(view); curSeries = null; render(); window.scrollTo(0, 0); });
  view === 'home' ? home() : view === 'settings' ? settings() : view === 'series' ? seriesView() : view === 'issues' ? issuesView() : grid();
}
