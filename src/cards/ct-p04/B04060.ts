// cards/ct-p04/B04060 メアリー (キャラ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 10-action-event.md, 14-refresh.md, 17-icons.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【カットイン】〚特徴［赤井家］〛のキャラに【カットイン】する場合、AP＋2000（コンタクト中に手札からリムーブして使う）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【カットイン】on-hand (effect:declared) — コンタクト相手が[赤井家]の場合のみ攻撃キャラを AP＋2000
//     (conditional if:contactTargetMatches(traits:[赤井家]); B06092 同型)
// a2: 【ヒラメキ】証拠が action[事件] でリムーブされた時に発動、1ドロー (D08013 a2 同型)
import type { AbilityDef, CardDef } from '@/engine/types';
import { contactTargetMatches } from '../_shared/index.js';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  // [赤井家]のキャラに【カットイン】する場合、コンタクト中の攻撃キャラを AP＋2000
  effect: {
    kind: 'conditional',
    if: contactTargetMatches({ traits: ['赤井家'] }),
    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  },
  description: '【カットイン】[赤井家]に【カットイン】する場合、AP＋2000。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】(証拠からリムーブされるときに発動 / 任意発動)
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B04060: CardDef = {
  id: 'B04060',
  no: '0451/B04060',
  kind: 'character',
  names: ['メアリー'],
  colors: ['赤'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['赤井家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287801260494.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};
