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
import { evalDyn } from '../dyn/eval.js';
import { evalCond } from '../cond/eval.js';
import type { GameState, Effect, EffectCtx, TargetingRef, Condition } from '../types/index.js';
import type { Candidate } from '../types/candidate.js';
import { ATOM_PICK_SPEC, buildShortFormPick } from './atom-pick-spec.js';

type Player = 'self' | 'opp';

/**
 * BUG-161 (fixes the BUG-145 §2-documented over-fire): conditional pre-walk gate guard. A condition is "stable" at initial-walk time iff it does
 * NOT read a binding (ctx.bindings) — i.e. it depends only on board/turn state that exists before the
 * effect runs. Binding-dependent ifs (`bound`/`boundMatchesFilter`, or any $-token nested in args)
 * are set by a prior sequence/chain step (deck-look 「公開→$matched」family), so evalCond would be
 * stale (the binding is undefined during the walk). We recurse through and/or/not so a composite if is
 * stable only if EVERY leaf is stable. Serialized $-token scan catches nested arg refs defensively.
 */
function conditionIfIsStable(cond: Condition): boolean {
  if (!cond || typeof cond !== 'object') return true;
  switch (cond.kind) {
    case 'bound':
    case 'boundMatchesFilter':
      return false;
    case 'not':
      return conditionIfIsStable(cond.c);
    case 'and':
    case 'or':
      return cond.cs.every((c) => conditionIfIsStable(c));
    default: {
      // Defensive: any nested $-token (e.g. a filter referencing $matched.cardId) marks it unstable.
      return !JSON.stringify(cond).includes('$');
    }
  }
}

/**
 * 2026-05-30 BUG-085: atom args の `{ dyn: <expr> }` 値を late-bound 評価して
 * literal (number / string) に確定する。
 *
 * caseDeclaredEvidenceFlip (D08026 / D11021) の
 *   `delta: { dyn: '$cost.flipFaceUpEvidence.count * N' }`
 * を、human-pick 境界 (pendingEffectPick.atomArgs として運ばれる) を越える前に
 * ここで数値化することが目的。境界の先 (useEngineDispatch.effectPickResolve) では
 * costPaid を持つ ctx が再構築されないため、cost 依存 dyn はこのタイミング (= ctx に
 * costPaid が乗っている useDeclaredAbility の resolveEffectPicks 初期 walk) でしか
 * 解決できない。
 *
 * `{ dyn }` 値を持つ atom が現状 caseDeclaredEvidenceFlip のみのため、他カードへの
 * 影響はゼロ (dyn 値が無い args はそのまま同一参照を返す)。
 */
function resolveDynArgs(
  state: GameState,
  args: Record<string, unknown>,
  ctx: EffectCtx,
): Record<string, unknown> {
  let mutated = false;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (
      v !== null &&
      typeof v === 'object' &&
      'dyn' in v &&
      typeof (v as { dyn: unknown }).dyn === 'string'
    ) {
      out[k] = evalDyn(state, (v as { dyn: string }).dyn, ctx);
      mutated = true;
    } else {
      out[k] = v;
    }
  }
  return mutated ? out : args;
}

/**
 * engine拡張 wave#2 cluster12 (nested-filter-dyn, 2026-06-15): pick query の `filter` が
 * 数値フィールドに `{dyn}` を持つ場合 (例: levelMax:{dyn:'$self.fileCount'} の「FILEエリアの
 * 枚数以下のレベル」系イベント) に、列挙 (targetCandidates) の前で `{dyn}` を具体値へ解決する。
 * 背景: buildShortFormPick は `query.filter = a.filter` を frozen card-def への **参照** で代入し、
 * resolveDynArgs は top-level 引数しか歩かないため、未解決のまま candidates.matchOneFilter へ渡ると
 * `level > {dyn-object}` = 常に false となり「レベル上限」が黙って消える (誤挙動・throw ではない)。
 * frozen def を破壊しないよう filter を **clone** してから解決する (in-place mutation 禁止)。
 * dyn を含まない filter は target を同一参照で返すため既存カードは no-op (smoke baseline 不変)。
 * rules: 15-abilities-effects.md (動的値解決) / 17-icons.md §FILE(X) ($self.fileCount は実装済)。
 */
