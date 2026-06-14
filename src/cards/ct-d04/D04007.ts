// cards/ct-d04/D04007 メアリー (character) — engine拡張 wave#2 cluster3 (action-lifecycle trigger 族)
// rules: rules/10-action-event.md, rules/11-reasoning.md, rules/13-keywords.md, rules/14-refresh.md, rules/15-abilities-effects.md, rules/17-icons.md
//
// 公式テキスト:
//   〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//   【ターン1】自分の現場にいるキャラのアクション［事件］によって証拠を得たとき、手札を1枚リムーブしてもよい。そうした場合、証拠を1つ得る。
//
// 句マッピング:
//   - 〚ミスリード1〛（相手の推理に対し、スリープさせることでLP－1する）
//       => __shared misreadX({x:1, abilityId:'a1'}) (type 'icon-misread')
//          [src/cards/_shared/misreadX.ts:15; engine listeners/misread.ts が reasoning:before-add → sleep + LP-X。
//           1回の推理に対し何枚でも同時発動可 (rules/13、qAndA「1回につき何枚でも同時」)]
//   - 【ターン1】 => limit:{kind:'turn', n:1}
//          [発動 (queue) 時にカウント — triggered.ts:235-237 enforce / :309-311 incr。
//           qAndA: リムーブしなくても (= optional 辞退でも) 【ターン1】消費済 → 同ターン再発動不可。fire-time カウントで成立]
//   - 自分の現場にいるキャラのアクション［事件］によって証拠を得たとき
//       => trigger:{hook:'evidence:gain'} (非 selfOnly = メアリー自身に限らない) +
//          matcherCondition:{kind:'triggerCharMatches', side:'self', payloadKey:'byUid'}
//          [evidence:gain は action-case.ts gainSelfEvidence の唯一 emit (推理/効果/refresh では発火しない) =
//           「アクション[事件]によって」を構造的に保証 (X9)。payload.byUid = アクションした actor。
//           triggerCharMatches payloadKey:'byUid' は scene のみ走査 → 'partner:self' は不一致で不発 =
//           「現場にいるキャラ」と一致 (パートナーの action[事件] は対象外、filter 省略でも scene 限定で正)]
//   - 手札を1枚リムーブしてもよい。そうした場合、 => optional{chain[discard{player:'self', n:1}, …]}
//          [optional = する/しない surface (AI は常時辞退 = 既知 AI 制約)。'そうした場合' = chain semantics:
//           辞退 / 手札0 で discard が __chainStepNoApply → 後続 evidenceGain は break (resolver.ts case 'chain')]
//   - 証拠を1つ得る => evidenceGain{player:'self', n:1}
//          [atom-handlers.ts:455-479; X15 で deck0→refresh→remove0 敗北の guard 配線済 (rules/14)]

import type { AbilityDef, CardDef } from '@/engine/types';
import { misreadX } from '@/cards/_shared';

// a1: 〚ミスリード1〛 (相手の推理に対し、スリープして対象 LP-1)
const a1 = misreadX({ x: 1, abilityId: 'a1' });

// a2: 【ターン1】自分の現場のキャラがアクション［事件］で証拠を得たとき、手札1枚リムーブで証拠を1つ得る
const a2: AbilityDef = {
  id: 'a2',
  type: 'triggered',
  scope: 'on-scene',
  limit: { kind: 'turn', n: 1 }, // 【ターン1】(fire-time カウント = 辞退でも消費)
  // 自分の現場にいるキャラ (= side:'self' の scene キャラ、パートナー除外) のアクション［事件］で証拠を得たとき
  trigger: {
    hook: 'evidence:gain',
    matcherCondition: { kind: 'triggerCharMatches', side: 'self', payloadKey: 'byUid' },
  },
  // 手札を1枚リムーブしてもよい。そうした場合、証拠を1つ得る
  effect: {
    kind: 'optional',
    effect: {
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
        { kind: 'atom', verb: 'evidenceGain', args: { player: 'self', n: 1 } },
      ],
    },
  },
  description:
    '【ターン1】自分の現場にいるキャラのアクション［事件］によって証拠を得たとき、手札を1枚リムーブしてもよい。そうした場合、証拠を1つ得る。',
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};

export const D04007: CardDef = {
  id: 'D04007',
  no: '0138/D04007',
  kind: 'character',
  names: ['メアリー'],
  colors: ['赤'],
  level: 6,
  ap: 6000,
  lp: 1,
  traits: ['赤井家'],
  keywords: [],
  rarity: 'D',
  imageUrl: '1714013132394119.jpg',
  abilities: [a1, a2],
  ruleRefs: [
    'rules/10-action-event.md',
    'rules/11-reasoning.md',
    'rules/13-keywords.md',
    'rules/14-refresh.md',
    'rules/15-abilities-effects.md',
    'rules/17-icons.md',
  ],
};
