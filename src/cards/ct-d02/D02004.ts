// cards/ct-d02/D02004 服部平次 (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md
// 公式テキスト:
//   このキャラがアクションしたとき、相手の現場にいるスリープ状態かスタン状態のキャラ1枚につき、アクション終了時までこのキャラをAP＋1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
// 句マッピング:
//   - このキャラがアクションしたとき (発動トリガ) => type:'triggered', trigger:{hook:'action:declare', selfOnly:true}, scope:'on-scene' [listeners/triggered.ts action:declare hook (payload {byUid,target,uid,player}, source.uid=attacker, selfOnly matches attacker); exact exemplar src/cards/ct-d08/D08021.ts a3 ('このキャラがアクションしたとき、カードを1枚引く' = trigger{hook:'action:declare',selfOnly:true}) and src/cards/ct-d09/D09008.ts a2 (same shape)]
//   - 相手の現場にいるスリープ状態かスタン状態のキャラ1枚につき (count basis for scaling) => forEach over:{kind:'all', query:{area:'scene', side:'opp', state:['sleep','stun']}} (runs 'do' once per matching opponent char) [resolver.ts:121-138 forEach binds each candidate to $each and runs 'do' per candidate; target/resolve.ts all->candidates(); target/candidates.ts:186-188 query.state membership honored (query.state.includes(c.state)) so ['sleep','stun'] = sleep OR stun; side:'opp' relative to owner. Direct precedent: src/cards/ct-p02/B02083.ts a1 maps '相手の現場にいるスタン状態のキャラ1枚につき、カードを1枚引く' via the SAME forEach over:all+side:'opp'+state pattern (green-certified). side:'opp' exemplar B02032.ts; multi-state filter form is the same .includes membership]
//   - アクション終了時までこのキャラをAP＋1000する (effect per matched char) => do: atom charModifyAP {uid:'$self', delta:1000, scope:'turn'} [atom-handlers.ts:820-846 charModifyAP resolves uid via resolveBindRef ('$self'->ctx.source.uid, line 145-146) then mutate.char.modifyAP(s,uid,delta,scope); mutate/char.ts:25-31 modifyAP ACCUMULATES (current+delta) so forEach gives +1000*count to this char (this card). 'このキャラ'=$self=source (ctx.source unchanged inside forEach, only $each is bound). charModifyAP self scope:'turn' grounded as a green building block in B03020 cert and src/cards/ct-d11/D11007.ts a3. APPROX: see notes re scope vs 'アクション終了時まで']
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。 => type:'triggered', scope:'on-evidence', trigger:{hook:'evidence:remove-by-action', optional:true}, effect:{atom draw{player:'self',n:1}} [EXACT twin of src/cards/ct-d08/D08013.ts a2 ('【ヒラメキ】カードを1枚引く。' = identical id/type/scope/trigger/effect); listeners/triggered.ts handleEvidenceRemovedHook routes optional:true to pendingHirameki side-channel (fire/skip by UI/AI); atom draw atom-handlers.ts requireField n number]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    selfOnly: true
  },
  effect: {
    kind: 'forEach',
    over: {
      kind: 'all',
      query: {
        area: 'scene',
        side: 'opp',
        state: [
          'sleep',
          'stun'
        ]
      }
    },
    do: {
      kind: 'atom',
      verb: 'charModifyAP',
      args: {
        uid: '$self',
        delta: 1000,
        scope: 'turn'
      }
    }
  },
  description: 'このキャラがアクションしたとき、相手の現場にいるスリープ状態かスタン状態のキャラ1枚につき、アクション終了時までこのキャラをAP＋1000する。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md'
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
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const D02004: CardDef = {
  id: 'D02004',
  no: '0107/D02004',
  kind: 'character',
  names: [
    '服部平次'
  ],
  colors: [
    '緑'
  ],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: [
    '探偵',
    '高校生'
  ],
  rarity: 'D',
  imageUrl: '1714013100450523.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md'
  ],
};
