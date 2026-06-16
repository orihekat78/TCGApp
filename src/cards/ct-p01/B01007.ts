// cards/ct-p01/B01007 毛利蘭 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/13-keywords.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。\n【パートナー青】【宣言】【ターン1】〚手札を1枚リムーブする〛：ターン終了時までこのキャラをAP＋1000し、〚突撃〛（登場したターンからすぐにアクションできる）を持つ。
// 句マッピング:
//   - 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。 => triggered ability a1: trigger.hook='leave:to-remove' (NO selfOnly = in-play observer scan) + condition removedCharMatches{side:'opp',cause:'contact-ap',by:'self'} + effect atom draw{player:'self',n:1} [§反撃 brief + spec engine-cluster15-contact-removal-observer-design.md §1 lists B01007 explicitly under CONTACT-SELF variant. removedCharMatches registered in src/engine/cond/eval.ts:329-358 + CONDITION_KIND_MAP:421 (returns true for side='opp' when removed char belongs to opp: sameSide=pl.side===source.player is false → cond.side==='opp' && !sameSide is false → not rejected; cause check pl.cause==='contact-ap'; by==='self' check byUid===ctx.source.uid). leave:to-remove emit src/engine/mutate/scene.ts:163-172 carries {uid,cause,side:player,byUid}. Contact AP-judge src/engine/flow/contact.ts:264 calls removeToRemove(state,bUid,'contact-ap',aUid) where aUid=winner=attacker=this char. In-play observer (this char survives as winner) reacted via src/engine/listeners/triggered.ts handleHook (selfOnly omitted → line 211 check skipped); leave path runs handleHook in addition to handleLeaveToRemoveSelf (line 388). ability.condition evaluated with ctx.triggerPayload=payload (triggered.ts:230-244). draw atom shape copied from src/cards/ct-d04/D04005.ts a2. validate whitelist scripts/taskA-validate-specs.cjs:60. No removal verb in effect + cascade concern N/A → no 【ターン1】 needed (brief §反撃 注意).]
//   - 【パートナー青】 => a2 ability.condition partnerColor{color:'青'} [cap-map: partnerColor{color} = owner's partner CardDef.colors intersects color. Exemplar src/cards/ct-p01/B01028.ts a3 uses {kind 'partnerColor',color:'緑'} for 【パートナー緑】. eval.ts CONDITION_KIND_MAP partnerColor:true.]
//   - 【宣言】 => a2 type 'declared' [cap-map §3 declared = player-declared + cost paid + runs effect. Exemplar src/cards/ct-d02/D02013.ts a1 type 'declared'.]
//   - 【ターン1】 => a2 limit:{kind 'turn',n:1} [cap-map declared limit {turn:1}. Exemplar D02013.ts a1 limit:{kind 'turn',n:1}; B01028.ts a3 same.]
//   - 〚手札を1枚リムーブする〛 (cost) => a2 cost removeFromHand{target:pick(area:hand,side:self,n:1/1,chooser:self),n:1} [cap-map §1 removeFromHand{target,n}; wired in src/engine/cost/evaluate.ts:47 (canPay) + src/engine/cost/pay.ts:57. Exact arg shape copied from src/cards/ct-d02/D02013.ts a1 cost and src/cards/ct-p01/B01088.ts:26.]
//   - ターン終了時までこのキャラをAP＋1000し => a2 effect sequence step1: atom charModifyAP{uid:'$self',delta:1000,scope 'turn'} [atom-handlers.ts:993-1014 charModifyAP resolves uid:'$self' via resolveBindRef→ctx.source.uid (L167-168) and accepts scope 'turn' (L1010, written to apMod_turn via mutate.char.modifyAP). Exemplar src/cards/ct-p01/B01028.ts a2 charModifyAP{uid:'$self',delta:1000,scope 'contact'} (scope 'turn' grounded in ct-d01/D01006.ts). 'ターン終了時まで'=scope 'turn'.]
//   - 〚突撃〛（登場したターンからすぐにアクションできる）を持つ => a2 effect sequence step2: atom charGrantKeyword{uid:'$self',kw:'突撃',scope 'turn'} [atom-handlers.ts:1085-1106 charGrantKeyword resolves uid:'$self'→ctx.source.uid and accepts scope 'turn' (L1101). Exact shape copied from src/cards/ct-d04/D04005.ts a1 charGrantKeyword{uid:'$self',kw:'突撃',scope 'turn'} (ターン終了時まで=scope 'turn'). Granted keyword (NOT printed) → not in keywords[].]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove'
  },
  condition: {
    kind: 'removedCharMatches',
    side: 'opp',
    cause: 'contact-ap',
    by: 'self'
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/22-qa-action-contact.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '青'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  cost: {
    kind: 'removeFromHand',
    target: {
      kind: 'pick',
      query: {
        area: 'hand',
        side: 'self'
      },
      n: {
        min: 1,
        max: 1
      },
      chooser: 'self'
    },
    n: 1
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          uid: '$self',
          delta: 1000,
          scope: 'turn'
        }
      },
      {
        kind: 'atom',
        verb: 'charGrantKeyword',
        args: {
          uid: '$self',
          kw: '突撃',
          scope: 'turn'
        }
      }
    ]
  },
  description: '【パートナー青】【宣言】【ターン1】〚手札を1枚リムーブする〛：ターン終了時までこのキャラをAP＋1000し、〚突撃〛（登場したターンからすぐにアクションできる）を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B01007: CardDef = {
  id: 'B01007',
  no: '0003/B01007',
  kind: 'character',
  names: [
    '毛利蘭'
  ],
  colors: [
    '青'
  ],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: [
    '高校生',
    '毛利探偵事務所',
    '空手家'
  ],
  rarity: 'SR',
  imageUrl: '1734349765574785.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/22-qa-action-contact.md'
  ],
};
