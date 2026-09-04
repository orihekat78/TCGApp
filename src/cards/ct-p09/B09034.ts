// cards/ct-p09/B09034 「朝日射し夕日輝く鉄の瓶…黄金千枚二千杯」 (event)
//   — engine拡張 wave#2 cluster6 (usage-restriction: event-use ban, 2026-06-14)
// rules: 06-card-types.md, 10-action-event.md, 12-next-hint.md, 15-abilities-effects.md, 25-qa-effects-resolution.md
//
// 公式テキスト:
//   自分のリムーブエリアにあるイベントを2枚まで選び、手札に加える。このターン中、自分はイベントを使用できない。
//   （能力や効果によっても使用できない）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにあるイベントを1枚まで選び、手札に加える。
//
// 公式 qAndA (cards-data ct-p09 event.tsv):
//   Q:「自分はイベントを使用できない」場合、具体的にどうなりますか？
//   A: カードの使用やネクストヒントでイベントカードを使用することができず、「イベントを使用する」効果を
//      解決することができなくなります。
//   Q:「自分はイベントを使用できない」場合、イベントカードの【カットイン】を使用することはできますか？
//   A: はい、可能です。【カットイン】や【ヒラメキ】は、この効果による制限を受けません。
//
// 句マッピング:
//   - 本体 = sequence[clause1, clause2] (chain ではない → clause1 が 0 枚でも clause2 の ban が走る、
//     resolver.ts sequence は __chainStepNoApply break をしない)。
//   - clause1「リムーブのイベントを2枚まで選び、手札に加える」=> handAddFromRemove multi-pick contract
//     ({ cardIds:'$pick.cardIds', target:{kind:'pick', query:{area:'remove',side:'self',filter:{kind:'event'}},
//       n:{min:0,max:2}, chooser:'self'} })。短縮形 max:2 は単一カードしか動かないため (BUG: normalizeTargetToString
//     value[0])、charStackCard(D08021) と同型の明示 multi-pick contract を使う。「2枚まで」=0〜2 (rules/15)。
//   - clause2「このターン中、自分はイベントを使用できない（能力や効果によっても）」=> setEventUseBan {player:'self'}。
//     gate は hand-use-card.ts / next-hint.ts / useEventFromHand の event。qAndA 通り
//     【カットイン】【ヒラメキ】は対象外。
//   - 本体 trigger = on-hand effect:declared selfOnly + matcher kind==='event-use' (B02053 と同型: 手札の使用・
//     ネクストヒントでの自イベント使用時に発火)。
//   - 【ヒラメキ】=> on-evidence evidence:remove-by-action optional + handAddFromRemove {max:1, filter:{kind:'event'}}
//     (「1枚まで」=0〜1、B02053 hirameki と同型 short-form)。

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
  effect: {
    kind: 'sequence',
    steps: [
      // clause1: リムーブのイベントを2枚まで選び、手札に加える (multi-pick)
      {
        kind: 'atom',
        verb: 'handAddFromRemove',
        args: {
          player: 'self',
          cardIds: '$pick.cardIds',
          target: {
            kind: 'pick',
            query: { area: 'remove', side: 'self', filter: { kind: 'event' } },
            n: { min: 0, max: 2 },
            chooser: 'self',
          },
        },
      },
      // clause2: このターン中、自分はイベントを使用できない
      { kind: 'atom', verb: 'setEventUseBan', args: { player: 'self' } },
    ],
  },
  description:
    '自分のリムーブエリアにあるイベントを2枚まで選び、手札に加える。このターン中、自分はイベントを使用できない。（能力や効果によっても使用できない）',
  ruleRefs: [
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/25-qa-effects-resolution.md',
  ],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: {
    kind: 'atom',
    verb: 'handAddFromRemove',
    args: { player: 'self', max: 1, filter: { kind: 'event' } },
  },
  description:
    '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにあるイベントを1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md'],
};

export const B09034: CardDef = {
  id: 'B09034',
  no: '0978/B09034',
  kind: 'event',
  names: ['「朝日射し夕日輝く鉄の瓶…黄金千枚二千杯」'],
  colors: ['緑'],
  level: 5,
  traits: [],
  rarity: 'C',
  imageUrl: '1775608835866750.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/06-card-types.md',
    'rules/10-action-event.md',
    'rules/12-next-hint.md',
    'rules/15-abilities-effects.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
