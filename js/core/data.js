/**
 * @file data.js
 * Chargement des données Supabase (items, issues, séries, options), index en mémoire, statut dérivé des issues.
 * Dépend de : state.js, utils.js
 */

// Supabase renvoie 1000 lignes maximum par requête : on lit par tranches.
async function fetchAll(table, orders) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select('*'); orders.forEach(([c, asc]) => q = q.order(c, { ascending: asc }));
    const r = await q.range(from, from + 999);
    if (r.error) return { data: out, error: r.error };
    out.push(...r.data); if (r.data.length < 1000) break;
  }
  return { data: out };
}
function indexIssues() {
  itemById = new Map(items.map(i => [i.id, i])); issueById = new Map(issues.map(i => [i.id, i])); linksByItem = new Map(); linksByIssue = new Map();
  links.forEach(l => { push(linksByItem, l.item_id, l.issue_id); push(linksByIssue, l.issue_id, l.item_id); });
}
const itemIssues = id => (linksByItem.get(id) || []).map(x => issueById.get(x)).filter(Boolean).sort((a, b) => ncmp(a.series, b.series) || ncmp(a.number, b.number));
const progress = id => { const L = (linksByItem.get(id) || []).map(x => issueById.get(x)).filter(Boolean); return { total: L.length, read: L.filter(x => x.read).length }; };
function derive(L, existing) {
  const n = L.filter(x => x.read).length;
  return { status: n === 0 ? 'non_commence' : n === L.length ? 'termine' : 'en_cours', last: L.map(x => x.read_on).filter(Boolean).sort().pop() || existing || today() };
}

async function load() {
  const [a, o, iss, lk, se] = await Promise.all([fetchAll('items', [['created_at', false], ['id', true]]), sb.from('options').select('*').order('name'),
    fetchAll('issues', [['series', true], ['id', true]]), fetchAll('item_issues', [['item_id', true], ['issue_id', true]]), sb.from('series').select('*').order('name')]);
  if (a.error) toast('Chargement impossible : ' + friendly(a.error));
  items = a.data; options = o.data || [];
  issuesReady = !iss.error && !lk.error; issues = issuesReady ? iss.data : []; links = issuesReady ? lk.data : [];
  seriesReady = !se.error; seriesList = seriesReady ? se.data : []; seriesById = new Map(seriesList.map(x => [x.id, x]));
  indexIssues();
  render();
}
// Recalcule le statut des comics qui ont des issues (tout lu = Terminé, une partie = En cours).
async function resync(ids) {
  const ups = [];
  ids.forEach(id => {
    const it = itemById.get(id), L = itemIssues(id); if (!it || !L.length || !ISSUE_CATS.includes(it.category)) return;
    const d = derive(L, it.finished_on), fin = d.status === 'termine' ? d.last : null;
    if (it.read_status !== d.status || (it.finished_on || null) !== fin) ups.push(sb.from('items').update({ read_status: d.status, finished_on: fin }).eq('id', id));
  });
  if (ups.length) { await Promise.all(ups); await load(); }
}
