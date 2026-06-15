// cards/ct-p01/B01062 赤井秀一 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/10-action-event.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【パートナー赤】【ターン1】自分の現場にいるキャラがアクション［事件］したとき、レベル7以下のキャラを1枚まで選び、リムーブする。\n【宣言】【ターン1】【赤】のキャラを1枚まで選び、ターン終了時までAP＋1000する。
// 句マッピング:
//   - a1 【パートナー赤】 => ability.condition: { kind 'partnerColor', color:'赤' } [src/engine/cond/eval.ts partnerColor case: owner's partner CardDef.colors intersects color. Brief: 条件アイコン(【パートナー色】)=ability.condition. Hook reference: handleHook gates ability.condition (6-stage condition icons) AFTER matcherCondition.]
//   - a1 【ターン1】 => ability.limit: { kind 'turn', n:1 } [Exemplar src/cards/ct-p01/B01036.ts (triggered action:declare + limit:{kind 'turn',n:1}). Engine enforces only kind 'turn' for triggered via declaredUseCount (capability-map hooks §limit). Fire-time counts even at 0-pick (qAndA, B01036 comment).]
//   - a1 自分の現場にいるキャラがアクション［事件］したとき => trigger { hook 'action:declare', matcherCondition: and[ {kind 'triggerActionKind',v:'case'}, {kind 'triggerCharMatches',side:'self',filter:{}} ] } [Exact structural exemplar src/cards/ct-p03/B03097.ts (相手の現場にいるキャラがアクション［キャラ］したとき = action:declare + and[triggerActionKind{v:'char'}, triggerCharMatches{side:'opp',filter:{}}]); here side flipped to 'self', v to 'case'. state-machine.ts:198 emits action:declare {byUid,target,uid:byUid,player:byPlayer,targetUid} BEFORE guard (rules/22). eval.ts:327 triggerActionKind reads payload.target.kind==='case'. eval.ts:291 triggerCharMatches side:'self' needs payload.player===owner; filter:{} (empty) forces scene scan → excludes partner (partner-area, not scene; rules/03). per rules/22 fires at 宣言時(ガード判定前).]
//   - a1 レベル7以下のキャラを1枚まで選び、リムーブする => atom sceneRemove { player:'self', max:1, side:'either', cause:'effect', filter:{ levelMax:7 } } [Exact exemplar src/cards/ct-p01/B01063.ts (レベル7以下のキャラを1枚まで選び、リムーブする = identical args). capability-map sceneRemove: short-form PA pick (uid='$pick'), max:1+implicit min:0 ⇒ 0-pick legal (rules/15 「〜枚まで」). side:'either' = no side qualifier in text → both scenes (rules/15). cause:'effect' = 能力リムーブ. Multi-pick not needed (max 1).]
//   - a2 【宣言】 (no cost) => ability.type 'declared' (cost omitted) [Exact exemplar src/cards/ct-p09/B09088.ts a1 (【宣言】【ターン1】… no cost field, type 'declared'). card-def.ts:117 cost? is optional. flow/main/declared-ability.ts:171 only requires costPaid if ability.cost present → no-cost declared is valid.]
//   - a2 【ターン1】 => ability.limit: { kind 'turn', n:1 } [src/cards/ct-p09/B09088.ts a1 declared + limit:{kind 'turn',n:1}. declaredUseCount tracks per source uid+abilityId (capability-map costdyn §declared).]
//   - a2 【赤】のキャラを1枚まで選び、ターン終了時までAP＋1000する => atom charModifyAP { delta:1000, max:1, side:'either', filter:{ color:'赤' }, scope 'turn' } [Exact exemplar src/cards/ct-p09/B09088.ts a1 (charModifyAP {delta:1000,max:1,side:'either',filter:{color:[...]} ,scope 'turn'}); here single color '赤'. TargetFilter.color membership-OR honored on pick path (capability-map filters). scope 'turn' = ターン終了時まで. max:1 + implicit min:0 = 0-pick legal (rules/15).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '赤'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'action:declare',
    matcherCondition: {
      kind: 'and',
      cs: [
        {
          kind: 'triggerActionKind',
          v: 'case'
        },
        {
          kind: 'triggerCharMatches',
          side: 'self',
          filter: {}
        }
      ]
    }
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      cause: 'effect',
      filter: {
        levelMax: 7
      }
    }
  },
  description: '【パートナー赤】【ターン1】自分の現場にいるキャラがアクション［事件］したとき、レベル7以下のキャラを1枚まで選び、リムーブする。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      delta: 1000,
      max: 1,
      side: 'either',
      filter: {
        color: '赤'
      },
      scope: 'turn'
    }
  },
  description: '【宣言】【ターン1】【赤】のキャラを1枚まで選び、ターン終了時までAP＋1000する。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B01062: CardDef = {
  id: 'B01062',
  no: '0052/B01062',
  kind: 'character',
  names: [
    '赤井秀一'
  ],
  colors: [
    '赤'
  ],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: [
    'FBI',
    '赤井家'
  ],
  rarity: 'SR',
  imageUrl: '1714013041203650.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md'
  ],
};
