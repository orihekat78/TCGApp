// cards/ct-p03/B03092 高木渉 (character) — engine拡張 wave removedFilter (removedCharMatches.removedFilter)
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/24-qa-naming-stun.md
// 公式テキスト:
//   【相手ターン中】【ターン1】自分の現場にいるレベル6以上の〚特徴［警察］〛のキャラがリムーブされたとき、レベル7以下のキャラを1枚まで選び、スタンさせる。
//   （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
// 句マッピング:
//   - 【相手ターン中】 => condition and[ {kind:'turn', player:'opp'} ]
//   - 【ターン1】 => ability.limit {kind:'turn', n:1} (同時に複数除去されても発動1回・選択1枚、公式 qAndA と整合)
//   - 自分の現場のレベル6以上の〚警察〛がリムーブされたとき => trigger {hook:'leave:to-remove'} (selfOnly 無し)
//       + removedCharMatches{side:'self', removedFilter:{trait:'警察', levelMin:6}}。
//       「このキャラか」句は無い (自身は Lv5 ゆえ self-match せず、観測者専用)。
//       removedFilter は payload.removedChar snapshot を matchOneFilter で判定 = char.turnEffects 由来の
//       修正後レベル (rules/19) を参照するため buff/debuff 後の effective Lv6 でも正しく判定。
//   - レベル7以下のキャラを1枚まで選び、スタンさせる => sceneSetState{state:'stun', side:'either', filter:{levelMax:7}, max:1} 短縮形
//       (B01040 / B01014 短縮形。0枚可=rules/15。スタン→アクティブ代わりにスリープは engine 担保 rules/03/24)
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 },
  trigger: { hook: 'leave:to-remove' },
  condition: {
    kind: 'and',
    cs: [
      { kind: 'turn', player: 'opp' },
      { kind: 'removedCharMatches', side: 'self', removedFilter: { trait: '警察', levelMin: 6 } },
    ],
  },
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: { player: 'self', state: 'stun', side: 'either', filter: { levelMax: 7 }, max: 1 },
  },
  description: '【相手ターン中】【ターン1】自分の現場にいるレベル6以上の〚特徴［警察］〛のキャラがリムーブされたとき、レベル7以下のキャラを1枚まで選び、スタンさせる。（スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）',
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/24-qa-naming-stun.md'],
};

export const B03092: CardDef = {
  id: 'B03092',
  no: '0345/B03092',
  kind: 'character',
  names: ['高木渉'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'C',
  imageUrl: '1729133443685343.jpg',
  abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/24-qa-naming-stun.md'],
};
