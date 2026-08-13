// rules: 03-field-areas.md, 10-action-event.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md
import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '@/cards/_shared';

const a1 = partnerColorKeyword({ color: '黄', kw: '突撃[キャラ]', abilityId: 'a1' });
const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'leave:to-remove', selfOnly: true },
  condition: { kind: 'turn', player: 'opp' },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 1, chooseMatch: 'upTo', visibility: 'private', viewer: 'self', bind: '$revealed', bindMatch: '$matched' } },
    { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$matched' } } },
  ] },
  description: '【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から1枚見る。それをリムーブエリアに移してもよい。（移さなかった場合、元に戻す）',
  ruleRefs: ['rules/03-field-areas.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md'],
};
const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true },
  condition: { kind: 'caseStatus', status: '解決編' },
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$trigger.byUid', state: 'stun' } },
  description: '【ヒラメキ】【解決編】アクション中のキャラを1枚まで選び、スタンさせる。', ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/24-qa-naming-stun.md'],
};
export const PR309: CardDef = {
  id: 'PR309', no: '1162/PR309', kind: 'character', names: ['降谷零'], colors: ['黄'], level: 6, ap: 6000, lp: 1,
  traits: ['警察', '公安'], keywords: [], rarity: 'PR', imageUrl: '1785395500829919.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/03-field-areas.md', 'rules/10-action-event.md', 'rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};
