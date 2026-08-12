import { act, StrictMode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MATCH_MODAL_REGISTERED_ATTRIBUTE,
  useMatchModalLayer,
} from '@/ui/hooks/useMatchModalLayer';
import { useModalFocusTrap } from '@/ui/hooks/useModalFocusTrap';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Harness({ underlyingEscape }: { underlyingEscape: () => void }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useModalFocusTrap({ active: true, onEscape: underlyingEscape });
  const menuRef = useMatchModalLayer({
    active: open,
    onEscape: () => setOpen(false),
    initialFocusSelector: '[data-testid="menu-close"]',
  });
  return (
    <>
      <div ref={dialogRef} role="dialog" aria-modal="true" tabIndex={-1} data-testid="decision">
        <span><button type="button" data-testid="decision-action">Resolve decision</button></span>
      </div>
      <button
        type="button"
        data-match-menu-trigger="true"
        data-testid="menu-trigger"
        onClick={() => setOpen(true)}
      >
        Match menu
      </button>
      {open && (
        <div
          ref={menuRef}
          role="dialog"
          aria-modal="true"
          data-match-menu-dialog="true"
          tabIndex={-1}
        >
          <button type="button" data-testid="menu-close" onClick={() => setOpen(false)}>Close</button>
          <button type="button">Surrender</button>
        </div>
      )}
    </>
  );
}

