// cards/ct-p09/B09061 ジェイムズ・ブラック (character) — ENGINE0 wave (engine変更0)
// rules: rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【登場時】手札から〚特徴［FBI］〛のキャラを3枚公開してもよい。そうした場合、カードを1枚引く。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚特徴［FBI］〛のキャラを
//     1枚まで選び、手札に加える。カードを手札に加えた場合、手札を1枚リムーブする。
// 句マッピング:
//   - 【登場時】 => a1: type 'triggered', scope 'on-scene', trigger {hook 'enter', selfOnly:true}
//       [VERBATIM in src/cards/ct-d01/D01008.ts a1 / src/cards/ct-p03/B03053.ts a2。enter = 【登場時】 (capability-map Hooks)。
//        selfOnly:true で自カード自身の登場のみ発火 (listeners/triggered.ts selfOnlyMatches、BUG-146 scene.ts enter emit source=登場キャラ)。]
//   - 手札から〚特徴［FBI］〛のキャラを3枚公開してもよい。そうした場合、引く
//       => optional{ chain[ handReveal(n:3, minimumPolicy:'exact'), draw(n:1) ] }
//       [固定数は共通 producer では best-effort。本カードは「3枚公開してもよい。そうした場合」の exact prerequisite
//        なので minimumPolicy:'exact' を明示する。FBI候補が3枚未満なら pending を作らず、chainStepNoApply で後続 draw も
//        実行しない。候補数は producer が player 側の完全な候補集合から算出し、UI/AI/apply は canonical pending を共有する。
//        公開=zone 変化なし (手札に残る、公式Q&A: 効果解決後に元へ戻してよい)。テスト tests/engine/effect/atom-hand-reveal.test.ts
//        §10b (候補3=n:3→公開→draw) / §10a (候補2<3→draw skip) / §10g (player 側候補数で判定) が本句の挙動を固定。
//        filter:{trait:'FBI', kind:'character'} = 「FBI のキャラ」(trait FBI ∧ kind character、BUG-123「キャラ」=kind 必須)。
//        optional{} が発動する/しないを所有し、発動後の picker は3枚を必須選択する。AI は optional 方針、UI は
//        optional modal、engine は exact pending policy を担当し、同じ可否へ収束する。]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => a2: type 'triggered', scope 'on-evidence',
//       trigger {hook 'evidence:remove-by-action', optional:true}
//       [VERBATIM in src/cards/ct-d01/D01013.ts a2 (灰原哀 ヒラメキ)。optional:true = ヒラメキは発動を選択可 (rules/10)。
//        action[事件] による証拠リムーブ時のみ発火 (能力/効果リムーブでは発動しない、rules/10)。]
//   - 自分のリムーブエリアにある〚特徴［FBI］〛のキャラを1枚まで選び、手札に加える。加えた場合、手札を1枚リムーブする
//       => chain[ handAddFromRemove(max:1, filter), discard(n:1) ]
//       [EXACT structural twin src/cards/ct-p03/B03053.ts a2 (filter のみ差: 鈴木綾子=cardNameNot+trait鈴木財閥 / 本=trait FBI)。
//        handAddFromRemove 短縮形 defaultArea='remove'、max:1 ⇒ n.min:0 =「1枚まで」0枚可 (rules/15)。filter trait FBI ∧ kind character。
//        「加えた場合〜」= chain gating: 候補0 (resolve-picks.ts:544) も human 0-pick 辞退 (resolve-picks.ts:588) も
//        chainStepNoApply を立て後段 discard を skip → discard は実際に手札へ加えたときのみ発火 (B03053 a2 と同一機構)。
//        discard n:1 = 必ず手札を1枚リムーブ (D04007 a1 / B03053 a2 と同型の「手札を1枚リムーブする」)。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'handReveal',
          args: {
            player: 'self',
            audience: 'all',
            lifetime: 'presentation',
            n: 3,
            minimumPolicy: 'exact',
            filter: {
              trait: 'FBI',
              kind: 'character'
            }
          }
        },
        {
          kind: 'atom',
          verb: 'draw',
          args: {
            player: 'self',
            n: 1
          }
        }
      ]
    }
  },
  description: '【登場時】手札から〚特徴［FBI］〛のキャラを3枚公開してもよい。そうした場合、カードを1枚引く。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'handAddFromRemove',
        args: {
          player: 'self',
          max: 1,
          filter: {
            trait: 'FBI',
            kind: 'character'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          n: 1
        }
      }
    ]
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚特徴［FBI］〛のキャラを1枚まで選び、手札に加える。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

export const B09061: CardDef = {
  id: 'B09061',
  no: '1003/B09061',
  kind: 'character',
  names: [
    'ジェイムズ・ブラック'
  ],
  colors: [
    '赤'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [
    'FBI'
  ],
  rarity: 'C',
  imageUrl: '1775608872832585.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
