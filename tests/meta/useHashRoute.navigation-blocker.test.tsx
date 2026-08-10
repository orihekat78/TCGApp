import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHashRoute } from '../../meta-app/src/router/useHashRoute';
import type { RouteLeaveGuard } from '../../meta-app/src/router/navigationBlocker';

function Harness({ guard }: { guard: RouteLeaveGuard }) {
  const [route, nav] = useHashRoute(guard);
  return (
    <main>
      <output data-testid="route">{route}</output>
      <button type="button" onClick={() => nav('home')}>home</button>
    </main>
  );
}

describe('useHashRoute navigation blocker', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    window.history.replaceState(null, '', '#deck');
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('rejects an app navigation before changing the hash or mounted route', () => {
    const guard = vi.fn<RouteLeaveGuard>(() => false);
    act(() => root.render(<Harness guard={guard} />));

    act(() => container.querySelector('button')!.click());

    expect(window.location.hash).toBe('#deck');
    expect(container.querySelector('[data-testid="route"]')?.textContent).toBe('deck');
    expect(guard).toHaveBeenCalledWith({ from: 'deck', to: 'home', source: 'app' });
  });

  it('rejects a direct hash write and restores the accepted URL', async () => {
    const guard = vi.fn<RouteLeaveGuard>(() => false);
    act(() => root.render(<Harness guard={guard} />));

    await act(async () => {
      window.location.hash = '#cards';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      await vi.waitFor(() => expect(guard).toHaveBeenCalledOnce());
      await vi.waitFor(() => expect(window.location.hash).toBe('#deck'));
    });

    expect(container.querySelector('[data-testid="route"]')?.textContent).toBe('deck');
    expect(guard).toHaveBeenCalledWith({ from: 'deck', to: 'cards', source: 'hash' });
  });

  it('rejects browser Back and returns to the accepted history entry', async () => {
    window.history.replaceState({ __conanRouteIndex: 0 }, '', '#home');
    window.history.pushState({ __conanRouteIndex: 1 }, '', '#deck');
    const guard = vi.fn<RouteLeaveGuard>(() => false);
    act(() => root.render(<Harness guard={guard} />));

    await act(async () => {
      window.history.back();
      await vi.waitFor(() => expect(guard).toHaveBeenCalledOnce());
      await vi.waitFor(() => expect(window.location.hash).toBe('#deck'));
    });

    expect(container.querySelector('[data-testid="route"]')?.textContent).toBe('deck');
    expect(guard).toHaveBeenCalledWith({ from: 'deck', to: 'home', source: 'history' });
  });
});
