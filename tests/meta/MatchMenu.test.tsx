import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { createEmptyGameState } from '@/engine/state-factory';
import { startCausalSession } from '@/engine/log/causal';
import {
  beginMatchSession,
  commitMatchSession,
  currentMatchSessionToken,
  endMatchSession,
  matchSessionId,
} from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { MatchMenu } from '../../meta-app/src/components/MatchMenu';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe('MatchMenu', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => registerAll());

  beforeEach(() => {
    endMatchSession();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    endMatchSession();
  });

  it('renders only for a committed current live human match', () => {
    act(() => root.render(<MatchMenu replayActive={false} />));
    expect(container.querySelector('[data-testid="match-menu-trigger"]')).toBeNull();

    beginMatchSession('self');
    act(() => root.render(<MatchMenu replayActive={false} />));
    expect(container.querySelector('[data-testid="match-menu-trigger"]')).toBeNull();

    const token = currentMatchSessionToken()!;
    expect(commitMatchSession(token, createEmptyGameState())).toBe(true);
    act(() => root.render(<MatchMenu replayActive={false} />));
    expect(container.querySelector('[data-testid="match-menu-trigger"]')).not.toBeNull();

    act(() => root.render(<MatchMenu replayActive />));
    expect(container.querySelector('[data-testid="match-menu-trigger"]')).toBeNull();

    act(() => {
      useGameStateStore.setState({ spectatorMode: true });
      root.render(<MatchMenu replayActive={false} />);
    });
    expect(container.querySelector('[data-testid="match-menu-trigger"]')).toBeNull();

    act(() => {
      useGameStateStore.setState({ spectatorMode: false });
      delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
      root.render(<MatchMenu replayActive={false} />);
    });
    expect(container.querySelector('[data-testid="match-menu-trigger"]')).toBeNull();

    act(() => {
      (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
      root.render(<MatchMenu replayActive={false} />);
    });
    expect(container.querySelector('[data-testid="match-menu-trigger"]')).toBeNull();
  });

  it('traps confirmation focus in both directions and reports a captured-token failure', () => {
    beginCommittedMatch();
    act(() => root.render(<MatchMenu replayActive={false} />));
    openConfirmation(container);

    const cancel = document.querySelector<HTMLButtonElement>('[data-testid="match-menu-confirm-cancel"]')!;
    const confirm = document.querySelector<HTMLButtonElement>('[data-testid="match-menu-confirm-submit"]')!;
    cancel.focus();
    const reverse = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    act(() => document.dispatchEvent(reverse));
    expect(reverse.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(confirm);
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    act(() => document.dispatchEvent(forward));
    expect(document.activeElement).toBe(cancel);

    const staleToken = currentMatchSessionToken();
    beginCommittedMatch();
    expect(currentMatchSessionToken()).not.toBe(staleToken);
    act(() => confirm.click());
    expect(document.querySelector('[role="alert"]')?.textContent).toContain('投了できませんでした');
    expect(useGameStateStore.getState().gameState?.gameResult).toBeUndefined();
  });

  it('dispatches one surrender on double activation and does not restore focus into removed UI', () => {
    beginCommittedMatch();
    act(() => root.render(<MatchMenu replayActive={false} />));
    const trigger = container.querySelector<HTMLButtonElement>('[data-testid="match-menu-trigger"]')!;
    trigger.focus();
    openConfirmation(container);
    const confirm = document.querySelector<HTMLButtonElement>('[data-testid="match-menu-confirm-submit"]')!;

    act(() => {
      confirm.click();
      confirm.click();
    });

    expect(useGameStateStore.getState().gameState?.gameResult).toEqual({
      winner: 'opp',
      reason: 'concede',
    });
    const terminalEvents = useGameStateStore.getState().gameState!.log
      .filter((entry) => entry.kind === 'game-result');
    expect(terminalEvents).toHaveLength(1);
    expect(document.activeElement).not.toBe(trigger);
    expect(document.querySelector('[data-match-menu-dialog]')).toBeNull();
  });
});

function beginCommittedMatch(): void {
  const token = beginMatchSession('self');
  const state = createEmptyGameState();
  startCausalSession(state, matchSessionId(token));
  expect(commitMatchSession(token, state)).toBe(true);
}

function openConfirmation(container: HTMLElement): void {
  const trigger = container.querySelector<HTMLButtonElement>('[data-testid="match-menu-trigger"]')!;
  act(() => trigger.click());
  const surrender = document.querySelector<HTMLButtonElement>('[data-testid="match-menu-surrender"]')!;
  act(() => surrender.click());
}
