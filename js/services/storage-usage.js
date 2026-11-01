/**
 * @file storage-usage.js
 * Calcul de l'espace utilisé par les couvertures dans Supabase Storage (quota gratuit de 1 Go).
 * Dépend de : state.js, utils.js
 */

const STORAGE_QUOTA = 1024 * 1024 * 1024;   // limite de l'offre gratuite Supabase : 1 Go de fichiers
let stInfo = null, stAt = 0;
async function storageUsage(force) {
  if (!force && stInfo && Date.now() - stAt < 60000) return stInfo;
  let bytes = 0, count = 0;
  for (let off = 0; ; off += 1000) {
    const r = await sb.storage.from('covers').list(session.user.id, { limit: 1000, offset: off });
    if (r.error) throw r.error;
    r.data.forEach(f => { if (f.metadata && f.metadata.size != null) { bytes += +f.metadata.size; count++; } });
    if (r.data.length < 1000) break;
  }
  stInfo = { bytes, count }; stAt = Date.now(); return stInfo;
}
const fmtSize = b => b >= 1000 * 1048576 ? (b / 1073741824).toFixed(2).replace('.', ',') + ' Go' : b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' Mo' : Math.max(1, Math.round(b / 1024)) + ' Ko';
async function showStorage(force) {
  const box = $('#stbody'); if (!box) return;
  try {
    const u = await storageUsage(force); if (!$('#stbody')) return;
    const pct = u.bytes / STORAGE_QUOTA * 100, left = Math.max(0, STORAGE_QUOTA - u.bytes), avg = u.count ? u.bytes / u.count : 50 * 1024, ext = items.filter(i => i.cover_url && !isOurs(i.cover_url)).length;
    const pTxt = pct < 0.1 ? '< 0,1' : pct.toFixed(1).replace('.', ',');
    if ($('#stsub')) $('#stsub').textContent = `${pTxt} % utilisé`;
    box.innerHTML = `<div class="meter" role="progressbar" aria-label="Espace utilisé" aria-valuenow="${pct.toFixed(1)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${Math.max(pct, 0.6)}%;${pct > 80 ? 'background:var(--warn)' : ''}"></span></div>
      <p style="margin:6px 0"><b>${fmtSize(u.bytes)}</b> utilisés sur ${fmtSize(STORAGE_QUOTA)} · <b>${fmtSize(left)}</b> restants</p>
      <p class="s" style="margin:0">${u.count} couverture${u.count > 1 ? 's' : ''} stockée${u.count > 1 ? 's' : ''}, environ ${fmtSize(avg)} en moyenne : place pour ${Math.floor(left / avg).toLocaleString('fr-FR')} de plus.${ext ? ` ${ext} couverture${ext > 1 ? 's sont encore hébergées' : ' est encore hébergée'} ailleurs (non comptée${ext > 1 ? 's' : ''}).` : ''}</p>`;
  } catch (e) { if ($('#stbody')) $('#stbody').textContent = 'Lecture du stockage impossible : ' + friendly(e); }
}
