/**
 * @file patchnote.js
 * Affichage du patchnote (données dans js/changelog.js).
 * Dépend de : changelog.js
 */

const CH_LABEL = { new: 'Nouveautés', better: 'Améliorations', fix: 'Corrections' };
const patchHtml = () => (typeof CHANGELOG === 'undefined' ? [] : CHANGELOG).map(r => `<section class="rel"><h3>v${esc(r.v)}<span class="s"> · ${esc(r.title)}${r.date ? ' · ' + fd(r.date) : ''}</span></h3>${Object.keys(CH_LABEL).filter(k => r[k]?.length).map(k => `<div class="s rl">${CH_LABEL[k]}</div><ul>${r[k].map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}</section>`).join('');
