// cards/ct-p07/B07041P 黒羽盗一 (character) — Task A green候補 (engine変更0)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/16-card-set.md, rules/17-icons.md, rules/21-declared-ability-cost.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【パートナー白】【登場時】キャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）\n【宣言】【スリープ】：自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。
// 句マッピング:
//   - 【パートナー白】 (a1 condition icon) => ability.condition { kind 'partnerColor', color:'白' } [capability-map L142 partnerColor {color}=owner partner colors intersect (【パートナー(色)】). Exact exemplar D03002.ts a1 uses condition:{kind 'partnerColor',color:'白'} for the identical 【パートナー白】 icon.]
//   - 【登場時】 (a1 trigger) => trigger { hook 'enter', selfOnly:true } [hooks list (brief) enter=【登場時】. D03002.ts a1 trigger {hook 'enter',selfOnly:true}; B07034.ts a1 同 hook. selfOnly fires for the entering card itself (BUG-146 emit source=登場キャラ).]
//   - キャラを1枚まで選び、スタンさせる (a1 effect) => atom sceneSetState { uid:'$pick', state:'stun', target:{pick, area:'scene', side:'either', n:{min:0,max:1}, chooser:'self'} } [capability-map L38 sceneSetState supports state:'stun', short/pick side='either'. D03002.ts a1 has the byte-identical sceneSetState{uid:'$pick',state:'stun',target:{area:'scene',side:'either',n:{min:0,max:1},chooser:'self'}}. 「1枚まで」=n.min:0 (0枚可, rules/15). Live engine atom-handlers.ts L974-975 casts state to 'stun' and calls mutate.scene.setState; mutate/scene.ts setState handles stun.]
//   - （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる） (a1 parenthetical) => engine-level stun rule (mutate/scene.ts setState); no separate DSL clause needed [mutate/scene.ts setState L264-279: active を渡したとき現在 stun なら sleep に変換 / stun に sleep|stun を渡してもスタンのまま. This is the standard stun special-rule clarification (rules/03 / rules/24); D03002.ts encodes the same parenthetical with no extra effect (it's a reminder, not an additional action).]
//   - 【宣言】 (a2 ability type) => ability.type 'declared' [capability-map L460-461 declared = player-declared, cost paid via §1, runs effect, usable from scene chars. B02030.ts a2 / B07034.ts a2 use type 'declared', scope 'on-scene'.]
//   - 【スリープ】 (a2 cost) => cost { kind 'sleepSelf' } [capability-map L380 sleepSelf sleeps ctx.source.uid, payable only if active. Live cost/evaluate.ts canPay 'sleepSelf' returns c.state==='active'. Bare-cost shape cost:{kind 'sleepSelf'} confirmed in D11003.ts a2 (declared, no pay wrapper). No 【ターンN】 printed → NO limit field added.]
//   - 自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする (a2 effect) => atom charSetCard { player:'self', max:1, side:'self', fromDeckTop:true, faceUp:false } [Byte-identical to B02030.ts a2 and B02023.ts a1 short-form. Live atom-handlers.ts L1172-1180: uid absent + fromDeckTop + player string + n/max → PA short-form, chooser=controller (ctx.source.player, BUG-120 fix), deck-source side=resolvePlayer(a.player). buildShortFormPick (atom-pick-spec.ts L78) honors a.side:'self' (= own scene chars, 「自分の現場にいるキャラ」) and max:1 → n:{min:0,max:1} (「1枚まで」,0枚可). faceUp:false = 裏向き; fromDeckTop shifts self deck top (rules/16 セット).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '白'
  },
  trigger: {
    hook: 'enter',
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'stun',
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
  description: '【パートナー白】【登場時】キャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'on-scene',
  cost: {
    kind: 'sleepSelf'
  },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: {
      player: 'self',
      max: 1,
      side: 'self',
      fromDeckTop: true,
      faceUp: false
    }
  },
  description: '【宣言】【スリープ】：自分の現場にいるキャラを1枚まで選び、自分のデッキのカードを上から1枚裏向きでセットする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md'
  ]
};

export const B07041P: CardDef = {
  id: 'B07041P',
  no: '0770/B07041P',
  kind: 'character',
  names: [
    '黒羽盗一'
  ],
  colors: [
    '白'
  ],
  level: 7,
  ap: 6000,
  lp: 1,
  traits: [
    'マジシャン'
  ],
  rarity: 'CP',
  imageUrl: '1763546809933655.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
    'rules/24-qa-naming-stun.md'
  ],
};
