// cards/ct-p05/B05028P 服部平蔵 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【パートナー緑】【宣言】【ターン1】自分か相手の現場にいるキャラに裏向きでセットされているカードを1枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。\n【宣言】【スリープ】：自分の現場にいる〚特徴［警察］〛のキャラを1枚までと、相手の現場にいるキャラを1枚まで選び、持ち主のデッキのカードを上から1枚裏向きで選んだキャラにセットする。
// 句マッピング:
//   - a1 【パートナー緑】 (条件アイコン) => ability.condition { kind 'partnerColor', color:'緑' } [capability-map cond §partnerColor (owner partner colors intersect). B08034 a1 uses partnerColor as ability.condition. cond/eval.ts evaluates partnerColor.]
//   - a1 【宣言】【ターン1】 (declared, per-turn 1) => type 'declared' + limit:{kind 'turn',n:1}, cost なし [src/cards/ct-d01/D01006.ts: declared ability with limit:{kind 'turn',n:1} and NO cost field is valid (cost optional). Sibling B05029 a2 同句 prints 【パートナー緑】【宣言】【ターン1】 with no colon = no cost.]
//   - a1 自分か相手の現場にいるキャラに裏向きでセットされているカードを1枚リムーブしてもよい => chain step1: atom charRemoveSetCard {player:'self', max:1, side:'either', filter:{hasFaceDownSetCards:true}, faceDownOnly:true} [通常版 B05028 と印字同一。候補判定と実除去の両方を裏向き限定に統一する。]
//   - a1 そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする => chain step2: atom sceneRemove {player:'self', max:1, side:'either', cause:'effect', filter:{apMax:8000}} [src/cards/ct-p08/B08034.ts a1 uses sceneRemove{player:'self',max:1,side:'either',cause:'effect',filter:{apMax:8000}} verbatim. chain wrapper = 'そうした場合': capability-map wrappers §chain (breaks/skips step2 if step1 had no candidate or 0-pick skip continuation drop). apMax honored on scene-char candidates (filters §apMin/apMax).]
//   - a2 【宣言】【スリープ】 (declared + self-sleep cost) => type 'declared' + cost:{kind 'sleepSelf'} [src/cards/ct-p05/B05029.ts a1 (same deck/family) uses type 'declared', cost:{kind 'sleepSelf'}. cost/evaluate.ts sleepSelf payable only if source active (rules/21 【スリープ】 cost).]
//   - a2 自分の現場にいる〚特徴［警察］〛のキャラを1枚まで...持ち主(自分)のデッキ上1枚を裏向きで選んだキャラにセット => sequence step1: atom charSetCard {player:'self', max:1, side:'self', filter:{trait:'警察'}, fromDeckTop:true, faceUp:false} [src/cards/pr-01/PR262.ts a2 uses charSetCard{player:'self',max:1,side:'self',filter:{trait:'警察'},fromDeckTop:true,faceUp:false} verbatim. atom-handlers.ts charSetCard short-form: deck source = resolvePlayer(a.player='self') (持ち主=自分), set onto the picked self-side police char. atom-pick-spec.ts:78 forwards filter; candidates.ts honors trait. '1枚まで' = max:1/min:0.]
//   - a2 相手の現場にいるキャラを1枚まで選び、持ち主(相手)のデッキ上1枚を裏向きで選んだキャラにセット => sequence step2: atom charSetCard {player:'opp', max:1, side:'opp', fromDeckTop:true, faceUp:false} [src/cards/ct-p02/B02020.ts a2 uses charSetCard{player:'opp',max:1,side:'opp',fromDeckTop:true,faceUp:false} verbatim (shipped, registered in _reuse/index.ts). atom-handlers.ts: chooser = controller (ctx.source.player) per BUG-120; deck source = resolvePlayer('opp') (持ち主=相手). The engine couples a.player for both candidate side and deck source = exactly '持ち主のデッキ' semantics. Two independent atoms (each 1枚まで) = sequence.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '緑'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'chain',
    steps: [
      {
        kind: 'atom',
        verb: 'charRemoveSetCard',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          filter: {
            hasFaceDownSetCards: true
          },
          faceDownOnly: true,
        }
      },
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          cause: 'effect',
          filter: {
            apMax: 8000
          }
        }
      }
    ]
  },
  description: '【パートナー緑】【宣言】【ターン1】自分か相手の現場にいるキャラに裏向きでセットされているカードを1枚リムーブしてもよい。そうした場合、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'sleepSelf'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charSetCard',
        args: {
          player: 'self',
          max: 1,
          side: 'self',
          filter: {
            trait: '警察'
          },
          fromDeckTop: true,
          faceUp: false
        }
      },
      {
        kind: 'atom',
        verb: 'charSetCard',
        args: {
          player: 'opp',
          max: 1,
          side: 'opp',
          fromDeckTop: true,
          faceUp: false
        }
      }
    ]
  },
  description: '【宣言】【スリープ】：自分の現場にいる〚特徴［警察］〛のキャラを1枚までと、相手の現場にいるキャラを1枚まで選び、持ち主のデッキのカードを上から1枚裏向きで選んだキャラにセットする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B05028P: CardDef = {
  id: 'B05028P',
  no: '0532/B05028P',
  kind: 'character',
  names: [
    '服部平蔵'
  ],
  colors: [
    '緑'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '警察',
    '大阪府警'
  ],
  rarity: 'SRP',
  imageUrl: '1747231524098104.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
