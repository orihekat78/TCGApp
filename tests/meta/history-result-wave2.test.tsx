import { StrictMode } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { buildReplayLogV3 } from '@/ai/replay/state-frame';
import { registerAll } from '@/cards';
import {
  abortIfMissing,
  advance,
  declare,
  passGuard,
  snapshotAP,
} from '@/engine/flow/action/state-machine';
import { judge, pass } from '@/engine/flow/contact';
import { createEmptyGameState } from '@/engine/state-factory';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { mutate } from '@/engine/mutate';
import type { GameState } from '@/engine/types/game-state';
import { useGameStateStore } from '@/ui/state/store';
import { usePresentationStore } from '@/ui/presentation/store';
import { beginMatchSession, matchSessionId } from '@/ui/services/matchSession';
import { getFinalizedReplay } from '@/ui/services/liveReplayRecorder';
import { HistoryScreen } from '../../meta-app/src/screens/HistoryScreen';
import { currentReplayEventSummary, ReplayScreen } from '../../meta-app/src/screens/ReplayScreen';
import { ResultScreen } from '../../meta-app/src/screens/ResultScreen';
import { App } from '../../meta-app/src/App';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../meta-app/src/data/sampleDeck';
import type { DeckRecord, MatchRecord } from '../../meta-app/src/data/types';
import { normalizePersistedHistoryState, useHistoryStore } from '../../meta-app/src/state/historyStore';
import { useMetaStore } from '../../meta-app/src/state/metaStore';
import { encodeDeck } from '../../meta-app/src/util/deckCode';
import { saveHistoryReplay } from '../../meta-app/src/services/historyReplayRepository';
import { sceneChar } from '../helpers/fixtures';
import {
  clearReplayReturnFocus,
  markReplayReturnFocus,
  pendingReplayReturnFocus,
} from '../../meta-app/src/services/replayReturnFocus';

const match = {
  id: 'session-42', recorded: 1, won: true, deckName: '自分のデッキ', oppDeckName: 'CPUのデッキ',
  mode: 'solo' as const, turns: 4, duration: 0, evidGot: 2, evidLost: 1,
  contacts: 0, hirameki: 0, misread: 0, p1Target: 7 as const, p2Target: 7 as const,
};

function snapshot(deck: DeckRecord) {
  return {
    schemaVersion: 1 as const,
    deckId: deck.id,
    name: deck.name,
    partner: deck.partner,
    case: deck.case,
    cards: deck.cards.map((entry) => ({ ...entry })),
  };
}

