// cards/ct-p05/B05079 世良真純 (character) — engine mega-wave W2 exemplar (opponentRestrict:'hirameki', 2026-07-03)
// rules: 10-action-event.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   〚突撃［事件］〛（登場したターンからすぐに事件を指定してアクションできる）
//   相手は【ヒラメキ】を発動できない。
//   【ヒラメキ】相手の裏向きの証拠を2つまで選び、表向きにする。
//
// keywords: 突撃[事件] は印字キーワード (keywords[]、flow/main/action.ts namedExceptionAllowed が honor)。
// a1: 「相手は【ヒラメキ】を発動できない」= continuous opponentRestrict:['hirameki'] (W2 新 token、
//     B02063 a1 opponentRestrict:['cutin'] の token 差替クローン、無条件・在場中常時)。
//     enforce = listeners/triggered.handleEvidenceRemovedHook の aura gate (rules/10、公式Q&A:
//     アクション[事件]で【ヒラメキ】持ちがリムーブされても発動不可・そのままリムーブエリアへ)。
// a2: 【ヒラメキ】= evidenceFlip pick 契約 (E3 出荷済): 相手の裏向き証拠 0..2 を表向き (「2つまで」=0可 rules/15)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: { opponentRestrict: ['hirameki'] },
  description: '相手は【ヒラメキ】を発動できない。',
  ruleRefs: ['rules/10-action-event.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】任意発動
  // 相手の裏向きの証拠を2つまで選び、表向きにする (faceDown:true = 裏向き限定 filter、B07064 同型・max 差替)
  effect: { kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', max: 2, faceDown: true } },
  description: '【ヒラメキ】相手の裏向きの証拠を2つまで選び、表向きにする。',
  ruleRefs: ['rules/01-victory-conditions.md', 'rules/10-action-event.md'],
};

export const B05079: CardDef = {
  id: 'B05079',
  no: '0579/B05079',
  kind: 'character',
  names: ['世良真純'],
  colors: ['赤'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['探偵', '高校生', '赤井家'],
  keywords: ['突撃[事件]'],
  rarity: 'C',
  imageUrl: '1745322226163161.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
