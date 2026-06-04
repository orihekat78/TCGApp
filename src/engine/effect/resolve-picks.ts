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
import type { GameState, Effect, EffectCtx, TargetingRef } from '../types/index.js';
import type { Candidate } from '../types/candidate.js';
import { ATOM_PICK_SPEC, buildShortFormPick } from './atom-pick-spec.js';

type Player = 'self' | 'opp';

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

// user_request 20260522_01 #6 BUG-054 + BUG-078 (queue 化): human pick の側チャネル。
// BUG-078 fix: 単一スロットから FIFO queue に変更。sequence 内に複数 PB pick atom がある
// 場合 (D08013 a1 step 2 evidenceToHand → step 3 discard 等)、初回 drain で両方を push し、
// effectPickResolve dispatch ごとに先頭を shift して順次 UI に出す。
declare global {
  // eslint-disable-next-line no-var
  var __pendingEffectPickQueue: PendingEffectPickSide[] | undefined;
  // Legacy backward-compat: 旧コード/テストが queue[0] を読む時の互換 property。
  // 書き込み (`= null`) しても queue は変わらないため、cleanup は
  // `_clearPendingEffectPickQueue()` を使うこと。
  // eslint-disable-next-line no-var
  var __pendingEffectPickSide: PendingEffectPickSide | null | undefined;
  // 拡張 5 (chain): substituteAtomPick で humanChooser 候補 0 件のとき true を set。
  // resolver chain case が step 後に check して、true なら chain break。
  // eslint-disable-next-line no-var
  var __chainStepNoApply: boolean | undefined;
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
  /**
   * D08021 driver 2026-05-26: target.query.distinctNames を UI に渡すための flag。
   * true なら UI multi-select で「同じ name component (rules/19 分割名展開後) を持つ
   * 既選択カードと衝突する候補」を click 不可化する。
   */
  distinctNames?: boolean;
};

function getPendingQueue(): PendingEffectPickSide[] {
  const g = globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] };
  if (!g.__pendingEffectPickQueue) g.__pendingEffectPickQueue = [];
  return g.__pendingEffectPickQueue;
}

/** 旧 single-slot property を queue[0] に同期 (テスト等の backward compat) */
function syncLegacyPickProperty(): void {
  const q = getPendingQueue();
  (globalThis as { __pendingEffectPickSide?: PendingEffectPickSide | null }).__pendingEffectPickSide = q[0] ?? null;
}

function pushPendingEffectPickSide(v: PendingEffectPickSide): void {
  getPendingQueue().push(v);
  syncLegacyPickProperty();
}

/** test fixture / 内部 caller 用: queue に直接 push する公開ヘルパ */
export function _pushPendingEffectPickSideForTest(v: PendingEffectPickSide): void {
  pushPendingEffectPickSide(v);
}

/** dispatch 経由で UI 側 store に転送するための drain ヘルパ。FIFO 先頭を 1 件取り出す。 */
export function _drainPendingEffectPickSide(): PendingEffectPickSide | null {
  const q = getPendingQueue();
  const v = q.shift() ?? null;
  syncLegacyPickProperty();
  return v;
}

/** queue の長さを確認するヘルパ (テスト/UI 用) */
export function _peekPendingEffectPickQueueLength(): number {
  return getPendingQueue().length;
}

/** queue を全クリア (テスト用 / セッション初期化用) */
export function _clearPendingEffectPickQueue(): void {
  const g = globalThis as { __pendingEffectPickQueue?: PendingEffectPickSide[] };
  g.__pendingEffectPickQueue = [];
  syncLegacyPickProperty();
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

  const cands = targetCandidates(state, target as TargetingRef, ctx);
  if (cands.length === 0) {
    // 拡張 5 (chain): no-candidate を chain break 信号として記録
    (globalThis as { __chainStepNoApply?: boolean }).__chainStepNoApply = true;
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
      // 拡張 5 (chain): cardLikeCands 0 = pick 不能 → chain break 信号
      (globalThis as { __chainStepNoApply?: boolean }).__chainStepNoApply = true;
      return atom as Effect;
    }
    const targetRef = target as { n?: { min?: number; max?: number }; query?: { distinctNames?: boolean } };
    pushPendingEffectPickSide({
      player: byPlayer,
      candidates: cardLikeCands,
      atomVerb: verb,
      // BUG-085: { dyn } 値 (例 delta) を costPaid を持つ ctx で literal 化してから
      // pendingEffectPick として human-pick 境界へ運ぶ。
      atomArgs: resolveDynArgs(state, { ...args }, ctx),
      nMin: targetRef.n?.min ?? 1,
      nMax: targetRef.n?.max ?? 1,
      source: opts.source ?? { cardId: '', abilityId: '' },
      // D08021 driver 2026-05-26: target.query.distinctNames を UI に伝える。
      // CardListModal multi-select で同 name component 衝突候補を click 不可化する。
      distinctNames: targetRef.query?.distinctNames === true,
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
    const chosenIds = cands
      .filter((c) => c.kind === 'card')
      .slice(0, nMaxC)
      .map((c) => (c as { cardId: string }).cardId);
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
  const pickValue =
    picked.kind === 'card' ? picked.cardId :
    picked.kind === 'char' ? picked.uid :
    picked.kind === 'evidence' ? (state.players[picked.player].evidence[picked.index]?.cardId ?? null) :
    null;
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
    case 'sequence':
      return { kind: 'sequence', steps: effect.steps.map((s) => resolveEffectPicks(state, s, ctx, opts)) };
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
      return {
        kind: 'choice',
        chooser: effect.chooser,
        options: effect.options.map((o) => resolveEffectPicks(state, o, ctx, opts)),
      };
    }
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
