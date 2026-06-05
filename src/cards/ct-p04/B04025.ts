// cards/ct-p04/B04025 マロちゃん (キャラ・カットイン+ヒラメキ) — catalog-reuse batch
// rules: 09-cutin-disguise.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 19-special-rules.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   【カットイン】AP＋1000、〚カード名［綾小路文麿］〛のキャラに【カットイン】した場合、カードを1枚引く。（コンタクト中に手札からリムーブして使う）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［綾小路文麿］〛を1枚まで選び、手札に加える。
//
// a1: 【カットイン】コンタクト中の攻撃キャラ AP＋1000、相手が[綾小路文麿]なら 1ドロー
//     (B07009 / B06092 の contactTargetMatches 同型)
// a2: 【ヒラメキ】リムーブの[綾小路文麿]を1枚まで選び、手札に加える (D11012 a2 handAddFromRemove 同型)

import type { AbilityDef, CardDef } from '@/engine/types';
import { contactTargetMatches } from '../_shared/index.js';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true }, // 【カットイン】(コンタクト中に手札から使用)
  effect: {
    kind: 'sequence',
    steps: [
      // AP＋1000
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
      // [綾小路文麿]のキャラに【カットイン】した場合、カードを1枚引く
      { kind: 'conditional', if: contactTargetMatches({ names: ['綾小路文麿'] }), then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } },
    ],
  },
  description: '【カットイン】AP＋1000、[綾小路文麿]にカットインした場合カードを1枚引く。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/22-qa-action-contact.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動
  // 自分のリムーブエリアにある[綾小路文麿]を1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '綾小路文麿' } } },
  description: '【ヒラメキ】リムーブの[綾小路文麿]を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/19-special-rules.md'],
};

export const B04025: CardDef = {
  id: 'B04025',
  no: '0426/B04025',
  kind: 'character',
  names: ['マロちゃん'],
  colors: ['緑'],
  level: 2,
  ap: 1000,
  lp: 0,
  traits: ['シマリス'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287737418473.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
  ],
};
