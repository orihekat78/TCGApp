/**
 * Task A — certify spec の決定的検証 (codegen 前ゲート)。
 * agent 出力 (abilities JSON) を frozen engine の whitelists と照合し、
 * 不明 verb/hook/condition/cost/フィールドや closure 混入を機械的に弾く。
 * 使い方: node scripts/taskA-validate-specs.cjs <specs.json|dir>
 * 出力: PASS/FAIL per rep + 集約 (exit 1 if any FAIL)。
 */
const fs = require('fs');
const path = require('path');

// src/engine/types/effect.ts AtomVerb と同期 (charSetAP/charSetLP/startContact/endActionEarly は throw/stub → 禁止)
const VERBS = new Set([
  'draw', 'discard', 'mill', 'fileAdd', 'filePopToHand',
  'evidenceGain', 'evidenceLose', 'evidenceFlip', 'selfToEvidence', 'evidenceToDeck',
  'toPartnerArea', // engine wave-12 (G39)
  'partnerAreaRemove', // engine wave A1 (G39 継続) — PA から filter 一致 N 枚リムーブ (B07037/PR263)
  'evidenceToHand', 'handAddFromRemove', 'handAddFromDeck', 'handAddFromDeckBottom',
  'handToEvidence',
  'handReveal', // engine additive wave (2026-06-28) — 手札公開 (zone 変化なし、B08082/B07022)
  'drawUpToHandSize', // engine additive wave-4 (2026-07-01) — 手札が N 枚になるまで引く (B08047)
  'discardRandom', // engine additive (2026-06-28) — 手札ランダムリムーブ (B01077)
  'evidenceFlipDown', // engine拡張 wave (2026-06-23) — 表向き証拠→裏向き (B05013/B06017/B06019)
  'sceneEnter', 'sceneSwitch', 'sceneRemove', 'sceneSetState', 'sceneDisguise', 'sceneToHand',
  'sceneToDeck', // Task D E2 (2026-06-12)
  'sceneToEvidence', // engine mega-wave W1 (2026-07-03, P38): 現場キャラ→所有者の証拠 (B03084)
  'handToFileBottom', // engine mega-wave W1 (2026-07-03, P41): 手札→FILE 1番下 表向き (B05045)
  'evidenceToDeckBottom', // engine mega-wave W1 (2026-07-03): 証拠 pick→持ち主デッキ下 (B03084 a1 前段)
  'fileRemoveTop', 'fileFlipTop', // Task D E3 (2026-06-12)
  'charGrantAbility', // Task D E4 (2026-06-12)
  'charModifyAP', 'charModifyLP', 'charModifyLevel',
  'charOverrideAP', 'charOverrideLP',
  'charGrantKeyword', 'charRevokeKeyword', 'charDisableOriginal',
  'charSetTurnEffect', 'charSetCard', 'charStackCard', 'charRemoveSetCard',
  'partnerAssist', 'partnerSetState', 'partnerSolveCase',
  'opponentLoses', // engine E3 (2026-07-02) — alt-lose 勝利ルート
  'caseToResolved', 'deckRevealUntil', 'deckToBottomBound', 'boundToRemove', 'deckShuffle', 'souza',
  'removeAreaAllToDeckBottom', // cluster4 (2026-06-14)
  'setEventUseBan', // cluster6 (2026-06-14) — turn-scoped event-use ban (B09034)
  'setNextHintBan', // wave use-restrict (2026-06-30) — turn-scoped next-hint ban (B06104/B09019/B09105)
  'setCutinBan', // engine additive wave-10 (2026-07-02) — turn-scoped cutin ban (B07002)
  'setDisguiseBan', // engine additive wave-10 (2026-07-02) — turn-scoped disguise ban (B07002)
  'setHiramekiSuppress', // cluster8 (2026-06-15) — action-scoped opp-hirameki suppress (B06049)
  'expandActionTargets', 'log', 'invokeLeaveToRemoveOfCard', 'noop',
  'bindPick', // engine mega-wave W4 (2026-07-03, r82 G33) — pick-only bind atom (B08035)
]);
const FORBIDDEN_VERBS = new Set(['charSetAP', 'charSetLP', 'startContact', 'endActionEarly']);

