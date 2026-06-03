// cards/ct-d11/D11016 大江忍 (キャラ・ガード反撃)
// rules: 03-field-areas.md, 07-action-flow.md, 08-contact.md, 15-abilities-effects.md, 17-icons.md
// spec: .claude/specs/cards-analysis/D11016.md
//
// 公式テキスト:
//   【相手ターン中】【ターン1】このキャラが指定されたアクションをガードしたとき、
//     ガードしたキャラをアクティブにし、ターン終了時までAP＋2000する。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'opp' },
  limit: { kind: 'turn', n: 1 },
  trigger: {
    hook: 'action:guarded',
    // このキャラがガードしたとき (payload.guardUid === 自分) のみ発火 (rules/07、BUG-097)。
    // matcher closure は card.uid を参照不可のため matcherCondition で declarative に自己判定。
    matcherCondition: { kind: 'guardedBySelf' },
  },
  effect: {
    kind: 'sequence',
    steps: [
      // ガードしたキャラをアクティブにし
      { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
      // ターン終了時までAP＋2000する
      { kind: 'atom', verb: 'charModifyAP',  args: { uid: '$self', delta: 2000, scope: 'turn' } },
    ],
  },
  description: '【相手ターン中】【ターン1】ガードしたとき、ガードしたキャラをアクティブにしAP＋2000。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/08-contact.md', 'rules/15-abilities-effects.md'],
};

export const D11016: CardDef = {
  id: 'D11016',
  no: '0710/D11016',
  kind: 'character',
  names: ['大江忍'], colors: ['黄'],
  level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [],
  rarity: 'D', imageUrl: '1775608977366672.jpg',
  abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/07-action-flow.md', 'rules/08-contact.md', 'rules/17-icons.md'],
};
