// cards/ct-p01/B01093 目暮十三 (character) — S2 deck cluster (非所有者 chooser deck-place, 2026-07-10)
// rules: 10-action-event.md, 13-keywords.md (ミスリード), 15-abilities-effects.md, 17-icons.md,
//        26-qa-deck-refresh.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//   【登場時】相手はデッキのカードを上から1枚公開する。そのカードをデッキの上か下に移す。（自分が上か下かを選ぶ）
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 公式 qAndA (ct-p01 character.tsv):
//   - デッキの上に移す場合は裏向きで移す (engine 上デッキは常に非公開 = 追加処理不要)。
//   - ミスリード1 = 推理終了時まで LP-1 / 1回の推理に何枚でも同時可 (misreadX 共通クラス既定)。
//
// 句マッピング (S2 B01093 — grounding 2026-07-10):
//   a1: 〚ミスリード1〛 => misreadX({x:1}) 共通クラス (D01010 同型)。
//   a2: 【登場時】=> trigger enter selfOnly。「相手はデッキ上1枚公開」=> deckRevealUntil{player:'opp',
//       maxN:1, bind:'$revealed'} (B03096 同キャラ捜査1 の player:'opp' precedent)。
//       「そのカードをデッキの上か下に移す（自分が選ぶ）」=> deckPlaceSplitBound{player:'opp'}
//       — 選択者 = ability owner (ownerPlayer gate、S2 是正)。⚠ 同キャラ B03096 の捜査1 (相手が順を
//       選ぶ = deckToBottomBound) と選択者方向が異なる (印字「自分が」、BUG-177 教訓の方向突合済)。
//       相手デッキ0枚 → reveal 0 = bind 空 → place no-op (自然不発、リフレッシュ非誘発)。
//   a3: 【ヒラメキ】draw 1 => evidence:remove-by-action optional (D08013 同型。B03096 a3 とも同文)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

const a1 = misreadX({ x: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      // 相手はデッキのカードを上から1枚公開する
      { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'opp', maxN: 1, bind: '$revealed' } },
      // そのカードをデッキの上か下に移す（自分 = ability owner が選ぶ）
      { kind: 'atom', verb: 'deckPlaceSplitBound', args: { player: 'opp', bindKey: '$revealed' } },
    ],
  },
  description: '【登場時】相手はデッキのカードを上から1枚公開する。そのカードをデッキの上か下に移す。（自分が上か下かを選ぶ）',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B01093: CardDef = {
  id: 'B01093',
  no: '0081/B01093',
  kind: 'character',
  names: ['目暮十三'],
  colors: ['黄'],
  level: 4,
  ap: 3000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [], // ミスリードは misreadX ability で表現 (D01010 慣行)
  rarity: 'C',
  imageUrl: '1714013082047213.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
