// cards/ct-p01/B01071 ジェイムズ・ブラック (character) — Task A green候補 (engine変更0)
// rules: rules/07-action-flow.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【ターン1】自分の現場にいる〚特徴［FBI］〛のキャラがアクションしたとき、カードを1枚引く。\n【ターン1】相手の現場にいるキャラが自分の現場にいる〚特徴［FBI］〛のキャラを指定してアクションしたとき、カードを1枚引く。
// 句マッピング:
//   - 本体ステータス: ジェイムズ・ブラック / character / 赤 / Lv7 / AP6000 / LP1 / 特徴[FBI] / 印字キーワードなし => CardDef kind 'character', colors:['赤'], level:7, ap:6000, lp:1, traits:['FBI'], keywords:[] [.tmp/taskA/recs/B01071.json record (features 'FBI' single trait; cutIn/hirameki/henso all empty → no printed 迅速/突撃/疾風/ブレット → keywords:[]). Stat/feature shape matches sibling FBI character src/cards/ct-d04/D04007.ts (メアリー, 赤, Lv6, AP6000, LP1, traits include 赤井家) and src/cards/ct-p07/B07066.ts (赤井秀一, 赤, traits ['FBI','赤井家']).]
//   - a1 【ターン1】 => ability.limit {kind 'turn', n:1} [src/cards/ct-p02/B02012.ts a2 limit {kind 'turn',n:1} on an action:declare triggered draw (VERBATIM). Enforced per uid+abilityId via declaredUseCount at fire time (capability-map §How a triggered ability fires; only kind 'turn' enforced for triggered).]
//   - a1 自分の現場にいる〚特徴［FBI］〛のキャラがアクションしたとき => trigger {hook 'action:declare'} + condition {kind 'triggerCharMatches', side:'self', filter:{trait:'FBI'}} (NOT selfOnly — bearer reacts to ANY self-side FBI char's action, including itself) [VERBATIM structure from src/cards/ct-p02/B02012.ts a2 (「自分の現場にいる〚カード名［妃英理］〛か〚特徴［毛利探偵事務所］〛のキャラがアクションしたとき」 = trigger{hook 'action:declare'} bare + condition or[triggerCharMatches{side:'self',filter:{cardName:..}}, triggerCharMatches{side:'self',filter:{trait:..}}]); mine has only a single trait branch so condition is a plain triggerCharMatches (no or wrapper). action:declare emits payload {byUid,target,uid:byUid,player:byPlayer,targetUid} after attacker sleeps, before guard (src/engine/flow/action/state-machine.ts:198; rules/22 宣言時発火). triggerCharMatches default path (no payloadKey) reads payload.uid+payload.player (src/engine/cond/eval.ts:319,328), gates side:'self' via tcmPlayer===ctx.source.player (eval.ts:337-338), then runs matchOneFilter against the actual scene char honoring trait (eval.ts:339-343; candidates.ts trait filter). Empty/plain text 'アクション' (no [キャラ]/[事件] qualifier) → NO triggerActionKind added (B02012 a2 also omits it). ability.condition receives ctx.triggerPayload (capability-map §matcherCondition & condition).]
//   - a1 カードを1枚引く => effect atom draw {player:'self', n:1} [src/cards/ct-p02/B02012.ts a2 effect {kind 'atom', verb 'draw', args:{player:'self', n:1}} (VERBATIM). draw atom args {player,n:number} (capability-map Atom verbs §draw; src/engine/effect/atom-handlers.ts:108 case 'draw' → atomDraw). Mandatory 'する' → plain atom, no optional wrapper.]
//   - a2 【ターン1】 => ability.limit {kind 'turn', n:1} [src/cards/ct-p04/B04004.ts a3 limit {kind 'turn',n:1} on an action:declare triggered reaction (VERBATIM).]
//   - a2 相手の現場にいるキャラが自分の現場にいる〚特徴［FBI］〛のキャラを指定してアクションしたとき => trigger {hook 'action:declare', matcherCondition: and[ triggerCharMatches{side:'opp', filter:{}} (actor-gate), triggerCharMatches{payloadKey:'targetUid', side:'self', filter:{trait:'FBI'}} (target-gate) ]} [VERBATIM structure from src/cards/ct-p04/B04004.ts a3 (「相手の現場にいるキャラが自分の現場にいる〚カード名［工藤新一］〛を指定してアクションしたとき」 = action:declare + matcherCondition and[triggerCharMatches{side:'opp',filter:{}}, triggerCharMatches{payloadKey:'targetUid', side:'self', filter:{cardName:'工藤新一'}}]); mine only swaps the target filter cardName→trait:'FBI'. ACTOR-GATE: triggerCharMatches{side:'opp', filter:{}} reads payload.player (attacker side) and the empty filter forces a scene-find on opp.scene (src/engine/cond/eval.ts:340-342) → confirms attacker is the opponent's ON-SCENE char (excludes partner-area), matching '相手の現場にいるキャラが' (rules/03). B04004 comment + B01062/B03097 confirm the actor-gate is required to avoid over-fire. TARGET-GATE: triggerCharMatches{payloadKey:'targetUid', ...} reads payload.targetUid (the action[キャラ] target uid, flat-emitted only for char targets at state-machine.ts:200), derives side by scene-scan (eval.ts:323-327), gates side:'self' (target is on owner's scene), then matchOneFilter for trait:'FBI' (eval.ts:339-343). action[事件] sets targetUid=undefined → target-gate returns false → ability won't fire on case-targeting, matching '〚特徴［FBI］〛のキャラを指定' (= action[キャラ] only). At declare-emit timing both attacker and target are still on scene (rules/22).]
//   - a2 カードを1枚引く => effect atom draw {player:'self', n:1} [Same as a1: src/cards/ct-p02/B02012.ts a2 / capability-map §draw. Mandatory draw, no optional.]
//   - tier classification => tier 1 [Both abilities auto-resolve a fixed draw {n:1} with NO player selection, pick, choice, optional, or modal at resolution time. The only player-facing surfaces (whether an action is declared) are upstream gameplay, not resolution choices. → tier 1.]
//   - needsManual / serializability => needsManual:false [Every node (triggerCharMatches, and, draw atom, limit) is a pure JSON object with no closure/custom condition. No contactTargetMatches or other non-serializable Condition is required. File is auto-generatable as pure JSON.]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare'
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  condition: {
    kind: 'triggerCharMatches',
    side: 'self',
    filter: {
      trait: 'FBI'
    }
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【ターン1】自分の現場にいる〚特徴［FBI］〛のキャラがアクションしたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:declare',
    matcherCondition: {
      kind: 'and',
      cs: [
        {
          kind: 'triggerCharMatches',
          side: 'opp',
          filter: {}
        },
        {
          kind: 'triggerCharMatches',
          payloadKey: 'targetUid',
          side: 'self',
          filter: {
            trait: 'FBI'
          }
        }
      ]
    }
  },
  limit: {
    kind: 'turn',
    n: 1
  },
  effect: {
    kind: 'atom',
    verb: 'draw',
    args: {
      player: 'self',
      n: 1
    }
  },
  description: '【ターン1】相手の現場にいるキャラが自分の現場にいる〚特徴［FBI］〛のキャラを指定してアクションしたとき、カードを1枚引く。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B01071: CardDef = {
  id: 'B01071',
  no: '0061/B01071',
  kind: 'character',
  names: [
    'ジェイムズ・ブラック'
  ],
  colors: [
    '赤'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    'FBI'
  ],
  rarity: 'C',
  imageUrl: '1714013053518006.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md'
  ],
};
