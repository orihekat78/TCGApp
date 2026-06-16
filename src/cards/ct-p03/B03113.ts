// cards/ct-p03/B03113 シェリー (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/09-cutin-disguise.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある 【カットイン】を持つレベル6以下の【黒】の〚カード名［シェリー］〛以外のキャラを1枚まで選び、スリープ状態で登場させる。
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
// 句マッピング:
//   - 【相手ターン中】 => a1.condition = {kind 'turn', player:'opp'} [src/engine/cond/eval.ts case 'turn' returns state.turn.player === resolvePlayer(cond.player,ctx); turn registered in CONDITION_KIND_MAP. Exemplar src/cards/ct-p03/B03079.ts a1 uses IDENTICAL {kind 'turn',player:'opp'} for the same 【相手ターン中】【現場リムーブ時】 trigger text.]
//   - 【現場リムーブ時】(このキャラ自身がリムーブされたとき) => a1.trigger = {hook 'leave:to-remove', selfOnly:true}, scope 'on-scene' [src/engine/read/keyword.ts:56 abilityIsSceneRemoveTrigger = type 'triggered' + trigger.selfOnly===true + hook 'leave:to-remove' is the canonical 【現場リムーブ時】 form (selfOnly = self being removed, distinct from §反撃 observer which OMITS selfOnly, e.g. B01007 a1). Exemplars src/cards/ct-p03/B03079.ts a1 + ct-p03/B03089.ts a1-family use this VERBATIM.]
//   - 自分のリムーブエリアにある … キャラを … 登場させる => a1.effect sceneEnter {player:'self', from:'remove', viaEffect:true} [src/cards/ct-p02/B02038.ts a2 is VERBATIM this shape: sceneEnter{player:'self', from:'remove', max:1, viaEffect:true, enterSleep:true, filter:{...}} for the same 「自分のリムーブエリアにある…キャラを1枚まで選び、スリープ状態で登場させる」. atom-handlers.ts:738 sceneEnter short-form builds pick via buildShortFormPick(a.from,...) → candidates → matchOneFilter. viaEffect:true = 効果による登場 (rules/20 色制限免除).]
//   - 【カットイン】を持つ (filter on remove candidates) => a1 filter.keyword = 'カットイン' [src/engine/target/candidates.ts:290-296 matchOneFilter honors filter.keyword via defHasKeyword(d,w) (BUG-122 fix; comment cites B05112「【カットイン】を持つキャラ」). src/engine/read/keyword.ts:90 defHasKeyword + ICON_KEYWORD_PREDICATES{カットイン: abilityIsCutin (keyword.ts:19)}. Resolves on remove candidate (CardDef-static, c===null). 【カットイン】 = ICON name → allowed by STILL-OPEN gate ('keyword filter は keyword/icon 名のみ'); only hook-系 presence is barred.]
//   - レベル6以下 => a1 filter.levelMax = 6 [src/engine/target/candidates.ts matchOneFilter: level = (base.level ?? 0) + lvl mods; filter.levelMax !== undefined && level > filter.levelMax → false. Remove candidate uses CardDef static base.level (c===null → mods 0). Exemplar B02038.ts a2 uses levelMax:4 on remove pick.]
//   - 【黒】の => a1 filter.color = '黒' [src/engine/target/candidates.ts matchOneFilter color block: wants.some(w => d.colors.includes(w)). Remove candidate uses CardDef.colors. Exemplar B02038.ts a2 filter:{color:'白'} (same shape, color differs).]
//   - 〚カード名［シェリー］〛以外 => a1 filter.cardNameNot = 'シェリー' [src/engine/target/candidates.ts:255-265 matchOneFilter cardNameNot block (cluster16): nots.some(w => allCardNameComponentsForDef(d).includes(w)) → return false (exclude). Symmetric to positive cardName; split-name (rules/19) component-level; name-based (not uid) so same-name 2nd copy also excluded — correct primitive. TargetFilter.cardNameNot declared in src/engine/types/effect.ts (cluster16). brief §cluster16 G1 = GREEN. THIS WAS THE PRIOR YELLOW BLOCKER (re-certify post-cluster16).]
//   - キャラ => a1 filter.kind = 'character' [src/engine/target/candidates.ts matchOneFilter: filter.kind !== undefined && d.kind !== filter.kind → false (BUG-118). Required for remove/hand/deck char picks (BUG-123). Exemplar B02038.ts a2 filter includes kind 'character'.]
//   - 1枚まで選び => a1 sceneEnter max:1 short-form → pick n:{min:0,max:1} [atom-handlers.ts:738 sceneEnter short-form with from+max builds pick; '1枚まで' = max:1 → n.min:0 (0-pick legal, rules/15). Exemplar B02038.ts a2 uses max:1 for 「1枚まで」. Player selection at resolution → tier 2.]
//   - スリープ状態で登場させる => a1 sceneEnter enterSleep:true [src/cards/ct-p02/B02038.ts a2 + ct-d05/D05006.ts a1 use enterSleep:true for 「スリープ状態で登場させる」 (grep enterSleep). sceneEnter args include enterSleep per capability-map sceneEnter signature.]
//   - 【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う） => a2 = icon-cutin ability {type 'triggered', scope 'on-hand', trigger {hook 'effect:declared', optional:true, selfOnly:true}, effect: charModifyAP{uid:'$contact.byUid', delta:1000, scope 'contact'}} [src/cards/ct-d01/D01009.ts a1 is BYTE-IDENTICAL (same cutIn text 【カットイン】AP＋1000): on-hand triggered effect:declared optional+selfOnly, charModifyAP $contact.byUid delta:1000 scope 'contact'. src/engine/read/keyword.ts:19 abilityIsCutin matches this shape. This also makes B03113 itself satisfy defHasKeyword('カットイン') (correct: printed icon), and cardNameNot:'シェリー' correctly excludes B03113 from its own a1 re-summon.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true
  },
  condition: {
    kind: 'turn',
    player: 'opp'
  },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: {
        keyword: 'カットイン',
        levelMax: 6,
        color: '黒',
        cardNameNot: 'シェリー',
        kind: 'character'
      }
    }
  },
  description: '【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある 【カットイン】を持つレベル6以下の【黒】の〚カード名［シェリー］〛以外のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
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
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      uid: '$contact.byUid',
      delta: 1000,
      scope: 'contact'
    }
  },
  description: '【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B03113: CardDef = {
  id: 'B03113',
  no: '0362/B03113',
  kind: 'character',
  names: [
    'シェリー'
  ],
  colors: [
    '黒'
  ],
  level: 5,
  ap: 4000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'R',
  imageUrl: '1729133482977047.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/20-color-and-switch.md',
    'rules/22-qa-action-contact.md'
  ],
};
