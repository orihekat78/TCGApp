// cards/ct-p05/B05016 小嶋元太 (character) — wave decklook-enter-handadd (engine変更0)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p05/character.tsv col11。P 版 B05016P と effect 完全一致):
//   【登場時】自分のデッキのカードを上から3枚見る。その中から〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。
//
// 句マッピング (exemplar = B07035 a1 (src/cards/ct-p07/B07035.ts) / B09073 a2 — 同一 deck-look 構造、tail句なし):
//   - 【登場時】 => trigger {hook:'enter', selfOnly:true} (B07035 a1 と同。能力/効果による登場でも発火)
//   - 上から3枚見る + 〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え
//       => deckRevealUntil{chooseMatch:'upTo', maxN:3, filter:{trait:'少年探偵団', kind:'character'}, bind:'$revealed', bindMatch:'$matched'}
//          → conditional(bound $matched matched) → handAddFromDeck{$matched.cardId}
//       ※「1枚まで」=0枚可・該当あっても加えない選択可 (rules/15 / 公式Q&A)。「のキャラ」= kind:'character'
//       ※ filter は targetFilterToPredicate で honor (trait/kind、BUG-117/118 以降。reveal path も同一述語)
//   - 残りをリムーブエリアに移す => boundToRemove{$revealed}
//       ※ 移送完了後に初めてデッキから出る → そこで deck0 なら refresh (rules/26)。$matched は handAdd 済で
//         splice 不能 → '' filter で remove されない (= 加えたカードは remove へ行かない、B07035/B09073 と同挙動)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
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
          filter: { trait: '少年探偵団', kind: 'character' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description:
    '【登場時】自分のデッキのカードを上から3枚見る。その中から〚特徴［少年探偵団］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B05016: CardDef = {
  id: 'B05016',
  no: '0522/B05016',
  kind: 'character',
  names: ['小嶋元太'],
  colors: ['青'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['少年探偵団'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1743742488530261.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