// listeners/triggered.ts TRIGGERED_HOOKS (card-triggerable のみ)
const HOOKS = new Set([
  'enter', 'enter:group', 'disguise:into', 'leave:to-remove', 'action:declare', 'action:guarded',
  'action:pre-target', 'contact:start', 'reasoning:end', 'case:to-resolved',
  'phase:end:start', 'effect:declared', 'evidence:remove-by-action',
  'file:pop', // Task D E3 (2026-06-12)
  'action:end', 'evidence:gain', // engine拡張 wave#2 cluster3 (2026-06-13)
  'setcard:leave', // engine拡張 wave#2 cluster9 (2026-06-15)
  'setcard:enter', // engine additive (2026-06-29, B02018/B06046)
  // engine additive wave-3 (2026-06-30): observer-hook 群 (B02080/B09086/B05015/B09016/B02062)
  'cutin:used', 'misread:performed', 'evidence:removed',
  'ability:declared', // engine mega-wave W2 (2026-07-03): 宣言能力使用の第三者観測 (B03057)
  'disguise:replaced', 'hand:removed', 'hand:reveal', // engine mega-wave W3 (2026-07-03): observer hooks // engine mega-wave W2 (2026-07-03): 宣言能力使用の第三者観測 (B03057)
  'remove:exit', // engine additive wave-4 (2026-07-01) — リムーブエリア離脱 observer (B05087/B05088)
]);

const CONDS = new Set([
  'true', 'false', 'not', 'and', 'or', 'turn', 'partnerColor', 'caseColor', 'caseColorNot', 'caseTrait',
  'fileAtLeast', 'caseStatus', 'bond', 'sceneHas', 'apAtLeast', 'lpAtLeast', 'sceneLpSum', 'evidenceAtLeast',
  'evidenceDiff', 'sceneCountCompare', // engine additive wave (2026-06-30, B05103/B05081)
  'evidenceTraitAtLeast', // engine E3 P53 (2026-07-03, B09107)
  'costRemovedMatches', // engine additive wave (2026-06-29d)
  'fileTopType', 'scratchTrace', 'flag', 'declaredUseUnder', 'bound', 'removeColorAtLeast',
  'removeTraitAtLeast', 'removeNameAtLeast', 'removeCountAtLeast', 'stackedCountAtLeast', 'contactOpponentApHigher',
  'guardedBySelf', 'enterOrderEquals', 'boundMatchesFilter', 'boundAnyMatchesFilter', 'boundDistinctColorCount', 'triggerCharMatches',
  // Task D E1 (2026-06-12): hand-count conditions
  'handAtLeast', 'handAtMost', 'handCountAtLeastOther',
  // Task D E2/E3 (2026-06-12)
  'fileTopMatches', 'triggerPlayerIs', 'charTurnEffect',
  // engine拡張 wave#2 cluster3 (2026-06-13)
  'triggerActionKind',
  // BUG-145 self-state micro-cluster (2026-06-15)
  'charStateIs',
  // engine拡張 wave#2 cluster11 (2026-06-15, BUG-146 coupled): 効果登場の原因カード評価
  'enterSource',
  // engine拡張 wave#2 cluster15 (2026-06-16): removal-observer (反撃カード一族)
  'removedCharMatches',
  'disguiseReplacedByMatches', 'disguiseReplacedMatches', 'triggerByPlayerIs', 'triggerRevealMatches', // W3
  // engine additive (2026-06-29, B09089): このターンの登場枚数 n 以下か
  'enterCountAtMost',
  // engine additive (2026-06-29, B06046): setcard:enter payload の set card filter 評価
  'setCardMatches',
  // engine additive wave-3 (2026-06-30, B09086): cutin:used 使用カットインの cardName/特徴 filter
  'triggerCutinMatches',
  // engine additive wave-4 (2026-07-01, B05087/B05088): remove:exit 離脱カードの filter 評価
  'removeExitMatches',
]);

const COSTS = new Set([
  'sleepSelf', 'sleepChar', 'stunChar', 'removeFromHand', 'removeFromScene', 'removeDeckTop',
  'discardEvidence', 'selfToDeckBottom', 'pay', 'choice', 'fileFrom', 'flipFaceUpEvidence',
  'sceneToDeckBottom', // Task D E2 (2026-06-12)
  'removeAreaToDeckBottom', // cluster4 (2026-06-14)
  'removeSetCard', // engine additive wave (2026-06-24): 裏向きセットを合わせて n 枚リムーブ (B08033 a2)
  'sceneStackUnderSelf', // engine mega-wave W4 (2026-07-03, r6): 現場キャラを自身の下に重ねる (B09048 a2)
  'handStackUnder', // engine mega-wave W4 (2026-07-03, r7): 手札公開→現場キャラ下に重ねる (B08006 a1)
  'revealFromHand', // engine additive wave (2026-06-28): 手札公開 presence-check cost (B08093 a1)
  'revealHandToDeckTop', // engine mega-wave W1 (2026-07-03, P29): 手札公開→デッキ上 cost (B05049 a1)
]);

