import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { produce } from 'immer';
import { registerAll } from '@/cards';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { sceneChar } from '../../helpers/fixtures';
import { LeaveInterceptModalHost } from '@/ui/components/LeaveInterceptModalHost';
import { useGameStateStore } from '@/ui/state/store';

const { dispatchEngineActionMock } = vi.hoisted(() => ({ dispatchEngineActionMock: vi.fn() }));
vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({ dispatchEngineAction: dispatchEngineActionMock }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function legalLeaveInterceptState() {
  registerAll();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  const base = createEmptyGameState();
  base.turn = { number: 3, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  base.players.self.scene = [
    sceneChar('B01092', 'interceptor'),
    sceneChar('D08003', 'target', { state: 'sleep' }),
  ];
  base.players.opp.scene = [sceneChar('D11003', 'opponent-attacker')];
  let pending: { player: 'self' | 'opp'; targetUid: string; interceptorUid: string } | undefined;
  const gameState = produce(base, (draft) => {
    const result = mutate.scene.removeToRemove(draft, 'target', 'contact-ap', 'opponent-attacker');
    expect(result.deferred).toBe(true);
    pending = result.pendingLeaveIntercept;
  });
  expect(pending).toEqual({ player: 'self', targetUid: 'target', interceptorUid: 'interceptor' });
  return { gameState, pending: { ...pending!, actionId: 'legal-contact' } };
}

describe('LeaveInterceptModalHost card details', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    const legal = legalLeaveInterceptState();
    useGameStateStore.setState({
      gameState: legal.gameState,
      pendingLeaveIntercept: legal.pending,
    });
    dispatchEngineActionMock.mockClear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameStateStore.setState({ pendingLeaveIntercept: null });
  });

  it('derives B01092 leave intercept from a legal opponent contact removal and dispatches accept', () => {
    act(() => root.render(<LeaveInterceptModalHost />));
    const interceptor = container.querySelector<HTMLButtonElement>('[data-testid="leave-intercept-card-interceptor"]');
    const target = container.querySelector<HTMLButtonElement>('[data-testid="leave-intercept-card-target"]');
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="leave-intercept-card-detail-target"]');
    expect(interceptor).toBeInstanceOf(HTMLButtonElement);
    expect(target).toBeInstanceOf(HTMLButtonElement);
    expect(detail).toBeInstanceOf(HTMLButtonElement);
    expect(interceptor!.getAttribute('aria-label')).toContain('置換');
    expect(target!.getAttribute('aria-label')).toContain('対象');
    expect(detail!.getAttribute('aria-label')).toContain('対象');
    expect(container.querySelectorAll('.leave-intercept-card img.card-art')).toHaveLength(2);
    expect(container.querySelector('button button')).toBeNull();

    act(() => detail!.click());
    expect(container.querySelector('.card-expand-close')).not.toBeNull();
    expect(dispatchEngineActionMock).not.toHaveBeenCalled();
    act(() => (container.querySelector<HTMLButtonElement>('.card-expand-close')!).click());

    const context = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => interceptor!.dispatchEvent(context));
    expect(context.defaultPrevented).toBe(true);
    expect(container.querySelector('.card-expand-close')).not.toBeNull();
    act(() => (container.querySelector<HTMLButtonElement>('.card-expand-close')!).click());

    act(() => (container.querySelector<HTMLButtonElement>('[data-testid="leave-intercept-yes"]')!).click());
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({ type: 'leaveInterceptResolve', accept: true });
  });

  it('keeps the same legal B01092 decision available for decline', () => {
    act(() => root.render(<LeaveInterceptModalHost />));
    act(() => (container.querySelector<HTMLButtonElement>('[data-testid="leave-intercept-no"]')!).click());
    expect(dispatchEngineActionMock).toHaveBeenCalledWith({ type: 'leaveInterceptResolve', accept: false });
  });
});