/** 1 つの filter object 内の `{dyn}` 数値フィールドを clone して解決。dyn 不在なら同一参照を返す (no-op)。 */
function resolveFilterDynObj(state: GameState, f: unknown, ctx: EffectCtx): unknown {
  if (f === null || typeof f !== 'object' || Array.isArray(f)) return f;
  const fo = f as Record<string, unknown>;
  let changed = false;
  const nf: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fo)) {
    if (
      v !== null &&
      typeof v === 'object' &&
      'dyn' in v &&
      typeof (v as { dyn: unknown }).dyn === 'string'
    ) {
      nf[k] = evalDyn(state, (v as { dyn: string }).dyn, ctx);
      changed = true;
    } else {
      nf[k] = v;
    }
  }
  return changed ? nf : f;
}

function resolveTargetFilterDyn(
  state: GameState,
  target: { kind?: string; query?: unknown } & Record<string, unknown>,
  ctx: EffectCtx,
): { kind?: string; query?: unknown } & Record<string, unknown> {
  const q = target.query as ({ filter?: unknown; filterAny?: unknown } & Record<string, unknown>) | undefined;
  if (!q || typeof q !== 'object') return target;
  let changed = false;
  // query.filter (単一 TargetFilter)
  let newFilter = q.filter;
  const rf = resolveFilterDynObj(state, q.filter, ctx);
  if (rf !== q.filter) { newFilter = rf; changed = true; }
  // query.filterAny (TargetFilter[]、OR 群) — 各 sub-filter も同様に解決 (filterAny+{dyn} の latent gap 対策)
  let newFilterAny = q.filterAny;
  if (Array.isArray(q.filterAny)) {
    let anyChanged = false;
    const arr = q.filterAny.map((sf) => {
      const rsf = resolveFilterDynObj(state, sf, ctx);
      if (rsf !== sf) anyChanged = true;
      return rsf;
    });
    if (anyChanged) { newFilterAny = arr; changed = true; }
  }
  if (!changed) return target; // dyn 不在 = 同一参照 (既存カード no-op / smoke baseline 不変)
  return { ...target, query: { ...q, filter: newFilter, filterAny: newFilterAny } };
}

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

import {
  pushPendingEffectPickSide, toPlainDeep, _peekPendingEffectChoiceSide, getPendingChoiceResume,
  setPendingChoiceResume, pushPendingEffectChoiceSide, setPendingChoiceBindings,
  pushPendingEffectOptionalSide, setPendingOptionalResume,
} from './pending-state.js';
// Phase 3b: pending管理は pending-state.ts へ分離。旧 public API は barrel 再export で不変 (importer 改変0)。
export {
  _pushPendingEffectPickSideForTest, pushPendingPickFromAtom, toPlainDeep,
  _drainPendingEffectPickSide, _peekPendingEffectPickQueueLength, _clearPendingEffectPickQueue,
  _drainPendingEffectChoiceSide, _clearPendingEffectChoiceSide, _takePendingChoiceBindings,
  _peekPendingEffectChoiceSide, _takePendingChoiceResume, _clearPendingChoiceResume,
  _drainPendingEffectOptionalSide, _clearPendingEffectOptionalSide, _peekPendingEffectOptionalSide,
  _takePendingOptionalResume, _clearPendingOptionalResume,
} from './pending-state.js';
export type {
  ContinuationFrame, PendingEffectPickSide, PendingEffectChoiceSide, PendingEffectOptionalSide,
} from './pending-state.js';

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
  // BUG-078 fix: queue 化したので「既に set 済み」guard は不要。同 sequence 内の連続 PB
  // atom も全て push する (UI が先頭から消化、effectPickResolve のたびに次が drain される)。
  // BUG-077: _fromAtomHandler=true で substituteAtomPick を呼ぶことで、
  // Pattern B でも side-channel set を許可 (初期 walk からの呼出と区別)。
  substituteAtomPick(state, atom, ctx, { ...opts, humanChooser: true, _fromAtomHandler: true });
}

