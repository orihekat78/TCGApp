// engine.event — Hook Registry 実装
// spec: .claude/specs/engine-api-events.md
// rules: 15-abilities-effects.md
//
// 設計メモ:
//   - Registry は **モジュールレベルのシングルトン** (Map<HookName, Listener[]>)
//   - 理由: Immer の produce() は state を新規オブジェクトに置き換えるため、
//     state-keyed (WeakMap) では listener が mutation 間で失われる
//   - listener は関数 (非 JSON) なので state には直接保存できない
//   - pendingEffects (Effect[] = JSON-serializable) は GameState 内に保持
//   - テスト用に _resetRegistry() を公開

import type { GameState, HookName, Effect, Unsubscribe } from '../types/index.js';

export type Listener = (state: GameState, payload: unknown, source: unknown) => Effect | void;

const registry: Map<HookName, Listener[]> = new Map();

/**
 * Hook 名に listener を登録する。
 * 戻り値の Unsubscribe を呼ぶと登録解除される。
 */
function on(name: HookName, listener: Listener): Unsubscribe {
  let list = registry.get(name);
  if (!list) {
    list = [];
    registry.set(name, list);
  }
  list.push(listener);

  let unsubscribed = false;
  return () => {
    if (unsubscribed) return;
    unsubscribed = true;
    const cur = registry.get(name);
    if (!cur) return;
    const idx = cur.indexOf(listener);
    if (idx !== -1) cur.splice(idx, 1);
  };
}

/**
 * Hook 発火: 登録されている listener を順に呼ぶ。
 * Listener が Effect を返したら state.pendingEffects に積む (queue 経由)。
 */
function emit(state: GameState, name: HookName, payload: unknown, source?: unknown): void {
  const list = registry.get(name);
  if (!list || list.length === 0) return;
  // スナップショット (listener が listener を解除しても列挙が壊れないように)
  const snapshot = list.slice();
  for (const listener of snapshot) {
    const result = listener(state, payload, source);
    if (result) {
      queue(state, result);
    }
  }
}

/**
 * Effect を pendingEffects に追加する。
 * emit からも、外部からも呼べる (Resolver / 個別 listener が直接 queue したい場合)。
 */
function queue(state: GameState, effect: Effect, _source?: unknown): void {
  state.pendingEffects.push(effect);
}

/**
 * テスト用: registry を完全クリア。
 */
function _resetRegistry(): void {
  registry.clear();
}

export const event = {
  on,
  emit,
  queue,
  _resetRegistry,
};
