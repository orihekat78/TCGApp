// cards/_shared/souzaX
// rules: 13-keywords.md §捜査X
// spec: Phase 5 advance Sub-task A
//
// 【捜査X】 相手はデッキ上から X 枚公開し、好きな順番でデッキの下に移す。
// 公開したカードを「発見された」カードとして、その後の効果を解決する (rules/13)。
//
// 本 wrapper は engine の atom 'souza' を defender=opp 想定で発火する factory。
// 「発見された」参照効果は Sub-task B/C で `state.discoveredCards` を追加して実装予定。
// 現状 Sub-task A スコープでは peek 順そのまま deck 下に戻す純粋な deck 操作のみ。

import type { AbilityDef } from '@/engine/types';

export function souzaX(opts: {
  x: number;
  /** defender side (rules/13: 相手 = 推理側ではない、効果起動側の opponent)。
   *  default 'opp' = カード使用側から見て相手。effect ctx で `target` を解決する
   *  pattern を踏襲予定だが、Sub-task A は固定パラメータ。 */
  defender?: 'self' | 'opp';
  abilityId?: string;
}): AbilityDef {
  const x = opts.x;
  const defender = opts.defender ?? 'opp';
  return {
    id: opts.abilityId ?? 'a_souza',
    type: 'triggered',
    scope: 'on-scene',
    trigger: { hook: 'enter', selfOnly: true },
    effect: {
      kind: 'atom',
      verb: 'souza',
      args: { player: defender, x },
    },
    description: `【捜査${x}】相手はデッキ上から ${x} 枚公開し、好きな順でデッキの下に移す。`,
    ruleRefs: ['rules/13-keywords.md'],
  };
}