/**
 * 物理動作 atom 短縮形対応: target 未指定 + n: number の verb で既定 pick query を補完。
 * カード DSL では `evidenceToHand({player:'self', n:1})` のように書きたく、target query は
 * verb 既定 (area/side/chooser) を engine が推論する。
 */
// 短縮形の verb → 既定 area マッピングは ATOM_PICK_SPEC (atom-pick-spec.ts) に集約。

function substituteAtomPick(
  state: GameState,
  atom: { kind: 'atom'; verb: unknown; args: unknown },
  ctx: EffectCtx,
  opts: ResolveEffectPicksOpts,
): Effect {
  if (!atom.args || typeof atom.args !== 'object') return atom as Effect;
  const args = atom.args as {
    uid?: unknown; target?: unknown; player?: unknown;
    n?: unknown; max?: unknown; filter?: unknown;
  } & Record<string, unknown>;
  const verbStr = typeof atom.verb === 'string' ? atom.verb : '';
  // 物理動作 atom 短縮形: { player, n or max, filter? } で target 未指定なら
  // verb 既定 area を使って pick query を engine が補完する。
  // - n: number → { min: n, max: n } 固定
  // - max: number → { min: 0, max } 任意 (0 枚 skip 可)
  // - filter → query.filter に pass-through (trait / apMax / levelMax / cardName 等)
  let effectiveTarget = args.target as { kind?: string; query?: unknown; n?: { min?: number; max?: number }; chooser?: Player } | undefined;
  // 短縮形 (PB のみ初期 walk で target 構築。PA は実行時 atom-handler 側で解決): ATOM_PICK_SPEC が権威。
  const sfSpec = ATOM_PICK_SPEC[verbStr];
  if (effectiveTarget === undefined && sfSpec?.mode === 'PB'
    && (typeof args.n === 'number' || typeof args.max === 'number')) {
    const p = (args.player as Player) ?? 'self';
    effectiveTarget = buildShortFormPick(sfSpec.defaultArea, args, p, p) as {
      kind?: string; query?: unknown; n?: { min?: number; max?: number }; chooser?: Player;
    };
  }
  const target = effectiveTarget;
  if (!target || target.kind !== 'pick' || !target.query) {
    // 非 pick atom (uid=$contact.byUid 等で target なし) でも {dyn} arg は literal 化する。
    // 例: D08007 cutin の delta:{dyn:'$self.sceneTrait.少年探偵団 * 1000'} (pick 不在だが dyn 評価が必要)。
    // resolveDynArgs は {dyn} object のみ変換し、それ以外は同一参照を返すため既存 atom は no-op。
    const dynResolved = resolveDynArgs(state, args, ctx);
    if (dynResolved === args) return atom as Effect;
    return { kind: 'atom', verb: atom.verb as never, args: dynResolved } as Effect;
  }

  // BUG-065: 2 つの effect 記述形式を区別して解決:
  //   Pattern A: { uid: '$pick', target: {kind:'pick',...} } (sceneRemove / charModifyAP 等)
  //              → uid を picked.uid に置換、target を drop
  //   Pattern B: { target: {kind:'pick',...} } (uid 不在、discard / evidenceToHand 等)
  //              → target を picked の cardId/uid 配列に置換 (atom-handler は配列を期待)
  const isPatternA = args.uid === '$pick';
  // D08021 driver 2026-05-26: Pattern B was originally restricted to args.uid===undefined
  // (discard / evidenceToHand 等)。charStackCard は uid='$self' を保持し cardIds/target を
  // pick で解決する必要があるため、uid が '$pick' でない全パターンを Pattern B として扱う。
  // 初期 walk (`!_fromAtomHandler`) では Pattern B push は下記 guard で抑止される。
  const isPatternB = !isPatternA;
  if (!isPatternA && !isPatternB) return atom as Effect;

  // cluster12 (nested-filter-dyn): filter 内の {dyn} (levelMax:{dyn:'$self.fileCount'} 等) を
  // 列挙前に具体値へ解決 (frozen def は clone して非破壊)。dyn 不在なら同一参照 = no-op。
  const resolvedTarget = resolveTargetFilterDyn(
    state,
    target as { kind?: string; query?: unknown } & Record<string, unknown>,
    ctx,
  );
  const cands = targetCandidates(state, resolvedTarget as TargetingRef, ctx);
  if (cands.length === 0) {
    // 拡張 5 (chain): no-candidate を chain break 信号として記録 (Phase 3c: ctx.dyn 経由。runtime tryRePickFromAtom
    // 経路では本 ctx = resolver chain ctx と同一参照ゆえ resolver chain case が読む。初期 walk 経路は dead write)
    (ctx.dyn ??= {}).chainStepNoApply = true;
    return atom as Effect; // no-op fallback
  }

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
    // BUG-078 fix: queue 化したので「既に set 済み」guard は不要。複数の awaiting を
    // 全て push し、UI が FIFO で消化する (BUG-075 の上書き問題は queue 化で解消)。
    // BUG-077: Pattern B (uid 不在) は runtime atom-handler の awaiting-pick path で
    // tryRePickFromAtom 経由で push される (正しい state を持つため)。
    // 初期 walk (triggered.ts → resolveEffectPicks) では set を抑止し、後続 step が
    // 先行 step の target を横取りする問題を回避。Pattern A は runtime に awaiting-pick
    // path が無いため、初期 walk でも push 必要 (flag 無視)。
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
    if (cardLikeCands.length === 0) {
      // 拡張 5 (chain): cardLikeCands 0 = pick 不能 → chain break 信号 (Phase 3c: ctx.dyn 経由、同上)
      (ctx.dyn ??= {}).chainStepNoApply = true;
      return atom as Effect;
    }
    const targetRef = target as { n?: { min?: number; max?: number }; query?: { distinctNames?: boolean } };
    pushPendingEffectPickSide({
      player: byPlayer,
      candidates: cardLikeCands,
      atomVerb: verb,
      // BUG-085: { dyn } 値 (例 delta) を costPaid を持つ ctx で literal 化してから
      // pendingEffectPick として human-pick 境界へ運ぶ。
      // BUG-132: deep-plain 化 — runtime 経路 (drafted entry.effect 由来) の nested object が
      // draft proxy のまま produce 境界を跨ぐと次 produce の finalize で revoked-proxy crash。
      atomArgs: toPlainDeep(resolveDynArgs(state, { ...args }, ctx)),
      nMin: targetRef.n?.min ?? 1,
      nMax: targetRef.n?.max ?? 1,
      source: opts.source ?? { cardId: '', abilityId: '' },
      // D08021 driver 2026-05-26: target.query.distinctNames を UI に伝える。
      // CardListModal multi-select で同 name component 衝突候補を click 不可化する。
      distinctNames: targetRef.query?.distinctNames === true,
      // cluster14: atom が skipResolvesAtom:true を持つ場合 (B09010「2枚まで登場」+ 後続 FILE上1リムーブ)、
      //   0枚 decline を applyPickSkipAndContinuation で解決し remainder を実行する (deckRevealUntil と同契約)。
      skipResolvesAtom: (args as { skipResolvesAtom?: boolean }).skipResolvesAtom === true,
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
      // BUG-085: AI / heuristic 経路 (human-pick 境界なし) でも { dyn } を literal 化する。
      args: resolveDynArgs(state, { ...restArgs, uid: picked.uid }, ctx),
    } as Effect;
  }

  // Pattern B: target → cardId/uid 配列に置換 (atom-handler が配列を期待)
  // BUG-077 後続: evidence kind (evidenceToHand 等の AI 経路) も解決対象に含む
  // BUG-103 (D08021): multi-pick contract (cardIds:'$pick.cardIds')。AI 経路では cardIds が
  // 未解決のまま handler に届き awaiting-pick → no-op (stackedCards=0、a2突撃/a3draw/a4evidence が
  // unlock されず CPU の D08021 がバニラ化)。単一 pick の target:[uid] では cardIds を埋められないため、
  // card 候補から最大 max 枚を greedy 選択し cardIds 配列に詰める (heuristic: 取れるだけ取る)。
  if (args.cardIds === '$pick.cardIds') {
    const nMaxC = (target as { n?: { max?: number } } | undefined)?.n?.max ?? cands.length;
    // engine拡張 wave (2026-06-23): evidence kind も AI multi-pick 対象に含める (human path は
    //   BUG-076 で対応済、CPU 側は 'card' kind 限定だった)。evidenceFlipDown「自分の表向き証拠を
    //   N つまで選び裏向き」(B05013) の CPU 解決用。既存 multi-pick (D08021/B09034) は remove/hand
    //   = 'card' kind ゆえ evidence 追加は純 additive (回帰0)。greedy max 枚 (取れるだけ取る)。
    const chosenIds = cands
      .filter((c) => c.kind === 'card' || c.kind === 'evidence')
      .slice(0, nMaxC)
      .map((c) => c.kind === 'evidence'
        ? (state.players[c.player].evidence[c.index]?.cardId ?? '')
        : (c as { cardId: string }).cardId)
      .filter((id) => id !== '');
    // target (pick query) は残す: handler が target.query.area を見て source area (remove 等) から
    // 各 cardId を splice する (落とすと stackedCards は増えるが source に残り複製になる)。
    return {
      kind: 'atom',
      verb: atom.verb as never,
      args: resolveDynArgs(state, { ...args, cardIds: chosenIds }, ctx),
    } as Effect;
  }
  // BUG-106 (D11014 a2 / D11019 a1 driver): single-pick contract (cardId:'$pick.cardId')。
  // sceneEnter のように cardId を pick で解決し、target(pick query) を source-area splice の
  // ために保持する atom。AI 経路で cardId を解決しないと handler が awaiting-pick →
  // tryRePickFromAtom (target が pick-query でない) → silent no-op (reanimate 不発、後続 draw 不発)。
  // human path の effectPickResolve (useEngineDispatch hasCardIdBind) と対称に cardId を解決する。
  if (args.cardId === '$pick.cardId') {
    // 2026-06-04 review(#4): 下の generic Pattern B と同じく evidence kind も解決可能にする
    // (現状 sceneEnter は remove/deck/hand=card kind からのみで evidence 経路は未使用だが、整合のため)。
    const pickedCardId =
      picked.kind === 'card' ? picked.cardId :
      picked.kind === 'char' ? picked.cardId :
      picked.kind === 'evidence' ? (state.players[picked.player].evidence[picked.index]?.cardId ?? null) :
      null;
    if (pickedCardId === null) return atom as Effect;
    // target (pick query) は残す: handler が target.query.area を見て source area (remove 等)
    // から cardId を splice する。drop すると複製 (リムーブに残ったまま登場) になる。
    return {
      kind: 'atom',
      verb: atom.verb as never,
      args: resolveDynArgs(state, { ...args, cardId: pickedCardId }, ctx),
    } as Effect;
  }
  const pickValueOf = (c: (typeof cands)[number]): string | null =>
    c.kind === 'card' ? c.cardId :
    c.kind === 'char' ? c.uid :
    c.kind === 'evidence' ? (state.players[c.player].evidence[c.index]?.cardId ?? null) :
    null;
  // BUG-165 (wave-10 2026-07-02): nMax>1 の generic Pattern B は旧実装が heuristic 先頭 1枚に collapse
  // していた (B04005「手札を2枚リムーブする」が AI 同期 walk で 1枚しか落ちない)。cardIds:'$pick.cardIds'
  // contract (BUG-103) と同流儀で greedy に nMax 枚を target に詰める (「取れるだけ取る」、heuristic の
  // 単一選好は multi では cardIds contract 同様不使用)。nMax<=1 は従来 path byte 不変。
  const nMaxG = (target as { n?: { max?: number } } | undefined)?.n?.max ?? 1;
  if (nMaxG > 1) {
    const pickValues = cands
      .map(pickValueOf)
      .filter((v): v is string => v !== null)
      .slice(0, nMaxG);
    if (pickValues.length === 0) return atom as Effect;
    return {
      kind: 'atom',
      verb: atom.verb as never,
      args: resolveDynArgs(state, { ...args, target: pickValues }, ctx),
    } as Effect;
  }
  const pickValue = pickValueOf(picked);
  if (pickValue === null) return atom as Effect;
  return {
    kind: 'atom',
    verb: atom.verb as never,
    args: resolveDynArgs(state, { ...args, target: [pickValue] }, ctx),
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
    case 'sequence': {
      // BUG-121 (残課題解消): sequence 内で human choice が pause したら、後続 step (remainder) を
      // 再開 holder に wrap して walk を打ち切る。これにより runtime では pre-choice step のみ実行され、
      // choiceResolve 再開時に holder (= {sequence:[choice, ...remainder]}) を再 walk して
      // option + remainder を実行する (pre-choice step の二重実行を防ぐ)。任意深度のネストに対応
      // (内側 sequence が holder を更新済 → 外側はさらに自身の remainder を wrap)。
      const seqOut: Effect[] = [];
      for (let i = 0; i < effect.steps.length; i++) {
        const choiceBefore = _peekPendingEffectChoiceSide() !== null;
        seqOut.push(resolveEffectPicks(state, effect.steps[i]!, ctx, opts));
        const choiceAfter = _peekPendingEffectChoiceSide() !== null;
        if (!choiceBefore && choiceAfter) {
          const remainder = effect.steps.slice(i + 1);
          if (remainder.length > 0) {
            const cur = getPendingChoiceResume();
            if (cur) setPendingChoiceResume({ kind: 'sequence', steps: [cur, ...remainder] });
          }
          return { kind: 'sequence', steps: seqOut };
        }
      }
      return { kind: 'sequence', steps: seqOut };
    }
    case 'parallel':
      return { kind: 'parallel', steps: effect.steps.map((s) => resolveEffectPicks(state, s, ctx, opts)) };
    case 'choice': {
      // BUG-108: ctx.dyn.choiceIndex 指定時は選択 option へ unwrap する (dyn-arg / pick と同様に
      // walk 中に bake)。resolver.run の choice も choiceIndex を読むが、effect は event.queue →
      // entryToCtx で ctx.dyn が落ちるため runtime には届かない。ctx.dyn を保持する resolveEffectPicks
      // (declared-ability / triggered の初期 walk) でここで解決する。
      // 未指定 / 範囲外なら全 option を walk し、resolver.run の default (=0) に委ねる。
      const rawIdx = (ctx.dyn as { choiceIndex?: unknown } | undefined)?.choiceIndex;
      if (
        typeof rawIdx === 'number' && Number.isInteger(rawIdx)
        && rawIdx >= 0 && rawIdx < effect.options.length
      ) {
        // 2026-06-04 review(#5): 消費した choiceIndex は同一 ctx の後続 choice (sequence の別 step)
        // へ leak させない。ctx.dyn は step 間で共有参照のため、消さないと 2 つ目の choice が
        // 前段の index で誤 unwrap する (現状そのようなカードは無いが latent defect の予防)。
        delete (ctx.dyn as { choiceIndex?: unknown }).choiceIndex;
        return resolveEffectPicks(state, effect.options[rawIdx], ctx, opts);
      }
      // BUG-121: human の複数 option choice (chooser=owner 側) は option 0 既定化せず pause し、
      // pendingEffectChoice を surface する。pick と同型: side-channel に積み、effect は no-op
      // (空 parallel) を返して runtime に届けない (どの option も実行しない)。choiceResolve dispatch
      // 後に applyChoiceAndContinuation が readDef から元 effect を復元し choiceIndex 付きで再 walk する。
      //   - choiceIndex 指定済 (declared 経路) は上の unwrap 分岐で処理済 → ここに来ない (無傷)
      //   - humanChooser=false (AI / hirameki) は従来通り全 walk → resolver.run default 0 (無傷)
      //   - options.length===1 (構造的単一 choice: B02046/B04071/D11014 等) は従来通り (無傷)
      //   - chooser==='opp' (相手が選ぶ) は human modal に出さない (従来通り)
      if (
        opts.humanChooser === true
        && effect.options.length > 1
        && effect.chooser !== 'opp'
      ) {
        const srcUid = (ctx.source as { uid?: string } | undefined)?.uid ?? '';
        pushPendingEffectChoiceSide({
          player: opts.byPlayer ?? 'self',
          source: {
            cardId: opts.source?.cardId ?? '',
            abilityId: opts.source?.abilityId ?? '',
            uid: srcUid,
          },
          options: effect.options.map((o, i) => ({
            index: i,
            verb: o.kind === 'atom' ? (o.verb as string) : undefined,
            args: o.kind === 'atom' ? (o.args as Record<string, unknown>) : undefined,
          })),
        });
        // 再開 holder = この choice 効果そのもの (top-level)。sequence 内なら sequence case が
        // 後で {sequence:[choice, ...remainder]} に wrap する (pre-choice step 二重実行防止)。
        setPendingChoiceResume(effect);
        // BUG-114: surface 時の ctx.bindings (cutin の $contact.byUid 等) を保持し、resume ctx へ復元する。
        setPendingChoiceBindings({ ...(ctx.bindings as Record<string, unknown>) });
        return { kind: 'parallel', steps: [] };
      }
      return {
        kind: 'choice',
        chooser: effect.chooser,
        options: effect.options.map((o) => resolveEffectPicks(state, o, ctx, opts)),
      };
    }
    case 'optional': {
      // 2026-06-06 タスクC: optional 決定の配線 (choice の boolean 版)。
      //   - ctx.dyn.optionalRun 指定済 (optionalResolve 再開) → その値で確定 (consume 後 delete で leak 防止)。
      //   - humanChooser → pendingEffectOptional を surface して pause (no-op return)。
      //   - AI / non-human → skip (optional は自己コストを含むことが多く既定で使わない)。
      const dynRun = (ctx.dyn as { optionalRun?: unknown } | undefined)?.optionalRun;
      if (typeof dynRun === 'boolean') {
        // 消費した optionalRun は同一 ctx の後続/ネスト optional へ leak させない (choiceIndex と同方針)
        delete (ctx.dyn as { optionalRun?: unknown }).optionalRun;
        return dynRun
          ? resolveEffectPicks(state, effect.effect, ctx, opts)
          : { kind: 'parallel', steps: [] };
      }
      if (opts.humanChooser === true) {
        const srcUid = (ctx.source as { uid?: string } | undefined)?.uid ?? '';
        pushPendingEffectOptionalSide({
          player: opts.byPlayer ?? 'self',
          source: {
            cardId: opts.source?.cardId ?? '',
            abilityId: opts.source?.abilityId ?? '',
            uid: srcUid,
          },
          // 再開 ctx で $trigger.<field> を解決できるよう triggerPayload を保持 (B03038)
          triggerPayload: (ctx as { triggerPayload?: unknown }).triggerPayload,
        });
        // 再開 holder = この optional 効果そのもの (optionalResolve 後に再 walk)。
        setPendingOptionalResume(effect);
        return { kind: 'parallel', steps: [] };
      }
      // AI / non-human: skip (resolver の optionalRun 未設定 default と同じ。surface しない)
      return { kind: 'parallel', steps: [] };
    }
    case 'conditional': {
      // BUG-161 fix (binding-aware, BUG-145 §2 の over-fire 根治): a choice/optional/$pick in the NON-taken branch must not
      // eager-surface a pendingEffectChoice/Optional/Pick. We gate the pre-walk on evalCond and walk
      // ONLY the taken branch — BUT ONLY when `if` is STABLE at pre-walk time (does not depend on a
      // binding set by a prior sequence/chain step). For binding-dependent `if` (deck-look 「公開→
      // $matched→…の場合」family: B06048/B01048/B08020/… steps[N>0]), `$matched`/`$revealed` are not
      // yet bound during the initial walk, so evalCond would be stale-FALSE and wrongly suppress a
      // then-branch that runtime WILL execute (regression: discard/handAdd never resolves). For those
      // we keep walking BOTH branches (current behavior, byte-compatible). Runtime resolver.ts re-evals
      // `if` against the live state and runs only the correct branch either way (double-eval safe:
      // same state+ctx for stable `if`; for binding `if` runtime is the source of truth).
      if (conditionIfIsStable(effect.if)) {
        const taken = evalCond(state, effect.if, ctx);
        return {
          kind: 'conditional',
          if: effect.if,
          then: taken ? resolveEffectPicks(state, effect.then, ctx, opts) : effect.then,
          else: effect.else
            ? (taken ? effect.else : resolveEffectPicks(state, effect.else, ctx, opts))
            : undefined,
        };
      }
      return {
        kind: 'conditional',
        if: effect.if,
        then: resolveEffectPicks(state, effect.then, ctx, opts),
        else: effect.else ? resolveEffectPicks(state, effect.else, ctx, opts) : undefined,
      };
    }
    case 'forEach':
      // forEach は over の各候補で do を実行する dynamic 構造。$pick は do 内に出ない想定だが
      // 念のため再帰 (do 自体が atom-with-$pick になることはないが、ネスト構造はあり得る)
      return { kind: 'forEach', over: effect.over, do: resolveEffectPicks(state, effect.do, ctx, opts) };
    case 'replace':
      return { kind: 'replace', trigger: effect.trigger, with: resolveEffectPicks(state, effect.with, ctx, opts) };
    case 'chain':
    case 'negate':
    case 'custom':
      // pre-walk passthrough (un-walked, 参照同一の effect をそのまま返す)。chain の step 内 atom $pick は
      // dispatch 時 (resolver.ts:78 chain case → run(step) → atom-handler tryRePickFromAtom) に解決されるため、
      // ここで pre-walk しなくても drop しない。出荷カードに choice/optional を step に持つ chain は 0 件
      // (Phase 3g 設計レビュー: ALL_CARDS object-walk で実証)。negate/custom は walk 対象の sub-effect を持たない。
      // ※将来 chain step に choice/optional を持つカードが出たら、ここを sequence と同様に walk する必要がある (BUG-152 latent)。
      return effect;
    default: {
      // Phase 3g: Effect union (11 member) の member 脱落を compile-time 検出 (noImplicitReturns 無効ゆえ
      // silent passthrough を塞ぐ)。全 member を明示 case 化したため到達不能。throw ではなく void+return 変種 —
      // 本関数は produce() try 外 (ai/policy.ts:419-423、applyMove→declared-ability:199 経由) から到達するため、
      // 将来到達可能化した際に throw だと stepTurn を貫通する (Phase 3e/3f と同判断)。sibling の resolver.ts:174 が
      // throw なのは run() が dispatch sink で未処理 kind = 実バグ (loud fail) ゆえの正当な非対称。
      const _exhaustive: never = effect;
      void _exhaustive;
      return effect;
    }
  }
}
