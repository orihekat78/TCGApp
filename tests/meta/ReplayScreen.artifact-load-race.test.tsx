import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildReplayLogV3, type ReplayLogV3 } from '@/ai/replay/state-frame';
import { appendCausal, startCausalSession } from '@/engine/log/causal';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  beginMatchSession,
  endMatchSession,
  isCurrentMatchSession,
  isMatchSessionActive,
} from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';

const { loadArtifactMock } = vi.hoisted(() => ({ loadArtifactMock: vi.fn() }));

vi.mock('../../meta-app/src/services/historyReplayRepository', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../meta-app/src/services/historyReplayRepository')>();
  return { ...actual, loadHistoryReplayArtifact: loadArtifactMock };
});

import { App } from '../../meta-app/src/App';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

function validReplay(): ReplayLogV3 {
  const sessionId = 'stale-artifact-session';
  const initial = createEmptyGameState();
  startCausalSession(initial, sessionId);
  const terminal = structuredClone(initial);
  appendCausal(terminal, {
    actor: 'self',
    kind: 'game-result',
    source: { kind: 'player', side: 'self' },
    targets: [{ kind: 'player', side: 'opp' }],
    outcome: { type: 'state', state: 'success' },
  });
  terminal.gameResult = { winner: 'self', reason: 'evidence' };
  return buildReplayLogV3({
    artifactId: 'replay-stale-load',
    sessionId,
    viewerMode: 'solo-self',
    states: [initial, terminal],
  });
}

describe('ReplayScreen artifact-load ownership', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; });

  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    loadArtifactMock.mockReset();
    endMatchSession();
    window.history.replaceState(null, '', '#replay/replay-stale-load');
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    endMatchSession();
    container.remove();
    window.history.replaceState(null, '', '#home');
    vi.unstubAllGlobals();
  });

  it('ignores an obsolete artifact promise after navigation and a new live session begins', async () => {
    const artifact = deferred<ReplayLogV3>();
    loadArtifactMock.mockReturnValue(artifact.promise);

    act(() => root.render(<App />));
    await act(async () => {
      await vi.waitFor(() => expect(loadArtifactMock).toHaveBeenCalledOnce());
    });

    act(() => {
      window.history.replaceState(null, '', '#setup');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await act(async () => {
      await vi.waitFor(() => expect(container.querySelector('.replay-screen')).toBeNull());
    });

    const liveSession = beginMatchSession('self');
    expect(isMatchSessionActive()).toBe(true);
    expect(isCurrentMatchSession(liveSession)).toBe(true);
    expect(useGameStateStore.getState().gameState).toBeNull();

    await act(async () => {
      artifact.resolve(validReplay());
      await artifact.promise;
      await Promise.resolve();
    });

    expect(isMatchSessionActive()).toBe(true);
    expect(isCurrentMatchSession(liveSession)).toBe(true);
    expect(useGameStateStore.getState().gameState).toBeNull();
    expect(container.querySelector('.replay-screen')).toBeNull();
  });
});
