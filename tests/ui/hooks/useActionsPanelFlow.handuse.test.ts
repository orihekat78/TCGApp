// Phase 8.6: runHandUseFlow tests
//
// rules: 05-turn-phases.md §手札の使用 (1 ターン 1 回 / ネクストヒント済不可)
// spec: .claude/specs/2026-05-11-ui-action-flows.md ①手札の使用
//
// 仕様:
//   - standard kind ConfirmModal → accept → mutate.flag.setHandUseUsed(true)
//   - reject → cancelled (state 不変)
//   - no-state → no-state
//   - not-allowed: cardId が手札にない / handUseUsed済 / nextHintUsed済
//
// 色 / レベル制限は engine.canHandUseCard 側のテストでカバー (CardDef 未登録時は寛容)。

import { describe, it, expect, beforeEach } from 'vitest';
import { runHandUseFlow } from '@/ui/hooks/useActionsPanelFlow';
import { useGameStateStore } from '@/ui/state/store';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { useSceneSwitchPickerStore } from '@/ui/hooks/useSceneSwitchPickerStore';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef } from '@/engine/read/def';
import type { GameState } from '@/engine/types/game-state';

function setupForHandUse(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['CARD-A'];
  return s;
}

function setupForHandUseSwitch(): GameState {
  registerCardDef({
    id: 'CH1',
    no: 'CH1',
    kind: 'character',
    names: ['CH1'],
    colors: ['赤'],
    level: 1,
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  });
  const s = createEmptyGameState();
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.case.colors = ['赤'];
  s.players.self.case.cardId = 'CASE-SELF';
  s.players.self.file.push({ type: 'card-back' });
  s.players.self.hand = ['CH1'];
  for (let i = 0; i < 5; i++) {
    s.players.self.scene.push({
      cardId: `SC${i}`,
      uid: `self-uid-${i}`,
      state: 'active',
      isNamed: false,
      enterOrder: i,
      setCards: [],
      stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null,
      lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    });
  }
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

describe('runHandUseFlow', () => {
  beforeEach(() => {
    useGameStateStore.setState({
      gameState: null,
      pendingPublicHandReveal: null,
    });
    useConfirmationStore.getState()._reset();
    useSceneSwitchPickerStore.getState()._close();
  });

  const effectHandReveal = {
    owner: 'self',
    audience: 'all',
    cardIds: ['CARD-A'],
    handSnapshot: ['CARD-A'],
    lifetime: 'effect',
    resolutionToken: 'public-hand-reveal:hand-use-lock',
    source: {},
  } as const;

  it('shows standard kind modal then dispatches handUseCard on accept', async () => {
    useGameStateStore.setState({ gameState: setupForHandUse() });
    const promise = runHandUseFlow({ player: 'self', cardId: 'CARD-A' });

    expect(useConfirmationStore.getState().current?.kind).toBe('standard');
    expect(useConfirmationStore.getState().current?.title).toContain('手札の使用');

    await acceptConfirmation();
    const result = await promise;
    expect(result.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.turnState.self.handUseUsed).toBe(true);
  });

  it('returns cancelled on reject and leaves state unchanged', async () => {
    useGameStateStore.setState({ gameState: setupForHandUse() });
    const before = useGameStateStore.getState().gameState;
    const promise = runHandUseFlow({ player: 'self', cardId: 'CARD-A' });
    await rejectConfirmation();
    const result = await promise;
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('cancelled');
    expect(useGameStateStore.getState().gameState).toBe(before);
  });

  it('returns no-state when gameState is null', async () => {
    const result = await runHandUseFlow({ player: 'self', cardId: 'CARD-A' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('no-state');
  });

  it('not-allowed when cardId is not in hand', async () => {
    useGameStateStore.setState({ gameState: setupForHandUse() });
    const result = await runHandUseFlow({ player: 'self', cardId: 'NOT-IN-HAND' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('not-allowed when handUseUsed is already true', async () => {
    const s = setupForHandUse();
    s.turnState.self.handUseUsed = true;
    useGameStateStore.setState({ gameState: s });
    const result = await runHandUseFlow({ player: 'self', cardId: 'CARD-A' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('not-allowed when nextHintUsed is already true (rules/05)', async () => {
    const s = setupForHandUse();
    s.turnState.self.nextHintUsed = true;
    useGameStateStore.setState({ gameState: s });
    const result = await runHandUseFlow({ player: 'self', cardId: 'CARD-A' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('not-allowed');
  });

  it('does not open confirmation while an exclusive decision owns interaction', async () => {
    useGameStateStore.setState({
      gameState: setupForHandUse(),
      pendingPublicHandReveal: effectHandReveal,
    });

    const promise = runHandUseFlow({ player: 'self', cardId: 'CARD-A' });
    const openedConfirmation = useConfirmationStore.getState().current !== null;
    if (openedConfirmation) await rejectConfirmation();
    const result = await promise;

    expect(openedConfirmation).toBe(false);
    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
  });

  it('revalidates interaction ownership after confirmation', async () => {
    useGameStateStore.setState({ gameState: setupForHandUse() });
    const promise = runHandUseFlow({ player: 'self', cardId: 'CARD-A' });
    expect(useConfirmationStore.getState().current).not.toBeNull();

    useGameStateStore.setState({ pendingPublicHandReveal: effectHandReveal });
    await acceptConfirmation();
    const result = await promise;

    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState?.turnState.self.handUseUsed).toBe(false);
  });

  it('revalidates interaction ownership after the switch victim is selected', async () => {
    useGameStateStore.setState({ gameState: setupForHandUseSwitch() });
    const promise = runHandUseFlow({ player: 'self', cardId: 'CH1' });

    await acceptConfirmation();
    const picker = useSceneSwitchPickerStore.getState().current;
    expect(picker).not.toBeNull();

    useGameStateStore.setState({
      pendingPublicHandReveal: {
        ...effectHandReveal,
        cardIds: ['CH1'],
        handSnapshot: ['CH1'],
      },
    });
    useSceneSwitchPickerStore.getState()._close();
    picker?.resolve(picker.candidates[0].uid);

    const result = await promise;
    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState?.players.self.hand).toContain('CH1');
    expect(useGameStateStore.getState().gameState?.players.self.scene).toHaveLength(5);
    expect(useGameStateStore.getState().gameState?.turnState.self.handUseUsed).toBe(false);
  });
});
