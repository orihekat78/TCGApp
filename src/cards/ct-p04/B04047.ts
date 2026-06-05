// cards/ct-p04/B04047 世良真純 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【パートナー赤】【宣言】【ターン1】【スリープ】：レベル8以下のキャラを1枚まで選び、リムーブする。
//     この能力は自分のFILEエリアにあるカードが5枚以下の場合に宣言できる。
//
// a1: declared — 【パートナー赤】かつ FILE5枚以下 (not(fileAtLeast 6)) で宣言可 / コスト【スリープ】(sleepSelf);
//     レベル8以下のキャラを1枚まで選びリムーブ (sceneRemove levelMax:8, side:either)
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 【パートナー赤】かつ 自分のFILEが5枚以下 (= 6枚以上でない) の場合に宣言できる
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '赤' }, { kind: 'not', c: { kind: 'fileAtLeast', n: 6 } }] },
  // 【スリープ】コスト (このキャラ自身をスリープ)
  cost: { kind: 'sleepSelf' },
  // レベル8以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 8 } } },
  description: '【パートナー赤】【宣言】【ターン1】【スリープ】: レベル8以下を1枚までリムーブ (FILE5枚以下で宣言可)。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/17-icons.md', 'rules/15-abilities-effects.md'],
};

export const B04047: CardDef = {
  id: 'B04047',
  no: '0439/B04047',
  kind: 'character',
  names: ['世良真純'],
  colors: ['赤'],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: ['探偵', '高校生', '赤井家'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1735287781716328.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
