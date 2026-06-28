const crypto = require('crypto');
const STRUCTURAL = new Set(['kind', 'verb', 'hook', 'type', 'scope', '__shared']);

function collect(node, t) {
  if (typeof node === 'function') { t.add('closure'); return; }
  if (node === null || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((x) => collect(x, t));
  if (typeof node.verb === 'string') t.add('verb:' + node.verb);
  if (typeof node.kind === 'string') t.add('kind:' + node.kind);
  for (const ff of ['filter', 'auraFilter'])
    if (node[ff] && typeof node[ff] === 'object' && !Array.isArray(node[ff]))
      for (const k of Object.keys(node[ff])) t.add('filter:' + k);
  for (const f of node.filterAny || []) for (const k of Object.keys(f || {})) t.add('filter:' + k);
  for (const [k, v] of Object.entries(node)) { if (['filter', 'auraFilter', 'filterAny'].includes(k)) continue; collect(v, t); }
}
function abilityTokens(ab, t) {
  if (ab.__shared) t.add('shared:' + ab.__shared);
  if (ab.type) t.add('type:' + ab.type);
  if (ab.scope) t.add('scope:' + ab.scope);
  if (ab.limit && ab.limit.kind) t.add('limit:' + ab.limit.kind);
  if (ab.trigger) {
    if (ab.trigger.hook) t.add('hook:' + ab.trigger.hook);
    for (const h of ab.trigger.hooks || []) t.add('hook:' + h);
    if (ab.trigger.selfOnly) t.add('trig:selfOnly');
    if (ab.trigger.__eventUse) t.add('trig:eventUse');
    if (typeof ab.trigger.matcher === 'function') t.add('closure');
    collect(ab.trigger.matcherCondition, t);
  }
  if (ab.continuousModifier) for (const k of Object.keys(ab.continuousModifier)) {
    t.add('cont:' + k); if (typeof ab.continuousModifier[k] === 'function') t.add('closure');
  }
  collect(ab.effect, t); collect(ab.condition, t); collect(ab.cost, t);
  if (ab.args && ab.args.inner) collect(ab.args.inner, t);
}
function skel(node) {
  if (typeof node === 'function') return '<fn>';
  if (node === null || typeof node !== 'object') return null;
  if (Array.isArray(node)) return node.map(skel);
  const o = {};
  for (const k of Object.keys(node).sort()) {
    const v = node[k];
    if (STRUCTURAL.has(k)) o[k] = v;
    else if (k === 'filter' || k === 'auraFilter') o[k] = Object.keys(v || {}).sort();
    else if (k === 'filterAny') o[k] = (v || []).map((f) => Object.keys(f || {}).sort());
    else o[k] = skel(v);
  }
  return o;
}
function fingerprint(abilities) {
  const t = new Set();
  (abilities || []).forEach((ab) => abilityTokens(ab, t));
  const skeleton = (abilities || []).map((ab) => ({ type: ab.type || null, scope: ab.scope || null,
    trigger: ab.trigger ? { hook: ab.trigger.hook || null, hooks: ab.trigger.hooks || [], selfOnly: !!ab.trigger.selfOnly } : null,
    cont: ab.continuousModifier ? Object.keys(ab.continuousModifier).sort() : null,
    effect: skel(ab.effect), condition: skel(ab.condition), cost: skel(ab.cost), shared: ab.__shared || null }));
  return { tokens: [...t].sort(), skeletonHash: crypto.createHash('sha1').update(JSON.stringify(skeleton)).digest('hex') };
}
module.exports = { fingerprint };
