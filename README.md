# Ma bibliothèque

Application web installable (PWA) pour suivre une collection : comics VF/VO, BD, livres, artbooks, manga, vinyles, CD, DVD/Blu-ray.
Aucune étape de compilation : ce sont des fichiers HTML/CSS/JS servis tels quels (Cloudflare), avec Supabase comme base de données.

## Arborescence

```
index.html            Page unique ; charge le CSS puis les scripts dans l'ordre
config.js             TES clés Supabase / Google Books / TMDB (ne jamais écraser)
import.html           Import d'un export CSV de Notion
manifest.webmanifest  Installation sur téléphone
icon.svg
css/
  styles.css          Tout le style (thèmes, composants, écran large en fin de fichier)
js/
  changelog.js        Historique des versions = source du patchnote
  core/               Socle : state.js (constantes, variables), utils.js, auth.js, data.js
  ui/                 components.js (cartes, étiquettes, A-Z), shell.js (navigation), back-to-top.js
  views/              Une vue = un fichier : home, collection, item-form, series, issues, recap, settings, patchnote
  services/           lookup.js (API infos/couvertures), covers.js, storage-usage.js, scanner.js
  main.js             Point d'entrée, TOUJOURS le dernier script
  import.js           Script de la page d'import
sql/                  Scripts Supabase (voir sql/README.md pour l'ordre)
docs/GUIDE.md         Guide pas à pas (GitHub, Cloudflare, Supabase)
tools/changelog-md.js Génère CHANGELOG.md
CHANGELOG.md          Patchnote lisible sur GitHub
```

## Principes de code

- **Scripts classiques, sans module** : tous les fichiers partagent la portée globale. L'ordre de chargement est celui de `index.html`.
- **Données en mémoire** : `load()` (js/core/data.js) lit tout depuis Supabase, indexe, puis appelle `render()`. Toute écriture se termine par `load()`.
- **Une vue = une fonction** qui remplit `#main` ; `render()` (js/ui/shell.js) choisit la vue d'après la variable `view`.
- **Sécurité** : chaque table est protégée par RLS (`user_id = auth.uid()`). Le texte venant de la base passe toujours par `esc()` avant d'être injecté dans le HTML.

## Ajouter une évolution

1. Modifier le fichier concerné (voir l'arborescence).
2. Ajouter une entrée **en tête** de `js/changelog.js` (nouvelle version, phrases courtes).
3. Lancer `node tools/changelog-md.js` pour mettre à jour `CHANGELOG.md`.
4. Si la base change : ajouter `sql/migration_vX.sql` et la décrire dans `sql/README.md`.

## Installation

Voir `docs/GUIDE.md`. Résumé : créer le projet Supabase, lancer les scripts SQL, renseigner `config.js`, publier le dépôt sur Cloudflare.
