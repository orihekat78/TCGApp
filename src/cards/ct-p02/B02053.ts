// cards/ct-p02/B02053 「か、怪盗キッド!!!」 (event) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   自分のリムーブエリアにあるレベル7以下の【白】の〚特徴［怪盗］〛のキャラを1枚まで選び、登場させる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある【白】の〚特徴［怪盗］〛のキャラを1枚まで選び、手札に加える。
// 句マッピング:
//   - 自分のリムーブエリアにあるレベル7以下の【白】の〚特徴［怪盗］〛のキャラを1枚まで選び、登場させる。 => type:'triggered' scope:'on-hand' trigger:{hook:'effect:declared',selfOnly:true,__eventUse:true} → atom sceneEnter {player:'self',from:'remove',max:1,viaEffect:true,filter:{color:'白',trait:'怪盗',levelMax:7,kind:'character'}} [Event self-use trigger + reanimate-from-remove: exact shape from src/cards/ct-d08/D08024.ts a1 (effect:declared selfOnly + matcher kind==='event-use' → sceneEnter {from:'remove',max:1,viaEffect:true,filterAny:[{cardName,levelMax}, {trait,levelMax}]}); single-filter form from src/cards/ct-p02/B02004.ts a1. __eventUse codegen flag → that matcher closure per certify-brief.md. color/trait/levelMax/kind filter honored on remove-area card-candidate pick: src/engine/target/candidates.ts case 'remove' (lines 139-146) builds {kind:'card',area:'remove'} cands → matchesFiltersByCardId → matchOneFilter; filter.color (lines 253-256 d?.colors), filter.trait (lines ~248-252 d?.traits), filter.levelMax (level=base?.level for c===null), filter.kind (d?.kind===filter.kind) all honored. enter hook fires (Q&A: 登場時 of reanimated char DOES fire) — capability-map 'enter emitted by sceneEnter'.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある【白】の〚特徴［怪盗］〛のキャラを1枚まで選び、手札に加える。 => type:'triggered' scope:'on-evidence' trigger:{hook:'evidence:remove-by-action',optional:true} → atom handAddFromRemove {player:'self',max:1,filter:{color:'白',trait:'怪盗',kind:'character'}} [Hirameki trigger shape from src/cards/ct-d08/D08024.ts a2 (scope:'on-evidence', hook:'evidence:remove-by-action', optional:true). handAddFromRemove exact args (player/max/filter, defaultArea=remove Pattern B) from src/cards/ct-p02/B02004.ts a2 (handAddFromRemove {player:'self',max:1,filter:{cardName,kind:'character'}}). color/trait/kind filter honored via same candidates.ts matchOneFilter remove-area path. NO levelMax here (hirameki text omits the level cap, unlike effect) — modeled accordingly.]

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
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      filter: {
        color: '白',
        trait: '怪盗',
        levelMax: 7,
        kind: 'character'
      }
    }
  },
  description: '自分のリムーブエリアにあるレベル7以下の【白】の〚特徴［怪盗］〛のキャラを1枚まで選び、登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/17-icons.md'
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
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        color: '白',
        trait: '怪盗',
        kind: 'character'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある【白】の〚特徴［怪盗］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md'
  ]
};

export const B02053: CardDef = {
  id: 'B02053',
  no: '0218/B02053',
  kind: 'event',
  names: [
    '「か、怪盗キッド!!!」'
  ],
  colors: [
    '白'
  ],
  level: 7,
  traits: [],
  rarity: 'C',
  imageUrl: '1721357250058468.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
