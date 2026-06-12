// cards/pr-01/PR262 遠山銀司郎 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/11-reasoning.md, rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）\n【登場時】自分の現場にいる〚特徴［警察］〛のキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。
// 句マッピング:
//   - 〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する） => _shared misreadX({x:1}) → type:'icon-misread' (engine listeners/misread.ts applies sleep + LP-1 on opponent reasoning via reasoning:before-add) [src/cards/_shared/misreadX.ts (returns {type:'icon-misread',effect:{atom noop misread-marker x}}); identical live print src/cards/ct-d02/D02009.ts (同名 遠山銀司郎, exact same 〚ミスリード1〛 text uses misreadX({x:1})); capability-map §A misreadX + §3 icon-misread]
//   - 【登場時】... のキャラを1枚まで選び ... 上から1枚裏向きでセットする (登場時トリガ + 1枚まで pick) => type:'triggered', scope:'on-scene', trigger:{hook:'enter',selfOnly:true}; charSetCard short-form pick max:1 (n.min=0,n.max=1 → 0枚可='1枚まで') [src/cards/ct-p02/B02023.ts a1 (text『自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする』= identical minus trait filter; same args {player:'self',max:1,side:'self',fromDeckTop:true,faceUp:false}); enter hook = capability-map §B; charSetCard short-form = src/engine/effect/atom-handlers.ts:1005-1018]
//   - 自分の現場にいる ... のキャラ (side gate = 自陣 scene) => charSetCard short-form side:'self' → buildShortFormPick query {area:'scene', side:'self'} [src/engine/effect/atom-pick-spec.ts buildShortFormPick L76-82 (side defaults forwarded into query); B02023/B02030 use side:'self']
//   - 〚特徴［警察］〛のキャラ (trait filter 警察) => charSetCard short-form filter:{trait:'警察'} → forwarded into pick query.filter → matchOneFilter honors trait for scene-char candidates [src/engine/effect/atom-pick-spec.ts:78 (if(a.filter) query.filter=a.filter); src/engine/target/candidates.ts:247-251 (filter.trait honored vs def.traits); B02046.ts uses charSetCard with filter (color:'白') confirming filter path on this verb]
//   - 自分のデッキのカードを上から1枚裏向きでセットする => charSetCard fromDeckTop:true (deck top shift of player 'self'), faceUp:false (裏向き) [src/engine/effect/atom-handlers.ts:1032-1044 (fromDeckTop → sscDeck.shift → mutate.char.setCard with a.faceUp); B02023.ts a1 fromDeckTop:true,faceUp:false]

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1 = misreadX({
  x: 1,
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: {
      player: 'self',
      max: 1,
      side: 'self',
      filter: {
        trait: '警察'
      },
      fromDeckTop: true,
      faceUp: false
    }
  },
  description: '【登場時】自分の現場にいる〚特徴［警察］〛のキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md'
  ]
};

export const PR262: CardDef = {
  id: 'PR262',
  no: '1053/PR262',
  kind: 'character',
  names: [
    '遠山銀司郎'
  ],
  colors: [
    '緑'
  ],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: [
    '警察',
    '大阪府警'
  ],
  rarity: 'PR',
  imageUrl: '1774884005645949.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/11-reasoning.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md'
  ],
};
