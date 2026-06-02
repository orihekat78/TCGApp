// cards/ct-d08/D08007 吉田歩美 (キャラ)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md
// spec: .claude/specs/cards-analysis/D08007.md
//
// 公式テキスト:
//   【カットイン】【自分ターン中】自分の現場にいる〚特徴［少年探偵団］〛のキャラ1枚につき、AP＋1000
//
// G24 dyn 式で「現場の[少年探偵団]枚数 * 1000」を表現。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'turn', player: 'self' }, // 【自分ターン中】
  // 自分の現場の[少年探偵団]1枚につき、コンタクト中の攻撃キャラを AP＋1000
  // delta は object dyn 形 {dyn} で記述 (resolveDynArgs が評価)。$self.sceneTrait.<trait> は ctx.source.player の現場特徴数を state から算出。
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: { dyn: '$self.sceneTrait.少年探偵団 * 1000' }, scope: 'contact' } },
  description:
    '【カットイン】【自分ターン中】自分の現場の[少年探偵団]1枚につき、AP＋1000。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

export const D08007: CardDef = {
  id: 'D08007',
  no: '0491/D08007',
  kind: 'character',
  names: ['吉田歩美'],
  colors: ['青'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1743743093455670.jpg',
  abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};
