// cards/ct-d11/D11015 目暮十三 (キャラ)
// rules: 05-turn-phases.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
// spec: .claude/specs/cards-analysis/D11015.md
//
// 公式テキスト:
//   このキャラがアクションしたとき、キャラを1枚まで選び、ターン終了時までAP＋1000する。
//   【登場時】相手の現場にキャラが3枚以上いる場合、ターン終了時までこのキャラは〚突撃［キャラ］〛を持つ。
//     相手の証拠が3つ以上ある場合、ターン終了時までこのキャラは〚突撃［事件］〛を持つ。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:declare', selfOnly: true },
  // キャラを1枚まで選び、ターン終了時までAP＋1000する
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, max: 1, side: 'either', scope: 'turn' } },
  description: 'このキャラがアクションしたとき、キャラを1枚まで選び、ターン終了時までAP＋1000。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/05-turn-phases.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // 相手の現場にキャラが3枚以上いる場合、ターン終了時まで〚突撃［キャラ］〛を持つ
      {
        kind: 'conditional',
        if: { kind: 'sceneHas', query: { area: 'scene', side: 'opp' }, nMin: 3 },
        then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } },
      },
      // 相手の証拠が3つ以上ある場合、ターン終了時まで〚突撃［事件］〛を持つ
      {
        kind: 'conditional',
        if: { kind: 'evidenceAtLeast', player: 'opp', n: 3 },
        then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[事件]', scope: 'turn' } },
      },
    ],
  },
  description: '【登場時】相手現場3枚以上で〚突撃[キャラ]〛、相手証拠3つ以上で〚突撃[事件]〛 (ターン終了まで)。',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

export const D11015: CardDef = {
  id: 'D11015',
  no: '0942/D11015',
  kind: 'character',
  names: ['目暮十三'], colors: ['黄'],
  level: 5, ap: 5000, lp: 1,
  traits: ['警察', '警視庁'], keywords: [],
  rarity: 'D', imageUrl: '1775608977356431.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/05-turn-phases.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
