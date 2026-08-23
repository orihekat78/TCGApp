// cards/ct-p08/B08050 宮野明美 (character R) — engine変更0 (ContinuousModifier.lvlDelta 解放, a206e9dc 2026-06-24)
// rules: rules/11-reasoning.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/26-qa-deck-refresh.md
//
// 公式テキスト:
//   【解決編】現場にいるこのキャラをレベル＋3する。
//   【登場時】自分のデッキのカードを上から3枚見る。その中からカードを1枚まで公開して手札に加え、
//     残りをリムーブエリアに移す。〚カード名［諸星大］〛か〚［宮野志保］〛か〚［宮野エレーナ］〛か
//     〚［宮野厚司］〛以外のカードを手札に加えた場合、手札を1枚リムーブする。
//
// 句マッピング:
//   - a1【解決編】現場のこのキャラをレベル+3 = continuous{scope:'on-scene', condition:caseStatus解決編,
//       continuousModifier:{lvlDelta:3}} (engine additive wave a206e9dc で read.char.level +
//       candidates.matchOneFilter の2 site が honor)。self-only on-scene。
//       公式QA「現場以外のエリアではレベル4のまま」= play-level (hand-use/next-hint) が静的のまま で一致。
//   - a2【登場時】= triggered enter selfOnly。「上から3枚見る…1枚まで手札…残りリムーブ」=
//       deckRevealUntil{chooseMatch:'upTo', maxN:3, filter なし(=任意カード pick 可)} → 取得は handAddFromDeck →
//       残りは boundToRemove (リムーブエリア、B08020 は deckToBottomBound でデッキ下 = 別句)。
//       「1枚まで」=0枚可 (rules/15, BUG-132 decline channel)。
//   - 「〚X〛か〚Y〛か〚Z〛か〚W〛以外のカードを手札に加えた場合、手札を1枚リムーブ」=
//       conditional{if: boundMatchesFilter($matched, cardNameNot:[4名])} → discard 1。
//       boundMatchesFilter は bound 空(=0枚 add)なら false を返すため「加えた場合」gate を内包 (eval.ts:263)。
//       公式QA「残りをリムーブエリアに移す。まで解決でリフレッシュ判定」= boundToRemove 後の deck0 で成立。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'caseStatus', status: '解決編' },
  continuousModifier: { lvlDelta: 3 },
  description: '【解決編】現場にいるこのキャラをレベル＋3する。',
  ruleRefs: ['rules/11-reasoning.md', 'rules/17-icons.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          maxN: 3,
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', deferRefresh: true } },
      },
      // 公式テキスト順: 「残りをリムーブエリアに移す。…以外を加えた場合、手札を1枚リムーブ」=
      // boundToRemove → discard の順 (敵対 review BLOCKER: 逆順だと deck≤3 で boundToRemove の
      // リフレッシュが discard 済み札を deck へ巻き戻す。公式QA「残りをリムーブに移す。まで解決で
      // リフレッシュ」ct-p08 char.tsv)。padding 無のデッキ枯渇時のみ観測差。
      { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed', refreshAfter: true } },
      // 「〚X〛か…以外のカードを手札に加えた場合、手札を1枚リムーブ」: boundMatchesFilter は bound 空
      // (=0枚 add) で false を返すため「加えた場合」gate を内包。
      {
        kind: 'conditional',
        if: {
          kind: 'boundMatchesFilter',
          bindKey: '$matched',
          filter: { cardNameNot: ['諸星大', '宮野志保', '宮野エレーナ', '宮野厚司'] },
        },
        then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【登場時】デッキ上3枚を見て1枚まで手札に加え、残りをリムーブ。〚諸星大/宮野志保/宮野エレーナ/宮野厚司〛以外を加えた場合は手札を1枚リムーブ。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B08050: CardDef = {
  id: 'B08050',
  no: '0888/B08050',
  kind: 'character',
  names: ['宮野明美'],
  colors: ['赤'],
  level: 4, ap: 3000, lp: 1,
  traits: [], keywords: [],
  rarity: 'R',
  imageUrl: '1770731238618620.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/11-reasoning.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/26-qa-deck-refresh.md'],
};
