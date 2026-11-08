/**
 * @file home.js
 * Vue Accueil : recherche globale, « En cours de lecture » et bloc-notes « Sorties à venir ».
 * Dépend de : components.js, data.js
 */

// ───── accueil : lecture en cours + bloc-notes « sorties à venir » ─────
const NOTE_KEY = 'upcoming';
const NOTE_OK = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'UL', 'OL', 'LI', 'BR', 'DIV', 'P']);
/** Nettoie le HTML de la note (liste blanche de balises, aucun attribut). Texte brut ancien → HTML. */
function cleanNote(html) {
  if (!/<[a-z][\s\S]*>/i.test(html)) return esc(html).replace(/\n/g, '<br>');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const walk = n => [...n.childNodes].forEach(c => {
    if (c.nodeType === 3) return; if (c.nodeType !== 1 || c.tagName === 'SCRIPT' || c.tagName === 'STYLE') { c.remove(); return; }
    walk(c); if (NOTE_OK.has(c.tagName)) [...c.attributes].forEach(a => c.removeAttribute(a.name)); else c.replaceWith(...c.childNodes); });
  walk(doc.body); return doc.body.innerHTML;
}
let noteLoaded = false, noteVal = '', noteDb = true, noteTimer = null;
async function noteLoad() {
  let local = ''; try { local = localStorage.getItem('note_' + NOTE_KEY) || ''; } catch (e) {}
  const r = await sb.from('notes').select('body').eq('key', NOTE_KEY).maybeSingle();
  if (r.error) { noteDb = false; noteVal = cleanNote(local); } else { noteDb = true; noteVal = cleanNote(r.data ? r.data.body : local); }
  noteLoaded = true;
}
async function noteSave() {
  clearTimeout(noteTimer); noteTimer = null;
  const st = $('#nst'); if (!noteDb) { if (st) st.textContent = 'Enregistré sur cet appareil (SQL v6 à lancer pour synchroniser)'; return; }
  const r = await sb.from('notes').upsert({ user_id: session.user.id, key: NOTE_KEY, body: noteVal, updated_at: new Date().toISOString() }, { onConflict: 'user_id,key' });
  const st2 = $('#nst'); if (r.error) { noteDb = false; if (st2) st2.textContent = 'Enregistré sur cet appareil (SQL v6 à lancer pour synchroniser)'; } else if (st2) st2.textContent = '✓ Enregistré';
}
function home() {
  const cur = items.filter(i => !i.wishlist && READ.includes(i.category) && i.read_status === 'en_cours').sort((a, b) => ncmp(a.title, b.title));
  const dt0 = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }), dt = dt0.charAt(0).toUpperCase() + dt0.slice(1);
  $('#main').innerHTML = `<p class="s" style="margin:-6px 0 10px">${dt}</p>
  <input id="hq" type="search" placeholder="Chercher dans toute ma bibliothèque…" aria-label="Recherche globale" autocomplete="off">
  <div id="hres" class="list" hidden></div>
  <div class="homegrid" id="hhome">
    <section><div class="h2">En cours de lecture <span>${cur.length}</span></div>
      <div class="grid">${cur.map(i => cardHtml(i)).join('') || ''}</div>${cur.length ? '' : '<p class="s">Rien en cours pour le moment. Passe un tome en « En cours » depuis sa fiche, ou coche une issue lue.</p>'}</section>
    <section class="hnote"><div class="h2">Sorties à venir <span id="nst"></span></div>
      <div class="rt" role="toolbar" aria-label="Mise en forme"><button type="button" data-cmd="bold" title="Gras (Ctrl+B)" aria-label="Gras"><b>G</b></button><button type="button" data-cmd="italic" title="Italique (Ctrl+I)" aria-label="Italique"><i>I</i></button><button type="button" data-cmd="underline" title="Souligné (Ctrl+U)" aria-label="Souligné"><u>S</u></button><button type="button" data-cmd="strikeThrough" title="Barré" aria-label="Barré"><s>B</s></button><button type="button" data-cmd="insertUnorderedList" title="Liste à puces" aria-label="Liste à puces">• Liste</button><button type="button" data-cmd="removeFormat" title="Effacer la mise en forme" aria-label="Effacer la mise en forme">⌫</button></div>
      <div id="note" class="rte" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Sorties à venir" data-ph="Titre — Éditeur — Prix — Date&#10;Un par ligne, ou par éditeur…"></div></section>
  </div>`;
  const ta = $('#note'), openIt = e => { const c = e.target.closest('.it'); if (c) form(items.find(i => i.id === c.dataset.id)); };
  ta.innerHTML = noteVal; if (!noteLoaded) noteLoad().then(() => { if (view === 'home' && $('#note') && !$('#note').dataset.dirty) $('#note').innerHTML = noteVal; });
  ta.oninput = () => { ta.dataset.dirty = '1'; if (!ta.textContent.trim() && !ta.querySelector('li')) ta.innerHTML = '';
    noteVal = cleanNote(ta.innerHTML); try { localStorage.setItem('note_' + NOTE_KEY, noteVal); } catch (e) {} $('#nst').textContent = '…'; clearTimeout(noteTimer); noteTimer = setTimeout(noteSave, 900); };
  ta.onpaste = e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); };   // collage en texte brut
  const tb = document.querySelector('.rt');
  tb.onmousedown = e => e.preventDefault();   // garde la sélection du texte quand on clique un bouton
  tb.onclick = e => { const b = e.target.closest('[data-cmd]'); if (!b) return; ta.focus(); document.execCommand(b.dataset.cmd); ta.oninput(); };
  ta.onblur = () => { if (noteTimer) noteSave(); };
  $('#hhome').onclick = openIt; $('#hres').onclick = openIt;
  $('#hq').oninput = e => {
    const s = e.target.value.trim().toLowerCase(), box = $('#hres');
    if (s.length < 2) { box.hidden = true; $('#hhome').hidden = false; return; }
    const rows = items.filter(i => [i.title, serName(i), i.collection, i.publisher, ...i.authors, ...i.illustrators].join(' ').toLowerCase().includes(s)).sort((a, b) => ncmp(a.title, b.title));
    box.innerHTML = `<p class="s">${rows.length} résultat${rows.length > 1 ? 's' : ''}${rows.length > 40 ? ' (40 premiers)' : ''}</p>` + rows.slice(0, 40).map(rowHtml).join(''); box.hidden = false; $('#hhome').hidden = true; };
}
