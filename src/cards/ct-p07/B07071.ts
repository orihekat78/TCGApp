// cards/ct-p07/B07071 アンドレ・キャメル (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）
//   【自分ターン中】自分の手札が2枚以下の場合、このキャラをAP＋2000する。
//
// 〚突撃〛は無条件 → keywords:['突撃']。
// a1: 【自分ターン中】手札が2枚以下のとき このキャラを AP+2000 (continuous, 自己対象)。
//     手札枚数の declarative condition は無いため custom{check} で hand.length<=2 を厳密判定 (D11013 custom 同型, 推測補完ではない)。

import type { AbilityDef, CardDef, GameState, EffectCtx } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 【自分ターン中】かつ 自分の手札が2枚以下
  condition: {
    kind: 'and',
    cs: [
      { kind: 'turn', player: 'self' },
      { kind: 'custom', check: (s: GameState, ctx: EffectCtx) => { const p = ctx.source?.player; return p ? s.players[p].hand.length <= 2 : false; } },
    ],
  },
  // このキャラをAP＋2000する
  continuousModifier: { apDelta: 2000 },
  description: '【自分ターン中】自分の手札が2枚以下の場合、このキャラをAP＋2000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B07071: CardDef = {
  id: 'B07071',
  no: '0800/B07071',
  kind: 'character',
  names: ['アンドレ・キャメル'],
  colors: ['赤'],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: ['FBI'],
  keywords: ['突撃'],
  rarity: 'C',
  imageUrl: '1762414010670331.jpg',
  abilities: [a1],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
