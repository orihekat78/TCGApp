// cards/ct-p06/B06034 鬼丸城 (イベント) — engine night-wave WC2b (invokeHiramekiOfCard, 2026-07-11)
// rules: 10-action-event.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md
//
// 公式テキスト:
//   [effect] 【解決編】自分の裏向きの証拠を1つまで選び、表向きにする。この効果によって【ヒラメキ】を持つ
//     〚特徴［YAIBA］〛のカードが表向きになった場合、その【ヒラメキ】の効果を発動させてもよい。
//   [【ヒラメキ】col] 同文 (このイベント自体が証拠にある状態で action[事件] リムーブされたときも同効果)。
// 公式Q&A:
//   - 別エリアへ移動する【ヒラメキ】(ケロ介 = 証拠から登場 等) を発動させたら効果通り移動する。
//   - 自分が「【ヒラメキ】を発動できない」(世良真純) 場合でも、この効果で【ヒラメキ】の「効果」は発動できる
//     (invokeHiramekiOfCard は発動制限を貫通)。ただしこのカード自体の【ヒラメキ】は発動できない
//     (= a1 event-use 時、B06034 は face-down 証拠に居ないため自然に対象外)。
//   - 有効でない (条件アイコン未達の)【ヒラメキ】も発動できるが何も起こらない (invoke 側 ability.condition skip)。
//
// 句マッピング (印字の 2 独立意思決定に 1:1 — T2 review 指摘反映):
//   flipInvoke (a1/a2 共有):
//     sequence[
//       ① evidenceFlip{player:'self', cardIds:'$pick.cardIds', max:1(=「1つまで」0可 rules/15), faceDown:true,
//                    side:'self', bind:'$flipped'} — 「自分の裏向きの証拠を1つまで選び、表向きにする」
//                    (「する」= optional 無し。0可は pick n.min=0 まで。B08028 cardIds+bind 同型、identity 保持),
//       ② conditional{
//            if: boundMatchesFilter{bindKey:'$flipped', filter:{trait:'YAIBA', keyword:'ヒラメキ'}}
//                — 「この効果によって【ヒラメキ】を持つ〚特徴［YAIBA］〛のカードが表向きになった場合」
//                (keyword:'ヒラメキ' は defHasKeyword 印字所持判定 BUG-122 経路。0枚flip = $flipped 空 → false),
//            then: invokeHiramekiOfCard{cardId:'$flipped.cardId', trait:'YAIBA', player:'self', optional:true}
//                — 「その【ヒラメキ】の効果を発動させてもよい」。「してもよい」は atom-level optional:true
//                (walk-level optional{} は binding-依存 conditional の then 枝で pre-walk eager surface /
//                continuation runtime silent skip の両問題があるため、atom 実行時 = bind 確定・conditional
//                成立時のみ prompt を surface する — atom-handlers/core.ts atomInvokeHiramekiOfCard 参照。
//                invoke 側 trait gate は conditional と二重の defensive)。
//          }
//     ]
//   「表向きにしたが発動しない」= flip pick 実行 → inner optional decline で再現可能 (rules/15)。
//   非該当 flip (YAIBA でない / ヒラメキ無し) では conditional false → optional は surface しない。
//   a1: 【解決編】event-use 効果 = triggered{hook:'effect:declared', selfOnly, matcher:kind==='event-use'}
//       + scope:'on-hand' + condition{caseStatus:'解決編'} (D08024 a1 同型)。
//   a2: 【ヒラメキ】 = triggered{hook:'evidence:remove-by-action', optional:true} + scope:'on-evidence'
//       + condition{caseStatus:'解決編'} (event の【ヒラメキ】col 反映)。
//       NIT (T2 review 容認済): a2 は hirameki fire/skip prompt → 効果内 inner optional prompt の
//       double-prompt になる (fire = ヒラメキ自体の発動、inner = invoke の「してもよい」で意味は別個)。

import type { AbilityDef, CardDef, Effect, GameState } from '@/engine/types';

const flipInvoke: Effect = {
  kind: 'sequence',
  steps: [
    { kind: 'atom', verb: 'evidenceFlip', args: { player: 'self', cardIds: '$pick.cardIds', max: 1, faceDown: true, side: 'self', bind: '$flipped' } },
    {
      kind: 'conditional',
      if: { kind: 'boundMatchesFilter', bindKey: '$flipped', filter: { trait: 'YAIBA', keyword: 'ヒラメキ' } },
      then: { kind: 'atom', verb: 'invokeHiramekiOfCard', args: { occurrence: '$flipped', trait: 'YAIBA', player: 'self', optional: true } },
    },
  ],
};

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown, _s: GameState) => !!p && typeof p === 'object' && (p as { kind?: unknown }).kind === 'event-use',
  },
  // 【解決編】(未達 = 効果なし rules/17)
  condition: { kind: 'caseStatus', status: '解決編' },
  effect: flipInvoke,
  description:
    '【解決編】自分の裏向きの証拠を1つまで選び、表向きにする。この効果によって【ヒラメキ】を持つ〚特徴［YAIBA］〛のカードが表向きになった場合、その【ヒラメキ】の効果を発動させてもよい。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  condition: { kind: 'caseStatus', status: '解決編' },
  effect: flipInvoke,
  description:
    '【ヒラメキ】【解決編】自分の裏向きの証拠を1つまで選び、表向きにする。この効果によって【ヒラメキ】を持つ〚特徴［YAIBA］〛のカードが表向きになった場合、その【ヒラメキ】の効果を発動させてもよい。',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B06034: CardDef = {
  id: 'B06034',
  no: '0657/B06034',
  kind: 'event',
  names: ['鬼丸城'],
  colors: ['緑'],
  level: 4,
  traits: ['YAIBA'],
  rarity: 'C',
  imageUrl: '1754285189456772.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};
