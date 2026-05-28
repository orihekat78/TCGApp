// 2026-05-28: runNextHintFlow tests (step2 picker 経路)
//
// rules: 12-next-hint.md, 20-color-and-switch.md
// spec: plan「ネクストヒント step2 UI 実装 + 反復可能化」
//
// 仕様 (Option A: atomic):
//   1. canStartNextHint で開始可否判定 (FILE 1+ かつ非アシストパートナー)
//   2. useNextHintPicker.ask で候補 (FILE-top + 使用可能手札) を提示
//   3. acceptUse(cardId) → dispatchEngineAction nextHint(optionalCardId) (step1+step2)
//   4. acceptSkip → dispatchEngineAction nextHint() (step1 のみ)
//   5. acceptCancel → cancelled (dispatch しない)

import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { runNextHintFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useNextHintPickerStore, useNextHintPicker } from '@/ui/hooks/useNextHintPicker';
import { registerAll } from '@/cards';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState, FileCard } from '@/engine/types/game-state';

// D08017 = 青 / character / Lv2 (cutin)。FILE 3 枚 → postPopCount=2、Lv2 ≤ 2 で候補化。
const FILE_CARD = 'D08017';

function setupWithFile(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.case = { cardId: 'D08020', status: '事件編', requiredEvidence: 7, colors: ['青'] };
  const fb: FileCard = { type: 'card-back', cardId: FILE_CARD };
  s.players.self.file = [fb, fb, fb];
  s.players.self.hand = [];
  return s;
}

describe('runNextHintFlow (step2 picker)', () => {
  beforeAll(() => {
    registerAll();
  });
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
    useNextHintPickerStore.getState()._reset();
  });

  it('picker を開き、FILE-top を候補に含む', async () => {
    useGameStateStore.setState({ gameState: setupWithFile() });
    const promise = runNextHintFlow({ player: 'self' });

    const req = useNextHintPickerStore.getState().current;
    expect(req).not.toBeNull();
    expect(req?.fileTopCardId).toBe(FILE_CARD);
    // 候補に FILE-top (source='file') が含まれる (Lv2 ≤ postPopCount 2、青 ⊆ 青)
    expect(req?.candidates.some((c) => c.cardId === FILE_CARD && c.source === 'file')).toBe(true);

    // acceptUse → step1+step2
    useNextHintPicker().acceptUse(FILE_CARD);
    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    // FILE 3 → 2 (step1 で 1 枚 pop)
    expect(after.players.self.file.length).toBe(2);
    // step2 でキャラ登場 (名乗り状態 = 同ターン登場)
    expect(after.players.self.scene.some((c) => c.cardId === FILE_CARD && c.isNamed)).toBe(true);
    expect(after.turnState.self.nextHintUsed).toBe(true);
    // handUseUsed は消費しない (NH は別経路)
    expect(after.turnState.self.handUseUsed).toBe(false);
  });

  it('acceptSkip → step1 のみ (FILE→手札、使用しない)', async () => {
    useGameStateStore.setState({ gameState: setupWithFile() });
    const promise = runNextHintFlow({ player: 'self' });
    expect(useNextHintPickerStore.getState().current).not.toBeNull();

    useNextHintPicker().acceptSkip();
    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.file.length).toBe(2);
    // step2 なし → 手札に FILE-top が加わるのみ、scene 登場なし
    expect(after.players.self.hand).toContain(FILE_CARD);
    expect(after.players.self.scene.length).toBe(0);
    expect(after.turnState.self.nextHintUsed).toBe(true);
  });

  it('acceptCancel → cancelled、state 不変', async () => {
    useGameStateStore.setState({ gameState: setupWithFile() });
    const before = useGameStateStore.getState().gameState;
    const promise = runNextHintFlow({ player: 'self' });

    useNextHintPicker().acceptCancel();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('no-state when gameState is null', async () => {
    const result = await runNextHintFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-state');
  });

  it('not-allowed when FILE is empty', async () => {
    const s = createEmptyGameState();
    s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    useGameStateStore.setState({ gameState: s });
    const result = await runNextHintFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });
});
