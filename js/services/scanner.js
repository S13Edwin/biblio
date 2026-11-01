/**
 * @file scanner.js
 * Lecture de code-barres avec la caméra (BarcodeDetector).
 * Dépend de : —
 */

function scan() {
  return new Promise(async resolve => {
    const d = document.createElement('dialog');
    d.innerHTML = '<video playsinline muted style="width:100%;border-radius:8px"></video><p class="s">Place le code-barres devant la caméra.</p><button type="button">Annuler</button>';
    document.body.append(d); d.showModal();
    const v = d.querySelector('video'); let stop = false, stream, rd;
    const end = r => { stop = true; stream?.getTracks().forEach(t => t.stop()); try { rd?.reset(); } catch (e) {} d.close(); d.remove(); resolve(r); };
    d.querySelector('button').onclick = () => end(null);
    try {
      if ('BarcodeDetector' in window) {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); v.srcObject = stream; await v.play();
        const bd = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a'] });
        const tick = async () => { if (stop) return; try { const r = await bd.detect(v); if (r[0]) return end(r[0].rawValue); } catch (e) {} setTimeout(tick, 250); }; tick();
      } else {
        await new Promise((ok, ko) => { const sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'; sc.onload = ok; sc.onerror = ko; document.head.append(sc); });
        rd = new ZXing.BrowserMultiFormatReader(); rd.decodeFromVideoDevice(undefined, v, r => { if (r && !stop) end(r.getText()); });
      }
    } catch (e) { toast('Caméra indisponible : ' + e.message); end(null); }
  });
}
