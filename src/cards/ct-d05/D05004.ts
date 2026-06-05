// cards/ct-d05/D05004 降谷零 (キャラ) — catalog-reuse batch
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【登場時】相手は手札を公開する。（その後、元に戻す）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// a1: 【登場時】相手は手札を公開し、その後元に戻す = 盤面状態変化なし (reveal→restore は no-op)。
//     公式テキストの全 clause を log atom で忠実に表現 (state mutation を要しない情報公開)。
// a2: 【ヒラメキ】evidence:remove-by-action で1ドロー — D08013 a2 同型

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  // 相手は手札を公開する。（その後、元に戻す） — 状態変化を伴わない情報公開を log に記録
  effect: { kind: 'atom', verb: 'log', args: { player: 'opp', action: 'reveal-hand', result: '相手は手札を公開する（その後、元に戻す）' } },
  description: '【登場時】相手は手札を公開する。（その後、元に戻す）',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
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

export const D05004: CardDef = {
  id: 'D05004',
  no: '0149/D05004',
  kind: 'character',
  names: ['降谷零'],
  colors: ['黄'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['警察', '公安'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013167782437.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
