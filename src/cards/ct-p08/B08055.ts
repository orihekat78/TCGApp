// cards/ct-p08/B08055 本堂瑛海 (キャラ) — カットイン実装 (BUG-114, 2026-06-07)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト(カットイン): 【カットイン】【自分ターン中】手札からキャラを1枚リムーブしてもよい。
//   そうした場合、リムーブしたキャラのAP1000につき、AP＋1000（自分のターンのコンタクト中に手札からリムーブして使う）
//
// BUG-114 で追加した discard-bind dyn primitive (discard{bind, filter} + $discarded.ap) で engine変更0 化。
// 「AP1000につきAP+1000」= floor(AP/1000)*1000。全キャラ AP は 1000 の倍数なので $discarded.ap がそのまま該当値。
// chain: step1 discard{max:1, filter:{kind:'character'}, bind:'$discarded'} → step2 charModifyAP
//   delta:{dyn:'$discarded.ap'} (そうした場合 = discard 適用時のみ continuation 実行)。
//   B08055P (絵柄違い) は本 abilities を spread 継承。
import type { CardDef, AbilityDef } from '@/engine/types';

const cutin: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  condition: { kind: 'turn', player: 'self' },
  description:
    '【カットイン】【自分ターン中】手札からキャラを1枚リムーブしてもよい。そうした場合、リムーブしたキャラのAP1000につき、AP＋1000',
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { kind: 'character' }, bind: '$discarded' } },
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: { dyn: '$discarded.ap' }, scope: 'contact' } },
    ],
  },
};

export const B08055: CardDef = {
  id: 'B08055',
  no: '0893/B08055',
  kind: 'character',
  names: ['本堂瑛海'],
  colors: ['赤'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['CIA'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1770731238650353.jpg',
  abilities: [cutin],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
