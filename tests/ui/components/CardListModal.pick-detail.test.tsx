import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardListModal } from '@/ui/components/CardListModal';
import { cardIdToDisplayName, cardIdToPrintedNumber } from '@/ui/services/uidNames';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CardListModal pick detail controls', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps a public pick primary separate from its detail control', () => {
    const onPick = vi.fn();
    const onExpand = vi.fn();
    act(() => {
      root.render(
        <CardListModal
          kind="deck"
          side="self"
          cards={['D08003']}
          pickCands={[{ uid: 'D08003#0', cardId: 'D08003', player: 'self' }]}
          onPick={onPick}
          onExpand={onExpand}
          onClose={vi.fn()}
        />,
      );
    });

    const primary = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-D08003#0"]');
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-detail-D08003#0"]');
    expect(primary).not.toBeNull();
    expect(detail).not.toBeNull();
    expect(primary?.parentElement).toBe(detail?.parentElement);
    expect(primary?.querySelector('button')).toBeNull();
    expect(detail?.querySelector('button')).toBeNull();
    expect(detail?.classList.contains('card-list-pick-detail')).toBe(true);

    act(() => detail!.click());
    expect(onExpand).toHaveBeenCalledWith('D08003');
    expect(onPick).not.toHaveBeenCalled();

    act(() => primary!.click());
    expect(onPick).toHaveBeenCalledWith('D08003#0');

    const contextEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => primary!.dispatchEvent(contextEvent));
    expect(contextEvent.defaultPrevented).toBe(true);
    expect(onExpand).toHaveBeenCalledTimes(2);
  });

  it('distinguishes duplicate public pick occurrences while preserving their exact uid and detail card', () => {
    const onPick = vi.fn();
    const onExpand = vi.fn();
    act(() => {
      root.render(
        <CardListModal
          kind="deck"
          side="self"
          cards={['D08003', 'D08003']}
          pickCands={[
            { uid: 'D08003#0', cardId: 'D08003', player: 'self' },
            { uid: 'D08003#1', cardId: 'D08003', player: 'self' },
          ]}
          onPick={onPick}
          onExpand={onExpand}
          onClose={vi.fn()}
        />,
      );
    });

    const firstUid = 'D08003#0';
    const secondUid = 'D08003#1';
    const first = container.querySelector<HTMLButtonElement>(`[data-testid="card-list-pick-${firstUid}"]`)!;
    const second = container.querySelector<HTMLButtonElement>(`[data-testid="card-list-pick-${secondUid}"]`)!;
    const firstDetail = container.querySelector<HTMLButtonElement>(`[data-testid="card-list-pick-detail-${firstUid}"]`)!;
    const secondDetail = container.querySelector<HTMLButtonElement>(`[data-testid="card-list-pick-detail-${secondUid}"]`)!;
    const primaryNames = [first, second].map((button) => button.getAttribute('aria-label'));
    const detailNames = [firstDetail, secondDetail].map((button) => button.getAttribute('aria-label'));
    const name = cardIdToDisplayName('D08003');
    expect(primaryNames).toEqual([`${name} 1枚目 を選択`, `${name} 2枚目 を選択`]);
    expect(detailNames).toEqual([`${name} 1枚目 の詳細を表示`, `${name} 2枚目 の詳細を表示`]);
    const allNames = [...primaryNames, ...detailNames].join(' ');
    expect(allNames).not.toContain('D08003#0');
    expect(allNames).not.toContain('D08003#1');

    act(() => second.click());
    expect(onPick).toHaveBeenCalledWith(secondUid);
    act(() => secondDetail.click());
    expect(onExpand).toHaveBeenCalledWith('D08003');
  });

  it('keeps a singleton public pick free of an occurrence ordinal and internal uid', () => {
    act(() => {
      root.render(
        <CardListModal
          kind="deck"
          side="self"
          cards={['D08003']}
          pickCands={[{ uid: 'actual-candidate-uid:0', cardId: 'D08003', player: 'self' }]}
          onPick={vi.fn()}
          onExpand={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    const name = cardIdToDisplayName('D08003');
    const primary = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-actual-candidate-uid:0"]')!;
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-detail-actual-candidate-uid:0"]')!;
    expect(primary.getAttribute('aria-label')).toBe(`${name} を選択`);
    expect(detail.getAttribute('aria-label')).toBe(`${name} の詳細を表示`);
    expect(`${primary.getAttribute('aria-label')} ${detail.getAttribute('aria-label')}`).not.toContain('actual-candidate-uid:0');
    expect(`${primary.getAttribute('aria-label')} ${detail.getAttribute('aria-label')}`).not.toContain('枚目');
  });

  it('orders duplicate face-up evidence occurrence labels by physical evidence index', () => {
    act(() => {
      root.render(
        <CardListModal
          kind="evidence"
          side="self"
          cards={[]}
          faceDownCount={3}
          faceUpEvidence={[{ index: 2, cardId: 'D08003' }, { index: 0, cardId: 'D08003' }]}
          pickCands={[
            { uid: 'evidence:self:0', cardId: 'D08003', player: 'self' },
            { uid: 'evidence:self:2', cardId: 'D08003', player: 'self' },
          ]}
          onPick={vi.fn()}
          onExpand={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('[data-testid="card-list-pick-detail-evidence:self:0"]')?.getAttribute('aria-label')).toContain('1枚目');
    expect(container.querySelector('[data-testid="card-list-pick-detail-evidence:self:2"]')?.getAttribute('aria-label')).toContain('2枚目');
  });

  it('never exposes a face-down evidence pick to detail expansion', () => {
    act(() => {
      root.render(
        <CardListModal
          kind="evidence"
          side="self"
          cards={[]}
          faceDownCount={1}
          pickCands={[{ uid: 'evidence:self:0', cardId: 'D08007', player: 'self' }]}
          onPick={vi.fn()}
          onExpand={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('[data-testid="card-list-pick-evidence:self:0"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="card-list-pick-detail-evidence:self:0"]')).toBeNull();
    expect(container.innerHTML).not.toContain('D08007');
    expect(container.innerHTML).not.toContain(cardIdToDisplayName('D08007'));
    expect(container.innerHTML).not.toContain(cardIdToPrintedNumber('D08007'));
  });

  it('omits detail controls when no expansion handler exists', () => {
    act(() => {
      root.render(
        <CardListModal
          kind="deck"
          side="self"
          cards={['D08003']}
          pickCands={[{ uid: 'D08003#0', cardId: 'D08003', player: 'self' }]}
          onPick={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });

    expect(container.querySelector('[data-testid="card-list-pick-detail-D08003#0"]')).toBeNull();
  });

  it('keeps multi-pick selection and payload after public card details close', () => {
    const onPickMulti = vi.fn();
    function Harness(): JSX.Element {
      const [expanded, setExpanded] = useState<string | null>(null);
      return (
        <>
          <CardListModal
            kind="deck"
            side="self"
            cards={['D08003', 'D08004']}
            pickCands={[
              { uid: 'D08003#0', cardId: 'D08003', player: 'self' },
              { uid: 'D08004#1', cardId: 'D08004', player: 'self' },
            ]}
            pickNMin={1}
            pickNMax={2}
            onPick={vi.fn()}
            onPickMulti={onPickMulti}
            onExpand={setExpanded}
            onClose={vi.fn()}
          />
          {expanded && <button type="button" data-testid="detail-close" onClick={() => setExpanded(null)}>close</button>}
        </>
      );
    }
    act(() => root.render(<Harness />));

    const primary = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-D08003#0"]')!;
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-detail-D08003#0"]')!;
    act(() => primary.click());
    expect(primary.getAttribute('aria-pressed')).toBe('true');
    act(() => detail.click());
    act(() => (container.querySelector<HTMLButtonElement>('[data-testid="detail-close"]')!).click());
    expect(primary.getAttribute('aria-pressed')).toBe('true');
    act(() => (container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-confirm"]')!).click());
    expect(onPickMulti).toHaveBeenCalledWith(['D08003#0']);
  });

  it('keeps face-up evidence multi-pick selection after details close', () => {
    const onPickMulti = vi.fn();
    function Harness(): JSX.Element {
      const [expanded, setExpanded] = useState<string | null>(null);
      return (
        <>
          <CardListModal
            kind="evidence"
            side="self"
            cards={[]}
            faceDownCount={1}
            faceUpEvidence={[{ index: 0, cardId: 'D08003' }]}
            pickCands={[{ uid: 'evidence:self:0', cardId: 'D08003', player: 'self' }]}
            pickNMin={1}
            pickNMax={2}
            onPick={vi.fn()}
            onPickMulti={onPickMulti}
            onExpand={setExpanded}
            onClose={vi.fn()}
          />
          {expanded && <button type="button" data-testid="detail-close" onClick={() => setExpanded(null)}>close</button>}
        </>
      );
    }
    act(() => root.render(<Harness />));

    const primary = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-evidence:self:0"]')!;
    act(() => primary.click());
    act(() => (container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-detail-evidence:self:0"]')!).click());
    act(() => (container.querySelector<HTMLButtonElement>('[data-testid="detail-close"]')!).click());
    expect(primary.getAttribute('aria-pressed')).toBe('true');
    act(() => (container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-confirm"]')!).click());
    expect(onPickMulti).toHaveBeenCalledWith(['evidence:self:0']);
  });

  it('retains selection for the same session but resets it for a new session with identical candidates', () => {
    const sessionA = {};
    const sessionB = {};
    const render = (pickSessionKey: object): void => {
      root.render(
        <CardListModal
          kind="deck"
          side="self"
          cards={['D08003']}
          pickCands={[{ uid: 'D08003#0', cardId: 'D08003', player: 'self' }]}
          pickSessionKey={pickSessionKey}
          pickNMin={1}
          pickNMax={2}
          onPick={vi.fn()}
          onPickMulti={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    };
    act(() => render(sessionA));
    const primary = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-D08003#0"]')!;
    act(() => primary.click());
    expect(primary.getAttribute('aria-pressed')).toBe('true');
    act(() => render(sessionA));
    expect(primary.getAttribute('aria-pressed')).toBe('true');
    act(() => render(sessionB));
    expect(primary.getAttribute('aria-pressed')).toBe('false');
  });

  it('applies forced and blocked semantics to face-up evidence picks', () => {
    const candidates = [
      { uid: 'evidence:self:0', cardId: 'D08003' as const, player: 'self' as const },
      { uid: 'evidence:self:1', cardId: 'D08004' as const, player: 'self' as const },
    ];
    act(() => {
      root.render(
        <CardListModal kind="evidence" side="self" cards={[]} faceDownCount={2}
          faceUpEvidence={[{ index: 0, cardId: 'D08003' }, { index: 1, cardId: 'D08004' }]}
          pickCands={candidates} pickForcedUids={['evidence:self:0']} onPick={vi.fn()} onExpand={vi.fn()} onClose={vi.fn()} />,
      );
    });
    const forced = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-evidence:self:0"]')!;
    const blocked = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-evidence:self:1"]')!;
    expect(forced.disabled).toBe(false);
    expect(forced.getAttribute('aria-description')).toBe('必ず選択 (強制対象)');
    expect(forced.getAttribute('aria-label')).toContain('必ず選択 (解除不可)');
    expect(blocked.disabled).toBe(true);
    expect(blocked.getAttribute('aria-description')).toBe('選択不可');
    expect(blocked.getAttribute('aria-label')).toContain('選択不可');
    expect(blocked.getAttribute('title')).not.toBeNull();
    expect(container.querySelector('[data-testid="card-list-pick-detail-evidence:self:1"]')).not.toBeNull();

    act(() => {
      root.render(
        <CardListModal kind="evidence" side="self" cards={[]} faceDownCount={1}
          faceUpEvidence={[{ index: 0, cardId: 'D08003' }]}
          pickCands={[candidates[0]!]} pickForcedUids={['evidence:self:0']} pickNMin={1} pickNMax={2}
          onPick={vi.fn()} onPickMulti={vi.fn()} onExpand={vi.fn()} onClose={vi.fn()} />,
      );
    });
    const locked = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-evidence:self:0"]')!;
    expect(locked.getAttribute('aria-pressed')).toBe('true');
    expect(locked.getAttribute('aria-description')).toBe('必ず選択 (強制対象)');
    expect(locked.getAttribute('aria-label')).toContain('必ず選択 (解除不可)');
    act(() => locked.click());
    expect(locked.getAttribute('aria-pressed')).toBe('true');
  });

  it('preserves forced lock and blocked-primary behavior beside detail siblings', () => {
    const onPickMulti = vi.fn();
    act(() => {
      root.render(
        <CardListModal
          kind="deck"
          side="self"
          cards={['D08003', 'D08004']}
          pickCands={[
            { uid: 'D08003#0', cardId: 'D08003', player: 'self' },
            { uid: 'D08004#1', cardId: 'D08004', player: 'self' },
          ]}
          pickNMin={1}
          pickNMax={2}
          pickForcedUids={['D08003#0']}
          onPick={vi.fn()}
          onPickMulti={onPickMulti}
          onExpand={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    const forced = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-D08003#0"]')!;
    expect(forced.getAttribute('aria-pressed')).toBe('true');
    expect(forced.getAttribute('title')).not.toBeNull();
    act(() => forced.click());
    expect(forced.getAttribute('aria-pressed')).toBe('true');
    act(() => (container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-confirm"]')!).click());
    expect(onPickMulti).toHaveBeenCalledWith(['D08003#0']);

    act(() => {
      root.render(
        <CardListModal
          kind="deck"
          side="self"
          cards={['D08003', 'D08004']}
          pickCands={[
            { uid: 'D08003#0', cardId: 'D08003', player: 'self' },
            { uid: 'D08004#1', cardId: 'D08004', player: 'self' },
          ]}
          pickForcedUids={['D08003#0']}
          onPick={vi.fn()}
          onExpand={vi.fn()}
          onClose={vi.fn()}
        />,
      );
    });
    const blocked = container.querySelector<HTMLButtonElement>('[data-testid="card-list-pick-D08004#1"]')!;
    expect(blocked.disabled).toBe(true);
    expect(blocked.getAttribute('title')).not.toBeNull();
    expect(container.querySelector('[data-testid="card-list-pick-detail-D08004#1"]')).not.toBeNull();
  });
});
