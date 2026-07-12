// cards/ct-p09/B09109 怪盗キッド&安室透 (キャラ MR) — S1 wave (2026-07-11, MR pair cost-dyn)
// rules: 06-card-types.md, 09-cutin-disguise.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 18-mr.md, 19-special-rules.md, 20-color-and-switch.md, 21-declared-ability-cost.md, 22-qa-action-contact.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【宣言】【ターン1】自分の現場にいるレベル8以下のキャラを1枚選んでもよい。そうした場合、自分のデッキの
//     カードを上からそのキャラと同じレベルで同じカード名のキャラが出るまで1枚ずつ公開し、それを登場させ、
//     ターン終了時まで「ターン終了時、このキャラを現場からデッキの下に移す。」を与える。残りの公開した
//     カードをデッキの下に移し、デッキをシャッフルする。
//   【宣言】【ターン1】〚手札からレベル8以下のキャラを1枚公開する〛：自分の現場にいるキャラを1枚まで選び、
//     ターン終了時までカード名を公開したキャラのカード名に書き換える。この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング:
//   a1: 【宣言】【ターン1】=> type:'declared' + limit{turn,1} + scope:'on-scene' (「パートナーエリアでも」句なし)。
//       「レベル8以下のキャラを1枚選んでもよい。そうした場合、〜」= chain (origin=bindPick、辞退で remainder skip)。
//       chain 部形状は engine probe (engine-megaw5-dyn-cost.test.ts「B09109 a1 idiom」) が pin した形状:
//       - bindPick{max:1, side:'self', filter:{levelMax:8, kind:'character'}, bind:'chosenChar'} (「選んでもよい」= 短縮形 0枚可)
//       - deckRevealUntil{filter dyn: chosenChar と同 level + 同 cardName、bind:'restRevealed', bindMatch:'matchedChar'}
//         (公式Q&A: 実効 level/cardName を参照 = bound は解決時実効値)
//       - sceneEnter{cardId:'$matchedChar.cardId', target deck-source} (BUG-102 splice)。matched 無しは silent
//         no-op (sceneEnter/deckRevealUntil は chainStepNoApply を立てない → tail は必ず走る)。公式Q&A: 同名
//         なしで全公開 → 何も登場せず全部戻してシャッフル (下 deckToBottomBound+deckShuffle が担保)。
//       - charSetTurnEffect{uid:'$matchedChar.uid', key:'toDeckBottomOnTurnEnd'} = rider (D11019/PR181 同型。
//         登場キャラの uid を bindMatch から参照。matched 無し=unbound uid で silent no-op)。
//       - deckToBottomBound{bindKey:'restRevealed'} + deckShuffle (残りをデッキ下→シャッフル)。
//       公式Q&A: 現場5枚でもスイッチ登場可 (sceneEnter 内蔵)・効果登場の【登場時】発動・変装引継ぎ = engine 既存。
//   a2: 【宣言】【ターン1】=> scope:'on-partner-area' (「パートナーエリアでも宣言できる」rules/18)。
//       cost 〚手札からレベル8以下のキャラを1枚公開する〛=> revealFromHand{levelMax:8, kind:'character'} n:1
//       (B06004/B08068 同型。公開のみ = 手札に残る zone 不変)。
//       effect 「現場のキャラを1枚まで選び、ターン終了時までカード名を公開したキャラのカード名に書き換える」=>
//       charSetTurnEffect{uid:'$pick', key:'nameOverride', val:'$cost.revealFromHand.cardName', target pick 0-1}
//       (B04077 単一 atom pick 同型 + PR105 nameOverride key。val は revealFromHand costPaid の先頭公開名。
//       複数名カードは names[0]=複合名 で完全置換、rules/19 分割 override は公式裁定なし = 既存設計 posture)。
//   a3: 【カットイン】AP＋2000 = B07079 a3 同型。
//   ※ MR能力①② (rules/18) は engine/mr-partner-area-core 配線済 (isMR=rarity 前方一致 消費)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  effect: {
    kind: 'chain',
    steps: [
      // 現場のレベル8以下のキャラを1枚選んでもよい (chain origin。辞退=0枚で remainder skip)
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', max: 1, filter: { levelMax: 8, kind: 'character' }, side: 'self', bind: 'chosenChar' } },
      // デッキ上から chosenChar と同 level・同 cardName のキャラが出るまで1枚ずつ公開 (dyn filter は dispatch 時解決 = 実効値)
      { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', filter: { kind: 'character', levelMin: { dyn: '$bound.chosenChar.level' }, levelMax: { dyn: '$bound.chosenChar.level' }, cardName: { dyn: '$bound.chosenChar.cardName' } }, bind: 'restRevealed', bindMatch: 'matchedChar' } },
      // それを登場させる (BUG-102: target.query.area='deck' でデッキから splice。matched 無し=silent no-op)
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: '$matchedChar.cardId', bind: '$entered', viaEffect: true, target: { query: { area: 'deck', side: 'self' } } } },
      // ターン終了時まで「ターン終了時、このキャラを現場からデッキの下に移す。」を与える (rider)
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$entered.uid', key: 'toDeckBottomOnTurnEnd', val: true } },
      // 残りの公開したカードをデッキの下に移す (matched 無しなら全公開分)
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: 'restRevealed' } },
      // デッキをシャッフルする
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description: '【宣言】【ターン1】自分の現場にいるレベル8以下のキャラを1枚選んでもよい。そうした場合、自分のデッキのカードを上からそのキャラと同じレベルで同じカード名のキャラが出るまで1枚ずつ公開し、それを登場させ、ターン終了時まで「ターン終了時、このキャラを現場からデッキの下に移す。」を与える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/06-card-types.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  limit: { kind: 'turn', n: 1 },
  // 〚手札からレベル8以下のキャラを1枚公開する〛(コスト: 公開のみ=手札に残る)
  scope: 'always',
  cost: { kind: 'revealFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { levelMax: 8, kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  // 現場のキャラを1枚まで選び、ターン終了時までカード名を公開したキャラのカード名に書き換える
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

export const B09109: CardDef = {
  id: 'B09109',
  no: '1048/B09109',
  kind: 'character',
  names: ['怪盗キッド&安室透', '怪盗キッド', '安室透'],
  colors: ['白', '黄'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['怪盗', '探偵', '喫茶ポアロ'],
  keywords: [],
  rarity: 'MR',
  imageUrl: '1775608944043558.jpg',
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
