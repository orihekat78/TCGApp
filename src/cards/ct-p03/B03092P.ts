// cards/ct-p03/B03092P 高木渉 (character, パラレル) — engine拡張 wave removedFilter
// rules: rules/03-field-areas.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/24-qa-naming-stun.md
// 公式テキスト (B03092 と同一、パラレル = imageUrl/rarity/no のみ差異):
//   【相手ターン中】【ターン1】自分の現場にいるレベル6以上の〚特徴［警察］〛のキャラがリムーブされたとき、レベル7以下のキャラを1枚まで選び、スタンさせる。
//   （スタン状態のキャラをアクティブにする場合、代わりにスリープさせる）
// 句マッピングは B03092.ts と同一 (standalone full CardDef 慣習、B06053P 同型)。
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

export const B03092P: CardDef = {
  id: 'B03092P',
  no: '0345/B03092P',
  kind: 'character',
  names: ['高木渉'],
  colors: ['黄'],
  level: 5,
  ap: 5000,
  lp: 1,
  traits: ['警察', '警視庁'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1729133443690044.jpg',
  abilities: [a1],
  ruleRefs: ['rules/03-field-areas.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/19-special-rules.md', 'rules/24-qa-naming-stun.md'],
};
