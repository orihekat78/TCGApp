// cards/_shared/misreadX
// rules: 13-keywords.md §ミスリード
// spec: Phase 8 完全クローズ Commit 3b
//
// 【ミスリードX】 相手が推理したとき、このキャラをスリープして対象の LP を X 下げる。
// 1 回の推理に対して何枚でも同時発動可能 (rules/13)。
// LP-X の効果は推理終了時まで (= scope:'turn' で実装、reasoning 内で参照される)。
//
// engine 側の `src/engine/listeners/misread.ts` が `reasoning:before-add` を受けて
// 反対側 scene から type:'icon-misread' を抽出し、sleep + LP-X を適用する。
// effect 自体は noop (実行は listener が担当 — ability の args.x を読み取る)。

import type { AbilityDef } from '@/engine/types';

export function misreadX(opts: {
  x: number;
  abilityId?: string;
}): AbilityDef {
  const x = opts.x;
  return {
    id: opts.abilityId ?? 'a_misread',
    type: 'icon-misread',
    scope: 'on-scene',
    effect: { kind: 'atom', verb: 'noop', args: { kind: 'misread-marker', x } } as never,
    description: `【ミスリード${x}】相手が推理したとき、このキャラをスリープして対象の LP を ${x} 下げる。`,
    ruleRefs: ['rules/13-keywords.md'],
  };
}
