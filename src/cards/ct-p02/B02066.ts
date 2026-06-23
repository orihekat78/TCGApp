// cards/ct-p02/B02066 メアリー (character) — leave-from-remove wave (engine変更0)
// rules: rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【登場時】カードを1枚引き、手札を1枚リムーブする。
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル5以下の〚カード名［メアリー］〛を1枚まで選び、スリープ状態で登場させる。
// 句マッピング:
//   - a1 【登場時】 => trigger {hook:'enter', selfOnly:true}, type triggered, scope on-scene [B02077 a1 / B02038P a2]
//   - カードを1枚引き => draw {player:'self', n:1} / 手札を1枚リムーブする ('する'=必須) => discard {player:'self', n:1} [D01003 a1 同型]
//   - a2 【相手ターン中】【現場リムーブ時】 => trigger {hook:'leave:to-remove', selfOnly:true} + condition {kind:'turn', player:'opp'} [B03113 a1]
//   - リムーブエリアから登場 => sceneEnter {from:'remove', viaEffect:true} / レベル5以下 => levelMax:5 / 〚カード名[メアリー]〛 => cardName:'メアリー' / キャラ => kind:'character' (BUG-123)
//   - 1枚まで => max:1 (n.min:0, rules/15) / スリープ状態で登場 => enterSleep:true
//   - 除外句なし => cardNameNot 不要 (リムーブの メアリー コピー再登場可、公式テキスト通り)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【登場時】カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: { cardName: 'メアリー', levelMax: 5, kind: 'character' },
    },
  },
  description: '【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル5以下の〚カード名［メアリー］〛を1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};

export const B02066: CardDef = {
  id: 'B02066',
  no: '0229/B02066',
  kind: 'character',
  names: ['メアリー'],
  colors: ['赤'],
  level: 6,
  ap: 5000,
  lp: 1,
  traits: ['赤井家'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1721357267326289.jpg',
  abilities: [a1, a2],
  ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};
