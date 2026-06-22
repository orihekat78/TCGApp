/**
 * Task A batch#2 — wave1 (look-N→hand cluster) specs.
 * All abilities reuse SETTLED patterns: deckRevealUntil+handAddFromDeck+deckToBottomBound (B01013/D01013),
 * hirameki draw (B01011 a2 / D08013), enterSleep (B01011 a1), cutin AP+ (D01010 a2), leave:to-remove hook.
 * Emits specs.json for scripts/taskA-codegen.cjs.
 */
const fs = require('fs');

const RR_LOOK = ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'];
const RR_HIRA = ['rules/10-action-event.md', 'rules/14-refresh.md'];
const RR_SLEEP = ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'];
const RR_CUTIN = ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'];

// look-N → 1枚まで手札 → 残りデッキ下 [→ 手札に加えた場合 discard 1]  (B01013 / D01013 同型)
function lookN({ id = 'a1', hook = 'enter', condition, filter, maxN, discard = false, desc }) {
  const add = { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } };
  const onMatch = discard
    ? { kind: 'sequence', steps: [add, { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } }] }
    : add;
  const ab = {
    id,
    type: 'triggered',
    scope: hook === 'leave:to-remove' ? 'on-scene' : 'on-scene',
    trigger: { hook, selfOnly: true },
    effect: {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', filter, maxN, bind: '$revealed', bindMatch: '$matched' } },
        { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: onMatch },
        { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      ],
    },
    description: desc,
    ruleRefs: RR_LOOK,
  };
  if (condition) ab.condition = condition;
  return ab;
}

function hirameki(id, desc) {
  return {
    id,
    type: 'triggered',
    scope: 'on-evidence',
    trigger: { hook: 'evidence:remove-by-action', optional: true },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: desc || '【ヒラメキ】カードを1枚引く。',
    ruleRefs: RR_HIRA,
  };
}

function enterSleep(id) {
  return {
    id,
    type: 'triggered',
    scope: 'on-scene',
    trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
    description: 'このキャラはスリープ状態で登場する。',
    ruleRefs: RR_SLEEP,
  };
}

function cutinAP(id, delta, desc) {
  return {
    id,
    type: 'triggered',
    scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta, scope: 'contact' } },
    description: desc,
    ruleRefs: RR_CUTIN,
  };
}

const D_LOOK = (n, what) => `【登場時】デッキ上から${n}枚見る → ${what}を1枚まで手札 → 残りをデッキ下。`;
const D_LOOK_D = (n, what) => `【登場時】デッキ上から${n}枚見る → ${what}を1枚まで手札(取った場合 discard 1) → 残りをデッキ下。`;