describe('Wave 2 history and result contract', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    registerAll();
  });
  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useHistoryStore.setState({ history: [], _hasHydrated: true, _hasCanonicalLoaded: false } as never);
    clearReplayReturnFocus();
    useMetaStore.setState({ _matchMeta: null });
    useGameStateStore.setState({ gameState: null });
    vi.stubGlobal('indexedDB', new IDBFactory());
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    clearReplayReturnFocus();
    window.history.replaceState(null, '', '#home');
    vi.unstubAllGlobals();
  });

  it('keeps exactly one record for a session across StrictMode remounts', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: state });
    useMetaStore.getState().setMatchMeta({ sessionId: match.id, mode: 'solo', selfDeckName: match.deckName, oppDeckName: match.oppDeckName });

    act(() => root.render(<StrictMode><ResultScreen onNav={() => undefined} onRematch={() => undefined} /></StrictMode>));
    act(() => root.render(<ResultScreen onNav={() => undefined} onRematch={() => undefined} />));

    expect(useHistoryStore.getState().history).toHaveLength(1);
    expect(useHistoryStore.getState().history[0]).toMatchObject({ id: match.id, deckName: match.deckName, oppDeckName: match.oppDeckName });
    expect(document.activeElement).toBe(container.querySelector('#result-title'));
    expect(container.querySelector('[role="status"]')?.getAttribute('aria-live')).toBe('polite');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('勝利');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('必要証拠数達成');
  });

  it('records immutable snapshots of both decks used by the finished match', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    const selfDeckSnapshot = snapshot(SAMPLE_DECK);
    const oppDeckSnapshot = snapshot(SAMPLE_DECK_OPP);
    useGameStateStore.setState({ gameState: state });
    useMetaStore.getState().setMatchMeta({
      sessionId: 'snapshot-result-session',
      mode: 'solo',
      selfDeckName: SAMPLE_DECK.name,
      oppDeckName: SAMPLE_DECK_OPP.name,
      selfDeckSnapshot,
      oppDeckSnapshot,
    } as never);

    act(() => root.render(<ResultScreen onNav={() => undefined} onRematch={() => undefined} />));

    expect(useHistoryStore.getState().history[0]).toMatchObject({
      selfDeckSnapshot,
      oppDeckSnapshot,
    });
    selfDeckSnapshot.cards[0]!.count = 99;
    expect(useHistoryStore.getState().history[0]!.selfDeckSnapshot!.cards[0]!.count).not.toBe(99);
  });

  it('rejects an entire corrupted saved deck snapshot instead of presenting a partial deck as exact', () => {
    const corrupted = {
      ...match,
      selfDeckSnapshot: {
        ...snapshot(SAMPLE_DECK),
        cards: [
          { num: 'D08003', count: 1 },
          { num: 'D08004', count: 0 },
        ],
      },
    };

    const restored = normalizePersistedHistoryState({ history: [corrupted] }).history[0]!;
    expect(restored.id).toBe(match.id);
    expect(restored.selfDeckSnapshot).toBeUndefined();
  });

  it('never restores replay capability from localStorage without its IndexedDB artifact', () => {
    const replayCapable = {
      ...match,
      replayRef: {
        storageSchemaVersion: 1 as const,
        replaySchemaVersion: 3 as const,
        artifactId: 'idb-only-artifact',
        digest: `sha256-${'f'.repeat(64)}` as const,
        byteLength: 128,
      },
    };

    expect(normalizePersistedHistoryState({ history: [replayCapable] }).history[0])
      .toMatchObject({ id: match.id });
    expect(normalizePersistedHistoryState({ history: [replayCapable] }).history[0]?.replayRef)
      .toBeUndefined();

    useHistoryStore.getState().record(replayCapable);
    expect(useHistoryStore.getState().history[0]?.replayRef).toEqual(replayCapable.replayRef);
    const partialize = useHistoryStore.persist.getOptions().partialize;
    const persisted = partialize?.(useHistoryStore.getState()) as { history: MatchRecord[] };
    expect(persisted.history[0]?.replayRef).toBeUndefined();
  });

  it('records semantic counters only from normalized causal tags and deduplicates the session', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    state.log.push({
      ts: 1,
      player: 'self',
      turn: 1,
      action: 'legacy-action',
      result: 'private contact hirameki misread detail',
    });
    startCausalSession(state, 'tagged-result-session');
    appendCausal(state, {
      actor: 'self', kind: 'declare', tags: ['contact'], targets: [],
      outcome: { type: 'state', state: 'success' },
    });
    appendCausal(state, {
      actor: 'self', kind: 'select', tags: ['contact'], targets: [],
      outcome: { type: 'state', state: 'success' },
    });
    appendCausal(state, {
      actor: 'self', kind: 'summary', tags: ['contact'], targets: [],
      outcome: { type: 'state', state: 'success' },
    });
    appendCausal(state, {
      actor: 'self', kind: 'use', tags: ['hirameki'], targets: [],
      outcome: { type: 'state', state: 'success' },
    });
    appendCausal(state, {
      actor: 'self', kind: 'fizzle', tags: ['misread'], targets: [],
      outcome: { type: 'state', state: 'fizzled' },
    });
    useMetaStore.getState().setMatchMeta({
      sessionId: 'tagged-result-session', mode: 'solo', selfDeckName: 'Tagged deck', oppDeckName: 'CPU deck',
    });
    useGameStateStore.setState({ gameState: state });

    act(() => root.render(<ResultScreen onNav={() => undefined} onRematch={() => undefined} />));
    expect(useHistoryStore.getState().history).toHaveLength(1);
    expect(useHistoryStore.getState().history[0]).toMatchObject({
      sessionId: 'tagged-result-session', contacts: 1, hirameki: 1, misread: 1,
    });

    const restored = JSON.parse(JSON.stringify(state)) as GameState;
    act(() => useGameStateStore.setState({ gameState: restored }));
    expect(useHistoryStore.getState().history).toHaveLength(1);
  });

  it('records a contact that starts before a participant leaves and cancels it', () => {
    const state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar('D08003', 'attacker')];
    state.players.opp.scene = [sceneChar('D08005', 'target', { state: 'sleep' })];
    startCausalSession(state, 'cancelled-contact-result');

    const action = declare(state, 'attacker', { kind: 'char', uid: 'target' });
    passGuard(state, action);
    advance(state, action);
    advance(state, action);
    state.players.opp.scene = [];
    abortIfMissing(state, action);
    state.gameResult = { winner: 'self', reason: 'evidence' };

    useMetaStore.getState().setMatchMeta({
      sessionId: 'cancelled-contact-result',
      mode: 'solo',
      selfDeckName: 'Self deck',
      oppDeckName: 'CPU deck',
    });
    useGameStateStore.setState({ gameState: state });

    act(() => root.render(<ResultScreen onNav={() => undefined} onRematch={() => undefined} />));

    expect(useHistoryStore.getState().history[0]).toMatchObject({
      sessionId: 'cancelled-contact-result',
      contacts: 1,
    });
  });

  it('counts one legacy production contact instead of its pass and judge entries', () => {
    const state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar('D08003', 'attacker')];
    state.players.opp.scene = [sceneChar('D08005', 'target', { state: 'sleep' })];

    const action = declare(state, 'attacker', { kind: 'char', uid: 'target' });
    passGuard(state, action);
    advance(state, action);
    advance(state, action);
    pass(state, action, 'opp');
    action.firstActed = false;
    advance(state, action);
    pass(state, action, 'self');
    action.secondActed = false;
    advance(state, action);
    snapshotAP(state, action);
    judge(state, action);
    state.gameResult = { winner: 'self', reason: 'evidence' };

    useMetaStore.getState().setMatchMeta({
      sessionId: 'legacy-contact-result',
      mode: 'solo',
      selfDeckName: 'Self deck',
      oppDeckName: 'CPU deck',
    });
    useGameStateStore.setState({ gameState: state });

    act(() => root.render(<ResultScreen onNav={() => undefined} onRematch={() => undefined} />));

    expect(state.log.map((entry) => entry.action)).toEqual([
      'contact:detail',
      'contact-pass',
      'contact-pass',
      'contact-judge',
    ]);
    expect(useHistoryStore.getState().history[0]).toMatchObject({
      sessionId: 'legacy-contact-result',
      contacts: 1,
    });
  });

  it('keeps two different session identities even when their snapshots match', () => {
    const first = { ...match, sessionId: 'session-42' };
    const second = { ...match, id: 'session-43', sessionId: 'session-43' };
    useHistoryStore.getState().record(first);
    useHistoryStore.getState().record(second);
    expect(useHistoryStore.getState().history).toHaveLength(2);
  });

  it('labels an observed match as CPU 2 victory without restoring the removed side summary', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'opp', reason: 'deck-out' };
    useGameStateStore.setState({ gameState: state });
    useMetaStore.getState().setMatchMeta({
      sessionId: 'observe-42',
      mode: 'observe',
      selfDeckName: '蒼焔の探偵団',
      oppDeckName: '黒鋼の守護者',
    });

    act(() => root.render(<ResultScreen onNav={() => undefined} onRematch={() => undefined} />));

    expect(container.querySelector('.result-mode')?.textContent).toBe('観戦');
    expect(container.querySelector('#result-title')?.textContent).toBe('CPU 2 勝利');
    expect(container.querySelector('.result-end-reason strong')?.textContent).toBe('デッキ切れ');
    expect(container.querySelector('.result-side')).toBeNull();
    expect(container.querySelector('.result-summary')).toBeNull();
    expect(useHistoryStore.getState().history[0]).toMatchObject({ mode: 'observe' });
  });

  it('clears the finished match on a real browser back navigation from RESULT', async () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: state, spectatorMode: true });
    useMetaStore.getState().setMatchMeta({
      sessionId: 'browser-back-42', mode: 'observe', selfDeckName: 'CPU 1 deck', oppDeckName: 'CPU 2 deck',
    });
    window.history.replaceState(null, '', '#match');
    window.history.pushState(null, '', '#result');
    act(() => root.render(<App />));
    expect(container.querySelector('#result-title')).not.toBeNull();

    const backNavigation = new Promise<void>((resolve) => {
      window.addEventListener('hashchange', () => resolve(), { once: true });
    });
    await act(async () => {
      window.history.back();
      await backNavigation;
    });

    expect(window.location.hash).toBe('#match');
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(useGameStateStore.getState().spectatorMode).toBe(false);
    expect(useMetaStore.getState().getMatchMeta()).toBeNull();

    const forwardNavigation = new Promise<void>((resolve) => {
      window.addEventListener('hashchange', () => resolve(), { once: true });
    });
    await act(async () => {
      window.history.forward();
      await forwardNavigation;
    });
    expect(window.location.hash).toBe('#result');
    expect(useMetaStore.getState().getMatchMeta()).toBeNull();
  });

  it('routes a live MATCH to RESULT while retaining terminal state and replay ownership', async () => {
    const token = beginMatchSession('self');
    const sessionId = matchSessionId(token);
    const initial = createEmptyGameState();
    startCausalSession(initial, sessionId);
    useGameStateStore.setState({ gameState: initial });
    useMetaStore.getState().setMatchMeta({
      sessionId,
      mode: 'solo',
      selfDeckName: SAMPLE_DECK.name,
      oppDeckName: SAMPLE_DECK_OPP.name,
    });
    usePresentationStore.setState({
      presentationPaused: true,
      presentationError: 'stale presentation error',
      presentationCompletionNotice: { kind: 'skip', count: 4 },
    });

    window.history.replaceState(null, '', '#match');
    act(() => root.render(<App />));
    await act(async () => { await Promise.resolve(); });

    const resultNavigation = new Promise<void>((resolve) => {
      window.addEventListener('hashchange', () => resolve(), { once: true });
    });
    const terminal = structuredClone(initial);
    mutate.gameResult.set(terminal, 'self', 'evidence');
    act(() => useGameStateStore.setState({ gameState: terminal }));
    await act(async () => { await resultNavigation; });

    expect(window.location.hash).toBe('#result');
    expect(container.querySelector('#result-title')).not.toBeNull();
    expect(useGameStateStore.getState().gameState).toBe(terminal);
    expect(getFinalizedReplay(sessionId)).not.toBeNull();
    expect(usePresentationStore.getState()).toMatchObject({
      presentationPaused: false,
      presentationError: null,
      presentationCompletionNotice: { kind: 'skip', count: 4 },
    });
  });

  it('clears match metadata and tutorial provenance when a hotkey abandons MATCH', async () => {
    const state = createEmptyGameState();
    useGameStateStore.setState({ gameState: state, spectatorMode: true });
    useMetaStore.getState().setMatchMeta({
      sessionId: 'abandoned-observe', mode: 'observe', selfDeckName: 'CPU 1 old', oppDeckName: 'CPU 2 old',
    });
    useMetaStore.getState().startPracticeFor('L5-4');
    window.history.replaceState(null, '', '#match');
    act(() => root.render(<App />));

    const navigation = new Promise<void>((resolve) => {
      window.addEventListener('hashchange', () => resolve(), { once: true });
    });
    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 't', bubbles: true })));
    await act(async () => { await navigation; });

    expect(window.location.hash).toBe('#tutorial');
    expect(useMetaStore.getState().getMatchMeta()).toBeNull();
    expect(useMetaStore.getState()._pendingPracticeStepId).toBeNull();
    expect(useGameStateStore.getState().gameState).toBeNull();
  });

  it('exposes pressed filter state and includes deck names found only in history', () => {
    useHistoryStore.setState({ history: [match] });
    act(() => root.render(<HistoryScreen onNav={() => undefined} />));
    const filters = Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-pressed]'));
    expect(filters.map((button) => button.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    const loss = filters[2];
    act(() => loss.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(loss.getAttribute('aria-pressed')).toBe('true');
    const all = filters[0];
    act(() => all.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true })));
    expect(all.getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('option[value="自分のデッキ"]')).not.toBeNull();
  });

  it('distinguishes a filtered-empty result and clears both active filters', () => {
    useHistoryStore.setState({ history: [
      { ...match, id: 'a', sessionId: 'a', deckName: 'Historic A', won: true },
      { ...match, id: 'b', sessionId: 'b', deckName: 'Historic B', won: false },
      { ...match, id: 'c', sessionId: 'c', deckName: 'Historic B', won: true },
    ] });
    act(() => root.render(<HistoryScreen onNav={() => undefined} />));
    const filters = Array.from(container.querySelectorAll<HTMLButtonElement>('[aria-pressed]'));
    const deckFilter = container.querySelector<HTMLSelectElement>('select[aria-label]')!;
    act(() => {
      deckFilter.value = 'Historic B';
      deckFilter.dispatchEvent(new Event('change', { bubbles: true }));
      filters[1].click();
    });
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(container.textContent).toContain('Historic B');

    act(() => filters[2].click());
    expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    act(() => {
      deckFilter.value = 'Historic A';
      deckFilter.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container.querySelector('table')).toBeNull();
    expect(container.textContent).toContain('該当する対戦なし');
    const clear = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('絞り込みを解除'))!;
    expect(clear).toBeDefined();
    act(() => clear.click());
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(filters[0]!.getAttribute('aria-pressed')).toBe('true');
    expect(deckFilter.value).toBe('');
  });

  it('keeps unavailable history replay explained and natively disabled', () => {
    useHistoryStore.setState({ history: [match] });
    const onNav = vi.fn();
    act(() => root.render(<HistoryScreen onNav={onNav} />));

    const replay = container.querySelector<HTMLButtonElement>('.history-replay-button')!;
    const reasonId = replay.getAttribute('aria-describedby');
    expect(replay.disabled).toBe(true);
    expect(replay.getAttribute('aria-disabled')).toBeNull();
    expect(reasonId).toBeTruthy();
    expect(container.querySelector(`#${reasonId}`)?.textContent)
      .toContain('完全なイベント記録が保存されていないため、この対戦はリプレイできません');
    act(() => replay.click());
    expect(onNav).not.toHaveBeenCalled();
  });

  it('hides the unavailable notice when every visible history row has a replay', () => {
    useHistoryStore.setState({ history: [{
      ...match,
      replayRef: {
        storageSchemaVersion: 1,
        replaySchemaVersion: 3,
        artifactId: 'replay-fixture',
        digest: `sha256-${'f'.repeat(64)}`,
        byteLength: 128,
      },
    }] });
    act(() => root.render(<HistoryScreen onNav={() => undefined} />));

    expect(container.querySelector('.history-replay-notice')).toBeNull();
    expect(container.querySelector('.history-replay-button')?.getAttribute('aria-describedby')).toBeNull();
  });

  it('retains replay return focus until a delayed canonical row becomes available', async () => {
    const replayMatch = {
      ...match,
      replayRef: {
        storageSchemaVersion: 1 as const,
        replaySchemaVersion: 3 as const,
        artifactId: 'replay-delayed-canonical',
        digest: `sha256-${'a'.repeat(64)}` as const,
        byteLength: 128,
      },
    };
    markReplayReturnFocus(replayMatch.replayRef.artifactId);
    act(() => root.render(<HistoryScreen onNav={() => undefined} />));
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

    expect(pendingReplayReturnFocus()).toEqual({
      kind: 'artifact',
      artifactId: replayMatch.replayRef.artifactId,
    });

    act(() => useHistoryStore.setState({ history: [replayMatch] }));
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

    expect((document.activeElement as HTMLElement | null)?.dataset.replayArtifactId)
      .toBe(replayMatch.replayRef.artifactId);
    expect(pendingReplayReturnFocus()).toBeNull();
  });

  it('falls back to the history heading only after canonical history loading settles', async () => {
    markReplayReturnFocus('replay-missing-after-load');
    act(() => root.render(<HistoryScreen onNav={() => undefined} />));
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
    expect(pendingReplayReturnFocus()).not.toBeNull();

    act(() => useHistoryStore.setState({ _hasCanonicalLoaded: true } as never));
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

    expect(document.activeElement).toBe(container.querySelector('#history-title'));
    expect(pendingReplayReturnFocus()).toBeNull();
  });

  it('shows one full-width saved deck at a time, switches tabs, copies the selected code, and restores focus', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    const historicMatch = {
      ...match,
      selfDeckSnapshot: snapshot(SAMPLE_DECK),
      oppDeckSnapshot: snapshot(SAMPLE_DECK_OPP),
    } as MatchRecord;
    useHistoryStore.setState({ history: [historicMatch] });
    act(() => root.render(<HistoryScreen onNav={() => undefined} />));

    const open = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('デッキを見る'))!;
    expect(open).toBeDefined();
    act(() => open.click());

    const dialog = container.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]')!;
    expect(dialog).not.toBeNull();
    const selfPanel = dialog.querySelector<HTMLElement>('#history-self-deck-panel')!;
    const oppPanel = dialog.querySelector<HTMLElement>('#history-opp-deck-panel')!;
    const selfTab = dialog.querySelector<HTMLButtonElement>('[role="tab"][aria-controls="history-self-deck-panel"]')!;
    const oppTab = dialog.querySelector<HTMLButtonElement>('[role="tab"][aria-controls="history-opp-deck-panel"]')!;
    expect(selfTab).not.toBeNull();
    expect(oppTab).not.toBeNull();
    expect(selfPanel.getAttribute('role')).toBe('tabpanel');
    expect(selfPanel.hidden).toBe(false);
    expect(oppPanel.hidden).toBe(true);
    expect(selfPanel.querySelector('[data-testid="history-deck-slots"]')).not.toBeNull();
    expect(selfPanel.querySelector('[data-testid="history-deck-cost-chart"]')).not.toBeNull();
    expect(selfPanel.querySelector('[data-testid="history-deck-type-summary"]')?.textContent).toContain('キャラ');
    expect(selfPanel.querySelector('[data-testid="history-deck-card-grid"]')).not.toBeNull();
    expect(Array.from(selfPanel.querySelectorAll('.history-deck-card-id')).map((node) => node.textContent))
      .toContain('D08003');

    const selfCopy = dialog.querySelector<HTMLButtonElement>('button[aria-label="PLAYERのデッキコードをコピー"]')!;
    await act(async () => selfCopy.click());
    expect(writeText).toHaveBeenLastCalledWith(encodeDeck(SAMPLE_DECK));
    expect(dialog.querySelector('[role="status"]')?.textContent).toContain('コピーしました');

    await act(async () => oppTab.click());
    expect(oppTab.getAttribute('aria-selected')).toBe('true');
    expect(selfPanel.hidden).toBe(true);
    expect(oppPanel.hidden).toBe(false);
    const cpuCopy = dialog.querySelector<HTMLButtonElement>('button[aria-label="CPUのデッキコードをコピー"]')!;
    await act(async () => cpuCopy.click());
    expect(writeText).toHaveBeenLastCalledWith(encodeDeck(SAMPLE_DECK_OPP));

    const close = dialog.querySelector<HTMLButtonElement>('button[aria-label="対戦デッキを閉じる"]')!;
    await act(async () => {
      close.click();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(open);
  });

  it('states when saved cards are missing from analytics instead of silently undercounting', () => {
    const selfDeckSnapshot = snapshot(SAMPLE_DECK);
    selfDeckSnapshot.cards = [
      ...selfDeckSnapshot.cards,
      { num: 'UNKNOWN-HISTORY-CARD', count: 2 },
    ];
    useHistoryStore.setState({ history: [{
      ...match,
      selfDeckSnapshot,
      oppDeckSnapshot: snapshot(SAMPLE_DECK_OPP),
    } as MatchRecord] });
    act(() => root.render(<HistoryScreen onNav={() => undefined} />));
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('デッキを見る'))!.click());

    const playerPanel = container.querySelector<HTMLElement>('#history-self-deck-panel')!;
    expect(playerPanel.textContent).toContain('一部カード情報なし（2枚）');
    expect(playerPanel.textContent).toContain('確認できたカードのみ集計');
    expect(playerPanel.querySelector('[data-testid="history-deck-cost-chart"]')?.getAttribute('aria-label'))
      .toContain('確認できたカードのみ');
  });

  it('shows a selectable exact deck code when clipboard copy is rejected', async () => {
    const writeText = vi.fn().mockRejectedValue(new DOMException('Denied', 'NotAllowedError'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    useHistoryStore.setState({ history: [{
      ...match,
      selfDeckSnapshot: snapshot(SAMPLE_DECK),
      oppDeckSnapshot: snapshot(SAMPLE_DECK_OPP),
    } as MatchRecord] });
    act(() => root.render(<HistoryScreen onNav={() => undefined} />));
    act(() => Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('デッキを見る'))!.click());

    const copy = container.querySelector<HTMLButtonElement>('button[aria-label="PLAYERのデッキコードをコピー"]')!;
    await act(async () => copy.click());

    const fallback = container.querySelector<HTMLInputElement>('input[aria-label="PLAYERのデッキコード"]');
    expect(fallback).not.toBeNull();
    expect(fallback?.value).toBe(encodeDeck(SAMPLE_DECK));
    expect(container.textContent).toContain('下のコードを選択してください');
  });

  it('does not offer the deck viewer when only one match-time deck was saved', () => {
    useHistoryStore.setState({ history: [{ ...match, selfDeckSnapshot: snapshot(SAMPLE_DECK) }] });
    act(() => root.render(<HistoryScreen onNav={() => undefined} />));

    expect(container.textContent).toContain('デッキ内容未保存');
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent?.includes('デッキを見る'))).toBe(false);
  });

  it('does not reconstruct legacy history from a current deck with the same name', () => {
    useHistoryStore.setState({ history: [match] });
    act(() => root.render(<HistoryScreen onNav={() => undefined} />));

    expect(container.textContent).toContain('デッキ内容未保存');
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent?.includes('デッキを見る'))).toBe(false);
  });

  it('rejects a bare replay route instead of opening a fabricated replay', () => {
    useHistoryStore.setState({ history: [match] });
    const onNav = vi.fn();
    act(() => root.render(<ReplayScreen onNav={onNav} />));

    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain('保存データを安全に検証できませんでした');
    expect(container.querySelector('.replay-board')).toBeNull();
    const returnToHistory = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === '履歴へ戻る');
    expect(returnToHistory).not.toBeUndefined();
    act(() => returnToHistory?.click());
    expect(onNav).toHaveBeenCalledWith('history');
  });

  it('announces a paused manual replay step without adding autoplay chatter', async () => {
    const sessionId = 'replay-manual-announcement';
    const initial = createEmptyGameState();
    startCausalSession(initial, sessionId);
    const terminal = structuredClone(initial);
    appendCausal(terminal, {
      actor: 'self',
      kind: 'draw',
      targets: [],
      outcome: { type: 'count', amount: 1, unit: 'card' },
    });
    mutate.gameResult.set(terminal, 'self', 'evidence');
    const log = buildReplayLogV3({
      artifactId: `replay-${sessionId}`,
      sessionId,
      viewerMode: 'solo-self',
      states: [initial, terminal],
    });
    await saveHistoryReplay({
      ...match,
      id: sessionId,
      sessionId,
      mode: 'solo',
    }, log);
    window.history.replaceState(null, '', `#replay/${log.artifactId}`);

    act(() => root.render(<ReplayScreen onNav={() => undefined} />));
    await act(async () => {
      await vi.waitFor(() => {
        expect(container.querySelector('.replay-primary-control')).not.toBeNull();
      });
    });
    const next = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent === '1件進む')!;
    act(() => next.click());

    const announcement = container.querySelector('.replay-manual-announcement');
    expect(announcement?.getAttribute('aria-live')).toBe('polite');
    expect(announcement?.getAttribute('aria-atomic')).toBe('true');
    expect(announcement?.textContent).toContain('1 / 1');
    expect(announcement?.textContent).toContain('プレイヤー');
  });

  it('labels the terminal replay frame from game-result instead of a preceding summary', () => {
    const state = createEmptyGameState();
    startCausalSession(state, 'terminal-summary-label');
    appendCausal(state, {
      actor: 'self',
      kind: 'summary',
      targets: [],
      outcome: { type: 'summary', count: 1, kinds: ['summary'] },
    });
    appendCausal(state, {
      actor: 'self',
      kind: 'game-result',
      targets: [{ kind: 'player', side: 'opp' }],
      outcome: { type: 'state', state: 'success' },
    });
    state.gameResult = { winner: 'self', reason: 'evidence' };

    expect(currentReplayEventSummary(state, 'solo-self')).toContain('勝敗確定');
    expect(currentReplayEventSummary(state, 'solo-self')).not.toContain('causal.summary');
  });

  it('keeps case-status and face-change outcomes in the replay summary and live region text', () => {
    const caseState = createEmptyGameState();
    startCausalSession(caseState, 'case-status-summary-label');
    appendCausal(caseState, {
      actor: 'self',
      kind: 'case-status-change',
      targets: [],
      outcome: { type: 'case-status', from: 'incident', to: 'resolved' },
    });
    expect(currentReplayEventSummary(caseState, 'solo-self')).toContain('事件編から解決編へ');

    const faceState = createEmptyGameState();
    startCausalSession(faceState, 'face-change-summary-label');
    appendCausal(faceState, {
      actor: 'self',
      kind: 'evidence',
      targets: [],
      outcome: { type: 'face-change', from: 'face-down', to: 'face-up', count: 2 },
    });
    expect(currentReplayEventSummary(faceState, 'solo-self')).toContain('2枚を表向きに変更');
  });
});