const EFFECT_KINDS = new Set(['sequence', 'parallel', 'choice', 'optional', 'conditional', 'forEach', 'atom', 'chain']);
const SHARED_FNS = new Set(['misreadX', 'souzaX', 'partnerColorKeyword', 'eventRemoveByAP', 'caseTraitConditioned', 'caseResolvedHandRemove', 'caseDeclaredEvidenceFlip']);
const ABILITY_TYPES = new Set(['continuous', 'triggered', 'declared', 'icon-disguise', 'icon-misread']);
const SCOPES = new Set(['on-scene', 'on-partner-area', 'on-hand', 'on-evidence', 'always']);
const FILTER_FIELDS = new Set(['cardId', 'cardName', 'cardNameNot', 'trait', 'color', 'colorNot', 'keyword', 'kind', 'apMin', 'apMax', 'lpMin', 'lpMax', 'levelMin', 'levelMax', 'levelIn', 'levelInBound', 'hasSetCards', 'hasFaceDownSetCards', 'actedCharThisTurn']);

function walk(node, errs, ctx) {
  if (node === null || typeof node !== 'object') {
    if (typeof node === 'function') errs.push(`${ctx}: function value`);
    return;
  }
  if (Array.isArray(node)) { node.forEach((x, i) => walk(x, errs, `${ctx}[${i}]`)); return; }
  if (typeof node.kind === 'string') {
    if (node.verb !== undefined) {
      if (FORBIDDEN_VERBS.has(node.verb)) errs.push(`${ctx}: FORBIDDEN verb ${node.verb}`);
      else if (!VERBS.has(node.verb)) errs.push(`${ctx}: unknown verb ${node.verb}`);
    } else if (EFFECT_KINDS.has(node.kind)) {
      // effect wrapper ok
    } else if (CONDS.has(node.kind) || COSTS.has(node.kind) || ['self', 'pick', 'all', 'fromBound', 'card-back', 'assisted-partner'].includes(node.kind)) {
      // condition / cost / targeting ref ok
    } else if (node.kind === 'custom') {
      errs.push(`${ctx}: kind:'custom' (closure) forbidden in specs`);
    } else if (node.kind === 'replace' || node.kind === 'negate') {
      errs.push(`${ctx}: kind:'${node.kind}' not runnable via effect.run`);
    } else if (!['character', 'event', 'misread-marker'].includes(node.kind)) {
      // 'kind' as TargetFilter field ('character'|'event') / noop marker は許容
      errs.push(`${ctx}: unknown kind '${node.kind}'`);
    }
  }
  if (node.filter && typeof node.filter === 'object' && !Array.isArray(node.filter)) {
    for (const k of Object.keys(node.filter)) {
      if (k === 'custom') errs.push(`${ctx}.filter: custom (closure) forbidden`);
      else if (!FILTER_FIELDS.has(k)) errs.push(`${ctx}.filter: unknown field ${k}`);
    }
  }
  if (Array.isArray(node.filterAny)) {
    node.filterAny.forEach((f, i) => {
      for (const k of Object.keys(f || {})) {
        if (k === 'custom') errs.push(`${ctx}.filterAny[${i}]: custom forbidden`);
        else if (!FILTER_FIELDS.has(k)) errs.push(`${ctx}.filterAny[${i}]: unknown field ${k}`);
      }
    });
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === 'filter' || k === 'filterAny') continue;
    walk(v, errs, `${ctx}.${k}`);
  }
}

