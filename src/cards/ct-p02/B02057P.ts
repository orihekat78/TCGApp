// cards/ct-p02/B02057P 沖矢昴 (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   【パートナー赤】自分のターン終了時、このキャラがスリープ状態かスタン状態の場合、AP8000以下のキャラを1枚まで選び、リムーブする。\n【宣言】【ターン1】【スリープ】：自分の現場にいるレベル7以下の【赤】のキャラを1枚まで選び、ターン終了時まで〚ブレット〛か〚突撃［事件］〛を与える。
// 句マッピング:
//   - 【パートナー赤】 (a1 ability gate) => ability.condition.and[ partnerColor color:'赤' ] [src/cards/ct-d08/D08003.ts a1 condition:{kind 'partnerColor',color:'青'}; src/cards/ct-p05/B05067.ts a2 partnerColor in and. eval.ts partnerColor registered.]
//   - 自分のターン終了時 (a1 trigger) => trigger {hook 'phase:end:start'} + ability.condition.and[ turn player:'self' ] [src/cards/ct-d08/D08003.ts a2 trigger {hook 'phase:end:start'} + condition:{kind 'turn',player:'self'}; src/cards/ct-p05/B05067.ts a1 identical. turn.ts:105 emits turn:end but it is NOT in TRIGGERED_HOOKS (triggered.ts:57); the engine-canonical turn-end trigger for cards is phase:end:start (verified: 0 cards use turn:end, many use phase:end:start). cond/eval.ts:35 case 'turn'.]
//   - このキャラがスリープ状態かスタン状態の場合 (a1 self-state gate) => conditional.if = or[ charStateIs{ref:self,state:'sleep'}, charStateIs{ref:self,state:'stun'} ] [cond/eval.ts:244 charStateIs uses === single state (so OR needed for two states); effect.ts:60 state union includes 'active'|'sleep'|'stun'. ref:{kind 'self'} shape from src/cards/ct-p04/B04049.ts. eval.ts:472 charStateIs registered. resolve-picks.ts:39 conditionIfIsStable returns true for or-of-charStateIs (no $-token) => pre-walk gates pick correctly, no BUG-161 over-fire.]
//   - AP8000以下のキャラを1枚まで選び、リムーブする (a1 effect) => sceneRemove{player:'self', max:1, side:'either', cause:'effect', filter:{apMax:8000}} (PA短縮形 = player pick) [src/cards/ct-d08/D08003.ts a1 step2 and src/cards/ct-p05/B05028.ts a1 step2 use the IDENTICAL text with this exact arg shape. atom-handlers/scene.ts atomSceneRemove: uid===undefined + player + max => paShortFormAwait (surfaces player pick, not auto). candidates.ts:346 apMax honored; scene area yields char-only candidates (candidates.ts:132). side:'either' = エリア指定なしの「キャラ」両現場 (rules/15).]
//   - 【宣言】【スリープ】 (a2 declared + self-sleep cost) => type 'declared', scope 'on-scene', cost:{kind 'sleepSelf'} [src/cards/ct-p05/B05028.ts a2 type 'declared' scope 'on-scene' cost:{kind 'sleepSelf'}. cost/evaluate.ts COST_KIND_MAP includes sleepSelf (payable only if source active, rules/21).]
//   - 【ターン1】 (a2 limit) => limit:{kind 'turn',n:1} [src/cards/ct-p07/B07040.ts a1 limit:{kind 'turn',n:1}; src/cards/ct-p05/B05067.ts a2 identical.]
//   - 自分の現場にいるレベル7以下の【赤】のキャラを1枚まで選び (a2 pick) => target:{kind 'pick', query:{area:'scene', side:'self', filter:{levelMax:7, color:'赤'}}, n:{min:0,max:1}, chooser:'self'} [src/cards/ct-p07/B07040.ts a1 pick carrier (area:'scene', n:{0,1}, chooser:'self', filter:trait[]); side:'self' = 自分の現場. candidates.ts:292 color honored, :350 levelMax honored. n.min:0 = 1枚まで (rules/15).]
//   - ターン終了時まで〚ブレット〛か〚突撃［事件］〛を与える (a2 choice of two keyword grants) => choice{chooser:'self', options:[ charGrantKeyword{uid:'$pick', kw:'ブレット', scope 'turn', target:<pick>}, charGrantKeyword{uid:'$pick', kw:'突撃[事件]', scope 'turn', target:<pick>} ]} [src/cards/ct-p07/B07040.ts a1 is an EXACT structural twin: choice of two charGrantKeyword options, each uid:'$pick' + target carrier (B07040 grants 突撃[キャラ] か ブレット). kw strings use half-width brackets: src/cards/ct-p02/B02014.ts a1 kw:'突撃[事件]', src/cards/ct-p01/B01068.ts kw:'ブレット'. read/char.ts:193-198 keywords() merges turnEffects['grantedKeywords'] (explicitly cites 突撃[事件] turn-scope grant honoring); turn.ts:91 clears at turn end (= ターン終了時まで). carrier uid:'$pick'+target is a single-atom pick (no separate rider) so BUG-130 bind-loss does not apply (same as B05067 a2 sceneRemove{uid:'$pick',target}).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'partnerColor',
        color: '赤'
      },
      {
        kind: 'turn',
        player: 'self'
      }
    ]
  },
  effect: {
    kind: 'conditional',
    if: {
      kind: 'or',
      cs: [
        {
          kind: 'charStateIs',
          ref: {
            kind: 'self'
          },
          state: 'sleep'
        },
        {
          kind: 'charStateIs',
          ref: {
            kind: 'self'
          },
          state: 'stun'
        }
      ]
    },
    then: {
      kind: 'atom',
      verb: 'sceneRemove',
      args: {
        player: 'self',
        max: 1,
        side: 'either',
        cause: 'effect',
        filter: {
          apMax: 8000
        }
      }
    }
  },
  description: '【パートナー赤】自分のターン終了時、このキャラがスリープ状態かスタン状態の場合、AP8000以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
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
  limit: {
    kind: 'turn',
    n: 1
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
          kw: 'ブレット',
          scope: 'turn',
          target: {
            kind: 'pick',
            query: {
              area: 'scene',
              side: 'self',
              filter: {
                levelMax: 7,
                color: '赤'
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
          uid: '$pick',
          kw: '突撃[事件]',
          scope: 'turn',
          target: {
            kind: 'pick',
            query: {
              area: 'scene',
              side: 'self',
              filter: {
                levelMax: 7,
                color: '赤'
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
  description: '【宣言】【ターン1】【スリープ】：自分の現場にいるレベル7以下の【赤】のキャラを1枚まで選び、ターン終了時まで〚ブレット〛か〚突撃［事件］〛を与える。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/21-declared-ability-cost.md',
    'rules/17-icons.md',
    'rules/15-abilities-effects.md'
  ]
};

export const B02057P: CardDef = {
  id: 'B02057P',
  no: '0220/B02057P',
  kind: 'character',
  names: [
    '沖矢昴'
  ],
  colors: [
    '赤'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    '大学院生'
  ],
  rarity: 'SRP',
  imageUrl: '1721357250084137.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
