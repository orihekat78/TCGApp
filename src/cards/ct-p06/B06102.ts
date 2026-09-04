// cards/ct-p06/B06102 コルン (character) — Task A green候補 (engine変更0)
// rules: rules/05-turn-phases.md, rules/03-field-areas.md, rules/15-abilities-effects.md, rules/09-cutin-disguise.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   自分のターン終了時、このキャラをスリープさせてもよい。そうした場合、自分の現場にいる〚カード名［キャンティ］〛を1枚まで選び、アクティブにする。
//   【カットイン】AP＋1000（コンタクト中に手札からリムーブして使う）
// 句マッピング:
//   - 自分のターン終了時、…（発動タイミング） => trigger:{hook:'phase:end:start'} + condition:{kind:'turn',player:'self'} [D08003.ts a2 + B07021.ts a1 both use trigger:{hook:'phase:end:start'} with condition:{kind:'turn',player:'self'} for 「自分のターン終了時」; capability-map hooks: phase:end:start source undefined → gate by condition turn (NOT selfOnly), which both exemplars do.]
//   - このキャラをスリープさせてもよい。そうした場合、… => {kind:'optional', effect:{kind:'chain', steps:[ sceneSetState{uid:'$self',state:'sleep'}, … ]}} [B04049.ts a1 is the exact structural twin (「このキャラをスリープさせ、…してもよい。そうした場合、…」): optional wrapper around a chain whose step1 = {verb:'sceneSetState',args:{uid:'$self',state:'sleep'}}. capability-map: optional runs inner only if optionalRun (human opt-in); chain = 「そうした場合」 no-apply-stop semantics.]
//   - このキャラをスリープさせ（自己スリープ） => atom sceneSetState {uid:'$self', state:'sleep'} (chain step1) [B04049.ts a1 step1 + atom-handlers.ts:702-708 sceneSetState: literal uid (not '$pick', no n/max) → resolveBindRef → mutate.scene.setState; deterministic, never sets __chainStepNoApply (resolve-picks.ts:436/480 set it only on empty short-form pick candidates), so chain proceeds to step2.]
//   - 自分の現場にいる〚カード名［キャンティ］〛を1枚まで選び、アクティブにする => atom sceneSetState {player:'self', max:1, side:'self', state:'active', filter:{cardName:'キャンティ'}} (chain step2, short-form Pattern A pick) [B07056.ts a1 (「自分の現場の…〚カード名X〛を1枚まで選びアクティブ」) = sceneSetState{player:'self',max:1,side:'self',state:'active',filter:{cardName:[...]}}; B03017.ts/B05096.ts use the same {player:'self',max:1,state:'active',filter} short-form. atom-handlers.ts:693-699 builds short-form scene pick when uid absent + player + state string + n/max; atom-pick-spec.ts buildShortFormPick carries side+filter, max:1→n:{min:0,max:1} (0-pick legal=「1枚まで」), state is target-state not a candidate filter. candidates.ts:240 matchOneFilter honors cardName via allCardNameComponentsForDef. 「キャンティ」 is a registered char cardName (B03119/D07020/PR192).]
//   - 【カットイン】AP＋1000 => type:'triggered', scope:'on-hand', trigger:{hook:'effect:declared',optional:true,selfOnly:true}, effect: atom charModifyAP {uid:'$contact.byUid', delta:1000, scope:'contact'} [D02012.ts a1 is the exact twin (【カットイン】AP＋2000) — identical shape, only delta differs (2000→1000). capability-map hooks: Cut-in = triggered + scope:'on-hand' + trigger:{hook:'effect:declared',optional:true}; effect runs vs contact via source.bindings ($contact.byUid). dyn $contact.byUid = attacker uid; scope:'contact' = effect clears at contact end (rules/09).]
//   - （コンタクト中に手札からリムーブして使う）— カットイン使用規約 => engine cut-in flow auto-handles discard-to-remove after use [capability-map ICON ABILITIES: cut-in fired via flow/contact.ts (emit effect:declared {cardId,abilityId:'cutin'} then discard); the card need not encode the discard/contact-only semantics — they are engine-side (D02012/B07009 omit them too).]

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'phase:end:start'
  },
  condition: {
    kind: 'turn',
    player: 'self'
  },
  effect: {
    kind: 'conditional',
    if: { kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' },
    then: {
      kind: 'optional',
      effect: {
        kind: 'chain',
        steps: [
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            uid: '$self',
            state: 'sleep'
          }
        },
        {
          kind: 'atom',
          verb: 'sceneSetState',
          args: {
            player: 'self',
            max: 1,
            side: 'self',
            state: 'active',
            filter: {
              cardName: 'キャンティ'
            }
          }
        }
        ]
      }
    }
  },
  description: '自分のターン終了時、このキャラをスリープさせてもよい。そうした場合、自分の現場にいる[カード名 キャンティ]を1枚まで選び、アクティブにする。',
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/15-abilities-effects.md',
    'rules/03-field-areas.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    optional: true,
    selfOnly: true
  },
  effect: {
    kind: 'atom',
    verb: 'charModifyAP',
    args: {
      uid: '$contact.byUid',
      delta: 1000,
      scope: 'contact'
    }
  },
  description: '【カットイン】AP＋1000',
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ]
};

export const B06102: CardDef = {
  id: 'B06102',
  no: '0719/B06102',
  kind: 'character',
  names: [
    'コルン'
  ],
  colors: [
    '黒'
  ],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: [
    '黒ずくめの組織'
  ],
  rarity: 'C',
  imageUrl: '1754285264383273.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/05-turn-phases.md',
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/09-cutin-disguise.md',
    'rules/22-qa-action-contact.md'
  ],
};
