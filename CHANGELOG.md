# Patchnote

> Généré par `node tools/changelog-md.js` depuis `js/changelog.js` : ne pas modifier à la main.

## v0.10.0 — Notes mises en forme, filtre sans issues (2026-11-08)

**Nouveautés**

- Accueil : le bloc « Sorties à venir » a une barre de mise en forme (gras, italique, souligné, barré, liste)
- Collection (comics) : filtre « Sans issues » dans les statuts

**Améliorations**

- Fiche : « Édition et résumé » et « Achat et lecture » sont repliables (l'état est mémorisé)
- Fiche : pas de champ Dessinateur(s) pour la catégorie Livres

## v0.9.1 — Ruban de série en couleur (2026-11-07)

**Améliorations**

- Collection : le ruban de série a une couleur propre à chaque série, pour les repérer d'un coup d'œil

## v0.9.0 — Fiche en blocs, séries en grille (2026-11-07)

**Nouveautés**

- Fiche : cinq blocs encadrés (infos, édition et résumé, issues, achat et lecture, couverture)
- Fiche : bloc « Couverture et recherche d'infos » repliable
- Issues déjà présentes ailleurs : pastille 🔗 sur la ligne, détail au toucher ou au survol

**Améliorations**

- Fiche : boutons Enregistrer / Annuler toujours visibles
- Séries : plusieurs séries par ligne (couvertures), tomes d'une série en grille
- PC : le Récapitulatif s'affiche dans le panneau de droite, comme les autres rubriques

**Retraits**

- Rubrique « À acheter » du menu Plus

## v0.8.0 — Plus sur PC (2026-11-01)

**Améliorations**

- PC : « Plus » en deux colonnes (menu à gauche, contenu de la rubrique à droite)
- PC : menu de navigation centré dans la barre du haut

## v0.7.0 — Finitions de la nouvelle interface (2026-11-01)

**Nouveautés**

- Page Patchnote dans « Plus » et fichier CHANGELOG.md
- Ruban en haut à droite des couvertures qui font partie d'une série
- Modification des éditeurs et des collections (le changement est répercuté sur les fiches)

**Améliorations**

- Couvertures : deux outils séparés (copier chez moi / chercher les manquantes) avec compteurs
- Création d'un éditeur ou d'une collection placée en haut de sa page
- PC : titre et menu sur la même ligne, plus d'espace sous la barre
- Icône réglages (⚙️) pour « Plus »
- Code réorganisé en dossiers (css, js, sql, docs) et documenté

**Corrections**

- Issues : les séries restent repliées quel que soit le filtre de lettre

## v0.6.0 — Nouvelle navigation et accueil (2026-11-01)

**Nouveautés**

- Accueil : recherche globale, « En cours de lecture » et bloc-notes « Sorties à venir » synchronisé
- Barre de navigation en bas (mobile) ou en haut (PC) : Accueil, Collection, Ajouter, Séries, Issues, Plus
- Catégorie Artbooks
- Menu « Plus » avec pages dédiées (récap, à acheter, éditeurs, collections, couvertures, stockage, import)

**Améliorations**

- Fiche : ISBN, boutons de recherche et couverture regroupés dans un bloc encadré

## v0.5.0 — Index A-Z et retouches d'affichage (2026-11-01)

**Nouveautés**

- Barre de lettres A-Z dans Issues et Séries

**Améliorations**

- Issues : une seule ligne par issue (numéros alignés), détail au toucher
- Récap : cartes harmonisées
- Bloc « Issues contenues » encadré dans la fiche
- Valeurs alignées dans les listes de Plus

**Corrections**

- Suppression du champ « Sommaire », remplacé par les issues

## v0.4.1 — Corrections de retour d'usage

**Nouveautés**

- Récap de l'espace de stockage restant
- Modification du numéro/titre d'une issue et renommage d'une série d'issues

**Améliorations**

- Étiquette « non possédé » seule (le cas rare)
- Séries terminées masquées dans la liste de la fiche
- Séries en cours : tomes manquants non affichés

## v0.4.0 — Séries et onglet Issues

**Nouveautés**

- Séries (en cours / terminée) avec ajout d'un tome prérempli
- Onglet Issues : suivi de toutes les issues
- Bouton « remonter en haut »

**Améliorations**

- Étiquette de lecture sur deux lignes : statut puis issues lues

## v0.3.1 — Recherche d'infos et statut sur couverture

**Nouveautés**

- Trois boutons : scanner, chercher, chercher ×10
- Date de lecture modifiable depuis le comics

**Améliorations**

- Statut de lecture affiché sur le bas de la couverture

## v0.3.0 — Couvertures chez toi et issues

**Nouveautés**

- Couvertures copiées dans ton propre stockage Supabase
- Copie et réparation en masse
- Comics VF/VO liés à des issues (lues / non lues, partagées entre comics)

**Améliorations**

- Statut du comics calculé à partir des issues

## v0.2.2 — Notes et confort

**Nouveautés**

- Notes par demi-étoiles

**Améliorations**

- Message clair en cas de doublon
- Nouvel essai automatique en cas d'erreur 503
- Réglages classés en rubriques, déconnexion dans les réglages
- Tri par artiste pour vinyles et CD

## v0.2.1 — Éditeurs et collections liés

**Améliorations**

- Collections dépendantes de l'éditeur
- Tri A→Z par défaut
- Boutons alignés
- JavaScript séparé du HTML, clés dans config.js
- Ping automatique pour empêcher la mise en pause de Supabase

## v0.2.0 — Réglages, filtres et import

**Nouveautés**

- Listes d'éditeurs et de collections
- Filtres et tris par catégorie
- Date de sortie (liste d'achats), note, résumé
- Thèmes (bleu nuit, vert, bordeaux, graphite)
- Deux affichages : couvertures ou liste
- Import Notion (CSV) et complétion des ISBN
- Recherche automatique de couvertures (Google Books, Open Library, MusicBrainz, TMDB)

## v0.1.0 — Première version

**Nouveautés**

- Connexion par e-mail et mot de passe
- Catégories : comics VF/VO, BD, livres, manga, vinyles, CD, DVD/Blu-ray
- Fiches avec couverture, prix, statut de lecture, possédé / à acheter
- Récap des dépenses
- Installable sur téléphone (PWA)

