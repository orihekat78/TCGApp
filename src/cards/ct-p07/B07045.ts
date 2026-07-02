// cards/ct-p07/B07045 セリザベス女王 (character) — engine wave A1 exemplar (G39 PA-read、engine0)
// rules: 03-field-areas.md (§パートナーエリア), 05-turn-phases.md (§エンドフェイズ),
//        11-reasoning.md (§ミスリード), 13-keywords.md (§ミスリード), 17-icons.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//   自分のターン終了時、自分のパートナーエリアに〚特徴［ビッグジュエル］〛のカードがある場合、
//     このキャラをアクティブにする。
//
// 句マッピング (engine 変更0 — PA-read は既存 sceneHas が candidates 経由で partner-area を列挙して成立):
//   - 〚ミスリード1〛 => a1: misreadX({x:1}) 共通クラス。
//   - 「自分のターン終了時、…ある場合、このキャラをアクティブにする」 => a2: trigger {hook:'phase:end:start'} +
//     condition {kind:'turn', player:'self'} + conditional{ if: sceneHas{area:'partner-area'…}, then: 自身 active }
//     (D08003 a2 / D03011 a1 の turn-end 判定 + sceneHas 同型。area:'partner-area' は wave-12 candidates が
//      partnerAreaCards を列挙 → filter{trait:'ビッグジュエル'} 一致 ≥1 で成立。partner singleton は
//      trait 非一致で除外)。「このキャラをアクティブにする」= sceneSetState {uid:'$self', state:'active'} (D03011)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1 = misreadX({ x: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 自分のターン終了時
  trigger: { hook: 'phase:end:start' },
  condition: { kind: 'turn', player: 'self' },
  effect: {
    kind: 'conditional',
    // 自分のパートナーエリアに〚特徴[ビッグジュエル]〛のカードがある場合
    if: { kind: 'sceneHas', query: { area: 'partner-area', side: 'self', filter: { trait: 'ビッグジュエル' } }, nMin: 1 },
    // このキャラをアクティブにする
    then: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
  },
  description: '自分のターン終了時、自分のパートナーエリアに[ビッグジュエル]のカードがある場合、このキャラをアクティブにする。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/05-turn-phases.md', 'rules/17-icons.md'],
};

export const B07045: CardDef = {
  id: 'B07045',
  no: '0774/B07045',
  kind: 'character',
  names: ['セリザベス女王'],
  colors: ['白'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['女王'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1762413994294788.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/17-icons.md',
  ],
};
