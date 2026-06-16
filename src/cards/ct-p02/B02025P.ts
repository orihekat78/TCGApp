// cards/ct-p02/B02025P 遠山和葉 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある【カットイン】を持つ【緑】のカードを1枚まで選び、手札に加える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある【カットイン】を持つ【緑】のカードを1枚まで選び、手札に加える。
// 句マッピング:
//   - 【相手ターン中】 (a1 condition) => condition:{kind 'turn', player:'opp'} [cap-map line 139 'turn {player:self|opp}' = 自分/相手ターン中; live exemplar B02004.ts a2 condition:{kind 'turn',player:'opp'} and B03012.ts a1 — both pure JSON, identical icon.]
//   - 【現場リムーブ時】 (a1 trigger, self) => trigger {hook 'leave:to-remove', selfOnly:true} [cap-map line 292 leave:to-remove 現場リムーブ時 (any cause), selfOnly supported; emitted by mutate/scene.ts; live exemplar B02004.ts a2 / B03012.ts a1 trigger {hook 'leave:to-remove',selfOnly:true}.]
//   - 自分のリムーブエリアにある...カードを1枚まで選び、手札に加える (a1 effect) => atom verb 'handAddFromRemove' args:{player:'self', max:1, filter:{...}} [atom-pick-spec.ts:32 handAddFromRemove {defaultArea:'remove', mode:'PB', sourceSplice:true} = リムーブ pile から splice→hand; live exemplar B02004.ts a2 verb 'handAddFromRemove' args:{player:'self',max:1,filter}. 'max:1' → buildShortFormPick (atom-pick-spec.ts:76-84) n.min:0/n.max:1 = '1枚まで'=0枚可.]
//   - 【カットイン】を持つ...カード (filter keyword) => filter.keyword:'カットイン' [candidates.ts:280-285 matchOneFilter honors filter.keyword via defHasKeyword (BUG-122) which absorbs icon-ability カットイン/ヒラメキ/変装/ミスリード; cap-map 577-579 confirms keyword:'カットイン' works in all matchOneFilter paths; live exemplar B03128.ts filter:{keyword:'カットイン',color:'黒'}.]
//   - 【緑】の...カード (filter color) => filter.color:'緑' [candidates.ts:274-277 matchOneFilter checks def.colors includes filter.color; standard CardDef field; B03128.ts uses color:'黒' in same filter shape.]
//   - ...カード (no kind restriction — text says 'カード' not 'キャラ') => filter omits kind 'character' [B03128.ts comment: text '【カットイン】を持つ【黒】のカード' → kind 制限なし (events also eligible). B02025 text identically says 'カード' (not 'のキャラ') so kind omitted; contrast B02004/B03012 which say 'のキャラ' and include kind 'character'.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） (a2 trigger) => trigger {hook 'evidence:remove-by-action', optional:true}, scope 'on-evidence' [cap-map 324-326/332 ヒラメキ = type 'triggered' + trigger {hook 'evidence:remove-by-action', optional:true} typically scope 'on-evidence'; optional:true → pendingHirameki UI fire/skip; live exemplar B03012.ts a2 / B02009/B03059 same shape.]
//   - (a2 effect = identical to a1 effect) => atom verb 'handAddFromRemove' args:{player:'self', max:1, filter:{keyword:'カットイン', color:'緑'}} [Same as a1 effect grounding (handAddFromRemove + keyword/color filter). B03012.ts a2 demonstrates handAddFromRemove inside an evidence:remove-by-action hirameki ability — pure JSON.]

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
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        keyword: 'カットイン',
        color: '緑'
      }
    }
  },
  description: '【相手ターン中】【現場リムーブ時】自分のリムーブエリアにある【カットイン】を持つ【緑】のカードを1枚まで選び、手札に加える。',
  ruleRefs: [
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
    verb: 'handAddFromRemove',
    args: {
      player: 'self',
      max: 1,
      filter: {
        keyword: 'カットイン',
        color: '緑'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある【カットイン】を持つ【緑】のカードを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ]
};

export const B02025P: CardDef = {
  id: 'B02025P',
  no: '0195/B02025P',
  kind: 'character',
  names: [
    '遠山和葉'
  ],
  colors: [
    '緑'
  ],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'CP',
  imageUrl: '1721357211005056.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md'
  ],
};
