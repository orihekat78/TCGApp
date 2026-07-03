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

import type { GameState, Candidate } from '../../types/index.js';
import { char as readChar } from '../../read/char.js';
import { matchOneFilter } from '../../target/candidates.js';
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

function namedExceptionAllowed(state: GameState, uid: string, targetKind: ActionTargetKind, targetUid?: string): boolean {
  const kws = readChar.keywords(state, uid);
  if (kws.includes('迅速')) return true;
  if (kws.includes('突撃')) return true;
  if (targetKind === 'char' && kws.includes('突撃[キャラ]')) return true;
  if (targetKind === 'case' && kws.includes('突撃[事件]')) return true;
  // engine mega-wave W4 (2026-07-03, r62 bundled fix): 'any' (= canAction、UI actor 列挙) は
  // 突撃[キャラ]/[事件] 変種所持でも許可 — 旧実装は 'any' で false になり、変種のみ持ちの名乗り
  // キャラが actor として一切列挙されない latent gap があった (対象種別の絞りは char/case 側で行う)。
  // 挙動変化は本分岐のみ由来と分離実測済 (branch 無効時 smoke winsA=498 復元 / 有効時 472 —
  // CT-D08/D11 デッキの 突撃[キャラ] 系が名乗りターンに合法手として列挙されるようになった正方向修正)。
  if (targetKind === 'any' && (kws.includes('突撃[キャラ]') || kws.includes('突撃[事件]'))) return true;
  // engine mega-wave W4 (2026-07-03, r62 G32): filter 付き突撃 (「突撃[レベル4以下のキャラ]」B07096)。
  // targetUid 指定時は per-target で matchOneFilter 評価 (effective level 込み — 公式Q&A「効果で
  // レベル4以下になっているキャラを指定可」)。targetUid 未指定 (宣言前の actor 列挙) は entry 存在で
  // 許可し、対象確定時に canActionAgainstChar → ここへ targetUid 付きで再評価される。
  // filter は名乗り例外のみを縛る — 非名乗り時は本関数に到達せず無制限 (公式Q&A「名乗り状態でない
  // 場合、レベル5以上のキャラを指定できますか？ → はい」)。case 側 filtered は consumer 未出現 = 未実装。
  const fas = readChar.filteredAssaultKeywords(state, uid);
  for (const fa of fas) {
    if (targetKind === 'any') return true;
    if (targetKind === 'char' && fa.targetKind === 'char') {
      if (targetUid === undefined) return true;
      for (const p of ['self', 'opp'] as const) {
        const tc = state.players[p].scene.find(c => c.uid === targetUid);
        if (!tc) continue;
        const cand: Candidate = { kind: 'char', uid: tc.uid, cardId: tc.cardId, player: p };
        if (matchOneFilter(state, tc.cardId, fa.filter, tc, cand)) return true;
      }
    }
  }
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

function _canAction(state: GameState, byUid: string, targetKind: ActionTargetKind, targetUid?: string): boolean {
  const actor = findActor(state, byUid);
  if (!actor) return false;
  if (actor.kind === 'partner') {
    return state.players[actor.player].partner.state === 'active';
  }
  // char
  const c = state.players[actor.player].scene.find(c => c.uid === byUid)!;
  if (c.state !== 'active') return false;
  // engine mega-wave W2 (2026-07-03, P07/r24): 継続 selfActionBan「このキャラはアクションできない」
  // (B07005、condition は ability.condition で gate)。宣言時 gate のみ — 開始済みアクションは条件を
  // 失っても継続 (rules/22/24、state-machine は再評価しない)。不在時 false = 挙動不変。
  if (readChar.selfContinuousFlag(state, byUid, 'selfActionBan')) return false;
  if (!c.isNamed) return true;
  // 名乗り中: 例外キーワード判定 (W4 r62: filtered-突撃 は targetUid 付きで per-target 評価)
  return namedExceptionAllowed(state, byUid, targetKind, targetUid);
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
  if (!_canAction(state, byUid, 'char', targetUid)) return false;
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
  // engine mega-wave W2 (2026-07-03, P07/r24): 継続 caseActionBan「このキャラはアクション[事件]できない」
  // (B05051)。partner actor は def walk 対象外 (selfContinuousFlag は scene/PA-MR uid のみ true になりうる)。
  if (readChar.selfContinuousFlag(state, byUid, 'caseActionBan')) return false;
  if (state.players[targetPlayer].evidence.length < 1) return false;
  return true;
}
