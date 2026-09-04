// cards/ct-p09/B09040 鈴木園子 (character) — engine mega-wave W2b exemplar (r28 mustGuard, 2026-07-03)
// rules: 07-action-flow.md, 08-contact.md, 13-keywords.md, 15-abilities-effects.md,
//        17-icons.md, 21-declared-ability-cost.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【登場時】このキャラをスリープさせ、手札から〚特徴［鈴木財閥］〛のキャラを1枚リムーブしてもよい。
//     そうした場合、リムーブしたカードのレベル以下のレベルのキャラを1枚まで選び、リムーブする。
//   【絆京極真】【宣言】【ターン1】相手の現場にいるレベル6以下のキャラを1枚まで選び、
//     ターン終了時まで「このキャラはガードできる場合、必ずガードする。」を与える。
//
// 句マッピング:
//   a1: 【登場時】=> trigger{hook:'enter', selfOnly:true}。
//       「このキャラをスリープさせ、…リムーブしてもよい」=> optional{chain[...]} (B04049/B06102 の
//         「スリープさせ…してもよい。そうした場合」完全同型 idiom。opt-in で composite 実行)。
//       「このキャラをスリープさせ」=> chain step1 sceneSetState{uid:'$self', state:'sleep'}。
//       「手札から〚特徴［鈴木財閥］〛のキャラを1枚リムーブし」=> chain step2 discard{player:'self',
//         max:1, filter:{kind:'character', trait:'鈴木財閥'}, bind:'$discarded'} (B07018 filter 同型 +
//         B05040 bind 同型)。0枚 (辞退/手札に無し) は chain break で後続 drop = 「そうした場合」gate。
//       「そうした場合、リムーブしたカードのレベル以下のレベルのキャラを1枚まで選び、リムーブする」
//         => chain step3 sceneRemove{player:'self', max:1, side:'either',
//         filter:{kind:'character', levelMax:{dyn:'$discarded.level'}}}。levelMax nested-filter-dyn は
//         D01014 (cluster12) 出荷済 / $discarded.level は B05040 出荷済。公式Q&A「効果を解決する時点の
//         (増減した状態の) レベルを参照」= filter 有効値評価 (BUG-113) と整合。side:'either' =
//         「キャラ」無修飾 (rules/15 どちらの現場でも、B06067/B09072 precedent)。
//   a2: 【絆京極真】=> condition{kind:'bond', cardName:'京極真'} (rules/17、パートナー不可)。
//       【宣言】【ターン1】=> type:'declared' + limit{kind:'turn', n:1}。
//       「相手の現場にいるレベル6以下のキャラを1枚まで選び」=> target pick{query:{area:'scene',
//         side:'opp', filter:{levelMax:6, kind:'character'}}, n:{min:0,max:1}, chooser:'self'}
//         (「1枚まで」= min:0 rules/15 / 「相手の現場」= side:'opp' / 自分が選ぶ= chooser:'self')。
//       「ターン終了時まで『このキャラはガードできる場合、必ずガードする。』を与える」
//         => charSetTurnEffect{uid:'$pick', key:'mustGuard', val:true} (B08037/B06067 Pattern A 長形
//         同型)。enforce は W2b r28: guard.mustGuardCandidates + passGuard/tryGuard fail-safe +
//         AI/UI 強制。清掃 = clearTurnEffects('turn') (mutate/char.ts で既存 delete)。
//       公式Q&A: ガード不可 (スリープ等) なら強制されない = candidates() 除外で自動成立 /
//         義務 char 2枚以上 = その中から持ち主が1枚選択 (tryGuard membership 検証)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'conditional',
    if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
    then: {
      kind: 'optional',
      effect: {
        kind: 'chain',
        steps: [
          { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
          { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '鈴木財閥' }, bind: '$discarded' } },
          { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { kind: 'character', levelMax: { dyn: '$discarded.level' } } } },
        ],
      },
    },
  },
  description:
    '【登場時】このキャラをスリープさせ、手札から〚特徴［鈴木財閥］〛のキャラを1枚リムーブしてもよい。そうした場合、リムーブしたカードのレベル以下のレベルのキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  condition: { kind: 'bond', cardName: '京極真' },
  effect: {
    kind: 'atom',
    verb: 'charSetTurnEffect',
    args: {
      uid: '$pick',
      key: 'mustGuard',
      val: true,
      target: {
        kind: 'pick',
        query: { area: 'scene', side: 'opp', filter: { levelMax: 6, kind: 'character' } },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description:
    '【絆京極真】【宣言】【ターン1】相手の現場にいるレベル6以下のキャラを1枚まで選び、ターン終了時まで「このキャラはガードできる場合、必ずガードする。」を与える。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B09040: CardDef = {
  id: 'B09040',
  no: '0983/B09040',
  kind: 'character',
  names: ['鈴木園子'],
  colors: ['白'],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: ['高校生', '鈴木財閥'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1775608856076174.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md',
  ],
};
