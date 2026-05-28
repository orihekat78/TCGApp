// engine.flow.main.useDeclaredAbility — 宣言能力使用 (rules/05 04.)
// rules: 21-declared-ability-cost.md, 17-icons.md (【ターン①/②】), 24-qa-naming-stun.md
//
// 重要 (rules/21, 24):
//   - 名乗り状態でも宣言能力は使用可能 (例外)
//   - active 状態である必要はない (ただし sleep コストは sleep キャラには支払えない)
//   - 【ターン①/②】は declaredUseCount[abilId] で管理 (rules/15)
//
// Phase 4 境界:
//   - canDeclaredAbility は対象キャラ存在 + 回数制限のみ判定
//   - useDeclaredAbility は flag/log + effect:declared hook の emit のみ
//   - cost は呼出元の responsibility (engine.cost.canPay/pay を ctx に渡す)
//   - 実際の Effect 実行は Phase 5 のカード登録で listener が pendingEffects に積む

import type { GameState, AbilityDef, EffectCtx } from '../../types/index.js';
import { mutate } from '../../mutate/index.js';
import { event } from '../../event/index.js';
import { def as readDef } from '../../read/def.js';
import { char as readChar } from '../../read/char.js'; // BUG-067: ability.limit enforcement
import { resolveEffectPicks } from '../../effect/resolve-picks.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';

function getHumanPlayerSide(): 'self' | 'opp' | null {
  return (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
}

/**
 * findCardOnBoard — uid のカードを場 (scene / case / partner-area) から探す。
 *
 * user_request 20260522_01 #5 fix: 旧 `findSceneChar` は scene のみ走査だったため
 * 事件カード (uid 'case:self'/'case:opp') の declared ability が canDeclaredAbility
 * で常に false 判定され UI から発動不可だった。case + partner も含める。
 */
function findCardOnBoard(
  state: GameState,
  uid: string,
): { player: 'self' | 'opp'; cardId: string; area: 'scene' | 'case' | 'partner-area' } | null {
  if (uid === 'case:self' || uid === 'case:opp') {
    const p: 'self' | 'opp' = uid === 'case:self' ? 'self' : 'opp';
    const cardId = state.players[p].case.cardId;
    if (cardId) return { player: p, cardId, area: 'case' };
    return null;
  }
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p: 'self' | 'opp' = uid === 'partner:self' ? 'self' : 'opp';
    const cardId = state.players[p].partner.cardId;
    if (cardId) return { player: p, cardId, area: 'partner-area' };
    return null;
  }
  for (const p of ['self', 'opp'] as const) {
    const c = state.players[p].scene.find((c) => c.uid === uid);
    if (c) return { player: p, cardId: c.cardId, area: 'scene' };
  }
  return null;
}

/**
 * 宣言能力の【ターン①/②】判定。
 *   - Phase 4 では maxPerTurn を引数で受けず、abilId が登録時に持つ前提で
 *     エンジン側はカウントの読み取りのみ提供する。
 *   - 呼出元 (UI / カードリスナ) が `engine.read.char.declaredUseCount` を見て
 *     上限超過なら canDeclaredAbility=false を返すよう拡張可能。
 *   - 暫定: useCount の参照を提供するのみ。
 */

/**
 * canDeclaredAbility — 宣言能力使用可能か判定する。
 *
 * - 対象キャラが存在する
 * - 名乗り状態でも OK (rules/24)
 * - active でなくても OK (ただし sleep コストは支払不可なため別途 engine.cost.canPay 判定が必要)
 * - 【ターン①/②】 ability.limit (kind:'turn') を enforcement (BUG-067, 2026-05-28)
 *   - 'game' kind は declaredUseCount がターン境界で reset されるため将来仕様、
 *     現状未使用 (cards/_shared / cards/ct-* で全 turn:n=1)
 */
export function canDeclaredAbility(state: GameState, uid: string, abilId: string): boolean {
  const found = findCardOnBoard(state, uid);
  if (!found) return false;
  // ability.limit enforcement
  const cardDef = readDef.card(found.cardId);
  const ability = cardDef?.abilities?.find((a: AbilityDef) => a.id === abilId);
  if (ability?.limit?.kind === 'turn') {
    const used = readChar.declaredUseCount(state, uid, abilId);
    if (used >= ability.limit.n) return false;
  }
  return true;
}

/**
 * useDeclaredAbility — 宣言能力使用を宣言する。
 *
 * - declaredUseCount[abilId] をインクリメント
 * - effect:declared を emit
 * - ログ追加
 *
 * cost 支払いは呼出元の responsibility (Phase 4 は分離).
 */
export function useDeclaredAbility(
  state: GameState,
  uid: string,
  abilId: string,
  _ctx?: unknown,
): void {
  const found = findCardOnBoard(state, uid);
  if (!found) {
    throw new Error(`useDeclaredAbility: card uid=${uid} not on board (scene/case/partner-area)`);
  }
  mutate.flag.incrDeclaredUseCount(state, uid, abilId);
  mutate.log.append(state, {
    ts: Date.now(),
    player: found.player,
    turn: state.turn.number,
    action: 'declaredAbility',
    target: `${uid}:${abilId}`,
  });
  event.emit(
    state,
    'effect:declared',
    { kind: 'declaredAbility', uid, abilId },
    { player: found.player, uid, cardId: found.cardId },
  );

  // 2026-05-26 fix: type:'declared' ability の effect を直接 queue する。
  // triggered.ts listener は `type === 'triggered'` のみ処理するため、宣言能力の
  // effect は engine 側のどこにも実行 path がなかった (D11014 a2 / D11003 a2 /
  // D11012 a1 / D08005 a2 等が silent no-op していた長年バグの根本対応)。
  const def = readDef.card(found.cardId);
  const ability = def?.abilities?.find((a: AbilityDef) => a.id === abilId);
  if (!ability) return;
  if (ability.type !== 'declared' || !ability.effect) return;

  const resolveCtx: EffectCtx = {
    source: {
      cardId: found.cardId,
      uid,
      abilityId: abilId,
      player: found.player,
      area: found.area as EffectCtx['source']['area'],
    },
    bindings: {},
  };
  const humanSide = getHumanPlayerSide();
  const isHumanEffect = humanSide !== null && found.player === humanSide;
  const aiPolicy = new HeuristicPolicy();
  const resolvedEffect = resolveEffectPicks(state, ability.effect, resolveCtx, {
    chooseAtomTarget: isHumanEffect ? undefined : aiPolicy.chooseAtomTarget?.bind(aiPolicy),
    byPlayer: found.player,
    humanChooser: isHumanEffect,
    source: { cardId: found.cardId, abilityId: abilId },
  });
  event.queue(
    state,
    resolvedEffect,
    { player: found.player, uid, cardId: found.cardId, abilityId: abilId, area: found.area },
    'declaredAbility',
    { kind: 'declaredAbility', uid, abilId },
  );
}
