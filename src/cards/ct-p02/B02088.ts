// cards/ct-p02/B02088 犯人 (character) — CARD PHASE step12 (setEvidenceGainSuppress / cutin 自己召喚 初 consumer、engine変更0)
// rules: rules/09-cutin-disguise.md, rules/10-action-event.md, rules/15-abilities-effects.md,
//        rules/19-special-rules.md, rules/25-qa-effects-resolution.md
//
// 公式テキスト:
//   このキャラ以外の〚カード名［犯人］〛が自分の現場に登場したとき、このキャラをリムーブする。
//   自分か相手のターン終了時、自分の証拠を上から1つリムーブする。（【ヒラメキ】は発動しない）
//   このキャラを表向きのまま証拠として得る。
//   【カットイン】自分の現場に空きがある場合、スリープ状態で登場させる。
//   【ヒラメキ】相手はこのアクションによって証拠を得られない。
//
// 句マッピング:
//   - 「このキャラ以外の〚カード名［犯人］〛が自分の現場に登場したとき、このキャラをリムーブ」=>
//     trigger{hook:'enter', matcherCondition:triggerCharMatches{side:'self', excludeSource:true,
//     filter:{cardName:'犯人'}}} + sceneRemove{uid:'$self', cause:'effect'} (PR117/PR118 a2 の
//     filter trait→cardName 差替のみ)。
//   - 「自分か相手のターン終了時」=> trigger{hook:'phase:end:start'} matcher 無し = 両者のターン終了で発動。
//     「自分の証拠を上から1つリムーブする（ヒラメキは発動しない）」=> evidenceLose{player:'self', n:1}
//     (効果によるリムーブ = rules/10 ヒラメキ不発動が既存機序、括弧書きは確認的注記)。
//     「このキャラを表向きのまま証拠として得る」=> sceneToEvidence{uid:'$self', faceUp:true}
//     (W1 verb、MR① redirect parity)。公式Q&A「証拠が1つもない場合も可能な部分を解決 = 結果+1」=
//     sequence の evidenceLose 0件 no-op → sceneToEvidence 実行で自動整合 (rules/15 可能な限り解決)。
//   - 【カットイン】「自分の現場に空きがある場合、スリープ状態で登場させる」=>
//     cutin idiom (hook effect:declared + optional + selfOnly) + sceneEnter{cardId:'$trigger.cardId',
//     enterSleep:true, sourceRequired:true, from remove} — cutin 使用でリムーブ済の自身を場に出す。
//     「空きがある場合」= atomSceneEnter の built-in fullness check (switchRemoveUid 無指定 →
//     scene-full-skip silent no-op)。公式Q&A「空きがなくても使用可 (リムーブに置かれるだけ)」= 自動整合。
//   - 【ヒラメキ】=> setEvidenceGainSuppress{player:'opp'} (B03126 と同、engine mega-wave W6 step7)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'enter',
    matcherCondition: {
      kind: 'triggerCharMatches',
      side: 'self',
      excludeSource: true,
      filter: { cardName: '犯人' },
    },
  },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } },
  description: 'このキャラ以外の〚カード名［犯人］〛が自分の現場に登場したとき、このキャラをリムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'phase:end:start' },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'evidenceLose', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'sceneToEvidence', args: { uid: '$self', faceUp: true } },
    ],
  },
  description:
    '自分か相手のターン終了時、自分の証拠を上から1つリムーブする。（【ヒラメキ】は発動しない）このキャラを表向きのまま証拠として得る。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      cardId: '$trigger.cardId',
      viaEffect: true,
      enterSleep: true,
      sourceRequired: true,
      target: { query: { area: 'remove', side: 'self' } },
    },
  },
  description: '【カットイン】自分の現場に空きがある場合、スリープ状態で登場させる。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/20-color-and-switch.md'],
};

const a4: AbilityDef = {
  id: 'a4',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'setEvidenceGainSuppress', args: { player: 'opp' } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）相手はこのアクションによって証拠を得られない。',
  ruleRefs: ['rules/10-action-event.md', 'rules/25-qa-effects-resolution.md'],
};

export const B02088: CardDef = {
  id: 'B02088',
  no: '0249/B02088',
  kind: 'character',
  names: ['犯人'],
  colors: ['黒'],
  level: 3,
  ap: 0,
  lp: 0,
  traits: ['犯人'],
  rarity: 'C',
  imageUrl: '1721357309976463.jpg',
  abilities: [a1, a2, a3, a4],
  ruleRefs: [
    'rules/09-cutin-disguise.md',
    'rules/10-action-event.md',
    'rules/15-abilities-effects.md',
    'rules/19-special-rules.md',
    'rules/25-qa-effects-resolution.md',
  ],
};
