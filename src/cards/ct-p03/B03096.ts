// cards/ct-p03/B03096 目暮十三 (キャラ) — engine-extension reasoning-hook batch #3 (2026-06-06 タスクC)
// rules: 11-reasoning.md, 13-keywords.md (§捜査X), 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【ターン1】自分の現場にいるキャラが推理したとき、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、
//     好きな順番でデッキの下に移す）する。レベル8以上のカードが発見された場合、カードを1枚引く。
//
// a1: 推理反応 (reasoning:after-sleep, 非 selfOnly = 自分の現場の任意キャラ)。
//   matcherCondition triggerCharMatches{side:'self'} (filter 無し = 自分側の任意キャラ) + 【ターン1】= limit turn:1。
//   〚捜査1〛 = souza{player:'opp', x:1, bind:'$found'}。公開札を相手がデッキ下へ移し終えてから
//     後続を再開する。レベル8以上が発見された場合 = boundAnyMatchesFilter(levelMin:8) で自分が1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  trigger: {
    hook: 'reasoning:after-sleep',
    // 自分の現場にいるキャラが推理したとき (filter 無し = 自分側の任意キャラ、rules/11)
    // BUG-179: filter:{} で scene 走査を強制 (無いと自パートナーの推理でも誤発火。印字は「現場にいるキャラ」)。
    matcherCondition: { kind: 'triggerCharMatches', side: 'self', filter: {} },
  },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'souza', args: { player: 'opp', x: 1, bind: '$found' } },
      // レベル8以上のカードが発見された場合、自分はカードを1枚引く (必須)
      {
        kind: 'conditional',
        if: { kind: 'boundAnyMatchesFilter', bindKey: '$found', filter: { levelMin: 8 } },
        then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【ターン1】自分の現場のキャラが推理したとき、捜査1 (相手デッキ上1枚を公開しデッキ下へ)。レベル8以上が発見されたら自分は1枚引く。',
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};

// a2: 【ヒラメキ】カードを1枚引く (BUG-140 補修 2026-06-13: TSV hirameki 列の取りこぼし修正) — D03011 a2 同型
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // カードを1枚引く
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B03096: CardDef = {
  id: 'B03096',
  no: '0349/B03096',
  kind: 'character',
  names: ['目暮十三'],
  colors: ['黄'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133463275783.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
