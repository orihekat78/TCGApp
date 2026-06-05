// engine.effect.apply-pick — pending effect-pick の解決 + continuation 実行を一箇所に集約。
//
// rules: 15-abilities-effects.md (効果解決順) / 21-declared-ability-cost.md
// spec: BUG-054/065 (pattern A/B substitute) / BUG-107 (continuation の bind 共有) / BUG-109 (AI drain)
//
// 設計:
//   - `applyPickAndContinuation` は「pick 解決した atom を build → 中断中 sequence/chain の保存 ctx で
//     runEffect 実行 → continuation remainder を同一 ctx で実行」を行う。human (useEngineDispatch.
//     effectPickResolve) と AI (drainAiEffectPicks) の **共通実体**。store / skip / 候補選択は呼出側。
//   - `drainAiEffectPicks` は __pendingEffectPickQueue を heuristic で順次解決する (CPU 経路には
//     human modal が無いため、PA 短縮形 atom の pick が drain されず no-op になる BUG-109 を解消)。

import type { GameState, Effect, EffectCtx, Candidate } from '../types/index.js';
import type { PendingEffectPickSide, PendingEffectChoiceSide } from './resolve-picks.js';
import { resolveEffectPicks, _takePendingChoiceResume } from './resolve-picks.js';

type Player = 'self' | 'opp';
import { run as runEffect } from './resolver.js';
import { runAllUntilEmpty } from '../resolve/index.js';
import { event } from '../event/index.js';

type ChainContEntry = { remainder: Effect[]; ctx: EffectCtx };

/**
 * pick uid → cardId 逆引き。`evidence:side:idx` / `cardId#idx` / snapshot fallback に対応。
 * (旧 useEngineDispatch ローカル。BUG-109 で engine 側へ移し human/AI 共有。)
 * Pattern A (uid='$pick' / scene char uid) は本関数を呼ばない経路。
 */
