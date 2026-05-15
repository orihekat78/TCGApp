// Phase 8 Task 8.2: クリック+確認 UX (target picker)
//
// spec: .claude/specs/2026-05-11-ui-action-flows.md (共通フロー骨格)
// rules: 17-icons.md §「〜まで」(0 枚選択可スキップ), 11-reasoning.md (推理対象選択),
//        07-action-flow.md (アクション対象選択)
//
// 設計:
//   - 3 phase ステートマシン (idle / picking / confirming) を Zustand 別 store で保持
//   - 複数 component (ActionsPanel / SceneArea / ConfirmModal 等) が同じ picker state を
//     subscribe するため、useGameStateStore とは分離した独立 store とする
//   - start() は Promise を返す — UI 配線側は await でき、内部 state は別途 subscribe
//     する component が反応する (Promise + state ハイブリッド)
//   - 0 候補で start() 呼出: rules/17 §「〜まで」に従い即 null resolve (state は idle のまま)
//   - 既に picking 中に再 start() された場合: 旧 Promise を null resolve した上で新 picking 開始
//   - pick(uid) で uid が候補集合外: no-op (UI 側で明示エラー表示しない方針)
//   - 骨格 (engine) に一切触れない UI 層単独機構
//
// 注意:
//   - `useTargetPicker()` 自体は React subscription を行わず、`getState()` で都度取得する
//     pure 関数群を束ねて返す。component が phase 変化で再描画したい場合は
//     `useTargetPickerStore((s) => s.phase)` を別途 subscribe すること。
//   - これにより React レンダラ無しのテストから直接 hook を呼び出せる。

import { create } from 'zustand';
// (no other module imports — state is self-contained)

export type PickerPhase =
  | { phase: 'idle' }
  | { phase: 'picking'; candidates: readonly string[]; purpose: string }
  | { phase: 'confirming'; candidates: readonly string[]; chosen: string; purpose: string };

type Resolver = (chosen: string | null) => void;

type PickerStore = {
  phase: PickerPhase;
  /** 内部: 現在の Promise resolver。consumer は触らない。 */
  _resolver: Resolver | null;
  _setPhase: (phase: PickerPhase) => void;
  _setResolver: (resolver: Resolver | null) => void;
  /** テストフィクスチャ用: 全 state を初期化 */
  _reset: () => void;
};

export const useTargetPickerStore = create<PickerStore>((set) => ({
  phase: { phase: 'idle' },
  _resolver: null,
  _setPhase: (phase) => set({ phase }),
  _setResolver: (resolver) => set({ _resolver: resolver }),
  _reset: () => set({ phase: { phase: 'idle' }, _resolver: null }),
}));

export type TargetPicker = {
  /** 現時点の phase スナップショット。再描画のために subscribe したい場合は
   *  useTargetPickerStore((s) => s.phase) を component で呼ぶ。 */
  phase: PickerPhase;
  /**
   * 候補を提示して 1 件選択させる。Promise は確定時/キャンセル時に resolve。
   * - 候補 0 件 → 即 null resolve、state は idle のまま (rules/17 §「〜まで」)
   * - 既に picking 中の場合 → 旧 Promise を null resolve し新セッション開始
   */
  start: (opts: { candidates: readonly string[]; purpose?: string }) => Promise<string | null>;
  /** picking 中 + uid ∈ candidates → confirming に遷移。それ以外 no-op。 */
  pick: (uid: string) => void;
  /** confirming 中のみ → Promise resolve(chosen) + idle に復帰。 */
  confirm: () => void;
  /** picking / confirming 中 → Promise resolve(null) + idle に復帰。idle では no-op。 */
  cancel: () => void;
  /** 候補集合に uid が含まれるかどうか (UI ハイライト判定用)。idle 中は常に false。 */
  isCandidate: (uid: string) => boolean;
};

function startPick(opts: { candidates: readonly string[]; purpose?: string }): Promise<string | null> {
  const { candidates, purpose = '' } = opts;

  // 候補 0 件 → 即 null resolve (rules/17 §「〜まで」)
  if (candidates.length === 0) {
    return Promise.resolve(null);
  }

  const store = useTargetPickerStore.getState();
  // 旧 picking がある場合は null resolve して破棄
  const prev = store._resolver;
  if (prev) prev(null);

  return new Promise<string | null>((resolve) => {
    store._setResolver(resolve);
    store._setPhase({
      phase: 'picking',
      candidates: [...candidates],
      purpose,
    });
  });
}

function pickTarget(uid: string): void {
  const store = useTargetPickerStore.getState();
  const current = store.phase;
  if (current.phase !== 'picking') return;
  if (!current.candidates.includes(uid)) return;
  store._setPhase({
    phase: 'confirming',
    candidates: current.candidates,
    chosen: uid,
    purpose: current.purpose,
  });
}

function confirmPick(): void {
  const store = useTargetPickerStore.getState();
  const current = store.phase;
  if (current.phase !== 'confirming') return;
  const resolver = store._resolver;
  store._setPhase({ phase: 'idle' });
  store._setResolver(null);
  if (resolver) resolver(current.chosen);
}

function cancelPick(): void {
  const store = useTargetPickerStore.getState();
  const current = store.phase;
  if (current.phase === 'idle') return;
  const resolver = store._resolver;
  store._setPhase({ phase: 'idle' });
  store._setResolver(null);
  if (resolver) resolver(null);
}

function isPickerCandidate(uid: string): boolean {
  const phase = useTargetPickerStore.getState().phase;
  if (phase.phase === 'idle') return false;
  return phase.candidates.includes(uid);
}

/**
 * 利便ラッパ。 React 外からも呼べる。React component で phase 変化に
 * 反応して再描画したい場合は `useTargetPickerStore((s) => s.phase)` を併用。
 */
export function useTargetPicker(): TargetPicker {
  return {
    phase: useTargetPickerStore.getState().phase,
    start: startPick,
    pick: pickTarget,
    confirm: confirmPick,
    cancel: cancelPick,
    isCandidate: isPickerCandidate,
  };
}
