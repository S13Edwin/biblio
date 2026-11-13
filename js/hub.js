/**
 * @file hub.js
 * Page d'accueil du hub : connexion (même compte Supabase que les applications), grille de tuiles, menu du compte.
 * La session est partagée avec les applications : même site, même stockage du navigateur.
 * Dépend de : config.js, hub-apps.js
 */

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const svg = (k, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k] || ''}</svg>`;
let session = null;

async function init() {
  const { data } = await sb.auth.getSession();
  session = data.session;
  sb.auth.onAuthStateChange((_e, s) => { const was = session; session = s; if (!!s !== !!was) init(); });
  session ? hubView() : loginView();
}

function loginView() {
  $('#app').innerHTML = `<form class="login" id="lf"><h1>Hub</h1>
  <label>E-mail<input name="email" type="email" required autocomplete="username"></label>
  <label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label>
  <p><button class="primary" id="go">Se connecter</button></p><div class="msg" id="lm" role="status"></div></form>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); $('#lm').textContent = 'Connexion…';
    const f = e.target;
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    if (error) $('#lm').textContent = 'Erreur : ' + (error.message === 'Invalid login credentials' ? 'e-mail ou mot de passe incorrect.' : error.message);
  };
}

function tile(a) {
  const body = `<span class="sq" ${a.color ? `style="--c:${esc(a.color)}"` : ''}>${svg(a.icon, 64)}${a.status === 'soon' ? '<span class="badge">Bientôt</span>' : ''}</span>
    <span class="nm">${esc(a.name)}</span><span class="ds">${esc(a.desc)}</span>`;
  return a.status === 'active'
    ? `<a class="tile" href="${esc(a.href)}">${body}</a>`
    : `<div class="tile ${a.status}">${body}</div>`;
}

function hubView() {
  const apps = APPS.filter(a => a.status !== 'wip'), wip = APPS.filter(a => a.status === 'wip');
  $('#app').innerHTML = `
  <header class="hhead">
    <div class="brand"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><h1>Hub</h1></div>
    <button type="button" class="acct" data-acct aria-label="Mon compte">${svg('user', 22)}</button>
  </header>
  <main class="hmain">
    <p class="hello">Bonjour</p><p class="sub">Choisis une application</p>
    <h2 class="sec">Applications</h2>
    <div class="tiles">${apps.map(tile).join('')}</div>
    ${wip.length ? `<h2 class="sec">En travaux</h2><div class="tiles">${wip.map(tile).join('')}</div>` : ''}
  </main>
  <nav class="hnav" aria-label="Navigation principale">
    <a href="./" aria-current="page" class="on">${svg('home', 22)}Accueil</a>
    <button type="button" data-acct>${svg('user', 22)}Compte</button>
  </nav>`;
  document.querySelectorAll('[data-acct]').forEach(b => b.onclick = accountDialog);
}

function accountDialog() {
  const d = $('#dlg');
  d.innerHTML = `<h2>Mon compte</h2><p class="mail">${esc(session?.user?.email || '')}</p>
    <p class="row"><button type="button" id="out" class="primary">Se déconnecter</button><button type="button" id="close">Fermer</button></p>`;
  $('#close').onclick = () => d.close();
  $('#out').onclick = async () => { d.close(); await sb.auth.signOut(); };
  d.showModal();
}

init();
