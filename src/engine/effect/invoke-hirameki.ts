// engine.effect.invoke-hirameki — 別カードの【ヒラメキ】効果を明示的に発動させる (証拠リムーブ契機でない)
// engine night-wave WC2b (2026-07-11, B06023/B06034/B06036 cluster)
// rules: 10-action-event.md §ヒラメキ, 17-icons.md §条件アイコン未達=持っていない扱い, 15-abilities-effects.md
//
// 用途: 「(証拠を) 表向きにした【ヒラメキ】を持つカードの、その【ヒラメキ】の効果を発動させてもよい」型
//   (B06023 金棒博士 / B06034 鬼丸城 / B06036 鬼丸天下統一プロジェクト)。ヒラメキ本来の
//   「証拠からリムーブされるとき」文脈ではなく、別カードの効果/コストが表向きにした証拠カードの
//   【ヒラメキ】effect を直接 queue する。
//
// invoke-leave-to-remove.ts (W3 r12) の直接の設計先例。emit を使わない理由・leaf 独立化の理由は同一:
//   - emit すると in-play scan が回り盤面 observer 型を誤発火する。ここでは何も証拠が「リムーブ」
//     されていない (単に別カードの effect を借りて実行するだけ) ため、対象 CardDef の hirameki
//     ability を直接走査し effect のみ queue する。盤面波及は構造的に発生しない。
//   - handleHook (triggered.ts) を atom-handlers から import すると import cycle が生じる。
//
// 公式Q&A 整合 (B06023/B06034/B06036 共通):
//   - 「【ヒラメキ】を発動できない (世良真純等) 場合でも、この能力で【ヒラメキ】の『効果』を発動できる」
//     → 本 verb は hiramekiSuppressed / restrictsOpponent('hirameki') を一切見ない (invoke は
//       「発動」制限を貫通、triggered.ts の hirameki gate とは別経路)。
//   - 「アイコンの条件を満たしていない等、有効でない【ヒラメキ】の効果を発動させても何も起こらない」
//     → ability.condition (【解決編】等) 不成立は effect を queue せず skip (rules/17 持っていない扱い)。
//   - 「発動させた場合はすべての効果を解決 (一部だけ不可)」 → effect 全体を単一 queue (分割しない)。
//   - trait gate は印字判定 (rules/17 Q&A §「〜を持つ」は静的印字で判定): opts.trait 指定時、
//     対象 CardDef が印字 trait を持たなければ no-op (条件アイコン充足は問わない)。
//   - 「アクション中のキャラ」($trigger.byUid) 依存 ヒラメキ (B05111 等) を invoke した場合、
//     アクション[事件] 文脈でないため byUid unbound → resolveBindRef が literal 返却 → target 解決
//     失敗 → 当該 atom no-op (= 有効でない効果は何も起こらない、と整合)。payload に byUid を載せない。

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
 * cardId の CardDef が持つ triggered hook==='evidence:remove-by-action' (=【ヒラメキ】) ability の
 * effect を、player 所有の ctx で発動 (queue) させる。
 * - def 不在 → silent no-op。
 * - trait 指定時、印字 trait 不一致 → no-op (印字判定)。
 * - matcher / matcherCondition / ability.condition 不成立 → skip (何も起こらない)。
 * hiramekiSuppressed 等の「発動できない」制限は見ない (invoke は「効果」を発動させるため)。
 */
export function invokeHiramekiOfCard(
  state: GameState,
  cardId: string,
  player: Player,
  trait?: string,
): void {
  const def = readDef.card(cardId);
  if (!def) return;
  // trait gate — 印字判定 (rules/17 Q&A: 静的印字で「〜を持つ」を判定)。
  if (trait !== undefined && !(def.traits ?? []).includes(trait)) return;
  const virtualUid = `invokeHir:${player}:${cardId}`;
  for (const ability of def.abilities as AbilityDef[]) {
    if (ability.type !== 'triggered') continue;
    const trig = ability.trigger;
    if (!trig || trig.hook !== 'evidence:remove-by-action') continue;
    // ヒラメキは scope:'on-evidence'。仮想 area も 'evidence' 相当。
    // payload に byUid を載せない — アクション[事件] actor は存在しないため $trigger.byUid は unbound。
    const payload = { uid: virtualUid, cardId, player, invoked: true };
    const baseCtx = {
      source: { cardId, uid: virtualUid, abilityId: ability.id, player, area: 'evidence' as const },
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
      'evidence:remove-by-action',
      payload,
    );
  }
}