function validateSpec(spec) {
  const errs = [];
  if (spec.verdict !== 'green') return { rep: spec.rep, skip: true, errs: [] };
  if (spec.needsManual) return { rep: spec.rep, needsManual: true, errs: [] };
  if (!Array.isArray(spec.abilities)) return { rep: spec.rep, errs: ['abilities not array'] };
  spec.abilities.forEach((ab, i) => {
    const c = `a[${i}]`;
    if (ab.__shared) {
      if (!SHARED_FNS.has(ab.__shared)) errs.push(`${c}: unknown __shared ${ab.__shared}`);
      if (ab.args && ab.args.inner) walk(ab.args.inner, errs, `${c}.inner`);
      return;
    }
    if (!ABILITY_TYPES.has(ab.type)) errs.push(`${c}: bad type ${ab.type}`);
    if (ab.scope !== undefined && !SCOPES.has(ab.scope)) errs.push(`${c}: bad scope ${ab.scope}`);
    if (ab.type === 'triggered') {
      if (!ab.trigger || typeof ab.trigger !== 'object') errs.push(`${c}: triggered without trigger`);
      else {
        if (!HOOKS.has(ab.trigger.hook)) errs.push(`${c}: hook '${ab.trigger.hook}' not card-triggerable`);
        for (const h of ab.trigger.hooks || []) if (!HOOKS.has(h)) errs.push(`${c}: hooks[] '${h}' not card-triggerable`);
        if (ab.trigger.matcher !== undefined) errs.push(`${c}: trigger.matcher closure forbidden (use __eventUse)`);
        for (const k of Object.keys(ab.trigger)) {
          if (!['hook', 'hooks', 'selfOnly', 'matcherCondition', 'optional', 'ignoreCostInduced', '__eventUse'].includes(k)) {
            errs.push(`${c}: unknown trigger field ${k}`);
          }
        }
      }
      if (!ab.effect) errs.push(`${c}: triggered without effect`);
    }
    if (ab.type === 'declared' && !ab.effect) errs.push(`${c}: declared without effect`);
    if (ab.type === 'continuous') {
      if (!ab.continuousModifier) errs.push(`${c}: continuous without continuousModifier`);
      else {
        // pure-JSON continuousModifier fields (card-def.ts). closure-only: grantKeywords / customSelectorPatch → needsManual.
        const JSON_CONT_KEYS = ['apDelta', 'lpDelta', 'lvlDelta', 'apDeltaAura', 'lpDeltaAura', 'auraFilter', 'auraExcludeSelf', 'opponentRestrict', 'apDeltaAuraOpp', 'lpDeltaAuraOpp', 'auraFilterOpp',
          // pure-JSON case-continuous overrides (P05/E3 P11/P53/P10): TargetFilter/number/string[]/boolean、closure なし
          'handUseRestrictFilter', 'sceneCapOverride', 'partnerColorsOverride', 'cannotSolveCase', 'partnerSolveOverride'];
        for (const k of Object.keys(ab.continuousModifier)) {
          if (!JSON_CONT_KEYS.includes(k)) errs.push(`${c}: continuousModifier.${k} not JSON-expressible (grantKeywords/customSelectorPatch need closure → needsManual)`);
        }
      }
      if (ab.effect) errs.push(`${c}: continuous must not have effect`);
    }
    if (ab.limit !== undefined && ab.limit !== null) {
      if (ab.limit.kind !== 'turn' || ![1, 2].includes(ab.limit.n)) errs.push(`${c}: bad limit ${JSON.stringify(ab.limit)} (game-limit unenforced)`);
    }
    if (ab.effect) walk(ab.effect, errs, `${c}.effect`);
    if (ab.condition) walk(ab.condition, errs, `${c}.condition`);
    if (ab.cost) walk(ab.cost, errs, `${c}.cost`);
    if (ab.trigger && ab.trigger.matcherCondition) walk(ab.trigger.matcherCondition, errs, `${c}.matcherCondition`);
    if (typeof ab.description !== 'string' || !ab.description) errs.push(`${c}: missing description`);
  });
  return { rep: spec.rep, errs };
}

function main() {
  const target = process.argv[2] || '.tmp/certify';
  let specs = [];
  if (fs.statSync(target).isDirectory()) {
    for (const f of fs.readdirSync(target)) {
      if (!f.endsWith('.json') || f.endsWith('.verify.json')) continue;
      try { specs.push(JSON.parse(fs.readFileSync(path.join(target, f), 'utf8'))); }
      catch (e) { console.log(`PARSE-FAIL ${f}: ${e.message}`); }
    }
  } else {
    specs = JSON.parse(fs.readFileSync(target, 'utf8'));
  }
  let fail = 0, pass = 0, manual = 0, skip = 0;
  for (const spec of specs) {
    const r = validateSpec(spec);
    if (r.skip) { skip++; continue; }
    if (r.needsManual) { manual++; console.log(`MANUAL ${r.rep}`); continue; }
    if (r.errs.length) { fail++; console.log(`FAIL ${r.rep}:`); r.errs.forEach((e) => console.log(`  - ${e}`)); }
    else pass++;
  }
  console.log(`\nvalidate: pass=${pass} fail=${fail} needsManual=${manual} yellow-skip=${skip} / ${specs.length}`);
  process.exit(fail ? 1 : 0);
}

main();
