// cards/ct-p05/B05111 ゾンビ (キャラ) — engine additive wave-11 exemplar (hirameki actor payload 初 consumer)
// rules: 03-field-areas.md(スタン/現場リムーブ), 10-action-event.md(ヒラメキ/アクション[事件]),
//        15-abilities-effects.md(「〜枚まで」=0可), 17-icons.md(【相手ターン中】【解決編】=条件外なら持っていない扱い),
//        19-special-rules.md(複数名カード名), 22-qa-action-contact.md, 24-qa-naming-stun.md(スタン特殊挙動)
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル5以下の〚カード名［ウォッカ］〛を
//     1枚まで選び、登場させる。
//   【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる。
//     （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//   公式Q&A: 「アクション中のキャラ」=「現時点でのアクションを行っているキャラ。【ヒラメキ】においては
//            アクション［事件］でこのカードの【ヒラメキ】を発動させたキャラが該当することになります」
//
// 句マッピング:
//   [effect col a1] 【相手ターン中】【現場リムーブ時】リムーブエリアの Lv5以下ウォッカ 1枚まで登場
//     => trigger{hook:'leave:to-remove', selfOnly:true} (handleLeaveToRemoveSelf が離場カード自身の
//        【現場リムーブ時】を virtual location で処理) + condition{kind:'turn', player:'opp'}
//        (【相手ターン中】= B01018 a1 と同 idiom。条件外なら能力自体を持たない扱い rules/17 —
//        handleLeaveToRemoveSelf は ability.condition を evalCond で gate)。
//        effect = sceneEnter 明示 pick 形 {player:'self', cardId:'$pick.cardId', from:'remove',
//        viaEffect:true, target:{pick, query:{area:'remove', side:'self',
//        filter:{cardName:'ウォッカ', levelMax:5, kind:'character'}}, n:{min:0,max:1}, chooser:'self'}}
//        — D09020/B07058/B08029 remove-enter VERBATIM (短縮形は runtime awaiting-pick に落ち
//        AI queue 経路で解決者不在になるため明示形必須 — 本 wave 実測)。n.min:0 = 「1枚まで」0可
//        rules/15。kind:'character' = イベント混入防止 BUG-123。cardName は
//        allCardNameComponentsForDef で rules/19 分割名 honor。
//   [hira col a2] 【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる
//     => trigger{hook:'evidence:remove-by-action', optional:true} + condition caseStatus 解決編
//        (handleEvidenceRemovedHook が condition を evalCond gate → 事件編では pending 自体立たず)。
//        effect = bare atom sceneSetState{uid:'$trigger.byUid', state:'stun'} — wave-11 で
//        evidence:remove-by-action payload に byUid (アクション[事件] actor の snapshot) が載り、
//        pendingHirameki.actorUid → hiramekiResolve queue payload 経由で '$trigger.byUid' が解決される。
//        公式Q&A 通り候補 = 発動させたキャラ単独 (singleton) のため、fire/skip の任意発動選択が
//        「1枚まで選び (0可)」の決定空間と一致 (fire=1枚選ぶ / skip=0枚)。optional{} wrapper は
//        hiramekiResolve 経路 (humanChooser 非付与) で skip に落ち stun 不発になるため使わない (certify 裁定)。
//        actor が partner uid / 解決前に現場離脱 → mutate.scene.setState は findChar 不在で silent no-op
//        (パートナーは「キャラ」でない rules/03/06 / 「可能な限り行う」rules/15 と一致)。
//        スタン済 actor へ stun → スタンのまま (rules/03/24)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  // 【相手ターン中】
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      cardId: '$pick.cardId',
      from: 'remove',
      viaEffect: true,
      target: {
        kind: 'pick',
        query: { area: 'remove', side: 'self', filter: { cardName: 'ウォッカ', levelMax: 5, kind: 'character' } },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description:
    '【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル5以下の〚カード名［ウォッカ］〛を1枚まで選び、登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // 【解決編】(自分の事件が解決編)
  condition: { kind: 'caseStatus', status: '解決編' },
  // アクション中のキャラ (= '$trigger.byUid'、wave-11 actor payload) をスタン
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$trigger.byUid', state: 'stun' } },
  description:
    '【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: ['rules/10-action-event.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

export const B05111: CardDef = {
  id: 'B05111',
  no: '0607/B05111',
  kind: 'character',
  names: ['ゾンビ'],
  colors: ['黒'],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: ['黒ずくめの組織', '怪物'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322246356940.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/24-qa-naming-stun.md',
  ],
};
