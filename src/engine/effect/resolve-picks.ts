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
  /**
   * BUG-077: tryRePickFromAtom (runtime atom-handler awaiting-pick) から呼ばれた場合 true。
   * 初期 walk (resolveEffectPicks via triggered.ts) から呼ばれた場合 false (default)。
   * Pattern B atom (uid 不在、target=pick query) は runtime tryRePickFromAtom が
   * 各 atom 実行時に正しい state で side-channel を set できるため、初期 walk では
   * set を抑止する。初期 walk で sequence の後続 step が先行 step の target を
   * 横取りする問題 (D08013 a1: step2 evidenceToHand cands=0 → step3 discard が
   * side-channel を奪う) を防ぐ。
   * Pattern A atom (uid='$pick') は runtime handler に awaiting-pick path が無く
   * 初期 walk での side-channel set が必須なので、この flag に関わらず set する。
   */
  _fromAtomHandler?: boolean;
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

/**
 * BUG-076: atom-handler の awaiting-pick path から呼ばれる「単一 atom の pattern B
 * pick を side-channel に set する」エントリポイント。sequence 内の複数 pattern B
 * atom がある場合、step N が atom-handler で awaiting-pick した時点で本関数を呼ぶ
 * ことで、step N 用の side-channel を set し、UI が次の modal を表示できる。
 *
 * 呼び出し条件:
 *   - atom-handler で a.target が string|array に正規化できない (pick query object のまま)
 *   - side-channel が現在空 (上書きしない)
 *
 * 呼び出し場所: src/engine/effect/atom-handlers.ts の各 case の awaiting-pick path。
 */
export function tryRePickFromAtom(
  state: GameState,
  atom: { kind: 'atom'; verb: unknown; args: unknown },
  ctx: EffectCtx,
  opts: ResolveEffectPicksOpts,
): void {
  if ((globalThis as { __pendingEffectPickSide?: unknown }).__pendingEffectPickSide) {
    return; // 既に set 済み (別 atom の pick 待ち)
  }
  // BUG-077: _fromAtomHandler=true で substituteAtomPick を呼ぶことで、
  // Pattern B でも side-channel set を許可 (初期 walk からの呼出と区別)。
  substituteAtomPick(state, atom, ctx, { ...opts, humanChooser: true, _fromAtomHandler: true });
}

/**
 * 物理動作 atom 短縮形対応: target 未指定 + n: number の verb で既定 pick query を補完。
 * カード DSL では `evidenceToHand({player:'self', n:1})` のように書きたく、target query は
 * verb 既定 (area/side/chooser) を engine が推論する。
 */
const PB_DEFAULT_PICK_AREA: Record<string, 'evidence' | 'hand' | 'remove'> = {
  evidenceToHand: 'evidence',
  discard: 'hand',
  handAddFromRemove: 'remove',
};

function substituteAtomPick(
  state: GameState,
  atom: { kind: 'atom'; verb: unknown; args: unknown },
  ctx: EffectCtx,
  opts: ResolveEffectPicksOpts,
): Effect {
  if (!atom.args || typeof atom.args !== 'object') return atom as Effect;
  const args = atom.args as { uid?: unknown; target?: unknown; player?: unknown; n?: unknown } & Record<string, unknown>;
  const verbStr = typeof atom.verb === 'string' ? atom.verb : '';
  // 物理動作 atom 短縮形: { player, n } のみで target 未指定なら verb 既定で pick query を構築
  let effectiveTarget = args.target as { kind?: string; query?: unknown; n?: { min?: number; max?: number }; chooser?: Player } | undefined;
  if (effectiveTarget === undefined && typeof args.n === 'number' && PB_DEFAULT_PICK_AREA[verbStr]) {
    const defaultArea = PB_DEFAULT_PICK_AREA[verbStr];
    const p = (args.player as Player) ?? 'self';
    effectiveTarget = {
      kind: 'pick',
      query: { area: defaultArea, side: p },
      n: { min: args.n, max: args.n },
      chooser: p,
    };
  }
  const target = effectiveTarget;
  if (!target || target.kind !== 'pick' || !target.query) return atom as Effect;

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

  // user_request 20260522_01 #2/#6 BUG-054 + BUG-065 + BUG-075 + BUG-076: human player の
  // ときは side-channel に候補を set して atom を未解決のまま返却 (caller が queue 抑止)。
  //
  // BUG-075: sequence 内に複数 pattern B atom がある場合、後続 atom の walk で side-channel
  // を上書きすると最初の atom 用 modal が出なくなる。既に set 済みなら新規 set せず未解決返却。
  //
  // BUG-076: evidence kind の Candidate は cardId field を持たないため (kind:'evidence',
  // player, index のみ)、従来 filter から除外されていた。evidenceToHand などの atom で
  // evidence area を pick する場合に対応するため、evidence/file kind も candidate に含める。
  if (opts.humanChooser) {
    if ((globalThis as { __pendingEffectPickSide?: unknown }).__pendingEffectPickSide) {
      return atom as Effect;
    }
    // BUG-077: Pattern B (uid 不在) は runtime atom-handler の awaiting-pick path で
    // tryRePickFromAtom 経由で side-channel set される (正しい state を持つため)。
    // 初期 walk (triggered.ts → resolveEffectPicks) では set を抑止し、後続 step が
    // 先行 step の target を横取りする問題を回避。Pattern A は runtime に awaiting-pick
    // path が無いため、初期 walk でも set 必要 (flag 無視)。
    if (isPatternB && !opts._fromAtomHandler) {
      return atom as Effect;
    }
    type CardLike = { uid: string; cardId: string; player: Player };
    const cardLikeCands: CardLike[] = [];
    for (const c of cands) {
      if (c.kind === 'char') {
        cardLikeCands.push({ uid: c.uid, cardId: c.cardId, player: c.player });
      } else if (c.kind === 'card') {
        // BUG-065 pattern B: card candidate には uid が無いので synthetic uid (cardId#index)
        cardLikeCands.push({ uid: `${c.cardId}#${c.index ?? 0}`, cardId: c.cardId, player: c.player });
      } else if (c.kind === 'evidence') {
        // BUG-076: evidence area の pick (D08013 a1 step 2 evidenceToHand 等)
        const evCardId = state.players[c.player].evidence[c.index]?.cardId ?? 'unknown';
        cardLikeCands.push({ uid: `evidence:${c.player}:${c.index}`, cardId: evCardId, player: c.player });
      }
      // file kind は face-down で cardId 不明のため skip (face-up にした後 separately 処理)
    }
    if (cardLikeCands.length === 0) return atom as Effect;
    const targetRef = target as { n?: { min?: number; max?: number } };
    setPendingEffectPickSide({
      player: byPlayer,
      candidates: cardLikeCands,
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
  // BUG-077 後続: evidence kind (evidenceToHand 等の AI 経路) も解決対象に含む
  const pickValue =
    picked.kind === 'card' ? picked.cardId :
    picked.kind === 'char' ? picked.uid :
    picked.kind === 'evidence' ? (state.players[picked.player].evidence[picked.index]?.cardId ?? null) :
    null;
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
