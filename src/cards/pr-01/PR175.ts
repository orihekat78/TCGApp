// cards/pr-01/PR175 工藤新一 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/10-action-event.md
// 公式テキスト:
//   【パートナー青】【宣言】【スリープ】：レベル6以下の〚カード名［毛利蘭］〛のキャラを1枚まで選び、ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える。
//   【ヒラメキ】自分のリムーブエリアにある〚カード名［江戸川コナン］〛を1枚まで選び、手札に加える。
// 句マッピング:
//   - 【パートナー青】 => condition {kind:'partnerColor', color:'青'} [condition partnerColor — cond/eval.ts (capability-map §Case/partner color); exemplar B07040 a1 uses {kind:'partnerColor', color:'白'} on a declared 突撃-grant character (src/cards/ct-p07/B07040.ts)]
//   - 【宣言】 => type:'declared', scope:'on-scene' [AbilityType 'declared' (capability-map §3); exemplar B07040 a1 / B03010 a1 are declared character abilities scope:'on-scene' (src/cards/ct-p07/B07040.ts, src/cards/ct-p03/B03010.ts)]
//   - 【スリープ】：(コスト) => cost {kind:'sleepSelf'} [Cost sleepSelf — cost/pay.ts (sleeps ctx.source.uid; payable only if active); exemplar B03010 a1 declared char ability uses cost:{kind:'sleepSelf'} for the same 【宣言】【スリープ】 cost (src/cards/ct-p03/B03010.ts)]
//   - レベル6以下の〚カード名［毛利蘭］〛のキャラを1枚まで選び => charGrantKeyword target pick {area:'scene', side:'either', filter:{cardName:'毛利蘭', levelMax:6}, n:{min:0,max:1}, chooser:'self'} [cardName filter honored on the canonical pick-enumeration path — src/engine/target/candidates.ts:239-244 matchOneFilter cardName via allCardNameComponentsForDef (split-name aware); levelMax honored same path; '1枚まで'=n.min:0 (0-pick legal, capability-map pick mechanisms). Target-pick shape copied from B07040 a1 charGrantKeyword target (filter:{trait:[...]}, n:{min:0,max:1}) (src/cards/ct-p07/B07040.ts)]
//   - ターン終了時まで〚突撃〛（登場したターンからすぐにアクションできる）を与える => atom charGrantKeyword {uid:'$pick', kw:'突撃', scope:'turn'} [charGrantKeyword honored (atom-handlers.ts; capability-map §Char modify). Plain '突撃' recognized for 名乗り-exception across all action kinds at src/engine/flow/main/action.ts:54 (kws.includes('突撃')→true); turn-scoped grant merged into effective keywords via src/engine/read/char.ts:122-123. Exemplar B07040 a1 uses charGrantKeyword uid:'$pick', kw:'突撃[キャラ]', scope:'turn' (same verb/scope; PR175 grants the plain '突撃' form) (src/cards/ct-p07/B07040.ts)]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => type:'triggered', scope:'on-evidence', trigger:{hook:'evidence:remove-by-action', optional:true} [Hirameki = triggered + scope:'on-evidence' + hook:'evidence:remove-by-action' + optional:true (capability-map §hooks; handleEvidenceRemovedHook src/engine/listeners/triggered.ts:334; optional→pushPendingHirameki). Exemplar D08019 a2 / B05050 a2 verbatim trigger shape (src/cards/ct-d08/D08019.ts, src/cards/ct-p05/B05050.ts)]
//   - 自分のリムーブエリアにある〚カード名［江戸川コナン］〛を1枚まで選び、手札に加える => atom handAddFromRemove {player:'self', max:1, filter:{cardName:'江戸川コナン'}} [handAddFromRemove short-form (defaultArea:'remove', mode:'PB', sourceSplice) — src/engine/effect/atom-pick-spec.ts:32; remove-area pick routes through matchesFiltersByCardId→matchOneFilter so cardName honored (candidates.ts:139-144 + :239). Exemplar B05050 a1 uses handAddFromRemove {player:'self', max:1, filter:{...}} short-form (src/cards/ct-p05/B05050.ts). Hirameki-fire dispatch surfaces resulting Pattern-B pick via pendingEffectPick (src/ui/hooks/useEngineDispatch.ts:323-360, 544-550). Text has no 'のキャラ' qualifier → cardName only (no kind filter)]

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
  description: '【ヒラメキ】自分のリムーブエリアにある〚カード名［江戸川コナン］〛を1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md'
  ]
};

export const PR175: CardDef = {
  id: 'PR175',
  no: '0263/PR175',
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
  rarity: 'PR',
  imageUrl: '1759195553205989.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/10-action-event.md'
  ],
};
