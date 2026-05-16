// Phase 8 完全クローズ Commit 3a: ヒラメキ listener
//
// rules: 10-action-event.md §ヒラメキ
// spec: 計画 — Commit 3a Hirameki end-to-end
//
// 役割:
//   - `evidence:remove-by-action` イベント発火時に、リムーブされた証拠カードに
//     `type: 'icon-flash'` ability があるかチェック
//   - あれば側チャネル `_pendingHiramekiSideChannel` に { player, cardId, abilityId } をセット
//   - 実際の効果適用は UI 経由 (`useHiramekiFlowDriver` → `hiramekiResolve` dispatch)
//
// 設計上の注意:
//   - listener は state mutation せず、pendingEffects にも push しない
//   - 側チャネル経由で UI に通知 → ユーザー (self) or AI (opp) が fire/skip 判定
//   - listener はモジュールレベル singleton。テスト用に `_resetPendingHirameki()` 公開

import { event } from '../event/registry.js';
import { def as readDef } from '../read/def.js';

export type PendingHiramekiSide = {
  player: 'self' | 'opp';
  cardId: string;
  abilityId: string;
};

let _pendingHiramekiSideChannel: PendingHiramekiSide | null = null;

/**
 * dispatchEngineAction が produce 完了後に呼び、Zustand に転送するための drain API。
 * 呼び出すと現在の値を返し、側チャネルを null クリアする。
 */
export function _drainPendingHirameki(): PendingHiramekiSide | null {
  const v = _pendingHiramekiSideChannel;
  _pendingHiramekiSideChannel = null;
  return v;
}

/** テスト用: 側チャネルを直接リセット */
export function _resetPendingHirameki(): void {
  _pendingHiramekiSideChannel = null;
}

let _registered = false;

/**
 * engine init 時に 1 回だけ呼ぶ。重複登録は no-op。
 * テスト用に `_unregisterHiramekiListener` も export する。
 */
export function registerHiramekiListener(): void {
  if (_registered) return;
  _registered = true;
  event.on('evidence:remove-by-action', (_state, payload) => {
    const p = payload as { player: 'self' | 'opp'; ev: { cardId: string } } | undefined;
    if (!p || !p.ev) return;
    const def = readDef.card(p.ev.cardId);
    if (!def) return;
    const flash = def.abilities.find(
      (a: unknown) => a !== null && typeof a === 'object' && (a as { type?: string }).type === 'icon-flash',
    ) as { id: string } | undefined;
    if (!flash) return;
    _pendingHiramekiSideChannel = {
      player: p.player,
      cardId: p.ev.cardId,
      abilityId: flash.id,
    };
    return;
  });
}
