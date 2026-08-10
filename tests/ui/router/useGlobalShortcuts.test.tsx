import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardListModal } from '@/ui/components/CardListModal';
import { LogPanel } from '@/ui/components/LogPanel';
import { useGlobalShortcuts } from '../../../meta-app/src/router/useGlobalShortcuts';
import type { Route } from '../../../meta-app/src/router/routes';

function ShortcutHarness({ onNav, route = 'match' }: { onNav: (route: Route) => void; route?: Route }): null {
  useGlobalShortcuts({ route, onNav });
  return null;
}

describe('useGlobalShortcuts modal priority', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('match中のEscapeは進行中の対戦をHOMEへ離脱させない', () => {
    const onNav = vi.fn();
    act(() => {
      root.render(<ShortcutHarness route="match" onNav={onNav} />);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onNav).not.toHaveBeenCalled();
  });

  it('CardList aria-modal表示中のEscapeはモーダルだけを閉じHOMEへ遷移しない', () => {
    const onNav = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(
        <>
          <ShortcutHarness onNav={onNav} />
          <CardListModal kind="remove" side="self" cards={[]} onClose={onClose} />
        </>,
      );
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNav).not.toHaveBeenCalled();
  });

  it('LogPanel表示中のEscapeはログを1回だけ閉じHOMEへ遷移しない', () => {
    const onNav = vi.fn();
    const onClose = vi.fn();
    act(() => {
      root.render(
        <>
          <ShortcutHarness onNav={onNav} />
          <LogPanel entries={[]} open onClose={onClose} />
        </>,
      );
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onNav).not.toHaveBeenCalled();
  });

  it.each(['h', 'd', 'c', 't', 's', 'p', 'm', 'r', 'y', 'l'])(
    'aria-modal表示中はナビゲーションhotkey %s を無視する',
    (key) => {
      const onNav = vi.fn();
      act(() => {
        root.render(
          <>
            <ShortcutHarness onNav={onNav} />
            <LogPanel entries={[]} open onClose={vi.fn()} />
          </>,
        );
      });

      act(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
      });

      expect(onNav).not.toHaveBeenCalled();
    },
  );

  it('aria-modal表示中はHOMEのEnterナビゲーションを無視する', () => {
    const onNav = vi.fn();
    act(() => {
      root.render(
        <>
          <ShortcutHarness route="home" onNav={onNav} />
          <LogPanel entries={[]} open onClose={vi.fn()} />
        </>,
      );
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onNav).not.toHaveBeenCalled();
  });

  it('HOMEの操作要素をEnterで実行するときはグローバル遷移を割り込ませない', () => {
    const onNav = vi.fn();
    act(() => {
      root.render(
        <>
          <ShortcutHarness route="home" onNav={onNav} />
          <button type="button">メニュー</button>
        </>,
      );
    });

    const button = container.querySelector('button')!;
    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(onNav).not.toHaveBeenCalled();
  });

  it.each([
    ['Escape', 'home'],
    ['d', 'deck'],
  ] as const)('操作要素にフォーカス中も既存ショートカット %s を維持する', (key, expectedRoute) => {
    const onNav = vi.fn();
    act(() => {
      root.render(
        <>
          <ShortcutHarness route="setup" onNav={onNav} />
          <button type="button">設定項目</button>
        </>,
      );
    });

    const button = container.querySelector('button')!;
    act(() => {
      button.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });

    expect(onNav).toHaveBeenCalledWith(expectedRoute);
  });

  it.each([
    ['Escape', 'home'],
    ['d', 'deck'],
  ] as const)('選択欄にフォーカス中も既存ショートカット %s を維持する', (key, expectedRoute) => {
    const onNav = vi.fn();
    act(() => {
      root.render(
        <>
          <ShortcutHarness route="setup" onNav={onNav} />
          <select aria-label="デッキ選択"><option>標準</option></select>
        </>,
      );
    });

    const select = container.querySelector('select')!;
    act(() => {
      select.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    });

    expect(onNav).toHaveBeenCalledWith(expectedRoute);
  });
});
