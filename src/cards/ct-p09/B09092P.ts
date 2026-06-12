// cards/ct-p09/B09092P キール (キャラ パラレル) — Task D batch (2026-06-12)
// rules: 05-turn-phases.md, 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// B09092 と同テキスト (rarity SRP / imageUrl / no のみ差分)。句マッピングは B09092.ts ヘッダ参照。
//
// 公式テキスト:
//   自分のターン終了時、以下から1つ選んで行う。
//   ・〚痕跡［発見済み］〛の（このゲーム中に相手がリフレッシュしていた）場合、カードを1枚引く。
//     自分の手札が6枚以上ある場合、手札を1枚リムーブする。
//   ・〚痕跡［未発見］〛の場合、相手のデッキのカードを上から4枚リムーブする。
//   【事件赤＆黒】【宣言】【スリープ】：レベル9以下のキャラを1枚まで選び、リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）相手のデッキのカードを上から4枚リムーブする。

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

export const B09092P: CardDef = {
  id: 'B09092P',
  no: '1031/B09092P',
  kind: 'character',
  names: ['キール'],
  colors: ['黒'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'SRP',
  imageUrl: '1775608926443228.jpg',
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
