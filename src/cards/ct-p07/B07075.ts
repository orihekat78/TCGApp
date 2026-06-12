// cards/ct-p07/B07075 宮野エレーナ (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/19-special-rules.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】手札からレベル5以下の〚カード名［シェリー］〛か〚［宮野志保］〛か〚［宮野明美］〛か〚［降谷零］〛のキャラを1枚までスリープ状態で登場させる。
// 句マッピング:
//   - 【相手ターン中】 => ability.condition {kind:'turn',player:'opp'} [cond/eval.ts `turn` (capability-map E); exemplar B02004.ts a2 / B03012.ts a1 / B04007.ts a1 use condition:{kind:'turn',player:'opp'} for 【相手ターン中】]
//   - 【現場リムーブ時】(this char itself removed) => trigger {hook:'leave:to-remove',selfOnly:true}, scope:'on-scene' [triggered.ts leave:to-remove dual path handleLeaveToRemoveSelf for the leaving card's own 【現場リムーブ時】, selfOnly via source.uid (capability-map hooks §leave:to-remove); exemplar B02004.ts a2 / B03012.ts a1 identical idiom]
//   - 手札から…キャラを登場させる => atom sceneEnter {player:'self', from:'hand', viaEffect:true} [atom-handlers.ts:473 short-form (cardId undefined + from + hasNorMax) → buildShortFormPick('hand',a,self,self), :533 hand source splice; exemplar B03012.ts a1 (from:'hand')]
//   - レベル5以下 => filter.levelMax:5 [atom-handlers.ts:82 levelMax honored; matchOneFilter levelMin/levelMax (capability-map F); exemplar B03012.ts a1 (levelMax:6)]
//   - 〚カード名［シェリー］〛か〚［宮野志保］〛か〚［宮野明美］〛か〚［降谷零］〛 => filter.cardName: ['シェリー','宮野志保','宮野明美','降谷零'] (string[] OR membership) [capability-map line 239 cardName string|string[] OR via allCardNameComponentsForDef; exemplar B08056.ts (cardName:['宮野エレーナ','宮野志保','宮野明美'] hand pick) and PR101.ts (cardName:['降谷零',...]) prove array honored in pick filter]
//   - のキャラ => filter.kind:'character' [atom-handlers.ts:84 kind honored; matchOneFilter kind('character'|'event') (capability-map F); exemplar B03012.ts a1 (kind:'character')]
//   - を1枚まで => args.max:1 → buildShortFormPick n:{min:0,max:1} (0-pick skippable) [atom-pick-spec.ts buildShortFormPick: no `n` + `max` → nMin=0,nMax=max (0-pick legal = 「〜枚まで」); exemplar B03012.ts a1 (max:1)]
//   - スリープ状態で登場 => args.enterSleep:true [atom-handlers.ts:552 active = enterSleep===true ? false : undefined → mutate.scene.enter生成 sleep (rules/03); exemplar B04007.ts a1 (enterSleep:true with sceneEnter)]

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
        cardName: [
          'シェリー',
          '宮野志保',
          '宮野明美',
          '降谷零'
        ],
        levelMax: 5,
        kind: 'character'
      }
    }
  },
  description: '【相手ターン中】【現場リムーブ時】手札からレベル5以下の〚カード名［シェリー］〛か〚［宮野志保］〛か〚［宮野明美］〛か〚［降谷零］〛のキャラを1枚までスリープ状態で登場させる。',
  ruleRefs: [
    'rules/17-icons.md',
    'rules/15-abilities-effects.md',
    'rules/03-field-areas.md',
    'rules/20-color-and-switch.md',
    'rules/19-special-rules.md'
  ]
};

export const B07075: CardDef = {
  id: 'B07075',
  no: '0804/B07075',
  kind: 'character',
  names: [
    '宮野エレーナ'
  ],
  colors: [
    '赤'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '科学者',
    '医師'
  ],
  rarity: 'C',
  imageUrl: '1762414027318561.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/19-special-rules.md'
  ],
};
