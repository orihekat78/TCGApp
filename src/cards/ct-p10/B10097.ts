// CT-P10 B10097 毛利蘭＆ベルモット
// rules: 09-cutin-disguise.md, 14-refresh.md, 15-abilities-effects.md, 18-mr.md, 19-special-rules.md, 21-declared-ability-cost.md, 26-qa-deck-refresh.md
import type { AbilityDef, CardDef } from '@/engine/types';

const names = ['毛利蘭＆ベルモット', '毛利蘭', 'ベルモット'];
const revealNames = ['工藤新一', '毛利蘭'];

const a1: AbilityDef = {
  id: 'a1', type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', excludeSelf: true, filter: { kind: 'character', color: ['青', '黒'] } }, nMin: 1 },
  cost: { kind: 'revealFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { cardName: revealNames } }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 },
  effect: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { kind: 'character', apMax: 8000 } } },
  description: '【宣言】【ターン1】〚手札からカード名［工藤新一］か［毛利蘭］を1枚公開する〛：AP8000以下のキャラを1枚まで選び、リムーブする。この能力は自分の現場にこのキャラ以外の【青】か【黒】のキャラがいる場合に宣言できる。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-partner-area',
  trigger: { hook: 'phase:end:start' }, condition: { kind: 'turn', player: 'self' },
  effect: { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', player: 'self', maxN: 3, filter: { cardName: revealNames }, bind: '$revealed', bindMatch: '$matched' } },
    { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId', bind: '$added' } } },
    { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$revealed' } },
    { kind: 'conditional', if: { kind: 'boundMatchesFilter', bindKey: '$added', filter: { levelMin: 5 } }, then: { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } } },
  ] },
  description: '自分のターン終了時、自分のデッキのカードを上から3枚見る。その中から〚カード名［工藤新一］〛か〚［毛利蘭］〛を1枚まで公開して手札に加え、残りをリムーブエリアに移す。レベル5以上のカードを手札に加えた場合、手札を1枚リムーブする。この能力はパートナーエリアでも発動する。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/18-mr.md', 'rules/19-special-rules.md', 'rules/26-qa-deck-refresh.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 2000, scope: 'contact' } },
  description: '【カットイン】AP＋2000', ruleRefs: ['rules/09-cutin-disguise.md'],
};

export const B10097: CardDef = {
  id: 'B10097', no: '1152/B10097', kind: 'character', names, colors: ['青', '黒'], level: 9, ap: 8000, lp: 2,
  traits: ['毛利探偵事務所', '高校生', '黒ずくめの組織', '空手家'], rarity: 'MR', imageUrl: '1783904232402343.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/18-mr.md', 'rules/19-special-rules.md', 'rules/21-declared-ability-cost.md', 'rules/26-qa-deck-refresh.md'],
};
export const B10097P: CardDef = { ...B10097, id: 'B10097P', no: '1152/B10097P', rarity: 'MRP', imageUrl: '1783904232409407.jpg' };