describe('useMatchModalLayer', () => {
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
    vi.restoreAllMocks();
  });

  it('includes the closed menu trigger in an active dialog focus scope', () => {
    act(() => root.render(<Harness underlyingEscape={vi.fn()} />));
    const action = container.querySelector<HTMLButtonElement>('[data-testid="decision-action"]')!;
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="menu-trigger"]')!;

    action.focus();
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => document.dispatchEvent(forward));
    expect(forward.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(trigger);

    const wrap = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => document.dispatchEvent(wrap));
    expect(document.activeElement).toBe(action);
  });

  it('suspends the underlying owner and restores the exact prior control after Escape', () => {
    const underlyingEscape = vi.fn();
    act(() => root.render(<Harness underlyingEscape={underlyingEscape} />));
    const action = container.querySelector<HTMLButtonElement>('[data-testid="decision-action"]')!;
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="menu-trigger"]')!;
    const decision = container.querySelector<HTMLElement>('[data-testid="decision"]')!;
    action.focus();
    act(() => trigger.click());

    expect(decision.getAttribute(MATCH_MODAL_REGISTERED_ATTRIBUTE)).toBe('true');
    expect(decision.hasAttribute('inert')).toBe(true);
    expect(decision.getAttribute('aria-hidden')).toBe('true');
    expect(decision.getAttribute('aria-modal')).toBe('false');
    expect(document.activeElement).toBe(container.querySelector('[data-testid="menu-close"]'));

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => document.dispatchEvent(escape));
    expect(underlyingEscape).not.toHaveBeenCalled();
    expect(container.querySelector('[data-match-menu-dialog]')).toBeNull();
    expect(decision.hasAttribute('inert')).toBe(false);
    expect(decision.hasAttribute('aria-hidden')).toBe(false);
    expect(decision.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(action);
  });

  it('registers late visible modal roots and leaves no underlying top layer visible', async () => {
    act(() => root.render(<Harness underlyingEscape={vi.fn()} />));
    const late = document.createElement('div');
    late.setAttribute('role', 'dialog');
    late.setAttribute('aria-modal', 'true');
    document.body.appendChild(late);

    await act(async () => Promise.resolve());
    const unregistered = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal]'))
      .filter((node) => !node.hasAttribute('data-match-menu-dialog'))
      .filter((node) => node.getAttribute(MATCH_MODAL_REGISTERED_ATTRIBUTE) !== 'true');
    expect(unregistered).toEqual([late]);

    late.setAttribute(MATCH_MODAL_REGISTERED_ATTRIBUTE, 'true');

    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="menu-trigger"]')!;
    act(() => trigger.click());
    const visibleUnderlying = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]'))
      .filter((node) => !node.hasAttribute('data-match-menu-dialog'))
      .filter((node) => node.getAttribute('aria-modal') === 'true' && node.getAttribute('aria-hidden') !== 'true');
    expect(visibleUnderlying).toHaveLength(0);
    late.remove();
  });

  it('does not restore focus to a disabled or removed prior control', () => {
    act(() => root.render(<Harness underlyingEscape={vi.fn()} />));
    const action = container.querySelector<HTMLButtonElement>('[data-testid="decision-action"]')!;
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="menu-trigger"]')!;

    action.focus();
    act(() => trigger.click());
    action.disabled = true;
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true, cancelable: true,
    })));
    expect(document.activeElement).not.toBe(action);

    action.disabled = false;
    action.focus();
    act(() => trigger.click());
    action.remove();
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true, cancelable: true,
    })));
    expect(document.activeElement).not.toBe(action);
  });

  it.each([
    ['hidden', (action: HTMLElement) => { action.hidden = true; }],
    ['display none', (action: HTMLElement) => { action.style.display = 'none'; }],
    ['visibility hidden', (action: HTMLElement) => { action.style.visibility = 'hidden'; }],
    ['aria-hidden ancestor', (action: HTMLElement) => { action.parentElement!.setAttribute('aria-hidden', 'true'); }],
    ['inert ancestor', (action: HTMLElement) => { action.parentElement!.setAttribute('inert', ''); }],
  ])('does not restore focus to a %s prior control under StrictMode', (_label, makeDead) => {
    act(() => root.render(<StrictMode><Harness underlyingEscape={vi.fn()} /></StrictMode>));
    const action = container.querySelector<HTMLButtonElement>('[data-testid="decision-action"]')!;
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="menu-trigger"]')!;
    action.focus();
    act(() => trigger.click());
    makeDead(action);
    act(() => document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape', bubbles: true, cancelable: true,
    })));
    expect(document.activeElement).not.toBe(action);
  });

  it('keeps the checked-in modal-owner inventory exhaustive', () => {
    const rootDir = resolve(process.cwd(), 'src/ui/components');
    const actual = readdirSync(rootDir)
      .filter((name) => name.endsWith('.tsx'))
      .filter((name) => /aria-modal|useModalFocusTrap|stopImmediatePropagation/.test(
        readFileSync(resolve(rootDir, name), 'utf8'),
      ))
      .map((name) => `src/ui/components/${name}`)
      .sort();
    const expected = readFileSync(
      resolve(process.cwd(), 'tests/ui/hooks/match-modal-inventory.txt'),
      'utf8',
    ).trim().split(/\r?\n/u).sort();
    expect(actual).toEqual(expected);
    const customEquivalentOwners = new Set([
      'src/ui/components/CardExpandModal.tsx',
      'src/ui/components/EffectPickerModal.tsx',
      'src/ui/components/MulliganModal.tsx',
    ]);
    for (const file of actual) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      if (!customEquivalentOwners.has(file)) {
        expect(source, `${file} must use the shared focus-scope contract`).toMatch(/useModalFocusTrap/);
      } else {
        expect(source, `${file} custom trap must include the MATCH menu trigger`).toMatch(/withMatchMenuTrigger/);
        expect(source, `${file} custom trap must reject dead focus restoration`).toMatch(/canRestoreModalFocus/);
        expect(source, `${file} custom trap must own keyboard arbitration`).toMatch(/addEventListener\('keydown'/);
        expect(source, `${file} custom trap must require visible top-layer ownership`).toMatch(
          /isTopmostMatchModalRoot/,
        );
      }
      const ariaModalRoots = source.match(/<[^>]+aria-modal(?:=|\s)[^>]*>/gu) ?? [];
      expect(ariaModalRoots.length, `${file} must contain an aria-modal root`).toBeGreaterThan(0);
      for (const modalRoot of ariaModalRoots) {
        const usesRegisteredTrap = /useModalFocusTrap/.test(source) && /ref=\{dialogRef\}/.test(modalRoot);
        const usesCustomEquivalent = customEquivalentOwners.has(file)
          && /data-match-modal-registered="true"/.test(modalRoot);
        expect(
          usesRegisteredTrap || usesCustomEquivalent,
          `${file} must register each aria-modal root exactly at the root`,
        ).toBe(true);
      }
    }
    for (const file of [
      'src/ui/components/DeckPlaceModalHost.tsx',
      'src/ui/components/GameSetupModal.tsx',
      'src/ui/components/LogPanel.tsx',
    ]) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source, `${file} interactive modal must share the registered focus-scope contract`).toMatch(
        /useModalFocusTrap/,
      );
      expect(source, `${file} visible root must own the registered trap ref`).toMatch(
        /ref=\{dialogRef\}/,
      );
    }
  });
});
