// Phase 8.6β: CutInDisguisePickerModal tests

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CutInDisguisePickerModal,
  type CutInDisguiseCandidate,
} from '@/ui/components/CutInDisguisePickerModal';

const cands: CutInDisguiseCandidate[] = [
  { cardId: 'EV1', name: 'AP+2000', kind: 'cutin' },
  { cardId: 'CH1', name: '変装少年', kind: 'disguise' },
];

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('CutInDisguisePickerModal', () => {
  it('returns null when open=false', () => {
    const html = renderToString(
      <CutInDisguisePickerModal
        open={false}
        actorLabel="1番目"
        candidates={cands}
        onPickCutIn={vi.fn()}
        onPickDisguise={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(html).toBe('');
  });

  it('renders actor label and pass button when open', () => {
    const html = renderToString(
      <CutInDisguisePickerModal
        open
        actorLabel="1番目"
        candidates={cands}
        onPickCutIn={vi.fn()}
        onPickDisguise={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(html).toContain('data-testid="cid-picker-modal"');
    expect(html).toContain('1番目');
    expect(html).toContain('data-testid="cid-pass"');
  });

  it('renders cutin and disguise candidates in separate sections', () => {
    const html = renderToString(
      <CutInDisguisePickerModal
        open
        actorLabel="2番目"
        candidates={cands}
        onPickCutIn={vi.fn()}
        onPickDisguise={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(html).toContain('data-testid="cid-cutin-EV1#0"');
    expect(html).toContain('AP+2000');
    expect(html).toContain('data-testid="cid-disg-CH1#0"');
    expect(html).toContain('変装少年');
  });

  it('shows empty messages for each section when no candidates of that kind', () => {
    const html = renderToString(
      <CutInDisguisePickerModal
        open
        actorLabel="1番目"
        candidates={[]}
        onPickCutIn={vi.fn()}
        onPickDisguise={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    // 2 sections × empty = 2 empty messages
    const matches = html.match(/使用可能なカードなし/g);
    expect(matches?.length).toBe(2);
  });

  it('shows the full mixed hand, highlights only eligible occurrences, expands noneligible cards, and keeps each action', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onPickCutIn = vi.fn();
    const onPickDisguise = vi.fn();
    const onPass = vi.fn();
    const mixed = [
      { uid: 'card:self:hand:CUT#0', cardId: 'CUT', name: 'Cut in', kind: 'cutin' as const },
      { uid: 'card:self:hand:DIS#1', cardId: 'DIS', name: 'Disguise', kind: 'disguise' as const },
    ];
    act(() => {
      root.render(
        <CutInDisguisePickerModal
          open
          actorLabel="1番目"
          candidates={mixed}
          handCards={[
            { uid: 'card:self:hand:CUT#0', cardId: 'CUT', name: 'Cut in' },
            { uid: 'card:self:hand:DIS#1', cardId: 'DIS', name: 'Disguise' },
            { uid: 'card:self:hand:NO#2', cardId: 'NO', name: 'Not eligible' },
          ]}
          onPickCutIn={onPickCutIn}
          onPickDisguise={onPickDisguise}
          onPass={onPass}
        />,
      );
    });

    expect(container.querySelectorAll('[data-testid^="cid-hand-card-"]')).toHaveLength(3);
    expect(container.querySelector('[data-testid="cid-hand-card-card:self:hand:CUT#0"]')?.classList).toContain('is-eligible');
    expect(container.querySelector('[data-testid="cid-hand-card-card:self:hand:DIS#1"]')?.classList).toContain('is-eligible');
    expect(container.querySelector('[data-testid="cid-hand-card-card:self:hand:NO#2"]')?.classList).not.toContain('is-eligible');
    expect(container.querySelector('[data-testid="cid-hand-expand-card:self:hand:NO#2"]')?.getAttribute('aria-label')).toBe('Not eligible（3枚目）の詳細を表示');

    act(() => {
      (container.querySelector('[data-testid="cid-hand-expand-card:self:hand:NO#2"]') as HTMLButtonElement).click();
    });
    expect(container.querySelector('.card-expand-modal-backdrop')).not.toBeNull();
    act(() => {
      (container.querySelector('[data-testid="cid-cutin-card:self:hand:CUT#0"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="cid-disg-card:self:hand:DIS#1"]') as HTMLButtonElement).click();
      (container.querySelector('[data-testid="cid-pass"]') as HTMLButtonElement).click();
    });
    expect(onPickCutIn).toHaveBeenCalledWith('CUT', 'card:self:hand:CUT#0');
    expect(onPickDisguise).toHaveBeenCalledWith('DIS');
    expect(onPass).toHaveBeenCalledOnce();

    act(() => root.unmount());
    container.remove();
  });

  it('uses occurrence uid for duplicate-card eligibility and still previews a prohibited hand', () => {
    const html = renderToString(
      <CutInDisguisePickerModal
        open
        actorLabel="1番目"
        candidates={[{ uid: 'card:self:hand:SAME#1', cardId: 'SAME', name: 'Same', kind: 'cutin' }]}
        handCards={[
          { uid: 'card:self:hand:SAME#0', cardId: 'SAME', name: 'Same' },
          { uid: 'card:self:hand:SAME#1', cardId: 'SAME', name: 'Same' },
          { uid: 'card:self:hand:BANNED#2', cardId: 'BANNED', name: 'Banned' },
        ]}
        onPickCutIn={vi.fn()}
        onPickDisguise={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(html).toContain('class="cid-hand-card" data-testid="cid-hand-card-card:self:hand:SAME#0"');
    expect(html).toContain('class="cid-hand-card is-eligible" data-testid="cid-hand-card-card:self:hand:SAME#1"');
    expect(html).toContain('cid-hand-card-card:self:hand:BANNED#2');
    expect(html).toContain('data-testid="cid-pass"');
  });

  it('gives duplicate action candidates unique occurrence testids', () => {
    const html = renderToString(
      <CutInDisguisePickerModal
        open
        actorLabel="1番目"
        candidates={[
          { uid: 'SAME#0', cardId: 'SAME', name: 'Same', kind: 'cutin' },
          { uid: 'SAME#1', cardId: 'SAME', name: 'Same', kind: 'cutin' },
        ]}
        onPickCutIn={vi.fn()}
        onPickDisguise={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(html).toContain('data-testid="cid-cutin-SAME#0"');
    expect(html).toContain('data-testid="cid-cutin-SAME#1"');
    expect(html).toContain('aria-label="Same（1枚目）の詳細を表示"');
    expect(html).toContain('aria-label="Same（2枚目）の詳細を表示"');
    expect(html).not.toContain('data-testid="cid-cutin-SAME"');
  });

  it('owns keyboard focus, wraps Tab in both directions, and returns focus when closed', () => {
    const opener = document.createElement('button');
    const container = document.createElement('div');
    document.body.append(opener, container);
    opener.focus();
    const root = createRoot(container);
    const renderModal = (open: boolean): void => {
      root.render(
        <CutInDisguisePickerModal
          open={open}
          actorLabel="1逡ｪ逶ｮ"
          candidates={cands}
          onPickCutIn={vi.fn()}
          onPickDisguise={vi.fn()}
          onPass={vi.fn()}
        />,
      );
    };

    act(() => renderModal(true));
    const first = container.querySelector<HTMLButtonElement>('[data-testid="cid-cutin-EV1#0"]')!;
    const pass = container.querySelector<HTMLButtonElement>('[data-testid="cid-pass"]')!;
    expect(document.activeElement).toBe(first);

    pass.focus();
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab', bubbles: true, cancelable: true,
    })));
    expect(document.activeElement).toBe(first);

    first.focus();
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Tab', shiftKey: true, bubbles: true, cancelable: true,
    })));
    expect(document.activeElement).toBe(pass);

    act(() => renderModal(false));
    expect(document.activeElement).toBe(opener);
    act(() => root.unmount());
    opener.remove();
    container.remove();
  });

  it('focuses a requested cut-in occurrence after a nested prompt closes', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => root.render(
      <CutInDisguisePickerModal
        open
        actorLabel="1番目"
        candidates={[
          { uid: 'SAME#0', cardId: 'SAME', name: 'First', kind: 'cutin' },
          { uid: 'SAME#1', cardId: 'SAME', name: 'Second', kind: 'cutin' },
        ]}
        initialFocusOccurrenceUid="SAME#1"
        onPickCutIn={vi.fn()}
        onPickDisguise={vi.fn()}
        onPass={vi.fn()}
      />,
    ));

    expect(document.activeElement).toBe(
      container.querySelector('[data-testid="cid-cutin-SAME#1"]'),
    );
    act(() => root.unmount());
    container.remove();
  });

  it('renders public action candidates with independent details and preserves the action payload', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    const onPickCutIn = vi.fn();
    act(() => root.render(
      <CutInDisguisePickerModal
        open
        actorLabel="1逡ｪ逶ｮ"
        candidates={[{ uid: 'D08015#0', cardId: 'D08015', name: 'Public card', kind: 'cutin' }]}
        onPickCutIn={onPickCutIn}
        onPickDisguise={vi.fn()}
        onPass={vi.fn()}
      />,
    ));

    const select = container.querySelector<HTMLButtonElement>('[data-testid="cid-cutin-D08015#0"]')!;
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="cid-cutin-detail-D08015#0"]')!;
    expect(select.querySelector('img')).not.toBeNull();
    expect(detail).toBeInstanceOf(HTMLButtonElement);
    expect(detail.getAttribute('aria-label')).toBe('Public card（1枚目）の詳細を表示');
    act(() => detail.click());
    expect(container.querySelector('.card-expand-modal')).not.toBeNull();
    const contextEvent = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => select.dispatchEvent(contextEvent));
    expect(contextEvent.defaultPrevented).toBe(true);
    act(() => select.click());
    expect(onPickCutIn).toHaveBeenCalledWith('D08015', 'D08015#0');

    act(() => root.unmount());
    container.remove();
  });
  it('keeps public candidate details beside the art at the mobile touch target minimum', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/components/CutInDisguisePickerModal.css'), 'utf8');
    expect(css).toMatch(/\.cid-list li\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+48px;/);
    expect(css).toMatch(/\.cid-cand-detail\s*\{[^}]*position:\s*static;[^}]*min-width:\s*48px;[^}]*min-height:\s*48px;/);
  });
});
