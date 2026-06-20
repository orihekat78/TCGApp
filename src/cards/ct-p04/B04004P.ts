// cards/ct-p04/B04004P 毛利蘭 (character, parallel) — Task A green候補 再author (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/22-qa-action-contact.md
// 公式テキスト (B04004 と同一):
//   【パートナー青】〚迅速〛
//   【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、手札を1枚リムーブしてもよい。そうした場合、証拠を1つ得る。
//   【絆工藤新一】【ターン1】相手の現場にいるキャラが自分の現場にいる〚カード名［工藤新一］〛を指定してアクションしたとき、このキャラをアクティブにする。
// 句マッピングは B04004.ts を参照 (byte-twin、meta のみ差分: id/no/rarity/imageUrl)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

const a1: AbilityDef = partnerColorKeyword({ color: '青', kw: '迅速', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき
  trigger: { hook: 'leave:to-remove' },
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  // 手札を1枚リムーブしてもよい。そうした場合、証拠を1つ得る
  effect: {
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'discard', args: { player: 'self', max: 1 } },
      { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } },
    ],
  },
  description: '【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、手札を1枚リムーブしてもよい。そうした場合、証拠を1つ得る。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
  ],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  // 【絆工藤新一】
  condition: { kind: 'bond', cardName: '工藤新一' },
  // 【ターン1】
  limit: { kind: 'turn', n: 1 },
  // 相手の現場にいるキャラが自分の現場にいる〚カード名［工藤新一］〛を指定してアクションしたとき
  trigger: {
    hook: 'action:declare',
    matcherCondition: {
      kind: 'and',
      cs: [
        { kind: 'triggerCharMatches', side: 'opp', filter: {} },
        { kind: 'triggerCharMatches', payloadKey: 'targetUid', side: 'self', filter: { cardName: '工藤新一' } },
      ],
    },
  },
  // このキャラをアクティブにする
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$self', state: 'active' } },
  description: '【絆工藤新一】【ターン1】相手の現場にいるキャラが自分の現場にいる〚カード名［工藤新一］〛を指定してアクションしたとき、このキャラをアクティブにする。',
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md',
  ],
};

export const B04004P: CardDef = {
  id: 'B04004P',
  no: '0409/B04004P',
  kind: 'character',
  names: ['毛利蘭'],
  colors: ['青'],
  level: 8,
  ap: 8000,
  lp: 0,
  traits: ['高校生', '毛利探偵事務所', '空手家'],
  rarity: 'SRP',
  imageUrl: '1735287656212351.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: [
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/19-special-rules.md',
    'rules/22-qa-action-contact.md',
  ],
};
