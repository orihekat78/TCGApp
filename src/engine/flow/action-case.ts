// engine.flow.actionCase — アクション[事件] 処理 (Phase 4 Group B Task 4.6)
// spec: .claude/specs/engine-api-flow-contact.md
// rules: 07-action-flow.md, 10-action-event.md
//
// 提供 API:
//   - removeOpponentEvidenceTop: 相手証拠最上部1枚を取り出し → リムーブ
//                                + evidence:remove-by-action emit (ヒラメキ判定窓)
//   - flashWindow:               (Phase 4 stub、Phase 7-1/7-2 で実機構は evidence:remove-by-action
//                                  listener (hirameki.ts) + useEngineDispatch:hiramekiResolve に
//                                  移行済。本関数は legacy log 専用で外部呼び出しなし)
//   - gainSelfEvidence:          自分の証拠+1 (LP無関係) — byUid 不在でも進める

import type { GameState, ActionContext, EvidenceCard } from '../types/index.js';
import { mutate } from '../mutate/index.js';
import { event } from '../event/index.js';

type Player = 'self' | 'opp';

/**
 * removeOpponentEvidenceTop — 相手証拠最上部1枚をリムーブ
 *
 * - mutate.evidence.removeTop が証拠 → リムーブエリア へ移動 (rules/10)
 * - evidence:remove-by-action emit (spec: { player, ev })
 * - 戻り値: 取り出した EvidenceCard (なければ undefined)
 *
 * 注意: spec では「ヒラメキ判定窓」はこの Hook で発火させる設計だが、
 *       Phase 7-1/7-2 で `evidence:remove-by-action` listener (hirameki.ts) +
 *       UI dispatch (`hiramekiResolve`) の経路に移行済。flashWindow は legacy stub。
 */
export function removeOpponentEvidenceTop(
  state: GameState,
  ax: ActionContext,
): EvidenceCard | undefined {
  if (ax.target.kind !== 'case') {
    throw new Error('flow.actionCase.removeOpponentEvidenceTop: target is not case');
  }
  const player: Player = ax.target.player;
  const ev = mutate.evidence.removeTop(state, player);
  if (!ev) return undefined;

  // evidence:remove-by-action emit (spec: { player, ev })
  event.emit(
    state,
    'evidence:remove-by-action',
    { player, ev },
    { player: ax.byPlayer, uid: ax.byUid },
  );

  return ev;
}

/**
 * flashWindow — ヒラメキ判定窓 (Phase 4 legacy stub)
 *
 * Phase 7-1/7-2 で実機構は移行済:
 *   - `evidence:remove-by-action` event を `removeOpponentEvidenceTop` が emit
 *   - `src/engine/listeners/hirameki.ts` が捕捉、pendingHirameki side-channel set
 *   - UI/AI が `hiramekiResolve` dispatch → `resolveEffectPicks` で effect 解決
 *
 * 本関数は **legacy log 専用** で、外部呼び出しは無し (barrel から export はされるが unused)。
 * 削除は将来の cleanup phase で実施予定 (現状は API 互換性のため保持)。
 *
 * @param ev   リムーブ対象の証拠カード
 * @param owner 証拠の所有者 (リムーブされた側 = ヒラメキ発動可能側)
 */
export function flashWindow(
  state: GameState,
  ev: EvidenceCard,
  owner: Player,
): void {
  mutate.log.append(state, {
    ts: Date.now(),
    player: owner,
    turn: state.turn.number,
    action: 'flash-window-stub',
    target: ev.cardId,
    result: 'legacy-stub',
  });
}

/**
 * gainSelfEvidence — 自分のデッキから1枚を裏向きで証拠エリアに追加 (rules/10)
 *
 * - 1枚固定 (攻撃キャラの LP に依存しない)
 * - byUid が現場を離れていても、ここまでは進める (rules/10)
 */
export function gainSelfEvidence(state: GameState, ax: ActionContext): void {
  const p: Player = ax.byPlayer;
  // engine拡張 wave#2 cluster3 (2026-06-13, BUG-142): rules/14「証拠を得る = リフレッシュ後に残り解決」。
  // 獲得前に deck0 なら refresh (fileAdd 同型の事前 guard)。remove0 なら敗北し、獲得も emit も行わない。
  if (state.players[p].deck.length === 0) {
    const r = mutate.deck.refresh(state, p);
    if (!r.ok) {
      if (state.gameResult === undefined) {
        const winner: Player = p === 'self' ? 'opp' : 'self';
        mutate.gameResult.set(state, winner, 'deck-out');
      }
      return;
    }
  }
  const before = state.players[p].evidence.length;
  mutate.evidence.addFromDeck(state, p, 1, false, {
    turn: state.turn.number,
    via: 'action-case',
  });
  // engine拡張 wave#2 cluster3 (2026-06-13): evidence:gain emit — rules/10 手順3。
  // 実獲得時のみ emit (false-fire 防止)。本 emit が evidence:gain の唯一の emit 箇所であること
  // (推理/効果/refresh 由来では発火しない) が「アクション[事件]によって」の語義を構造的に保証する。
  // payload: uid/byUid = actor (selfOnly + triggerCharMatches{payloadKey:'byUid'} 両対応)。
  if (state.players[p].evidence.length > before) {
    event.emit(state, 'evidence:gain', {
      player: p,
      byUid: ax.byUid,
      uid: ax.byUid,
      via: 'action-case',
      gained: 1,
    }, { player: p, uid: ax.byUid });
  }
  // ログ
  mutate.log.append(state, {
    ts: Date.now(),
    player: p,
    turn: state.turn.number,
    action: 'action-case-gain',
    result: '+1',
  });
}

export const actionCase = {
  removeOpponentEvidenceTop,
  flashWindow,
  gainSelfEvidence,
};
