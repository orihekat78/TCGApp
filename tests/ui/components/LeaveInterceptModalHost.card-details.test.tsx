import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeaveInterceptModalHost } from '@/ui/components/LeaveInterceptModalHost';
import { useGameStateStore } from '@/ui/state/store';

const { dispatchEngineActionMock } = vi.hoisted(() => ({ dispatchEngineActionMock: vi.fn() }));
vi.mock('@/ui/hooks/useEngineDispatch.js', () => ({ dispatchEngineAction: dispatchEngineActionMock }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('LeaveInterceptModalHost card details', () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    useGameStateStore.setState({
      gameState: {
        players: {
          self: {
            scene: [
              { uid: 'interceptor', cardId: 'B01001', state: 'active' },
              { uid: 'target', cardId: 'B01002', state: 'active' },
            ],
          },
          opp: { scene: [] },
        },
      } as never,
      pendingLeaveIntercept: { player: 'self', targetUid: 'target', interceptorUid: 'interceptor', actionId: 'ax' },
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

  it('shows the two known scene cards with separate detail controls while preserving the yes/no decision', () => {
    act(() => root.render(<LeaveInterceptModalHost />));
    const interceptor = container.querySelector<HTMLButtonElement>('[data-testid="leave-intercept-card-interceptor"]');
    const target = container.querySelector<HTMLButtonElement>('[data-testid="leave-intercept-card-target"]');
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="leave-intercept-card-detail-target"]');
    expect(interceptor).toBeInstanceOf(HTMLButtonElement);
    expect(target).toBeInstanceOf(HTMLButtonElement);
    expect(detail).toBeInstanceOf(HTMLButtonElement);
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
});
