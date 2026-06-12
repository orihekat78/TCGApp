// cards/ct-p09/B09092 キール (キャラ) — Task D batch (2026-06-12)
// rules: 05-turn-phases.md, 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   自分のターン終了時、以下から1つ選んで行う。
//   ・〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合、カードを1枚引く。
//     自分の手札が6枚以上ある場合、手札を1枚リムーブする。
//   ・〚痕跡［未発見］〛の場合、相手のデッキのカードを上から4枚リムーブする。
//   【事件赤＆黒】【宣言】【スリープ】：レベル9以下のキャラを1枚まで選び、リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）相手のデッキのカードを上から4枚リムーブする。
//   (注: 本カードの raw hirameki には注釈括弧なし。他 p09 hirameki raw は全て注釈付きのため慣行に合わせ付記)
//
// a1: 「自分のターン終了時」= phase:end:start + condition turn:self (B07021 a1 同型)。
//     「以下から1つ選んで行う」= choice 2択 chooser:'self' (B08052 a1 同型)。各択は conditional —
//     公式Q&A「条件不成立の択も選べる (その場合何も起こりません)」と conditional no-op が語義一致。
//     択1: 痕跡[発見済] → sequence[draw 1, conditional(handAtLeast 6 → discard 1)] (Task D E1 handAtLeast。
//          「6枚以上」は引いた後の step 実行時評価 = rules/15 解決時参照)
//     択2: 痕跡[未発見] → mill opp 4 (B09094 a3 同型)。デッキ不足時は可能な限りリムーブ (removeFromTop が
//          min(n, 残枚数))。⚠ 公式Q&A は「その後リフレッシュを行う」だが engine の mill は即時リフレッシュ
//          しない (refresh 呼出は draw / fileAdd のみ。痕跡 flip・refresh penalty 証拠+1・リムーブ0枚敗北が
//          相手の次回 draw まで遅延する骨格 gap = rules/14・26 と不一致)。B09094 出荷済と同 gap —
//          engine BUG 起票対象、カード DSL では回避不能 (骨格凍結原則)。
// a2: 【事件赤＆黒】= caseColor combine:'and' (B09094 a1 同型、rules/17 全色必要) + 【宣言】【スリープ】(sleepSelf)
//     → レベル9以下のキャラを1枚まで選び sceneRemove (B09101 a1 同型。【ターン1】なし = limit なし)
// a3: 【ヒラメキ】optional 発動 (公式Q&A「発動させないことを選択できます」) → mill opp 4 (択2 と同じ mill gap 注記参照)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 自分のターン終了時
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  // 以下から1つ選んで行う
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'conditional',
        // 〚痕跡［発見済み］〛の場合 (engine 値は '発見済'。不成立でもこの択は選べる — Q&A: 何も起こらない)
        if: { kind: 'scratchTrace', player: 'self', v: '発見済' },
        then: {
          kind: 'sequence',
          steps: [
            // カードを1枚引く
            { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
            {
              kind: 'conditional',
              // 自分の手札が6枚以上ある場合 (引いた後の解決時評価)
              if: { kind: 'handAtLeast', player: 'self', n: 6 },
              // 手札を1枚リムーブする
              then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
            },
          ],
        },
      },
      {
        kind: 'conditional',
        // 〚痕跡［未発見］〛の場合 (不成立でもこの択は選べる — Q&A: 何も起こらない)
        if: { kind: 'scratchTrace', player: 'self', v: '未発見' },
        // 相手のデッキのカードを上から4枚リムーブする
        then: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 4 } },
      },
    ],
  },
  description:
    '自分のターン終了時、以下から1つ選んで行う。・〚痕跡［発見済み］〛の場合、カードを1枚引く。自分の手札が6枚以上ある場合、手札を1枚リムーブする。・〚痕跡［未発見］〛の場合、相手のデッキのカードを上から4枚リムーブする。',
  ruleRefs: ['rules/05-turn-phases.md', 'rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  // 【事件赤＆黒】= 自分の事件が赤と黒の両方の色を持つ (rules/17 「&」指定)
  condition: { kind: 'caseColor', color: ['赤', '黒'], combine: 'and' },
  // 【スリープ】コスト (このキャラ自身をスリープ)
  cost: { kind: 'sleepSelf' },
  // レベル9以下のキャラを1枚まで選び、リムーブする
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 9 } } },
  description: '【事件赤＆黒】【宣言】【スリープ】：レベル9以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 任意発動 (Q&A: 発動させないことを選択できる)
  // 相手のデッキのカードを上から4枚リムーブする
  effect: { kind: 'atom', verb: 'mill', args: { player: 'opp', n: 4 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）相手のデッキのカードを上から4枚リムーブする。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B09092: CardDef = {
  id: 'B09092',
  no: '1031/B09092',
  kind: 'character',
  names: ['キール'],
  colors: ['黒'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1775608926430781.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
