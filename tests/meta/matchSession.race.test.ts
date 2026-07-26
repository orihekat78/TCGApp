import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAll } from '@/cards';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { useMulliganStore, resolveMulligan } from '@/ui/hooks/useMulligan';
import { useTargetPicker, useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import {
  beginMatchSession,
  commitMatchSession,
  endMatchSession,
  isCurrentMatchSession,
} from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../meta-app/src/data/sampleDeck';
import { customGameStart } from '../../meta-app/src/util/customGameStart';

type GuardedStartOptions = Parameters<typeof customGameStart>[2] & {
  isSessionCurrent: () => boolean;
};

describe('real match-session cancellation race', () => {
  beforeEach(() => {
    endMatchSession();
    engine.cards._resetRegistry();
    event._resetRegistry();
    registerAll();
  });

  afterEach(() => {
    endMatchSession();
    useGameStateStore.setState({ gameState: null });
    vi.restoreAllMocks();
  });

  it('leaving a real mulligan then starting again cannot commit, navigate, or leak stale pending state', async () => {
    const startGame = vi.spyOn(engine.flow.setup, 'startGame');
    const nav = vi.fn<(route: 'match' | 'setup') => void>();
    const staleToken = beginMatchSession('self');
    nav('match');
    const staleStart = customGameStart(SAMPLE_DECK, SAMPLE_DECK_OPP, {
      firstPlayer: 'self',
      isSessionCurrent: () => isCurrentMatchSession(staleToken),
    } as GuardedStartOptions);
    const staleHandled = staleStart.then(
      (state) => commitMatchSession(staleToken, state),
      () => {
        if (isCurrentMatchSession(staleToken)) nav('setup');
        return false;
      },
    );

    expect(useMulliganStore.getState().current?.player).toBe('self');
    const pickerDone = vi.fn();
    void useTargetPicker().start({ candidates: ['stale-target'] }).then(pickerDone);
    useGameStateStore.setState({ pendingEffectOptional: {} as never });
    const globals = globalThis as Record<string, unknown>;
    globals.__pendingEffectPickQueue = [{ player: 'self', source: { cardId: 'STALE' } }];
    globals.__pendingEffectPickSide = (globals.__pendingEffectPickQueue as unknown[])[0];

    endMatchSession();
    nav('setup');
    await Promise.resolve();
    const mulliganWasSettledOnLeave = useMulliganStore.getState().current === null;
    const pickerWasSettledOnLeave = useTargetPickerStore.getState().phase.phase === 'idle';
    if (!mulliganWasSettledOnLeave) resolveMulligan([]);

    const freshToken = beginMatchSession('self');
    nav('match');
    const freshState = await customGameStart(SAMPLE_DECK_OPP, SAMPLE_DECK, {
      spectator: true,
      firstPlayer: 'opp',
      isSessionCurrent: () => isCurrentMatchSession(freshToken),
    } as GuardedStartOptions);
    expect(commitMatchSession(freshToken, freshState)).toBe(true);
    expect(await staleHandled).toBe(false);
    await Promise.resolve();

    expect(mulliganWasSettledOnLeave).toBe(true);
    expect(pickerWasSettledOnLeave).toBe(true);
    expect(pickerDone).toHaveBeenCalledWith(null);
    expect(nav.mock.calls.map(([route]) => route)).toEqual(['match', 'setup', 'match']);
    expect(startGame).toHaveBeenCalledTimes(1);
    expect(useGameStateStore.getState().gameState).toBe(freshState);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
    expect(globals.__pendingEffectPickQueue).toEqual([]);
    expect(globals.__pendingEffectPickSide ?? null).toBeNull();

    // Leaving match for the result route must clear transient ownership while
    // retaining the completed GameState consumed by ResultScreen.
    endMatchSession({ preserveGameState: true });
    expect(useGameStateStore.getState().gameState).toBe(freshState);
    expect(useGameStateStore.getState().pendingEffectOptional).toBeNull();
  });
});
