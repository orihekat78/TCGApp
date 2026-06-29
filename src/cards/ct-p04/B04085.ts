// cards/ct-p04/B04085 「わかってくれますよね…」 (event) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   自分の現場にいるアクティブ状態の〚特徴［警察］〛のキャラを1枚スタンさせてもよい。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）そうした場合、キャラを1枚まで選び、リムーブし、カードを1枚引く。
// 句マッピング:
//   - (イベント自己使用トリガ) このイベントを使用したとき => ability type 'triggered', scope 'on-hand', trigger {hook 'effect:declared', selfOnly:true, __eventUse:true} [src/cards/ct-p02/B02083.ts a1 と src/cards/ct-p06/B06094.ts a1 が同型のイベント自己使用 trigger を出荷 (matcher kind==='event-use')。scripts/taskA-codegen.cjs:112-120 が trigger.__eventUse:true を event-use matcher closure へ変換 (JSON のまま auto-generatable)。taskA-validate-specs.cjs:143 は生 matcher closure を禁止し __eventUse を要求。本カードに【パートナー色】等の条件アイコンは無いので ability.condition は付けない。]
//   - 自分の現場にいるアクティブ状態の〚特徴［警察］〛のキャラを1枚スタンさせてもよい => chain step1 = atom sceneSetState{uid:'$pick', state:'stun', target:{kind 'pick', query:{area:'scene', side:'self', filter:{trait:'警察'}, state:['active']}, n:{min:0,max:1}, chooser:'self'}} [ロングフォーム $pick + target は src/cards/ct-p06/B06094.ts:22 が VERBATIM 出荷 (sceneSetState{uid:'$pick', state:'stun', target.query.state:['active']} = アクティブ状態のキャラを1枚までスタン)。trait+state:['active'] の共存 query は src/cards/ct-p09/B09054.ts:67 (query:{side:'self', filter:{trait:'赤井家'}, state:['active']}) で実在。candidates.ts:218-219 が query.state.includes(c.state) で active 絞り込みを honor、matchOneFilter が filter.trait を honor (B03095 が trait:'警察' を出荷)。side:'self' = 「自分の現場にいる」(B03004/B09054)。state:'stun' は『設定先の状態』(atomSceneSetState scene.ts:340-350、a.state が string なので候補 state とは衝突しない)。n.min:0 = 「してもよい」の任意性を pick レベルで表現 (D03002 が discard{max:1} を『手札を1枚リムーブしてもよい』の chain step1 として同様に使用)。]
//   - （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる） => engine 既定 (mutate.scene.setState の stun→sleep 特殊挙動)。個別 effect 不要。 [rules/03-field-areas.md / rules/24-qa-naming-stun.md のスタン標準挙動。src/engine/mutate/scene.ts setState が処理 (B02083/B06094/D03002 とも印字注記であり個別効果として実装していない)。]
//   - そうした場合、(後段) => chain wrapper の no-apply-stop セマンティクス (step1 が実効果ありの時のみ step2 を実行) [src/engine/effect/resolver.ts:78-108 chain: step が no-candidate (ctx.dyn.chainStepNoApply) なら以降 break。pick-step1 を declined (0-pick) した場合は src/engine/effect/apply-pick.ts:205-208 applyPickSkipAndContinuation(runDeclinedAtom=false) が chain-origin head.remainder を skip (コメント『chain-origin head: head.remainder は「そうした場合」gate → skip』)。step1 が 1枚 pick (stun 成立) なら applyPickAndContinuation が continuation (step2) を実行。D03002.ts a1 が『手札を1枚リムーブしてもよい。そうした場合〜』を同型 chain で出荷。]
//   - キャラを1枚まで選び、リムーブし、 => chain step2 sequence[0] = atom sceneRemove{player:'self', max:1, side:'either', cause:'effect'} [src/cards/ct-p05/B05006.ts:111-122 と src/cards/ct-p04/B04049.ts a1 step3 が sceneRemove{player:'self', max:1, side:'either', cause:'effect'} を『1枚まで選び、リムーブ』として出荷。max:1 = n.min:0/max:1 (「〜枚まで」0枚可、rules/15)。side:'either' = エリア指定なし「キャラ」= 両方の現場 (rules/15)。filter は付けない (「キャラ」は無制限)。]
//   - カードを1枚引く => chain step2 sequence[1] = atom draw{player:'self', n:1} [src/cards/ct-p05/B05006.ts:124-128 が sceneRemove の直後に draw{player:'self', n:1} を出荷 (『リムーブし、カードを1枚引く』の語順通り sequence)。atom-handlers draw は n リテラル number を要求 (requireField)、数十枚で使用。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: {
          uid: '$pick',
          state: 'stun',
          target: {
            kind: 'pick',
            query: {
              area: 'scene',
              side: 'self',
              filter: {
                trait: '警察'
              },
              state: [
                'active'
              ]
            },
            n: {
              min: 0,
              max: 1
            },
            chooser: 'self'
          }
        }
      },
      {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom',
            verb: 'sceneRemove',
            args: {
              player: 'self',
              max: 1,
              side: 'either',
              cause: 'effect'
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
    ]
  },
  description: '自分の現場にいるアクティブ状態の〚特徴［警察］〛のキャラを1枚スタンさせてもよい。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）そうした場合、キャラを1枚まで選び、リムーブし、カードを1枚引く。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ]
};

export const B04085: CardDef = {
  id: 'B04085',
  no: '0469/B04085',
  kind: 'event',
  names: [
    '「わかってくれますよね…」'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1735287841268638.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/24-qa-naming-stun.md'
  ],
};
