import type { AbilityDef, CardDef } from '@/engine/types';

const a0: AbilityDef = {
  id: 'a0', type: 'continuous', scope: 'on-scene',
  condition: {
    kind: 'and', cs: [
      { kind: 'caseStatus', status: '解決編' },
      { kind: 'turn', player: 'self' },
    ],
  },
  continuousModifier: { opponentRestrict: ['contactLeaveSelfTrigger'] },
  description: '【解決編】【自分ターン中】相手の現場にいるキャラがコンタクトによってリムーブされた場合、そのキャラの【現場リムーブ時】は発動しない。',
  ruleRefs: ['rules/08-contact.md', 'rules/15-abilities-effects.md'],
};

const a1: AbilityDef = {
  id: 'a1', type: 'triggered', scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  condition: { kind: 'caseColor', color: ['緑', '白'], combine: 'and' },
  effect: {
    kind: 'sequence', steps: [
      { kind: 'atom', verb: 'deckRevealUntil', args: { chooseMatch: 'upTo', player: 'self', filter: { color: ['緑', '白'] }, maxN: 4, bind: '$revealed', bindMatch: '$matched' } },
      {
        kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: {
          kind: 'sequence', steps: [
            { kind: 'atom', verb: 'handAddFromDeck', args: { player: 'self', cardId: '$matched.cardId' } },
            { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
          ],
        },
      },
      { kind: 'atom', verb: 'deckToBottomBound', args: { player: 'self', bindKey: '$revealed' } },
    ],
  },
  description: '【事件緑＆白】【登場時】自分のデッキのカードを上から4枚見る。その中から【緑】か【白】のカードを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。カードを手札に加えた場合、手札を1枚リムーブする。',
  ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

const a2: AbilityDef = {
  id: 'a2', type: 'triggered', scope: 'on-evidence',
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: ['rules/10-action-event.md', 'rules/14-refresh.md'],
};

export const B10039: CardDef = {
  id: 'B10039', no: '1099/B10039', kind: 'character', names: ['白馬探'], colors: ['白'],
  level: 4, ap: 3000, lp: 1, traits: ['探偵', '高校生'], keywords: [], rarity: 'R', imageUrl: '1783904137988913.jpg',
  abilities: [a0, a1, a2],
  ruleRefs: ['rules/08-contact.md', 'rules/10-action-event.md', 'rules/14-refresh.md', 'rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/26-qa-deck-refresh.md'],
};

export const B10039P: CardDef = { ...B10039, id: 'B10039P', no: '1099/B10039P', rarity: 'RP', imageUrl: '1783904137995147.jpg' };
