import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';

import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { useGameStateStore } from '@/ui/state/store';
import { usePresentationStore } from '@/ui/presentation/store';
import { startCausalSession } from '@/engine/log/causal';
import {
  beginMatchSession,
  endMatchSession,
  matchSessionId,
} from '@/ui/services/matchSession';
import {
  getFinalizedReplay,
  resetLiveReplayRecorderForTests,
} from '@/ui/services/liveReplayRecorder';
import { ResultScreen } from '../../meta-app/src/screens/ResultScreen';
import * as historyReplayRepository from '../../meta-app/src/services/historyReplayRepository';
import { useHistoryStore } from '../../meta-app/src/state/historyStore';
import { normalizeSettings, useMetaStore } from '../../meta-app/src/state/metaStore';

describe('ResultScreen', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    endMatchSession();
    resetLiveReplayRecorderForTests();
    useGameStateStore.setState({ gameState: null });
    usePresentationStore.setState({ presentationCompletionNotice: null });
    useHistoryStore.setState({ history: [] });
    useMetaStore.setState({
      settings: normalizeSettings(null),
      _pendingPracticeStepId: null,
      _matchMeta: null,
    });
    vi.stubGlobal('indexedDB', new IDBFactory());
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    endMatchSession();
    resetLiveReplayRecorderForTests();
    window.history.replaceState(null, '', '#home');
    vi.unstubAllGlobals();
  });

  function renderResult(): string {
    act(() => {
      root.render(
        <ResultScreen
          onNav={() => undefined}
          onRematch={() => undefined}
        />,
      );
    });
    return container.innerHTML;
  }

  async function flushUntil(condition: () => boolean): Promise<void> {
    for (let attempt = 0; attempt < 500; attempt += 1) {
      if (condition()) return;
      await act(async () => new Promise((resolve) => setTimeout(resolve, 10)));
    }
    expect(condition()).toBe(true);
  }

  it('marks only the canonical L5 practice step after a self win', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: state });
    useMetaStore.setState({
      settings: normalizeSettings({ tutorialClearedStepIds: ['L0-1'] }),
    });
    useMetaStore.getState().startPracticeFor('L5-4');

    renderResult();

    expect(useMetaStore.getState().settings.tutorialClearedStepIds)
      .toEqual(['L0-1', 'L5-4']);
    expect(useMetaStore.getState()._pendingPracticeStepId).toBeNull();
  });

  it('consumes practice provenance without clearing a step after a loss', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'opp', reason: 'evidence' };
    useGameStateStore.setState({ gameState: state });
    useMetaStore.setState({
      settings: normalizeSettings({ tutorialClearedStepIds: ['L0-1'] }),
    });
    useMetaStore.getState().startPracticeFor('L5-4');

    renderResult();

    expect(useMetaStore.getState().settings.tutorialClearedStepIds)
      .toEqual(['L0-1']);
    expect(useMetaStore.getState()._pendingPracticeStepId).toBeNull();
  });

  it('does not mistake another canonical guided step for practice completion', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: state });
    useMetaStore.setState({ settings: normalizeSettings(null) });
    useMetaStore.getState().startPracticeFor('L3-1');

    renderResult();

    expect(useMetaStore.getState().settings.tutorialClearedStepIds).toEqual([]);
    expect(useMetaStore.getState()._pendingPracticeStepId).toBeNull();
  });

  it('presents the resolved CPU match with the primary result actions', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: state });

    const html = renderResult();

    expect(html).toContain('勝利');
    expect(html).toContain('CPU対戦');
    expect(html).toContain('もう一度対戦');
    expect(html).toContain('利用不可');
    expect(html).toContain('この対戦には完全なリプレイ記録がありません');
    expect(html).toContain('DETECTIVE CONAN');
    expect(html).not.toContain('aria-current="page"');
  });

  it('renders the terminal verdict and end reason without the retired match-summary panel', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: state });

    renderResult();

    expect(container.querySelector('.result-verdict h1')?.textContent).toBe('勝利');
    expect(container.querySelector('.result-end-reason strong')?.textContent).toBe('必要証拠数達成');
    expect(container.querySelector('.result-panel .result-summary')).toBeNull();
    expect(container.querySelector('.result-panel')?.textContent).not.toContain('MATCH SUMMARY');
  });

  it('announces terminal presentation work carried across the result transition', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: state });
    usePresentationStore.setState({
      presentationCompletionNotice: { kind: 'terminal', count: 3 },
    });

    renderResult();

    const notice = container.querySelector('[data-testid="result-presentation-notice"]');
    expect(notice?.textContent).toBe('3件の処理を最終要約にまとめました');
    expect(notice?.getAttribute('role')).toBe('status');
    expect(notice?.getAttribute('aria-live')).toBe('polite');
  });

  it('confirms a terminal skip after the result route replaces the match', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: state });
    usePresentationStore.setState({
      presentationCompletionNotice: { kind: 'skip', count: 2 },
    });

    renderResult();

    expect(container.querySelector('[data-testid="result-presentation-notice"]')?.textContent)
      .toBe('2件の処理をスキップしました');
  });

  it('dispatches rematch but keeps replay unavailable', () => {
    const state = createEmptyGameState();
    state.gameResult = { winner: 'self', reason: 'evidence' };
    useGameStateStore.setState({ gameState: state });
    const onNav = vi.fn();
    const onRematch = vi.fn();

    act(() => {
      root.render(<ResultScreen onNav={onNav} onRematch={onRematch} />);
    });
    const rematch = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('もう一度対戦'))!;
    act(() => rematch.click());
    expect(onRematch).toHaveBeenCalledOnce();
    expect(useGameStateStore.getState().gameState).toBe(state);

    useGameStateStore.setState({ gameState: state });
    act(() => {
      root.render(<ResultScreen onNav={onNav} onRematch={onRematch} />);
    });
    const replay = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('利用不可'))!;
    expect(replay.disabled).toBe(true);
    expect(replay.getAttribute('aria-describedby')).toBe('result-replay-note');
    act(() => replay.click());
    expect(onNav).not.toHaveBeenCalled();
  });

  it('persists a finalized replay, enables it, and opens its exact artifact route', async () => {
    const token = beginMatchSession('self');
    const sessionId = matchSessionId(token);
    const initial = createEmptyGameState();
    startCausalSession(initial, sessionId);
    useGameStateStore.setState({ gameState: initial });
    const terminal = structuredClone(initial);
    mutate.gameResult.set(terminal, 'self', 'evidence');
    useGameStateStore.setState({ gameState: terminal });
    useMetaStore.getState().setMatchMeta({
      sessionId,
      mode: 'solo',
      selfDeckName: 'Replay self deck',
      oppDeckName: 'Replay CPU deck',
    });
    endMatchSession({ preserveGameState: true });
    expect(getFinalizedReplay(sessionId)).not.toBeNull();

    act(() => root.render(
      <ResultScreen onNav={() => undefined} onRematch={() => undefined} />,
    ));
    await flushUntil(() => Array.from(container.querySelectorAll('button'))
      .some((button) => button.textContent?.includes('リプレイを見る')));
    expect(
      Array.from(container.querySelectorAll('button'))
        .some((button) => button.textContent?.includes('リプレイを見る')),
      container.textContent ?? 'result screen is empty',
    ).toBe(true);

    const stored = await historyReplayRepository.listStoredHistoryRows();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      id: sessionId,
      sessionId,
      replayRef: { artifactId: `replay-${sessionId}` },
    });
    const replay = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('リプレイを見る'))!;
    expect(replay.disabled).toBe(false);
    act(() => replay.click());
    expect(window.location.hash).toBe(`#replay/replay-${sessionId}`);
  });

  it('commits neither history nor replay capability when atomic replay storage fails', async () => {
    const token = beginMatchSession('self');
    const sessionId = matchSessionId(token);
    const initial = createEmptyGameState();
    startCausalSession(initial, sessionId);
    useGameStateStore.setState({ gameState: initial });
    const terminal = structuredClone(initial);
    mutate.gameResult.set(terminal, 'self', 'evidence');
    useGameStateStore.setState({ gameState: terminal });
    useMetaStore.getState().setMatchMeta({
      sessionId,
      mode: 'solo',
      selfDeckName: 'Atomic self deck',
      oppDeckName: 'Atomic CPU deck',
    });
    endMatchSession({ preserveGameState: true });
    expect(getFinalizedReplay(sessionId)).not.toBeNull();
    const saveReplaySpy = vi.spyOn(historyReplayRepository, 'saveHistoryReplay')
      .mockRejectedValueOnce(new Error('quota exceeded'));

    act(() => root.render(
      <ResultScreen onNav={() => undefined} onRematch={() => undefined} />,
    ));
    await act(async () => { await Promise.resolve(); });

    expect(saveReplaySpy).toHaveBeenCalledOnce();
    expect(container.querySelector('#result-replay-note')?.getAttribute('role')).toBe('alert');
    expect(useHistoryStore.getState().history).toEqual([]);
    expect(getFinalizedReplay(sessionId)).not.toBeNull();
    expect(container.querySelector('#result-replay-note')?.textContent)
      .toBe('対戦履歴とリプレイを保存できませんでした。');
    const retry = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .find((button) => button.textContent?.includes('保存を再試行'))!;
    expect(retry.disabled).toBe(false);

    act(() => retry.click());
    await flushUntil(() => container.querySelector('#result-replay-note')?.textContent
      === 'この対戦の完全なリプレイを再生できます。');
    expect(useHistoryStore.getState().history).toHaveLength(1);
    expect(await historyReplayRepository.listStoredHistoryRows()).toHaveLength(1);
    expect(getFinalizedReplay(sessionId)).toBeNull();
  });
});
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });
