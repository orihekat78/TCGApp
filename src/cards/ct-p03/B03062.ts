// cards/ct-p03/B03062 私はもう貴方のそばに… (event) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/23-qa-disguise-cutin.md, rules/26-qa-deck-refresh.md
// 公式テキスト:
//   【パートナー白】自分の現場にいるキャラを1枚デッキの下に移してもよい。そうした場合、自分のデッキのカードを上からレベル8のキャラが出るまで1枚ずつ公開し、それを登場させる。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。
// 句マッピング:
//   - (イベント自己使用トリガ) このイベントを使用したとき効果が発動する => a1: type 'triggered', scope 'on-hand', trigger {hook 'effect:declared', selfOnly:true, __eventUse:true} [EXACT shape from src/cards/ct-p08/B08029.ts a1 trigger {hook 'effect:declared', selfOnly:true, matcher:(p)=>p?.kind==='event-use'} and src/cards/ct-d09/D09025.ts a1 (__eventUse:true codegen flag). scripts/taskA-codegen.cjs:112-120 converts __eventUse:true → matcher closure EVENT_USE_MATCHER (kept JSON-serializable). payload.kind='event-use' emitted by hand-use-card on event play (capability-map effect:declared site list).]
//   - 【パートナー白】 => ability.condition:{kind 'partnerColor', color:'白'} [EXACT match src/cards/ct-p01/B01044.ts a1 condition {kind 'partnerColor', color:'白'} (same 【パートナー白】 gate). capability-map.txt:142 partnerColor{color} = owner's partner CardDef.colors intersects color. rules/17: condition unmet → ability has no effect (entire effect gated).]
//   - 自分の現場にいるキャラを1枚デッキの下に移してもよい。そうした場合、… => chain[ sceneToDeck{player:'self', side:'self', max:1, pos:'bottom'}, <reveal-sequence> ] [sceneToDeck arg shape from src/cards/ct-p01/B01044.ts (sceneToDeck{player:'self',side:'either',max:1,pos:'bottom'}) and src/cards/ct-p02/B02003.ts (sceneToDeck{...,max:1,filter,pos:'bottom'}); here side:'self' = 自分の現場 (rules/21 自分の省略). Handler src/engine/effect/atom-handlers/scene.ts:318-337 atomSceneToDeck: uid-undefined+player+n/max → paShortFormAwait scene pick; pos default 'bottom' (l.334 a.pos==='top'?'top':'bottom'); mutate.scene.toDeck → deck bottom (NOT remove, so 【現場リムーブ時】 does NOT fire, rules/23). 'してもよい。そうした場合' = bare chain with leading max:1 (min:0) pick gating the body — EXACT precedent src/cards/ct-p05/B05028.ts a1 (chain[charRemoveSetCard{max:1}, sceneRemove], '〜してもよい。そうした場合〜'). chain-origin 0-pick decline → remainder ('そうした場合' gate) SKIPPED per src/engine/effect/apply-pick.ts:179-181,209; no-candidate (scene empty) → chainStepNoApply=true → chain break (resolve-picks.ts:301-306,346-350; resolver.ts:101-104). 1-pick → continuation runs reveal-sequence.]
//   - 自分のデッキのカードを上からレベル8のキャラが出るまで1枚ずつ公開し、 => sequence-step1: deckRevealUntil{player:'self', filter:{kind 'character', levelMin:8, levelMax:8}, bind:'$revealed', bindMatch:'$matched'} [EXACT structural twin src/cards/ct-d11/D11019.ts a1 (deckRevealUntil{filter:{color:'黄',levelMax:4,kind 'character'}, bind:'$revealed', bindMatch:'$matched'} for '上から…のキャラが出るまで1枚ずつ公開'). No maxN/chooseMatch = forced reveal-until-first-match (atom-handlers.ts no-maxN branch reveals 1-by-1 until predicate). Exact level via levelMin:8+levelMax:8 — both honored on deckRevealUntil predicate path (capability-map.txt:67,113 'levelMin/levelMax honored, printed values, BUG-117/118 fixed'); exact-level filter precedent src/cards/ct-p05/B05039.ts ({levelMin:5,levelMax:5},{levelMin:7,levelMax:7}); levelMin on deckReveal grounded src/cards/ct-p06/B06011.ts. kind 'character' honored (deck cards' printed kind).]
//   - それを登場させる。 => sequence-step2: conditional(bound $matched matched) → sceneEnter{player:'self', cardId:'$matched.cardId', viaEffect:true, target:{query:{area:'deck', side:'self'}}} [EXACT match src/cards/ct-d11/D11019.ts a1 conditional(bound $matched)→sceneEnter{cardId:'$matched.cardId', viaEffect:true, target:{query:{area:'deck',side:'self'}}}. target source-area='deck' triggers atom-handlers sceneEnter deck splice (BUG-102, prevents scene+deck dup). viaEffect:true → 効果による登場 (rules/15, 名乗り/active default, no enterSleep). bound-condition shape capability-map.txt cond list 'bound(key,presence exists/matched)'. If no match, $matched unresolved → conditional false → no enter (correct).]
//   - 残りの公開したカードをデッキの下に移し、 => sequence-step3: deckToBottomBound{player:'self', bindKey:'$revealed'} [EXACT match src/cards/ct-d11/D11019.ts a1 deckToBottomBound{player:'self', bindKey:'$revealed'}. capability-map.txt:68 deckToBottomBound moves bound cardIds ($revealed = all revealed non-match cards) deck→bottom; empty binding → no-op. Runs unconditionally inside sequence (sequence has no chain-break, resolver.ts:48-72).]
//   - デッキをシャッフルする。 => sequence-step4: deckShuffle{player:'self'} [EXACT match src/cards/ct-d11/D11019.ts a1 deckShuffle{player:'self'}. capability-map.txt:69 deckShuffle = mutate.deck.shuffle(ctx.rng). Runs unconditionally inside sequence.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  condition: {
    kind: 'partnerColor',
    color: '白'
  },
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
        verb: 'sceneToDeck',
        args: {
          player: 'self',
          side: 'self',
          max: 1,
          pos: 'bottom'
        }
      },
      {
        kind: 'sequence',
        steps: [
          {
            kind: 'atom',
            verb: 'deckRevealUntil',
            args: { visibility: 'public', viewer: 'all',
              player: 'self',
              filter: {
                kind: 'character',
                levelMin: 8,
                levelMax: 8
              },
              bind: '$revealed',
              bindMatch: '$matched'
            }
          },
          {
            kind: 'conditional',
            if: {
              kind: 'bound',
              key: '$matched',
              presence: 'matched'
            },
            then: {
              kind: 'atom',
              verb: 'sceneEnter',
              args: {
                player: 'self',
                cardId: '$matched.cardId',
                viaEffect: true,
                target: {
                  query: {
                    area: 'deck',
                    side: 'self'
                  }
                }
              }
            }
          },
          {
            kind: 'atom',
            verb: 'deckToBottomBound',
            args: {
              player: 'self',
              bindKey: '$revealed',
              order: 'preserve'
            }
          },
          {
            kind: 'atom',
            verb: 'deckShuffle',
            args: {
              player: 'self'
            }
          }
        ]
      }
    ]
  },
  description: '【パートナー白】自分の現場にいるキャラを1枚デッキの下に移してもよい。そうした場合、自分のデッキのカードを上からレベル8のキャラが出るまで1枚ずつ公開し、それを登場させる。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/23-qa-disguise-cutin.md',
    'rules/26-qa-deck-refresh.md'
  ]
};

export const B03062: CardDef = {
  id: 'B03062',
  no: '0317/B03062',
  kind: 'event',
  names: [
    '私はもう貴方のそばに…'
  ],
  colors: [
    '白'
  ],
  level: 8,
  traits: [],
  rarity: 'C',
  imageUrl: '1729133406793630.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/23-qa-disguise-cutin.md',
    'rules/26-qa-deck-refresh.md'
  ],
};
