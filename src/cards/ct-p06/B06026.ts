// cards/ct-p06/B06026 コウモリ男（バットマン） (character) — Task A green候補 (engine変更0)
// rules: rules/13-keywords.md, rules/17-icons.md, rules/01-victory-conditions.md, rules/03-field-areas.md, rules/05-turn-phases.md, rules/14-refresh.md, rules/10-action-event.md
// 公式テキスト:
//   【パートナー緑】〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）\n【相手ターン中】【現場リムーブ時】このカードを表向きのまま証拠として得る。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）自分の表向きの証拠を1つまで選び、裏向きにする。

import type { AbilityDef, CardDef } from '@/engine/types';

const a1: AbilityDef = {
  id: 'a1',
  type: 'continuous',
  scope: 'on-scene',
  condition: {
    kind: 'partnerColor',
    color: '緑'
  },
  continuousModifier: {
    grantKeywords: () => ['突撃[キャラ]']
  },
  description: '【パートナー緑】〚突撃［キャラ］〛（登場したターンからすぐにキャラを指定してアクションできる）',
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md'
  ]
};

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  trigger: {
    hook: 'leave:to-remove',
    selfOnly: true
  },
  condition: {
    kind: 'turn',
    player: 'opp'
  },
  effect: {
    kind: 'atom',
    verb: 'selfToEvidence',
    args: {
      faceUp: true
    }
  },
  description: '【相手ターン中】【現場リムーブ時】このカードを表向きのまま証拠として得る。',
  ruleRefs: [
    'rules/01-victory-conditions.md',
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/14-refresh.md',
    'rules/17-icons.md'
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
      faceUp: true,
      max: 1,
      player: 'self'
    },
    kind: 'atom',
    verb: 'evidenceFlipDown'
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）自分の表向きの証拠を1つまで選び、裏向きにする。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md'
  ]
};

export const B06026: CardDef = {
  id: 'B06026',
  no: '0649/B06026',
  kind: 'character',
  names: [
    'コウモリ男（バットマン）'
  ],
  colors: [
    '緑'
  ],
  level: 7,
  ap: 5000,
  lp: 0,
  traits: [
    'YAIBA'
  ],
  rarity: 'C',
  imageUrl: '1754285189411292.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/13-keywords.md',
    'rules/17-icons.md',
    'rules/01-victory-conditions.md',
    'rules/03-field-areas.md',
    'rules/05-turn-phases.md',
    'rules/14-refresh.md',
    'rules/10-action-event.md'
  ],
};
