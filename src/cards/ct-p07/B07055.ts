// cards/ct-p07/B07055 紅の盟約 (イベント) — 赤魔術 trait family (engine変更0)
// rules: 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   【事件赤魔術】【パートナー白】AP8000以下のキャラを1枚まで選び、リムーブする。
//   自分の現場にいるキャラに裏向きでセットされているカードを合わせて2枚リムーブしてもよい。
//   そうした場合、AP6000以下のキャラを1枚まで選び、リムーブする。
// 公式Q&A:
//   - 【事件赤魔術】= 自分の事件が特徴［赤魔術］を持つ場合に有効。
//   - AP8000以下を選ばず(リムーブせず)それ以降を解決可 / AP8000以下をリムーブしセットをリムーブしないことも可
//     (clause1 と clause2 は独立。clause1=「1枚まで」=0OK、clause2=「してもよい」)。
//   - セットカードはキャラ2枚から1枚ずつリムーブ可 (合わせて2枚 = own scene の set card を計2枚)。
//
// 句マッピング:
//   - 【事件赤魔術】【パートナー白】 = condition and[caseTrait{赤魔術}, partnerColor{白}] (B05090 a2 同型の and)。
//   - clause1 AP8000以下1枚までリムーブ = sceneRemove{self, max:1, side:'either', filter:{apMax:8000}}
//     (「キャラ」=side 無=either、「1枚まで」=0OK)。
//   - clause2 「合わせて2枚リムーブしてもよい。そうした場合、AP6000以下1枚までリムーブ」
//     = optional{ chain[ charRemoveSetCard{self, side:'self', n:2, filter:{hasSetCards}}, sceneRemove{AP6000以下} ] }
//     · 「してもよい」= optional wrapper (clause 全体を辞退可)。
//     · 「合わせて2枚」= charRemoveSetCard n:2 (number = 強制ちょうど2枚。buildShortFormPick: n number→nMin=nMax=2)。
//        own scene の set card を per-char pick で計2枚除去 (apply-pick.ts:66 pickedUids 複数→各 uid per-char 適用)。
//        ※ n:{min,max} object は hasNorMax (number 判定) を通らず pick 未生成になる (本 family の test で実証)。
//     · 「そうした場合」= chain (2枚除去後のみ bonus sceneRemove へ)。bonus = AP6000以下1枚まで either。

import type { AbilityDef, CardDef, GameState } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  // 【事件赤魔術】【パートナー白】
  condition: {
    kind: 'and',
    cs: [
      { kind: 'caseTrait', trait: '赤魔術' },
      { kind: 'partnerColor', color: '白' },
    ],
  },
  effect: {
    kind: 'sequence',
    steps: [
      // AP8000以下のキャラを1枚まで選び、リムーブする
      { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } } },
      // 自分の現場のセットカードを合わせて2枚リムーブしてもよい。そうした場合、AP6000以下を1枚までリムーブ
      {
        kind: 'optional',
        effect: {
          kind: 'chain',
          steps: [
            { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', side: 'self', n: 2, filter: { hasSetCards: true } } },
            { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 6000 } } },
          ],
        },
      },
    ],
  },
  description:
    '【事件赤魔術】【パートナー白】AP8000以下を1枚までリムーブ。自分の現場のセットカードを計2枚リムーブしてもよい。そうした場合、AP6000以下を1枚までリムーブ。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B07055: CardDef = {
  id: 'B07055',
  no: '0784/B07055',
  kind: 'event',
  names: ['紅の盟約'],
  colors: ['白'],
  level: 6,
  // 特徴 (公式 category1 由来): 赤魔術。TSV 抽出が event の category(特徴) を全件 drop していたため要明示。
  traits: ['赤魔術'],
  rarity: 'C',
  imageUrl: '1762414010600972.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
  ],
};
