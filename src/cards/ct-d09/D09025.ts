// cards/ct-d09/D09025 空城の計 (event) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   自分のリムーブエリアにあるレベル5以下の〚特徴［長野県警］〛のキャラを1枚まで選び、登場させる。ターン終了時までそのキャラに〚突撃〛（登場したターンからすぐにアクションできる）を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - (イベント自己使用トリガ) 〜このイベントを使用したとき効果本文が発動する => a1: type:'triggered' scope:'on-hand' trigger:{hook:'effect:declared', selfOnly:true, __eventUse:true} [Event self-use trigger. Exact JSON shape from src/cards/ct-p02/B02053.ts a1 (same archetype: deck event = reanimate-from-remove + ヒラメキ) and src/cards/ct-d08/D08024.ts a1 (effect:declared + selfOnly + matcher kind==='event-use'). '__eventUse':true is the codegen flag that becomes matcher:(p)=>p?.kind==='event-use' per certify-brief.md (B06071/D08024/eventRemoveByAP 同型). Hook documented in capability-map.txt effect:declared site list; payload.kind='event-use' for hand-use-card emit.]
//   - 自分のリムーブエリアにあるレベル5以下の〚特徴［長野県警］〛のキャラを1枚まで選び、登場させる。 => a1 step1: atom sceneEnter {player:'self', from:'remove', max:1, viaEffect:true, bind:'$matched', filter:{trait:'長野県警', levelMax:5, kind:'character'}} [EXACT structural twin src/cards/pr-01/PR187.ts a1 (sceneEnter {player:'self', from:'remove', max:1, viaEffect:true, bind:'$matched', filter:{trait:'警視庁', levelMax:4, kind:'character'}}) and src/cards/ct-p02/B02053.ts a1 (from:'remove', max:1, viaEffect:true, filter:{trait,levelMax,kind:'character'}). Remove-area pick candidates honor filter.trait/filter.levelMax/filter.kind: src/engine/target/candidates.ts case 'remove' (line 139) builds {kind:'card',area:'remove'} cands; matchOneFilter honors filter.trait via d?.traits (lines 247-249), filter.kind (line 270), filter.levelMax via level<=levelMax (line 294). max:1 + '1枚まで' = 0-or-1 pick (0 allowed, rules/15 '〜枚まで'). bind:'$matched' writeback to ctx.bindings verified in src/engine/effect/atom-handlers.ts sceneEnter handler (lines 641-648 store {kind:'card',uid:newChar.uid,...}; lines 632-640 also writeback to $matched). enter hook fires (capability-map: enter emitted by sceneEnter). TIER-2 player-pick surface.]
//   - ターン終了時までそのキャラに〚突撃〛（登場したターンからすぐにアクションできる）を与える。 => a1 step2: atom charGrantKeyword {uid:'$matched.uid', kw:'突撃', scope:'turn'} ['そのキャラ' = the just-reanimated char, referenced via $matched.uid. EXACT pattern in src/cards/pr-01/PR187.ts a1 (charGrantKeyword {uid:'$matched.uid', kw:'突撃[事件]', scope:'turn'} immediately after the same sceneEnter), also src/cards/pr-01/PR181.ts, src/cards/ct-p08/B08029.ts/B08029P.ts (uid:'$matched.uid' after sceneEnter), src/cards/ct-d11/D11019.ts a1. Plain kw:'突撃' grant grounded by src/cards/ct-d06/D06006.ts, src/cards/ct-d08/D08005.ts/D08011.ts, src/cards/ct-p02/B02074.ts (charGrantKeyword {uid:'$self', kw:'突撃', scope:'turn'}). bind→uid resolution proven in engine: src/engine/effect/atom-handlers.ts resolveBindRef (lines 159-175) extracts key='matched',field='uid', looks up ctx.bindings['matched'] then falls back to '$matched', returns binding[0].uid; charGrantKeyword handler (lines 924-933) calls resolveBindRef(a.uid) then mutate.char.grantKeyword(s, grantUid, '突撃', 'turn'). If 0 reanimated, $matched.uid stays unresolved ($-prefixed) -> handler early-returns (silent no-op), correct. scope:'turn' = ターン終了時まで (cleared by clearTurnEffects). 突撃 gloss = plain 突撃 (both キャラ/事件 action) matching kw:'突撃'.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => a2: type:'triggered' scope:'on-evidence' trigger:{hook:'evidence:remove-by-action', optional:true} -> atom draw {player:'self', n:1} [Canonical ヒラメキ-draw pattern. EXACT copy of src/cards/ct-d08/D08024.ts a2 and src/cards/ct-d08/D08013.ts a2 (scope:'on-evidence', hook:'evidence:remove-by-action', optional:true, effect draw n:1). capability-map.txt: evidence:remove-by-action handled by handleEvidenceRemovedHook; optional:true routes to pendingHirameki side-channel (UI/AI fire-or-skip). draw verb honored src/engine/effect/atom-handlers.ts.]

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
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          from: 'remove',
          max: 1,
          viaEffect: true,
          bind: '$matched',
          filter: {
            trait: '長野県警',
            levelMax: 5,
            kind: 'character'
          }
        }
      },
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$matched.uid',
          kw: '突撃',
          scope: 'turn'
        }
      }
    ]
  },
  description: '自分のリムーブエリアにあるレベル5以下の〚特徴［長野県警］〛のキャラを1枚まで選び、登場させる。ターン終了時までそのキャラに〚突撃〛（登場したターンからすぐにアクションできる）を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
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

export const D09025: CardDef = {
  id: 'D09025',
  no: '0509/D09025',
  kind: 'event',
  names: [
    '空城の計'
  ],
  colors: [
    '黄'
  ],
  level: 6,
  traits: [],
  rarity: 'D',
  imageUrl: '1743742883075897.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
