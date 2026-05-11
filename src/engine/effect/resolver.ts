// engine.effect.run — Effect Descriptor 解釈器 (resolver)
// spec: .claude/specs/engine-api-effect-descriptor.md
// spec: .claude/specs/engine-api-resolver.md
// rules: 15-abilities-effects.md, 25-qa-effects-resolution.md
//
// 設計メモ:
//   - replace / negate は "発動時に即解決" の例外 (rules/15) であり、
//     emit 時の handler が直接 engine.resolve.replace / cancel を呼ぶ。
//     よって engine.effect.run でこれらが渡された場合は明示的に throw する
//     (誤用検知)。
//   - choice の選択は ctx.dyn.choiceIndex (number) で行う。未指定なら 0。
//     UI からの選択ルーティングは Phase 7 で実装する。
//   - optional の実行は ctx.dyn.optionalRun (boolean) で行う。未指定 / false なら skip。
//   - forEach は over を engine.target.resolve で展開し、各候補を
//     ctx.bindings['$each'] に単一要素配列として束ねて do を実行する。
//   - parallel は今は sequence と同じ意味。並列実行のセマンティクスが必要に
//     なれば再検討する (TODO: phase 4 以降)。

import type { GameState, Effect, EffectCtx, Candidate } from '../types/index.js';
import { runAtom } from './atom-handlers.js';
import { evalCond } from '../cond/eval.js';
import { resolve as resolveTarget } from '../target/resolve.js';

/**
 * Effect Descriptor を解釈・実行する。
 * Immer draft 内 (produce のコールバック) で呼ぶこと。
 */
export function run(state: GameState, eff: Effect, ctx: EffectCtx): void {
  switch (eff.kind) {
    case 'sequence': {
      for (const step of eff.steps) {
        run(state, step, ctx);
      }
      return;
    }
    case 'parallel': {
      // TODO: Phase 4+ で必要に応じて並列セマンティクスを定義する。
      // 現状は sequence と同じ挙動 (副作用順は配列順)。
      for (const step of eff.steps) {
        run(state, step, ctx);
      }
      return;
    }
    case 'choice': {
      // ctx.dyn.choiceIndex で選択する。未指定 / 非数なら 0 を採用。
      const raw = ctx.dyn?.choiceIndex;
      const idx = typeof raw === 'number' && Number.isInteger(raw) ? raw : 0;
      if (idx < 0 || idx >= eff.options.length) {
        throw new Error(`effect.run: choice index ${idx} out of range [0, ${eff.options.length})`);
      }
      run(state, eff.options[idx], ctx);
      return;
    }
    case 'optional': {
      // ctx.dyn.optionalRun が true なら実行、それ以外は skip。
      const should = ctx.dyn?.optionalRun === true;
      if (should) {
        run(state, eff.effect, ctx);
      }
      return;
    }
    case 'conditional': {
      const ok = evalCond(state, eff.if, ctx);
      if (ok) {
        run(state, eff.then, ctx);
      } else if (eff.else !== undefined) {
        run(state, eff.else, ctx);
      }
      return;
    }
    case 'forEach': {
      const list: Candidate[] = resolveTarget(state, eff.over, ctx);
      // 直前の $each バインディングを退避し、ループ完了後に復元する。
      const prev = ctx.bindings['$each'];
      try {
        for (const cand of list) {
          ctx.bindings['$each'] = [cand];
          run(state, eff.do, ctx);
        }
      } finally {
        if (prev === undefined) {
          delete ctx.bindings['$each'];
        } else {
          ctx.bindings['$each'] = prev;
        }
      }
      return;
    }
    case 'replace':
    case 'negate':
      throw new Error(
        'replace/negate are immediate-resolution; not runnable via effect.run — see resolver stack handling',
      );
    case 'atom': {
      runAtom(state, eff.verb, eff.args, ctx);
      return;
    }
    case 'custom': {
      eff.fn(state, ctx);
      return;
    }
    default: {
      const _exhaustive: never = eff;
      throw new Error(`effect.run: unknown kind ${String(_exhaustive)}`);
    }
  }
}
