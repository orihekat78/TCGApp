import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { registerAll } from '@/cards';
import { flow } from '@/engine';
import { registerHiramekiListener } from '@/engine/listeners/hirameki';
import { useContactFlowDriver } from '@/ui/hooks/useContactFlowDriver';
import { useHiramekiDemoDriver } from '@/ui/hooks/useHiramekiDemoDriver';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { endMatchSession } from '@/ui/services/matchSession';
import { startHiramekiDemoSession } from '@/ui/services/hiramekiDemoSession';
import { useGameStateStore } from '@/ui/state/store';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function DemoDrivers(): null {
  useHiramekiDemoDriver();
  useContactFlowDriver();
  return null;
}

describe('useHiramekiDemoDriver terminal ownership', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    registerAll();
    registerHiramekiListener();
  });

  beforeEach(() => {
    endMatchSession();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<DemoDrivers />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    endMatchSession();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('keeps D11009 playing through its nested pick, then completes after deferred gain and action cleanup', () => {
    act(() => {
      expect(startHiramekiDemoSession('D11009')).toEqual({ ok: true });
    });
    const initial = useGameStateStore.getState();
    const actionId = initial.activeActionId!;
    const hirameki = initial.pendingHirameki!;
    expect(initial.hiramekiDemoMode).toBe('playing');
    expect(initial.gameState?.players.opp.evidence).toHaveLength(0);

    act(() => {
      expect(dispatchEngineAction(bindPendingDecision(hirameki, {
        type: 'hiramekiResolve',
        choice: 'fire',
      }))).toEqual({ ok: true });
    });

    const paused = useGameStateStore.getState();
    const pick = paused.pendingEffectPick!;
    expect(pick.atomVerb).toBe('sceneSetState');
    expect(paused.hiramekiDemoMode).toBe('playing');
    expect(paused.gameState?.players.opp.evidence).toHaveLength(0);
    expect(flow.action._getContext(paused.gameState!, actionId)).toMatchObject({
      phase: 'judge',
      deferredCaseEvidenceGain: true,
    });

    const target = pick.candidates.find((candidate) => candidate.uid === 'demo-opp-3');
    expect(target).toBeDefined();
    act(() => {
      expect(dispatchEngineAction(bindPendingDecision(pick, {
        type: 'effectPickResolve',
        pickedUid: target!.uid,
      }))).toEqual({ ok: true });
    });

    const completed = useGameStateStore.getState();
    expect(completed.gameState?.players.opp.scene.find((card) => card.uid === target!.uid)?.state)
      .toBe('sleep');
    expect(completed.gameState?.players.opp.evidence).toHaveLength(1);
    expect(flow.action._getContext(completed.gameState!, actionId)).toBeUndefined();
    expect(completed.pendingEffectPick).toBeNull();
    expect(completed.hiramekiDemoMode).toBe('completed');
  });
});
