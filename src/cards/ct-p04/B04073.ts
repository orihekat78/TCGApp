// cards/ct-p04/B04073 千葉和伸 (character) — engine additive A2 exemplar (action:guarded targetUid, 2026-07-11)
// rules: 07-action-flow.md, 08-contact.md, 10-action-event.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   自分の現場にいるキャラがガードしたとき、アクション終了時までそのキャラをAP＋1000する。
//   アクションで指定されていたのが〚カード名［三池苗子］〛だった場合、代わりにアクション終了時までそのキャラをAP＋3000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
// 公式Q&A: 「自分の現場にいるキャラがガードしたとき」の能力は、ガードを宣言しガードするキャラを
//   スリープさせた時点で発動 (【カットイン】等の行動よりも前 = action:guarded emit 位置と一致)。
//
// 句マッピング:
//   a1 = action:guarded trigger + matcherCondition triggerCharMatches{payloadKey:'guardUid', side:'self'}
//        (=「自分の現場にいるキャラがガードした」ガードキャラ=guardUid が自分側)。
//        effect conditional: if triggerCharMatches{payloadKey:'targetUid', filter:{cardName:'三池苗子'}}
//        (=「アクションで指定されていたのが三池苗子」= 本 wave で action:guarded payload に追加した
//         targetUid。B08048/B04004 の action:declare targetUid 読み idiom と同型) then AP+3000 else +1000。
//        いずれも scope:'action' (「アクション終了時まで」、B08048 a1 / B02002 同型)。uid='$trigger.guardUid'
//        (B09041 と同 idiom)。
//   a2 = 【ヒラメキ】evidence:remove-by-action optional → sceneSetState{side:'either', max:1, sleep}
//        (「キャラを1枚まで選び」= 0可・どちらの現場でも、rules/15。D08019 同型)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'action:guarded',
    matcherCondition: { kind: 'triggerCharMatches', payloadKey: 'guardUid', side: 'self', filter: {} },
  },
  effect: {
    kind: 'conditional',
    if: { kind: 'triggerCharMatches', payloadKey: 'targetUid', filter: { cardName: '三池苗子' } },
    then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$trigger.guardUid', delta: 3000, scope: 'action' } },
    else: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$trigger.guardUid', delta: 1000, scope: 'action' } },
  },
  description:
    '自分の現場にいるキャラがガードしたとき、アクション終了時までそのキャラをAP＋1000する。アクションで指定されていたのが〚カード名［三池苗子］〛だった場合、代わりにアクション終了時までそのキャラをAP＋3000する。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/08-contact.md', 'rules/22-qa-action-contact.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】任意発動
  effect: { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep' } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md'],
};

export const B04073: CardDef = {
  id: 'B04073',
  no: '0459/B04073',
  kind: 'character',
  names: ['千葉和伸'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1735287822612420.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/22-qa-action-contact.md',
  ],
};
