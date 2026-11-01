/**
 * @file components.js
 * Composants d'affichage partagés : étiquettes de statut, cartes, lignes, ruban de série, barre A-Z, en-tête de sous-page.
 * Dépend de : state.js, utils.js
 */

const backHdr = t => `<div class="sub-h"><button class="link" id="mback" type="button" aria-label="Retour">←</button><h2>${t}</h2></div>`;
const bindBack = () => { const b = $('#mback'); if (b) b.onclick = () => { view = 'settings'; moreSub = ''; render(); window.scrollTo(0, 0); }; };
const serBadge = i => i.series_id && seriesById.has(i.series_id) ? `<span class="ser" role="img" aria-label="Fait partie de la série ${esc(serName(i))}" title="Série : ${esc(serName(i))}"></span>` : '';
const cardHtml = i => `<div class="it ${MUSIC.includes(i.category) ? 'square' : ''}" data-id="${i.id}"><div class="cv${READ.includes(i.category) ? ' hasov' : ''}">${imgHtml(i, i.title) || esc(i.title)}${serBadge(i)}${tagHtml(i, true, false)}</div><div class="t">${i.favorite ? '♥ ' : ''}${esc(i.title)}</div><div class="s">${esc(i.authors.join(', '))}</div></div>`;
const rowHtml = i => `<div class="it" data-id="${i.id}"><div class="th">${imgHtml(i, '📖') || '📖'}</div><div style="flex:1;min-width:0"><div class="t">${i.favorite ? '♥ ' : ''}${esc(i.title)}</div><div class="s">${esc([CATS[i.category], i.authors.join(', '), serName(i)].filter(Boolean).join(' · '))}</div>${tagHtml(i, false, i.wishlist)}</div></div>`;
const stars = n => n ? `<span class="st" style="--p:${n * 20}%" title="${String(n).replace('.', ',')} / 5">★★★★★</span>` : '';
const starTxt = n => '★'.repeat(Math.floor(n)) + (n % 1 ? '½' : '');
const fd = d => d ? new Date(d + 'T00:00').toLocaleDateString('fr-FR') : '';
const imgHtml = (i, fb) => i.cover_url ? `<img loading="lazy" src="${esc(i.cover_url)}" alt="" data-fb="${esc(fb)}" onerror="this.replaceWith(document.createTextNode(this.dataset.fb))">` : '';
// Étiquette de lecture. Ligne 1 = statut du tome. Ligne 2 (si besoin) = issues lues + « non possédé » (le cas rare).
function tagHtml(i, ov, wl) {
  if (wl) return `<span class="tag">${CATS[i.category]}</span>${i.release_date ? ` <span class="tag">Sortie ${fd(i.release_date)}</span>` : ''}`;
  if (!READ.includes(i.category)) return '';
  const p = progress(i.id), own = i.owned ? '' : '<span class="np-l">non possédé</span><span class="np-s">non poss.</span>';
  const l2 = [p.total ? `${p.read}/${p.total} lues` : '', own].filter(Boolean).join(' · ');
  return `<span class="tag two ${ov ? 'ov ' : ''}${i.read_status}"><span class="l1">${STAT[i.read_status]}</span>${l2 ? `<span class="l2">${l2}</span>` : ''}</span>`;
}
const initial = n => { const c = String(n ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : '#'; };
const AZ = [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ', '#'];
const azBar = (cur, have) => `<div class="az" role="group" aria-label="Filtrer par lettre"><button type="button" data-az="" class="${cur ? '' : 'on'}">Tout</button>${AZ.map(l => `<button type="button" data-az="${l}" class="${cur === l ? 'on' : ''}" ${have.has(l) || cur === l ? '' : 'data-empty'} aria-label="Commençant par ${l}">${l}</button>`).join('')}</div>`;
const noSeriesMsg = (what, mig) => { $('#main').innerHTML = `<div class="box"><p class="s" style="margin:0">Pour ${what}, lance d'abord la mise à jour SQL <b>${mig}</b> dans Supabase.</p></div>`; };
