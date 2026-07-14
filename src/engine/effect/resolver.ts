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
import type { ContinuationFrame } from './resolve-picks.js';
import { runAtom } from './atom-handlers.js';
import { char as charMutator } from '../mutate/char.js'; // W6 step6 (r79): _mrSelectCharUids タグ書込
import { evalCond } from '../cond/eval.js';
import { resolveEffectPicks } from './resolve-picks.js';
import { resolve as resolveTarget } from '../target/resolve.js';
import { resolveBindRef } from './atom-handlers/_shared.js';
import { _peekPendingEffectRepeatOptionalSide, pushPendingEffectRepeatOptionalSide, setPendingEffectRepeatOptionalRemainder, pushPendingRpsSide, setPendingRpsResume, pushPendingSetCardChoiceSide, setPendingSetCardChoiceResume, setPendingSetCardChoiceRemainder, type RpsHand } from './pending-state.js';

/**
 * BUG-111 family (continuation-nest, 2026-06-22): 中断 pick に continuation frame を連結する。
 * 既存 continuation があれば **上書きせず** outer 連結の末尾に append する。
 * これにより `sequence[chain[pausing-pick, step2], step3]` で chain (内側) が step2 を同梱した後、
 * 親 sequence (外側) が step3 を append でき、head=内側 → outer=外側 の順に実行される。
 * 単一 frame (outer 無し) は従来 (BUG-111 #1/#2) と byte 互換。
 */
function attachContinuation(pick: { continuation?: ContinuationFrame }, frame: ContinuationFrame): void {
  if (!pick.continuation) {
    pick.continuation = frame;
    return;
  }
  let tail = pick.continuation;
  while (tail.outer) tail = tail.outer;
  tail.outer = frame;
}

/**
 * Effect Descriptor を解釈・実行する。
 * Immer draft 内 (produce のコールバック) で呼ぶこと。
 */
