// cards/pr-01/PR085 沖矢昴 (キャラ) — evidence-self→hand micro-cluster (2026-06-21)
// rules: 03-field-areas.md, 07-action-flow.md, 10-action-event.md, 13-keywords.md (§ブレット),
//        14-refresh.md, 15-abilities-effects.md, 17-icons.md (§登場時/ターン終了時まで)
//
// 公式テキスト:
//   【登場時】キャラを1枚まで選び、ターン終了時まで〚ブレット〛（このキャラのアクションはガードできない）を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。
//
// 公式Q&A (pr-01 TSV): Q「このカードが相手のアクション［事件］によってリムーブされるとき、手札に加えず
//   そのままリムーブすることは可能ですか？」A「はい、可能です。【ヒラメキ】は発動させないことを選択できます」
//   → a2 hirameki は optional:true (発動 fire / 不発 skip は所有者選択、rules/10)。
//
// a1: 【登場時】(enter selfOnly)。「キャラを1枚まで選び、ターン終了時まで〚ブレット〛を与える」=
//     choice→charGrantKeyword{uid:'$pick', kw:'ブレット', scope:'turn'}。target pick = 現場どちらの
//     キャラでも (filter なし=「キャラ」全般、rules/15)、n{0..1}=「1枚まで」(0可)。exemplar D02013 a1
//     (choice→charGrantKeyword $pick+target、scope 'turn')。kw 'ブレット' は guard.ts:47 hasKeyword が
//     granted (turnEffects.grantedKeywords) を honor (read/char.ts:203)。括弧書きはブレットの説明注記。
// a2: 【ヒラメキ】(evidence:remove-by-action optional)。「このカードを手札に加える」= handAddFromRemove
//     fromSelf:true (engine拡張: source card = リムーブされた証拠カード自身を remove→手札)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【登場時】
  trigger: { hook: 'enter', selfOnly: true },
  // キャラを1枚まで選び、ターン終了時まで〚ブレット〛を与える
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$pick',
          kw: 'ブレット',
          scope: 'turn',
          target: {
            kind: 'pick',
            query: { area: 'scene', side: 'either' },
            n: { min: 0, max: 1 },
            chooser: 'self',
          },
        },
      },
    ],
  },
  description: '【登場時】キャラを1枚まで選び、ターン終了時まで〚ブレット〛を与える。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/13-keywords.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】証拠が action[事件] でリムーブされたとき (任意発動)
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // このカードを手札に加える (source card = リムーブされた証拠自身を remove→手札)
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', fromSelf: true } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）このカードを手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const PR085: CardDef = {
  id: 'PR085',
  no: '0481/PR085',
  kind: 'character',
  names: ['沖矢昴'],
  colors: ['赤'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['大学院生'],
  keywords: [],
  rarity: 'PR',
  imageUrl: '1737462993152141.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
