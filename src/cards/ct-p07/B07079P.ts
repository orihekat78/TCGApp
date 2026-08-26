// cards/ct-p07/B07079P 佐藤美和子＆宮本由美 (キャラ MR・パラレル) — Task D batch (2026-06-12)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 18-mr.md, 19-special-rules.md, 20-color-and-switch.md, 21-declared-ability-cost.md, 22-qa-action-contact.md, 23-qa-disguise-cutin.md
//
// 公式テキスト (B07079 と同一):
//   【宣言】【ターン1】【スリープ】〚現場にいるレベル7以下の特徴［警視庁］のキャラを1枚デッキの下に移す〛：
//     AP8000以下のキャラを1枚まで選び、リムーブする。手札からレベル4以下の〚特徴［警視庁］〛のキャラを
//     1枚まで登場させるか、カードを1枚引く。
//   【宣言】【ターン1】〚手札を1枚リムーブする〛：自分の現場にいる〚特徴［警視庁］〛のキャラを1枚まで選び、
//     ターン終了時までAP＋3000し、「ターン終了時、このキャラを現場からデッキの下に移す。」を与える。
//     この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング: B07079.ts と同一 (a1: sleepSelf+sceneToDeckBottom cost → sceneRemove apMax8000 +
//   choice[手札登場/draw] / a2: removeFromHand cost → charModifyAP 短縮形 carrier (+3000, bind) →
//   toDeckBottomOnTurnEnd、パートナーエリア句はscope:'on-partner-area'で配線済み / a3: カットイン AP+2000)。
//   ⚠ a2 step1 は短縮形必須 (明示 $pick+target は human 経路で bind 喪失 — B07079.ts 参照)。
//   P 版差分は rarity / imageUrl / no のみ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  // 【スリープ】〚現場にいるレベル7以下の特徴[警視庁]のキャラを1枚デッキの下に移す〛(コスト: 全部実行 rules/21)
  cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'sceneToDeckBottom', target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { levelMax: 7, trait: '警視庁' } }, n: { min: 1, max: 1 }, chooser: 'owner' }, n: 1 }] },
  effect: {
    kind: 'sequence',
    steps: [
      // AP8000以下のキャラを1枚まで選び、リムーブする (側指定なし = どちらの現場でも rules/15)
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 }, cause: 'effect' } },
      // 手札からレベル4以下の[警視庁]のキャラを1枚まで登場させるか、カードを1枚引く (真の2択)
      { kind: 'choice', chooser: 'self', options: [
        { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { trait: '警視庁', levelMax: 4, kind: 'character' } } },
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      ] },
    ],
  },
  description: '【宣言】【ターン1】【スリープ】〚現場にいるレベル7以下の特徴［警視庁］のキャラを1枚デッキの下に移す〛：AP8000以下のキャラを1枚まで選び、リムーブする。手札からレベル4以下の〚特徴［警視庁］〛のキャラを1枚まで登場させるか、カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area', // M3 PA batch (2026-07-10): 「この能力はパートナーエリアでも宣言できる」(rules/18)
  limit: { kind: 'turn', n: 1 },
  // 〚手札を1枚リムーブする〛(コスト: 自分の手札から1枚)
  cost: { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の現場にいる[警視庁]のキャラを1枚まで選び、ターン終了時までAP＋3000し (短縮形 carrier + bind:'$picked' で次 step と共有)
      { kind: 'atom', verb: 'charModifyAP', args: { max: 1, side: 'self', filter: { trait: '警視庁' }, delta: 3000, scope: 'turn', bind: '$picked' } },
      // 「ターン終了時、このキャラを現場からデッキの下に移す。」を与える (endTurn consume → scene.toDeck bottom、リムーブでない)
      { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$picked.uid', key: 'toDeckBottomOnTurnEnd', val: true } },
    ],
  },
  description: '【宣言】【ターン1】〚手札を1枚リムーブする〛：自分の現場にいる〚特徴［警視庁］〛のキャラを1枚まで選び、ターン終了時までAP＋3000し、「ターン終了時、このキャラを現場からデッキの下に移す。」を与える。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md', 'rules/23-qa-disguise-cutin.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  // 【カットイン】AP＋2000 — コンタクト中の自分側キャラ ($contact.byUid) を contact scope で加算
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B07079P: CardDef = {
  id: 'B07079P',
  no: '0807/B07079P',
  kind: 'character',
  names: ['佐藤美和子＆宮本由美', '佐藤美和子', '宮本由美'],
  colors: ['黄'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'MRP',
  imageUrl: '1763546825813428.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
    'rules/23-qa-disguise-cutin.md',
  ],
};