const specs = [
  // pure look-N → hand (no discard)
  { rep: 'B04024', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: RR_LOOK,
    clauseMap: [{ clause: '【登場時】上から2枚見て特徴[警察]キャラ1枚まで手札、残りデッキ下', mapsTo: 'enter→deckRevealUntil{trait:警察,kind:character,maxN:2}→handAddFromDeck→deckToBottomBound', grounding: 'B01013 同型' }],
    abilities: [lookN({ filter: { trait: '警察', kind: 'character' }, maxN: 2, desc: D_LOOK(2, '特徴[警察]キャラ') })] },
  { rep: 'B05057', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: RR_LOOK,
    clauseMap: [{ clause: '【登場時】上から2枚見て特徴[鈴木財閥]キャラ1枚まで手札、残りデッキ下', mapsTo: 'enter→deckRevealUntil{trait:鈴木財閥,kind:character,maxN:2}→handAddFromDeck→deckToBottomBound', grounding: 'B01013 同型' }],
    abilities: [lookN({ filter: { trait: '鈴木財閥', kind: 'character' }, maxN: 2, desc: D_LOOK(2, '特徴[鈴木財閥]キャラ') })] },
  { rep: 'B06088', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: RR_LOOK,
    clauseMap: [{ clause: '【登場時】上から3枚見て特徴[警視庁]キャラ1枚まで手札、残りデッキ下', mapsTo: 'enter→deckRevealUntil{trait:警視庁,kind:character,maxN:3}→handAddFromDeck→deckToBottomBound', grounding: 'B01013 同型' }],
    abilities: [lookN({ filter: { trait: '警視庁', kind: 'character' }, maxN: 3, desc: D_LOOK(3, '特徴[警視庁]キャラ') })] },
  { rep: 'B05060', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: RR_LOOK,
    clauseMap: [{ clause: '【登場時】上から2枚見て特徴[怪盗]か[マジシャン]キャラ1枚まで手札、残りデッキ下', mapsTo: 'enter→deckRevealUntil{trait:[怪盗,マジシャン],kind:character,maxN:2}→handAddFromDeck→deckToBottomBound', grounding: 'B01013 + trait array OR (atom-handlers targetFilterToPredicate .some)' }],
    abilities: [lookN({ filter: { trait: ['怪盗', 'マジシャン'], kind: 'character' }, maxN: 2, desc: D_LOOK(2, '特徴[怪盗]か[マジシャン]キャラ') })] },

  // look-4 event → hand → discard + hirameki draw
  { rep: 'B03007', verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_LOOK, 'rules/10-action-event.md'],
    clauseMap: [
      { clause: '【登場時】上から4枚見てイベント1枚まで手札→残りデッキ下→加えた場合手札1枚リムーブ', mapsTo: 'enter→deckRevealUntil{kind:event,maxN:4}→(handAddFromDeck→discard1)→deckToBottomBound', grounding: 'D01013 同型 (discard chain)' },
      { clause: '【ヒラメキ】カードを1枚引く', mapsTo: 'evidence:remove-by-action(optional)→draw', grounding: 'B01011 a2 / D08013' },
    ],
    abilities: [lookN({ filter: { kind: 'event' }, maxN: 4, discard: true, desc: D_LOOK_D(4, 'イベント') }), hirameki('a2')] },

  // look-4 警察/怪盗 char → hand → discard + hirameki draw  (PR061 == PR065)
  ...['PR061', 'PR065'].map((rep) => ({ rep, verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_LOOK, 'rules/10-action-event.md'],
    clauseMap: [
      { clause: '【登場時】上から4枚見て特徴[警察]か[怪盗]キャラ1枚まで手札→残りデッキ下→加えた場合手札1枚リムーブ', mapsTo: 'enter→deckRevealUntil{trait:[警察,怪盗],kind:character,maxN:4}→(handAddFromDeck→discard1)→deckToBottomBound', grounding: 'D01013 同型 + trait OR' },
      { clause: '【ヒラメキ】カードを1枚引く', mapsTo: 'evidence:remove-by-action(optional)→draw', grounding: 'B01011 a2' },
    ],
    abilities: [lookN({ filter: { trait: ['警察', '怪盗'], kind: 'character' }, maxN: 4, discard: true, desc: D_LOOK_D(4, '特徴[警察]か[怪盗]キャラ') }), hirameki('a2')] })),

  // enterSleep + look-3 FBI char → hand → discard  (PR180 == PR186)
  ...['PR180', 'PR186'].map((rep) => ({ rep, verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_SLEEP, ...RR_LOOK],
    clauseMap: [
      { clause: 'このキャラはスリープ状態で登場する', mapsTo: 'enter(selfOnly)→sceneSetState{$self,sleep}', grounding: 'B01011 a1' },
      { clause: '【登場時】上から3枚見て特徴[FBI]キャラ1枚まで手札→残りデッキ下→加えた場合手札1枚リムーブ', mapsTo: 'enter→deckRevealUntil{trait:FBI,kind:character,maxN:3}→(handAddFromDeck→discard1)→deckToBottomBound', grounding: 'D01013 同型' },
    ],
    abilities: [enterSleep('a1'), lookN({ id: 'a2', filter: { trait: 'FBI', kind: 'character' }, maxN: 3, discard: true, desc: D_LOOK_D(3, '特徴[FBI]キャラ') })] })),

  // 相手ターン中 + 現場リムーブ時 look-1 毛利探偵事務所 char → hand  + cutin AP+1000  (PR084 == PR090)
  ...['PR084', 'PR090'].map((rep) => ({ rep, verdict: 'green', tier: 2, keywords: [], isMR: false, ruleRefs: [...RR_LOOK, ...RR_CUTIN],
    clauseMap: [
      { clause: '【相手ターン中】【現場リムーブ時】上から1枚見て特徴[毛利探偵事務所]キャラ1枚まで手札、残りデッキ下', mapsTo: 'turn:opp + leave:to-remove(selfOnly)→deckRevealUntil{trait:毛利探偵事務所,kind:character,maxN:1}→handAddFromDeck→deckToBottomBound', grounding: 'B01013 look + leave:to-remove hook' },
      { clause: '【カットイン】AP＋1000', mapsTo: 'effect:declared(on-hand,optional,selfOnly)→charModifyAP{$contact.byUid,+1000,contact}', grounding: 'D01010 a2' },
    ],
    abilities: [
      lookN({ hook: 'leave:to-remove', condition: { kind: 'turn', player: 'opp' }, filter: { trait: '毛利探偵事務所', kind: 'character' }, maxN: 1, desc: '【相手ターン中】【現場リムーブ時】デッキ上から1枚見る → 特徴[毛利探偵事務所]キャラを1枚まで手札 → 残りをデッキ下。' }),
      cutinAP('a2', 1000, '【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）'),
    ] })),
];

fs.writeFileSync('.tmp/taskA/wave1-specs.json', JSON.stringify(specs, null, 1));
console.log('wrote', specs.length, 'specs:', specs.map((s) => s.rep).join(', '));
