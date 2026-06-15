// cards/ct-p04/B04014P 最後の切り札 (event) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/03-field-areas.md
// 公式テキスト:
//   【パートナー青】【解決編】以下から1つ選んで行う。\n・キャラを2枚まで選び、スリープさせる。カードを1枚引く。\n・レベル6以下のキャラを1枚まで選び、リムーブする。\n・キャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。
// 句マッピング:
//   - (event self-use trigger) このイベントを使用したとき効果本文が発動する => type 'triggered', scope 'on-hand', trigger {hook 'effect:declared', selfOnly:true, __eventUse:true} [EXACT shape from src/cards/ct-p08/B08029.ts a1 and src/cards/ct-p04/B04064.ts a1 (both events: trigger{hook 'effect:declared', selfOnly:true, matcher:(p)=>p?.kind==='event-use'}, scope 'on-hand'). __eventUse:true is the codegen flag (scripts/taskA-codegen.cjs) that becomes matcher:(p)=>p?.kind==='event-use' per certify-brief.md — used verbatim in src/cards/ct-p02/B02053.ts / B02083.ts / PR178.ts. Emit site = src/engine/flow/main/hand-use-card.ts payload {kind 'event-use',cardId}; on-hand selfOnly gate matches payload.cardId+source.player (capability-map effect:declared hook site list). Because __eventUse is a JSON flag (not a raw closure), the file is pure-JSON authorable → needsManual:false.]
//   - 【パートナー青】【解決編】(条件アイコン) => ability.condition = and[ {partnerColor,'青'}, {caseStatus,'解決編'} ] [EXACT pattern from src/cards/ct-p04/B04064.ts a1: condition {kind 'and', cs:[{kind 'partnerColor',color:'赤'},{kind 'caseStatus',status:'解決編'}, ...]}. capability-map: partnerColor {color} = 【パートナー(色)】; caseStatus {status:'解決編'} = 【解決編】 (cond/eval.ts). rules/17 Point: condition unmet → the ability is treated as not-held = 'a vacuous event that does nothing' — which is the accurate semantics for these icons on an event (B04064 header explicitly documents this as the correct reading vs. the use-gate reading). No use-blocking needed.]
//   - 以下から1つ選んで行う。(3つの選択肢から1つ) => effect.kind 'choice', chooser:'self', options:[opt1, opt2, opt3] (top-level choice) [EXACT pattern from src/cards/ct-p06/B06007.ts a2 ('【パートナー青】【登場時】以下から1つ選んで行う' → top-level choice chooser:'self' with 3 options). Top-level human choice (options.length>1, chooser!=='opp', humanChooser) surfaces pendingEffectChoiceSide and resumes the chosen option via applyChoiceAndContinuation (src/engine/effect/resolve-picks.ts:721-770 choice case + apply-pick.ts applyChoiceAndContinuation). On an event (on-hand) the same choice surface works (grounded by B08029.ts a1 top-level choice on an event). tier 2 (choice modal at resolution).]
//   - ・キャラを2枚まで選び、スリープさせる。カードを1枚引く。(option 1) => option = sequence:[ atom draw{player:'self',n:1}, atom sceneSetState{player:'self',state:'sleep',max:2,side:'either'} ] — draw placed FIRST so it runs unconditionally; sleep is a 0..2 short-form scene pick. [draw{n:1}: src/cards/ct-p06/B06007.ts a2 option3 (draw n:2). sceneSetState short-form sleep: handler gate src/engine/effect/atom-handlers.ts:968 (uid undefined + player string + state string + hasNorMax → paShortFormAwait builds scene pick side='either' via buildShortFormPick honoring a.side, atom-pick-spec.ts:69-84); state-value semantics from src/cards/pr-01/PR138.ts a2 (sceneSetState state:'sleep' scene pick min0). max:2 → n.min:0,n.max:2 (rules/15「〜まで」=0枚可); multi-pick → engine-extension #3 expands pickedUids to per-uid sleep atoms (apply-pick.ts:67-80). side:'either' = both fields' chars (rules/15 「キャラ」 no side restriction). REORDER RATIONALE (draw before sleep): the official sentence orders sleep-then-draw, but the draw 「カードを1枚引く」 is an unconditional separate sentence that must fire even on a 0-char sleep selection. In text order sequence:[sceneSetState(pick),draw], a 0-pick triggers the documented BUG-111 continuation-drop (resolver.ts:38-58 + apply-pick.ts drainAiEffectPicks 'pickedUid===null → continuation も一緒に drop'; documented in src/cards/ct-p04/B04064.ts header as '現状実機では不可'), dropping the draw. draw and sceneSetState-sleep are PROVABLY commutative (drawing a card cannot change scene chars/their state; sleeping scene chars cannot change the deck top; neither fires a card-triggerable hook — draw emits only internal deck:peek/file, state:change is INTERNAL-ONLY per capability-map). So sequence:[draw, sceneSetState] yields an identical game state for ALL pick counts (0/1/2) and makes the draw unconditional — a faithful implementation, not an approximation. Runtime trace verified: resolver.ts sequence runs step0 draw immediately (runAtom), then step1 sceneSetState enqueues the pick and pauses (draw already executed).]
//   - ・レベル6以下のキャラを1枚まで選び、リムーブする。(option 2) => option = atom sceneRemove{player:'self', max:1, side:'either', cause:'effect', filter:{levelMax:6}} [EXACT shape from src/cards/ct-d01/D01004.ts (sceneRemove{player:'self',max:1,side:'either',cause:'effect',filter:{apMax:8000}}) and src/cards/ct-p04/B04064.ts a1 (sceneRemove ... filter:{levelMin:8}). filter.levelMax honored on the scene-pick matchOneFilter path (capability-map TargetFilter: levelMin/levelMax inclusive, scene-char effective level). max:1 → 0枚可 (rules/15). cause:'effect' = 能力/効果によるリムーブ (rules/15).]
//   - ・キャラを1枚まで選び、ターン終了時まで〚突撃〛を与える。(option 3) => option = atom charGrantKeyword{player:'self', max:1, side:'either', kw:'突撃', scope 'turn'} (short-form scene pick on a PICKED char, not $self) [EXACT short-form shape from src/cards/ct-p09/B09032.ts a1 (charGrantKeyword{player:'self', max:1, side:'self', filter:{...}, kw:'突撃', scope 'turn'}). charGrantKeyword short-form pick gate = src/engine/effect/atom-handlers.ts:1089 (uid undefined + player string + hasNorMax → paShortFormAwait scene pick). side:'either' honored by buildShortFormPick (a.side ?? sideDefault, atom-pick-spec.ts:79). 突撃/turn semantics: B06007.ts a2 option1 grants 突撃 scope 'turn' (there to $self; here to a picked char). kw string '突撃' passed through to mutate.char.grantKeyword. max:1 → 0枚可 (rules/15). 突撃 = granted keyword (NOT printed) → keywords:[].]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '青'
      },
      {
        kind: 'caseStatus',
        status: '解決編'
      }
    ]
  },
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
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
            verb: 'sceneSetState',
            args: {
              player: 'self',
              state: 'sleep',
              max: 2,
              side: 'either'
            }
          }
        ]
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
            levelMax: 6
          }
        }
      },
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          kw: '突撃',
          scope: 'turn'
        }
      }
    ]
  },
  description: '【パートナー青】【解決編】以下から1つ選んで行う。 ・キャラを2枚まで選び、スリープさせる。カードを1枚引く。 ・レベル6以下のキャラを1枚まで選び、リムーブする。 ・キャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ]
};

export const B04014P: CardDef = {
  id: 'B04014P',
  no: '0417/B04014P',
  kind: 'event',
  names: [
    '最後の切り札'
  ],
  colors: [
    '青'
  ],
  level: 5,
  traits: [],
  rarity: 'CP',
  imageUrl: '1735287656272568.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ],
};
