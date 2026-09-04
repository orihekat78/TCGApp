// cards/ct-p05/B05101 毛利小五郎 (character) — S1 removal/stack pair Agent4 (2026-07-11)
// rules: 03-field-areas.md, 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md,
//        19-special-rules.md, 23-qa-disguise-cutin.md
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】このキャラが〚特徴［警察］〛の場合、このキャラをリムーブエリアから
//     スリープ状態で登場させてカードを1枚引いてもよい。そうした場合、このキャラは〚特徴［警察］〛と
//     〚［警視庁］〛を失い、〚特徴［探偵］〛を持つ。（この効果はターン終了時に切れない）
//
// 句マッピング:
//   - 【相手ターン中】 => ability.condition {kind:'turn', player:'opp'} (B03116 a1 / B05020 a1 同型)。
//   - 【現場リムーブ時】(このキャラ自身) => trigger {hook:'leave:to-remove', selfOnly:true}, scope 'on-scene'
//     (handleLeaveToRemoveSelf 経由、rules/17)。
//   - 「このキャラが〚特徴［警察］〛の場合」= matcherCondition removedCharMatches{removedFilter:{trait:'警察'}}
//     — リムーブ時点の removedChar snapshot (splice 前・turnEffects 込) の実効特徴で判定
//     (cond/eval.ts removedFilter, matchOneFilter が applied override を読む)。flip 済 (警察 permanent revoke)
//     で再リムーブしても snapshot に 警察 が無く → 再発動しない (D06009 a1 matcherCondition 同型)。
//   - 「このキャラをリムーブエリアからスリープ状態で登場させてカードを1枚引いてもよい。そうした場合、〜」
//     => optional{ chain[ sceneEnter, draw, charRevokeTrait×2, charGrantTrait ] } (B03116 a1 の revive idiom +
//        trait-flip 尾。「してもよい」= optional wrapper rules/15)。
//     · sceneEnter cardId:'$trigger.cardId' = 除去された自カード (leave:to-remove payload.cardId、
//       mutate/scene.ts:337 で S1 追加)。real cardId 解決ゆえ pick 不発 (resolve-picks Pattern B は
//       !_fromAtomHandler で初期 walk 抑止)。target.query.area='remove' は単一 cardId path の sourceArea
//       splice 用 (scene.ts:191 — 無いと remove 残置の複製 bug)。bind:'$revived' で登場後 uid を捕捉。
//     · draw 1 = 「カードを1枚引く」。
//     · charRevokeTrait 警察/警視庁 (scope:'permanent') + charGrantTrait 探偵 (scope:'permanent') =
//       「〚特徴［警察］〛と〚［警視庁］〛を失い、〚特徴［探偵］〛を持つ。（ターン終了時に切れない）」
//       (WA1 出荷 verb、char.ts atomCharGrantTrait/atomCharRevokeTrait、既定 scope 'permanent' = clearTurnEffects で切れない)。
//   - Q&A (変装引継ぎ): flip 後に【変装】したキャラにも trait 変更が引き継がれる (rules/23 — disguiseInto は
//     cardId 差替のみで turnEffects 保持、既存機構ゆえ probe 不要)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  // 【相手ターン中】
  condition: { kind: 'turn', player: 'opp' },
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true, // 「このキャラが」= 除去された当人
    // 「このキャラが〚特徴［警察］〛の場合」= リムーブ時点の有効特徴 (removedChar snapshot)
    matcherCondition: { kind: 'removedCharMatches', removedFilter: { trait: '警察' } },
  },
  effect: {
    // 「登場させて…引いてもよい。そうした場合、〜」= 任意 (rules/15)
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // このキャラをリムーブエリアからスリープ状態で登場
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: '$trigger.cardId', // 除去された自カード (leave:to-remove payload.cardId)
            enterSleep: true,
            viaEffect: true,
            sourceRequired: true,
            deferSceneSwitchChoice: true,
            bind: '$revived', // 登場後 uid を捕捉 (後続 trait-flip 用)
            target: {
              kind: 'pick',
              query: { area: 'remove', side: 'self', filter: { cardId: 'B05101', kind: 'character' } },
              n: { min: 1, max: 1 },
              chooser: 'self',
            },
          },
        },
        // カードを1枚引く
        { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
        // このキャラは〚特徴［警察］〛と〚［警視庁］〛を失い、〚特徴［探偵］〛を持つ（ターン終了時に切れない）
        { kind: 'atom', verb: 'charRevokeTrait', args: { uid: '$revived.uid', trait: '警察', scope: 'permanent' } },
        { kind: 'atom', verb: 'charRevokeTrait', args: { uid: '$revived.uid', trait: '警視庁', scope: 'permanent' } },
        { kind: 'atom', verb: 'charGrantTrait', args: { uid: '$revived.uid', trait: '探偵', scope: 'permanent' } },
      ],
    },
  },
  description:
    '【相手ターン中】【現場リムーブ時】このキャラが〚特徴［警察］〛の場合、このキャラをリムーブエリアからスリープ状態で登場させてカードを1枚引いてもよい。そうした場合、このキャラは〚特徴［警察］〛と〚［警視庁］〛を失い、〚特徴［探偵］〛を持つ。（この効果はターン終了時に切れない）',
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/23-qa-disguise-cutin.md',
  ],
};

export const B05101: CardDef = {
  id: 'B05101',
  no: '0599/B05101',
  kind: 'character',
  names: ['毛利小五郎'],
  colors: ['黄'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1746628078734281.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/09-cutin-disguise.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/23-qa-disguise-cutin.md',
  ],
};
