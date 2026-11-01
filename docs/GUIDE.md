# Mise en ligne de « Ma bibliothèque » : guide clic par clic

Durée : environ 20 minutes. Les libellés des sites peuvent légèrement changer, mais la logique reste la même.

## Étape 1 : créer la base de données (Supabase)

1. Va sur **supabase.com** > **Start your project** > connecte-toi (compte GitHub ou e-mail).
2. **New project** : nom `biblio`, choisis un mot de passe de base de données (garde-le), région **West EU (Paris)** si disponible (sinon Ireland), plan **Free**. Clique **Create new project** et attends 1 à 2 minutes.
3. Menu de gauche : **SQL Editor** > **New query**. Ouvre `schema.sql`, copie tout son contenu, colle-le, clique **Run**. Tu dois voir « Success ».
4. Menu de gauche : **Authentication** > **Users** > **Add user** > **Create new user**. Saisis ton e-mail et un mot de passe, coche **Auto Confirm User**, valide.
5. Toujours dans **Authentication**, ouvre les réglages de connexion (**Sign In / Providers**, parfois sous **Configuration**) et **désactive « Allow new users to sign up »**. Ainsi, toi seul peux te connecter.

## Étape 2 : récupérer tes deux clés

1. **Project Settings** (roue crantée) > **API Keys** (ou **API**).
2. Note le **Project URL** (`https://xxxx.supabase.co`) et la clé **anon / publique** (ou « publishable »). Cette clé est faite pour être visible dans le site : la sécurité repose sur les règles de la base (déjà dans `schema.sql`). **Ne copie jamais la clé `service_role`.**
3. Ouvre `config.js` dans un éditeur de texte (Bloc-notes suffit), remplace `COLLE_ICI_TON_PROJECT_URL` et `COLLE_ICI_TA_CLE_ANON_PUBLIQUE`, enregistre. Ce fichier ne se remplit qu'une fois : ne le remplace plus ensuite.

## Étape 3 : rien à faire

La connexion se fait par e-mail et mot de passe : aucune adresse à déclarer dans Supabase.

## Étape 4 : mettre le site en ligne (Cloudflare Pages)

1. Va sur **dash.cloudflare.com**, crée un compte gratuit.
2. Menu **Workers & Pages** > **Create** > onglet **Pages** > **Upload your static files** (ou « Direct Upload »).
3. Nom du projet : `ma-biblio` (ton adresse sera `ma-biblio.pages.dev`).
4. Glisse-dépose **le dossier `biblio` complet** (avec `index.html`, `manifest.webmanifest`, `icon.svg`) > **Deploy**.
5. Pour mettre à jour le site plus tard : **Create new deployment** et redépose le dossier.

## Étape 5 : première connexion et installation sur téléphone

1. Ouvre ton adresse et connecte-toi avec l'e-mail et le mot de passe créés à l'étape 1. Accepte que le navigateur ou le téléphone enregistre le mot de passe : la connexion devient ensuite un simple tap. Tu restes connecté tant que tu ne cliques pas sur **Déconnexion**, et tu peux l'être sur plusieurs appareils en même temps.
2. **Android (Chrome)** : menu ⋮ > **Installer l'application** (ou « Ajouter à l'écran d'accueil »).
3. **iPhone (Safari)** : bouton Partager > **Sur l'écran d'accueil**.
4. Bonus : ajoute un premier item avec le bouton **+**. La photo de couverture peut être prise directement avec l'appareil photo.

## Étape 6 (conseillée) : éviter la mise en pause de Supabase

Supabase met en pause un projet gratuit après 7 jours sans activité. Pour l'éviter :
1. Crée un compte **github.com** et un dépôt privé `biblio-keepalive`.
2. **Add file** > **Create new file**, nom : `.github/workflows/ping.yml`, contenu :

```yaml
name: ping
on:
  schedule: [{cron: "0 6 * * *"}]
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Supabase
        run: |
          curl -sSf "$URL/rest/v1/items?select=id&limit=1" -H "apikey: $KEY"
        env:
          URL: ${{ secrets.SUPABASE_URL }}
          KEY: ${{ secrets.SUPABASE_KEY }}
```
3. **Settings** > **Secrets and variables** > **Actions** > **New repository secret** : crée `SUPABASE_URL` et `SUPABASE_KEY` (la clé anon).

## Sauvegarde

Supabase > **Table Editor** > table `items` > **Export** > CSV, de temps en temps.
