// cards/pr-01/PR178 「助けて平次ィ!!!」 (event) — Task A green候補 (engine変更0)
// rules: rules/09-cutin-disguise.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/20-color-and-switch.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   自分のデッキのカードを上から3枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル6以下のキャラを1枚まで選び、登場させる。
//   【カットイン】【自分ターン中】AP＋3000（自分のターンのコンタクト中に手札からリムーブして使う）
// 句マッピング:
//   - (イベント自己使用トリガ) このイベントを使用したとき効果本文が発動する => a1: type:'triggered' scope:'on-hand' trigger:{hook:'effect:declared', selfOnly:true, __eventUse:true} [EXACT shape from src/cards/ct-d09/D09025.ts a1 and src/cards/ct-d08/D08024.ts a1 (both events: effect:declared + selfOnly + matcher kind==='event-use'). __eventUse:true is the codegen flag transformed into matcher:(p)=>p?.kind==='event-use' (scripts/taskA-codegen.cjs lines 112-120; per certify-brief.md B06071/D08024/eventRemoveByAP 同型). effect:declared event-use emit confirmed in capability-map.txt hook list (hand-use-card payload.kind='event-use'). on-hand selfOnly gate = payloadCardId===card.cardId && sourcePlayer===card.player verified src/engine/listeners/triggered.ts selfOnlyMatches (lines 149-152).]
//   - 自分のデッキのカードを上から3枚リムーブしてもよい。（…してもよい） => a1 effect: {kind:'optional', effect:{kind:'chain', steps:[mill, sceneEnter]}} [「してもよい。そうした場合、X」 = optional{chain[cost-step, X]} idiom per certify-brief.md, EXACT structural twin src/cards/ct-d05/D05006.ts a1 and src/cards/pr-01/PR144.ts a1 (optional → chain → [cost-style step, reanimate-from-remove]). optional runtime: src/engine/effect/resolve-picks.ts (human surface pendingEffectOptional, AI/non-human skip) — capability-map.txt §optional. chain 「そうした場合」 semantics: src/engine/effect/resolver.ts lines 59-84 (chain breaks only when a step sets __chainStepNoApply).]
//   - 自分のデッキのカードを上から3枚リムーブ => a1 chain step1: atom mill {player:'self', n:3} [mill verb = mutate.deck.removeFromTop, src/engine/effect/atom-handlers.ts case 'mill' (line 307). EXACT arg shape from src/cards/ct-p09/B09103.ts (mill {player:'opp', n:3}); player:'self' for own deck. mill NEVER sets __chainStepNoApply (atom-handlers.ts mill handler, unlike filePopToHand line 350) → chain never breaks at this step, so reanimate always runs once player opts into optional. Faithful: rules/14-refresh.md 「上から○枚リムーブ」 insufficient deck → 可能な限りリムーブ, effect proceeds — opting into optional IS the 「そうした」 gate.]
//   - そうした場合、自分のリムーブエリアにあるレベル6以下のキャラを1枚まで選び、登場させる。 => a1 chain step2: atom sceneEnter {player:'self', from:'remove', max:1, viaEffect:true, filter:{levelMax:6, kind:'character'}} [Reanimate-from-remove EXACT pattern src/cards/ct-d08/D08024.ts a1 (sceneEnter {player:'self', from:'remove', max:1, viaEffect:true, filterAny:[{...,levelMax:5}]}) and src/cards/ct-d09/D09025.ts a1 (from:'remove', max:1, viaEffect:true, filter:{trait, levelMax:5, kind:'character'}). Remove-area pick candidates honor filter.levelMax + filter.kind: src/engine/target/candidates.ts case 'remove' (line 139) builds {kind:'card',area:'remove'} cands; matchOneFilter honors filter.kind (line 269) and filter.levelMax via level<=levelMax (line 294, printed level for non-scene). max:1 + 「1枚まで」 = 0-or-1 pick (0 legal, rules/15). PR178 filter has no trait/color (any キャラ Lv≤6) — strict subset of grounded filter fields. enter hook fires (sceneEnter emits enter). TIER-2 player-pick surface.]
//   - 【カットイン】【自分ターン中】AP＋3000（自分のターンのコンタクト中に手札からリムーブして使う） => a2: type:'triggered' scope:'on-hand' trigger:{hook:'effect:declared', optional:true, selfOnly:true} condition:{kind:'turn',player:'self'} effect:{atom charModifyAP {uid:'$contact.byUid', delta:3000, scope:'contact'}} [EXACT match (identical official text AND delta 3000) src/cards/ct-p02/B02007.ts a1 (【カットイン】【自分ターン中】AP＋3000, condition turn:self, charModifyAP $contact.byUid delta:3000 scope:'contact'). Dual event-use+cutin coexistence proven by precedent src/cards/ct-d11/D11019.ts (event with a1 event-use body + a2 【カットイン】 charModifyAP $contact.byUid scope:'contact'). Cut-in detection = optional:true on effect:declared/on-hand (src/engine/read/keyword.ts abilityIsCutin lines 19-25); fired via contact flow, $contact.byUid resolved from source.bindings (capability-map.txt cut-in site). condition turn:self = 【自分ターン中】 (capability-map.txt cond 'turn'). Outside contact (e.g. on this event's own event-use emit) $contact.byUid is $-unresolved → silent no-op (capability-map.txt), so a2 does not misfire on body use.]

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
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        {
          kind: 'atom',
          verb: 'mill',
          args: {
            player: 'self',
            n: 3
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
            filter: {
              levelMax: 6,
              kind: 'character'
            }
          }
        }
      ]
    }
  },
  description: '自分のデッキのカードを上から3枚リムーブしてもよい。そうした場合、自分のリムーブエリアにあるレベル6以下のキャラを1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  condition: {
    kind: 'turn',
    player: 'self'
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      uid: '$contact.byUid',
      delta: 3000,
      scope: 'contact'
    }
  },
  description: '【カットイン】【自分ターン中】AP＋3000',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const PR178: CardDef = {
  id: 'PR178',
  no: '0729/PR178',
  kind: 'event',
  names: [
    '「助けて平次ィ!!!」'
  ],
  colors: [
    '緑'
  ],
  level: 6,
  traits: [],
  rarity: 'PR',
  imageUrl: '1759195553222908.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md'
  ],
};
