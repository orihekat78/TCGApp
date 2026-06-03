// engine.flow.main.canAction* — アクション可否判定 (rules/05 06., rules/07)
//
// Phase 4 Group A は宣言時の可否判定のみ提供。実際のアクション状態機械
// (declared → guard-window → ... → action-end) は Group B で実装予定。
//
// 条件 (rules/07):
//   - 自分の現場のアクティブ状態キャラ or アクティブなパートナー
//   - 名乗り状態は不可 — 例外: 迅速 / 突撃 / 突撃[キャラ] / 突撃[事件] (rules/13)
//
// 対象 (rules/07):
//   - アクション[キャラ]: 相手の現場の sleep / stun キャラ
//   - アクション[事件]: 相手の事件 (相手証拠 ≥ 1 が必要)

import type { GameState } from '../../types/index.js';
import { char as readChar } from '../../read/char.js';
import { candidates as targetCandidates, mustTargetCandidates } from '../action/target-expander.js';

type Player = 'self' | 'opp';

/**
 * uid からアクション主体を探す。
 * partner:self / partner:opp 形式に対応。
 */
function findActor(
  state: GameState,
  uid: string,
): { kind: 'char'; player: Player } | { kind: 'partner'; player: Player } | null {
  if (uid === 'partner:self') {
    return { kind: 'partner', player: 'self' };
  }
  if (uid === 'partner:opp') {
    return { kind: 'partner', player: 'opp' };
  }
  for (const p of ['self', 'opp'] as const) {
    if (state.players[p].scene.some(c => c.uid === uid)) {
      return { kind: 'char', player: p };
    }
  }
  return null;
}

/**
 * 名乗り状態の例外: 迅速 / 突撃系を持つか判定。
 *   - 任意の突撃: アクション全般 OK
 *   - 突撃[キャラ]: アクション[キャラ] のみ OK
 *   - 突撃[事件]: アクション[事件] のみ OK
 *   - 迅速: 推理もアクションも OK (rules/13)
 */
type ActionTargetKind = 'any' | 'char' | 'case';

function namedExceptionAllowed(state: GameState, uid: string, targetKind: ActionTargetKind): boolean {
  const kws = readChar.keywords(state, uid);
  if (kws.includes('迅速')) return true;
  if (kws.includes('突撃')) return true;
  if (targetKind === 'char' && kws.includes('突撃[キャラ]')) return true;
  if (targetKind === 'case' && kws.includes('突撃[事件]')) return true;
  return false;
}

/**
 * canAction — アクション宣言の汎用可否 (対象種別を問わない)
 *
 * - 主体が active
 * - 名乗りなし、または名乗り例外 (迅速 / 突撃 / 突撃[キャラ] / 突撃[事件] のいずれか)
 *
 * 注意: partner はキャラと違い 名乗り状態の概念がない (rules/06)。
 */
export function canAction(state: GameState, byUid: string): boolean {
  return _canAction(state, byUid, 'any');
}

function _canAction(state: GameState, byUid: string, targetKind: ActionTargetKind): boolean {
  const actor = findActor(state, byUid);
  if (!actor) return false;
  if (actor.kind === 'partner') {
    return state.players[actor.player].partner.state === 'active';
  }
  // char
  const c = state.players[actor.player].scene.find(c => c.uid === byUid)!;
  if (c.state !== 'active') return false;
  if (!c.isNamed) return true;
  // 名乗り中: 例外キーワード判定
  return namedExceptionAllowed(state, byUid, targetKind);
}

/**
 * canActionAgainstChar — 相手キャラへのアクション可否。
 *
 * - 主体が canAction (target='char')
 * - 対象が targetExpander.candidates() に含まれる
 *   - 通常 (rules/07): sleep or stun
 *   - 拡張 (G29 例: D11007): level≥7 active も拡張で許可
 *
 * Note: findActor guard in _canAction already ensures byUid is a valid actor
 * before candidates() is called, so candidates() returning [] is unreachable here.
 */
export function canActionAgainstChar(state: GameState, byUid: string, targetUid: string): boolean {
  if (!_canAction(state, byUid, 'char')) return false;
  const cands = targetCandidates(state, byUid);
  if (!cands.some(c => c.uid === targetUid)) return false;
  // BUG-101: mustBeTargeted (D11005 挑発) — 強制対象 (legal な must-target) がいる場合、
  // char target はそのリストに限定 (state-machine.ts:152-162 の enforce と整合、AI/UI 列挙が
  // 違法手を出さないようにする)。mustTargetCandidates は legal target に絞り込み済 (上記)。
  const must = mustTargetCandidates(state, byUid);
  if (must.length > 0 && !must.some(c => c.uid === targetUid)) return false;
  return true;
}

/**
 * canActionAgainstCase — 相手事件へのアクション可否。
 *
 * - 主体が canAction (target='case')
 * - 相手の証拠 ≥ 1 (rules/07: 証拠が1つもない事件は対象不可)
 */
export function canActionAgainstCase(state: GameState, byUid: string, targetPlayer: Player): boolean {
  const actor = findActor(state, byUid);
  if (!actor) return false;
  // 自分の事件は対象にできない (rules/07)
  if (actor.player === targetPlayer) return false;
  if (!_canAction(state, byUid, 'case')) return false;
  if (state.players[targetPlayer].evidence.length < 1) return false;
  return true;
}
