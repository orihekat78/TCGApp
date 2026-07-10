// cards/ct-d10/D10009 工藤新一 (character) — engine A1 wave exemplar (charStackCard scene-source, 2026-07-11)
// rules: 05-turn-phases.md (§エンドフェイズ), 13-keywords.md (§突撃[キャラ]), 15-abilities-effects.md,
//        16-card-set.md (§重ねる), 17-icons.md (§【事件(特徴)】【パートナー(色)】), 21-declared-ability-cost.md
//
// 公式テキスト:
//   自分のターン終了時、自分の現場に〚カード名［毛利蘭］〛がいない場合、このキャラをリムーブする。
//   【パートナー青】【登場時】AP8000以下のキャラを1枚まで選び、デッキの下に移す。
//   【事件シャッフルロマンス】【宣言】【ターン1】自分の現場にいる〚カード名［毛利蘭］〛を1枚まで選び、
//     このキャラの下に重ねる。重ねた場合、ターン終了時までこのキャラは〚突撃［キャラ］〛を持つ。
//
// 句マッピング:
//   - a0「自分のターン終了時、…〚毛利蘭〛がいない場合、このキャラをリムーブ」 =>
//       trigger{hook:'phase:end:start'} + condition and[turn:self, not(bond{毛利蘭})] + sceneRemove{uid:'$self'}。
//       bond は scene のみ判定 (rules/17) = 重なった[毛利蘭]は情報を持たず非該当 (公式Q&A と整合)。
//   - a1「【パートナー青】【登場時】AP8000以下を1枚まで選びデッキ下」 =>
//       trigger{hook:'enter', selfOnly:true} + condition partnerColor{青} + sceneToDeck 短縮形{apMax:8000, max:1}。
//   - a2「【事件シャッフルロマンス】【宣言】【ターン1】〚毛利蘭〛を1枚まで選びこのキャラの下に重ねる。
//       重ねた場合ターン終了時まで突撃[キャラ]」 => caseTraitConditioned(シャッフルロマンス) を declared+limit turn1 に付与。
//       effect = chain[ charStackCard fromScene 短縮形 (scene-source: pick した毛利蘭を host=$self の下へ、engine A1 新分岐),
//                       charGrantKeyword{uid:'$self', kw:'突撃[キャラ]', scope:'turn'} ]。
//       0枚 pick は chainStepNoApply → 「重ねた場合」の突撃付与を gate (rules/15)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { caseTraitConditioned } from '@/cards/_shared';

const a0: AbilityDef = {
  id: 'a0',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'phase:end:start' },
  // 自分のターン終了時 (turn:self) かつ 現場に〚毛利蘭〛がいない場合
  condition: { kind: 'and', cs: [{ kind: 'turn', player: 'self' }, { kind: 'not', c: { kind: 'bond', cardName: '毛利蘭' } }] },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self' } },
  description: '自分のターン終了時、自分の現場に〚カード名[毛利蘭]〛がいない場合、このキャラをリムーブする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'partnerColor', color: '青' },
  // AP8000以下のキャラを1枚まで選び、デッキの下に移す
  effect: { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'either', max: 1, pos: 'bottom', filter: { apMax: 8000 } } },
  description: '【パートナー青】【登場時】AP8000以下のキャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2Inner: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  effect: {
    kind: 'chain',
    steps: [
      // 自分の現場にいる〚毛利蘭〛を1枚まで選び、このキャラの下に重ねる (scene-source stack)
      { kind: 'atom', verb: 'charStackCard', args: { fromScene: true, player: 'self', max: 1, filter: { cardName: '毛利蘭' } } },
      // 重ねた場合、ターン終了時までこのキャラは〚突撃[キャラ]〛を持つ
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃[キャラ]', scope: 'turn' } },
    ],
  },
  description: '【宣言】【ターン1】自分の現場にいる〚カード名[毛利蘭]〛を1枚まで選び、このキャラの下に重ねる。重ねた場合、ターン終了時までこのキャラは〚突撃[キャラ]〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/16-card-set.md', 'rules/21-declared-ability-cost.md'],
};
const a2: AbilityDef = caseTraitConditioned({ trait: 'シャッフルロマンス', inner: a2Inner });

export const D10009: CardDef = {
  id: 'D10009',
  no: '0840/D10009',
  kind: 'character',
  names: ['工藤新一'],
  colors: ['青'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['探偵', '高校生'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1761913165292396.jpg',
  abilities: [a0, a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
