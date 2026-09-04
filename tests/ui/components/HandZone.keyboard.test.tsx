// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cardOccurrenceUid } from '@/engine/target/card-occurrence';
import { HandZone, type HandCardMeta } from '@/ui/components/HandZone';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function card(cardId: string, name: string): HandCardMeta {
  return {
    cardId,
    name,
    color: 'blue',
    type: 'キャラ',
    cost: 1,
    ap: 1000,
    lp: 1,
    lv: 1,
  };
}

describe('HandZone pick keyboard interaction', () => {
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

  it('selects an exact non-leading hand occurrence with Enter or Space', () => {
    const onPickCard = vi.fn();
    const onCardExpand = vi.fn();
    const selectedUid = cardOccurrenceUid('self', 'hand', 'B', 1);

    act(() => root.render(
      <HandZone
        cards={[card('A', 'First card'), card('B', 'Second card')]}
        expanded
        pickMode
        pickableCardUids={new Set([selectedUid])}
        onPickCard={onPickCard}
        onCardExpand={onCardExpand}
      />,
    ));

    const first = container.querySelector<HTMLElement>('.hand-card[data-card-id="A"]')!;
    const second = container.querySelector<HTMLElement>('.hand-card[data-card-id="B"]')!;
    expect(first.getAttribute('role')).toBeNull();
    expect(first.tabIndex).toBe(-1);
    expect(second.getAttribute('role')).toBe('button');
    expect(second.tabIndex).toBe(0);
    expect(second.getAttribute('aria-label')).toContain('Second card');
    expect(second.querySelector('.hand-card-magnifier')).toBeNull();

    second.focus();
    expect(document.activeElement).toBe(second);
    act(() => second.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    })));
    act(() => second.dispatchEvent(new KeyboardEvent('keydown', {
      key: ' ',
      bubbles: true,
      cancelable: true,
    })));

    expect(onPickCard.mock.calls).toEqual([[selectedUid], [selectedUid]]);
    expect(onCardExpand).not.toHaveBeenCalled();
  });
});
