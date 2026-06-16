// cards/ct-p04/B04031P 中森青子 (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【宣言】【スリープ】：〚カード名［黒羽快斗］〛のキャラを1枚まで選び、ターン終了時までAP＋1000し、〚突撃〛（登場したターンからすぐにアクションできる）を与える。
// 句マッピング:
//   - 【宣言】【スリープ】 => AbilityDef type 'declared' + cost:{kind 'sleepSelf'} [src/cards/ct-p01/B01027.ts a2 (遠山和葉) — near-twin card, identical 【宣言】【スリープ】 declared+sleepSelf. Also src/cards/ct-p07/B07079.ts a2 declared. sleepSelf is in COST_KIND_MAP (src/engine/cost/evaluate.ts:14, case at :27). 【宣言】=declared per brief 規約.]
//   - 〚カード名［黒羽快斗］〛のキャラを1枚まで選び => charModifyAP short-form carrier pick: { max:1, side:'either', filter:{cardName:'黒羽快斗'} } [cardName scene-pick filter exemplar src/cards/ct-p01/B01027.ts a2 (filter:{cardName:'服部平次'}). buildShortFormPick passes a.filter through to query (src/engine/effect/atom-pick-spec.ts:80). cardName candidate filtering honored incl split-name rules/19 (src/engine/target/candidates.ts:260-262, atom-handlers.ts:101-102 allCardNameComponentsForDef). 「1枚まで」=max:1=n.min:0 (0枚可, rules/15/brief 量指定子). エリア指定なし「キャラ」=side:'either' (rules/15, B07070 a1 uses side:'either').]
//   - ターン終了時までAP＋1000し => charModifyAP short-form: delta:1000, scope 'turn', bind:'$picked' [VERBATIM same step1 carrier as src/cards/ct-p07/B07070.ts a1 (charModifyAP {max:1,side:'either',filter,delta:1000,scope 'turn',bind:'$picked'}) and src/cards/ct-p07/B07079.ts a2 (delta:3000,scope 'turn',bind:'$picked'). charModifyAP short-form path: uid absent + isShortFormDelta + n/max → paShortFormAwait pick (src/engine/effect/atom-handlers.ts:996-1001). scope 'turn' → mutate.char.modifyAP turn-scope (atom-handlers.ts:1011), cleared at endTurn clearTurnEffects('turn'). pick-bind writeback (Task D E0): bind:'$picked' + resolved real uid writes ctx.bindings['$picked']=[{kind char,uid,cardId,player}] (atom-handlers.ts:292-304).]
//   - 〚突撃〛（登場したターンからすぐにアクションできる）を与える => charGrantKeyword { uid:'$picked.uid', kw:'突撃', scope 'turn' } [VERBATIM step2 as src/cards/ct-p07/B07070.ts a1 (charGrantKeyword {uid:'$picked.uid',kw:'突撃',scope 'turn'}) and src/cards/ct-d09/D09020.ts a1 (charGrantKeyword {uid:'$matched.uid',kw:'突撃',scope 'turn'}). Same picked char as AP step via $picked.uid bind reuse (resolveBindRef, atom-handlers.ts:1085-1105 explicit-uid path → mutate.char.grantKeyword). charGrantKeyword in capability-map Char modify §; scope 'turn' (scope 'action' forbidden per D04005 note). Granted 突撃 honored by read/keyword.ts (名乗り例外 rules/13). 括弧書き=突撃の説明注記、別効果なし. 0枚pick時 $picked未束縛 → uid:'$picked.uid' 未解決 → silent no-op (atom-handlers.ts:1008 startsWith('$') guard).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'sleepSelf'
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          max: 1,
          side: 'either',
          filter: {
            cardName: '黒羽快斗'
          },
          delta: 1000,
          scope: 'turn',
          bind: '$picked'
        }
      },
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$picked.uid',
          kw: '突撃',
          scope: 'turn'
        }
      }
    ]
  },
  description: '【宣言】【スリープ】：〚カード名［黒羽快斗］〛のキャラを1枚まで選び、ターン終了時までAP＋1000し、〚突撃〛（登場したターンからすぐにアクションできる）を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B04031P: CardDef = {
  id: 'B04031P',
  no: '0429/B04031P',
  kind: 'character',
  names: [
    '中森青子'
  ],
  colors: [
    '白'
  ],
  level: 7,
  ap: 5000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'RP',
  imageUrl: '1735287759463454.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
