// cards/ct-d09/D09005 大和敢助 (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   【絆諸伏高明】【自分ターン中】LP＋1\n【登場時】カードを1枚引き、手札を1枚リムーブする。リムーブしたカードが〚特徴［長野県警］〛のキャラの場合、AP8000以下のキャラを1枚まで選び、リムーブする。
// 句マッピング:
//   - 【絆諸伏高明】 => a1.condition (and の第1項) {kind 'bond', cardName:'諸伏高明'} [bond は cond/eval.ts に実装済 (capability-map Conditions §bond)。鏡像カード src/cards/ct-d09/D09006.ts a1 が同一 set で {kind 'bond', cardName:'大和敢助'} を使用 (D09004 大和敢助 ↔ D09006 諸伏高明 の相互絆ペア)。【絆】= 現場に指定カード名のキャラ (rules/17)。]
//   - 【自分ターン中】 => a1.condition (and の第2項) {kind 'turn', player:'self'} [turn(self) は cond/eval.ts 実装済。D09006.ts a1 condition が同一の and[bond, turn{self}] を VERBATIM 使用。]
//   - LP＋1 (常時) => a1 type 'continuous', continuousModifier:{lpDelta:1} [lpDelta は src/engine/types/card-def.ts:87 ContinuousModifier の有効フィールド (apDelta/lpDelta はオーナー自身 = $self 修正、aura ではない)。{lpDelta:1} の純JSON shape は src/cards/ct-p01/B01027.ts:20 が VERBATIM 使用。D09006.ts a1 が apDelta:2000 の自己版で同型を実証。closure 不要。]
//   - 【登場時】 => a2 type 'triggered', scope 'on-scene', trigger {hook 'enter', selfOnly:true} [hook 'enter' は登場時 (capability-map Hooks §enter)。EXACT exemplar src/cards/ct-p05/B05090.ts a1 trigger{hook 'enter', selfOnly:true}。sceneEnter が emit (atom-handlers.ts sceneEnter)。]
//   - カードを1枚引き => a2.effect.steps[0] atom draw {player:'self', n:1} [draw {player,n} は atom verb (capability-map Draw §draw)。sequence の必須 step (chain ではない) なので常に実行。同一 set src/cards/ct-d09/D09016.ts a1 step1 が draw{player:'self',n:1} を VERBATIM 使用。]
//   - 手札を1枚リムーブする => a2.effect.steps[1] atom discard {player:'self', n:1, bind:'$discarded'} [discard 短縮形 defaultArea=hand (atom-pick-spec.ts discard {defaultArea:'hand'})。n:1 = 必須 hand-pick。bind は BUG-114 で追加: atom-handlers.ts:346-350 で (ctx.bindings)[a.bind]=target.map(cardId=>({cardId}))。同一 set D09016.ts a1 step2 が discard{player:'self',n:1,bind:'$discarded'} を VERBATIM 使用。step1 draw 後 手札>=1 で常に支払可。bind は pick pause を跨いで同一 saved ctx に残る (BUG-107, apply-pick.ts)。]
//   - リムーブしたカードが〚特徴［長野県警］〛のキャラの場合 => a2.effect.steps[2] conditional.if = {kind 'boundMatchesFilter', bindKey:'$discarded', filter:{trait:'長野県警'}} [boundMatchesFilter は cond/eval.ts:244-290 実装済: ctx.bindings[bindKey][0].cardId を lookupCardDef し、trait 分岐 (eval.ts:263-267) で d.traits ∩ {長野県警} を判定。discard bind shape [{cardId}] (atom-handlers.ts:349) が bound[0].cardId 読み出し (eval.ts:249) と整合。同一 set D09016.ts a1 step3 が boundMatchesFilter{bindKey:'$discarded', filter:{trait:'長野県警'}} を VERBATIM 使用。cap-map §H の『discard した札の inspect 不可』gate は STALE (BUG-114 discard-bind + cluster2 boundMatchesFilter 拡張で解消済、brief 冒頭の STALE 警告に従う)。trait '長野県警' はキャラ専用 (イベントは traits:[]、cap-map §H) なので filter:{trait} のみで『のキャラ』に忠実。]
//   - AP8000以下のキャラを1枚まで選び、リムーブする => a2.effect.steps[2] conditional.then = atom sceneRemove {player:'self', max:1, side:'either', filter:{apMax:8000}} [sceneRemove 短縮形 (area=scene → PA pick uid='$pick')、max:1 = 0〜1枚 (rules/15 『〜枚まで』=0OK)、side:'either' = 双方の現場 (エリア指定なし『キャラを〜枚まで選び』= rules/15 どちらの現場でも選べる)、filter:{apMax:8000} は matchOneFilter (candidates.ts:317) が honor。EXACT exemplar src/cards/ct-d08/D08003.ts a1 step2 sceneRemove{player:'self', max:1, side:'either', filter:{apMax:8000}} (登場時 chain 内)。conditional.then 内に pick を置く構造は src/cards/ct-d01/D01012.ts a1 step2 (前段 bind → conditional{if:bound, then: pick を含む sceneEnter}) で実証済。pick=プレイヤー選択 → tier 2。conditional が true 評価された後に sceneRemove pick が pause するため bind の pause-2 越え不要 (安全)。]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'bond',
        cardName: '諸伏高明'
      },
      {
        kind: 'turn',
        player: 'self'
      }
    ]
  },
  continuousModifier: {
    lpDelta: 1
  },
  description: '【絆諸伏高明】【自分ターン中】LP＋1',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'draw',
        args: {
          player: 'self',
          n: 1
        }
      },
      {
        kind: 'atom',
        verb: 'discard',
        args: {
          player: 'self',
          n: 1,
          bind: '$discarded'
        }
      },
      {
        kind: 'conditional',
        if: {
          kind: 'boundMatchesFilter',
          bindKey: '$discarded',
          filter: {
            trait: '長野県警'
          }
        },
        then: {
          kind: 'atom',
          verb: 'sceneRemove',
          args: {
            player: 'self',
            max: 1,
            side: 'either',
            filter: {
              apMax: 8000
            }
          }
        }
      }
    ]
  },
  description: '【登場時】カードを1枚引き、手札を1枚リムーブする。リムーブしたカードが〚特徴［長野県警］〛のキャラの場合、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ]
};

export const D09005: CardDef = {
  id: 'D09005',
  no: '0500/D09005',
  kind: 'character',
  names: [
    '大和敢助'
  ],
  colors: [
    '黄'
  ],
  level: 8,
  ap: 7000,
  lp: 1,
  traits: [
    '警察',
    '長野県警'
  ],
  rarity: 'D',
  imageUrl: '1743742875156795.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
