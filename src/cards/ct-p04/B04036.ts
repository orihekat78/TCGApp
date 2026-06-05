// cards/ct-p04/B04036 鈴木史郎 (キャラ) — catalog-reuse batch
// rules: 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】カードを1枚引く。この能力は自分の現場に〚特徴［鈴木財閥］〛のキャラが3枚以上いる場合に宣言できる。
//
// a1: declared — 【ターン1】 / 現場(自)に[鈴木財閥]が3枚以上の場合に宣言可 (sceneHas nMin:3 gate); カードを1枚引く
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 自分の現場に[鈴木財閥]のキャラが3枚以上いる場合に宣言できる
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '鈴木財閥' } }, nMin: 3 },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【宣言】【ターン1】カードを1枚引く。現場の[鈴木財閥]が3枚以上のとき宣言可。',
  ruleRefs: ['rules/21-declared-ability-cost.md', 'rules/17-icons.md'],
};

export const B04036: CardDef = {
  id: 'B04036',
  no: '0434/B04036',
  kind: 'character',
  names: ['鈴木史郎'],
  colors: ['白'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['鈴木財閥'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287759495027.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
