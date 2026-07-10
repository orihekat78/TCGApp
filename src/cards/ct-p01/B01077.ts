// cards/ct-p01/B01077 「赤井…秀一!?」 (event) — DEFER解禁 (atomDiscardRandom, 2026-07-11, engine変更0)
// rules: 10-action-event.md, 13-keywords.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト:
//   【パートナー赤】相手は手札を1枚ランダムにリムーブする。キャラを1枚まで選び、ターン終了時まで〚ブレット〛（このキャラのアクションはガードできない）を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）相手は手札を1枚リムーブする。
// 公式Q&A (event.tsv qAndA):
//   - 「ランダムにリムーブ」= 相手が選べず確率均等 (シャッフルして裏向き選択 / サイコロ等)
//       => discardRandom {player:'opp', n:1} (pick 無し。atom-handlers/core.ts:181)。相手選択型 discard と別 verb。
//   - 使用時に相手の手札が0枚でも、キャラを選んでブレットを与えられる (実行できる効果を解決)
//       => 2文を sequence (ungated) で並べる (chain だと step1 no-op が step2 を break しうるが、
//          discardRandom は k<=0 でも chainStepNoApply を立てないので実害は無い。ただし語義上 2文は独立ゆえ sequence が正)。
//
// 句マッピング:
//   - 本体: 「赤井…秀一!?」/ event / 赤 / Lv4 => CardDef kind:'event', colors:['赤'], level:4, traits:[]
//     (event はカード名に & / 『』/ ( ) を含まないため names 分割なし、rules/19)。
//   - a1 = event 本体効果 (type:'triggered' scope:'on-hand' trigger effect:declared + event-use matcher、B01057 a1 同型):
//     - 【パートナー赤】 => condition {kind:'partnerColor', color:'赤'} (rules/17: 未成立=何も効果のないイベント扱い。B03116 同型)。
//     - 相手は手札を1枚ランダムにリムーブする => atom discardRandom {player:'opp', n:1} (ランダム=pick無し)。
//     - キャラを1枚まで選び、ターン終了時まで〚ブレット〛を与える
//         => choice{chooser:'self', options:[atom charGrantKeyword {uid:'$pick', kw:'ブレット', scope:'turn',
//            target: pick(area:'scene', side:'either', n:0-1, chooser:'self')}]} (D02013 a1 / D10020 a1 の 突撃→ブレット 差替)。
//            「1枚まで」= n.min:0 (0枚可、rules/15) / 「キャラ」= side 指定なし = either + 自身も可 (rules/15)。
//            ターン終了時まで = scope:'turn' (clearTurnEffects で失効)。ブレット は guard.ts:47 hasKeyword で読まれガード不可化 (rules/13)。
//     - 2文は独立 (「そうした場合」連結ではない) => effect kind:'sequence'。
//   - a2 = 【ヒラメキ】(type:'triggered' scope:'on-evidence' trigger evidence:remove-by-action optional、rules/10 canonical):
//     - 相手は手札を1枚リムーブする => atom discard {player:'opp', n:1} (相手が選ぶ = chooser 既定は手札所有者。
//        D04010 a1 verbatim 同型「相手は手札を1枚リムーブする」)。「ランダム」でないので relative 側で pick を surface。
//
// exemplar: event-use 本体 = src/cards/ct-p01/B01057.ts a1 / partnerColor gate = src/cards/ct-p03/B03116.ts a1 /
//           charGrantKeyword pick carrier = src/cards/ct-d10/D10020.ts a1 + ct-d02/D02013.ts a1 /
//           相手 discard = src/cards/ct-d04/D04010.ts a1 / ヒラメキ = src/cards/ct-p01/B01057.ts a3。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  // 【パートナー赤】(rules/17: 未成立なら「何も効果のないイベント」扱い)
  condition: { kind: 'partnerColor', color: '赤' },
  effect: {
    kind: 'sequence',
    steps: [
      // 相手は手札を1枚ランダムにリムーブする (ランダム = pick 無し, 公式Q&A)
      { kind: 'atom', verb: 'discardRandom', args: { player: 'opp', n: 1 } },
      // キャラを1枚まで選び、ターン終了時まで〚ブレット〛を与える
      {
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
                n: { min: 0, max: 1 }, // 「1枚まで」= 0枚可 (rules/15)
                chooser: 'self',
              },
            },
          },
        ],
      },
    ],
  },
  description:
    '【パートナー赤】相手は手札を1枚ランダムにリムーブする。キャラを1枚まで選び、ターン終了時まで〚ブレット〛（このキャラのアクションはガードできない）を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】任意発動 (rules/10)
  // 相手は手札を1枚リムーブする (相手が選ぶ, D04010 a1 同型)
  effect: { kind: 'atom', verb: 'discard', args: { player: 'opp', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）相手は手札を1枚リムーブする。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

export const B01077: CardDef = {
  id: 'B01077',
  no: '0067/B01077',
  kind: 'event',
  names: ['「赤井…秀一!?」'],
  colors: ['赤'],
  level: 4,
  traits: [],
  rarity: 'C',
  imageUrl: '1714013053543438.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
