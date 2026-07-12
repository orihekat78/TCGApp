// cards/pr-01/PR279 萩原千速 (キャラ) — S2 保護系 wave (2026-07-11, opponentEventRestrict 初 consumer)
// rules: 03-field-areas.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   現場にいるこのキャラは相手のイベントの効果によってリムーブされない。
//   【パートナー黄】〚突撃〛（名乗り状態でもアクションできる）
//   【疾風】相手の裏向きの証拠を1つまで選び、表向きにする。（自分の現場にこのターンで1番に登場したときに発動する）
// 公式Q&A:
//   - イベントの効果で「選ぶ」ことは妨げられない (リムーブのみ block)。
//   - スリープ/スタン/デッキ下移動などリムーブ以外のイベント効果は通常通り受ける。
//   - イベントの【ヒラメキ】の効果によるリムーブも block される。
//   - 【疾風】は相手ターン中でも条件を満たせば発動する。
//
// 句マッピング:
//   a1: 「相手のイベントの効果によってリムーブされない」= continuousModifier.opponentEventRestrict:['remove']
//       (S2 wave 新設 — atomSceneRemove の相手発 gate が source def.kind==='event' のとき評価。
//        イベントの【ヒラメキ】は source.cardId = 証拠のイベントカードなので自然に該当)。
//   a2: 【パートナー黄】〚突撃〛 = partnerColorKeyword 共通クラス。
//   a3: 【疾風】= trigger{hook:'enter', selfOnly, matcherCondition enterOrderEquals 1} (D11014 正準形) +
//       evidenceFlip{player:'opp', max:1, faceDown:true} (B05079 の max:1 版 — 「相手の裏向きの証拠を
//       1つまで選び、表向きにする」)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  continuousModifier: {
    opponentEventRestrict: ['remove'],
  },
  description: '現場にいるこのキャラは相手のイベントの効果によってリムーブされない。',
  ruleRefs: ['rules/15-abilities-effects.md'],
};

const a2: AbilityDef = partnerColorKeyword({ color: '黄', kw: '突撃', abilityId: 'a2' });

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true,
    matcherCondition: { kind: 'enterOrderEquals', n: 1 },
  },
  effect: { kind: 'atom', verb: 'evidenceFlip', args: { player: 'opp', max: 1, faceDown: true } },
  description: '【疾風】相手の裏向きの証拠を1つまで選び、表向きにする。（自分の現場にこのターンで1番に登場したときに発動する）',
  ruleRefs: ['rules/17-icons.md'],
};

export const PR279: CardDef = {
  id: 'PR279',
  no: '1058/PR279',
  kind: 'character',
  names: ['萩原千速'],
  colors: ['黄'],
  level: 8,
  ap: 8000,
  lp: 1,
  traits: ['警察', '神奈川県警'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '19db98b484039.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
