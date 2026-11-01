/**
 * @file home.js
 * Vue Accueil : recherche globale, « En cours de lecture » et bloc-notes « Sorties à venir ».
 * Dépend de : components.js, data.js
 */

// ───── accueil : lecture en cours + bloc-notes « sorties à venir » ─────
const NOTE_KEY = 'upcoming';
let noteLoaded = false, noteVal = '', noteDb = true, noteTimer = null;
async function noteLoad() {
  let local = ''; try { local = localStorage.getItem('note_' + NOTE_KEY) || ''; } catch (e) {}
  const r = await sb.from('notes').select('body').eq('key', NOTE_KEY).maybeSingle();
  if (r.error) { noteDb = false; noteVal = local; } else { noteDb = true; noteVal = r.data ? r.data.body : local; }
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
      <div class="grid">${cur.map(cardHtml).join('') || ''}</div>${cur.length ? '' : '<p class="s">Rien en cours pour le moment. Passe un tome en « En cours » depuis sa fiche, ou coche une issue lue.</p>'}</section>
    <section class="hnote"><div class="h2">Sorties à venir <span id="nst"></span></div>
      <textarea id="note" placeholder="Titre — Éditeur — Prix — Date&#10;Un par ligne, ou par éditeur…" aria-label="Sorties à venir"></textarea></section>
  </div>`;
  const ta = $('#note'), openIt = e => { const c = e.target.closest('.it'); if (c) form(items.find(i => i.id === c.dataset.id)); };
  ta.value = noteVal; if (!noteLoaded) noteLoad().then(() => { if (view === 'home' && $('#note') && !$('#note').dataset.dirty) $('#note').value = noteVal; });
  ta.oninput = () => { ta.dataset.dirty = '1'; noteVal = ta.value; try { localStorage.setItem('note_' + NOTE_KEY, noteVal); } catch (e) {} $('#nst').textContent = '…'; clearTimeout(noteTimer); noteTimer = setTimeout(noteSave, 900); };
  ta.onblur = () => { if (noteTimer) noteSave(); };
  $('#hhome').onclick = openIt; $('#hres').onclick = openIt;
  $('#hq').oninput = e => {
    const s = e.target.value.trim().toLowerCase(), box = $('#hres');
    if (s.length < 2) { box.hidden = true; $('#hhome').hidden = false; return; }
    const rows = items.filter(i => [i.title, serName(i), i.collection, i.publisher, ...i.authors, ...i.illustrators].join(' ').toLowerCase().includes(s)).sort((a, b) => ncmp(a.title, b.title));
    box.innerHTML = `<p class="s">${rows.length} résultat${rows.length > 1 ? 's' : ''}${rows.length > 40 ? ' (40 premiers)' : ''}</p>` + rows.slice(0, 40).map(rowHtml).join(''); box.hidden = false; $('#hhome').hidden = true; };
}
