// cards/ct-p05/B05099 高木渉 (character) — leave-from-remove wave (engine変更0)
// rules: rules/03-field-areas.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/20-color-and-switch.md
// 公式テキスト:
//   【パートナー黄】【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル4以下の〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる。
// 句マッピング:
//   - 【パートナー黄】【相手ターン中】(両条件AND) => condition {kind:'and', cs:[{kind:'partnerColor', color:'黄'}, {kind:'turn', player:'opp'}]} [B03067 a1 verbatim (色/playerのみ差異); eval.ts:31-32 and.cs.every / :37 partnerColor]
//   - 【現場リムーブ時】(自身) => trigger {hook:'leave:to-remove', selfOnly:true}, type triggered, scope on-scene [B03113 a1]
//   - リムーブから登場 => sceneEnter {from:'remove', viaEffect:true} / レベル4以下 => levelMax:4 / 〚特徴[警察]〛 => trait:'警察' / キャラ => kind:'character' (BUG-123)
//   - 1枚まで => max:1 (n.min:0, rules/15) / スリープ状態で登場 => enterSleep:true
//   - 自コピー: levelMax:4 < 自身 level 5 ゆえ filter で自然除外 (cardNameNot 不要)

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '黄' }, { kind: 'turn', player: 'opp' }] },
  effect: {
    kind: 'atom',
    verb: 'sceneEnter',
    args: {
      player: 'self',
      from: 'remove',
      max: 1,
      viaEffect: true,
      enterSleep: true,
      filter: { trait: '警察', levelMax: 4, kind: 'character' },
    },
  },
  description: '【パートナー黄】【相手ターン中】【現場リムーブ時】自分のリムーブエリアにあるレベル4以下の〚特徴［警察］〛のキャラを1枚まで選び、スリープ状態で登場させる。',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/20-color-and-switch.md'],
};

export const B05099: CardDef = {
  id: 'B05099',
  no: '0597/B05099',
  kind: 'character',
  names: ['高木渉'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1745322226221956.jpg',
  abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/13-keywords.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/20-color-and-switch.md'],
};
