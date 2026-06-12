// cards/ct-p05/B05074 小倉功雅 (character) — Task A green候補 (engine変更0)
// rules: rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/03-field-areas.md, rules/19-special-rules.md
// 公式テキスト:
//   【宣言】【スリープ】：キャラを1枚まで選び、ターン終了時までAP＋1000する。\n【宣言】【スリープ】〚現場にいるカード名［大橋彩代］を1枚スリープさせる〛：キャラを1枚まで選び、ターン終了時までLP＋1するか、ターン終了時までAP＋3000する。
// 句マッピング:
//   - 【宣言】 (ability 1, declared ability) => AbilityDef type:'declared' scope:'on-scene' [B04070.ts a2 / B03060.ts a1 — declared char abilities scope:'on-scene'; capability-map §3 declared type]
//   - 【スリープ】 (ability 1 cost = sleep self) => cost:{kind:'sleepSelf'} [D11014.ts a2 cost:{kind:'sleepSelf'}; capability-map cost §1 sleepSelf (payable only if active — rules/21 enforced by engine)]
//   - キャラを1枚まで選び (ability 1, pick 0-1 char either side) => charModifyAP short-form pick {max:1, side:'either'} → nMin=0,nMax=1 [D11014.ts a1 (charModifyAP {max:1,side:'either',...}); buildShortFormPick atom-pick-spec.ts:69-71 (max without n → nMin=0 → '1枚まで'=0OK)]
//   - ターン終了時までAP＋1000する (ability 1) => atom charModifyAP {delta:1000, scope:'turn'} [D11014.ts a1 identical pattern (delta:-1000,scope:'turn'); capability-map verb charModifyAP writes apMod_turn]
//   - 【宣言】 (ability 2, declared ability) => AbilityDef type:'declared' scope:'on-scene' [B04070.ts a2 declared with composite pay cost]
//   - 【スリープ】 + 〚現場にいるカード名［大橋彩代］を1枚スリープさせる〛 (ability 2 composite cost) => cost:{kind:'pay',items:[{sleepSelf},{sleepChar target pick scene/side:self/cardName:大橋彩代 n{1,1}}]} [B04070.ts a2 cost pay[sleepChar(scene,side:self,filter cardName), removeFromHand] + B03060.ts a1 pay[sleepSelf, sleepChar]; cost §1 sleepChar payable if >=1 active candidate; rules/21 cost self-side (side:'self'); cardName honored on scene pick via matchOneFilter (capability-map TargetFilter; B04070 precedent)]
//   - キャラを1枚まで選び (ability 2, pick 0-1 char either side) => charModifyLP/AP short-form pick {max:1, side:'either'} inside each choice option [D11012.ts a1 same '1枚まで選び' via short-form max:1; buildShortFormPick nMin=0]
//   - ターン終了時までLP＋1するか、ターン終了時までAP＋3000する (ability 2, choose one of two modifiers) => effect:{kind:'choice',chooser:'self',options:[charModifyLP{delta:1,scope:turn}, charModifyAP{delta:3000,scope:turn}]} [D11012.ts a1 — exact precedent 'LP＋1するか、…AP＋2000する' = choice[charModifyLP{delta:1,max:1,scope:turn}, charModifyAP{delta:2000,max:1,scope:turn}] (B05074 differs only: no filter, AP delta 3000); resolver.run choice §WRAPPERS]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'sleepSelf'
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      max: 1,
      side: 'either',
      delta: 1000,
      scope: 'turn'
    }
  },
  description: '【宣言】【スリープ】：キャラを1枚まで選び、ターン終了時までAP＋1000する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'pay',
    items: [
      {
        kind: 'sleepSelf'
      },
      {
        kind: 'sleepChar',
        target: {
          kind: 'pick',
          query: {
            area: 'scene',
            side: 'self',
            filter: {
              cardName: '大橋彩代'
            }
          },
          n: {
            min: 1,
            max: 1
          },
          chooser: 'self'
        }
      }
    ]
  },
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      {
        kind: 'atom',
        verb: 'charModifyLP',
        args: {
          delta: 1,
          max: 1,
          side: 'either',
          scope: 'turn'
        }
      },
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          delta: 3000,
          max: 1,
          side: 'either',
          scope: 'turn'
        }
      }
    ]
  },
  description: '【宣言】【スリープ】〚現場にいるカード名［大橋彩代］を1枚スリープさせる〛：キャラを1枚まで選び、ターン終了時までLP＋1するか、ターン終了時までAP＋3000する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B05074: CardDef = {
  id: 'B05074',
  no: '0574/B05074',
  kind: 'character',
  names: [
    '小倉功雅'
  ],
  colors: [
    '赤'
  ],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: [
    'ラーメン小倉'
  ],
  rarity: 'C',
  imageUrl: '1745322226148546.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/03-field-areas.md',
    'rules/19-special-rules.md'
  ],
};
