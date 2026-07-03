// engine.effect.invoke-leave-to-remove — リムーブエリア在中カードの【現場リムーブ時】明示発動
// engine mega-wave W3 (2026-07-03, r12/P24)
// rules: 17-icons.md §現場リムーブ時, 15-abilities-effects.md, B08078 公式Q&A
//
// B08078 ジン a2「この効果によってリムーブしたカードの【現場リムーブ時】の効果を発動させてもよい」用。
//
// 設計の核心 — event.emit('leave:to-remove') を使わない理由:
//   emit すると handleHook の in-play scan が回り、盤面の observer 型 leave:to-remove ability
//   (「相手キャラが現場からリムーブされたとき」等の第三者反応) まで誤発火する。実際には何も現場を
//   離れていない (手札からリムーブされたカードの効果を「発動させる」だけ) ため、対象 CardDef の
//   abilities を直接走査して selfOnly 相当の効果のみ queue する。盤面への波及が構造的に発生しない。
//
// 独立 leaf module にする理由 (import cycle 回避):
//   handleLeaveToRemoveSelf (listeners/triggered.ts) を atom-handlers から import すると
//   atom-handlers → triggered → resolve/stack → effect/resolver → atom-handlers の cycle が生じる。
//   本 module は readDef/evalCond/resolve-picks/event registry のみに依存し stack へ到達しない。
//   ~30 行の構造複製は骨格凍結原則 (既存関数無改変) のコストとして許容。
//
// Q&A 整合:
//   「有効でない (条件アイコン未達の)【現場リムーブ時】の効果を発動させることはできますか？」
//   →「発動させることはできますが、何も起こりません」= ability.condition 不成立は skip
//     (発動自体は verb 呼出しで成立、効果 queue のみ抑止 — rules/17 条件未達=持っていない扱い)。
//   「リムーブしたカードが解決中にリムーブエリアを離れても発動できる」= 本 verb は zone presence を
//     gate しない (cardId から def を直接引く)。

import { def as readDef } from '../read/def.js';
import { evalCond } from '../cond/eval.js';
import { resolveEffectPicks } from './resolve-picks.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { event } from '../event/index.js';
import type { GameState, AbilityDef } from '../types/index.js';

type Player = 'self' | 'opp';

function getHumanPlayerSide(): Player | null {
  return (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide ?? null;
}

/**
 * cardId の CardDef が持つ trigger.hook==='leave:to-remove' の triggered ability (selfOnly 相当 =
 * カード自身の【現場リムーブ時】) を、仮想 location (area:'scene' — 現場にいた扱い、rules/17) で
 * 発動させる。matcherCondition / ability.condition は evalCond で honor (不成立 = 何も起こらない)。
 * def 不在は silent no-op。
 */
export function invokeLeaveToRemoveOfCard(state: GameState, cardId: string, player: Player): void {
  const def = readDef.card(cardId);
  if (!def) return;
  const virtualUid = `invoke:${player}:${cardId}`;
  for (const ability of def.abilities as AbilityDef[]) {
    if (ability.type !== 'triggered') continue;
    const trig = ability.trigger;
    if (!trig || trig.hook !== 'leave:to-remove') continue;
    // 仮想 area は 'scene' (【現場リムーブ時】は on-scene scope) — on-scene/always のみ通す
    if (ability.scope !== undefined && ability.scope !== 'on-scene' && ability.scope !== 'always') continue;
    const payload = { uid: virtualUid, cardId, player, invoked: true };
    const baseCtx = {
      source: { cardId, uid: virtualUid, abilityId: ability.id, player, area: 'scene' as const },
      bindings: {},
      triggerPayload: payload,
    };
    if (trig.matcher && !trig.matcher(payload, state)) continue;
    if (trig.matcherCondition && !evalCond(state, trig.matcherCondition, baseCtx)) continue;
    if (ability.condition && !evalCond(state, ability.condition, baseCtx)) continue;
    if (!ability.effect) continue;

    const humanSide = getHumanPlayerSide();
    const isHumanEffect = humanSide !== null && player === humanSide;
    const aiPolicy = new HeuristicPolicy();
    const resolvedEffect = resolveEffectPicks(state, ability.effect, baseCtx, {
      chooseAtomTarget: isHumanEffect ? undefined : aiPolicy.chooseAtomTarget?.bind(aiPolicy),
      byPlayer: player,
      humanChooser: isHumanEffect,
      source: { cardId, abilityId: ability.id },
    });
    event.queue(
      state,
      resolvedEffect,
      { player, uid: virtualUid, cardId },
      'leave:to-remove',
      payload,
    );
  }
}
