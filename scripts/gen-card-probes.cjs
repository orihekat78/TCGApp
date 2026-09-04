#!/usr/bin/env node
/*
 * scripts/gen-card-probes.cjs — "probe compiler" MVP generator.
 *
 * カード ability JSON (serializable DSL) から ProbeScenario を機械導出し、thin な .gen.test.ts を出力する。
 * 生成物は tests/helpers/card-probe-harness.ts の runCardScenario 経由で **production dispatch のみ**を叩く。
 *
 * usage:
 *   node scripts/gen-card-probes.cjs --ids B07032,B07036,B09089 \
 *        --out tests/cards/genprobe-validation
 *   (--ids 省略時は specs 全件を対象; --report-only で出力せず coverage レポートのみ)
 *
 * fail-closed: 対応外 trigger / effect kind は MANUAL レポートに載せ、何も生成しない。
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// args
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = { specs: '.tmp/compiler/shipped-dsl.json', ids: null, out: 'tests/cards/genprobe-validation', reportOnly: false };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--specs') a.specs = argv[++i];
    else if (t === '--ids') a.ids = argv[++i].split(',').map((s) => s.trim()).filter(Boolean);
    else if (t === '--out') a.out = argv[++i];
    else if (t === '--report-only') a.reportOnly = true;
  }
  return a;
}

// ---------------------------------------------------------------------------
// static card data (corpus.json) — id -> {kind, level, color, features[]}
// ---------------------------------------------------------------------------
function loadCorpus(repoRoot) {
  const p = path.join(repoRoot, '.tmp/compiler/corpus.json');
  if (!fs.existsSync(p)) return new Map();
  const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
  const arr = Array.isArray(raw) ? raw : (raw.cards || raw.rows || raw.corpus || Object.values(raw).find(Array.isArray) || []);
  const m = new Map();
  for (const c of arr) {
    if (!c || !c.id) continue;
    m.set(c.id, {
      kind: c.kind,
      level: c.level != null ? Number(c.level) : undefined,
      color: c.color,
      features: c.features ? String(c.features).split('|').filter(Boolean) : [],
    });
  }
  return m;
}

// ---------------------------------------------------------------------------
// card module discovery: id -> '@/cards/<dir>/<id>'
// ---------------------------------------------------------------------------
function findCardModule(repoRoot, id) {
  const base = path.join(repoRoot, 'src/cards');
  for (const dir of fs.readdirSync(base)) {
    const f = path.join(base, dir, `${id}.ts`);
    if (fs.existsSync(f)) return `@/cards/${dir}/${id}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// support matrix
// ---------------------------------------------------------------------------
const PICK_VERBS = new Set([
  'discard', 'evidenceToHand', 'handAddFromRemove', 'removeAreaToDeckTop', 'handToEvidence',
  'handReveal', 'handToFileBottom', 'useEventFromHand', 'evidenceToDeckBottom', 'evidenceFlip',
  'evidenceFlipDown', 'sceneRemove', 'partnerAreaRemove', 'charModifyAP', 'sceneSetState',
  'charModifyLP', 'charModifyLevel', 'sceneToHand', 'sceneToDeck', 'charGrantAbility',
  'charGrantKeyword', 'charSetCard', 'charRemoveSetCard', 'bindPick', 'sceneEnter',
]);
// zones for placement
const HAND_ZONE_VERBS = new Set(['discard', 'handReveal', 'handToEvidence', 'handToFileBottom', 'useEventFromHand']);
const REMOVE_ZONE_VERBS = new Set(['handAddFromRemove', 'removeAreaToDeckTop', 'sceneEnter']);
const PA_ZONE_VERBS = new Set(['partnerAreaRemove']);
const UNSUPPORTED_EFFECT_KINDS = new Set(['choice', 'forEach', 'negate', 'replace', 'custom', 'misread']);

function supportOfAbility(ability, staticData) {
  if (ability.type === 'declared') return { ok: true, mode: 'declared' };
  if (ability.type === 'triggered') {
    const tr = ability.trigger || {};
    if (tr.hook === 'enter' && tr.selfOnly === true) return { ok: true, mode: 'enter' };
    if (tr.hook === 'effect:declared' && tr.__eventUse === true) {
      if (staticData && staticData.kind === 'event') return { ok: true, mode: 'event-use' };
      return { ok: false, reason: `effect:declared __eventUse but card kind=${staticData ? staticData.kind : '?'} (not event)` };
    }
    return { ok: false, reason: `unsupported triggered hook: ${tr.hook || '?'}${tr.selfOnly === false ? ' (observer)' : ''}` };
  }
  return { ok: false, reason: `unsupported ability type: ${ability.type}` };
}

function scanUnsupportedKinds(effect, found) {
  if (!effect || typeof effect !== 'object') return;
  if (effect.kind && UNSUPPORTED_EFFECT_KINDS.has(effect.kind)) found.add(effect.kind);
  for (const k of ['effect', 'then', 'else']) if (effect[k]) scanUnsupportedKinds(effect[k], found);
  for (const k of ['steps']) if (Array.isArray(effect[k])) effect[k].forEach((s) => scanUnsupportedKinds(s, found));
}

// ---------------------------------------------------------------------------
// on-path prompt walk: emits ordered prompts as they surface at runtime
//   prompt = { type:'pick', verb, args, filter, nMin } | { type:'optional' }
// auto atoms (draw/mill/...) collected separately for outcome assertions.
// ---------------------------------------------------------------------------
const BINDING_COND_KINDS = new Set(['bound', 'boundMatchesFilter']);
function walkPrompts(effect, prompts, autos, underCond, optionalAncestors = [], optionalCounter = { value: 0 }) {
  if (!effect || typeof effect !== 'object') return;
  switch (effect.kind) {
    case 'atom': {
      const verb = effect.verb;
      const args = effect.args || {};
      if (PICK_VERBS.has(verb)) {
        const nMin = typeof args.n === 'number' ? args.n : 0; // max-form => nMin 0
        prompts.push({
          type: 'pick', verb, args, filter: args.filter || null, nMin,
          optionalDepth: optionalAncestors.length, optionalAncestors,
        });
      } else if (!underCond) {
        // autos under a conditional (draw gated by boundMatchesFilter 等) は happy-path で発火保証できない
        // ため outcome アサートしない (weak)。非 conditional の auto (optional 内 draw 等) のみ pin する。
        autos.push({ verb, args, optionalDepth: optionalAncestors.length, optionalAncestors });
      }
      break;
    }
    case 'sequence':
    case 'chain':
    case 'parallel':
      (effect.steps || []).forEach((s) => walkPrompts(
        s, prompts, autos, underCond, optionalAncestors, optionalCounter,
      ));
      break;
    case 'optional': {
      const optionalId = optionalCounter.value++;
      prompts.push({
        type: 'optional',
        optionalDepth: optionalAncestors.length,
        optionalAncestors,
        optionalId,
      });
      walkPrompts(
        effect.effect,
        prompts,
        autos,
        underCond,
        [...optionalAncestors, optionalId],
        optionalCounter,
      );
      break;
    }
    case 'conditional': {
      // binding-dependent 条件 (boundMatchesFilter/bound) は happy-path で in-filter を選ぶと不成立に
      // なりがち → then 枝は発火しない前提で walk しない (over-script 回避)。
      const ifKind = effect.if && effect.if.kind;
      if (BINDING_COND_KINDS.has(ifKind)) break;
      // board 条件 (enterCountAtMost 等): setup で真化する前提で then を walk (pick は surface する)。
      walkPrompts(effect.then, prompts, autos, true, optionalAncestors, optionalCounter);
      break;
    }
    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// fixture / setup builder
// ---------------------------------------------------------------------------
const CARD_DEFAULTS = { level: 3, ap: 5000, lp: 1 };
function otherColor(c) { return c === '黒' ? '赤' : '黒'; }

function mkFixture(id, over) {
  return Object.assign(
    { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] },
    over || {},
  );
}

// build in-filter def props + per-constraint decoy defs from a filter object
function deriveFromFilter(filter) {
  const inProps = { kind: 'character', level: CARD_DEFAULTS.level, ap: CARD_DEFAULTS.ap, colors: ['赤'], traits: [], names: null };
  const decoys = []; // {suffix, props}
  if (!filter) return { inProps, decoys };
  if (typeof filter.levelMax === 'number') { inProps.level = filter.levelMax; decoys.push({ suffix: 'levelMax', props: { level: filter.levelMax + 1 } }); }
  if (typeof filter.levelMin === 'number') { inProps.level = filter.levelMin; decoys.push({ suffix: 'levelMin', props: { level: filter.levelMin - 1 } }); }
  if (typeof filter.apMax === 'number') { inProps.ap = filter.apMax; decoys.push({ suffix: 'apMax', props: { ap: filter.apMax + 1000 } }); }
  if (typeof filter.apMin === 'number') { inProps.ap = filter.apMin; decoys.push({ suffix: 'apMin', props: { ap: filter.apMin - 1000 } }); }
  if (typeof filter.trait === 'string') { inProps.traits = [filter.trait]; decoys.push({ suffix: 'trait', props: { traits: ['__DTRAIT__'] } }); }
  if (Array.isArray(filter.trait) && filter.trait.length > 0) { inProps.traits = [filter.trait[0]]; decoys.push({ suffix: 'trait', props: { traits: ['__DTRAIT__'] } }); }
  if (typeof filter.color === 'string') { inProps.colors = [filter.color]; decoys.push({ suffix: 'color', props: { colors: [otherColor(filter.color)] } }); }
  if (typeof filter.cardName === 'string') { inProps.names = [filter.cardName]; decoys.push({ suffix: 'cardName', props: { names: ['__DNAME__'] } }); }
  if (filter.kind === 'character') { decoys.push({ suffix: 'kind', props: { kind: 'event' } }); }
  return { inProps, decoys };
}

// ---------------------------------------------------------------------------
// per-ability scenario derivation
// ---------------------------------------------------------------------------
function deriveScenarios(cardId, ability, staticData, mode) {
  const fixtures = new Map(); // id -> def
  const scenarios = [];
  const notes = [];
  const addFix = (id, over) => { if (!fixtures.has(id)) fixtures.set(id, mkFixture(id, over)); return id; };

  const CARRIER_UID = '__CARRIER__';
  const condition = ability.condition || null;

  // --- unified prompt plan (on-path) ---
  const prompts = [];
  const autos = [];
  walkPrompts(ability.effect, prompts, autos, false);

  // pick-slot -> placement/in-filter/decoy metadata (computed once, reused across scenarios)
  // Each pick prompt gets: { slot(pickIndex), verb, zone, side, inId, inUid, decoys:[{id,suffix}] }
  const pickPlans = [];
  let pickIdx = 0;
  const baseSetup = {
    hand: [], remove: [], partnerAreaCards: [], selfScene: [], oppScene: [],
  };
  const pushScene = (side, cardId2, uid, extra) => baseSetup[side === 'self' ? 'selfScene' : 'oppScene'].push(Object.assign({ cardId: cardId2, uid }, extra || {}));

  for (const p of prompts) {
    if (p.type !== 'pick') continue;
    const slot = pickIdx++;
    p.pickPlanIndex = slot;
    const { inProps, decoys } = deriveFromFilter(p.filter);
    const args = p.args || {};
    let zone, side;
    if (HAND_ZONE_VERBS.has(p.verb)) { zone = 'hand'; side = 'self'; }
    else if (REMOVE_ZONE_VERBS.has(p.verb)) { zone = 'remove'; side = 'self'; }
    else if (PA_ZONE_VERBS.has(p.verb)) { zone = 'partner-area'; side = 'self'; }
    else { zone = 'scene'; side = args.side === 'self' ? 'self' : (args.side === 'opp' ? 'opp' : 'opp'); } // either => opp (clean)

    const inId = `__IN_${slot}`;
    const inUid = `__INU_${slot}`;
    // register in-filter fixture (skip if kind:event required as in-filter — not applicable, in-filter is character)
    addFix(inId, { kind: inProps.kind, level: inProps.level, ap: inProps.ap, colors: inProps.colors, traits: inProps.traits, names: inProps.names || [inId] });
    const decoyIds = [];
    for (const d of decoys) {
      const did = `__DE_${slot}_${d.suffix}`;
      const merged = Object.assign({ kind: inProps.kind, level: inProps.level, ap: inProps.ap, colors: inProps.colors.slice(), traits: inProps.traits.slice(), names: inProps.names ? inProps.names.slice() : [did] }, d.props);
      if (!merged.names || merged.names === inProps.names) merged.names = [did];
      addFix(did, merged);
      decoyIds.push({ id: did, suffix: d.suffix });
    }

    // placement
    if (zone === 'scene') {
      pushScene(side, inId, inUid, { state: 'active' });
      for (const d of decoyIds) pushScene(side, d.id, `${d.id}_u`, { state: 'active' });
    } else if (zone === 'hand') {
      // discard etc: ensure fodder in hand; decoys (rare) also in hand
      baseSetup.hand.push(inId);
      for (const d of decoyIds) baseSetup.hand.push(d.id);
    } else if (zone === 'remove') {
      baseSetup.remove.push(inId);
      for (const d of decoyIds) baseSetup.remove.push(d.id);
    } else if (zone === 'partner-area') {
      baseSetup.partnerAreaCards.push(inId);
      for (const d of decoyIds) baseSetup.partnerAreaCards.push(d.id);
    }
    pickPlans.push({ slot, verb: p.verb, zone, side, inId, inUid, decoys: decoyIds, args, nMin: p.nMin });
  }

  // Enumerate every executable leaf branch of an arbitrary cost tree.
  // A path records one index per encountered `choice`, including choices in
  // sibling `pay` items; the engine consumes the same depth-first path.
  function combineBranches(left, right) {
    const out = [];
    for (const a of left) for (const b of right) {
      out.push({ items: [...a.items, ...b.items], choicePath: [...a.choicePath, ...b.choicePath] });
    }
    return out;
  }
  function enumerateCostBranches(node) {
    if (!node) return [{ items: [], choicePath: [] }];
    if (node.kind === 'pay' && Array.isArray(node.items)) {
      return node.items.reduce((acc, item) => combineBranches(acc, enumerateCostBranches(item)), [{ items: [], choicePath: [] }]);
    }
    if (node.kind === 'choice' && Array.isArray(node.items)) {
      return node.items.flatMap((item, choice) => enumerateCostBranches(item)
        .map((branch) => ({ items: branch.items, choicePath: [choice, ...branch.choicePath] })));
    }
    return [{ items: [node], choicePath: [] }];
  }
  const costBranches = enumerateCostBranches(ability.cost);
  const flattenedCosts = costBranches[0] ? costBranches[0].items : [];

  // --- base setup shared by driven scenarios ---
  function cloneSetup(extra, costItems = flattenedCosts) {
    const s = {
      selfScene: baseSetup.selfScene.map((c) => Object.assign({}, c)),
      oppScene: baseSetup.oppScene.map((c) => Object.assign({}, c)),
      hand: baseSetup.hand.slice(),
      remove: baseSetup.remove.slice(),
      partnerAreaCards: baseSetup.partnerAreaCards.slice(),
      deckSize: 6,
    };
    // carrier + driver-specific
    if (mode === 'declared') {
      s.selfScene.unshift({ cardId, uid: CARRIER_UID, state: 'active' });
      // cost fodder in hand (removeFromHand) — ensure at least 1
    } else if (mode === 'enter') {
      s.selfScene.unshift({ cardId, uid: CARRIER_UID, state: 'active' });
      // discard etc need hand fodder already placed via hand-zone picks
    } else if (mode === 'event-use') {
      s.hand.unshift(cardId);
      s.caseColors = staticData && staticData.color ? [staticData.color] : ['赤'];
      s.fileCount = Math.max(7, (staticData && staticData.level) || 0);
    }
    if (condition && condition.kind === 'caseStatus') s.caseStatus = condition.status;
    else if (mode !== 'event-use') s.caseStatus = '解決編'; // default permissive
    const positiveConditions = condition && condition.kind === 'and'
      ? (condition.cs ?? condition.all ?? [])
      : (condition ? [condition] : []);
    for (const c of positiveConditions) {
      if (c.kind === 'partnerColor') s.partnerColors = [c.color];
      if (c.kind === 'bond' && typeof c.cardName === 'string') {
        const id = '__COND_BOND__';
        addFix(id, { names: [c.cardName] });
        s.selfScene.push({ cardId: id, uid: `${id}_u`, state: 'active' });
      }
    }
    // BUG-245: the real activation boundary rejects unpaid declared costs.
    // Seed representative, in-filter cost targets so happy-path probes reach
    // the effect instead of relying on the former unpaid-cost fall-through.
    for (let costIndex = 0; costIndex < costItems.length; costIndex++) {
      const cost = costItems[costIndex];
      const filter = cost.target && cost.target.query ? cost.target.query.filter : null;
      const { inProps } = deriveFromFilter(filter);
      const n = typeof cost.n === 'number' ? cost.n : 1;
      if (cost.kind === 'partnerAreaRemove') {
        for (let i = 0; i < n; i++) {
          const id = `__COST_PA_${costIndex}_${i}`;
          addFix(id, { kind: inProps.kind, level: inProps.level, ap: inProps.ap, colors: inProps.colors, traits: inProps.traits, names: inProps.names || [id] });
          s.partnerAreaCards.push(id);
        }
      }
      if (cost.kind === 'removeAreaToDeckBottom') {
        for (let i = 0; i < n; i++) {
          const id = `__COST_REMOVE_${costIndex}_${i}`;
          addFix(id, { kind: inProps.kind, level: inProps.level, ap: inProps.ap, colors: inProps.colors, traits: inProps.traits, names: inProps.names || [id] });
          s.remove.push(id);
        }
      }
      if ((cost.kind === 'sleepChar' || cost.kind === 'stunChar' || cost.kind === 'removeFromScene' || cost.kind === 'sceneToDeckBottom') && cost.target && (cost.target.kind === 'pick' || cost.target.kind === 'all')) {
        for (let i = 0; i < n; i++) {
          const id = `__COST_SCENE_TARGET_${costIndex}_${i}`;
          const side = cost.target.query.side === 'opp' ? 'oppScene' : 'selfScene';
          addFix(id, { kind: inProps.kind, level: inProps.level, ap: inProps.ap, colors: inProps.colors, traits: inProps.traits, names: inProps.names || [id] });
          s[side].push({ cardId: id, uid: `${id}_u`, state: 'active' });
        }
      }
      if (cost.kind === 'sceneStackUnderSelf') {
        for (let i = 0; i < n; i++) {
          const id = `__COST_SCENE_${costIndex}_${i}`;
          addFix(id, { kind: inProps.kind, level: inProps.level, ap: inProps.ap, colors: inProps.colors, traits: inProps.traits, names: inProps.names || [id] });
          s.selfScene.push({ cardId: id, uid: `${id}_u`, state: 'active' });
        }
      }
      if (cost.kind === 'removeFromHand' || cost.kind === 'revealFromHand' || cost.kind === 'revealHandToDeckTop') {
        const count = typeof cost.n === 'number' ? cost.n : cost.n.min;
        for (let i = 0; i < count; i++) {
          const id = `__COST_HAND_${costIndex}_${i}`;
          addFix(id, { kind: inProps.kind, level: inProps.level, ap: inProps.ap, colors: inProps.colors, traits: inProps.traits, names: inProps.names || [id] });
          s.hand.unshift(id);
        }
      }
      if (cost.kind === 'removeSetCard') {
        const carrier = s.selfScene.find(entry => entry.uid === CARRIER_UID);
        carrier.setCards = carrier.setCards || [];
        for (let i = 0; i < n; i++) {
          const id = `__COST_SET_${costIndex}_${i}`;
          addFix(id, {});
          carrier.setCards.push({ cardId: id, instanceId: `set:${CARRIER_UID}:${costIndex}:${i}`, faceUp: !!cost.anyFace });
        }
      }
      if (cost.kind === 'removeStackedCards') {
        const carrier = s.selfScene.find(entry => entry.uid === CARRIER_UID);
        carrier.stackedCards = carrier.stackedCards || [];
        for (let i = 0; i < n; i++) {
          const id = `__COST_STACK_${costIndex}_${i}`;
          addFix(id, {});
          carrier.stackedCards.push({ cardId: id, instanceId: `stack:${CARRIER_UID}:${costIndex}:${i}` });
        }
      }
      if (cost.kind === 'discardEvidence' || cost.kind === 'flipFaceUpEvidence') {
        const count = cost.kind === 'discardEvidence' ? cost.n : cost.n.min;
        s.evidence = s.evidence || [];
        for (let i = 0; i < count; i++) {
          const id = `__COST_EVIDENCE_${costIndex}_${i}`;
          addFix(id, {});
          s.evidence.push({ cardId: id, faceUp: false });
        }
      }
      if (cost.kind === 'fileFrom') s.fileCount = Math.max(s.fileCount || 0, n);
      if (cost.kind === 'removeDeckTop' && typeof cost.n === 'number') s.deckSize = Math.max(s.deckSize, cost.n);
      if (cost.kind === 'removeFromHandDownTo') {
        for (let i = 0; i < cost.n + 1; i++) {
          const id = `__COST_HAND_DOWN_${costIndex}_${i}`;
          addFix(id, {});
          s.hand.unshift(id);
        }
      }
      if (cost.kind === 'handStackUnder') {
        const id = `__COST_HAND_STACK_${costIndex}`;
        addFix(id, {});
        s.hand.unshift(id);
        const host = `__COST_STACK_HOST_${costIndex}`;
        addFix(host, {});
        s.selfScene.push({ cardId: host, uid: `${host}_u`, state: 'active' });
      }
    }
    return Object.assign(s, extra || {});
  }

  function driveObj(choicePath, costItems = flattenedCosts) {
    if (mode === 'declared') {
      const costParams = {};
      if (choicePath && choicePath.length === 1) costParams.costChoice = choicePath[0];
      if (choicePath && choicePath.length > 1) costParams.costChoicePath = choicePath;
      for (let costIndex = 0; costIndex < costItems.length; costIndex++) {
        const cost = costItems[costIndex];
        if (cost.kind !== 'removeSetCard') continue;
        costParams.removeSetCard = {
          hostUids: Array.from({ length: cost.n }, () => CARRIER_UID),
          instanceIds: Array.from({ length: cost.n }, (_v, i) => `set:${CARRIER_UID}:${costIndex}:${i}`),
        };
      }
      return { kind: 'declared', uid: CARRIER_UID, abilityId: ability.id, ...(Object.keys(costParams).length ? { costParams } : {}) };
    }
    if (mode === 'enter') return { kind: 'enter', cardId, uid: CARRIER_UID, side: 'self' };
    return { kind: 'event-use', cardId };
  }

  // outcome assertions for a picked in-filter target of a pick plan
  function outcomeAsserts(plan) {
    const a = [];
    switch (plan.verb) {
      case 'sceneRemove':
      case 'sceneToHand':
      case 'sceneToDeck':
        a.push({ kind: 'zone', cardId: plan.inId, zone: 'scene', side: plan.side, present: false });
        break;
      case 'sceneSetState':
        if (typeof plan.args.state === 'string') a.push({ kind: 'state', uid: plan.inUid, state: plan.args.state });
        break;
      case 'discard':
        a.push({ kind: 'zone', cardId: plan.inId, zone: 'hand', side: 'self', present: false });
        a.push({ kind: 'zone', cardId: plan.inId, zone: 'remove', side: 'self', present: true });
        break;
      case 'partnerAreaRemove':
        a.push({ kind: 'zone', cardId: plan.inId, zone: 'partner-area', side: 'self', present: false });
        break;
      case 'sceneEnter':
        a.push({ kind: 'zone', cardId: plan.inId, zone: 'scene', side: 'self', present: true });
        a.push({ kind: 'zone', cardId: plan.inId, zone: 'remove', side: 'self', present: false });
        break;
      case 'charModifyAP':
        if (typeof plan.args.delta === 'number') a.push({ kind: 'apDelta', uid: plan.inUid, n: plan.args.delta });
        break;
      default:
        notes.push(`${cardId}/${ability.id}: verb '${plan.verb}' has no outcome-assertion (decoy-exclusion only)`);
        break;
    }
    return a;
  }
  function autoAsserts() {
    const a = [];
    for (const au of autos) {
      if (au.verb === 'draw' && typeof au.args.n === 'number') a.push({ kind: 'deckDelta', side: 'self', n: -au.args.n });
      else if (au.verb === 'mill' && typeof au.args.n === 'number') a.push({ kind: 'deckDelta', side: 'self', n: -au.args.n });
    }
    return a;
  }
  function costConsumptionAsserts(costItems = flattenedCosts) {
    const a = [];
    for (let costIndex = 0; costIndex < costItems.length; costIndex++) {
      const cost = costItems[costIndex];
      const n = typeof cost.n === 'number' ? cost.n : 1;
      for (let i = 0; i < n; i++) {
        if (cost.kind === 'partnerAreaRemove') {
          const id = `__COST_PA_${costIndex}_${i}`;
          a.push({ kind: 'zone', cardId: id, zone: 'partner-area', side: 'self', present: false });
          a.push({ kind: 'zone', cardId: id, zone: 'remove', side: 'self', present: true });
        }
        if (cost.kind === 'sceneStackUnderSelf') {
          const id = `__COST_SCENE_${costIndex}_${i}`;
          a.push({ kind: 'zone', cardId: id, zone: 'scene', side: 'self', present: false });
          a.push({ kind: 'stacked', hostUid: CARRIER_UID, cardId: id, present: true });
        }
        if (cost.kind === 'removeFromHand' || cost.kind === 'revealHandToDeckTop') {
          a.push({ kind: 'zone', cardId: `__COST_HAND_${costIndex}_${i}`, zone: 'hand', side: 'self', present: false });
        }
        if (cost.kind === 'removeFromHand') {
          a.push({ kind: 'zone', cardId: `__COST_HAND_${costIndex}_${i}`, zone: 'remove', side: 'self', present: true });
        }
        if (cost.kind === 'removeSetCard') {
          a.push({ kind: 'zone', cardId: `__COST_SET_${costIndex}_${i}`, zone: 'remove', side: 'self', present: true });
        }
        if (cost.kind === 'removeStackedCards') {
          a.push({ kind: 'zone', cardId: `__COST_STACK_${costIndex}_${i}`, zone: 'remove', side: 'self', present: true });
          a.push({ kind: 'stacked', hostUid: CARRIER_UID, cardId: `__COST_STACK_${costIndex}_${i}`, present: false });
        }
        if (cost.kind === 'removeAreaToDeckBottom') {
          a.push({ kind: 'zone', cardId: `__COST_REMOVE_${costIndex}_${i}`, zone: 'remove', side: 'self', present: false });
          a.push({ kind: 'zone', cardId: `__COST_REMOVE_${costIndex}_${i}`, zone: 'deck', side: 'self', present: true });
        }
      }
    }
    return a;
  }

  // === Scenario A: happy path (condition on, optional take, all picks -> in-filter) ===
  {
    for (const branch of costBranches) {
    const script = [];
    const expect = [];
    let recIdx = 0;
    for (const p of prompts) {
      if (p.type === 'optional') { script.push('optional:take'); continue; }
      const plan = pickPlans[recIdx];
      script.push({ pickCardId: plan.inId });
      for (const d of plan.decoys) expect.push({ kind: 'candidatesExclude', pickIndex: recIdx, cardId: d.id });
      expect.push(...outcomeAsserts(plan));
      recIdx++;
    }
    expect.push(...autoAsserts());
    expect.push(...costConsumptionAsserts(branch.items));
    if (mode === 'event-use') expect.push({ kind: 'zone', cardId, zone: 'hand', side: 'self', present: false });
    const branchName = branch.choicePath.length ? ` (cost choice ${branch.choicePath.join('.')})` : '';
    scenarios.push({ name: `${cardId} happy-path${branchName} (all picks -> in-filter; decoys excluded)`, setup: cloneSetup(undefined, branch.items), drive: driveObj(branch.choicePath, branch.items), script, expect });
    }
  }

  // === Scenario B: condition-off (noPromptSurfaced) ===
  if (condition) {
    // S2 token 施策 #4 (2026-07-10): and の子配列は実型では `cs` (types/effect.ts)。旧 `all` 参照は
    // 常に不成立で and 条件の off-variant が 1 件も生成されていなかった (B08057 で実測)。両対応。
    const andChildren = condition.kind === 'and' ? (condition.cs ?? condition.all) : null;
    const offVariants = Array.isArray(andChildren) ? andChildren : [condition];
    let vi = 0;
    for (const cv of offVariants) {
      const extra = {};
      let described = null;
      if (cv.kind === 'caseStatus') { extra.caseStatus = cv.status === '解決編' ? '事件編' : '解決編'; described = `caseStatus!=${cv.status}`; }
      else if (cv.kind === 'partnerColor' || cv.kind === 'partnerColorKeyword') { extra.partnerColors = ['__NOMATCH__']; described = 'partnerColor mismatch'; }
      else if (cv.kind === 'turn') { extra.turn = cv.player === 'self' ? 'opp' : 'self'; described = 'turn mismatch'; }
      else { notes.push(`${cardId}/${ability.id}: condition kind '${cv.kind}' off-variant not derivable`); continue; }
      // enter/declared only (event-use has no ability.condition among targets)
      scenarios.push({
        name: `${cardId} condition-off (${described}) -> no prompt`,
        setup: cloneSetup(extra),
        drive: driveObj(),
        script: [],
        expect: [{ kind: 'noPromptSurfaced' }],
      });
      vi++;
    }
    if (vi === 0) notes.push(`${cardId}/${ability.id}: condition present but no off-variant generated`);
  }

  // optional detection + first nMin-0 pick
  const optionalIndex = prompts.findIndex((p) => p.type === 'optional');
  const hasOptional = optionalIndex >= 0;
  const firstSkippable = pickPlans.find((pl) => pl.nMin === 0);

  // === Scenario C: optional decline ===
  if (hasOptional) {
    const script = [];
    const expect = [];
    const declinedOptionalId = prompts[optionalIndex].optionalId;
    // Prompts before the optional still surface. Declining suppresses only its inner prompts;
    // sequence-tail prompts at the same depth continue normally.
    for (let i = 0; i < optionalIndex; i++) {
      if (prompts[i].type === 'pick') script.push('pick:skip');
    }
    script.push('optional:decline');
    for (let i = optionalIndex + 1; i < prompts.length; i++) {
      const prompt = prompts[i];
      const suppressed = prompt.optionalAncestors.includes(declinedOptionalId);
      if (prompt.type === 'optional') {
        if (!suppressed) script.push('optional:take');
        continue;
      }
      const pl = pickPlans[prompt.pickPlanIndex];
      if (suppressed) {
        if (pl.verb === 'sceneRemove' || pl.verb === 'sceneToHand' || pl.verb === 'sceneToDeck') {
          expect.push({ kind: 'zone', cardId: pl.inId, zone: 'scene', side: pl.side, present: true });
        } else if (pl.verb === 'sceneSetState') {
          expect.push({ kind: 'state', uid: pl.inUid, state: 'active' });
        } else if (pl.verb === 'partnerAreaRemove') {
          expect.push({ kind: 'zone', cardId: pl.inId, zone: 'partner-area', side: 'self', present: true });
        } else if (pl.verb === 'discard') {
          expect.push({ kind: 'zone', cardId: pl.inId, zone: 'hand', side: 'self', present: true });
        }
      } else {
        script.push({ pickCardId: pl.inId });
        for (const d of pl.decoys) expect.push({ kind: 'candidatesExclude', pickIndex: pl.slot, cardId: d.id });
        expect.push(...outcomeAsserts(pl));
      }
    }
    // draw inside optional must not happen
    for (const au of autos) if (au.optionalAncestors.includes(declinedOptionalId) && au.verb === 'draw' && typeof au.args.n === 'number') expect.push({ kind: 'deckDelta', side: 'self', n: 0 });
    if (!expect.length) expect.push({ kind: 'deckDelta', side: 'self', n: 0 });
    scenarios.push({ name: `${cardId} optional-decline (inner effect does not fire)`, setup: cloneSetup(), drive: driveObj(), script, expect });
  }

  // === Scenario D: nMin-0 skip (「1枚まで」= 0 可) ===
  // happy-path を鏡写しにし、最初の nMin-0 pick 1 箇所だけを 'pick:skip' に差し替える
  // (skip は sequence/chain を継続するので後続 pick は依然 surface する)。optional は take して内側到達。
  if (firstSkippable) {
    const script = [];
    const expect = [];
    let recIdx = 0;
    let skipped = null;
    for (const p of prompts) {
      if (p.type === 'optional') { script.push('optional:take'); continue; }
      const plan = pickPlans[recIdx];
      if (!skipped && plan.nMin === 0) { script.push('pick:skip'); skipped = plan; }
      else script.push({ pickCardId: plan.inId });
      recIdx++;
    }
    if (skipped.verb === 'sceneRemove' || skipped.verb === 'sceneToHand' || skipped.verb === 'sceneToDeck') {
      expect.push({ kind: 'zone', cardId: skipped.inId, zone: 'scene', side: skipped.side, present: true });
    } else if (skipped.verb === 'partnerAreaRemove') {
      expect.push({ kind: 'zone', cardId: skipped.inId, zone: 'partner-area', side: 'self', present: true });
    } else if (skipped.verb === 'sceneEnter') {
      expect.push({ kind: 'zone', cardId: skipped.inId, zone: 'remove', side: 'self', present: true });
    } else {
      expect.push({ kind: 'zone', cardId: skipped.inId, zone: skipped.zone, side: skipped.side, present: true });
    }
    scenarios.push({ name: `${cardId} nMin-0 skip (「1枚まで」= 0枚 legal; target unchanged)`, setup: cloneSetup(), drive: driveObj(), script, expect });
  }

  // === Scenario E: cost-gate (declared only) ===
  // S2 token 施策 #4 (2026-07-10): (a) 非 pay の単独 cost ({kind:'sleepSelf'} 直書き、B02072 型) も
  // items 1 件として正規化 (b) removeDeckTop の deck 不足 gate (公式Q&A「N枚リムーブできなければ
  // 使用不可」、B08057 型) を追加。
  if (mode === 'declared' && ability.cost) {
    for (const branch of costBranches) {
      for (let leafIndex = 0; leafIndex < branch.items.length; leafIndex++) {
        const leaf = branch.items[leafIndex];
        const setup = cloneSetup(undefined, branch.items);
        let description = null;
        if (leaf.kind === 'sleepSelf') {
          setup.selfScene.find((entry) => entry.uid === CARRIER_UID).state = 'sleep';
          description = 'sleepSelf unpayable (self sleeping)';
        } else if (leaf.kind === 'removeFromHand' || leaf.kind === 'revealHandToDeckTop') {
          setup.hand = [];
          description = `${leaf.kind} unpayable (empty hand)`;
        } else if (leaf.kind === 'revealFromHand' && (typeof leaf.n === 'number' ? leaf.n : leaf.n.min) > 0) {
          setup.hand = [];
          description = 'revealFromHand unpayable (empty hand)';
        } else if (leaf.kind === 'removeDeckTop' && typeof leaf.n === 'number' && leaf.n > 0) {
          setup.deckSize = Math.max(0, leaf.n - 1);
          description = `removeDeckTop n=${leaf.n} unpayable (deck ${leaf.n - 1})`;
        } else if (leaf.kind === 'discardEvidence') {
          setup.evidence = [];
          description = 'discardEvidence unpayable (no evidence)';
        } else if (leaf.kind === 'removeSetCard') {
          const carrier = setup.selfScene.find((entry) => entry.uid === CARRIER_UID);
          if (carrier) carrier.setCards = [];
          description = 'removeSetCard unpayable (no eligible set card)';
        } else if (leaf.kind === 'removeStackedCards') {
          const carrier = setup.selfScene.find((entry) => entry.uid === CARRIER_UID);
          if (carrier) carrier.stackedCards = [];
          description = 'removeStackedCards unpayable (empty stack)';
        } else if (leaf.kind === 'flipFaceUpEvidence' && leaf.n.min > 0) {
          setup.evidence = [];
          description = 'flipFaceUpEvidence unpayable (no face-down evidence)';
        } else if (leaf.kind === 'fileFrom') {
          setup.fileCount = 0;
          description = 'fileFrom unpayable (empty file)';
        }
        if (!description) {
          notes.push(`${cardId}/${ability.id}: cost leaf '${leaf.kind}' has no deterministic negative fixture`);
          continue;
        }
        scenarios.push({
          name: `${cardId} cost-gate${branch.choicePath.length ? ` (cost choice ${branch.choicePath.join('.')})` : ''}: ${description} -> canPay=false`,
          setup,
          drive: {
            kind: 'cost-gate', uid: CARRIER_UID, abilityId: ability.id, expectCanPay: false,
            ...(branch.choicePath.length === 1 ? { costParams: { costChoice: branch.choicePath[0] } } : {}),
            ...(branch.choicePath.length > 1 ? { costParams: { costChoicePath: branch.choicePath } } : {}),
          },
          script: [],
          expect: [],
        });
      }
    }
  }

  return { fixtures, scenarios, notes };
}

// ---------------------------------------------------------------------------
// rendering
// ---------------------------------------------------------------------------
function renderTest(cardId, modulePath, fixtures, scenarios) {
  const fixArr = Array.from(fixtures.values());
  const lines = [];
  lines.push('// AUTO-GENERATED by scripts/gen-card-probes.cjs — do not hand-edit; regenerate instead.');
  lines.push(`// card: ${cardId}  |  scenarios: ${scenarios.length}  |  fixtures: ${fixArr.length}`);
  lines.push('');
  lines.push("import { describe, it } from 'vitest';");
  lines.push("import { runCardScenario } from '../../helpers/card-probe-harness';");
  lines.push("import type { ProbeScenario } from '../../helpers/card-probe-harness';");
  lines.push("import type { CardDef } from '@/engine/types';");
  lines.push(`import { ${cardId} } from '${modulePath}';`);
  lines.push('');
  lines.push(`const FIXTURES: CardDef[] = ${JSON.stringify(fixArr, null, 2)};`);
  lines.push('');
  lines.push(`const SCENARIOS: ProbeScenario[] = ${JSON.stringify(scenarios, null, 2)};`);
  lines.push('');
  lines.push(`describe('${cardId} — auto-probe (generated)', () => {`);
  lines.push('  for (const sc of SCENARIOS) {');
  lines.push('    it(sc.name, () => {');
  lines.push(`      runCardScenario(${cardId}, FIXTURES, sc);`);
  lines.push('    });');
  lines.push('  }');
  lines.push('});');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function main() {
  const repoRoot = process.cwd();
  const args = parseArgs(process.argv);
  const specsPath = path.isAbsolute(args.specs) ? args.specs : path.join(repoRoot, args.specs);
  const parsedSpecs = JSON.parse(fs.readFileSync(specsPath, 'utf8'));
  const specRows = Array.isArray(parsedSpecs) ? parsedSpecs : parsedSpecs.cards;
  const specs = specRows.map((spec) => spec.rep ? spec : { ...spec, rep: spec.id });
  const corpus = loadCorpus(repoRoot);

  const targetIds = args.ids || specs.map((s) => s.rep);
  const outDir = path.isAbsolute(args.out) ? args.out : path.join(repoRoot, args.out);
  if (!args.reportOnly) fs.mkdirSync(outDir, { recursive: true });

  const report = { generated: [], manual: [], notes: [], abilityAuto: 0, abilityManual: 0 };
  // full-corpus coverage pass (all 23 specs) for the value metric
  const coverage = { auto: 0, manual: 0, perCard: [] };
  for (const spec of specs) {
    const sd = corpus.get(spec.rep);
    for (const ab of (spec.abilities || [])) {
      const sup = supportOfAbility(ab, sd);
      const unsupportedKinds = new Set();
      if (sup.ok) scanUnsupportedKinds(ab.effect, unsupportedKinds);
      if (sup.ok && unsupportedKinds.size === 0) { coverage.auto++; }
      else {
        coverage.manual++;
        const reason = sup.ok ? `effect contains unsupported kind(s): ${[...unsupportedKinds].join(',')}` : sup.reason;
        coverage.perCard.push({ id: spec.rep, ability: ab.id, reason });
      }
    }
  }

  for (const id of targetIds) {
    const spec = specs.find((s) => s.rep === id);
    if (!spec) { report.notes.push(`${id}: not found in specs`); continue; }
    const sd = corpus.get(id);
    const modulePath = findCardModule(repoRoot, id);
    const allFixtures = new Map();
    const allScenarios = [];
    let anyGenerated = false;
    for (const ab of (spec.abilities || [])) {
      const sup = supportOfAbility(ab, sd);
      const unsupportedKinds = new Set();
      if (sup.ok) scanUnsupportedKinds(ab.effect, unsupportedKinds);
      if (!sup.ok || unsupportedKinds.size > 0) {
        report.manual.push({ id, ability: ab.id, reason: sup.ok ? `unsupported effect kind: ${[...unsupportedKinds].join(',')}` : sup.reason });
        report.abilityManual++;
        continue;
      }
      report.abilityAuto++;
      const { fixtures, scenarios, notes } = deriveScenarios(id, ab, sd, sup.mode);
      for (const [k, v] of fixtures) if (!allFixtures.has(k)) allFixtures.set(k, v);
      allScenarios.push(...scenarios);
      report.notes.push(...notes);
      anyGenerated = true;
    }
    if (!anyGenerated) { report.notes.push(`${id}: no supported ability -> nothing generated`); continue; }
    if (!modulePath) { report.notes.push(`${id}: card module not found under src/cards -> skipped emit`); continue; }
    const outFile = path.join(outDir, `${id}.gen.test.ts`);
    const src = renderTest(id, modulePath, allFixtures, allScenarios);
    if (!args.reportOnly) fs.writeFileSync(outFile, src, 'utf8');
    report.generated.push({ id, scenarios: allScenarios.length, fixtures: allFixtures.size, file: path.relative(repoRoot, outFile) });
  }

  // ---- print report ----
  const L = [];
  L.push('===== gen-card-probes report =====');
  L.push(`specs: ${path.relative(repoRoot, specsPath)}  |  target ids: ${targetIds.join(',')}`);
  L.push('');
  L.push('--- generated ---');
  for (const g of report.generated) L.push(`  ${g.id}: ${g.scenarios} scenarios, ${g.fixtures} fixtures -> ${g.file}`);
  if (!report.generated.length) L.push('  (none)');
  L.push('');
  L.push('--- MANUAL fallback (target ids) ---');
  for (const m of report.manual) L.push(`  ${m.id}/${m.ability}: ${m.reason}`);
  if (!report.manual.length) L.push('  (none)');
  L.push('');
  L.push('--- full-corpus coverage (value metric: auto-coverable vs manual across all specs) ---');
  L.push(`  abilities auto-coverable: ${coverage.auto}`);
  L.push(`  abilities manual:         ${coverage.manual}`);
  L.push(`  total abilities:          ${coverage.auto + coverage.manual}`);
  L.push('  manual breakdown:');
  for (const m of coverage.perCard) L.push(`    ${m.id}/${m.ability}: ${m.reason}`);
  L.push('');
  if (report.notes.length) {
    L.push('--- notes / weak-assertion warnings ---');
    for (const n of report.notes) L.push(`  ${n}`);
    L.push('');
  }
  process.stdout.write(L.join('\n') + '\n');
}

main();
