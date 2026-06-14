// cards/ct-p09/B09017 吉田歩美 (キャラ) — engine拡張 wave#2 cluster5 (usage-restriction aura, 2026-06-14)
// rules: 09-cutin-disguise.md, 17-icons.md, 19-special-rules.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【相手ターン中】自分の現場に〚カード名［吉田歩美］〛以外のレベル4の〚特徴［少年探偵団］〛のキャラがいる場合、
//   相手は【カットイン】を使用できない。
//
// 句マッピング:
//   gating 【相手ターン中】=> turn:'opp' (owner が非ターンプレイヤー = 相手のターン)。
//   board 条件「自分の現場に[吉田歩美]以外のレベル4の[少年探偵団]がいる場合」=>
//     sceneHas{ area:'scene', side:'self', filter:{ trait:'少年探偵団', levelMin:4, levelMax:4,
//               custom: 名前 component が[吉田歩美]を含まない }, nMin:1 }。
//     「[吉田歩美]以外」= 名前除外。excludeSelf (uid 単位) では2枚目の[吉田歩美]を誤許容するため、
//     custom で allCardNameComponentsForDef ≠ '吉田歩美' を判定 (rules/19 split-name 対応、eval.ts §bond と同基準)。
//     「レベル4」= 完全一致 → levelMin:4 かつ levelMax:4。
//   「相手は【カットイン】を使用できない」=> continuous + opponentRestrict:['cutin'] (条件成立中のみ有効、rules/24)。
//   公式 qAndA「この能力が有効でも相手は【変装】可能」→ aura は canDisguise に触れない (cutin token のみ)。

import type { AbilityDef, CardDef, Condition, GameState, Candidate } from '@/engine/types';
import { lookupCardDef, allCardNameComponentsForDef } from '@/engine/target/card-def-registry.js';

const oppTurnAndBoard: Condition = {
  kind: 'and',
  cs: [
    { kind: 'turn', player: 'opp' }, // 【相手ターン中】
    {
      kind: 'sceneHas',
      query: {
        area: 'scene',
        side: 'self',
        filter: {
          trait: '少年探偵団',
          levelMin: 4,
          levelMax: 4,
          // [吉田歩美]以外 — 名前除外 (split-name 対応 rules/19)。excludeSelf(uid) では同名2枚目を誤許容するため custom。
          custom: (_s: GameState, cand: Candidate) => {
            if (cand.kind !== 'char') return false;
            const d = lookupCardDef(cand.cardId);
            return !!d && !allCardNameComponentsForDef(d).includes('吉田歩美');
          },
        },
      },
      nMin: 1,
    },
  ],
};

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: oppTurnAndBoard,
  continuousModifier: { opponentRestrict: ['cutin'] },
  description:
    '【相手ターン中】自分の現場に〚カード名［吉田歩美］〛以外のレベル4の〚特徴［少年探偵団］〛のキャラがいる場合、相手は【カットイン】を使用できない。',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/24-qa-naming-stun.md'],
};

export const B09017: CardDef = {
  id: 'B09017',
  no: '0962/B09017',
  kind: 'character',
  names: ['吉田歩美'],
  colors: ['青'],
  level: 4,
  ap: 3000,
  lp: 0,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1775608819004636.jpg',
  abilities: [a1],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/24-qa-naming-stun.md'],
};
