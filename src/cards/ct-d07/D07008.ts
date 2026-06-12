// cards/ct-d07/D07008 ベルモット (character) — Task A green候補 (engine変更0)
// rules: rules/21-declared-ability-cost.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/20-color-and-switch.md, rules/10-action-event.md, rules/03-field-areas.md
// 公式テキスト:
//   【宣言】【スリープ】〚デッキの下に移す〛：手札からレベル5以下のキャラを1枚まで登場させる。ターン終了時までそのキャラに〚突撃〛（登場したターンからすぐにアクションできる）を与える。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【宣言】 => type:'declared' (AbilityDef) [declared ability type — exemplar src/cards/ct-p09/B09044.ts a1; capability-map §3 AbilityType 'declared']
//   - 【スリープ】〚デッキの下に移す〛 (コスト) => cost:{kind:'pay', items:[{kind:'sleepSelf'},{kind:'selfToDeckBottom'}]} [VERBATIM in src/cards/ct-p09/B09044.ts a1 and src/cards/ct-p09/B09032.ts a1; capability-map §1 cost kinds 'pay'/'sleepSelf'/'selfToDeckBottom' (selfToDeckBottom payable if char exists; sleepSelf payable only if active so sleep/stun→宣言不可 per rules/21, engine-enforced)]
//   - 手札からレベル5以下のキャラを1枚まで登場させる => atom sceneEnter {cardId:'$pick.cardId', from:'hand', viaEffect:true, bind:'$matched', target:{pick, area:'hand', side:'self', filter:{levelMax:5, kind:'character'}, n:{min:0,max:1}, chooser:'self'}} [hand-enter form VERBATIM in src/cards/ct-p09/B09044.ts a1 (cardId:'$pick.cardId', from:'hand', target area:'hand' filter levelMax+kind:'character', n{0..1}); kind:'character' added per BUG-123 (excludes同色イベント) — text says 'キャラ'. bind:'$matched' writeback confirmed at src/engine/effect/atom-handlers.ts:644-649 (enteredBindKey → ctx.bindings[bind]=[{...uid:newChar.uid}]). Pick re-run preserves ...a (atom-handlers.ts:546-552). n.min:0 ⇒ 0枚可 (rules/15 '〜枚まで')]
//   - ターン終了時までそのキャラに〚突撃〛を与える => atom charGrantKeyword {uid:'$matched.uid', kw:'突撃', scope:'turn'} [VERBATIM pattern in src/cards/pr-01/PR181.ts a1 & PR187.ts a1 (sceneEnter bind:'$matched' → charGrantKeyword uid:'$matched.uid' scope:'turn'). Plain kw:'突撃' proven in src/cards/ct-p09/B09032.ts a1 / D08005.ts / D06006.ts. '$matched.uid' resolved by resolveBindRef (atom-handlers.ts:924-926 charGrantKeyword wires resolveBindRef; resolver tries 'matched' then '$matched' atom-handlers.ts:168-171). Cross-pause binding preserved on same saved ctx (capability-map line 107, BUG-107)]
//   - （登場したターンからすぐにアクションできる） => explanatory parenthetical of 〚突撃〛 — no separate effect [rules/13-keywords.md 突撃 = 名乗り状態でもアクション可; covered by kw:'突撃' grant above (read/keyword.ts honors granted keyword)]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => type:'triggered', scope:'on-evidence', trigger:{hook:'evidence:remove-by-action', optional:true} [VERBATIM in src/cards/ct-d11/D11009.ts a2 / src/cards/ct-d08/D08019.ts a2 / B09044.ts a2; capability-map hook 'evidence:remove-by-action' (optional:true → pendingHirameki UI fire/skip)]
//   - キャラを1枚まで選び、スリープさせる => choice→atom sceneSetState {uid:'$pick', state:'sleep', target:{area:'scene', side:'either', n:{min:0,max:1}, chooser:'self'}} [VERBATIM in src/cards/ct-d11/D11009.ts a2 (choice wrapper + explicit target retained so hirameki-fire auto-picks via chooseAtomTarget per D11009 note) and src/cards/ct-d03/D03013.ts / ct-d04/D04010.ts; sceneSetState in capability-map atom verbs (Pattern A pick, state='sleep'). n.min:0 ⇒ 0枚可]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'sleepSelf'
      },
      {
        kind: 'selfToDeckBottom'
      }
    ]
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'sceneEnter',
        args: {
          player: 'self',
          cardId: '$pick.cardId',
          from: 'hand',
          viaEffect: true,
          bind: '$matched',
          target: {
            kind: 'pick',
            query: {
              area: 'hand',
              side: 'self',
              filter: {
                levelMax: 5,
                kind: 'character'
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
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$matched.uid',
          kw: '突撃',
          scope: 'turn'
        }
      }
    ]
  },
  description: '【宣言】【スリープ】〚デッキの下に移す〛：手札からレベル5以下のキャラを1枚まで登場させる。ターン終了時までそのキャラに〚突撃〛（登場したターンからすぐにアクションできる）を与える。',
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
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
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'sceneSetState',
        args: {
          uid: '$pick',
          state: 'sleep',
          target: {
            kind: 'pick',
            query: {
              area: 'scene',
              side: 'either'
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
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md'
  ]
};

export const D07008: CardDef = {
  id: 'D07008',
  no: '0391/D07008',
  kind: 'character',
  names: [
    'ベルモット'
  ],
  colors: [
    '黒'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'D',
  imageUrl: '1729865282020119.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/21-declared-ability-cost.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/20-color-and-switch.md',
    'rules/10-action-event.md',
    'rules/03-field-areas.md'
  ],
};
