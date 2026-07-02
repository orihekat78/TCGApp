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

// 2026-05-27 Option C migration: event registry / def lookup は本ファイルでは不要 (triggered.ts
// 側で処理)。本ファイルは PendingHirameki 型 + side-channel helper の export のみを担う。

export type PendingHiramekiSide = {
  player: 'self' | 'opp';
  cardId: string;
  abilityId: string;
  // engine wave-11 (2026-07-02): アクション[事件] actor uid の snapshot。
  // 「アクション中のキャラ」(B03085/B05032/B05111 hirameki) を effect 内 '$trigger.byUid' で参照する
  // ための payload 貫通 (公式Q&A B05111: ヒラメキを発動させたキャラが該当)。optional 経路で
  // pendingHirameki に持ち越し、hiramekiResolve が queue payload に復元する。
  actorUid?: string;
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
 * 2026-05-27 Option C migration: triggered.ts listener が hook='evidence:remove-by-action'
 * + trigger.optional=true の ability を検出した時に呼ぶ。dispatch drain で UI 側に
 * 転送され HiramekiPickerModal / useHiramekiFlowDriver が fire/skip を扱う。
 */
export function pushPendingHirameki(v: PendingHiramekiSide): void {
  _writeSide(v);
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
 * 2026-05-27 Option C migration: ヒラメキの event listener は triggered.ts に統合。
 * 本関数は engine/index.ts からの呼出 ABI 互換性のため残しているが no-op (実際の登録は
 * registerTriggeredListener が hook='evidence:remove-by-action' で行う)。
 * 旧 type:'icon-flash' を持つカードは type:'triggered' + trigger:{hook,optional:true} に移行済。
 *
 * `_resetHiramekiRegistered` も後方互換のために残置 (テストが呼ぶケースのみ存在)。
 */
export function registerHiramekiListener(): void {
  if (_registered) return;
  _registered = true;
  // intentionally empty — see comment above
}
