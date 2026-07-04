// cards/ct-p08/B08014 毛利蘭 (character) — CARD PHASE step12 (selfSelectedByOwnMrThisTurn 初 consumer、engine変更0)
// rules: rules/07-action-flow.md, rules/13-keywords.md, rules/15-abilities-effects.md,
//        rules/18-mr.md, rules/22-qa-action-contact.md
//
// 公式テキスト:
//   〚突撃〛（登場したターンからすぐにアクションできる）
//   このキャラがアクションしたとき、ターン終了時までこのキャラは「ターン終了時、このターン中に
//   このキャラが自分のMRの能力によって選ばれていなかった場合、このキャラを現場から手札に移す。」を持つ。
//
// 句マッピング:
//   - 〚突撃〛=> keywords:['突撃'] (rules/13)。
//   - 「このキャラがアクションしたとき」=> trigger{hook:'action:declare', selfOnly:true}
//     (rules/22 アクション宣言時発動。アクション[キャラ]/[事件] 両方)。
//   - 「ターン終了時までこのキャラは「…」を持つ」=> charGrantAbility{uid:'$self', scope:'turn'}
//     (B02014/B02068 同型の入れ子付与。self 宛の差分のみ)。
//   - granted「ターン終了時、…選ばれていなかった場合、現場から手札に移す」=>
//     trigger{hook:'phase:end:start'} + conditional{if: not{selfSelectedByOwnMrThisTurn},
//     then: sceneToHand{uid:'$self'}} (engine mega-wave W6 step6 r79 — selectedByOwnMr dual-path
//     tagging が resolve-picks/apply-pick 両経路で _mrSelectCharUids を記録、cond は
//     「発動前後に関係なく選ばれていたら不成立」= per-turn flag 参照で公式Q&A整合)。
//     granted は scope:'turn' → phase:end:start 発火後 clearTurnEffects('turn') で消滅
//     (flow/turn.ts endTurn 順序確認済 = 1回だけ発火)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:declare', selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'charGrantAbility',
    args: {
      uid: '$self',
      scope: 'turn',
      ability: {
        trigger: { hook: 'phase:end:start' },
        effect: {
          kind: 'conditional',
          if: { kind: 'not', c: { kind: 'selfSelectedByOwnMrThisTurn' } },
          then: { kind: 'atom', verb: 'sceneToHand', args: { uid: '$self' } },
        },
        description:
          'ターン終了時、このターン中にこのキャラが自分のMRの能力によって選ばれていなかった場合、このキャラを現場から手札に移す。（B08014 付与）',
      },
    },
  },
  description:
    'このキャラがアクションしたとき、ターン終了時までこのキャラは「ターン終了時、このターン中にこのキャラが自分のMRの能力によって選ばれていなかった場合、このキャラを現場から手札に移す。」を持つ。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/15-abilities-effects.md',
    'rules/18-mr.md',
    'rules/22-qa-action-contact.md',
  ],
};

export const B08014: CardDef = {
  id: 'B08014',
  no: '0855/B08014',
  kind: 'character',
  names: ['毛利蘭'],
  colors: ['青'],
  level: 7,
  ap: 7000,
  lp: 1,
  traits: ['高校生', '毛利探偵事務所', '空手家'],
  keywords: ['突撃'],
  rarity: 'C',
  imageUrl: '1770731204386897.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/18-mr.md',
    'rules/22-qa-action-contact.md',
  ],
};
