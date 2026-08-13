// Phase 8.6: runAssistFlow / runSolveCaseFlow tests
//
// rules: 01-victory-conditions.md, 13-keywords.md §アシスト
// spec: .claude/specs/2026-05-11-ui-action-flows.md ③アシスト / ④事件解決
//
// 仕様:
//   - assist: warning kind ConfirmModal → accept → mutate.partner.assist
//   - solveCase: victory kind ConfirmModal → accept → mutate.partner.solveCase
//   - 各 can-* false → not-allowed
//   - reject → cancelled
//   - 範囲外 (engine): assist 後の FILE 7枚→解決編 自動移行は mutate.partner.assist
//     内部で対応するため UI は気にしない

import { describe, it, expect, beforeEach } from 'vitest';
import { runAssistFlow, runSolveCaseFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState, FileCard } from '@/engine/types/game-state';
import { GENERATED_PARTNERS } from '@/cards';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';

const PR022 = GENERATED_PARTNERS.find(({ id }) => id === 'PR022');
if (!PR022) throw new Error('production PR022 is not registered in GENERATED_PARTNERS');

function setupForAssist(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner = { cardId: 'P1', state: 'active', location: 'partner-area' };
  return s;
}

function setupForSolveCase(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner = { cardId: 'P1', state: 'active', location: 'partner-area' };
  s.players.self.case = { cardId: 'C1', status: '解決編', requiredEvidence: 7, colors: ['blue'] };
  // 7 evidence cards
  s.players.self.evidence = Array.from({ length: 7 }, (_, i) => ({
    cardId: 'card-back',
    faceUp: false,
    origin: { turn: 1, via: 'reasoning' },
  }));
  return s;
}

async function acceptConfirmation(): Promise<void> {
  const r = useConfirmationStore.getState()._resolver!;
  useConfirmationStore.getState()._setCurrent(null);
  useConfirmationStore.getState()._setResolver(null);
  r(true);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

async function rejectConfirmation(): Promise<void> {
  const r = useConfirmationStore.getState()._resolver!;
  useConfirmationStore.getState()._setCurrent(null);
  useConfirmationStore.getState()._setResolver(null);
  r(false);
  await new Promise<void>((r2) => setTimeout(r2, 0));
}

describe('runAssistFlow', () => {
  beforeEach(() => {
    resetDefRegistry();
    registerCardDef(PR022);
    useGameStateStore.setState({ gameState: null });
    useConfirmationStore.getState()._reset();
  });

  it('shows warning kind modal then dispatches assist on accept', async () => {
    useGameStateStore.setState({ gameState: setupForAssist() });
    const promise = runAssistFlow({ player: 'self' });

    expect(useConfirmationStore.getState().current?.kind).toBe('warning');
    expect(useConfirmationStore.getState().current?.title).toContain('アシスト');

    await acceptConfirmation();
    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.partner.state).toBe('sleep');
    expect(after.players.self.partner.location).toBe('file-area');
    expect(after.turnState.self.assistedThisTurn).toBe(true);
  });

  it('returns cancelled on reject', async () => {
    useGameStateStore.setState({ gameState: setupForAssist() });
    const before = useGameStateStore.getState().gameState;
    const promise = runAssistFlow({ player: 'self' });
    await rejectConfirmation();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('shows PR022 FILE 8 transition copy only when assist reaches 8', async () => {
    const atSeven = setupForAssist();
    atSeven.players.self.partner.cardId = PR022.id;
    atSeven.players.self.file = Array.from({ length: 6 }, (): FileCard => ({ type: 'card-back' }));
    useGameStateStore.setState({ gameState: atSeven });
    const belowPromise = runAssistFlow({ player: 'self' });
    expect(useConfirmationStore.getState().current?.body).toContain('現在 FILE 6 枚 → 7 枚');
    expect(useConfirmationStore.getState().current?.body).not.toContain('FILE 8 枚以上');
    await rejectConfirmation();
    await belowPromise;

    const atEight = setupForAssist();
    atEight.players.self.partner.cardId = PR022.id;
    atEight.players.self.file = Array.from({ length: 7 }, (): FileCard => ({ type: 'card-back' }));
    useGameStateStore.setState({ gameState: atEight });
    const thresholdPromise = runAssistFlow({ player: 'self' });
    expect(useConfirmationStore.getState().current?.body).toContain('現在 FILE 7 枚 → 8 枚');
    expect(useConfirmationStore.getState().current?.body).toContain('FILE 8 枚以上');
    await acceptConfirmation();
    expect(await thresholdPromise).toEqual({ ok: true });
    expect(useGameStateStore.getState().gameState?.players.self.case.status).toBe('解決編');
  });

  it('not-allowed when partner is sleep', async () => {
    const s = setupForAssist();
    s.players.self.partner.state = 'sleep';
    useGameStateStore.setState({ gameState: s });
    const result = await runAssistFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('not-allowed when already assisted this turn', async () => {
    const s = setupForAssist();
    s.turnState.self.assistedThisTurn = true;
    useGameStateStore.setState({ gameState: s });
    const result = await runAssistFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });
});

describe('runSolveCaseFlow', () => {
  beforeEach(() => {
    useGameStateStore.setState({ gameState: null });
    useConfirmationStore.getState()._reset();
  });

  it('shows victory kind modal then dispatches solveCase on accept', async () => {
    useGameStateStore.setState({ gameState: setupForSolveCase() });
    const promise = runSolveCaseFlow({ player: 'self' });

    expect(useConfirmationStore.getState().current?.kind).toBe('victory');
    expect(useConfirmationStore.getState().current?.title).toContain('事件解決');

    await acceptConfirmation();
    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.partner.state).toBe('sleep');
    // gameResult が設定されている (engine が勝利判定)
    expect(after.gameResult?.winner).toBe('self');
  });

  it('not-allowed when case is still 事件編', async () => {
    const s = setupForSolveCase();
    s.players.self.case.status = '事件編';
    useGameStateStore.setState({ gameState: s });
    const result = await runSolveCaseFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('not-allowed when evidence < required', async () => {
    const s = setupForSolveCase();
    s.players.self.evidence = s.players.self.evidence.slice(0, 5);
    useGameStateStore.setState({ gameState: s });
    const result = await runSolveCaseFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('not-allowed when assisted this turn (アシスト後同ターン不可)', async () => {
    const s = setupForSolveCase();
    s.turnState.self.assistedThisTurn = true;
    useGameStateStore.setState({ gameState: s });
    const result = await runSolveCaseFlow({ player: 'self' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });
});
