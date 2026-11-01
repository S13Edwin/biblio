/**
 * @file covers.js
 * Couvertures : compression JPEG, envoi chez nous, copie en masse et recherche des manquantes.
 * Dépend de : lookup.js, storage-usage.js
 */

const COVER_PATH = '/storage/v1/object/public/covers/';
const isOurs = u => !!u && u.includes(COVER_PATH);
const needsCover = i => !i.cover_url || !isOurs(i.cover_url);
// Réduit l'image (600 px max, JPEG) : une photo de téléphone de 4 Mo devient ~50 Ko.
async function toJpeg(blob, maxW = 600, quality = .82) {
  const bmp = await createImageBitmap(blob), k = Math.min(1, maxW / bmp.width), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(bmp, 0, 0, w, h);
  return new Promise((ok, ko) => c.toBlob(b => b ? ok(b) : ko(new Error('Image illisible')), 'image/jpeg', quality));
}
async function putCover(blob) {
  const jpg = await toJpeg(blob), path = `${session.user.id}/${crypto.randomUUID()}.jpg`;
  const up = await sb.storage.from('covers').upload(path, jpg, { contentType: 'image/jpeg', cacheControl: '31536000' });
  if (up.error) throw up.error;
  return sb.storage.from('covers').getPublicUrl(path).data.publicUrl;
}
// Télécharge une image distante : en direct, sinon via le relais gratuit wsrv.nl (qui autorise le téléchargement depuis un navigateur).
async function fetchImg(url) {
  const get = async u => {
    const r = await fetch(u, { signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const b = await r.blob(); if (!/^image\//.test(b.type) || b.size < 500) throw new Error('Pas une image'); return b;
  };
  try { return await get(url); } catch (e) { return get('https://wsrv.nl/?url=' + encodeURIComponent(url) + '&w=800&output=jpg&q=85'); }
}
async function rehost(url) {
  if (!url || isOurs(url)) return url;
  try { return await putCover(await fetchImg(url)); } catch (e) { return null; }
}

let bulkStop = false, bulkBusy = false;
const deadCovers = new Set();                       // ids dont le lien d'origine est injoignable (retentés par la recherche)
const toCopy = () => items.filter(i => i.cover_url && !isOurs(i.cover_url));
const toFind = () => items.filter(i => !i.cover_url || deadCovers.has(i.id));
// mode 'copy' : rapatrie chez nous les images déjà liées. mode 'find' : cherche les couvertures absentes ou mortes (API), puis les rapatrie.
async function bulk(mode) {
  if (bulkBusy) return; bulkBusy = true;
  const todo = mode === 'copy' ? toCopy() : toFind(), set = t => { const e = $('#bk'); if (e) e.textContent = t; };
  let done = 0, miss = 0, streak = 0, lastErr = ''; bulkStop = false;
  const btns = () => document.querySelectorAll('#bkcopy, #bkfind').forEach(b => b.disabled = bulkBusy);
  btns();
  try {
    for (let n = 0; n < todo.length && !bulkStop; n++) {
      if (!$('#bk')) break;
      set(`${n}/${todo.length} traitées · ${done} réussies · ${miss} en échec`);
      const i = todo[n]; let u = null;
      if (mode === 'copy') {
        const mine = await rehost(i.cover_url); if (mine) u = { cover_url: mine }; else deadCovers.add(i.id);
      } else {
        let thrown = false; const r = await lookup(i, null, 3).catch(e => { lastErr = e.message; thrown = true; return null; });
        streak = thrown ? streak + 1 : 0;
        if (streak >= 5) { set('Arrêt après 5 erreurs de suite : ' + lastErr); return; }
        const mine = r?.cover ? await rehost(r.cover) : null;
        if (mine) { u = { cover_url: mine }; deadCovers.delete(i.id); if (!i.summary && r.summary) u.summary = r.summary; if (!i.isbn && r.isbn) u.isbn = r.isbn; if (!i.publisher && r.publisher) u.publisher = r.publisher; }
        await wait(MUSIC.includes(i.category) ? 1100 : 350);
      }
      if (u) { const e = await sb.from('items').update(u).eq('id', i.id); if (!e.error) { Object.assign(i, u); done++; } else miss++; } else miss++;
    }
    set(`${bulkStop ? 'Arrêté' : 'Terminé'} : ${done} réussie${done > 1 ? 's' : ''}, ${miss} en échec${mode === 'copy' && miss ? ' (liens injoignables : utilise « Chercher les couvertures manquantes »)' : miss ? ' (à compléter à la main ou via le scan)' : ''}.`);
  } finally { bulkBusy = false; btns(); }
}
