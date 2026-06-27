// cards/ct-d02/D02005 遠山和葉 (character) — Task A green候補 (engine変更0)
// rules: rules/10-action-event.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【ターン1】このキャラか〚カード名［服部平次］〛が自分の現場に登場したとき、キャラを1枚まで選び、スリープさせる。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 句マッピング:
//   - 【ターン1】 (a1 回数制限) => AbilityDef.limit:{kind 'turn',n:1} [B07050.ts a1 ships `limit:{kind 'turn',n:1}` on an `enter` triggered ability (capability-map hooks §How a triggered ability fires: triggered limit kind 'turn' enforced per uid+abilityId via declaredUseCount). Official Q&A (cards-data ct-d02 character.tsv qAndA) confirms it fires once/turn even if 0-pick — matches engine limit semantics (rules/24).]
//   - このキャラか〚カード名［服部平次］〛が自分の現場に登場したとき (a1 トリガ) => trigger {hook 'enter', matcherCondition:{kind 'triggerCharMatches', side:'self', payloadKey:'uid', filter:{cardName:['遠山和葉','服部平次']}}} (NOT selfOnly — bearer observes any enter; matcherCondition gates the entering char by name OR side) [EXACT shape from src/cards/ct-p07/B07050.ts a1 (「自分の現場に〚カード名［小泉紅子］〛が登場したとき」 = `hook 'enter'` + `triggerCharMatches{side:'self',payloadKey:'uid',filter:{cardName:'小泉紅子'}}`, NOT selfOnly). enter payload (atom-handlers/scene.ts:72-75/210-214/239-243) is `{uid,viaEffect,enterOrder,enterOrderThisTurn,sourceCardId}` with NO `player` field, so `payloadKey:'uid'` is REQUIRED (cond/eval.ts:319-326: with payloadKey, uid read from pl[payloadKey] and side derived by scanning scene — the default no-payloadKey path needs pl['player'] which is absent here). `side:'self'` = entering char on owner side (cond/eval.ts:336-338). cardName array OR = membership (candidates.ts:268-272 `wants.some(w=>components.includes(w))`); includes own name '遠山和葉' to capture 「このキャラ」 branch + '服部平次' for the other branch. matchOneFilter is run in full by triggerCharMatches (cond/eval.ts:339-344). Self-observation works: char is added to scene before enter emit (mutate/scene.ts), and handleHook scans all in-play scene chars.]
//   - キャラを1枚まで選び、スリープさせる。 (a1 効果) => atom sceneSetState{player:'self', max:1, side:'either', state:'sleep'} (short-form) [VERBATIM from src/cards/ct-d09/D09014.ts a1 (「【登場時】キャラを1枚まで選び、スリープさせる。」 → `sceneSetState{player:'self',max:1,side:'either',state:'sleep'}`). Runtime short-form path: atom-handlers/scene.ts atomSceneSetState (uid absent + player string + state string + n|max → paShortFormAwait side='either'); buildShortFormPick (atom-pick-spec.ts) maps `max:1` (no `n`) → `n:{min:0,max:1}` = 「1枚まで」 (0-pick legal). side default 'either' = 「キャラ」 (両現場対象, rules/15). Also B09013.ts a1 ships same short-form with a filter.]
//   - 【ヒラメキ】（証拠からリムーブされるときに発動する） (a2 トリガ) => type 'triggered', scope 'on-evidence', trigger {hook 'evidence:remove-by-action', optional:true} [VERBATIM from same-deck siblings src/cards/ct-d02/D02004.ts a2 and D02011.ts a2, and from B03038.ts a2 / D05007.ts a2 / D07008.ts a2. capability-map hooks §evidence:remove-by-action: optional:true routes to pendingHirameki side-channel (UI/AI fire-or-skip), then effect queued normally (handleEvidenceRemovedHook).]
//   - キャラを1枚まで選び、スリープさせる。 (a2 効果) => atom sceneSetState{state:'sleep', target:{kind 'pick', query:{area:'scene', side:'either'}, n:{min:0,max:1}, chooser:'self'}} (long-form Pattern A target, no uid:'$pick') [VERBATIM from src/cards/ct-p03/B03038.ts a2 and src/cards/ct-d05/D05007.ts a2 (identical hirameki text → identical args). This is the explicit-target form (uid field absent, so NOT the BUG-130 `uid:'$pick'+target` trap); hirameki auto-pick resolves via chooseAtomTarget on the AI path / pick queue on human path. n.min:0 = 「1枚まで」 (0-pick legal).]
//   - キャラ stats / 種別 (キャラ, 緑, Lv6, AP5000, LP1, 特徴[高校生]) => CardDef {id:'D02005', no:'0108/D02005', kind 'character', names:['遠山和葉'], colors:['緑'], level:6, ap:5000, lp:1, traits:['高校生'], keywords:[]} [cards-data ct-d02/_raw/ct-d02-api.json (id 181: card_num D02005, card_id 0108, type キャラ, 緑, cost6→level, ap5000, lp1, category1 高校生, main_path 1714013117360320.jpg). CardDef shape matches sibling src/cards/ct-d02/D02004.ts / D02011.ts.]

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
        cardName: [
          '遠山和葉',
          '服部平次'
        ]
      }
    }
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      player: 'self',
      max: 1,
      side: 'either',
      state: 'sleep'
    }
  },
  description: '【ターン1】このキャラか〚カード名［服部平次］〛が自分の現場に登場したとき、キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/24-qa-naming-stun.md'
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
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md'
  ]
};

export const D02005: CardDef = {
  id: 'D02005',
  no: '0108/D02005',
  kind: 'character',
  names: [
    '遠山和葉'
  ],
  colors: [
    '緑'
  ],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: [
    '高校生'
  ],
  rarity: 'D',
  imageUrl: '1714013117360320.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/24-qa-naming-stun.md'
  ],
};
