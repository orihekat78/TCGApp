// cards/ct-p02/B02031 平次のバイク (event) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/16-card-set.md, rules/22-qa-action-contact.md, rules/10-action-event.md, rules/14-refresh.md, rules/15-abilities-effects.md
// 公式テキスト:
//   このイベントを自分の現場にいる【緑】の〚特徴［探偵］〛のキャラ1枚にセットする。\nこのイベントがセットされているキャラは〚突撃［キャラ］〛と「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を持つ。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-hand',
  trigger: {
    hook: 'effect:declared',
    selfOnly: true,
    matcher: (p: unknown) => (p as { kind?: unknown })?.kind === 'event-use'
  },
  effect: {
    kind: 'atom',
    verb: 'charSetCard',
    args: {
      player: 'self',
      fromSelf: true,
      n: 1,
      filter: {
        color: '緑',
        trait: [
          '探偵'
        ],
        kind: 'character'
      }
    }
  },
  description: 'このイベントを自分の現場にいる【緑】の〚特徴［探偵］〛のキャラ1枚にセットする。',
  ruleRefs: [
    'rules/15-abilities-effects.md',
    'rules/16-card-set.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-set-host',
  continuousModifier: {
    grantKeywords: () => ['突撃[キャラ]','text:actionTargetsActive']
  },
  description: 'このイベントがセットされているキャラは〚突撃［キャラ］〛と「このキャラは相手の現場にいるアクティブ状態のキャラを指定してアクションできる。」を持つ。',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/16-card-set.md',
    'rules/22-qa-action-contact.md'
  ]
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-evidence',
  trigger: {
    hook: 'evidence:remove-by-action',
    optional: true
  },
  effect: {
    args: {
      n: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'draw'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B02031: CardDef = {
  id: 'B02031',
  no: '0201/B02031',
  kind: 'event',
  names: [
    '平次のバイク'
  ],
  colors: [
    '緑'
  ],
  level: 6,
  traits: [],
  rarity: 'C',
  imageUrl: '1721357211028138.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/16-card-set.md',
    'rules/22-qa-action-contact.md',
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md'
  ],
};
