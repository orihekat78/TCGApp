// cards/ct-p09/B09109P 怪盗キッド&安室透 (キャラ MR・パラレル) — S1 wave (2026-07-11)
// rules: 06-card-types.md, 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 18-mr.md, 19-special-rules.md, 20-color-and-switch.md, 21-declared-ability-cost.md, 22-qa-action-contact.md, 26-qa-deck-refresh.md
//
// 公式テキスト・句マッピング: B09109.ts と同一。P 版差分は rarity / imageUrl / no のみ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', max: 1, filter: { levelMax: 8, kind: 'character' }, side: 'self', bind: 'chosenChar' } },
      { kind: 'atom', verb: 'deckRevealUntil', args: { visibility: 'public', viewer: 'all', player: 'self', filter: { kind: 'character', levelMin: { dyn: '$bound.chosenChar.level' }, levelMax: { dyn: '$bound.chosenChar.level' }, cardName: { dyn: '$bound.chosenChar.cardName' } }, bind: 'restRevealed', bindMatch: 'matchedChar' } },
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$matchedChar.cardId', bind: '$entered', viaEffect: true, target: { query: { area: 'deck', side: 'self' } } } },
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$entered.uid', key: 'toDeckBottomOnTurnEnd', val: true } },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: 'restRevealed', order: 'preserve' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description: '【宣言】【ターン1】自分の現場にいるレベル8以下のキャラを1枚選んでもよい。そうした場合、自分のデッキのカードを上からそのキャラと同じレベルで同じカード名のキャラが出るまで1枚ずつ公開し、それを登場させ、ターン終了時まで「ターン終了時、このキャラを現場からデッキの下に移す。」を与える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/06-card-types.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  limit: { kind: 'turn', n: 1 },
  cost: { kind: 'revealFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { levelMax: 8, kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', max: 1, side: 'self', bind: 'nameTarget' } },
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$nameTarget.uid', key: 'nameOverride', val: '$cost.revealFromHand.cardName' } },
    ],
  },
  description: '【宣言】【ターン1】〚手札からレベル8以下のキャラを1枚公開する〛：自分の現場にいるキャラを1枚まで選び、ターン終了時までカード名を公開したキャラのカード名に書き換える。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B09109P: CardDef = {
  id: 'B09109P',
  no: '1048/B09109P',
  kind: 'character',
  names: ['怪盗キッド&安室透', '怪盗キッド', '安室透'],
  colors: ['白', '黄'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['怪盗', '探偵', '喫茶ポアロ'],
  keywords: [],
  rarity: 'MRP',
  imageUrl: '1775608962332141.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/06-card-types.md',
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
