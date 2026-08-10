import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { EffectPickerModal } from '@/ui/components/EffectPickerModal';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('EffectPickerModal card details', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    const gameState = createEmptyGameState();
    gameState.players.self.evidence = [
      { cardId: 'D08015', faceUp: true, origin: { turn: 1, via: 'reasoning' } },
      { cardId: 'D08003', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
    useGameStateStore.setState({
      gameState,
      spectatorMode: false,
      pendingEffectPick: {
        player: 'self',
        candidates: [
          { uid: 'evidence:self:0', cardId: 'D08015', player: 'self' },
          { uid: 'evidence:self:1', cardId: 'D08003', player: 'self' },
        ],
        atomVerb: 'charSetCard',
        atomArgs: {},
        nMin: 1,
        nMax: 1,
        source: { cardId: 'B04026', abilityId: 'a1' },
      },
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    useGameStateStore.setState({
      gameState: null,
      pendingEffectPick: null,
      pendingPublicHandReveal: null,
    });
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  it('shows public evidence art and opens details without selecting it', () => {
    act(() => root.render(<EffectPickerModal />));

    const select = container.querySelector<HTMLButtonElement>('[data-testid="effect-pick-cand-evidence:self:0"]')!;
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="effect-pick-detail-evidence:self:0"]')!;
    expect(select.querySelector('img')).not.toBeNull();
    expect(detail).toBeInstanceOf(HTMLButtonElement);
    expect(detail.getAttribute('aria-label')).toContain(select.querySelector('.cand-name')!.textContent!);
    expect(detail.getAttribute('aria-label')).toContain('詳細を表示');
    expect(select.parentElement).toBe(detail.parentElement);
    act(() => detail.click());
    expect(container.querySelector('.card-expand-modal')).not.toBeNull();
    expect(container.querySelector('[data-testid="effect-picker-modal"]')).not.toBeNull();
  });

  it('keeps face-down evidence opaque in text, DOM, and details', () => {
    act(() => root.render(<EffectPickerModal />));

    const hidden = container.querySelector<HTMLButtonElement>('[data-testid="effect-pick-cand-evidence:self:1"]')!;
    expect(hidden.querySelector('img')).not.toBeNull();
    expect(container.querySelector('[data-testid="effect-pick-detail-evidence:self:1"]')).toBeNull();
    expect(hidden.textContent).not.toContain('D08003');
    expect(hidden.getAttribute('aria-label') ?? '').not.toContain('D08003');
    expect(hidden.innerHTML).not.toContain('D08003');
  });

  it('opens public details from context menu without selecting', () => {
    act(() => root.render(<EffectPickerModal />));

    const select = container.querySelector<HTMLButtonElement>('[data-testid="effect-pick-cand-evidence:self:0"]')!;
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => select.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(true);
    expect(container.querySelector('.card-expand-modal')).not.toBeNull();
  });

  it('keeps the public detail control beside the candidate art at the mobile touch target minimum', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/components/EffectPickerModal.css'), 'utf8');
    expect(css).toMatch(/\.effect-picker-cand-row\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+48px;/);
    expect(css).toMatch(/\.effect-picker-detail\s*\{[^}]*position:\s*static;/);
    expect(css).toMatch(/\.effect-picker-detail\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/);
  });

  it('renders for an opponent-side decision when the human owns that side', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    const current = useGameStateStore.getState().pendingEffectPick!;
    act(() => {
      useGameStateStore.setState({
        pendingEffectPick: { ...current, player: 'opp' },
      });
      root.render(<EffectPickerModal />);
    });

    expect(container.querySelector('[data-testid="effect-picker-modal"]')).not.toBeNull();
  });

  it('moves focus into the required picker, traps Tab, and does not dismiss on Escape', () => {
    act(() => root.render(<EffectPickerModal />));

    const dialog = container.querySelector<HTMLElement>('[data-testid="effect-picker-modal"]')!;
    const enabled = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
    expect(document.activeElement).toBe(enabled[0]);

    const last = enabled.at(-1)!;
    last.focus();
    const forwardTab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => document.dispatchEvent(forwardTab));
    expect(forwardTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(enabled[0]);

    const backwardTab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    act(() => document.dispatchEvent(backwardTab));
    expect(backwardTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    act(() => document.dispatchEvent(escape));
    expect(escape.defaultPrevented).toBe(true);
    expect(container.querySelector('[data-testid="effect-picker-modal"]')).not.toBeNull();
  });

  it('keeps a linked public reveal inside the required dialog and its focus order', () => {
    const pending = useGameStateStore.getState().pendingEffectPick!;
    act(() => {
      useGameStateStore.setState({
        pendingEffectPick: {
          ...pending,
          publicHandRevealToken: 'public-hand-reveal:linked',
        },
        pendingPublicHandReveal: {
          owner: 'opp',
          audience: 'all',
          cardIds: ['D08015'],
          handSnapshot: ['D08015'],
          lifetime: 'effect',
          resolutionToken: 'public-hand-reveal:linked',
          source: { cardId: 'B03111', abilityId: 'a1' },
        },
      });
      root.render(<EffectPickerModal />);
    });

    const dialog = container.querySelector<HTMLElement>('[data-testid="effect-picker-modal"]')!;
    const reveal = dialog.querySelector<HTMLElement>('[data-testid="public-hand-reveal-window"]');
    const detail = dialog.querySelector<HTMLButtonElement>('[data-testid="public-hand-reveal-detail-0"]');
    const focusable = Array.from(dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));

    expect(reveal).not.toBeNull();
    expect(detail).not.toBeNull();
    expect(focusable).toContain(detail);
    expect(document.activeElement).toBe(detail);
    expect(dialog.querySelector('[data-testid="public-hand-reveal-close"]')).toBeNull();
  });

  it('owns a linked public reveal when the next choice is a scene character', () => {
    const gameState = useGameStateStore.getState().gameState!;
    gameState.players.self.scene = [sceneChar('B10024', 'otaki')];
    act(() => {
      useGameStateStore.setState({
        gameState,
        pendingEffectPick: {
          player: 'self',
          candidates: [{ uid: 'otaki', cardId: 'B10024', player: 'self' }],
          atomVerb: 'sceneRemove',
          atomArgs: {},
          nMin: 0,
          nMax: 1,
          source: { cardId: 'B10024', abilityId: 'a1' },
          publicHandRevealToken: 'public-hand-reveal:b10024',
        },
        pendingPublicHandReveal: {
          owner: 'self',
          audience: 'all',
          cardIds: ['B10024'],
          handSnapshot: ['B10024'],
          lifetime: 'effect',
          resolutionToken: 'public-hand-reveal:b10024',
          source: { cardId: 'B10024', abilityId: 'a1' },
        },
      });
      root.render(<EffectPickerModal />);
    });

    const dialog = container.querySelector<HTMLElement>('[data-testid="effect-picker-modal"]')!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector('[data-testid="public-hand-reveal-window"]')).not.toBeNull();
    expect(dialog.querySelector('[data-testid="effect-pick-cand-otaki"]')).not.toBeNull();
  });
});
