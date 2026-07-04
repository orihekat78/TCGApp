// cards/ct-p09/B09090 風の女神 (case) — CARD PHASE step12 (setShippuWaive 初 consumer、engine変更0)
// rules: rules/01-victory-conditions.md, rules/13-keywords.md, rules/15-abilities-effects.md,
//        rules/17-icons.md, rules/21-declared-ability-cost.md
//
// 公式テキスト:
//   この事件が解決編になったとき、自分は手札を1枚リムーブする。
//   【解決編】【宣言】【ターン1】〚手札から、〚特徴［神奈川県警］〛のキャラか【疾風】を持つキャラを
//   1枚リムーブする〛：このターン中、次に自分の現場に登場したキャラは【疾風】の条件を無視できる。
//   （2番目以降に登場しても発動する）
//
// 句マッピング:
//   - 「解決編になったとき手札1枚リムーブ」=> 共通クラス caseResolvedHandRemove (D09027/B05024 同型)。
//   - 【解決編】=> condition caseStatus{解決編} (rules/17)。
//   - コスト「手札から〚特徴［神奈川県警］〛のキャラか【疾風】を持つキャラを1枚リムーブ」=>
//     removeFromHand + pick query filterAny [trait 神奈川県警 × kind character, keyword 疾風 × kind character]
//     (trait/keyword 異軸 OR = filterAny any-match)。公式Q&A「有効でない【疾風】でもリムーブ可」=
//     keyword filter は印字判定 (rules/17 Q&A「持つ」= 静的印字) で自動整合。
//   - 「次に自分の現場に登場したキャラは【疾風】の条件を無視できる」=> setShippuWaive{player:'self'}
//     (engine mega-wave W6 step4 P16 — shippuWaiveArmed 次登場1体消費、疾風有無不問で消費 = 公式Q&A
//     「疾風を持たないキャラが先に登場したら消費」pin 済、listeners/triggered.ts)。
import type { AbilityDef, CardDef } from '@/engine/types';
import { caseResolvedHandRemove } from '../_shared/caseResolvedHandRemove.js';

const a1: AbilityDef = caseResolvedHandRemove({ n: 1, abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'declared',
  scope: 'always',
  condition: { kind: 'caseStatus', status: '解決編' },
  limit: { kind: 'turn', n: 1 },
  cost: {
    kind: 'removeFromHand',
    n: 1,
    target: {
      kind: 'pick',
      query: {
        area: 'hand',
        side: 'self',
        filterAny: [
          { trait: '神奈川県警', kind: 'character' },
          { keyword: '疾風', kind: 'character' },
        ],
      },
      n: { min: 1, max: 1 },
      chooser: 'self',
    },
  },
  effect: { kind: 'atom', verb: 'setShippuWaive', args: { player: 'self' } },
  description:
    '【解決編】【宣言】【ターン1】〚手札から、〚特徴［神奈川県警］〛のキャラか【疾風】を持つキャラを1枚リムーブする〛：このターン中、次に自分の現場に登場したキャラは【疾風】の条件を無視できる。（2番目以降に登場しても発動する）',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md', 'rules/21-declared-ability-cost.md'],
};

export const B09090: CardDef = {
  id: 'B09090',
  no: '1030/B09090',
  kind: 'case',
  names: ['風の女神'],
  colors: ['黄'],
  caseTraits: [],
  traits: [],
  rarity: 'C',
  imageUrl: '1775608926366312.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
