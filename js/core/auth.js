/**
 * @file auth.js
 * Démarrage de la session et écran de connexion (e-mail + mot de passe).
 * Dépend de : state.js, data.js
 */

async function init() {
  const { data } = await sb.auth.getSession();
  session = data.session;
  sb.auth.onAuthStateChange((_e, s) => { const was = session; session = s; if (!!s !== !!was) init(); });
  if (!session) return loginView();
  await load();
}

function loginView() {
  $('#app').innerHTML = `<form class="login" id="lf"><h1>Ma bibliothèque</h1>
  <label>E-mail<input name="email" type="email" required autocomplete="username"></label>
  <label>Mot de passe<input name="password" type="password" required autocomplete="current-password"></label>
  <p><button class="primary" id="go">Se connecter</button></p><div class="msg" id="lm"></div></form>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault(); $('#lm').textContent = 'Connexion…';
    const f = e.target;
    const { error } = await sb.auth.signInWithPassword({ email: f.email.value.trim(), password: f.password.value });
    if (error) $('#lm').textContent = 'Erreur : ' + (error.message === 'Invalid login credentials' ? 'e-mail ou mot de passe incorrect.' : error.message);
  };
}
