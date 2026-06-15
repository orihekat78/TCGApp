// cards/ct-p05/B05046 鈴木園子 (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   自分のターン終了時、自分の手札が4枚以下の場合、カードを1枚引く。\n【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。\n【宣言】〚手札から特徴［鈴木財閥］のキャラを1枚リムーブする〛：キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 自分のターン終了時、自分の手札が4枚以下の場合、カードを1枚引く。 => a1: triggered hook 'phase:end:start' + condition turn:self; effect conditional(if handAtMost n:4 -> atom draw n:1) [phase:end:start + turn:self gate exemplar = src/cards/ct-p09/B09092.ts a1 (自分のターン終了時 = phase:end:start, condition turn:self, source undefined so no selfOnly). 'カードを1枚引く' = atom draw {player:'self',n:1} (B09092 a1). 手札N枚以下 = handAtMost condition: cap-map/brief said NO hand-count condition (STALE) but engine extended Task D E1 2026-06-12 — src/engine/cond/eval.ts:115-118 case 'handAtMost' returns state.players[p].hand.length <= cond.n; whitelisted in CONDITION_KIND_MAP eval.ts:376 handAtMost:true; type in src/engine/types/effect.ts:32 {kind 'handAtMost';player;n}. Resolution-time eval inside conditional mirrors B09092 a1's nested conditional handAtLeast (rules/15 解決時参照).]
//   - 【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。 => a2: triggered hook 'enter' selfOnly; effect atom sceneRemove {player:'self', max:1, side:'either', cause:'effect', filter:{levelMax:7}} [enter selfOnly hook + sceneRemove with stat filter exemplar = src/cards/ct-d05/D05002.ts:19,26 (trigger {hook 'enter',selfOnly:true}; sceneRemove {player:'self',max:1,side:'either',filter:{apMax:8000}}). levelMax filter on sceneRemove VERBATIM = src/cards/ct-p09/B09092.ts a2 (sceneRemove filter:{levelMax:9}). '1枚まで' = short-form max:1 => PA pick uid='$pick', 0-pick legal (capability-map.txt:35,98 sceneRemove short-form; rules/15 '〜枚まで'=0OK). levelMax honored by matchOneFilter (capability-map filters section).]
//   - 【宣言】〚手札から特徴［鈴木財閥］のキャラを1枚リムーブする〛：キャラを1枚まで選び、スリープさせる。 => a3: declared; cost removeFromHand {target pick area:hand side:self filter:{trait:'鈴木財閥',kind 'character'} n{1,1}, n:1}; effect atom sceneSetState {uid:'$pick', state:'sleep', target pick area:scene side:either n{0,1} chooser:self} [removeFromHand cost with trait filter exemplar = src/cards/ct-p04/B04008.ts:25 (cost removeFromHand target pick area:hand side:self filter:{trait:'少年探偵団'} n{2,2}, n:2). Single-card n:1 form = src/cards/ct-d02/D02013.ts:21 (removeFromHand n{1,1}, n:1). kind 'character' on hand char pick required per BUG-123 (brief; text says 'キャラ'). 'キャラを1枚まで選び、スリープさせる' = sceneSetState {uid:'$pick',state:'sleep',target pick area:scene side:either n{0,1} chooser:self} VERBATIM = src/cards/ct-d07/D07008.ts:90-114 a2 (state:'sleep', n.min:0=1枚まで). declared cost paid via src/engine/cost/evaluate.ts removeFromHand canPay (capability-map costdyn section).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'turn',
    player: 'self'
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'handAtMost',
      player: 'self',
      n: 4
    },
    then: {
      kind: 'atom',
      verb: 'draw',
      args: {
        player: 'self',
        n: 1
      }
    }
  },
  description: '自分のターン終了時、自分の手札が4枚以下の場合、カードを1枚引く。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md'
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
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      cause: 'effect',
      filter: {
        levelMax: 7
      }
    }
  },
  description: '【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'removeFromHand',
    target: {
      kind: 'pick',
      query: {
        area: 'hand',
        side: 'self',
        filter: {
          trait: '鈴木財閥',
          kind: 'character'
        }
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'self'
    },
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: {
        kind: 'pick',
        query: {
          area: 'scene',
          side: 'either'
        },
        n: {
          min: 0,
          max: 1
        },
        chooser: 'self'
      }
    }
  },
  description: '【宣言】〚手札から特徴［鈴木財閥］のキャラを1枚リムーブする〛：キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B05046: CardDef = {
  id: 'B05046',
  no: '0548/B05046',
  kind: 'character',
  names: [
    '鈴木園子'
  ],
  colors: [
    '白'
  ],
  level: 8,
  ap: 7000,
  lp: 1,
  traits: [
    '高校生',
    '鈴木財閥'
  ],
  rarity: 'SR',
  imageUrl: '1745322205497111.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
