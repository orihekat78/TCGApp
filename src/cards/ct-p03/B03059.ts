// cards/ct-p03/B03059 土井塔克樹 (キャラ) — engine拡張 wave#2 cluster4 (remove-area → deck-bottom, 2026-06-14)
// rules: 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 21-declared-ability-cost.md
//
// 公式テキスト:
//   【宣言】【ターン1】〚リムーブエリアにある【白】のキャラを1枚デッキの下に移す〛：
//     キャラを1枚まで選び、ターン終了時までAP＋1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［怪盗キッド］〛を
//     1枚まで選び、手札に加える。
//
// 句マッピング:
//   a1: 【宣言】【ターン1】 => declared + limit:{turn,1}。
//       cost 〚リムーブエリアにある【白】のキャラを1枚デッキの下に移す〛 => removeAreaToDeckBottom
//         {color:'白', kind:'character', side:'self', n:1} (cluster4 新 cost。query.side:'self' =
//          rules/21「自分の」省略 + 公式Q&A「相手のリムーブエリアのカードは移せない」)。
//       「キャラを1枚まで選び、ターン終了時までAP＋1000する」=> charModifyAP 短縮形
//         {delta:1000, max:1(=0〜1 skip可 rules/15), side:'either'(「キャラ」に自分の限定なし → 両現場),
//          scope:'turn'} (D01006 a2 同型)。
//   a2: 【ヒラメキ】 => triggered + trigger{hook:'evidence:remove-by-action', optional:true}, scope:'on-evidence'。
//       「自分のリムーブエリアにある〚カード名［怪盗キッド］〛を1枚まで選び、手札に加える」=>
//         handAddFromRemove{player:'self', max:1, filter:{cardName:'怪盗キッド'}} (B03012 a2 同型。
//         "カード名［怪盗キッド］" 表記=キャラ限定なし → kind 付けない / 怪盗キッド名はキャラ印字のみ)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'declared',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】
  // 〚リムーブエリアにある【白】のキャラを1枚デッキの下に移す〛 (自分のみ / rules/21・Q&A)
  cost: {
    kind: 'removeAreaToDeckBottom',
    target: { kind: 'pick', query: { area: 'remove', side: 'self', filter: { color: '白', kind: 'character' } }, n: { min: 1, max: 1 }, chooser: 'owner' },
    n: 1,
  },
  // キャラを1枚まで選び、ターン終了時までAP＋1000する (短縮形 / either-side / max:1)
  effect: { kind: 'atom', verb: 'charModifyAP', args: { delta: 1000, max: 1, side: 'either', scope: 'turn' } },
  description:
    '【宣言】【ターン1】〚リムーブエリアにある【白】のキャラを1枚デッキの下に移す〛：キャラを1枚まで選び、ターン終了時までAP＋1000する。',
  ruleRefs: ['rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true }, // 【ヒラメキ】(任意発動)
  // 自分のリムーブエリアにある〚カード名［怪盗キッド］〛を1枚まで選び、手札に加える
  effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { cardName: '怪盗キッド' } } },
  description:
    '【ヒラメキ】（証拠からリムーブされるときに発動する）自分のリムーブエリアにある〚カード名［怪盗キッド］〛を1枚まで選び、手札に加える。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/17-icons.md'],
};

export const B03059: CardDef = {
  id: 'B03059',
  no: '0314/B03059',
  kind: 'character',
  names: ['土井塔克樹'],
  colors: ['白'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['怪盗', '医大生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133406772537.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/21-declared-ability-cost.md',
  ],
};
