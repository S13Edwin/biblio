/**
 * @file changelog.js
 * Historique des versions : SOURCE UNIQUE du patchnote.
 *  - affiché dans l'appli (Plus > Patchnote)
 *  - converti en CHANGELOG.md par `node tools/changelog-md.js`
 *
 * Numérotation (semver 0.x tant que l'appli est en construction) :
 *   0.MINEUR.CORRECTIF  → MINEUR : nouvelle fonction ou refonte ; CORRECTIF : retouches et corrections.
 *   La plus récente en premier. Passer à 1.0.0 quand l'appli sera jugée stable.
 * Correspondance avec les anciens noms : V1=0.1, V2=0.2, V3=0.3, V4=0.4, V5=0.5, V6=0.6.
 * Champs : new (nouveautés), better (améliorations), fix (corrections), removed (retraits) — phrases courtes.
 */
const CHANGELOG = [
  { v: '0.9.1', date: '2026-11-07', title: 'Ruban de série en couleur',
    better: ['Collection : le ruban de série a une couleur propre à chaque série, pour les repérer d\'un coup d\'œil'] },
  { v: '0.9.0', date: '2026-11-07', title: 'Fiche en blocs, séries en grille',
    new: ['Fiche : cinq blocs encadrés (infos, édition et résumé, issues, achat et lecture, couverture)', 'Fiche : bloc « Couverture et recherche d\'infos » repliable', 'Issues déjà présentes ailleurs : pastille 🔗 sur la ligne, détail au toucher ou au survol'],
    better: ['Fiche : boutons Enregistrer / Annuler toujours visibles', 'Séries : plusieurs séries par ligne (couvertures), tomes d\'une série en grille', 'PC : le Récapitulatif s\'affiche dans le panneau de droite, comme les autres rubriques'],
    removed: ['Rubrique « À acheter » du menu Plus'] },
  { v: '0.8.0', date: '2026-11-01', title: 'Plus sur PC',
    better: ['PC : « Plus » en deux colonnes (menu à gauche, contenu de la rubrique à droite)', 'PC : menu de navigation centré dans la barre du haut'] },
  { v: '0.7.0', date: '2026-11-01', title: 'Finitions de la nouvelle interface',
    new: ['Page Patchnote dans « Plus » et fichier CHANGELOG.md', 'Ruban en haut à droite des couvertures qui font partie d\'une série', 'Modification des éditeurs et des collections (le changement est répercuté sur les fiches)'],
    better: ['Couvertures : deux outils séparés (copier chez moi / chercher les manquantes) avec compteurs', 'Création d\'un éditeur ou d\'une collection placée en haut de sa page', 'PC : titre et menu sur la même ligne, plus d\'espace sous la barre', 'Icône réglages (⚙️) pour « Plus »', 'Code réorganisé en dossiers (css, js, sql, docs) et documenté'],
    fix: ['Issues : les séries restent repliées quel que soit le filtre de lettre'] },
  { v: '0.6.0', date: '2026-11-01', title: 'Nouvelle navigation et accueil',
    new: ['Accueil : recherche globale, « En cours de lecture » et bloc-notes « Sorties à venir » synchronisé', 'Barre de navigation en bas (mobile) ou en haut (PC) : Accueil, Collection, Ajouter, Séries, Issues, Plus', 'Catégorie Artbooks', 'Menu « Plus » avec pages dédiées (récap, à acheter, éditeurs, collections, couvertures, stockage, import)'],
    better: ['Fiche : ISBN, boutons de recherche et couverture regroupés dans un bloc encadré'] },
  { v: '0.5.0', date: '2026-11-01', title: 'Index A-Z et retouches d\'affichage',
    new: ['Barre de lettres A-Z dans Issues et Séries'],
    better: ['Issues : une seule ligne par issue (numéros alignés), détail au toucher', 'Récap : cartes harmonisées', 'Bloc « Issues contenues » encadré dans la fiche', 'Valeurs alignées dans les listes de Plus'],
    fix: ['Suppression du champ « Sommaire », remplacé par les issues'] },
  { v: '0.4.1', title: 'Corrections de retour d\'usage',
    new: ['Récap de l\'espace de stockage restant', 'Modification du numéro/titre d\'une issue et renommage d\'une série d\'issues'],
    better: ['Étiquette « non possédé » seule (le cas rare)', 'Séries terminées masquées dans la liste de la fiche', 'Séries en cours : tomes manquants non affichés'] },
  { v: '0.4.0', title: 'Séries et onglet Issues',
    new: ['Séries (en cours / terminée) avec ajout d\'un tome prérempli', 'Onglet Issues : suivi de toutes les issues', 'Bouton « remonter en haut »'],
    better: ['Étiquette de lecture sur deux lignes : statut puis issues lues'] },
  { v: '0.3.1', title: 'Recherche d\'infos et statut sur couverture',
    new: ['Trois boutons : scanner, chercher, chercher ×10', 'Date de lecture modifiable depuis le comics'],
    better: ['Statut de lecture affiché sur le bas de la couverture'] },
  { v: '0.3.0', title: 'Couvertures chez toi et issues',
    new: ['Couvertures copiées dans ton propre stockage Supabase', 'Copie et réparation en masse', 'Comics VF/VO liés à des issues (lues / non lues, partagées entre comics)'],
    better: ['Statut du comics calculé à partir des issues'] },
  { v: '0.2.2', title: 'Notes et confort',
    new: ['Notes par demi-étoiles'],
    better: ['Message clair en cas de doublon', 'Nouvel essai automatique en cas d\'erreur 503', 'Réglages classés en rubriques, déconnexion dans les réglages', 'Tri par artiste pour vinyles et CD'] },
  { v: '0.2.1', title: 'Éditeurs et collections liés',
    better: ['Collections dépendantes de l\'éditeur', 'Tri A→Z par défaut', 'Boutons alignés', 'JavaScript séparé du HTML, clés dans config.js', 'Ping automatique pour empêcher la mise en pause de Supabase'] },
  { v: '0.2.0', title: 'Réglages, filtres et import',
    new: ['Listes d\'éditeurs et de collections', 'Filtres et tris par catégorie', 'Date de sortie (liste d\'achats), note, résumé', 'Thèmes (bleu nuit, vert, bordeaux, graphite)', 'Deux affichages : couvertures ou liste', 'Import Notion (CSV) et complétion des ISBN', 'Recherche automatique de couvertures (Google Books, Open Library, MusicBrainz, TMDB)'] },
  { v: '0.1.0', title: 'Première version',
    new: ['Connexion par e-mail et mot de passe', 'Catégories : comics VF/VO, BD, livres, manga, vinyles, CD, DVD/Blu-ray', 'Fiches avec couverture, prix, statut de lecture, possédé / à acheter', 'Récap des dépenses', 'Installable sur téléphone (PWA)'] },
];