export function run(state: GameState, eff: Effect, ctx: EffectCtx): void {
  switch (eff.kind) {
    case 'sequence': {
      // BUG-105: pick await で一時停止し、残り step を pick 本体 (pending.continuation) に同梱する
      // (BUG-111 で別 FIFO __pendingChainContinuation から移行 = 1:1)。chain と同型。ただし no-apply-break
      // はしない = 各 step は独立。pick を含む step の後段が
      // pick 解決前の盤面で評価される不具合 (D08024 step2 AP対象 / D11020 step2 条件 / D11014 step3 draw) を修正。
      // 注: pick を持たない step のみの sequence は queue 長が増えず従来通り一括実行 (動作不変)。
      const gSeq = globalThis as {
        __pendingEffectPickQueue?: { continuation?: ContinuationFrame }[];
      };
      for (let i = 0; i < eff.steps.length; i++) {
        const repeatBefore = _peekPendingEffectRepeatOptionalSide() !== null;
        const qBefore = gSeq.__pendingEffectPickQueue?.length ?? 0;
        run(state, eff.steps[i]!, ctx);
        if (ctx.dyn?.rpsPending === true || ctx.dyn?.setCardChoicePending === true) {
          if (ctx.dyn.setCardChoicePending === true) setPendingSetCardChoiceRemainder(eff.steps.slice(i + 1), 'sequence');
          delete ctx.dyn.rpsPending;
          delete ctx.dyn.setCardChoicePending;
          return;
        }
        const repeatAfter = _peekPendingEffectRepeatOptionalSide() !== null;
        if (!repeatBefore && repeatAfter) { setPendingEffectRepeatOptionalRemainder(eff.steps.slice(i + 1)); return; }
        const qAfter = gSeq.__pendingEffectPickQueue?.length ?? 0;
        if (qAfter > qBefore) {
          const remainder = eff.steps.slice(i + 1);
          if (remainder.length > 0) {
            // BUG-111: continuation を「この step で enqueue された最初の pick」本体に同梱 (別 FIFO 廃止 → 1:1)。
            // BUG-111 family (nest): 内側 (chain) が既に同梱済なら上書きせず outer に append する。
            const firstNew = gSeq.__pendingEffectPickQueue?.[qBefore];
            if (firstNew) attachContinuation(firstNew, { remainder, ctx, kind: 'sequence' });
          }
          return; // sequence 一時停止 (pick 解決後に continuation で残り step が post-pick 盤面で実行)
        }
      }
      return;
    }
    // 拡張 5 (D08003 driver): 公式テキスト「そうした場合」 semantics。
    // step N の実効果あり (= pick 不可で no-op でない) のとき N+1 を実行。
    // pick await 時は残りを「enqueue された pick 本体」の `continuation` に同梱し (BUG-111)、
    // effectPickResolve / drainAiEffectPicks が pick 解決時に実行する。
    case 'chain': {
      const g = globalThis as {
        __pendingEffectPickQueue?: { continuation?: ContinuationFrame }[];
      };
      for (let i = 0; i < eff.steps.length; i++) {
        const step = eff.steps[i]!;
        // Phase 3c (2026-06-22): chain step の no-apply 信号を globalThis __chainStepNoApply から ctx.dyn へ移設。
        // ctx は本 run() tree の全 child run()/runAtom に同一参照で素通しされるため、atom-handler /
        // resolve-picks (tryRePickFromAtom 経由) が同一 ctx に立てた値を本ループが読む (intra-produce)。
        (ctx.dyn ??= {}).chainStepNoApply = false;
        const queueLenBefore = g.__pendingEffectPickQueue?.length ?? 0;
        run(state, step, ctx);
        if (ctx.dyn?.rpsPending === true || ctx.dyn?.setCardChoicePending === true) {
          if (ctx.dyn.setCardChoicePending === true) setPendingSetCardChoiceRemainder(eff.steps.slice(i + 1), 'chain');
          delete ctx.dyn.rpsPending;
          delete ctx.dyn.setCardChoicePending;
          return;
        }
        const queueLenAfter = g.__pendingEffectPickQueue?.length ?? 0;
        if (queueLenAfter > queueLenBefore) {
          // step が pick await → 残り step を「この step で enqueue された最初の pick」本体に同梱 (BUG-111)
          // BUG-111 family (nest): 既存 continuation があれば上書きせず outer に append する。
          const remainder = eff.steps.slice(i + 1);
          if (remainder.length > 0) {
            const firstNew = g.__pendingEffectPickQueue?.[queueLenBefore];
            if (firstNew) attachContinuation(firstNew, { remainder, ctx, kind: 'chain' });
          }
          return; // chain 一時停止
        }
        if (ctx.dyn?.chainStepNoApply) {
          // step が no-candidate → chain break (以降 skip)
          return;
        }
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
    case 'repeatOptional': {
      const human = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      if (human !== ctx.source.player) return;
      pushPendingEffectRepeatOptionalSide({ player: ctx.source.player, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '', uid: ctx.source.uid ?? '' }, remaining: eff.max }, { body: eff.body, remaining: eff.max, ctx, remainder: [] });
      return;
    }
    case 'traitChoice':
      // Resolved during pre-walk. Runtime fallback is intentionally inert.
      return;
    case 'rps': {
      const hands: RpsHand[] = ['rock', 'paper', 'scissors'];
      const human = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      const owner = ctx.source.player;
      const wins = (a: RpsHand, b: RpsHand): boolean =>
        (a === 'rock' && b === 'scissors') || (a === 'paper' && b === 'rock') || (a === 'scissors' && b === 'paper');
      const randomHand = (): RpsHand => hands[Math.floor(Math.random() * hands.length)]!;
      if (human === null) {
        const ownerHand = randomHand();
        let otherHand = randomHand();
        while (ownerHand === otherHand) otherHand = randomHand();
        const branch = wins(ownerHand, otherHand) ? eff.win : eff.lose;
        run(state, resolveEffectPicks(state, branch, ctx, { byPlayer: owner, humanChooser: false }), ctx);
        return;
      }
      const aiHand = randomHand();
      pushPendingRpsSide({
        player: human,
        ownerPlayer: owner,
        aiHand,
        source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '', uid: ctx.source.uid ?? '' },
      });
      setPendingRpsResume(eff, { ...(ctx.bindings as Record<string, unknown>) });
      (ctx.dyn ??= {}).rpsPending = true;
      return;
    }
    case 'setCardToEvidence': {
      const hostUid = resolveBindRef(eff.hostUid, ctx) as string;
      if (typeof hostUid !== 'string' || hostUid.startsWith('$')) { (ctx.dyn ??= {}).chainStepNoApply = true; return; }
      charMutator.ensureSetCardInstanceIds(state);
      const host = (['self', 'opp'] as const).flatMap((player) => state.players[player].scene.map((char) => ({ player, char }))).find(({ char }) => char.uid === hostUid);
      if (!host || host.char.setCards.length === 0) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        return;
      }
      const human = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
      if (human !== ctx.source.player) {
        const entry = host.char.setCards[host.char.setCards.length - 1]!;
        const moved = charMutator.takeOneSetCard(state, hostUid, entry.instanceId ?? '');
        if (!moved) { (ctx.dyn ??= {}).chainStepNoApply = true; return; }
        state.players[moved.player].evidence.push({ cardId: moved.cardId, faceUp: true, origin: { turn: state.turn.number, via: 'effect', sourceCardId: ctx.source.cardId } });
        return;
      }
      const entries = host.char.setCards.map((entry, index) => ({ instanceId: entry.instanceId ?? '', ordinal: index + 1 })).filter((entry) => entry.instanceId !== '');
      if (entries.length === 0) { (ctx.dyn ??= {}).chainStepNoApply = true; return; }
      pushPendingSetCardChoiceSide({ player: human, hostUid, entries, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '', uid: ctx.source.uid ?? '' } });
      setPendingSetCardChoiceResume(eff, { ...(ctx.bindings as Record<string, unknown>) });
      (ctx.dyn ??= {}).setCardChoicePending = true;
      return;
    }
    case 'replace':
    case 'negate':
      throw new Error(
        'replace/negate are immediate-resolution; not runnable via effect.run — see resolver stack handling',
      );
    case 'atom': {
      // mega-wave W6 step6 (2026-07-04, r79/B08014): MR の「選ぶ」効果で解決された現場キャラへ
      // selectedByOwnMr を実行 **前** に記録する (atom 自体が対象を移動/除去しても標識は先に立つ)。
      // _mrSelectCharUids は resolve-picks (AI 同期 walk) / apply-pick (human 継続) の両 pick 経路が
      // source card = MR の時のみ付与する informational field — 既存カードには存在しない → property
      // 不在 1 判定のみのゼロコスト素通し (全 atom 共有 dispatch ゆえ blast radius 最小化)。
      // owner guard = ctx.source.player (「**自分の**MRの能力」— 相手 MR による選択は数えない)。
      const w6MrUids = (eff.args as Record<string, unknown> | undefined)?.['_mrSelectCharUids'];
      if (Array.isArray(w6MrUids) && w6MrUids.length > 0) {
        for (const u of w6MrUids) {
          if (typeof u === 'string') charMutator.tagSelectedByOwnMr(state, u, ctx.source.player);
        }
      }
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
