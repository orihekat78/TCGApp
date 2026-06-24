// cards/ct-p05/B05014 工藤新一 (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/13-keywords.md, rules/19-special-rules.md
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）\nターン終了時、このキャラがスリープ状態で現場にいる場合、このキャラを手札に移し、自分のリムーブエリアにあるレベル3以下の〚カード名［江戸川コナン］〛を1枚まで選び、スリープ状態で登場させる。
// 句マッピング:
//   - 〚突撃〛（登場したターンからすぐにアクションできる） => CardDef.keywords:['突撃'] (innate printed keyword, no separate ability) [src/cards/ct-p03/B03014.ts CardDef.keywords:['突撃'] — same 突撃 + ターン終了時 character; src/cards/ct-p07/B07021.ts keywords:['突撃']. TSV .claude/specs/cards-data/ct-p05/character.tsv row B05014 effect col prints 〚突撃〛 with no condition. capability-map: 突撃 is an engine-handled innate keyword on CardDef.]
//   - ターン終了時 (NO 自分の specification → fires on EITHER player's turn-end) => trigger {hook 'phase:end:start'} with NO turn condition [src/engine/flow/turn.ts:60 emits event.emit(state,'phase:end:start',{player:p},undefined) every turn-end. src/cards/ct-p03/B03014.ts a1 uses trigger {hook 'phase:end:start'} with no turn cond for identical un-qualified 'ターン終了時'. Official Q&A in TSV B05014 qAndA: 「この能力は相手のターン終了時にも発動しますか？ A：はい。自分と相手のどちらのターン終了時にも発動します。」 → confirms NO turn gate. src/engine/listeners/triggered.ts handleHook scans collectCardsInPlay (both sides) and builds ctx.source per reacting scene char, so a non-turn-player's char reacts too.]
//   - このキャラがスリープ状態で現場にいる場合 => ability.condition:{kind 'charStateIs', ref:{kind 'self'}, state:'sleep'} [src/engine/cond/eval.ts:231 case 'charStateIs' → resolveCharsForRef(state,cond.ref,ctx).some(uid=>charRead.state==cond.state). ref:{kind 'self'} resolves via resolveTarget→candidates (src/engine/target/candidates.ts:97 self → ctx.source.uid). In triggered.ts handleHook the ability.condition is evaluated with ctx.source={uid:card.uid,player:card.player,...} built PER iterated scene card (NOT the undefined emit source), so 'self' = the iterated scene char. '現場にいる' is enforced because collectCardsInPlay + scope 'on-scene' restrict to area==='scene'. Exemplars: src/cards/ct-p08/B08058.ts (uses BOTH phase:end:start [a1] and charStateIs ref:{kind 'self'} [a2]) and src/cards/ct-p04/B04049.ts charStateIs ref:{kind 'self'},state:'sleep'. Whitelisted: eval.ts:452 charStateIs:true.]
//   - このキャラを手札に移し (FORCED — Q&A: 必ず手札に移します) => atom sceneToHand {uid:'$self'} as a forced sequence step [src/engine/effect/atom-handlers/scene.ts:299 atomSceneToHand: resolveBindRef('$self')→ctx.source.uid (the iterated char), then mutate.scene.toHand bounces it to OWNER's hand. Exemplar src/cards/ct-p03/B03014.ts a1 step1 = sceneToHand {uid:'$self'} on phase:end:start. Official Q&A TSV B05014: 「必ず手札に移します。『～してもよい』ではないので」 → forced, so it is a plain sequence step (NOT optional).]
//   - 自分のリムーブエリアにあるレベル3以下の〚カード名［江戸川コナン］〛を1枚まで選び、スリープ状態で登場させる (Q&A: 1枚も選ばない=登場させない ことが可能) => atom sceneEnter {player:'self', from:'remove', max:1, viaEffect:true, enterSleep:true, filter:{cardName:'江戸川コナン', levelMax:3, kind 'character'}} [src/cards/ct-p02/B02066.ts a2 = EXACT shape sceneEnter {player:'self', from:'remove', max:1, viaEffect:true, enterSleep:true, filter:{cardName:'メアリー', levelMax:5, kind 'character'}} for 「自分のリムーブエリアにあるレベルX以下の〚カード名[Y]〛を1枚まで選び、スリープ状態で登場させる」. Also src/cards/ct-d05/D05006.ts (from:'remove'+enterSleep). capability-map: sceneEnter short-form from='remove'+max builds source-area pick ($pick.cardId), filter cardName/levelMax/kind all honored via matchOneFilter. max:1 = n.min:0 (1枚まで=0-OK, rules/15) → matches Q&A '1枚も選ばない…ことが可能'. enterSleep:true = 'スリープ状態で登場'. kind 'character' required for remove-area char pick (BUG-123).]
//   - (sequencing) 移し、…登場させる — two forced steps (bounce always; entry 0-OK) => effect kind 'sequence' of [sceneToHand, sceneEnter] [src/cards/ct-p03/B03014.ts a1 uses sequence of [sceneToHand,discard] for identical 'このキャラを…手札に移し、…する' compound. capability-map §WRAPPERS: sequence runs steps in order; if a step enqueues a pick it saves remaining + resumes on updated board. Step1 (bounce) is a direct mutation; Step2 (sceneEnter) enqueues the 0-OK remove-area pick on the post-bounce board (scene now has room). chain NOT used because there is no 'そうした場合' gating — both steps are independent and the bounce is unconditionally forced per Q&A.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'charStateIs',
    ref: {
      kind: 'self'
    },
    state: 'sleep'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneToHand',
        args: {
          uid: '$self'
        }
      },
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          from: 'remove',
          max: 1,
          viaEffect: true,
          enterSleep: true,
          filter: {
            cardName: '江戸川コナン',
            levelMax: 3,
            kind: 'character'
          }
        }
      }
    ]
  },
  description: 'ターン終了時、このキャラがスリープ状態で現場にいる場合、このキャラを手札に移し、自分のリムーブエリアにあるレベル3以下の〚カード名［江戸川コナン］〛を1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/13-keywords.md'
  ]
};

export const B05014: CardDef = {
  id: 'B05014',
  no: '0520/B05014',
  kind: 'character',
  names: [
    '工藤新一'
  ],
  colors: [
    '青'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '探偵',
    '高校生'
  ],
  rarity: 'C',
  imageUrl: '1745322178405325.jpg',
  keywords: [
    '突撃'
  ],
  abilities: [a1],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/13-keywords.md',
    'rules/19-special-rules.md'
  ],
};
