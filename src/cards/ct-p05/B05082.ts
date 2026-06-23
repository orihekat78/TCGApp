// cards/ct-p05/B05082 「FBI…」 (event) — wave reveal-handadd (engine変更0)
// rules: 03-field-areas.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 20-color-and-switch.md, 26-qa-deck-refresh.md
//
// 公式テキスト (ct-p05/event.tsv col10):
//   自分のデッキのカードを上から5枚見る。その中から〚特徴［FBI］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。手札からレベル6以下の〚特徴［FBI］〛のキャラを1枚まで登場させる。
//
// 句マッピング (exemplar = B02019 a1 (deck-look→hand→boundToRemove) + B01076 a1 (event-use wrapper + sceneEnter 短縮形) + D07008 a1 (sceneEnter from:'hand')):
//   - (イベント自己使用) 手札の使用 / ネクストヒントで使用したとき発動 => type:'triggered', scope:'on-hand',
//       trigger:{hook:'effect:declared', selfOnly:true, matcher:(p)=>p.kind==='event-use'} (B01076/B02053 正準)
//   - 上から5枚見る + 〚特徴[FBI]〛のキャラを1枚まで公開して手札に加え
//       => deckRevealUntil{chooseMatch:'upTo', maxN:5, filter:{trait:'FBI', kind:'character'}, bind:'$revealed', bindMatch:'$matched'}
//          → conditional(bound $matched matched) → handAddFromDeck{$matched.cardId}
//       ※「1枚まで」=chooseMatch:'upTo' (0枚可、加えない選択可、QA確認)。「のキャラ」= kind:'character' (BUG-123)。
//   - 残りをリムーブエリアに移す => boundToRemove{$revealed}
//       ※ 移送完了後にデッキ0なら refresh (QA「残りをリムーブエリアに移すまで解決した所でリフレッシュ」rules/26)。
//   - 手札からレベル6以下の〚特徴[FBI]〛のキャラを1枚まで登場させる (独立節。加えた以外の別FBIキャラでも可、QA確認)
//       => sceneEnter{from:'hand', max:1, viaEffect:true, filter:{trait:'FBI', levelMax:6, kind:'character'}}
//       ※ sceneEnter source:'hand' (D07008 同型)。max:1 で hasNorMax=true → 短縮形 PA path 成立。
//         viaEffect:true = 効果による登場 (事件の色制限なし、rules/20)。現場満杯時はスイッチ可 (rules/20)。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use' },
  effect: {
    kind: 'sequence',
    steps: [
      {
        kind: 'atom',
        verb: 'deckRevealUntil',
        args: { chooseMatch: 'upTo', player: 'self', maxN: 5, filter: { trait: 'FBI', kind: 'character' }, bind: '$revealed', bindMatch: '$matched' },
      },
      {
        kind: 'conditional',
        if: { kind: 'bound', key: '$matched', presence: 'matched' },
        then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
      },
      { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed' } },
      { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { trait: 'FBI', levelMax: 6, kind: 'character' } } },
    ],
  },
  description:
    '自分のデッキのカードを上から5枚見る。その中から〚特徴［FBI］〛のキャラを1枚まで公開して手札に加え、残りをリムーブエリアに移す。手札からレベル6以下の〚特徴［FBI］〛のキャラを1枚まで登場させる。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md', 'rules/26-qa-deck-refresh.md'],
};

export const B05082: CardDef = {
  id: 'B05082',
  no: '0582/B05082',
  kind: 'event',
  names: ['「FBI…」'],
  colors: ['赤'],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1746628078729289.jpg',
  abilities: [a1],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/20-color-and-switch.md',
    'rules/26-qa-deck-refresh.md',
  ],
};
