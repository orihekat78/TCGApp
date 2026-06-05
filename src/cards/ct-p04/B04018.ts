// cards/ct-p04/B04018 遠山和葉 (キャラ) — engine#1 leave:to-remove batch #3 (a2 only)
// rules: 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   このキャラか〚カード名［服部平次］〛が自分の現場に登場したとき、相手の現場にいるキャラを
//     1枚まで選び、ターン終了時まで元の能力を無効にする。
//   【相手ターン中】【現場リムーブ時】カードを1枚引く。
//   【パートナー緑】【解決編】【宣言】【スリープ】〚手札を1枚リムーブする〛：
//     自分のリムーブエリアにあるレベル5以下の〚カード名［服部平次］〛を1枚まで選び、登場させる。
//
// a1: DEFERRED (enter self-or-cardname matcher + 元の能力無効化 charDisableOriginal turn-scope)
// a2: 【相手ターン中】【現場リムーブ時】カードを1枚引く (D03013 a1 同型)
// a3: DEFERRED (declared partnerColor + caseStatus + discardSelf cost + sceneEnter from remove with cardName filter)

import type { AbilityDef, CardDef } from '@/engine/types';

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【相手ターン中】【現場リムーブ時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B04018: CardDef = {
  id: 'B04018',
  no: '0419/B04018',
  kind: 'character',
  names: ['遠山和葉'],
  colors: ['緑'],
  level: 6, ap: 4000, lp: 1,
  traits: ['高校生'], keywords: [],
  rarity: 'R',
  imageUrl: '1735287737377960.jpg',
  abilities: [a2],
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
