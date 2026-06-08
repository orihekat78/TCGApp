// cards/ct-p06/B06050 宮本武蔵 (キャラ) — カットイン実装 (BUG-114, 2026-06-07)
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md
//
// 公式テキスト(カットイン):
//   【カットイン】【自分ターン中】AP＋2000
//   【カットイン】【事件YAIBA】自分のリムーブエリアにある〚特徴［YAIBA］〛のイベントを1枚まで選び、手札に加える。
//
// 「複数カットイン択一」(rules/09 §カットインを2つ以上持つカード→効果を1つ選んで使用) は
// **engine変更0** で表現できる (BUG-114 の「engine が個別解決できない」は stale):
//   2 つの【カットイン】= 1 つの cutin ability + effect:choice{options:[opt_a, opt_b]}。
//   各 option を conditional で 6-stage 条件アイコンにゲートする (rules/17: 条件未満の
//   カットイン = 使えるが何も起こらない → conditional の else 無し = noop と一致)。
//   choice 機構 (BUG-121, pendingEffectChoice) が human 選択 / AI=index0 を担う。
//
// ⚠ 残データゲート (BUG-114 RCA 未記載の別件): opt_b の「〚特徴［YAIBA］〛のイベント」は
//   data 上イベントが traits:[] (event.tsv に features 列なし、survey「event traits all empty」black gate)
//   のため trait filter が永久不発火 → opt_b は YAIBA イベントを発見できない (データ追加待ち)。
//   opt_a (AP+2000) は完全機能。multi-cutin choice の engine gap 自体は本実装で解消。
import type { CardDef, AbilityDef } from '@/engine/types';

const cutin: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  description:
    '【カットイン】【自分ターン中】AP＋2000 / 【カットイン】【事件YAIBA】自分のリムーブエリアにある〚特徴［YAIBA］〛のイベントを1枚まで選び、手札に加える',
  effect: {
    kind: 'choice',
    chooser: 'self',
    options: [
      // 【自分ターン中】AP＋2000 (攻撃キャラ $contact.byUid に contact scope)
      {
        kind: 'conditional',
        if: { kind: 'turn', player: 'self' },
        then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
      },
      // 【事件YAIBA】リムーブの特徴[YAIBA]イベントを1枚手札に (⚠ event traits data gate により現状不発火)
      {
        kind: 'conditional',
        if: { kind: 'caseTrait', trait: 'YAIBA' },
        then: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { trait: 'YAIBA', kind: 'event' } } },
      },
    ],
  },
};

export const B06050: CardDef = {
  id: 'B06050',
  no: '0671/B06050',
  kind: 'character',
  names: ['宮本武蔵'],
  colors: ['白'],
  level: 2,
  ap: 1000,
  lp: 1,
  traits: ['YAIBA'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1754285220467964.jpg',
  abilities: [cutin],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
