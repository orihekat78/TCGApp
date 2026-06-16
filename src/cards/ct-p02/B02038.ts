// cards/ct-p02/B02038 怪盗キッド (character) — Task A green候補 (engine変更0)
// rules: rules/09-cutin-disguise.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/20-color-and-switch.md, rules/03-field-areas.md, rules/23-qa-disguise-cutin.md
// 公式テキスト:
//   【変装時】カードを1枚引く。このコンタクト中、このキャラをAP＋1000する。\n【登場時】自分のリムーブエリアにあるレベル4以下の【白】のキャラを1枚まで選び、スリープ状態で登場させる。
//   【変装】【事件白】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）
// 句マッピング:
//   - 【変装時】 => a1: type 'triggered', scope 'on-scene', trigger {hook 'disguise:into', selfOnly:true} [B03129.ts a2 / B02044.ts a2 / B02045.ts a2 (all 怪盗キッド/変装系) use the IDENTICAL {hook 'disguise:into', selfOnly:true}. cap-map L289-290: disguise:into emitted by flow/contact.ts, source {player, uid:targetUid}, selfOnly ✅ (matches post-disguise cardId scene scan). contact.ts L194-215 confirmed: disguiseInto then emit('disguise:into',{uid:targetUid,...},{player:p,uid:targetUid}). enter hook NOT fired by disguise (rules/09) so a1/a2 do not double-fire.]
//   - カードを1枚引く (変装時) => a1.steps[0]: atom draw {player:'self', n:1} [B03129.ts a2 verbatim: 変装時 → {verb 'draw', args:{player:'self', n:1}}. D01003.ts a2 same draw shape. 'する' (not してもよい) = mandatory, bare atom (no optional). cap-map: draw {player,n}.]
//   - このコンタクト中、このキャラをAP＋1000する。 => a1.steps[1]: atom charModifyAP {uid:'$self', delta:1000, scope 'contact'} [uid:'$self' grounded in D01003.ts a1 (charModifyLP uid:'$self' = このキャラ) + atom-handlers.ts L164-168 ($self → ctx.source.uid). disguise:into source.uid = disguised contact char (contact.ts L184 contactCharUidOf) = このキャラ. scope 'contact' grounded in B03129.ts a3 / B02042.ts a1 (charModifyAP scope 'contact') + cap-map L9 (scope ∈ turn|contact|permanent). delta:1000 positive (AP＋). Disguise fires mid-contact so contact-scope mod applies to the live AP compare and clears at contact-end = 「このコンタクト中」. No pick (deterministic self-target).]
//   - 【登場時】 => a2: type 'triggered', scope 'on-scene', trigger {hook 'enter', selfOnly:true} [B02077.ts a1 / D05006.ts a1 / B02044.ts a1: 【登場時】 = {hook 'enter', selfOnly:true}. cap-map L286-287: enter emitted by sceneEnter/next-hint/hand-use-card; selfOnly ✅ (source.uid = entering char). triggered hook 'enter' registered.]
//   - 自分のリムーブエリアにあるレベル4以下の【白】のキャラを1枚まで選び、スリープ状態で登場させる。 => a2.effect: atom sceneEnter {player:'self', from:'remove', max:1, viaEffect:true, enterSleep:true, filter:{color:'白', levelMax:4, kind 'character'}} [D05006.ts a1 sceneEnter is VERBATIM this shape (only color:'黄'→'白'): {player:'self', from:'remove', max:1, viaEffect:true, enterSleep:true, filter:{color:'黄', levelMax:4, kind 'character'}} for 「リムーブのレベル4以下の【色】キャラを1枚までスリープ状態で登場」. B02077.ts a1 same pattern (trait variant). cap-map L33: from+max short-form builds source-area pick ($pick.cardId) Pattern B; remove/hand/deck pick needs kind 'character' (BUG-123). candidates.ts matchOneFilter: color L274-279 (d.colors), kind L291 (d.kind), levelMax L321 (base.level) ALL honored on remove candidate (c===null, CardDef statics) — printed-static fields, not dynamic. '1枚まで'=max:1 → n.min:0 (0枚可, rules/15). Effect mandatory (not してもよい) → bare atom, no optional/conditional gate. enterSleep:true = スリープ状態で登場. Player picks → tier 2 surface.]
//   - 【変装】（変装能力本体） => a3: type 'icon-disguise' [B02044.ts a3 / B02045.ts a1 / B03129.ts a1 (same 怪盗キッド henso text family) use type 'icon-disguise' with the gate in .condition. cap-map L463-464: icon-disguise ability's condition = disguise gate predicate evaluated by canDisguise (contact.ts L43-46 disguiseAbility / L180-183 canDisguise). No effect/cost on the icon itself; the 変装時 effect is the separate disguise:into ability (a1).]
//   - 【事件白】【FILE6】（変装ゲート条件） => a3.condition: and[{caseColor:'白'}, {fileAtLeast:6}] [B02044.ts a3 has and[caseColor 白, fileAtLeast 4] for SAME 怪盗キッド henso 【変装】【事件白】【FILE4】 — ours is FILE6 (only n differs). B03129.ts a1 proves fileAtLeast n:6. cond/eval.ts L45-56 caseColor (owner case colors membership) / L70-73 fileAtLeast (file.length>=n, any n; assisted partner counted per rules/17). canDisguise evaluates ability.condition; unmet → disguise blocked (rules/17 §条件アイコン).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'disguise:into',
    selfOnly: true
  },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'draw',
        args: {
          player: 'self',
          n: 1
        }
      },
      {
        kind: 'atom',
        verb: 'charModifyAP',
        args: {
          uid: '$self',
          delta: 1000,
          scope: 'contact'
        }
      }
    ]
  },
  description: '【変装時】カードを1枚引く。このコンタクト中、このキャラをAP＋1000する。',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: {
        color: '白',
        levelMax: 4,
        kind: 'character'
      }
    }
  },
  description: '【登場時】自分のリムーブエリアにあるレベル4以下の【白】のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'icon-disguise',
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'caseColor',
        color: '白'
      },
      {
        kind: 'fileAtLeast',
        n: 6
      }
    ]
  },
  description: '【変装】【事件白】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/17-icons.md'
  ]
};

export const B02038: CardDef = {
  id: 'B02038',
  no: '0205/B02038',
  kind: 'character',
  names: [
    '怪盗キッド'
  ],
  colors: [
    '白'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    '怪盗'
  ],
  rarity: 'SR',
  imageUrl: '1721357230945818.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/03-field-areas.md',
    'rules/23-qa-disguise-cutin.md'
  ],
};
