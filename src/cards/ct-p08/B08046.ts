// cards/ct-p08/B08046 赤井秀一＆ジョディ・スターリング (character/MR) — M3 PA batch (2026-07-10)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/18-mr.md,
//        rules/19-special-rules.md, rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md,
//        rules/25-qa-effects-resolution.md
//
// 公式テキスト:
//   【パートナー赤】【宣言】【ターン1】レベル9以下のキャラを1枚まで選び、リムーブする。
//     この能力は自分の現場に〚特徴［FBI］〛のキャラが2枚以上いる場合に宣言できる。
//   【宣言】【ターン1】〚手札から特徴［FBI］のキャラを1枚リムーブする〛：カードを1枚引く。
//     この【宣言】能力のコストによってレベル8以上のキャラをリムーブした場合、カードを1枚引く。
//     この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// 句マッピング:
//   - MR => rarity:'MR'。複数名 (rules/19) => names ['赤井秀一＆ジョディ・スターリング','赤井秀一','ジョディ・スターリング']。
//   - a1「【パートナー赤】…この能力は自分の現場に〚特徴［FBI］〛のキャラが2枚以上いる場合に宣言できる」=>
//     condition and[partnerColor 赤, sceneHas{query scene/self/kind character/trait FBI, nMin:2}]
//     (B06003 a2 sceneHas / B08025 partnerColor と同型。公式Q&A: このキャラ自身も FBI に数える =
//     scene query は自身も走査ゆえ自動的に含む)。【ターン1】= limit turn1。
//   - a1「レベル9以下のキャラを1枚まで選び、リムーブする」=> sceneRemove{side:'either', max:1,
//     cause:'effect', filter:{levelMax:9}} (「キャラ」= 両現場 rules/15、「まで」= 0枚可)。
//   - a2「【宣言】【ターン1】〚手札から特徴［FBI］のキャラを1枚リムーブする〛」=> declared + limit turn1 +
//     cost removeFromHand{target pick hand/self filter{trait:FBI, kind:character}, n{1,1}}
//     (B03036 a2 同型。hand-pick は kind:'character' 明示 BUG-123)。
//   - a2「カードを1枚引く」=> draw n:1。
//   - a2「この【宣言】能力のコストによってレベル8以上のキャラをリムーブした場合、カードを1枚引く」=>
//     conditional{if: costRemovedMatches{key:'removeFromHand', filter:{levelMin:8}}, then: draw n:1}
//     (B08041 a2 costRemovedMatches 同型 — key 明示で ctx.costPaid['removeFromHand'] を読替え。
//     removeFromHand の costPaid level 記録 = attribution mini-wave 2026-07-10 で shipped)。
//   - a2「この能力はパートナーエリアでも宣言できる」=> scope:'on-partner-area' (B06003 a2 同型)。
//     a1 は PA 句なし → scope:'on-scene'。
//   - 【カットイン】AP＋2000 => a3 (D01011/B06003 a3 同型)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【パートナー赤】+ 自分の現場に〚特徴［FBI］〛のキャラが2枚以上いる場合
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '赤' },
      { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: 'FBI', kind: 'character' } }, nMin: 2 },
    ],
  },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // レベル9以下のキャラを1枚まで選び、リムーブする
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 9 } },
  },
  description:
    '【パートナー赤】【宣言】【ターン1】レベル9以下のキャラを1枚まで選び、リムーブする。この能力は自分の現場に〚特徴［FBI］〛のキャラが2枚以上いる場合に宣言できる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-partner-area',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 〚手札から特徴［FBI］のキャラを1枚リムーブする〛
  cost: { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { trait: 'FBI', kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  effect: {
    kind: 'sequence',
    steps: [
      // カードを1枚引く
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      // コストによってレベル8以上のキャラをリムーブした場合、カードを1枚引く
      {
        kind: 'conditional',
        if: { kind: 'costRemovedMatches', key: 'removeFromHand', filter: { levelMin: 8 } },
        then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【宣言】【ターン1】〚手札から特徴［FBI］のキャラを1枚リムーブする〛：カードを1枚引く。この【宣言】能力のコストによってレベル8以上のキャラをリムーブした場合、カードを1枚引く。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/21-declared-ability-cost.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const B08046: CardDef = {
  id: 'B08046',
  no: '0884/B08046',
  kind: 'character',
  names: ['赤井秀一＆ジョディ・スターリング', '赤井秀一', 'ジョディ・スターリング'],
  colors: ['赤'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['FBI', '赤井家'],
  keywords: [],
  rarity: 'MR',
  imageUrl: '1770731222634109.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
