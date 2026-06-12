// cards/ct-p03/B03120 楠田陸道 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   このキャラはスリープ状態で登場する。\n【宣言】【スリープ】：このキャラをリムーブする。AP4000以下のキャラを1枚まで選び、リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - このキャラはスリープ状態で登場する。 => triggered enter(selfOnly) -> atom sceneSetState{uid:'$self',state:'sleep'} [EXACT twin of B01011 a1 (src/cards/ct-p01/B01011.ts): same enter selfOnly -> sceneSetState $self sleep. enter hook fires on all entry paths (handUseCard/next-hint/sceneEnter) per capability-map hooks section. sceneSetState $self honored (capability-map atom-handlers: 'Unresolved uid silent no-op' but '$self' resolves to source.uid).]
//   - 【宣言】 => type:'declared' (scope:'on-scene') [B03114 a1 / B09100 a1 declared on-scene char (src/cards/ct-p03/B03114.ts, ct-p09/B09100.ts). capability-map cost/dyn section: declared usable from scene chars, declaredUseCount per source.]
//   - 【スリープ】： (cost, colon present) => cost:{kind:'sleepSelf'} [B09100 a1 (src/cards/ct-p09/B09100.ts) '【宣言】【ターン1】【スリープ】' uses cost:{kind:'sleepSelf'}; many twins (B06069/B03010). capability-map cost section line: sleepSelf sleeps ctx.source.uid, payable ONLY if active (so card must re-activate before re-use; engine-gated).]
//   - このキャラをリムーブする。 (effect step 1) => atom sceneRemove{uid:'$self',cause:'effect'} as sequence step 1 [EXACT structural twin B03114 a1 (src/cards/ct-p03/B03114.ts): sequence step1 = sceneRemove{uid:'$self',cause:'effect'}, step2 = pick-remove. capability-map line 603 'effect先頭 sceneRemove{uid:'$self'}で後続effect継続: B03055/B07007/B03114' + rules/15 (effect continues after source leaves).]
//   - AP4000以下のキャラを1枚まで選び、リムーブする。 (effect step 2) => atom sceneRemove{player:'self',max:1,side:'either',cause:'effect',filter:{apMax:4000}} [B09100 a1 (src/cards/ct-p09/B09100.ts) is identical pattern with filter:{apMax:8000}; only apMax value differs (4000). capability-map TargetFilter: apMax numeric AP bound honored on pick path (matchOneFilter); sceneRemove short-form player+max+side+filter -> PA pick (capability-map atom-handlers sceneRemove). side:'either' = both sides eligible (no '相手の' restriction in text). max:1 with nMin defaulting via legalCount -> 0-pick legal ('1枚まで').]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。 => triggered evidence:remove-by-action(optional) -> choice{chooser:'self', options:[atom sceneSetState{uid:'$pick',state:'sleep', target pick scene/either n0..1}]} [EXACT text twin of D08019 a2 (src/cards/ct-d08/D08019.ts): same choice->sceneSetState $pick sleep with explicit target pick query. Comment in D08019 explains explicit target is required so hiramekiResolve auto-picks via chooseAtomTarget on fire. capability-map hooks: evidence:remove-by-action with optional:true routes to pendingHirameki side-channel (UI/AI fire/skip).]

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
      uid: '$self',
      state: 'sleep'
    }
  },
  description: 'このキャラはスリープ状態で登場する。',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
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
        verb: 'sceneRemove',
        args: {
          uid: '$self',
          cause: 'effect'
        }
      },
      {
        kind: 'atom',
        verb: 'sceneRemove',
        args: {
          player: 'self',
          max: 1,
          side: 'either',
          cause: 'effect',
          filter: {
            apMax: 4000
          }
        }
      }
    ]
  },
  description: '【宣言】【スリープ】：このキャラをリムーブする。AP4000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
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
    'rules/03-field-areas.md'
  ]
};

export const B03120: CardDef = {
  id: 'B03120',
  no: '0369/B03120',
  kind: 'character',
  names: [
    '楠田陸道'
  ],
  colors: [
    '黒'
  ],
  level: 3,
  ap: 1000,
  lp: 0,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'C',
  imageUrl: '1729133483045969.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
