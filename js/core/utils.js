/**
 * @file utils.js
 * Petites fonctions utilitaires : erreurs lisibles, toast, relance automatique, échappement HTML, formats, tri naturel.
 * Dépend de : state.js
 */

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

const push = (m, k, v) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); };
const ncmp = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'fr', { numeric: true });
const today = () => new Date().toLocaleDateString('sv-SE');
