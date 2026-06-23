// cards/ct-p02/B02075 諸伏高明 (character) — leave-from-remove wave (engine変更0)
// rules: rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル6以下の〚特徴［長野県警］〛のキャラを1枚まで選び、スリープ状態で登場させる。
// 句マッピング (B03113 a1 shell verbatim / filter trait+levelMax = B02038 a2 / B02077 a1 then):
//   - 【相手ターン中】 => condition {kind:'turn', player:'opp'} [eval.ts case 'turn']
//   - 【現場リムーブ時】(自身) => trigger {hook:'leave:to-remove', selfOnly:true}, type triggered, scope on-scene [read/keyword.ts:56 abilityIsSceneRemoveTrigger]
//   - 自分のリムーブエリアにある…登場 => sceneEnter {player:'self', from:'remove', viaEffect:true} [B02038 a2 / atom-pick-spec.ts:60 sceneEnter from short-form]
//   - レベル6以下 => filter.levelMax:6 / 〚特徴[長野県警]〛 => filter.trait:'長野県警' / キャラ => filter.kind:'character' (BUG-123, remove pick 必須)
//   - 1枚まで選び => max:1 (n.min:0, rules/15) / スリープ状態で登場 => enterSleep:true
//   - 除外句なし => cardNameNot 不要 (自コピー再登場可、公式テキスト通り。諸伏高明=単一名 rules/19 非該当)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
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
      filter: { trait: '長野県警', levelMax: 6, kind: 'character' },
    },
  },
  description: '【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル6以下の〚特徴［長野県警］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B02075: CardDef = {
  id: 'B02075',
  no: '0236/B02075',
  kind: 'character',
  names: ['諸伏高明'],
  colors: ['黄'],
  level: 7,
  ap: 5000,
  lp: 2,
  traits: ['警察', '長野県警'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1721357284510714.jpg',
  abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};
