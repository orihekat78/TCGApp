// cards/ct-d10/D10021 工藤新一 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【パートナー青】【宣言】【スリープ】：レベル6以下の〚カード名［毛利蘭］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［江戸川コナン］〛を1枚まで選び、手札に加える。
// 句マッピング:
//   - 【パートナー青】 => a1.condition = {kind 'partnerColor', color:'青'} [cond/eval.ts partnerColor: owner's partner CardDef.colors intersects color (capability-map L142). EXACT exemplar src/cards/ct-p07/B07040.ts a1: condition:{kind 'partnerColor', color:'白'} on a declared ability that grants 突撃 scope turn to a picked scene char — identical archetype.]
//   - 【宣言】【スリープ】（コスト） => a1.type='declared', a1.cost={kind 'sleepSelf'} [COST_KIND_MAP sleepSelf sleeps ctx.source.uid, payable only if active (capability-map cost §1 L380; sleep/stun => unpayable => 宣言不可). EXACT exemplar src/cards/ct-p09/B09042.ts a1: type 'declared', scope 'on-scene', cost:{kind 'sleepSelf'} — structural twin of this card (同 deck cycle 工藤新一/江戸川文代).]
//   - レベル6以下の〚カード名［毛利蘭］〛のキャラを1枚まで選び => a1 charGrantKeyword target = pick {area:'scene', side:'either', filter:{cardName:'毛利蘭', levelMax:6}, n:{min:0,max:1}} [No '自分の' prefix in text => either side (rules/15 §対象指定: エリア指定なしのキャラ=現場どちらでも). side:'either'+filter:{...,levelMax:N} exemplar src/cards/ct-d02/D02013.ts a1 (scene/either/levelMax:6 pick → 突撃 grant). cardName filter honored by matchOneFilter via allCardNameComponentsForDef (candidates.ts L260-262, split-name rules/19); levelMax honored candidates.ts L321. '1枚まで'=>n.min:0 skippable (atom-pick-spec.ts L76-84 max-only => nMin 0; rules/15 '〜枚まで'=0枚可).]
//   - ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える => a1 atom charGrantKeyword {uid:'$pick', kw:'突撃', scope 'turn', target} [charGrantKeyword args {uid,kw,scope} => mutate.char.grantKeyword (capability-map L49). scope 'turn'='ターン終了時まで' (cleared by clearTurnEffects). 突撃 gloss '（登場したターンからすぐにアクションできる）'=plain 突撃 (キャラ+事件両方) => kw:'突撃' (NOT 突撃[キャラ]); confirmed by src/cards/ct-d09/D09025.ts (同 gloss => kw:'突撃' scope 'turn') and src/cards/ct-p09/B09042.ts a1 (kw:'突撃' scope 'turn'). $pick+target single-option wrapped in choice mirrors B09042/D02013 codegen convention. Pattern A $pick 0-pick => skipped no-op (capability-map L95-98).]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => a2.type='triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true} [Canonical ヒラメキ encoding (capability-map hooks §evidence:remove-by-action L324-326 / §Hirameki L332): triggered + on-evidence + optional:true => pendingHirameki side-channel (UI/AI fire-or-skip). EXACT exemplar src/cards/ct-p09/B09042.ts a2 and src/cards/ct-d08/D08013.ts a2.]
//   - 自分のリムーブエリアにある〚カード名［江戸川コナン］〛を1枚まで選び、手札に加える => a2 atom handAddFromRemove {player:'self', max:1, filter:{cardName:'江戸川コナン'}} [handAddFromRemove splices remove->hand, short-form defaultArea='remove' (capability-map L30; atom-handlers.ts L619). cardName filter honored on remove candidates via matchesFiltersByCardId/matchOneFilter (candidates.ts case 'remove' L160-167 -> L260). max:1 => n:{min:0,max:1} = '1枚まで' (0 allowed). EXACT exemplar src/cards/ct-p09/B09042.ts a2 (same verb+max+cardName filter).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '青'
  },
  cost: {
    kind: 'sleepSelf'
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$pick',
          kw: '突撃',
          scope: 'turn',
          target: {
            kind: 'pick',
            query: {
              area: 'scene',
              side: 'either',
              filter: {
                cardName: '毛利蘭',
                levelMax: 6
              }
            },
            n: {
              min: 0,
              max: 1
            },
            chooser: 'self'
          }
        }
      }
    ]
  },
  description: '【パートナー青】【宣言】【スリープ】：レベル6以下の〚カード名［毛利蘭］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
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
        cardName: '江戸川コナン'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［江戸川コナン］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/19-special-rules.md'
  ]
};

export const D10021: CardDef = {
  id: 'D10021',
  no: '0263/D10021',
  kind: 'character',
  names: [
    '工藤新一'
  ],
  colors: [
    '青'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '探偵',
    '高校生'
  ],
  rarity: 'D',
  imageUrl: '1761835704407470.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/21-declared-ability-cost.md'
  ],
};
