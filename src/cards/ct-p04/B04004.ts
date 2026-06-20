// cards/ct-p04/B04004 毛利蘭 (character) — Task A green候補 再author (engine変更0)
// rules: rules/07-action-flow.md, rules/08-contact.md, rules/13-keywords.md, rules/15-abilities-effects.md, rules/17-icons.md, rules/19-special-rules.md, rules/22-qa-action-contact.md
// 公式テキスト:
//   【パートナー青】〚迅速〛
//   【ターン1】相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき、手札を1枚リムーブしてもよい。そうした場合、証拠を1つ得る。
//   【絆工藤新一】【ターン1】相手の現場にいるキャラが自分の現場にいる〚カード名［工藤新一］〛を指定してアクションしたとき、このキャラをアクティブにする。
// 句マッピング:
//   - a1 【パートナー青】〚迅速〛 => partnerColorKeyword({color:'青', kw:'迅速', abilityId:'a1'}) [src/cards/ct-d02/D02003.ts
//     VERBATIM (緑→青): 【パートナー(色)】〚迅速〛 を _shared/partnerColorKeyword で付与。partnerColor 条件成立中のみ keyword 保持
//     (rules/17 条件不成立=能力を持たない扱い)。迅速 = 名乗り状態でも推理/アクション可 (rules/13)。]
//   - a2 【ターン1】 => limit {kind:'turn', n:1}。fire 時点で count (0-pick でも、rules/24)。
//   - a2 相手の現場にいるキャラがこのキャラとのコンタクトによってリムーブされたとき => triggered, trigger {hook:'leave:to-remove'}
//     (selfOnly 無 = 他キャラ離場の観測者) + condition {kind:'removedCharMatches', side:'opp', cause:'contact-ap', by:'self'}
//     [src/cards/ct-p09/B09071.ts a3 VERBATIM (cluster15 contact-removal-by-self 反撃族、出荷済)。side:'opp'=除去された
//     のは相手キャラ / cause:'contact-ap'=コンタクトの AP 判定リムーブ (rules/08 §5) / by:'self'=このキャラ自身が
//     コンタクト相手 (eval.ts byUid===ctx.source.uid)。leave:to-remove は除去キャラ splice 前 emit。]
//   - a2 手札を1枚リムーブしてもよい。そうした場合、証拠を1つ得る => chain[ discard{player:'self', max:1}, evidenceGain{player:'self', n:1} ]
//     [src/cards/ct-p04/B04056.ts a1 / ct-d08/D08003.ts a1 同型: 'リムーブしてもよい。そうした場合' = bare chain + discard max:1
//     (min:0 = 0-pick decline 可、rules/15 「〜してもよい」)。no-candidate/decline で chain break → evidenceGain skip。
//     手札の任意カード (filter 無)。evidenceGain = '証拠を1つ得る' (src/cards/ct-d03/D03002.ts a1 VERBATIM、デッキ上1枚を証拠へ)。]
//   - a3 【絆工藤新一】 => ability.condition {kind:'bond', cardName:'工藤新一'} [icon 条件は condition フィールド (handleHook が
//     matcherCondition の後に評価)。bond = 自分の現場に[工藤新一]がいる (rules/17、パートナーは不可)。rules/19 分割名対応。]
//   - a3 【ターン1】 => limit {kind:'turn', n:1}。
//   - a3 相手の現場にいるキャラが自分の現場にいる〚カード名［工藤新一］〛を指定してアクションしたとき => trigger {hook:'action:declare',
//     matcherCondition: and[ triggerCharMatches{side:'opp', filter:{}}, triggerCharMatches{payloadKey:'targetUid', side:'self', filter:{cardName:'工藤新一'}} ]}
//     [actor-gate = src/cards/ct-p01/B01062.ts a1 pattern (action:declare + matcherCondition and[..., triggerCharMatches{side:'opp',filter:{}}])。
//     filter:{} の scene 走査でアクション主体が相手 '現場' のキャラ (partner 除外) を厳密充足 (eval.ts:298)。
//     target-gate = src/cards/ct-p08/B08048.ts a1 VERBATIM (triggerCharMatches{payloadKey:'targetUid', filter:{...}}): action:declare payload の
//     targetUid (char target 時のみ flat 併記、state-machine.ts:198) を読み、side:'self'+cardName で '自分の現場の工藤新一を指定' を充足。
//     旧 refuted 版は actor-gate (triggerCharMatches{side:opp}) 欠落で相手の任意アクションに誤発火 → and[actor,target] で再 author。]
//   - a3 このキャラをアクティブにする => atom sceneSetState {uid:'$self', state:'active'} [src/cards/ct-d03/D03011.ts 同型 (state:'active')。
//     resolveBindRef('$self')=ctx.source.uid。スタン状態は engine の sceneSetState が rules/03 で代わりにスリープ化 (verb 側担保)。]

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

export const B04004: CardDef = {
  id: 'B04004',
  no: '0409/B04004',
  kind: 'character',
  names: ['毛利蘭'],
  colors: ['青'],
  level: 8,
  ap: 8000,
  lp: 0,
  traits: ['高校生', '毛利探偵事務所', '空手家'],
  rarity: 'SR',
  imageUrl: '1735287656207095.jpg',
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
