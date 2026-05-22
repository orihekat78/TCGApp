// engine.effect.resolveEffectPicks — Phase 7-2 (BUG-035 fix) + Phase 7-3 (AI policy hook)
//
// rules: 10-action-event.md §ヒラメキ (対象 0 で空発動可)、15-abilities-effects.md
// spec: .claude/bugs/BUG-035.md
//
// 役割:
//   effect tree を recursive に traverse し、`$pick` placeholder を含む atom を
//   `target.candidates(state, target, ctx)` で列挙して候補から 1 つに置換、`args.uid` を
//   picked.uid に substitute する。Effect を返す pure 関数 (deep clone、副作用なし)。
//
// 適用箇所:
//   - src/engine/listeners/triggered.ts: event.queue 呼出前
//   - src/ui/hooks/useEngineDispatch.ts:hiramekiResolve: 既存 resolveHiramekiPick の retrofit
//
// 設計:
//   - atom / choice / sequence / parallel / optional / conditional / forEach / replace 各 kind を walk
//   - negate / custom は skip (内部 effect なし or 動的、$pick 想定外)
//   - 候補 0 件: 元 atom そのまま (rules/10 no-op fallback)
//   - Phase 7-3: `opts.chooseAtomTarget` callback (HeuristicPolicy.chooseAtomTarget 等) で best 候補選択。
//     未指定 / null 返却 → 先頭採用 fallback (Phase 7-2 と互換)

import { candidates as targetCandidates } from '../target/candidates.js';
import type { GameState, Effect, EffectCtx, TargetingRef } from '../types/index.js';
import type { Candidate } from '../types/candidate.js';

type Player = 'self' | 'opp';

/** Phase 7-3: $pick 候補から best を選ぶ callback (AIPolicy.chooseAtomTarget に対応)。 */
export type ChooseAtomTargetFn = (
  state: GameState,
  atomVerb: string,
  atomArgs: Readonly<Record<string, unknown>>,
  candidates: ReadonlyArray<Candidate>,
  byPlayer: Player,
) => Candidate | null;

export interface ResolveEffectPicksOpts {
  /** Phase 7-3: heuristic chooser。未指定なら先頭採用 (Phase 7-2 互換)。 */
  chooseAtomTarget?: ChooseAtomTargetFn;
  /** chooser に渡される byPlayer (省略時 'self')。 */
  byPlayer?: Player;
  /**
   * user_request 20260522_01 #2/#6 BUG-054: human player による pick が必要な
   * effect の場合 true。`substituteAtomPick` で `$pick` 未解決時に
   * globalThis 側チャネル `__pendingEffectPickSide` に候補を set し、
   * atom はそのまま (未解決) 返却する。caller (triggered listener) は
   * side-channel が set されていれば event.queue をスキップ。
   */
  humanChooser?: boolean;
  /** Pending side-channel に保存する識別子 (UI 側で表示や resolve 時に使用) */
  source?: { cardId: string; abilityId: string };
}

// user_request 20260522_01 #6 BUG-054: human pick の側チャネル
declare global {
  // eslint-disable-next-line no-var
  var __pendingEffectPickSide: PendingEffectPickSide | null | undefined;
}

export type PendingEffectPickSide = {
  player: Player;
  /** 候補 uid 配列 (Candidate.kind === 'char' のみ抽出) */
  candidates: { uid: string; cardId: string; player: Player }[];
  /** 元 atom の verb (例: 'sceneRemove') */
  atomVerb: string;
  /** atom args (uid='$pick' 含む、resolve 後に上書きされる) */
  atomArgs: Record<string, unknown>;
  /** 任意効果の min/max (n.min === 0 なら skip 可) */
  nMin: number;
  nMax: number;
  /** ability source (UI 表示・log 用) */
  source: { cardId: string; abilityId: string };
};

function setPendingEffectPickSide(v: PendingEffectPickSide | null): void {
  (globalThis as { __pendingEffectPickSide?: PendingEffectPickSide | null }).__pendingEffectPickSide = v;
}

/** dispatch 経由で UI 側 store に転送するための drain ヘルパ */
export function _drainPendingEffectPickSide(): PendingEffectPickSide | null {
  const v = (globalThis as { __pendingEffectPickSide?: PendingEffectPickSide | null }).__pendingEffectPickSide ?? null;
  setPendingEffectPickSide(null);
  return v;
}

