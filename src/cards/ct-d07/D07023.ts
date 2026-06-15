// cards/ct-d07/D07023 「烏丸蓮耶の影」 (イベント) — engine拡張 wave#2 cluster12 (nested-filter-dyn, 2026-06-15)
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 26-qa-deck-refresh.md
//
// 公式テキスト:
//   自分のデッキのカードを上から3枚見る。その中から【黒】のキャラを1枚まで公開して手札に加え、
//   残りを好きな順番でデッキの下に移す。
//   手札から自分のFILEエリアの枚数以下のレベルの【黒】のキャラを1枚まで登場させる。
//
// 句マッピング (D01013 a1 deck-look + B04064 a1 event/sceneEnter 前例の合成):
//   - イベント使用 = effect:declared selfOnly + matcher kind==='event-use' (B04064 a1 同型。手札の使用/ネクストヒント両経路が同 payload)。
//   - 上から3枚見る → 【黒】のキャラを1枚まで公開して手札に加え => deckRevealUntil{chooseMatch:'upTo', maxN:3, filter:{color:'黒',kind:'character'}}
//       「1枚まで」=0枚可 (公式Q&A「条件を満たすカードがあった場合でも手札に加えないことはできますか？→はい」= chooseMatch:'upTo', rules/15)。
//     $matched 有り → handAddFromDeck($matched.cardId) (D01013 a1 と同 conditional)。
//   - 残りを好きな順番でデッキの下に移す => deckToBottomBound{$revealed} (公式Q&A「デッキ3枚ない場合は残り全部見て解決」は engine reveal 中=deck 扱いで整合 rules/26)。
//   - 手札から自分のFILEエリアの枚数以下のレベルの【黒】のキャラを1枚まで登場 =>
//       sceneEnter{from:'hand', max:1, viaEffect:true, filter:{color:'黒', kind:'character', levelMax:{dyn:'$self.fileCount'}}}
//       levelMax:{dyn:'$self.fileCount'} = 「FILEエリアの枚数以下のレベル」(cluster12 で nested-filter-dyn を解禁、アシストパートナー込み rules/17 §FILE(X))。
//       効果による登場 = viaEffect:true (事件の色制限を受けない rules/20)。現場満杯時はスイッチ可。max:1 = 「1枚まで」0枚可。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence',
    steps: [
      // 上から3枚見る → 【黒】のキャラを1枚まで $matched に bind (0枚可)
      { kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', player: 'self', filter: { color: '黒', kind: 'character' }, maxN: 3, bind: '$revealed', bindMatch: '$matched' } },
      // 該当を選んだ場合 手札に加える
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } } },
      // 残りを好きな順番でデッキの下に移す
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
      // 手札から FILE 枚数以下のレベルの【黒】のキャラを1枚まで登場 (cluster12: levelMax dyn)
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { color: '黒', kind: 'character', levelMax: { dyn: '$self.fileCount' } } } },
    ],
  },
  description:
    '自分のデッキのカードを上から3枚見る。その中から【黒】のキャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。手札から自分のFILEエリアの枚数以下のレベルの【黒】のキャラを1枚まで登場させる。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};

export const D07023: CardDef = {
  id: 'D07023',
  no: '0381/D07023',
  kind: 'event',
  names: ['烏丸蓮耶の影'],
  colors: ['黒'],
  level: 1,
  traits: [],
  rarity: 'D',
  imageUrl: '1729865297335374.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
