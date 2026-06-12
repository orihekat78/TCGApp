// cards/ct-p03/B03096 目暮十三 (キャラ) — engine-extension reasoning-hook batch #3 (2026-06-06 タスクC)
// rules: 11-reasoning.md, 13-keywords.md (§捜査X), 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【ターン1】自分の現場にいるキャラが推理したとき、〚捜査1〛（相手はデッキのカードを上から指定の数だけ公開し、
//     好きな順番でデッキの下に移す）する。レベル8以上のカードが発見された場合、カードを1枚引く。
//
// a1: 推理反応 (reasoning:end, 非 selfOnly = 自分の現場の任意キャラ)。
//   matcherCondition triggerCharMatches{side:'self'} (filter 無し = 自分側の任意キャラ) + 【ターン1】= limit turn:1。
//   〚捜査1〛 = 相手デッキ上 1 枚を公開し、デッキの下へ移す:
//     souza atom は「発見された」カードを bind/参照できない (atom-handlers.ts §souza「発見された参照は scope 外」)
//     ため、deck-look-N (B01017/D01013 同型) で代替する。deckRevealUntil(player:'opp', maxN:1) で相手デッキ上 1 枚を
//     公開 (levelMin:8 に該当すれば $found に bind、残りを $rest)、deckToBottomBound で $found/$rest をデッキ下へ。
//   レベル8以上が発見された場合 = $found が matched → conditional で自分が1枚引く (必須効果「引く」)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  trigger: {
    hook: 'reasoning:end',
    // 自分の現場にいるキャラが推理したとき (filter 無し = 自分側の任意キャラ、rules/11)
    matcherCondition: { kind: 'triggerCharMatches', side: 'self' },
  },
  effect: {
    kind: 'sequence',
    steps: [
      // 〚捜査1〛: 相手デッキ上 1 枚を公開。レベル8以上なら $found に bind、残りを $rest に
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { player: 'opp', maxN: 1, filter: { levelMin: 8 }, bind: '$rest', bindMatch: '$found' },
      },
      // レベル8以上のカードが発見された場合、自分はカードを1枚引く (必須)
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$found', presence: 'matched' },
        then: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      },
      // 公開したカードをデッキの下へ ($found / $rest のいずれかに 1 枚、もう一方は空 = no-op)
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'opp', bindKey: '$found' } },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'opp', bindKey: '$rest' } },
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
