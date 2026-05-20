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

// Round 4j-fix (BUG-034): vite dev mode の module instance 分離回避のため globalThis 経由で
// side-channel を保持。複数の hirameki.ts module instance が存在しても、すべて同じ
// globalThis.__pendingHirameki を read/write する。jsdom + browser 両方で動作。
declare global {
  // eslint-disable-next-line no-var
  var __pendingHirameki: PendingHiramekiSide | null | undefined;
}
function _readSide(): PendingHiramekiSide | null {
  return (globalThis as { __pendingHirameki?: PendingHiramekiSide | null }).__pendingHirameki ?? null;
}
function _writeSide(v: PendingHiramekiSide | null): void {
  (globalThis as { __pendingHirameki?: PendingHiramekiSide | null }).__pendingHirameki = v;
}

/**
 * dispatchEngineAction が produce 完了後に呼び、Zustand に転送するための drain API。
 * 呼び出すと現在の値を返し、側チャネルを null クリアする。
 */
export function _drainPendingHirameki(): PendingHiramekiSide | null {
  const v = _readSide();
  _writeSide(null);
  return v;
}

/** テスト用: 側チャネルを直接リセット */
export function _resetPendingHirameki(): void {
  _writeSide(null);
}

let _registered = false;

/**
 * テスト用: `_registered` flag をリセットして次回 `registerHiramekiListener()` 呼出で
 * listener を再登録可能にする。`event._resetRegistry()` 直後に呼ぶ必要がある
 * (event registry がクリアされた後も `_registered=true` のままだと listener が消えたまま
 * になるため)。
 */
export function _resetHiramekiRegistered(): void {
  _registered = false;
}

/**
 * engine init 時に 1 回だけ呼ぶ。重複登録は no-op。
 * テスト用に `_resetHiramekiRegistered` で flag を戻してから再登録可。
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
    _writeSide({
      player: p.player,
      cardId: p.ev.cardId,
      abilityId: flash.id,
    });
    return;
  });
}
