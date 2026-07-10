// cards/pr-01/PR234 毛利蘭 (character) — M2 latter batch (charSetCard faceUp honor + area 配列 union + setcard:leave→handAddFromRemove, 2026-07-10)
// rules: 13-keywords.md (突撃), 15-abilities-effects.md, 16-card-set.md, 17-icons.md
//
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）
//   【登場時】自分の手札かリムーブエリアにある〚カード名［シャッフルロマンス］〛のイベントを1枚まで選び、
//     自分の現場にいるキャラ1枚にセットする。
//   【相手ターン中】【ターン1】自分の現場にいるキャラに表向きでセットされていた〚カード名［シャッフルロマンス］〛が
//     リムーブエリアに置かれたとき、その中から1枚を手札に加えてもよい。
// 公式Q&A:
//   - a1 でセットしても《シャッフルロマンス/0019》使用時の効果 (5枚見る…) は行えない (セット≠使用)。
//   - a2 は「効果によるセットカードのリムーブ」「セットされているキャラの現場離脱」でリムーブエリアに
//     置かれたときに発動する。
//
// 句マッピング (grounding dossier .tmp/_ground/PR234.md):
//   - a1 = sequence[ bindPick host (自分の現場のキャラ1枚、bind:'host'),
//       charSetCard{uid:'$host.uid', cardIds:'$pick.cardIds', faceUp:true,
//         target: pick area:['hand','remove'] (hand∪remove union、M2 latter P15) filter cardName+kind:event, 0..1} ]
//     「表向きでセットする」原文は「セットする」だが a2 の「表向きでセットされていた」参照と Q&A 整合のため
//     faceUp:true (M2 latter P6 — cardIds branch は faceUp:true 明示時のみ表向き)。「1枚まで」= 0枚可 (rules/15)。
//   - a2 = trigger setcard:leave + matcherCondition and[triggerPlayerIs self (自分の現場のキャラ),
//       setCardMatches{cardName} (表向き gate は setCardMatches 自体が faceUp===true を要求 — cond/eval.ts)]
//     + condition turn:opp (【相手ターン中】) + limit turn1 (【ターン1】)
//     + effect optional{handAddFromRemove target:'$trigger.setCardId'} (「〜してもよい」rules/15、
//       「その中から1枚」= per-occurrence emit の当該カード。M2 latter P7 resolveBindRef)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true }, // 【登場時】
  effect: {
    kind: 'sequence',
    steps: [
      // 自分の現場にいるキャラ1枚 (セット先 host。bind:'host' — B08035 a1 同型の pick-only atom)
      { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'self', bind: 'host', max: 1 } },
      // 手札かリムーブエリアの〚カード名[シャッフルロマンス]〛イベントを1枚まで選び、host へ表向きセット
      {
        kind: 'atom',
        verb: 'charSetCard',
        args: {
          uid: '$host.uid',
          cardIds: '$pick.cardIds',
          faceUp: true,
          target: {
            kind: 'pick',
            // area 順 = ['remove','hand'] (edge lens BLOCK 2026-07-10): 同一 cardId が両 zone 併存時、
            // splice は配列順の先着 zone から消費するため remove 先 = 所有者有利側に倒す (最小緩和)。
            // 恒久 fix (pick channel に zone 同梱) は DEFERRED-INDEX「M2 後半 batch nits」。
            query: { area: ['remove', 'hand'], side: 'self', filter: { cardName: 'シャッフルロマンス', kind: 'event' } },
            n: { min: 0, max: 1 }, // 「1枚まで」= 0枚可 (rules/15)
            chooser: 'self',
          },
        },
      },
    ],
  },
  description:
    '【登場時】自分の手札かリムーブエリアにある〚カード名［シャッフルロマンス］〛のイベントを1枚まで選び、自分の現場にいるキャラ1枚にセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'setcard:leave',
    // 自分の現場のキャラにセットされていた + 〚シャッフルロマンス〛+ 表向き
    // (setCardMatches は payload.faceUp===true を自身で gate — 裏向きは rules/16 で情報を持たない)
    matcherCondition: {
      kind: 'and',
      cs: [
        { kind: 'triggerPlayerIs', side: 'self' },
        { kind: 'setCardMatches', filter: { cardName: 'シャッフルロマンス' } },
      ],
    },
  },
  condition: { kind: 'turn', player: 'opp' }, // 【相手ターン中】
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  effect: {
    kind: 'optional', // 「〜してもよい」(rules/15)
    effect: {
      kind: 'atom',
      verb: 'handAddFromRemove',
      args: { player: 'self', target: '$trigger.setCardId' }, // 「その中から1枚」= 当該 set card
    },
  },
  description:
    '【相手ターン中】【ターン1】自分の現場にいるキャラに表向きでセットされていた〚カード名［シャッフルロマンス］〛がリムーブエリアに置かれたとき、その中から1枚を手札に加えてもよい。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};

export const PR234: CardDef = {
  id: 'PR234',
  no: '0932/PR234',
  kind: 'character',
  names: ['毛利蘭'],
  colors: ['青'],
  level: 7,
  ap: 5000,
  lp: 0,
  traits: ['高校生', '毛利探偵事務所', '空手家'],
  keywords: ['突撃'], // 〚突撃〛(rules/13 — 登場ターンからアクション可)
  rarity: 'PR',
  imageUrl: '1769159336078340.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md'],
};
