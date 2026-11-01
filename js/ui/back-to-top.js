/**
 * @file back-to-top.js
 * Bouton « remonter en haut ».
 * Dépend de : —
 */

// Bouton « remonter en haut » : apparaît dès qu'on a défilé, en bas à droite au-dessus du bouton +.
(function () {
  const up = document.createElement('button'); up.id = 'up'; up.type = 'button'; up.className = 'fab fabup'; up.textContent = '↑'; up.hidden = true; up.setAttribute('aria-label', 'Remonter en haut de la page');
  up.onclick = () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  document.body.append(up);
  addEventListener('scroll', () => { up.hidden = window.scrollY < 500; }, { passive: true });
})();
