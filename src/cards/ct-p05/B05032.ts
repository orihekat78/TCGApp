// cards/ct-p05/B05032 大滝悟郎 (キャラ) — engine additive wave-11 (hirameki actor payload consumer)
// rules: 03-field-areas.md(状態3種), 08-contact.md(AP判定リムーブ), 10-action-event.md(ヒラメキ),
//        15-abilities-effects.md(「〜枚まで」=0可), 17-icons.md(【現場リムーブ時】【解決編】),
//        22-qa-action-contact.md, 24-qa-naming-stun.md(スタン特殊挙動)
//
// 公式テキスト:
//   【現場リムーブ時】コンタクトによってリムーブされた場合、スリープ状態のキャラを1枚まで選び、
//     スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//   【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる。
//     （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
//   公式Q&A: 《ジン/B01098》の【カットイン】によるリムーブは「コンタクトによってリムーブされた場合」を
//            満たさない (効果によるリムーブ = cause 'effect')。
//
// 句マッピング:
//   [effect col a1] 【現場リムーブ時】コンタクトによってリムーブされた場合、スリープ状態のキャラを
//     1枚まで選び、スタンさせる
//     => trigger{hook:'leave:to-remove', selfOnly:true, matcherCondition:{kind:'removedCharMatches',
//        cause:'contact-ap'}} — contact judge の AP判定リムーブは mutate.scene.removeToRemove(uid,
//        'contact-ap', aUid) で emit され payload.cause='contact-ap' (flow/contact.ts:290)。カットイン等の
//        効果リムーブは cause='effect' → 不一致で発火せず (公式Q&A ジン裁定と構造一致)。
//        handleLeaveToRemoveSelf が離場カード自身の trigger を virtual location で処理し
//        matcherCondition を triggerPayload 付き evalCond で gate (triggered.ts)。
//        side 条件は書かない (自身の離場は selfOnly で特定済、removedCharMatches の cause 枝のみ使用)。
//     effect =「スリープ状態のキャラを1枚まで選び、スタンさせる」— 対象は unscoped「キャラ」= side either
//        (rules/15)。sceneSetState{uid:'$pick', state:'stun', target:{kind:'pick', query:{area:'scene',
//        side:'either', state:['sleep']}, n:{min:0,max:1}, chooser:'self'}} — D03002 a1 の $pick+target
//        stun idiom + query.state:['sleep'] は D03004/D09014 precedent (candidates.ts:260 で実評価)。
//        n.min:0 = 「1枚まで」0可。スタン済キャラは query.state:['sleep'] で候補外 (スタン≠スリープ、rules/03)。
//   [hira col a2] 【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる
//     => B05111 a2 と同一 (wave-11 actor payload。裁定・edge は src/cards/ct-p05/B05111.ts 句マッピング参照):
//        bare atom sceneSetState{uid:'$trigger.byUid', state:'stun'} + condition caseStatus 解決編。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true,
    // コンタクト (AP判定) によってリムーブされた場合のみ (カットイン等の効果リムーブは cause='effect')
    matcherCondition: { kind: 'removedCharMatches', cause: 'contact-ap' },
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'stun',
      target: {
        kind: 'pick',
        query: { area: 'scene', side: 'either', state: ['sleep'] },
        n: { min: 0, max: 1 },
        chooser: 'self',
      },
    },
  },
  description:
    '【現場リムーブ時】コンタクトによってリムーブされた場合、スリープ状態のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: ['rules/03-field-areas.md', 'rules/08-contact.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
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

export const B05032: CardDef = {
  id: 'B05032',
  no: '0536/B05032',
  kind: 'character',
  names: ['大滝悟郎'],
  colors: ['緑'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['警察', '大阪府警'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322178449693.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md',
  ],
};
