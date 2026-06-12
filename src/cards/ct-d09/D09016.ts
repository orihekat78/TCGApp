// cards/ct-d09/D09016 諸伏高明 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   【FILE6】このキャラがアクションしたとき、カードを1枚引き、手札を1枚リムーブする。リムーブしたカードが〚特徴［長野県警］〛のキャラの場合、ターン終了時までこのキャラをAP＋1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【FILE6】 => ability.condition {kind 'fileAtLeast', n:6} on the triggered ability (icon-condition gate; if FILE<6 the ability is treated as not held → does not fire, rules/17) [src/cards/ct-d09/D09008.ts a1 condition:{kind 'fileAtLeast',n:7} (=【FILE7】, same deck, same trait family) and D09014/D09015 condition fileAtLeast n:7 — printed 【FILE7】→fileAtLeast{7}, so 【FILE6】→fileAtLeast{6}; capability-map.txt Condition fileAtLeast {n} = owner file.length>=n (assisted-partner counts); src/engine/cond/eval.ts fileAtLeast. Gating a triggered ability by an icon-condition proven in src/cards/ct-d08/D08021.ts a3 (condition gates action:declare trigger).]
//   - このキャラがアクションしたとき => trigger {hook 'action:declare', selfOnly:true} [EXACT exemplar src/cards/ct-d09/D09008.ts a2 trigger {hook 'action:declare',selfOnly:true} ('このキャラがアクションしたとき、カードを1枚引く。', same deck); also src/cards/ct-d08/D08021.ts a3/a4 and src/cards/ct-p01/B01032.ts a1 same hook. capability-map.txt §B/hooks: action:declare emitted by flow/action/state-machine.ts, payload {byUid,target,uid,player}, source={byPlayer,byUid}, selfOnly=attacker uid.]
//   - カードを1枚引き => sequence step1: atom draw {player:'self', n:1} (mandatory — sequence, not chain, so it always runs; B09038 lesson) [src/cards/ct-d09/D09008.ts a2 effect draw {player:'self',n:1} (same deck exemplar); capability-map.txt Draw §draw {player,n}; src/engine/effect/atom-handlers.ts draw case (mutate.deck.draw).]
//   - 手札を1枚リムーブする => sequence step2: atom discard {player:'self', n:1, bind:'$discarded'} (mandatory hand-pick min1/max1; binds the discarded cardId for the next step) [discard short-form (defaultArea=hand) verified src/engine/effect/atom-pick-spec.ts:30 (discard {defaultArea:'hand',mode:'PB'}); n:1 mandatory pick exemplar src/cards/ct-d08/D08013.ts a1 step3 discard {player:'self',n:1} and src/cards/ct-d11/D11014.ts a2 step1 discard {player:'self',n:1}; bind arg verified src/engine/effect/atom-handlers.ts:294-296 ((ctx.bindings)[a.bind]=target.map(cardId=>({cardId}))) — EXACT bind usage in committed cards src/cards/ct-p05/B05040.ts a1 (discard {bind:'$discarded'}) and src/cards/ct-p08/B08055.ts a1. After step1 draws +1, hand always has >=1 card so the discard is always payable. Bind survives the pick→continuation via BUG-107 (apply-pick.ts:48-105 same saved ctx).]
//   - リムーブしたカードが〚特徴［長野県警］〛のキャラの場合、ターン終了時までこのキャラをAP＋1000する。 => sequence step3: conditional {if: boundMatchesFilter{bindKey:'$discarded', filter:{trait:'長野県警'}}, then: atom charModifyAP {uid:'$self', delta:1000, scope 'turn'}} [boundMatchesFilter reads ctx.bindings['$discarded'][0].cardId and checks lookupCardDef(cardId).traits ∩ {長野県警} — VERIFIED src/engine/cond/eval.ts:235-267 (trait branch lines 254-258 honored). The discard bind shape [{cardId}] (atom-handlers.ts:295) matches boundMatchesFilter's bound[0].cardId read (eval.ts:240). EXACT structural exemplar of bind→boundMatchesFilter{trait}→conditional: src/cards/ct-p05/B05090.ts a1 step2 (sceneEnter bind:'$entered' → conditional{if:boundMatchesFilter{bindKey:'$entered',filter:{trait:'警察'}}, then:draw}) and src/cards/ct-d11/D11014.ts a2 (bind:'$entered'→boundMatchesFilter{cardName}). AP+1000 turn step: EXACT exemplar src/cards/ct-p01/B01032.ts a1 charModifyAP{uid:'$self',delta:1000,scope 'turn'} ('ターン終了時までこのキャラをAP+1000する', also on action:declare selfOnly so $self=attacker=this char). $self→ctx.source.uid verified src/engine/effect/atom-handlers.ts:139-145 (resolveBindRef '$self'→ctx.source.uid). NOTE: boundMatchesFilter ignores 'kind' (eval.ts only checks cardId/cardName/trait/color/level), but trait '長野県警' is character-exclusive (verified ALL 8 trait-bearing cards D09006/D09008/D09014/D09015/D09018/B05089/B08065/PR044 are kind 'character'; events always have traits:[] per capability-map §H) → filter:{trait:'長野県警'} is faithful to 'のキャラ' (no event can match).]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => ability a2: type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true}, effect: atom draw {player:'self', n:1} [EXACT exemplar src/cards/ct-d08/D08013.ts a2 (identical text '【ヒラメキ】カードを1枚引く。', identical DSL: scope 'on-evidence', trigger {hook 'evidence:remove-by-action',optional:true}, effect draw{player:'self',n:1}); capability-map.txt hooks §evidence:remove-by-action (ヒラメキ, optional:true→pendingHirameki UI fire/skip); brief proven pattern (D08013 a2).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    selfOnly: true
  },
  condition: {
    kind: 'fileAtLeast',
    n: 6
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
          verb: 'charModifyAP',
          args: {
            uid: '$self',
            delta: 1000,
            scope: 'turn'
          }
        }
      }
    ]
  },
  description: '【FILE6】このキャラがアクションしたとき、カードを1枚引き、手札を1枚リムーブする。リムーブしたカードが〚特徴［長野県警］〛のキャラの場合、ターン終了時までこのキャラをAP＋1000する。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
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
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const D09016: CardDef = {
  id: 'D09016',
  no: '0506/D09016',
  kind: 'character',
  names: [
    '諸伏高明'
  ],
  colors: [
    '黄'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '警察',
    '長野県警'
  ],
  rarity: 'D',
  imageUrl: '1743742875210688.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
