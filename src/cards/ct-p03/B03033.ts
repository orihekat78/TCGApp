// cards/ct-p03/B03033 遠山和葉 (character) — card-authoring vein 解禁 (engine変更0, apDeltaAuraOpp 初 consumer, 2026-07-03)
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 16-card-set.md, 17-icons.md, 24-qa-naming-stun.md
//
// 公式テキスト:
//   【自分ターン中】相手の現場にいるカードがセットされているキャラをAP－1000する。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//
// 公式Q&A (cards-data ct-p03 TSV):
//   Q: この能力ではキャラを選んだりしませんが、どのようにAP－1000するのですか？
//   A: 「相手の現場にいるカードがセットされているキャラ」すべてをAP－1000します。（発動するものではなく、
//      有効である限り自動的に影響を及ぼす。）→ 常時有効型 aura (rules/24 §常時有効型)。select ではない。
//   Q: セットが2枚の場合 AP－2000？ A: いいえ、枚数にかかわらず AP－1000。ただし《遠山和葉》が2枚以上いれば
//      それぞれの AP－1000 が重複する。→ 固定 delta。aura reader は bearer ごとに加算するため複数 bearer で stack。
//   Q: 「相手の能力や効果によって選ばれない」キャラも対象？ A: はい。選ぶ能力ではないのでセットがあれば AP－1000。
//      → select 不介在を裏づけ = apDeltaAuraOpp が正解。
//
// 句マッピング:
//   【自分ターン中】相手の現場のセット済キャラを AP－1000
//     => a1: type 'continuous' scope 'on-scene', condition {turn:self} (= 【自分ターン中】、rules/17),
//        continuousModifier {apDeltaAuraOpp:-1000, auraFilterOpp:{hasSetCards:true, kind:'character'}}
//     - apDeltaAuraOpp/auraFilterOpp = cross-side 数値 aura (engine additive 2026-06-29)。read.char.ts が bearer 自身の
//       side で ability.condition を評価し、反対 side 現場の各キャラに auraFilterOpp (matchOneFilter) 一致で apDeltaAuraOpp
//       を加算。D07010 a1 (自 side apDeltaAura) の Opp 版。auraExcludeSelf 不要 (self は反対 side ゆえ不一致)。
//     - hasSetCards = TargetFilter「カードがセットされているキャラ」(effect.ts、rules/16)。重ねカードは対象外 (別機構)。
//   【ヒラメキ】カードを1枚引く => a2: D07010 a2 完全同型 (evidence:remove-by-action optional draw 1、rules/10)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { apDeltaAuraOpp: -1000, auraFilterOpp: { hasSetCards: true, kind: 'character' } },
  description: '【自分ターン中】相手の現場にいるカードがセットされているキャラをAP－1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/17-icons.md'],
};

export const B03033: CardDef = {
  id: 'B03033',
  no: '0290/B03033',
  kind: 'character',
  names: ['遠山和葉'],
  colors: ['緑'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133249299817.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
