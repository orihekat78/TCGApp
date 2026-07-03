// reserved-effects listener — 離場後予約効果の発火 (mega-wave W6 step8, 2026-07-04, row75)
//
// rules: 15-abilities-effects.md §未解決効果 / 25 (同時発動は insertion order → 所有者解決順)
//
// 役割:
//   - state.reservedEffects (types/reserved-effect.ts) を監視し、hook 発火時に
//     mode/armedTurn/player/condition ゲートを通過した entry を single-fire で解決する
//   - 発火 = resolveEffectPicks (AI auto-pick / human surface、triggered.ts handleHook と同流儀)
//     → event.queue で pendingEffects へ。複数 entry 同時成立は全部発火 (rules/25)
//   - listen する hook は現 exemplar (B08069/B01058) が要る 2 本のみ:
//     phase:end:start (turn-end) / evidence:removed (next-match)。将来の「次に〜したとき」カードが
//     別 hook を要求したら本ファイルに追加する (TRIGGERED_HOOKS が wave 毎に育ったのと同じ運用、
//     骨格凍結原則: 先回りの過剰一般化はしない)
//
// 設計上の注意:
//   - entry.effect は Immer 凍結オブジェクト (state 内) → 発火時に structured copy してから
//     resolveEffectPicks に渡す (W4 r83 凍結 bindings 教訓と同型)
//   - 清掃: 未消費 next-match は flow/turn.ts endTurn が armedTurn 一致分を失効させる。
//     turn-end の残骸 (player 不一致等で不発) は armedTurn guard で永久 inert (害なし)

import { event } from '../event/registry.js';
import { evalCond } from '../cond/eval.js';
import { resolveEffectPicks } from '../effect/resolve-picks.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import type { GameState, Effect, EffectCtx } from '../types/index.js';
import type { ReservedEffectEntry } from '../types/reserved-effect.js';

type Player = 'self' | 'opp';

function getHumanPlayerSide(): Player | null {
  return (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide ?? null;
}

function makeCtx(entry: ReservedEffectEntry, payload: unknown): EffectCtx {
  return {
    source: {
      player: entry.trigger.player,
      cardId: entry.source.cardId,
      uid: entry.source.uid,
      area: 'remove', // 源カードは離場済み想定 (resolvePlayer('self') 等は player だけを見る)
    },
    bindings: {},
    triggerPayload: payload,
  } as EffectCtx;
}

function makeReservedHandler(hookName: string) {
  return (state: GameState, payload: unknown): void => {
    const list = state.reservedEffects;
    if (!list || list.length === 0) return;
    const pl = payload as { player?: Player } | undefined;
    const fired: ReservedEffectEntry[] = [];
    const remaining: ReservedEffectEntry[] = [];
    for (const entry of list) {
      let hit = false;
      if (entry.trigger.armedTurn === state.turn.number && entry.trigger.hook === hookName) {
        if (entry.trigger.mode === 'turn-end') {
          // B08069: arm した側のターン終了時に無条件発火
          hit = pl?.player === entry.trigger.player;
        } else {
          // B01058: condition (例 triggerPlayerIs) を arm 側視点で評価
          hit = !entry.trigger.condition || evalCond(state, entry.trigger.condition, makeCtx(entry, payload));
        }
      }
      (hit ? fired : remaining).push(entry);
    }
    if (fired.length === 0) return;
    state.reservedEffects = remaining; // single-fire: 先に splice (発火中の再入で二重発火しない)
    const humanSide = getHumanPlayerSide();
    const aiPolicy = new HeuristicPolicy();
    for (const entry of fired) {
      const owner = entry.trigger.player;
      const isHumanEffect = humanSide !== null && owner === humanSide;
      const baseCtx = makeCtx(entry, payload);
      // Immer 凍結 entry 由来の effect は copy してから pick substitution (W4 r83 教訓)
      const effectCopy = JSON.parse(JSON.stringify(entry.effect)) as Effect;
      const resolved = resolveEffectPicks(state, effectCopy, baseCtx, {
        chooseAtomTarget: isHumanEffect ? undefined : aiPolicy.chooseAtomTarget?.bind(aiPolicy),
        byPlayer: owner,
        humanChooser: isHumanEffect,
        source: { cardId: entry.source.cardId ?? '', abilityId: 'reserved' },
      });
      event.queue(
        state,
        resolved,
        { player: owner, uid: entry.source.uid, cardId: entry.source.cardId },
        hookName,
        payload,
      );
    }
  };
}

let _registered = false;

/** テスト用: 再登録可能にする (event._resetRegistry 直後に呼ぶ) */
export function _resetReservedEffectsRegistered(): void {
  _registered = false;
}

export function registerReservedEffectListener(): void {
  if (_registered) return;
  _registered = true;
  event.on('phase:end:start', makeReservedHandler('phase:end:start'));
  event.on('evidence:removed', makeReservedHandler('evidence:removed'));
}
