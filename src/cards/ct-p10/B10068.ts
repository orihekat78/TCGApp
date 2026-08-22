// CT-P10 B10068 諸伏景光
// rules: 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', condition: { kind: 'partnerColor', color: '黄' }, trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { apMax: 8000 } } },
  description: '【登場時】AP8000以下のキャラを1枚まで選び、リムーブする。', ruleRefs: ['rules/15-abilities-effects.md'],
};
const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'phase:end:start' }, condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '降谷零' }, { kind: 'turn', player: 'self' }] },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', player: 'self', maxN: 2, filterAny: [{ cardName: '降谷零' }, { cardName: '諸伏景光' }, { cardName: '伊達航' }, { cardName: '萩原研二' }, { cardName: '松田陣平' }], bind: '$revealed', bindMatch: '$matched' } },
    { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', presentation: 'public-selected-card' } } },
    { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed' } },
  ] },
  description: '【絆降谷零】自分のターン終了時、自分のデッキのカードを上から2枚見る。その中から【カード名［降谷零］】か【［諸伏景光］】か【［伊達航］】か【［萩原研二］】か【［松田陣平］】を1枚まで公開して手札に加え、残りをリムーブエリアに移す。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/26-qa-deck-refresh.md'],
};

export const B10068: CardDef = {
  id: 'B10068', no: '1124/B10068', kind: 'character', names: ['諸伏景光'], colors: ['黄'], level: 8, ap: 7000, lp: 2,
  traits: ['警察', '警視庁', '公安'], keywords: [], rarity: 'SR', imageUrl: '1783904183429396.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B10068P: CardDef = { ...B10068, id: 'B10068P', no: '1124/B10068P', rarity: 'SRP', imageUrl: '1783904183436044.jpg' };
export const B10068P2: CardDef = { ...B10068, id: 'B10068P2', no: '1124/B10068P2', rarity: 'SRP', imageUrl: '1783904183444923.jpg' };
