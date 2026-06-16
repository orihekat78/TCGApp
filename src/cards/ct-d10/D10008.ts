// cards/ct-d10/D10008 毛利蘭 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/13-keywords.md, rules/14-refresh.md, rules/17-icons.md, rules/21-declared-ability-cost.md
// 公式テキスト:
//   相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引く。\n【パートナー青】【宣言】【ターン1】〚手札を1枚リムーブする〛：ターン終了時までこのキャラをAP＋1000し、〚突撃〛を持つ。
// 句マッピング:
//   - 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき (a1 trigger) => type 'triggered' scope 'on-scene' trigger {hook 'leave:to-remove'} (NO selfOnly) + condition:{kind 'removedCharMatches', side:'opp', cause:'contact-ap', by:'self'} [cluster15 removal-observer 一族 (本 wave 初出荷, 既存 card exemplar 無し → engine 直接 grounding)。spec .claude/specs/engine-cluster15-contact-removal-observer-design.md §1 が D10007 を CONTACT-SELF variant として明示列挙 → 「このキャラとのコンタクトによって」= {side:'opp',cause:'contact-ap',by:'self'}。eval.ts:329-360 removedCharMatches: payload {uid,cause,side,byUid} を読み owner-relative 評価 (side opp = pl.side!==ctx.source.player / cause==='contact-ap' / by:'self' = byUid===ctx.source.uid)。mutate/scene.ts:166-170 leave:to-remove emit が {uid,cause,side:player,byUid} を carry。flow/contact.ts:264 judge が removeToRemove(state,bUid,'contact-ap',aUid) で winner=attacker(=このキャラ) を byUid に渡す。listeners/triggered.ts:381-388 が leave:to-remove で handleHook (在場 observer 経路) を呼び、handleHook:234-244 が ability.condition を ctx.source=蘭/triggerPayload=payload で評価。selfOnly を付けない = 自身被除去でなく他者除去に反応 (brief §反撃 ★)。effect が removal verb を含まない (draw のみ) → cascade DEFER 非該当。]
//   - カードを1枚引く。 (a1 effect) => effect: { kind 'atom', verb 'draw', args:{ player:'self', n:1 } } [src/cards/ct-d01/D01003.ts:45 / D01006.ts:43 が { kind 'atom', verb 'draw', args:{player:'self', n:1} } を使用。cap-map L? draw {player,n} = mutate.deck.draw。解決時プレイヤー選択無 = tier1 ability。]
//   - 【パートナー青】 (a2 condition icon) => condition: { kind 'partnerColor', color:'青' } [src/cards/ct-d10/D10020.ts:a1 が declared ability に condition:{kind 'partnerColor', color:'青'} を使用 (同 deck cycle, ペア カード)。cap-map L142 partnerColor: owner partner CardDef.colors intersects color。eval.ts CONDITION_KIND_MAP に partnerColor 登録済。]
//   - 【宣言】【ターン1】 (a2 type/limit) => type 'declared' scope 'on-scene' limit:{ kind 'turn', n:1 } [src/cards/ct-d02/D02013.ts a1 が type 'declared' scope 'on-scene' limit:{kind 'turn',n:1}。cap-map declared = player-declared, cost 払い後 effect, limit{turn:1} = declaredUseCount per uid+abilityId。]
//   - 〚手札を1枚リムーブする〛 (a2 cost) => cost: { kind 'removeFromHand', target:{ kind 'pick', query:{area:'hand',side:'self'}, n:{min:1,max:1}, chooser:'self' }, n:1 } [src/cards/ct-d02/D02013.ts a1 cost が exact 同形 ({kind 'removeFromHand', target:{kind 'pick', query:{area:'hand',side:'self'}, n:{min:1,max:1}, chooser:'self'}, n:1})。cap-map L382 removeFromHand {target,n}: discard n hand cards to remove, payable if candidates>=n。COST_KIND_MAP 登録済。手札 pick = 宣言時 modal → tier2 要因。]
//   - ターン終了時までこのキャラをAP＋1000し (a2 effect step1) => sequence.steps[0]: { kind 'atom', verb 'charModifyAP', args:{ uid:'$self', delta:1000, scope 'turn' } } [src/cards/ct-d02/D02004.ts:37-42 と ct-d11/D11015.ts a1 / ct-d01/D01003.ts:32 (charModifyLP 同形) が uid:'$self' + scope 'turn' を使用。cap-map L42 charModifyAP {uid,delta,scope} = mutate.char.modifyAP。$self = bearer 自身。scope 'turn'='ターン終了時まで' (clearTurnEffects がターン境界で清掃)。「AP＋1000」delta:1000。]
//   - 〚突撃〛を持つ (a2 effect step2) => sequence.steps[1]: { kind 'atom', verb 'charGrantKeyword', args:{ uid:'$self', kw:'突撃', scope 'turn' } } [src/cards/ct-d11/D11015.ts a2 が { verb 'charGrantKeyword', args:{uid:'$self', kw:'突撃[キャラ]', scope 'turn'} }、ct-d08/D08005.ts a2 が {uid:'$self', kw:'突撃', scope 'turn'} (=「ターン終了時までこのキャラは〚突撃〛を持つ」と完全同文)。cap-map L49 charGrantKeyword {uid,kw,scope} = mutate.char.grantKeyword。印字 suffix 無しの 〚突撃〛 = plain kw:'突撃' (D08005/D10020/B02005 で実証、突撃[キャラ]/[事件] では無い)。AP+1000 と 突撃 を同時付与 = sequence 2 step (B02005.ts a1 = 同 archetype の charModifyAP+charGrantKeyword sequence)。]

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
    'rules/14-refresh.md',
    'rules/17-icons.md'
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
  description: '【パートナー青】【宣言】【ターン1】〚手札を1枚リムーブする〛：ターン終了時までこのキャラをAP＋1000し、〚突撃〛を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const D10008: CardDef = {
  id: 'D10008',
  no: '0003/D10008',
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
  rarity: 'D',
  imageUrl: '1761913165265755.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ],
};
