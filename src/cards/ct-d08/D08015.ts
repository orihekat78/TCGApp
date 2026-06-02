// cards/ct-d08/D08015 小嶋元太 (キャラ)
// rules: 09-cutin-disguise.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
// spec: .claude/specs/cards-analysis/D08015-workflow.md
//
// 公式テキスト:
//   【登場時】カードを1枚引き、手札を1枚リムーブする。
//   【カットイン】AP＋1000
//
// a1: enter trigger → 1ドロー → 手札1リム
//     物理動作 atom を順に並べるだけ。pick query は engine が verb 既定で推論。
// a2: 【カットイン】AP＋1000 (inline — 旧 cutinFixedAP factory を展開)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // カードを1枚引く
      { kind: 'atom', verb: 'draw',    args: { player: 'self', n: 1 } },
      // 手札を1枚選びリムーブする
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【登場時】カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

// a2: 【カットイン】AP＋1000 — コンタクト中の攻撃キャラ ($contact.byUid) を contact scope で加算
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const D08015: CardDef = {
  id: 'D08015',
  no: '0495/D08015',
  kind: 'character',
  names: ['小嶋元太'],
  colors: ['青'],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743093493248.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