export function resolveCardIdFromPickUid(
  uid: string,
  state: GameState | null,
  pending: { candidates: ReadonlyArray<{ uid: string; cardId: string }> },
): string | null {
  if (!state) {
    return pending.candidates.find((c) => c.uid === uid)?.cardId ?? null;
  }
  const ev = uid.match(/^evidence:(self|opp):(\d+)$/);
  if (ev) {
    const side = ev[1] as 'self' | 'opp';
    const idx = parseInt(ev[2]!, 10);
    return state.players[side]?.evidence?.[idx]?.cardId ?? null;
  }
  const ch = uid.match(/^([^#]+)#\d+$/);
  if (ch) return ch[1] ?? null;
  return pending.candidates.find((c) => c.uid === uid)?.cardId ?? null;
}

/**
 * pending pick を pickedUid(s) で解決し、保存された sequence/chain continuation があれば
 * **同一 ctx** で remainder を実行する (BUG-107: bind を step 間で共有)。
 * 呼出側は skip (pickedUid=null) を事前処理し、queue から該当 pending を取り除いておくこと。
 */
export function applyPickAndContinuation(
  state: GameState,
  pending: PendingEffectPickSide,
  pickedUid: string,
  pickedUids?: string[],
  switchRemoveUid?: string,
): void {
  // ---- resolved atom を build (Pattern A: uid='$pick' → uid 置換 / Pattern B: cardId(s)/target 置換) ----
  const pendingArgs = pending.atomArgs as { uid?: unknown };
  const isPatternA = pendingArgs.uid === '$pick';
  let resolvedAtom: Effect;
  if (isPatternA) {
    const { target: _omit, ...restArgs } = pending.atomArgs;
    void _omit;
    // engine-extension #3 (2026-06-05): multi-target Pattern A
    // pickedUids が複数なら各 uid に atom を per-char 適用する sequence にまとめる。
    // 単一なら従来通り (sequence wrap せずに atom のまま runEffect / event.queue)。
    const uids = (pickedUids && pickedUids.length > 1) ? pickedUids : [pickedUid];
    if (uids.length === 1) {
      resolvedAtom = { kind: 'atom', verb: pending.atomVerb as never, args: { ...restArgs, uid: uids[0]! } };
    } else {
      const atoms: Effect[] = uids.map((u) => ({
        kind: 'atom' as const,
        verb: pending.atomVerb as never,
        args: { ...restArgs, uid: u },
      }));
      resolvedAtom = { kind: 'sequence', steps: atoms };
    }
  } else {
    const resolvedCardId = resolveCardIdFromPickUid(pickedUid, state, pending);
    if (!resolvedCardId) return; // 想定外、防御スキップ
    const hasCardIdBind = (pending.atomArgs as { cardId?: unknown }).cardId === '$pick.cardId';
    const hasCardIdsBind = (pending.atomArgs as { cardIds?: unknown }).cardIds === '$pick.cardIds';
    const allUids: string[] = pickedUids ?? [pickedUid];
    const allCardIds: string[] = allUids
      .map((u) => resolveCardIdFromPickUid(u, state, pending))
      .filter((c): c is string => typeof c === 'string');
    // switch-on-effect-enter: sceneEnter が現場満杯のとき UI が収集した switchRemoveUid を
    // 解決済 atom args に載せる (handler が switchEnter する)。他 atom には影響しない (未指定なら付かない)。
    const switchPart = switchRemoveUid ? { switchRemoveUid } : {};
    const newArgs: Record<string, unknown> = hasCardIdsBind
      ? { ...pending.atomArgs, cardIds: allCardIds, ...switchPart } // target は元の pick query を保持
      : hasCardIdBind
        ? { ...pending.atomArgs, cardId: resolvedCardId, ...switchPart } // target は元の pick query を保持
        : { ...pending.atomArgs, target: [resolvedCardId], ...switchPart }; // 従来 pattern (handAddFromRemove 等)
    resolvedAtom = { kind: 'atom', verb: pending.atomVerb as never, args: newArgs };
  }

  // ---- continuation (中断中 sequence/chain の残り step) を保存 ctx で実行 ----
  const chainG = globalThis as { __pendingChainContinuation?: ChainContEntry[] };
  const chainCont = chainG.__pendingChainContinuation?.[0]; // peek
  if (chainCont) {
    // BUG-107: resolved atom と remainder を同一保存 ctx で runEffect → plain bindings を共有
    // (event.queue 経由は entry.bindings が Immer draft に取り込まれ bind が消えるため不可)。
    runEffect(state, resolvedAtom as never, chainCont.ctx);
    runAllUntilEmpty(state);
    chainG.__pendingChainContinuation!.shift();
    const remainderEffect: Effect = chainCont.remainder.length === 1
      ? chainCont.remainder[0]!
      : { kind: 'chain', steps: chainCont.remainder };
    runEffect(state, remainderEffect as never, chainCont.ctx);
    runAllUntilEmpty(state);
  } else {
    event.queue(
      state,
      resolvedAtom as never,
      { player: pending.player, cardId: pending.source.cardId },
      'effect:pick-resolved',
      { picked: pickedUid, source: pending.source },
    );
    runAllUntilEmpty(state);
  }
}

/**
 * BUG-121: pending choice を choiceIndex で解決し、選択 option を再開する。
 * applyPickAndContinuation の choice 版。再開すべき effect は resolve-picks の engine holder
 * (__pendingEffectChoiceResume) から取り出す:
 *   - top-level choice (B06007): holder = choice 効果そのもの → unwrap で選択 option が返る。
 *   - sequence 内 choice: holder = {sequence:[choice, ...remainder]} → option + remainder のみ実行
 *     (pre-choice step は初回 runtime で実行済のため二重実行しない)。
 * choiceIndex 付きで resolveEffectPicks 再 walk → choice unwrap。選択 option 内に $pick
 * (例 B06007 option2 sceneToHand 短縮形) があれば humanChooser walk で __pendingEffectPickQueue に
 * 再 push され、既存 effectPickResolve 経路で連鎖消化される。
 */
export function applyChoiceAndContinuation(
  state: GameState,
  pending: PendingEffectChoiceSide,
  choiceIndex: number,
): void {
  const resumeEffect = _takePendingChoiceResume();
  if (!resumeEffect) return;
  // 再 walk 用 ctx (triggered.ts の resolveCtx と同 shape の plain object、Immer draft 非由来)。
  // source.uid は option1 (charGrantKeyword uid:'$self') の $self 解決 + event.queue source に使用。
  const ctx: EffectCtx = {
    source: {
      cardId: pending.source.cardId,
      uid: pending.source.uid,
      abilityId: pending.source.abilityId,
      player: pending.player,
      area: 'scene',
    },
    bindings: {},
    dyn: { choiceIndex },
  };
  const resolved = resolveEffectPicks(state, resumeEffect, ctx, {
    byPlayer: pending.player,
    humanChooser: true,
    source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId },
  });
  event.queue(
    state,
    resolved as never,
    { player: pending.player, uid: pending.source.uid, cardId: pending.source.cardId },
    'effect:choice-resolved',
    { choiceIndex, source: { cardId: pending.source.cardId, abilityId: pending.source.abilityId } },
  );
  runAllUntilEmpty(state);
}

/** AI 経路の pick 候補選択 (PA char pick は policy.chooseAtomTarget、それ以外 / fallback は先頭採用)。 */
type AtomTargetChooser = (
  state: GameState,
  verb: string,
  args: Readonly<Record<string, unknown>>,
  cands: ReadonlyArray<Candidate>,
  byPlayer: Player,
) => Candidate | null;

function chooseAiPick(
  state: GameState,
  pending: PendingEffectPickSide,
  policy?: { chooseAtomTarget?: AtomTargetChooser },
): { pickedUid: string | null; pickedUids?: string[] } {
  const cands = pending.candidates;
  if (cands.length === 0) return { pickedUid: null };
  // PA char pick 用に Candidate(kind:'char') を再構築して heuristic に渡す。
  // (非 char verb は chooseAtomTarget が null を返し先頭採用 fallback されるため安全。)
  const charCands: Candidate[] = cands.map(
    (c) => ({ kind: 'char', uid: c.uid, cardId: c.cardId, player: c.player }) as unknown as Candidate,
  );
  const chosen = policy?.chooseAtomTarget?.(state, pending.atomVerb, pending.atomArgs, charCands, pending.player);
  // chosen は kind:'char' (uid あり) のみ渡しているため uid を持つが、Candidate union 上は narrow 不能 → cast。
  const pickedUid = (chosen as { uid?: string } | null | undefined)?.uid ?? cands[0]!.uid;
  if (pending.nMax > 1) {
    // multi-pick: greedy に nMax まで取る (取れるだけ取る heuristic、resolve-picks の cardIds 経路と整合)
    return { pickedUid, pickedUids: cands.slice(0, pending.nMax).map((c) => c.uid) };
  }
  return { pickedUid };
}

/**
 * AI/CPU 経路で __pendingEffectPickQueue を順次 drain する。PA 短縮形 atom 等が runtime に
 * tryRePickFromAtom で積んだ pick を heuristic 解決し、continuation も進める (BUG-109)。
 * policy.playTurn が applyMove + runAllUntilEmpty 後に呼ぶ (human modal を持たない側の補完)。
 */
export function drainAiEffectPicks(
  state: GameState,
  policy?: { chooseAtomTarget?: AtomTargetChooser },
): void {
  const g = globalThis as {
    __pendingEffectPickQueue?: PendingEffectPickSide[];
    __pendingChainContinuation?: ChainContEntry[];
  };
  let guard = 0;
  while ((g.__pendingEffectPickQueue?.length ?? 0) > 0) {
    if (++guard > 64) break; // 安全弁 (1 ターンの pick 数が 64 を超えることは無い)
    const pending = g.__pendingEffectPickQueue!.shift()!; // 解決対象を queue から取り出す
    const { pickedUid, pickedUids } = chooseAiPick(state, pending, policy);
    if (pickedUid === null) {
      // 候補 0 → skip (step が applied されないので対の continuation も drop)。
      // 2026-06-04 review(#1): queue 済 pick は必ず候補≥1 で push される (resolve-picks の
      // cardLikeCands.length>0 guard) ため本 path は実質到達不能。防御的に continuation が
      // 存在する場合のみ shift する。pick↔continuation の厳密 1:1 化は BUG-111 (multi-step desync) で別途。
      if ((g.__pendingChainContinuation?.length ?? 0) > 0) g.__pendingChainContinuation!.shift();
      continue;
    }
    applyPickAndContinuation(state, pending, pickedUid, pickedUids);
  }
}
