// cards/ct-p03/B03033P 遠山和葉 (キャラ, パラレル) — engine変更0 (apDeltaAuraOpp consumer)
// 公式テキスト・句マッピングは B03033 を参照 (同一 ability)。
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  continuousModifier: { apDeltaAuraOpp: -1000, auraFilterOpp: { hasSetCards: true, kind: 'character' } },
  description: '【自分ターン中】相手の現場にいるカードがセットされているキャラをAP－1000する。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/16-card-set.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/17-icons.md'],
};

export const B03033P: CardDef = {
  id: 'B03033P',
  no: '0290/B03033P',
  kind: 'character',
  names: ['遠山和葉'],
  colors: ['緑'],
  level: 4,
  ap: 4000,
  lp: 1,
  traits: ['高校生'],
  keywords: [],
  rarity: 'CP',
  imageUrl: '1729133249304794.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md',
    'rules/17-icons.md',
    'rules/24-qa-naming-stun.md',
  ],
};
