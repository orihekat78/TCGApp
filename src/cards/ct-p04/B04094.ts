// cards/ct-p04/B04094 ジン (character) — attribution mini-wave ① byPlayer opp-side 観測型 (2026-07-10)
// rules: 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【パートナー黒】【ターン1】自分の能力や効果によって相手の現場にいるキャラをリムーブしたとき、
//   ターン終了時までこのキャラは〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
// 公式Q&A (character.tsv B04094):
//   Q: 相手の現場のキャラをコンタクトによってリムーブしたとき発動? A: いいえ。コンタクトによるリムーブでは発動しない。
//   Q: 同じカードが複数現場にいる場合すべて同時に発動? A: はい。好きな順で解決。
//
// 句マッピング:
//   - 【パートナー黒】=> condition partnerColor{黒} (rules/17)。
//   - 【ターン1】=> limit{turn,1} (rules/17)。
//   ※ B04089/B04091 と異なり【自分ターン中】が **無い** ため turn{self} は付けない (相手ターン中の自効果除去でも発火)。
//   - 自分の能力や効果によって相手の現場にいるキャラをリムーブしたとき
//       => trigger{hook:'leave:to-remove'} + condition removedCharMatches{side:'opp',cause:'effect',byPlayer:'self'}。
//       byPlayer:'self' = 効果 owner=自分 (cond/eval.ts:731、emit=mutate/scene.ts:334)。cause:'effect' 併記=DSL 規約。
//       コンタクト由来 (cause:'contact-ap') は非発火 = Q&A と整合。
//   - ターン終了時までこのキャラは〚突撃〛を持つ => charGrantKeyword{uid:'$self', kw:'突撃', scope:'turn'} (D08005 idiom, rules/13)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
  },
  limit: { kind: 'turn', n: 1 },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'partnerColor', color: '黒' },
      { kind: 'removedCharMatches', side: 'opp', cause: 'effect', byPlayer: 'self' },
    ],
  },
  effect: {
    kind: 'atom',
    verb: 'charGrantKeyword',
    args: { uid: '$self', kw: '突撃', scope: 'turn' },
  },
  description:
    '【パートナー黒】【ターン1】自分の能力や効果によって相手の現場のキャラをリムーブしたとき、ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B04094: CardDef = {
  id: 'B04094',
  no: '0476/B04094',
  kind: 'character',
  names: ['ジン'],
  colors: ['黒'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287841331725.jpg',
  abilities: [a1],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
