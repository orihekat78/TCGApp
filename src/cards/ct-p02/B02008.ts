// cards/ct-p02/B02008 阿笠博士 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md
// 公式テキスト:
//   【ターン1】〚特徴［少年探偵団］〛のキャラが自分の現場に登場したとき、キャラを1枚まで選び、ターン終了時までAP－1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚特徴［少年探偵団］〛のキャラを1枚まで選び、手札に加える。
// 句マッピング:
//   - 【ターン1】 (ability 1 回数制限) => limit:{kind 'turn',n:1} on the triggered ability [triggered limit:{kind 'turn',n} enforced per uid+abilityId via declaredUseCount in listeners/triggered.ts ('if (ability.limit?.kind===\'turn\') readChar.declaredUseCount(...) >= ability.limit.n) continue' + flag.incrDeclaredUseCount). Exact exemplar: src/cards/ct-p07/B07050.ts a1 (limit:{kind 'turn',n:1} on an enter+triggerCharMatches trigger). NO 【自分ターン中】 in B02008 text → no turn condition added (B07050 a1 likewise has only the limit, no turn cond).]
//   - 〚特徴［少年探偵団］〛のキャラが自分の現場に登場したとき (NON-self enter observer) => trigger {hook 'enter', matcherCondition:{kind 'triggerCharMatches', side:'self', payloadKey:'uid', filter:{trait:'少年探偵団'}}} (NOT selfOnly) [enter hook is card-triggerable (listeners/triggered.ts TRIGGERED_HOOKS). enter payload emitted by atom-handlers/scene.ts:72/210 + next-hint/hand-use-card as {uid,viaEffect,enterOrder,enterOrderThisTurn,sourceCardId} — it LACKS a 'player' field. triggerCharMatches standard path needs pl['player'] (cond/eval.ts:329) → would always be undefined → never fire; the payloadKey:'uid' path (eval.ts:319-326) reads the entering char uid and DERIVES side by scanning state.players[*].scene, so side:'self' (eval.ts:336-338, sameSide vs ctx.source.player) gates own-side and filter:{trait:'少年探偵団'} runs matchOneFilter on the entering scene char (eval.ts:339-343). matcherCondition is wired on the enter hook via the generic handleHook path (listeners/triggered.ts: evalCond(state,trig.matcherCondition,ctxMc)). EXACT shipped exemplar: src/cards/ct-p07/B07050.ts a1 (enter + triggerCharMatches{side:'self',payloadKey:'uid',filter:{cardName:'小泉紅子'}}, NO excludeSource since '自分の現場に…登場したとき' has no 'このキャラ以外'); also B07066/B09063/PR117 a2/PR118 a2 use enter+payloadKey:'uid'. B02008 has no 'このキャラ以外' clause → excludeSource OMITTED (B07050 precedent).]
//   - キャラを1枚まで選び、ターン終了時までAP－1000する (effect; unqualified キャラ = any char either side) => atom charModifyAP {max:1, side:'either', delta:-1000, scope 'turn'} (NO filter) [EXACT shipped exemplar: src/cards/ct-d11/D11014.ts a1 = charModifyAP {max:1, side:'either', delta:-1000, scope 'turn'} (also D01006 a1 = same with delta:+1000, B02045/B03127 negative). charModifyAP short-form PA pick (uid absent + isShortFormDelta + n/max → side='either' pick; capability-map). delta negative honored by mutate.char.modifyAP (signed). 'キャラ' is UNQUALIFIED (rules/15 = both scenes, no filter) — distinct from the trigger's 少年探偵団 filter. max:1 = '1枚まで' → nMin0/nMax1 (0-pick legal, rules/15). scope 'turn' = 'ターン終了時まで'.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） => trigger {hook 'evidence:remove-by-action', optional:true}, scope 'on-evidence' [Option C ヒラメキ統合: trigger.hook 'evidence:remove-by-action' + optional:true is handled by handleEvidenceRemovedHook (listeners/triggered.ts) which reads payload.ev.cardId, builds a virtual evidence CardLocation, checks scope (on-evidence), and on optional:true pushes pushPendingHirameki (fire/skip surfaced to UI). EXACT shipped exemplar: src/cards/ct-p02/B02009.ts a2 (sibling card, byte-identical ヒラメキ pattern).]
//   - 自分のリムーブエリアにある〚特徴［少年探偵団］〛のキャラを1枚まで選び、手札に加える => atom handAddFromRemove {player:'self', max:1, filter:{kind 'character', trait:'少年探偵団'}} [handAddFromRemove splices from remove pile → hand, short-form (defaultArea=remove) PA pick; filter honored by matchOneFilter. kind 'character' required for hand/remove/deck char pick (BUG-123). max:1 = '1枚まで' (nMin0, 0-pick legal). player:'self' = '自分のリムーブエリア'. EXACT shipped exemplar: src/cards/ct-p02/B02009.ts a2 = handAddFromRemove {player:'self', max:1, filter:{kind 'character', trait:'少年探偵団'}} (identical).]
//   - 本体ステータス 阿笠博士 / 青 / Lv5 / AP5000 / LP1 / 特徴[発明家] / 印字キーワードなし => CardDef kind 'character', colors:['青'], level:5, ap:5000, lp:1, traits:['発明家'], keywords:[] [.tmp/taskA/recs/B02008.json record. No printed 迅速/突撃/疾風/ブレット icon → keywords:[].]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: {
    kind: 'turn',
    n: 1
  },
  trigger: {
    hook: 'enter',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      payloadKey: 'uid',
      filter: {
        trait: '少年探偵団'
      }
    }
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      max: 1,
      side: 'either',
      delta: -1000,
      scope: 'turn'
    }
  },
  description: '【ターン1】〚特徴［少年探偵団］〛のキャラが自分の現場に登場したとき、キャラを1枚まで選び、ターン終了時までAP－1000する。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
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
        kind: 'character',
        trait: '少年探偵団'
      }
    }
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚特徴［少年探偵団］〛のキャラを1枚まで選び、手札に加える。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/19-special-rules.md'
  ]
};

export const B02008: CardDef = {
  id: 'B02008',
  no: '0180/B02008',
  kind: 'character',
  names: [
    '阿笠博士'
  ],
  colors: [
    '青'
  ],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: [
    '発明家'
  ],
  rarity: 'C',
  imageUrl: '1721357158845623.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md'
  ],
};
