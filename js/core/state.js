/**
 * @file state.js
 * État global de l'application : client Supabase, catégories, constantes et variables partagées.
 * Dépend de : config.js (SUPABASE_URL, SUPABASE_KEY), supabase-js
 */

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const CATS = {comics_vf:'Comics VF',comics_vo:'Comics VO',bd:'BD',livre:'Livres',artbook:'Artbooks',manga:'Manga',vinyle:'Vinyles',cd:'CD',dvd:'DVD / Blu-ray'};
const READ = ['comics_vf','comics_vo','bd','livre','artbook','manga'], MUSIC = ['vinyle','cd'];
const STAT = {non_commence:'Pas commencé',en_cours:'En cours',termine:'Terminé'};
let items = [], options = [], view = 'home', lastCat = 'comics_vf', moreSub = '', q = '', sort = 'titre', session = null;
let issues = [], links = [], issuesReady = false, itemById = new Map(), issueById = new Map(), linksByItem = new Map(), linksByIssue = new Map();
const ISSUE_CATS = ['comics_vf', 'comics_vo'];
let seriesList = [], seriesReady = false, seriesById = new Map(), curSeries = null, serQ = '', serSt = '', serL = '', issL = '';
let issQ = '', issSt = '', openIss = new Set(), issDraw = null, issForce = false;
const serName = i => seriesById.get(i.series_id)?.name || '';
let layout = 'grid'; try { layout = localStorage.getItem('layout') || 'grid'; document.documentElement.dataset.t = localStorage.getItem('theme') || 'bleu'; } catch (e) {}
const $ = s => document.querySelector(s);
const defSort = v => v === 'wishlist' ? 'sortie' : MUSIC.includes(v) ? 'auteur' : 'titre';
