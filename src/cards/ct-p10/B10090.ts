// CT-P10 B10090 ウォッカ
// rules: 08-contact.md, 09-cutin-disguise.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', condition: { kind: 'partnerColor', color: '黒' }, trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'optional', effect: {
      kind: 'conditional', if: { kind: 'deckAtLeast', player: 'self', n: 3 }, then: {
        kind: 'sequence', steps: [
          { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 3, filter: {}, bind: '$removed' } },
          { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$removed' } },
          { kind: 'conditional', if: { kind: 'boundMatchCountAtLeast', bindKey: '$removed', filter: { color: '黒', keyword: 'カットイン' }, n: 3 }, then: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } } },
        ],
      },
    },
  },
  description: '【パートナー黒】【登場時】自分のデッキのカードを上から3枚リムーブしてもよい。この効果によって【カットイン】を持つ【黒】のカードが3枚以上リムーブされた場合、ターン終了時までこのキャラは〚突撃〛を持つ。',
  ruleRefs: ['rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-hand', condition: { kind: 'turn', player: 'self' }, trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'conditional', if: { kind: 'contactCharMatches', who: 'byUid', filter: { cardName: 'ジン' } }, then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 3000, scope: 'contact' } }, else: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } } },
  description: '【カットイン】【自分ターン中】AP＋1000、〚カード名［ジン］〛に【カットイン】する場合、代わりにAP＋3000', ruleRefs: ['rules/09-cutin-disguise.md'],
};

export const B10090: CardDef = {
  id: 'B10090', no: '1145/B10090', kind: 'character', names: ['ウォッカ'], colors: ['黒'], level: 5, ap: 5000, lp: 0,
  traits: ['黒ずくめの組織'], keywords: [], rarity: 'C', imageUrl: '1783904232344669.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};
