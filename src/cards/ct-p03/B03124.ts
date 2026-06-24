// cards/ct-p03/B03124 テキーラ (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【パートナー黒】〚突撃〛（登場したターンからすぐにアクションできる）\n自分のターン終了時、このキャラがスリープ状態かスタン状態の場合、このキャラをリムーブする。
// 句マッピング:
//   - 【パートナー黒】〚突撃〛（登場したターンからすぐにアクションできる） => a1 = partnerColorKeyword({color:'黒', kw:'突撃', abilityId:'a1'}) [Shared fn src/cards/_shared/partnerColorKeyword.ts:11-36 builds {type 'continuous', scope 'on-scene', condition:{kind 'partnerColor',color}, continuousModifier:{grantKeywords:()=>[kw]}}. Exemplar D03003.ts a1 = partnerColorKeyword({color:'白', kw:'迅速', abilityId:'a1'}) — identical pattern (【パートナー色】〚keyword〛). qAndA confirms ONLY 突撃 is partnerColor-gated, so it lives in this conditional continuous ability and a2 is independent. partnerColor eval (cond/eval.ts:36-44) = owner partner CardDef.colors intersects color.]
//   - 自分のターン終了時 (発動タイミング) => a2.trigger={hook 'phase:end:start'} + a2.condition AND-leg {kind 'turn',player:'self'} [B07021.ts a1 + B06102.ts a1: 「自分のターン終了時」 = trigger {hook 'phase:end:start'} with condition {kind 'turn',player:'self'} (phase:end:start fires for both players' end-phase, gated to own turn by turn cond). cond/eval.ts:35 turn = state.turn.player===self.]
//   - このキャラがスリープ状態かスタン状態の場合 => a2.condition AND-leg {kind 'or', cs:[{charStateIs self sleep},{charStateIs self stun}]} [or-cond shape from B02012.ts:33 condition:{kind 'or',cs:[...]} (cond/eval.ts:33 or=.some). charStateIs shape from B04049.ts a1 / B06102.ts a1 {kind 'charStateIs',ref:{kind 'self'},state:'sleep'} (cond/eval.ts:231-234 compares charRead.state(uid)===cond.state — accepts any state literal incl 'stun'; 'stun' literal is valid per state model rules/03 & sceneSetState state:'stun' usage B03103/B03092). 「か」=OR of the two state checks.]
//   - このキャラをリムーブする (forced, 「してもよい」ではない) => a2.effect = {kind 'atom', verb 'sceneRemove', args:{uid:'$self', cause:'effect'}} [B07021.ts a1 line 28: forced self-remove = {kind 'atom',verb 'sceneRemove',args:{uid:'$self',cause:'effect'}} (no optional wrapper since text is 「リムーブする」 = 必須, rules/15 quantifier). Identical to target. Whole state gate placed in condition (B06102 a1 style: turn+state-gate in condition AND, effect = bare action) rather than conditional-effect wrapper since there is no else/pick branch.]
//   - qAndA: 【パートナー黒】非充足でも2つ目の能力は無効にならない (突撃のみpartnerColor依存) => a2 has NO partnerColor condition (only turn + state); partnerColor gates a1 only [公式qAndA B03124. Splitting 突撃 (a1, partnerColor-gated continuous) from the phase-end self-remove (a2, partnerColor-independent triggered) faithfully encodes this ruling. a2.condition contains no partnerColor leg.]

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

const a1 = partnerColorKeyword({
  color: '黒',
  kw: '突撃',
  abilityId: 'a1'
});

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'and',
    cs: [
      {
        kind: 'turn',
        player: 'self'
      },
      {
        kind: 'or',
        cs: [
          {
            kind: 'charStateIs',
            ref: {
              kind: 'self'
            },
            state: 'sleep'
          },
          {
            kind: 'charStateIs',
            ref: {
              kind: 'self'
            },
            state: 'stun'
          }
        ]
      }
    ]
  },
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: {
      uid: '$self',
      cause: 'effect'
    }
  },
  description: '自分のターン終了時、このキャラがスリープ状態かスタン状態の場合、このキャラをリムーブする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md'
  ]
};

export const B03124: CardDef = {
  id: 'B03124',
  no: '0373/B03124',
  kind: 'character',
  names: [
    'テキーラ'
  ],
  colors: [
    '黒'
  ],
  level: 6,
  ap: 6000,
  lp: 0,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'C',
  imageUrl: '1729133510386139.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/03-field-areas.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md'
  ],
};
