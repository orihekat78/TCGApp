/**
 * Task A batch#2 — wave3 (opt-cost reanimate クラスタ) specs.
 * 「(このキャラをスリープさせ、)手札を1枚リムーブしてもよい。そうした場合、リムーブから〚X〛を登場」
 *   = optional{ chain[ (sceneSetState$self,sleep,) discard1, sceneEnter{from:remove,...} ] }
 * 実証元: B05019 (optional wrapper + pendingEffectOptional)、D08003 (chain「そうした場合」)、
 *   B02004 a1/D08024 (sceneEnter from:remove)、D01012 (enterSleep)、D01010 a2 (cutin)、D03013 a2 (hirameki sleep-pick)。
 */
const fs = require('fs');

const RR_OPT = ['rules/15-abilities-effects.md', 'rules/17-icons.md'];
const RR_ENTER = ['rules/15-abilities-effects.md', 'rules/20-color-and-switch.md', 'rules/03-field-areas.md'];
const RR_HIRA = ['rules/10-action-event.md', 'rules/14-refresh.md'];
const RR_CUTIN = ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'];

const discard1 = { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } };
const selfSleep = { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } };
const reanimate = (filter, enterSleep) => ({
  kind: 'atom', verb: 'sceneEnter',
  args: { player: 'self', from: 'remove', max: 1, viaEffect: true, ...(enterSleep ? { enterSleep: true } : {}), filter },
});
// 【登場時】 opt(discard ± self-sleep) → reanimate
function optReanimate(id, { filter, enterSleep = false, selfSleepFirst = false, desc }) {
  const steps = [];
  if (selfSleepFirst) steps.push(selfSleep);
  steps.push(discard1, reanimate(filter, enterSleep));
  return {
    id, type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'optional', effect: { kind: 'chain', steps } },
    description: desc, ruleRefs: [...RR_OPT, ...RR_ENTER],
  };
}
const cutinAP = (id, delta, desc) => ({
  id, type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta, scope: 'contact' } },
  description: desc, ruleRefs: RR_CUTIN,
});
const hiramekiSleepPick = (id) => ({
  id, type: 'triggered', scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'sleep', target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' } } },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。', ruleRefs: [...RR_HIRA, 'rules/03-field-areas.md'],
});

const specs = [
  // (B01069 は certify workflow で verified green 化したため wave3 からは除外)

  // D05006: 【登場時】opt(discard1)→リムーブのLv4以下【黄】キャラをスリープ状態で登場
  { rep: 'D05006', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_OPT, ...RR_ENTER],
    clauseMap: [{ clause: '【登場時】手札1リムーブしてもよい。そうした場合、リムーブのLv4以下【黄】キャラ1枚までスリープ状態で登場', mapsTo: 'enter→optional{chain[discard1, sceneEnter{from:remove,enterSleep,color:黄,levelMax:4}]}', grounding: 'B05019 optional + D08003 chain + B02004 a1 from:remove + D01012 enterSleep' }],
    abilities: [optReanimate('a1', { filter: { color: '黄', levelMax: 4, kind: 'character' }, enterSleep: true, desc: '【登場時】手札を1枚リムーブしてもよい。そうした場合、リムーブのレベル4以下の【黄】のキャラを1枚まで選び、スリープ状態で登場させる。' })] },

  // B06052: 同 + 特徴[YAIBA]Lv6 + 【カットイン】AP+1000
  { rep: 'B06052', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_OPT, ...RR_ENTER, ...RR_CUTIN],
    clauseMap: [
      { clause: '【登場時】手札1リムーブしてもよい。そうした場合、リムーブのLv6以下[YAIBA]キャラ1枚までスリープ状態で登場', mapsTo: 'enter→optional{chain[discard1, sceneEnter{from:remove,enterSleep,trait:YAIBA,levelMax:6}]}', grounding: 'D05006 同型' },
      { clause: '【カットイン】AP＋1000', mapsTo: 'effect:declared(on-hand,optional,selfOnly)→charModifyAP{$contact.byUid,+1000,contact}', grounding: 'D01010 a2' },
    ],
    abilities: [
      optReanimate('a1', { filter: { trait: 'YAIBA', levelMax: 6, kind: 'character' }, enterSleep: true, desc: '【登場時】手札を1枚リムーブしてもよい。そうした場合、リムーブのレベル6以下の〚特徴［YAIBA］〛のキャラを1枚まで選び、スリープ状態で登場させる。' }),
      cutinAP('a2', 1000, '【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）'),
    ] },

  // PR138/PR144: self-sleep + opt(discard1)→リムーブのLv6以下[黒ずくめの組織]登場 + 【ヒラメキ】sleep-pick
  ...['PR138', 'PR144'].map((rep) => ({ rep, verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_OPT, ...RR_ENTER, ...RR_HIRA, 'rules/03-field-areas.md'],
    clauseMap: [
      { clause: '【登場時】このキャラをスリープさせ手札1リムーブしてもよい。そうした場合、リムーブのLv6以下[黒ずくめの組織]キャラ1枚まで登場', mapsTo: 'enter→optional{chain[sceneSetState$self sleep, discard1, sceneEnter{from:remove,trait:黒ずくめの組織,levelMax:6}]}', grounding: 'B05019 optional + D08003 chain + B01011 self-sleep + B02004 a1 from:remove' },
      { clause: '【ヒラメキ】キャラを1枚まで選びスリープ', mapsTo: 'evidence:remove-by-action(optional)→sceneSetState pick', grounding: 'D03013 a2' },
    ],
    abilities: [
      optReanimate('a1', { filter: { trait: '黒ずくめの組織', levelMax: 6, kind: 'character' }, selfSleepFirst: true, desc: '【登場時】このキャラをスリープさせ、手札を1枚リムーブしてもよい。そうした場合、リムーブのレベル6以下の〚特徴［黒ずくめの組織］〛のキャラを1枚まで選び、登場させる。' }),
      hiramekiSleepPick('a2'),
    ] })),
];

fs.writeFileSync('.tmp/taskA/wave3-specs.json', JSON.stringify(specs, null, 1));
console.log('wrote', specs.length, 'specs:', specs.map((s) => s.rep).join(', '));
