// CT-P10 B10081 「化け物屋敷!?」
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 19-special-rules.md
import type { AbilityDef, CardDef } from '@/engine/types';

const names = ['降谷零', '諸伏景光', '伊達航', '萩原研二', '松田陣平'];

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', selfOnly: true, matcher: (payload: unknown) => (payload as { kind?: unknown })?.kind === 'event-use' },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, bind: '$moved', filter: { kind: 'character', cardName: names } } },
    { kind: 'conditional', if: { kind: 'bound', key: '$moved', presence: 'matched' }, then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { kind: 'character', levelMinBound: { bindKey: '$moved' } } } } },
  ] },
  description: '自分のリムーブエリアにある〚カード名［降谷零］〛か〚［諸伏景光］〛か〚［伊達航］〛か〚［萩原研二］〛か〚［松田陣平］〛を1枚まで選び、手札に加える。カードを手札に加えた場合、そのカードのレベル以上のレベルのキャラを1枚まで選び、リムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000（コンタクト中に手札からリムーブして使う）',
  ruleRefs: ['rules/09-cutin-disguise.md'],
};

export const B10081: CardDef = {
  id: 'B10081', no: '1137/B10081', kind: 'event', names: ['「化け物屋敷!?」'], colors: ['黄'], level: 6,
  traits: [], rarity: 'C', imageUrl: '1783904202690147.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/15-abilities-effects.md', 'rules/19-special-rules.md'],
};
export const B10081P: CardDef = { ...B10081, id: 'B10081P', no: '1137/B10081P', rarity: 'CP', imageUrl: '1783904202697420.jpg' };
