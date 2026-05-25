// cards/ct-d11/D11007 松田陣平 (キャラ)
// rules: 07-action-flow.md, 08-contact.md, 13-keywords.md, 17-icons.md, 22-qa-action-contact.md
// spec: .claude/specs/cards-analysis/D11007.md
//
// 公式テキスト:
//   このキャラは相手の現場にいるレベル7以上のアクティブ状態のキャラを指定してアクションできる。
//   【パートナー黄】〚突撃〛
//   【自分ターン中】【ターン1】このキャラが、このキャラよりAPの高いキャラとコンタクトしたとき、
//     手札を1枚リムーブしてもよい。そうした場合、そのコンタクト中、このキャラをAP＋3000する。
//
// engine 実装: a1 は trigger { hook: 'action:pre-target', selfOnly: true } で表現。
// candidates() (target-expander.ts) が attacker = D11007 のとき expandActionTargets atom の
// args を直接 lookup し、対象列挙に拡張仕様を merge する (D11007 v2 Phase 3 で導入)。

import type { AbilityDef, CardDef } from '@/engine/types';

// a1: アクション対象拡張 — このキャラが attacker のとき、相手の現場の level≥7 active も対象可
const a1: AbilityDef = {
  id: 'a1',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'action:pre-target', selfOnly: true }, // アクションでこのカードが選ばれたとき
  effect: {
    kind: 'atom',
    verb: 'expandActionTargets',
    args: { side: 'opp', state: ['active'], levelMin: 7 }, // 相手の現場の レベル7以上 アクティブを対象に追加
  },
  description: 'このキャラは相手の現場にいるレベル7以上のアクティブ状態のキャラを指定してアクションできる。',
  ruleRefs: ['rules/07-action-flow.md'],
};

// a2: 【パートナー黄】〚突撃〛 — D08003 a1 inline pattern と同型 (partnerColor cond + continuousModifier)
const a2: AbilityDef = {
  id: 'a2',
  type: 'continuous',
  scope: 'on-scene',
  condition: { kind: 'partnerColor', color: '黄' }, // 【パートナー黄】
  continuousModifier: {
    grantKeywords: () => ['突撃'], // 〚突撃〛
  },
  description: '【パートナー黄】〚突撃〛',
  ruleRefs: ['rules/13-keywords.md', 'rules/17-icons.md'],
};

// a3 自分ターン中 ターン1: 高APコンタクト時に手札1リム → self AP+3000 (コンタクト中)
const a3: AbilityDef = {
  id: 'a3',
  type: 'triggered',
  scope: 'on-scene',
  condition: { kind: 'turn', player: 'self' },
  limit: { kind: 'turn', n: 1 },
  trigger: {
    hook: 'contact:start',
    matcherCondition: { kind: 'contactOpponentApHigher' }, // このキャラより AP の高いキャラとコンタクトしたとき
  },
  effect: {
    // 「してもよい」「そうした場合」semantics: chain + step 1 max:1 (skip 可能) で表現 (D08003 a1 同型)。
    // optional 単体は ctx.dyn.optionalRun の UI 配線が未実装で常に skip されるため使えない。
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'discard',      args: { player: 'self', max: 1 } },                         // 手札を1枚リムーブしてもよい (max:1 で skip 可能、skip 時は chain break)
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 3000, scope: 'contact' } },   // そうした場合、このキャラを AP+3000 (コンタクト中)
    ],
  },
  description: '【自分ターン中】【ターン1】高APコンタクト時、手札1リムでこのキャラAP＋3000 (コンタクト中)。',
  ruleRefs: ['rules/08-contact.md', 'rules/22-qa-action-contact.md'],
};

export const D11007: CardDef = {
  id: 'D11007',
  no: '0938/D11007',
  kind: 'character',
  names: ['松田陣平'], colors: ['黄'],
  level: 6, ap: 5000, lp: 1,
  traits: ['警察', '警視庁'], keywords: [],
  rarity: 'D', imageUrl: '1775608962464705.jpg',
  abilities: [a1, a2, a3],
  ruleRefs: ['rules/07-action-flow.md', 'rules/08-contact.md', 'rules/13-keywords.md', 'rules/22-qa-action-contact.md'],
};
