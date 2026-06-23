// cards/ct-p01/B01044 怪盗キッド (character) — deck-mill-gated-chain wave (engine: mill gate flag, 2026-06-23)
// rules: 14-refresh.md, 15-abilities-effects.md (§「〜してもよい。そうした場合」), 17-icons.md (§【パートナー(色)】/【登場時】),
//        23-qa-disguise-cutin.md (§デッキ下移動はリムーブでない), 26-qa-deck-refresh.md
//
// 公式テキスト:
//   【パートナー白】【登場時】自分のデッキのカードを上から7枚リムーブしてもよい。そうした場合、キャラを1枚まで選び、デッキの下に移す。
// 公式Q&A (ct-p01 TSV): Q「デッキが6枚以下の場合、すべてリムーブしてキャラを選べるか」A「いいえ。『上から7枚リムーブする』が
//   実行できない場合、それ以降の効果は解決できません」→ mill gate:true (deck<7 なら何もせず chain break)。
//
// 句マッピング:
//   - 【パートナー白】 => condition:{kind:'partnerColor', color:'白'} (rules/17 §条件未充足=能力を持たない扱い、exemplar B02003 a1)。
//        ※ B01044 は character。条件はプレイヤーのパートナー札の色を参照する (B01044 自身の色ではない)。
//   - 【登場時】 => trigger:{hook:'enter', selfOnly:true}。
//   - 「リムーブしてもよい。そうした場合〜」 => optional{chain[...]} (exemplar D04007 a2 / B08058 a2)。
//        step1 = mill{n:7, gate:true}: deck<7 で chainStepNoApply → step2 skip = gate (B01044 Q&A)。
//        step2 = sceneToDeck{side:'either', max:1, pos:'bottom'}: 「キャラを1枚まで選びデッキの下」
//                (エリア指定なし=両現場 rules/15、1枚まで=0可)。デッキ下移動はリムーブでない → 現場リムーブ時不発火 (rules/23)。
//                exemplar B02003 a1 / B08058 a2 step3。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '白' },
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        // 自分のデッキのカードを上から7枚リムーブしてもよい (してもよい=optional / gate:true=deck<7 で不成立)
        { kind: 'atom', verb: 'mill', args: { player: 'self', n: 7, gate: true } },
        // そうした場合、キャラを1枚まで選び、デッキの下に移す
        { kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'either', max: 1, pos: 'bottom' } },
      ],
    },
  },
  description: '【パートナー白】【登場時】自分のデッキのカードを上から7枚リムーブしてもよい。そうした場合、キャラを1枚まで選び、デッキの下に移す。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/23-qa-disguise-cutin.md', 'rules/26-qa-deck-refresh.md'],
};

export const B01044: CardDef = {
  id: 'B01044',
  no: '0036/B01044',
  kind: 'character',
  names: ['怪盗キッド'],
  colors: ['白'],
  level: 8,
  ap: 7000,
  lp: 2,
  traits: ['怪盗'],
  keywords: [],
  rarity: 'SR',
  imageUrl: '1714013020306997.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/23-qa-disguise-cutin.md', 'rules/26-qa-deck-refresh.md'],
};
