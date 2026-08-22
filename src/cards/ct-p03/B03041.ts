// cards/ct-p03/B03041 直球勝負 (event) — engine additive A2 exemplar (attacker-side forceGuard token, 2026-07-11)
// rules: 07-action-flow.md, 08-contact.md, 16-card-set.md, 22-qa-action-contact.md
//
// 公式テキスト:
//   このイベントを自分の現場にいる【緑】のキャラ1枚にセットする。
//   このイベントがセットされているキャラは「このキャラがアクションしたとき、相手はガードできる場合、必ずガードする。」と
//   「このキャラがコンタクトしたとき、そのコンタクト中、このキャラをAP＋2000する。」を持つ。
// 公式Q&A:
//   - 「セットする」= キャラ1枚にこのイベントが付いた状態。セット先が現場を離れるとリムーブ。
//   - 「ガードできる場合、必ずガードする」= ガード可能なキャラが1枚以上いるなら必ず1枚でガード (ガードキャラは
//     アクションされた側が選択)。
//   - 「このキャラがコンタクトしたとき」= コンタクト発生時点で発動 (相手アクションで指定/自ガードによるコンタクトでも発動)。
//
// 句マッピング:
//   a1 = effect:declared (event-use) → charSetCard{fromSelf, n:1, filter:{color:'緑', kind:'character'}}
//        (使用イベント自身を【緑】キャラへ faceUp セット、B01057/B02013 a1 同型)。
//   a2 = on-set-host continuous grantKeywords ['text:forceGuard'] = 「このキャラがアクションしたとき相手は必ず
//        ガードする」。本 wave で guard.mustGuardCandidates が attacker=byUid の 'text:forceGuard' を読み、legal な
//        防御候補すべてを義務化 (UI/AI とも同 chokepoint を consult → 両経路 enforce)。hasTextAbility は
//        keywords() 経由で on-set-host grantKeywords を honor。B02013 a2 (突撃 grant) の keyword 差替。
//   a3 = on-set-host triggered contact:start selfOnly → charModifyAP{uid:'$self', +2000, scope:'contact'}
//        (「このキャラがコンタクトしたとき、そのコンタクト中AP+2000」= D10024 a2 verbatim)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use',
  },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: { player: 'self', fromSelf: true, n: 1, filter: { color: '緑', kind: 'character' } },
  },
  description: 'このイベントを自分の現場にいる【緑】のキャラ1枚にセットする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md'],
};

// rider #1 (continuous): 「このキャラがアクションしたとき、相手はガードできる場合、必ずガードする。」
// = attacker-side forceGuard token (text 擬似キーワード)。guard.mustGuardCandidates が読む。
const a2: AbilityDef = {
  id: 'b03041_set_forceguard',
  type: 'continuous',
  scope: 'on-set-host',
  continuousModifier: {
    grantKeywords: () => ['text:forceGuard'],
  },
  description:
    'このイベントがセットされているキャラは「このキャラがアクションしたとき、相手はガードできる場合、必ずガードする。」を持つ。',
  ruleRefs: ['rules/07-action-flow.md', 'rules/16-card-set.md'],
};

// rider #2 (triggered): 「このキャラがコンタクトしたとき、そのコンタクト中、このキャラをAP＋2000する。」(D10024 a2 同型)
const a3: AbilityDef = {
  id: 'b03041_set_contact_ap',
  type: 'triggered',
  scope: 'on-set-host',
  trigger: {
    hook: 'contact:start',
    matcherCondition: {
      kind: 'or',
      cs: [
        { kind: 'triggerCharMatches', payloadKey: 'aUid', requireSource: true },
        { kind: 'triggerCharMatches', payloadKey: 'bUid', requireSource: true },
      ],
    },
  },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 2000, scope: 'contact' } },
  description:
    'このイベントがセットされているキャラは「このキャラがコンタクトしたとき、そのコンタクト中、このキャラをAP＋2000する。」を持つ。',
  ruleRefs: ['rules/08-contact.md', 'rules/16-card-set.md', 'rules/22-qa-action-contact.md'],
};

export const B03041: CardDef = {
  id: 'B03041',
  no: '0298/B03041',
  kind: 'event',
  names: ['直球勝負'],
  colors: ['緑'],
  level: 5,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133249354568.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/16-card-set.md',
    'rules/22-qa-action-contact.md',
  ],
};
