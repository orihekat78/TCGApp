// cards/ct-p06/B06039 沖田総司 (character) — engine拡張 wave#2 cluster15 follow-up (removal-observer + partnerColorKeyword, 2026-06-18)
// rules: 03-field-areas.md, 07-action-flow.md, 08-contact.md, 10-action-event.md, 13-keywords.md,
//        15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md, 24-qa-naming-stun.md
//
// 公式テキスト (ct-p06/character.tsv B06039):
//   【パートナー緑】〚突撃［キャラ］〛
//   【自分ターン中】AP＋1000
//   相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引き、手札を1枚リムーブする。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// 句マッピング:
//   a1 (常時有効): 【パートナー緑】〚突撃［キャラ］〛 = __shared partnerColorKeyword({color:'緑',kw:'突撃[キャラ]'})
//       (grantKeywords closure・JSON 不能 → 共通クラス経由。B08007/D11009 同型)。
//   a2 (常時有効): 【自分ターン中】AP＋1000 = condition turn{player:'self'} + continuousModifier.apDelta:1000
//       (owner-self 修正。B08007 a2 / B06040 同型)。
//   a3 (条件発動): removal-observer (cluster15)。trigger {hook:'leave:to-remove'} (selfOnly 無)
//       + condition removedCharMatches{side:'opp',cause:'contact-ap',by:'self'}。
//       effect = sequence([draw1, 自手札 discard1]) (D01003 a1 同文「カードを1枚引き、手札を1枚リムーブする」同型)。
//       自手札 discard は scene removal verb でない → cascade 無 / 【ターン1】無印字。
//   a4 (アイコン): 【ヒラメキ】キャラを1枚まで選び、スリープさせる = trigger {hook:'evidence:remove-by-action', optional:true}
//       + sceneSetState pick (D05007 a2 byte-identical: 明示 $pick + pick query で hiramekiResolve 自動解決、
//       1枚まで = n.min:0 0-pick legal、side:'either' = どちらの現場も rules/15)。

import type { AbilityDef, CardDef } from '@/engine/types';
import { partnerColorKeyword } from '../_shared/index.js';

// a1: 【パートナー緑】〚突撃［キャラ］〛
const a1: AbilityDef = partnerColorKeyword({ color: '緑', kw: '突撃[キャラ]', abilityId: 'a1' });

const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  // 【自分ターン中】
  condition: { kind: 'turn', player: 'self' },
  // AP＋1000
  continuousModifier: { apDelta: 1000 },
  description: '【自分ターン中】AP＋1000',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md', 'rules/24-qa-naming-stun.md'],
};

const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  // 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき
  trigger: { hook: 'leave:to-remove' },
  condition: { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' },
  // カードを1枚引き、手札を1枚リムーブする
  effect: {
    kind: 'sequence',
    steps: [
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
      { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
    ],
  },
  description:
    '相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、カードを1枚引き、手札を1枚リムーブする。',
  ruleRefs: [
    'rules/08-contact.md',
    'rules/15-abilities-effects.md',
    'rules/22-qa-action-contact.md',
  ],
};

const a4: AbilityDef = {
  id: 'a4',
  type: 'triggered',
  scope: 'on-evidence',
  // 【ヒラメキ】（証拠からリムーブされるときに発動する）
  trigger: { hook: 'evidence:remove-by-action', optional: true },
  // キャラを1枚まで選び、スリープさせる (hirameki fire は明示 $pick + pick query を保持して auto-resolve)
  effect: {
    kind: 'atom',
    verb: 'sceneSetState',
    args: {
      uid: '$pick',
      state: 'sleep',
      target: { kind: 'pick', query: { area: 'scene', side: 'either' }, n: { min: 0, max: 1 }, chooser: 'self' },
    },
  },
  description: '【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。',
  ruleRefs: ['rules/10-action-event.md', 'rules/03-field-areas.md'],
};

export const B06039: CardDef = {
  id: 'B06039',
  no: '0662/B06039',
  kind: 'character',
  names: ['沖田総司'],
  colors: ['緑'],
  level: 7,
  ap: 6000,
  lp: 0,
  traits: ['高校生'],
  keywords: [],
  rarity: 'R',
  imageUrl: '1754285189484821.jpg',
  abilities: [a1, a2, a3, a4],
  ruleRefs: [
    'rules/03-field-areas.md',
    'rules/07-action-flow.md',
    'rules/08-contact.md',
    'rules/10-action-event.md',
    'rules/13-keywords.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
    'rules/22-qa-action-contact.md',
    'rules/24-qa-naming-stun.md',
  ],
};
