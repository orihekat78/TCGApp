// cards/ct-p07/B07047 中森銀三 (character) — 赤魔術 trait family残 (engine変更0)
// rules: 03-field-areas.md, 10-action-event.md, 13-keywords.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【事件赤魔術】〚突撃〛（登場したターンからすぐにアクションできる）
//   【登場時】自分のデッキのカードを上から1枚裏向きでこのキャラにセットする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 公式Q&A: 【事件赤魔術】= 自分の事件が特徴［赤魔術］を持つ場合に有効。
//
// 句マッピング (certify: equivalent / high — 全句 certified exemplar と意味等価):
//   - a1 【事件赤魔術】〚突撃〛 = caseTraitConditioned({trait:'赤魔術', inner: continuous grantKeywords ['突撃']})
//     (B07052 a1 完全同型)。事件が赤魔術 trait を持つ間のみ突撃 (rules/24 常時有効 / rules/17 条件未達=非所持)。
//   - a2 【登場時】このキャラにデッキ上端を裏向きセット = charSetCard{uid:'$self', fromDeckTop:true, faceUp:false}
//     (B08054 a2 完全同型: uid:'$self' = 登場したこのキャラ自身。
//      B02023 の PA短縮形「キャラ1枚まで選び」とは別物 — こちらは「このキャラ」=$self)。
//   - a3 【ヒラメキ】キャラを1枚までスリープ = sceneSetState{sleep, pick scene either n:0-1} (D01012 a2 完全同型)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseTraitConditioned } from '@/cards/_shared';

// a1: 【事件赤魔術】〚突撃〛 — 事件が[赤魔術]を持つ間だけ continuous で突撃を付与。
const a1: AbilityDef = caseTraitConditioned({
  trait: '赤魔術',
  inner: {
    id: 'a1',
    type: 'continuous',
    scope: 'on-scene',
    continuousModifier: { grantKeywords: () => ['突撃'] },
    description: '〚突撃〛（登場したターンからすぐにアクションできる）',
    ruleRefs: ['rules/13-keywords.md', 'rules/24-qa-naming-stun.md'],
  },
});

// a2: 【登場時】自分のデッキ上端を裏向きでこのキャラ自身にセット (B08054 a2 同型 charSetCard $self)。
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false, player: 'self' } },
  description: '【登場時】自分のデッキ上端を裏向きでこのキャラにセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

// a3: 【ヒラメキ】キャラを1枚まで選び、スリープさせる (D01012 a2 同型 hirameki char-pick)。
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B07047: CardDef = {
  id: 'B07047',
  no: '0776/B07047',
  kind: 'character',
  names: ['中森銀三'],
  colors: ['白'],
  level: 6,
  ap: 5000,
  lp: 0,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762413994306516.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