function substituteAtomPick(
  state: GameState,
  atom: { kind: 'atom'; verb: unknown; args: unknown },
  ctx: EffectCtx,
  opts: ResolveEffectPicksOpts,
): Effect {
  if (!atom.args || typeof atom.args !== 'object') return atom as Effect;
  const args = atom.args as { uid?: unknown; target?: unknown } & Record<string, unknown>;
  const target = args.target as { kind?: string; n?: { min?: number; max?: number } } | undefined;
  if (!target || target.kind !== 'pick') return atom as Effect;

  // BUG-065: 2 つの effect 記述形式を区別して解決:
  //   Pattern A: { uid: '$pick', target: {kind:'pick',...} } (sceneRemove / charModifyAP 等)
  //              → uid を picked.uid に置換、target を drop
  //   Pattern B: { target: {kind:'pick',...} } (uid 不在、discard / evidenceToHand 等)
  //              → target を picked の cardId/uid 配列に置換 (atom-handler は配列を期待)
  const isPatternA = args.uid === '$pick';
  const isPatternB = !isPatternA && args.uid === undefined;
  if (!isPatternA && !isPatternB) return atom as Effect;

  const cands = targetCandidates(state, target as TargetingRef, ctx);
  if (cands.length === 0) return atom as Effect; // no-op fallback

  const verb = typeof atom.verb === 'string' ? atom.verb : '';
  const byPlayer: Player = opts.byPlayer ?? 'self';

  // user_request 20260522_01 #2/#6 BUG-054 + BUG-065: human player のときは side-channel
  // に候補を set して atom を未解決のまま返却 (caller が queue 抑止)。
  // pattern A は char candidate (scene uid)、pattern B は card candidate (hand cardId) を含む。
  if (opts.humanChooser) {
    const cardCands = cands.filter((c) => c.kind === 'char' || c.kind === 'card') as Array<
      | { kind: 'char'; uid: string; cardId: string; player: Player }
      | { kind: 'card'; cardId: string; area: string; player: Player; index?: number }
    >;
    if (cardCands.length === 0) return atom as Effect;
    const targetRef = target as { n?: { min?: number; max?: number } };
    setPendingEffectPickSide({
      player: byPlayer,
      candidates: cardCands.map((c) =>
        c.kind === 'char'
          ? { uid: c.uid, cardId: c.cardId, player: c.player }
          // BUG-065 pattern B: card candidate には uid が無いので、
          // synthetic uid (cardId#index) を作って UI 側 modal の key として使用。
          // dispatch 側 (useEngineDispatch.effectPickResolve) で synthetic uid から
          // cardId を逆引きして target 配列を構築する。
          : { uid: `${c.cardId}#${c.index ?? 0}`, cardId: c.cardId, player: c.player },
      ),
      atomVerb: verb,
      atomArgs: { ...args },
      nMin: targetRef.n?.min ?? 1,
      nMax: targetRef.n?.max ?? 1,
      source: opts.source ?? { cardId: '', abilityId: '' },
    });
    return atom as Effect; // 未解決のまま返却
  }

  const heuristicPick = opts.chooseAtomTarget?.(
    state,
    verb,
    args as Readonly<Record<string, unknown>>,
    cands,
    byPlayer,
  );
  const picked = heuristicPick ?? cands[0];
  if (!picked) return atom as Effect;

  if (isPatternA) {
    if (picked.kind !== 'char') return atom as Effect;
    const { target: _omit, ...restArgs } = args;
    void _omit;
    return {
      kind: 'atom',
      verb: atom.verb as never,
      args: { ...restArgs, uid: picked.uid },
    } as Effect;
  }

  // Pattern B: target → cardId/uid 配列に置換 (atom-handler が配列を期待)
  const pickValue =
    picked.kind === 'card' ? picked.cardId :
    picked.kind === 'char' ? picked.uid : null;
  if (pickValue === null) return atom as Effect;
  return {
    kind: 'atom',
    verb: atom.verb as never,
    args: { ...args, target: [pickValue] },
  } as Effect;
}

export function resolveEffectPicks(
  state: GameState,
  effect: Effect,
  ctx: EffectCtx,
  opts: ResolveEffectPicksOpts = {},
): Effect {
  if (!effect || typeof effect !== 'object') return effect;
  switch (effect.kind) {
    case 'atom':
      return substituteAtomPick(state, effect, ctx, opts);
    case 'sequence':
      return { kind: 'sequence', steps: effect.steps.map((s) => resolveEffectPicks(state, s, ctx, opts)) };
    case 'parallel':
      return { kind: 'parallel', steps: effect.steps.map((s) => resolveEffectPicks(state, s, ctx, opts)) };
    case 'choice':
      return {
        kind: 'choice',
        chooser: effect.chooser,
        options: effect.options.map((o) => resolveEffectPicks(state, o, ctx, opts)),
      };
    case 'optional':
      return { kind: 'optional', effect: resolveEffectPicks(state, effect.effect, ctx, opts) };
    case 'conditional':
      return {
        kind: 'conditional',
        if: effect.if,
        then: resolveEffectPicks(state, effect.then, ctx, opts),
        else: effect.else ? resolveEffectPicks(state, effect.else, ctx, opts) : undefined,
      };
    case 'forEach':
      // forEach は over の各候補で do を実行する dynamic 構造。$pick は do 内に出ない想定だが
      // 念のため再帰 (do 自体が atom-with-$pick になることはないが、ネスト構造はあり得る)
      return { kind: 'forEach', over: effect.over, do: resolveEffectPicks(state, effect.do, ctx, opts) };
    case 'replace':
      return { kind: 'replace', trigger: effect.trigger, with: resolveEffectPicks(state, effect.with, ctx, opts) };
    case 'negate':
    case 'custom':
    default:
      return effect;
  }
}
