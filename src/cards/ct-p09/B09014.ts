// cards/ct-p09/B09014 小嶋元太 (キャラ) — catalog-reuse batch
// rules: 03-field-areas.md, 07-action-flow.md, 08-contact.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【相手ターン中】【ターン1】このキャラがガードしたとき、自分の現場に〚カード名［小嶋元太］〛以外のレベル4の〚特徴［少年探偵団］〛のキャラがいる場合、ターン終了時までこのキャラをAP＋2000する。
//
// a1: triggered (action:guarded, guardedBySelf) — 【相手ターン中】【ターン1】ガード時、現場に[小嶋元太]以外のlvl4[少年探偵団]がいれば自身AP＋2000 (turn scope)。D11016 a1 + D08003 a2 conditional 同型。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  limit: { kind: 'turn', n: 1 },
  trigger: {
    hook: 'action:guarded',
    // このキャラがガードしたとき (payload.guardUid === 自分) のみ発火 (rules/07)。
    matcherCondition: { kind: 'guardedBySelf' },
  },
  effect: {
    kind: 'conditional',
    // 自分の現場に[小嶋元太]以外のレベル4[少年探偵団]がいる場合 (excludeSelf で自身=小嶋元太を除外)
    if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '少年探偵団', levelMin: 4, levelMax: 4 }, excludeSelf: true }, nMin: 1 },
    // ターン終了時までこのキャラをAP＋2000する。
    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 2000, scope: 'turn' } },
  },
  description: '【相手ターン中】【ターン1】ガード時、現場に[小嶋元太]以外のレベル4[少年探偵団]がいれば自身AP＋2000。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B09014: CardDef = {
  id: 'B09014',
  no: '0959/B09014',
  kind: 'character',
  names: ['小嶋元太'],
  colors: ['青'],
  level: 4,
  ap: 4000,
  lp: 0,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608818978386.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/17-icons.md',
  ],
};
