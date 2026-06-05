// cards/ct-p09/B09064 本堂瑛海 (キャラ) — catalog-reuse batch
// rules: 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合、このキャラは〚突撃［キャラ］〛（名乗り状態でもアクション［キャラ］できる）を持つ。
//   【パートナー赤】【登場時】〚痕跡［未発見］〛の場合、相手のデッキのカードを上から4枚リムーブする。
//
// a1: 痕跡発見済 continuous grantKeywords 突撃［キャラ］ (scratchTrace) — B09094 a2 同型
// a2: 【パートナー赤】【登場時】痕跡未発見なら 相手デッキ上 4 mill — B09094 a3 同型 + partnerColor gate

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  // 〚痕跡［発見済み］〛(engine 値は '発見済')
  condition: { kind: 'scratchTrace', player: 'self', v: '発見済' },
  // このキャラは〚突撃［キャラ］〛を持つ (engine action gate は ASCII 角括弧 '突撃[キャラ]' を参照 — B09094/D11015 functional 形と一致させる)
  continuousModifier: { grantKeywords: () => ['突撃[キャラ]'] },
  description: '〚痕跡［発見済み］〛の場合、このキャラは〚突撃［キャラ］〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【パートナー赤】= 自分のパートナーが赤を持つ (条件を満たさない場合この能力を持たない扱い rules/17)
  condition: { kind: 'partnerColor', color: '赤' },
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    // 〚痕跡［未発見］〛の場合
    if: { kind: 'scratchTrace', player: 'self', v: '未発見' },
    // 相手のデッキのカードを上から4枚リムーブする
    then: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 4 } },
  },
  description: '【パートナー赤】【登場時】〚痕跡［未発見］〛の場合、相手のデッキのカードを上から4枚リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B09064: CardDef = {
  id: 'B09064',
  no: '1006/B09064',
  kind: 'character',
  names: ['本堂瑛海'],
  colors: ['赤'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['CIA'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608872858835.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
