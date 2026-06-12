// cards/ct-p03/B03101 横溝参悟 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
// 公式テキスト:
//   【登場時】〚ミスリード〛を持つキャラを1枚まで選び、スリープさせる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - 【登場時】 => trigger:{hook:'enter',selfOnly:true} on type:'triggered',scope:'on-scene' [hook 'enter' = 【登場時】 per capability-map hooks section (payload {uid,viaEffect,enterOrder,enterOrderThisTurn}, selfOnly ok). Exemplars: B01011.ts a1 (enter+selfOnly), D11009.ts a2 (enter+selfOnly+sceneSetState).]
//   - 〚ミスリード〛を持つキャラを1枚まで選び、スリープさせる => atom sceneSetState {player:'self',max:1,side:'either',state:'sleep',filter:{keyword:'ミスリード'}} [Verb shape copied from B07101.ts a1 (sceneSetState {player:'self',max:1,side:'either',state:'sleep',filter:{levelMin:5}} = 'X を1枚まで選びスリープ') and D11009.ts a2 (no filter, both sides). 'キャラ' no-side = 現場 both sides per rules/15 → side:'either'. '1枚まで' = max:1 (nMin=0, 0-pick legal, capability-map pick mechanisms). filter keyword:'ミスリード' honored by matchOneFilter at src/engine/target/candidates.ts:259-264 → defHasKeyword(src/engine/read/keyword.ts) which returns true for any ability with type:'icon-misread' (BUG-122). Misread holders use type:'icon-misread' (src/cards/_shared/misreadX.ts). Trait/keyword-filter pick precedent: B03017.ts a1 (filter:{trait:'少年探偵団'} same short-form).]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => type:'triggered',scope:'on-evidence',trigger:{hook:'evidence:remove-by-action',optional:true},effect:atom draw {player:'self',n:1} [EXACT copy of B01011.ts a2 and D11009.ts a3-shape (hirameki). capability-map hooks: 'evidence:remove-by-action' = 【ヒラメキ】, optional:true routes to pendingHirameki side-channel (UI/AI fire/skip). draw n:1 is a no-pick atom so the spec caveat about short-form pick auto-resolve at fire time does NOT apply.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      state: 'sleep',
      filter: {
        keyword: 'ミスリード'
      }
    }
  },
  description: '【登場時】〚ミスリード〛を持つキャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
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

export const B03101: CardDef = {
  id: 'B03101',
  no: '0354/B03101',
  kind: 'character',
  names: [
    '横溝参悟'
  ],
  colors: [
    '黄'
  ],
  level: 3,
  ap: 3000,
  lp: 1,
  traits: [
    '警察',
    '静岡県警'
  ],
  rarity: 'C',
  imageUrl: '1729133463310311.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ],
};
