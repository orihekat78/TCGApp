// cards/ct-p04/B04092 キャンティ (character) — engine wave-18 exemplar (contact:start inContact reaction 初 consumer, 2026-07-03)
// rules: 07-action-flow.md, 08-contact.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   自分の現場にいるこのキャラ以外のキャラがコンタクトしたとき、このキャラをスリープさせてもよい。
//   そうした場合、コンタクト中のキャラを1枚まで選び、このコンタクト中、AP＋2000する。
// 公式Q&A (character.tsv B04092):
//   Q:「〜キャラがコンタクトしたとき」はいつ発動? A: コンタクト発生時点で発動 (【カットイン】等の行動より前)。
//   Q: このキャラ以外が相手アクションで指定/ガードしたコンタクトでも発動? A: はい。
//
// 句マッピング:
//   - 自分の現場にいるこのキャラ以外のキャラがコンタクトしたとき => a1.trigger = { hook:'contact:start',
//       matcherCondition: or[ triggerCharMatches{payloadKey:'aUid',side:'self',excludeSource:true},
//                             triggerCharMatches{payloadKey:'bUid',side:'self',excludeSource:true} ] }。
//       contact:start payload {aUid(攻撃側),bUid(防御/ガード側)} は uid/player キー無 → payloadKey で side を
//       scene-scan 導出 (eval.ts:490-500)。B02079 a1 が同型 (警察 filter 版)。「このキャラ以外」= excludeSource:true
//       (eval.ts:508 payload uid === ctx.source.uid を除外)。「コンタクトしたとき」= コンタクト発生時点 = contact:start
//       (state-machine.ts:401、Q&A「【カットイン】より前」と整合)。case-target アクションは contact:start を emit
//       しない (state-machine.ts) ので aUid/bUid は常に実在の現場キャラ。
//   - このキャラをスリープさせてもよい。そうした場合 => effect optional{ chain[ sceneSetState{$self,sleep}, … ] }。
//       B07019 idiom (self-sleep は cost ではなく effect atom sceneSetState)。「してもよい」= optional (opt-in/out)。
//       mandatory trigger はsleep/stunでも発動。effect-time charStateIs(self,active) がoptional全体を抑止する (BUG-145)。
//       opt-in後はsceneSetStateがselfをsleep化し、chain順でAP+へ進む。
//   - コンタクト中のキャラを1枚まで選び、このコンタクト中、AP+2000 => charModifyAP 短縮形
//       { delta:2000, max:1, inContact:true, scope:'contact' }。inContact = pick を現コンタクト参加者に限定
//       (engine wave-18、contact:start emit source.bindings.contact → ctx.contact)。max:1 = 「1枚まで」(0 可)。
//       side 既定 'either' = コンタクト中のキャラ (どちら側でも)。scope:'contact' = 「このコンタクト中」。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'contact:start',
    matcherCondition: {
      kind: 'or',
      cs: [
        { kind: 'triggerCharMatches', payloadKey: 'aUid', side: 'self', excludeSource: true },
        { kind: 'triggerCharMatches', payloadKey: 'bUid', side: 'self', excludeSource: true },
      ],
    },
  },
  effect: {
    kind: 'conditional',
    if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
    then: {
      kind: 'optional',
      effect: {
        kind: 'chain', // 「そうした場合」= sleep が適用された場合のみ AP+ へ (chain は no-apply で break)
        steps: [
          { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'sleep' } },
          { kind: 'atom', verb: 'charModifyAP', args: { delta: 2000, max: 1, inContact: true, scope: 'contact' } },
        ],
      },
    },
  },
  description: '自分の現場のこのキャラ以外がコンタクトしたとき、このキャラをスリープしてもよい。そうしたらコンタクト中のキャラ1枚までこのコンタクト中AP+2000。',
  ruleRefs: ['rules/08-contact.md', 'rules/22-qa-action-contact.md', 'rules/24-qa-naming-stun.md'],
};

export const B04092: CardDef = {
  id: 'B04092',
  no: '0474/B04092',
  kind: 'character',
  names: ['キャンティ'],
  colors: ['黒'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['黒ずくめの組織'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1735287841321835.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md',
  ],
};
