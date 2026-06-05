// cards/ct-p01/B01032 服部平次 (キャラ) — catalog-reuse batch
// rules: 05-turn-phases.md, 07-action-flow.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【ターン1】このキャラがアクション［キャラ］したとき、ターン終了時までこのキャラをAP+1000する。
//
// a1: action:declare hook (selfOnly) + matcher で target.kind==='char' に限定 (アクション[キャラ]時のみ)。
//     limit turn 1。効果は自身を AP+1000 (turn scope)。D11015 a1 / D08005 同型 atom。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // このキャラがアクション［キャラ］したとき (target.kind==='char' でゲート)
  trigger: {
    hook: 'action:declare',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => {
      if (!p || typeof p !== 'object') return false;
      const t = (p as { target?: { kind?: unknown } }).target;
      return !!t && t.kind === 'char';
    },
  },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // ターン終了時までこのキャラをAP+1000する
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
  description:
    '【ターン1】このキャラがアクション［キャラ］したとき、ターン終了時までこのキャラをAP+1000する。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B01032: CardDef = {
  id: 'B01032',
  no: '0026/B01032',
  kind: 'character',
  names: ['服部平次'],
  colors: ['緑'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1714013001002721.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
