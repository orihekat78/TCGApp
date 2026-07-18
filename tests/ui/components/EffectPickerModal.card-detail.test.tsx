import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { EffectPickerModal } from '@/ui/components/EffectPickerModal';
import { useGameStateStore } from '@/ui/state/store';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('EffectPickerModal card details', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
    useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
  });

  it('shows public evidence art and opens details without selecting it', () => {
    act(() => root.render(<EffectPickerModal />));

    const select = container.querySelector<HTMLButtonElement>('[data-testid="effect-pick-cand-evidence:self:0"]')!;
    const detail = container.querySelector<HTMLButtonElement>('[data-testid="effect-pick-detail-evidence:self:0"]')!;
    expect(select.querySelector('img')).not.toBeNull();
    expect(detail).toBeInstanceOf(HTMLButtonElement);
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

  it('keeps the public detail control at the mobile touch target minimum', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/ui/components/EffectPickerModal.css'), 'utf8');
    expect(css).toMatch(/\.effect-picker-detail\s*\{[\s\S]*min-width:\s*44px;[\s\S]*min-height:\s*44px;/);
  });
});
