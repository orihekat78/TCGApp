// cards/ct-p05/B05050 大上祝善 (キャラ) — Task D batch (2026-06-12)
// rules: 03-field-areas.md, 10-action-event.md, 12-next-hint.md, 14-refresh.md, 15-abilities-effects.md, 25-qa-effects-resolution.md
//
// 公式テキスト:
//   自分のFILEエリアにあるカードを手札に加えたとき、自分のリムーブエリアにある〚特徴［探偵］〛のキャラを1枚まで選び、
//     手札に加えてもよい。カードを手札に加えた場合、このキャラをリムーブする。
//     （ネクストヒントで手札に加えた場合、カードを使用してから効果を解決する）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 句マッピング:
//   - 自分のFILEエリアにあるカードを手札に加えたとき => trigger{hook:'file:pop', matcherCondition:{kind:'triggerPlayerIs',side:'self'}}
//     (Task D E3 新 hook。emit 元 = next-hint.ts (ネクストヒント手順1) + filePopToHand atom (B04068 等の効果)。
//     payload にキャラ uid が無いため triggerCharMatches でなく triggerPlayerIs で「自分の FILE」を gate)
//   - リムーブエリアにある〚特徴［探偵］〛のキャラを1枚まで選び、手札に加えてもよい =>
//     optional{chain[handAddFromRemove{player:'self',max:1,filter:{kind:'character',trait:'探偵'}}, …]}
//     (「してもよい」=optional rules/15 / 「1枚まで」=max:1 0枚可 / trait+kind filter は D08024 流儀)
//   - カードを手札に加えた場合、このキャラをリムーブする => chain step2 sceneRemove{uid:'$self',cause:'effect'}
//     (step1 で加えなかった場合 (pick skip / 候補0) は chain break で実行されない。「〜する」=必須 rules/15。B04023 step1 同 args)
//   - （ネクストヒントで手札に加えた場合、カードを使用してから効果を解決する） => engine の未解決効果 queue が担保
//     (rules/12 ネクストヒント中の割込み禁止 + rules/15 未解決効果。イベント先解決の公式Q&A は E3 spec の E2E 検証事項)
//   - 【ヒラメキ】カードを1枚引く => evidence:remove-by-action(optional) → draw1 (B02061 a2 同型)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分のFILEエリアにあるカードを手札に加えたとき (payload.player が自分側の file:pop のみ反応)
  trigger: { hook: 'file:pop', matcherCondition: { kind: 'triggerPlayerIs', side: 'self' } },
  effect: {
    // 手札に加えてもよい (任意効果 rules/15)
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 自分のリムーブエリアにある〚特徴［探偵］〛のキャラを1枚まで選び、手札に加える (skip/候補0 → 以降解決せず)
        { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '探偵' } } },
        // カードを手札に加えた場合、このキャラをリムーブする (必須。rules/15「〜する」)
        { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } },
      ],
    },
  },
  description:
    '自分のFILEエリアにあるカードを手札に加えたとき、自分のリムーブエリアにある〚特徴［探偵］〛のキャラを1枚まで選び、手札に加えてもよい。カードを手札に加えた場合、このキャラをリムーブする。（ネクストヒントで手札に加えた場合、カードを使用してから効果を解決する）',
  ruleRefs: ['rules/03-field-areas.md', 'rules/12-next-hint.md', 'rules/15-abilities-effects.md', 'rules/25-qa-effects-resolution.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B05050: CardDef = {
  id: 'B05050',
  no: '0552/B05050',
  kind: 'character',
  names: ['大上祝善'],
  colors: ['白'],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: ['探偵'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1746628061778146.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/12-next-hint.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
