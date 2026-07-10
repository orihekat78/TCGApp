// cards/ct-p05/B05045 怪盗キッド＆黒羽快斗 (character, MR) — engine mega-wave W1 exemplar (handToFileBottom, 2026-07-03)
// rules: 05-turn-phases.md, 09-cutin-disguise.md, 12-next-hint.md, 18-mr.md, 19-special-rules.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー白】【宣言】【ターン1】〚デッキのカードを上から5枚リムーブする〛：
//   AP8000以下のキャラを1枚まで選び、デッキの下に移す。
//   【宣言】【ターン1】自分のFILEエリアにあるカードを上から1枚手札に加え、
//   手札を1枚FILEエリアにあるカードの1番下に表向きで移す。この能力はパートナーエリアでも宣言できる。
//   【カットイン】AP＋2000
//
// rules/19 複数名: 本カードは [怪盗キッド&黒羽快斗]/[怪盗キッド]/[黒羽快斗] 全ての分割名を持つ
//   (names 配列、B05049 のコスト公開・効果選択の両方に該当 = 公式Q&A B05049)。
// MR (rules/18): rarity 'MR' → read/def.isMR が MR能力①② を有効化 (mr-partner-area-core 配線済)。
// a1: 【パートナー白】condition + cost removeDeckTop n:5 (Q&A: 5枚ない場合は使用不可 rules/21) +
//     sceneToDeck 短縮形 {apMax:8000, max:1, side:'either', pos:'bottom'}。
// a2: chain[filePopToHand (アシストパートナー除外 = mutate.file.popTop 実装済、FILE0 は chain-break),
//     handToFileBottom (W1 新 verb、n:1 = 必須1枚、FILE 1番下=unshift 表向き)]。
//     ※「この能力はパートナーエリアでも宣言できる」は partial-impl (scope:'on-scene' のみ、
//       PA での宣言は Phase 4 card wave で scope 補正 — B05066 と同方針、BUG-154 / DEFERRED-INDEX)。
// a3: 【カットイン】AP+2000 (B05066 a3 同型、on-hand effect:declared → $contact.byUid)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  condition: { kind: 'partnerColor', color: '白' }, // 【パートナー白】
  cost: { kind: 'removeDeckTop', player: 'self', n: 5 }, // 〚デッキのカードを上から5枚リムーブする〛
  // AP8000以下のキャラを1枚まで選び、デッキの下に移す
  effect: { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'either', max: 1, pos: 'bottom', filter: { apMax: 8000 } } },
  description:
    '【パートナー白】【宣言】【ターン1】〚デッキのカードを上から5枚リムーブする〛：AP8000以下のキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: ['rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene', // 「パートナーエリアでも宣言できる」は partial (B05066 同方針、BUG-154)
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  effect: {
    kind: 'chain',
    steps: [
      // 自分のFILEエリアにあるカードを上から1枚手札に加え (アシストパートナー除外、FILE0 で chain-break)
      { kind: 'atom', verb: 'filePopToHand', args: { player: 'self' } },
      // 手札を1枚FILEエリアにあるカードの1番下に表向きで移す (必須1枚)
      { kind: 'atom', verb: 'handToFileBottom', args: { player: 'self', n: 1 } },
    ],
  },
  description:
    '【宣言】【ターン1】自分のFILEエリアにあるカードを上から1枚手札に加え、手札を1枚FILEエリアにあるカードの1番下に表向きで移す。この能力はパートナーエリアでも宣言できる。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/12-next-hint.md', 'rules/18-mr.md', 'rules/21-declared-ability-cost.md'],
};

// 【カットイン】AP+2000 (B05066 a3 同型)
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP+2000',
  ruleRefs: ['rules/09-cutin-disguise.md'],
};

export const B05045: CardDef = {
  id: 'B05045',
  no: '0547/B05045',
  kind: 'character',
  names: ['怪盗キッド＆黒羽快斗', '怪盗キッド', '黒羽快斗'], // rules/19 分割名 (全角＆慣行)
  colors: ['白'],
  level: 9,
  ap: 8000,
  lp: 2,
  traits: ['怪盗', '高校生', 'マジシャン'],
  keywords: [],
  rarity: 'MR', // rules/18 MR能力①② (read/def.isMR が rarity を消費)
  imageUrl: '1742972384120295.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/09-cutin-disguise.md',
    'rules/12-next-hint.md',
    'rules/18-mr.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md',
  ],
};
