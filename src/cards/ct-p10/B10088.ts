// CT-P10 B10088 バーボン
// rules: 08-contact.md, 09-cutin-disguise.md, 13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  condition: { kind: 'and', cs: [{ kind: 'partnerColor', color: '黒' }, { kind: 'bond', cardName: 'スコッチ' }, { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' }] },
  trigger: { hook: 'leave:to-remove' },
  effect: {
    kind: 'optional', effect: {
      kind: 'conditional', if: { kind: 'deckAtLeast', player: 'self', n: 3 }, then: {
        kind: 'sequence', steps: [
          { kind: 'atom', verb: 'deckRevealUntil', args: { player: 'self', maxN: 3, filter: {}, bind: '$removed' } },
          { kind: 'atom', verb: 'boundToRemove', args: { player: 'self', bindKey: '$removed' } },
          { kind: 'conditional', if: { kind: 'boundMatchCountAtLeast', bindKey: '$removed', filter: { color: '黒', keyword: 'カットイン' }, n: 3 }, then: { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'remove', viaEffect: true, max: 1, filter: { kind: 'character', color: '黒', levelMax: 3 } } } },
        ],
      },
    },
  },
  description: '【パートナー黒】【絆スコッチ】【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、自分のデッキのカードを上から3枚リムーブしてもよい。この効果によって【カットイン】を持つ【黒】のカードが3枚以上リムーブされた場合、自分のリムーブエリアにあるレベル3以下の【黒】のキャラを1枚まで選び、登場させる。',
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-hand', condition: { kind: 'turn', player: 'self' }, trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】【自分ターン中】AP＋1000', ruleRefs: ['rules/09-cutin-disguise.md'],
};

export const B10088: CardDef = {
  id: 'B10088', no: '1143/B10088', kind: 'character', names: ['バーボン'], colors: ['黒'], level: 7, ap: 6000, lp: 1,
  traits: ['黒ずくめの組織'], keywords: ['突撃'], rarity: 'R', imageUrl: '1783904232322600.jpg', abilities: [a1, a2],
  ruleRefs: ['rules/08-contact.md', 'rules/09-cutin-disguise.md', 'rules/13-keywords.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

export const B10088P: CardDef = { ...B10088, id: 'B10088P', no: '1143/B10088P', rarity: 'RP', imageUrl: '1783904232330502.jpg' };
