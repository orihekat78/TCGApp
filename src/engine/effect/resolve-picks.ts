// engine.effect.resolveEffectPicks — Phase 7-2 (BUG-035 fix)
//
// rules: 10-action-event.md §ヒラメキ (対象 0 で空発動可)、15-abilities-effects.md
// spec: .claude/bugs/BUG-035.md
//
// 役割:
//   effect tree を recursive に traverse し、`$pick` placeholder を含む atom を
//   `target.candidates(state, target, ctx)` で列挙して先頭採用、`args.uid` を picked.uid に
//   substitute する。Effect を返す pure 関数 (deep clone、副作用なし)。
//
// 適用箇所 (Phase 7-2):
//   - src/engine/listeners/triggered.ts: event.queue 呼出前
//   - src/ui/hooks/useEngineDispatch.ts:hiramekiResolve: 既存 resolveHiramekiPick の retrofit
//
// 設計:
//   - atom / choice / sequence / parallel / optional / conditional / forEach / replace 各 kind を walk
//   - negate / custom は skip (内部 effect なし or 動的、$pick 想定外)
//   - 候補 0 件: 元 atom そのまま (rules/10 no-op fallback)
//   - AI policy 未導入、先頭採用 (Phase 7-3 で `chooseAtomTarget` 等を導入予定)

import { candidates as targetCandidates } from '../target/candidates.js';
import type { GameState, Effect, EffectCtx, TargetingRef } from '../types/index.js';

function substituteAtomPick(
  state: GameState,
  atom: { kind: 'atom'; verb: unknown; args: unknown },
  ctx: EffectCtx,
): Effect {
  if (!atom.args || typeof atom.args !== 'object') return atom as Effect;
  const args = atom.args as { uid?: unknown; target?: unknown } & Record<string, unknown>;
  if (args.uid !== '$pick') return atom as Effect;
  const target = args.target as { kind?: string } | undefined;
  if (!target || target.kind !== 'pick') return atom as Effect;

  const cands = targetCandidates(state, target as TargetingRef, ctx);
  if (cands.length === 0) return atom as Effect; // no-op fallback
  const picked = cands[0];
  if (!picked || picked.kind !== 'char') return atom as Effect;

  // deep clone the atom with substituted uid + target removed
  const { target: _omit, ...restArgs } = args;
  void _omit;
  return {
    kind: 'atom',
    verb: atom.verb as never,
    args: { ...restArgs, uid: picked.uid },
  } as Effect;
}

export function resolveEffectPicks(state: GameState, effect: Effect, ctx: EffectCtx): Effect {
  if (!effect || typeof effect !== 'object') return effect;
  switch (effect.kind) {
    case 'atom':
      return substituteAtomPick(state, effect, ctx);
    case 'sequence':
      return { kind: 'sequence', steps: effect.steps.map((s) => resolveEffectPicks(state, s, ctx)) };
    case 'parallel':
      return { kind: 'parallel', steps: effect.steps.map((s) => resolveEffectPicks(state, s, ctx)) };
    case 'choice':
      return {
        kind: 'choice',
        chooser: effect.chooser,
        options: effect.options.map((o) => resolveEffectPicks(state, o, ctx)),
      };
    case 'optional':
      return { kind: 'optional', effect: resolveEffectPicks(state, effect.effect, ctx) };
    case 'conditional':
      return {
        kind: 'conditional',
        if: effect.if,
        then: resolveEffectPicks(state, effect.then, ctx),
        else: effect.else ? resolveEffectPicks(state, effect.else, ctx) : undefined,
      };
    case 'forEach':
      // forEach は over の各候補で do を実行する dynamic 構造。$pick は do 内に出ない想定だが
      // 念のため再帰 (do 自体が atom-with-$pick になることはないが、ネスト構造はあり得る)
      return { kind: 'forEach', over: effect.over, do: resolveEffectPicks(state, effect.do, ctx) };
    case 'replace':
      return { kind: 'replace', trigger: effect.trigger, with: resolveEffectPicks(state, effect.with, ctx) };
    case 'negate':
    case 'custom':
    default:
      return effect;
  }
}
