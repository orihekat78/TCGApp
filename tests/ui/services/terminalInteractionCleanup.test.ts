import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { useChoicePicker, useChoicePickerStore } from '@/ui/hooks/useChoicePicker';
import { useConfirmation, useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { useContactModalStore } from '@/ui/hooks/useContactModalStore';
import { useDeclareNamePicker, useDeclareNamePickerStore } from '@/ui/hooks/useDeclareNamePicker';
import { useEvidenceFlipPicker, useEvidenceFlipPickerStore } from '@/ui/hooks/useEvidenceFlipPicker';
import { useHandCostPicker, useHandCostPickerStore } from '@/ui/hooks/useHandCostPicker';
import { useMulliganStore, promptMulligan } from '@/ui/hooks/useMulligan';
import { useNextHintPicker, useNextHintPickerStore } from '@/ui/hooks/useNextHintPicker';
import { useSceneSwitchPickerStore } from '@/ui/hooks/useSceneSwitchPickerStore';
import { useSetCardCostPicker } from '@/ui/hooks/useSetCardCostPicker';
import { useStackedCardCostPicker, useStackedCardCostPickerStore } from '@/ui/hooks/useStackedCardCostPicker';
import { useTargetPicker, useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { beginMatchSession, commitMatchSession, resetMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { areTerminalInteractionsBlocked, currentInteractionEpoch } from '@/ui/services/terminalInteractionGate';
import { cleanupTerminalInteractions } from '@/ui/services/terminalInteractionCleanup';

describe('terminal interaction cleanup', () => {
  beforeEach(() => resetMatchSession());
  afterEach(() => resetMatchSession());

  it('settles every live prompt when an ordinary terminal state commits', async () => {
    const session = beginMatchSession('self');
    const initial = createEmptyGameState();
    expect(commitMatchSession(session, initial)).toBe(true);

    const target = useTargetPicker().start({ candidates: ['target-1'] });
    const confirmation = useConfirmation().ask({ kind: 'warning', title: 'Confirm', body: 'Body' });
    const choice = useChoicePicker().ask({ sourceName: 'Choice', options: [{ index: 0, label: 'One' }] });
    const declare = useDeclareNamePicker().ask({ sourceName: 'Declare', prompt: 'Name', candidateNames: ['A'], optional: true });
    const evidence = useEvidenceFlipPicker().ask({ side: 'self', sourceName: 'Evidence', candidates: [{ index: 0, cardId: 'E' }], nMin: 1, nMax: 1 });
    const hand = useHandCostPicker().ask({ side: 'self', sourceName: 'Hand', candidates: [{ index: 0, cardId: 'H' }], n: 1 });
    const nextHint = useNextHintPicker().ask({ fileTopCardId: 'F', fileTopName: 'File', candidates: [], postPopCount: 0 });
    const setCard = useSetCardCostPicker().ask({ player: 'self', source: { uid: 'source', cardId: 'S', abilityId: 'a1' }, candidates: [], n: 0 });
    const stacked = useStackedCardCostPicker().ask({ sourceName: 'Stacked', candidates: [], nMin: 0, nMax: 0 });
    const mulligan = promptMulligan({ player: 'self', hand: ['M'] });
    let sceneResult: string | null | undefined;
    useSceneSwitchPickerStore.getState()._open({ cardId: 'C', newCardName: 'Card', candidates: [], resolve: (value) => { sceneResult = value; } });
    useContactModalStore.getState()._setGuardPicker({ actionId: 'action', candidates: [] });

    const terminal = structuredClone(initial);
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    expect(commitMatchSession(session, terminal)).toBe(true);

    await expect(target).resolves.toBeNull();
    await expect(confirmation).resolves.toBe(false);
    await expect(choice).resolves.toEqual({ kind: 'cancel' });
    await expect(declare).resolves.toEqual({ kind: 'cancel' });
    await expect(evidence).resolves.toEqual({ kind: 'cancel' });
    await expect(hand).resolves.toEqual({ kind: 'cancel' });
    await expect(nextHint).resolves.toEqual({ kind: 'cancel' });
    await expect(setCard).resolves.toEqual({ kind: 'cancel' });
    await expect(stacked).resolves.toEqual({ kind: 'cancel' });
    await expect(mulligan).resolves.toEqual([]);
    expect(sceneResult).toBeNull();
    expect(useTargetPickerStore.getState().phase).toEqual({ phase: 'idle' });
    expect(useConfirmationStore.getState().current).toBeNull();
    expect(useChoicePickerStore.getState().current).toBeNull();
    expect(useDeclareNamePickerStore.getState().current).toBeNull();
    expect(useEvidenceFlipPickerStore.getState().current).toBeNull();
    expect(useHandCostPickerStore.getState().current).toBeNull();
    expect(useNextHintPickerStore.getState().current).toBeNull();
    expect(useStackedCardCostPickerStore.getState().current).toBeNull();
    expect(useMulliganStore.getState().current).toBeNull();
    expect(useSceneSwitchPickerStore.getState().current).toBeNull();
    expect(useContactModalStore.getState().guardPicker).toBeNull();
    expect(useGameStateStore.getState().gameState).toMatchObject({ gameResult: { winner: 'self' } });
    expect(useGameStateStore.getState().pendingEffectChoice).toBeNull();
  });

  it('keeps late interaction handlers inert after terminal publication', async () => {
    const session = beginMatchSession('self');
    const initial = createEmptyGameState();
    expect(commitMatchSession(session, initial)).toBe(true);
    const terminal = structuredClone(initial);
    terminal.gameResult = { winner: 'opp', reason: 'deck-out' };
    expect(commitMatchSession(session, terminal)).toBe(true);

    await expect(useTargetPicker().start({ candidates: ['target-1'] })).resolves.toBeNull();
    await expect(useConfirmation().ask({ kind: 'standard', title: 'Late', body: 'Late' })).resolves.toBe(false);
    await expect(useChoicePicker().ask({ sourceName: 'Late', options: [] })).resolves.toEqual({ kind: 'cancel' });
    await expect(useSetCardCostPicker().ask({ player: 'self', source: { uid: 'source', cardId: 'S', abilityId: 'a1' }, candidates: [], n: 0 })).resolves.toEqual({ kind: 'cancel' });
    await expect(promptMulligan({ player: 'self', hand: ['M'] })).resolves.toEqual([]);

    let sceneResult: string | null | undefined;
    useSceneSwitchPickerStore.getState()._open({ cardId: 'C', newCardName: 'Card', candidates: [], resolve: (value) => { sceneResult = value; } });
    useContactModalStore.getState()._setGuardPicker({ actionId: 'late', candidates: [] });
    expect(sceneResult).toBeNull();
    expect(useSceneSwitchPickerStore.getState().current).toBeNull();
    expect(useContactModalStore.getState().guardPicker).toBeNull();
  });

  it('publishes cleanup once for a nonterminal-to-terminal transition', () => {
    const session = beginMatchSession('self');
    const initial = createEmptyGameState();
    expect(commitMatchSession(session, initial)).toBe(true);
    const terminal = structuredClone(initial);
    terminal.gameResult = { winner: 'self', reason: 'evidence' };
    expect(commitMatchSession(session, terminal)).toBe(true);
    const afterFirstTerminal = currentInteractionEpoch();

    expect(useGameStateStore.getState().setGameState(terminal)).toBe(true);
    expect(currentInteractionEpoch()).toBe(afterFirstTerminal);
  });

  it('continues settling later prompts when an earlier Zustand observer throws', async () => {
    useContactModalStore.getState()._setGuardPicker({ actionId: 'action', candidates: [] });
    const target = useTargetPicker().start({ candidates: ['target-1'] });
    const unsubscribe = useContactModalStore.subscribe(() => { throw new Error('observer failure'); });
    try {
      expect(() => cleanupTerminalInteractions()).not.toThrow();
      await expect(target).resolves.toBeNull();
      expect(useTargetPickerStore.getState().phase).toEqual({ phase: 'idle' });
    } finally {
      unsubscribe();
    }
  });

  it('does not settle live interaction or gate while projecting a terminal replay frame', async () => {
    const session = beginMatchSession('self');
    const initial = createEmptyGameState();
    expect(commitMatchSession(session, initial)).toBe(true);
    const pending = useTargetPicker().start({ candidates: ['target-1'] });
    const epoch = currentInteractionEpoch();
    const replayTerminal = structuredClone(initial);
    replayTerminal.gameResult = { winner: 'opp', reason: 'deck-out' };

    useGameStateStore.getState().setReplayGameState(replayTerminal);

    expect(currentInteractionEpoch()).toBe(epoch);
    expect(areTerminalInteractionsBlocked()).toBe(false);
    expect(useTargetPickerStore.getState().phase).not.toEqual({ phase: 'idle' });
    useTargetPickerStore.getState()._setPhase({ phase: 'idle' });
    const resolver = useTargetPickerStore.getState()._resolver;
    useTargetPickerStore.getState()._setResolver(null);
    resolver?.(null);
    await expect(pending).resolves.toBeNull();
  });
});
