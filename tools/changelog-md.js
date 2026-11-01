// Génère CHANGELOG.md à partir de js/changelog.js.   Usage :  node tools/changelog-md.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const CHANGELOG = vm.runInNewContext(fs.readFileSync(path.join(root, 'js/changelog.js'), 'utf8') + ';CHANGELOG');
const L = { new: 'Nouveautés', better: 'Améliorations', fix: 'Corrections' };
let md = '# Patchnote\n\n> Généré par `node tools/changelog-md.js` depuis `js/changelog.js` : ne pas modifier à la main.\n\n';
for (const r of CHANGELOG) {
  md += `## v${r.v} — ${r.title}${r.date ? ' (' + r.date + ')' : ''}\n\n`;
  for (const k of Object.keys(L)) if (r[k] && r[k].length) md += `**${L[k]}**\n\n${r[k].map(x => '- ' + x).join('\n')}\n\n`;
}
fs.writeFileSync(path.join(root, 'CHANGELOG.md'), md);
console.log('CHANGELOG.md écrit (' + CHANGELOG.length + ' versions)');
