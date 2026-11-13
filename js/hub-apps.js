/**
 * @file hub-apps.js
 * Liste des applications affichées sur le hub : SEULE chose à modifier pour en ajouter une.
 *
 * Champs :
 *  - name, desc : textes de la tuile
 *  - color      : couleur du carré d'icône
 *  - icon       : clé de ICONS (plus bas)
 *  - href       : dossier de l'application (ex. 'bibliotheque/')
 *  - status     : 'active' (cliquable) | 'soon' (application prévue, pas encore ouverte) | 'wip' (tuile « À venir » grisée)
 *
 * Pour ouvrir une application : créer son dossier avec son index.html, puis passer son status à 'active' et renseigner href.
 * Dépend de : —
 */
const APPS = [
  { name: 'Bibliothèque', desc: 'Mes livres et mes lectures', color: '#D9480F', icon: 'book', href: 'bibliotheque/', status: 'active' },
  { name: 'Cartes', desc: 'Ma collection et sa valeur', color: '#2B59C3', icon: 'cards', href: '', status: 'soon' },
  { name: 'Sport', desc: 'Mes séances et mon suivi', color: '#178A5C', icon: 'dumbbell', href: '', status: 'soon' },
  { name: 'À venir', desc: 'Bientôt disponible', icon: 'clock', status: 'wip' },
  { name: 'À venir', desc: 'Bientôt disponible', icon: 'clock', status: 'wip' },
  { name: 'À venir', desc: 'Bientôt disponible', icon: 'clock', status: 'wip' }
];

// Icônes (tracé SVG 24×24, dessinées au trait).
const ICONS = {
  book: '<path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2z"/><path d="M12 6.5v13"/>',
  cards: '<rect x="3.5" y="5" width="11" height="15" rx="2"/><path d="M8 3.5h9.5a2 2 0 0 1 2 2V16"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6"/>',
  home: '<path d="M3.5 11 12 4l8.5 7M6 9.5V20h12V9.5"/>'
};
