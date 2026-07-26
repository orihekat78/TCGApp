// CT-P10 B10025 鬼丸猛
// rules: 10-action-event.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md, 26-qa-deck-refresh.md
import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1', type: 'continuous', scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '緑' },
  continuousModifier: { grantKeywords: () => ['突撃'], printedKeywordWhenIconValid: true },
  description: '【パートナー緑】〚突撃〛（名乗り状態でもアクションできる）',
  ruleRefs: ['rules/10-action-event.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
  effect: {
    kind: 'sequence', steps: [
      {
        kind: 'atom', verb: 'deckRevealUntil', args: {
          player: 'self', visibility: 'public', viewer: 'all', stopAtFirstMatch: true,
          filter: { kind: 'event', color: '緑', levelMin: 7, keyword: 'ヒラメキ' },
          bind: '$revealed', bindMatch: '$matched',
        },
      },
      { kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } } },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed', order: 'preserve' } },
      { kind: 'atom', verb: 'deckShuffle', args: { player: 'self' } },
    ],
  },
  description: '【登場時】自分のデッキのカードを上から【ヒラメキ】を持つレベル7の【緑】のイベントが出るまで1枚ずつ公開し、それを手札に加える。残りの公開したカードをデッキの下に移し、デッキをシャッフルする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

const a3: AbilityDef = {
  id: 'a3', type: 'triggered', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
  trigger: { hook: 'evidence:gain' },
  condition: { kind: 'and', cs: [{ kind: 'caseStatus', status: '解決編' }, { kind: 'turn', player: 'self' }, { kind: 'triggerPlayerIs', side: 'self' }] },
  effect: {
    kind: 'atom', verb: 'sceneSetState', args: {
      uid: '$pick', state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【解決編】【自分ターン中】【ターン1】自分が証拠を得たとき、キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md'],
};

export const B10025: CardDef = {
  id: 'B10025', no: '1086/B10025', kind: 'character', names: ['鬼丸猛'], colors: ['緑'], level: 8, ap: 8000, lp: 0,
  traits: ['高校生'], keywords: [], rarity: 'R', imageUrl: '1783904116831251.jpg', abilities: [a1, a2, a3],
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};
