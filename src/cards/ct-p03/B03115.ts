// cards/ct-p03/B03115 ラム (character) — wave decklook-remove-discard (engine変更0)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p03/character.tsv col10):
//   【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。自分のデッキのカードを上から3枚見る。その中から【カットイン】を持つ【黒】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。
//
// 句マッピング (exemplar = B01063 (sceneRemove levelMax 短縮形) / B05016+B07010 (deck-look upTo→handAdd→conditional discard) / B07098 a2 (keyword+color filter)):
//   a1【登場時】 => trigger {hook:'enter', selfOnly:true} (capability-map hooks: enter=登場時, selfOnly=source.uid 一致; emit at atom-handlers sceneEnter/next-hint/hand-use)。
//   - レベル7以下のキャラを1枚まで選び、リムーブする
//       => sceneRemove{player:'self', max:1, side:'either', cause:'effect', filter:{levelMax:7}}
//       ※「1枚まで」=max:1(min=0、0枚可、rules/15)。「キャラ」side 無し=either(両現場、rules/15)。短縮形 pick (B01063 同型)。
//   - 自分のデッキのカードを上から3枚見る。その中から【カットイン】を持つ【黒】のカードを1枚まで公開して手札に加え
//       => deckRevealUntil{chooseMatch:'upTo', maxN:3, filter:{keyword:'カットイン', color:'黒'}, bind:'$revealed', bindMatch:'$matched'}
//          → conditional(bound $matched matched) → handAddFromDeck{$matched.cardId}
//       ※ maxN指定=上から3枚全件公開してから pick (atom-handlers picks.ts:76-84)。「1枚まで」=chooseMatch:'upTo'。
//       ※「【カットイン】を持つ【黒】のカード」=filter keyword+color の AND (B07098 a2 同型)。「カード」(キャラ限定なし)=kind 無し。
//   - 残りを好きな順番でデッキの下に移す => deckToBottomBound{$revealed}
//       ※ $matched は handAdd 済で deck に無い → deckToBottomBound は splice 可能 id のみ移動 (B06053 同型)。
//   - カードを手札に加えた場合、手札を1枚リムーブする => conditional(bound $matched matched) → discard{n:1}
//       ※「加えた場合」= $matched が matched (handAdd 済) のときのみ (B07010 教訓: over-fire 防止)。

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
        verb: 'sceneRemove',
        args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 7 } },
      },
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: {
          chooseMatch: 'upTo',
          player: 'self',
          maxN: 3,
          filter: { keyword: 'カットイン', color: '黒' },
          bind: '$revealed',
          bindMatch: '$matched',
        },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
      },
    ],
  },
  description:
    '【登場時】レベル7以下のキャラを1枚まで選び、リムーブする。自分のデッキのカードを上から3枚見る。その中から【カットイン】を持つ【黒】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B03115: CardDef = {
  id: 'B03115',
  no: '0364/B03115',
  kind: 'character',
  names: ['ラム'],
  colors: ['黒'],
  level: 8, ap: 6000, lp: 2,
  traits: ['黒ずくめの組織'], keywords: [],
  rarity: 'R',
  imageUrl: '1729133482999426.jpg',
  abilities: [a1],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
