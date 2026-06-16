// cards/ct-p04/B04022P 光本兵我 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】手札からレベル4以下の〚カード名［服部平次］〛のキャラを1枚までスリープ状態で登場させる。
// 句マッピング:
//   - 【相手ターン中】 => ability.condition {kind 'turn',player:'opp'} [Condition 'turn'{player:'self'|'opp'} fully evaluated in src/engine/cond/eval.ts (capability-map line 139, 'current turn player equals resolved player. 【自分ターン中】/【相手ターン中】'); no stub/throw. Exemplars src/cards/ct-p03/B03012.ts a1 and src/cards/ct-p07/B07075.ts a1 use condition:{kind 'turn',player:'opp'} for the word-for-word identical 【相手ターン中】 prefix.]
//   - 【現場リムーブ時】(このキャラ自身がリムーブされたとき) => trigger {hook 'leave:to-remove',selfOnly:true}, scope 'on-scene' [leave:to-remove is a registered card-triggerable hook (capability-map line 292; brief 解消済 gate, leave:to-remove STALE-fix 実装済). Emitted by src/engine/mutate/scene.ts on removal; dual path handleLeaveToRemoveSelf serves the leaving card's OWN 【現場リムーブ時】 via virtual scene location; selfOnly supported (source.uid). Exemplars B03012.ts a1 and B07075.ts a1 use the identical trigger {hook 'leave:to-remove',selfOnly:true} + scope 'on-scene'.]
//   - 手札から…のキャラを…登場させる => atom sceneEnter {player:'self', from:'hand', viaEffect:true} [src/engine/effect/atom-handlers.ts:730 — cardId===undefined && typeof from==='string' && hasNorMax(a) → buildShortFormPick(a.from='hand', ...) builds pick query {area:'hand',side:'self'} + cardId='$pick.cardId'. Line 790-793: sourceArea==='hand' splices the picked cardId out of self hand (prevents dup). viaEffect default true (line 740). Exemplar B03012.ts a1 uses sceneEnter{player:'self',from:'hand',viaEffect:true}.]
//   - レベル4以下の => filter.levelMax:4 [TargetFilter.levelMin/levelMax fields (capability-map TargetFilter section; src/engine/types/effect.ts). matchOneFilter honors levelMax. Exemplar B03012.ts a1 uses filter.levelMax:6 (same clause shape, different value); B07075.ts a1 uses levelMax:5.]
//   - 〚カード名［服部平次］〛 => filter.cardName:'服部平次' [TargetFilter.cardName accepts string|string[] (capability-map line 239). src/engine/effect/atom-handlers.ts:102 normalizes single string → [string] and matches via allCardNameComponentsForDef(d) (rules/19 split-name, single source of truth shared with candidates.ts matchOneFilter, comment line 23/94). Single-string cardName proven in exemplars B03012.ts a1 (cardName:'工藤新一') and ct-d10/D10011.ts (from:'remove', cardName:'毛利蘭').]
//   - のキャラ => filter.kind 'character' [TargetFilter.kind('character'|'event') (capability-map TargetFilter section). atom-handlers.ts:91 'kind は TargetFilter 型に昇格済 (matchOneFilter と統一)'. Exemplar B03012.ts a1 uses kind 'character'.]
//   - を1枚まで => args.max:1 → buildShortFormPick n:{min:0,max:1} (0-pick legal, skippable) [src/engine/effect/atom-pick-spec.ts:76-77 — no `n` + `max` → nMin=0, nMax=max. So max:1 yields n:{min:0,max:1} = 「〜枚まで」(0枚可, rules/15 量指定子). Exemplar B03012.ts a1 / B07075.ts a1 both use max:1 for the identical 「1枚まで」 wording.]
//   - スリープ状態で登場させる => args.enterSleep:true [src/engine/effect/atom-handlers.ts:809 — active: a.enterSleep===true ? false : undefined; mutate.scene.enter creates state 'sleep' when active===false (rules/03). Exemplar B07075.ts a1 uses enterSleep:true on the structurally identical 【相手ターン中】【現場リムーブ時】手札から…スリープ状態で登場 text.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'turn',
    player: 'opp'
  },
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'hand',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: {
        cardName: '服部平次',
        levelMax: 4,
        kind: 'character'
      }
    }
  },
  description: '【相手ターン中】【現場リムーブ時】手札からレベル4以下の〚カード名［服部平次］〛のキャラを1枚までスリープ状態で登場させる。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/03-field-areas.md',
    'rules/20-color-and-switch.md',
    'rules/19-special-rules.md'
  ]
};

export const B04022P: CardDef = {
  id: 'B04022P',
  no: '0423/B04022P',
  kind: 'character',
  names: [
    '光本兵我'
  ],
  colors: [
    '緑'
  ],
  level: 3,
  ap: 2000,
  lp: 1,
  traits: [
    'アイドル'
  ],
  rarity: 'CP',
  imageUrl: '1735287737404193.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md'
  ],
};
