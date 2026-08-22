import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B05117 } from '@/cards/ct-p05/B05117';
import { B05117P } from '@/cards/ct-p05/B05117P';
import { event } from '@/engine/event';
import { _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { Playmat } from '@/ui/components/Playmat';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const HOST: CardDef = {
  id: 'W35-LIFECYCLE-HOST', no: 'test/W35-LIFECYCLE-HOST', kind: 'character',
  names: ['退場するホスト'], colors: ['青'], level: 1, ap: 9000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

const RETURN_TARGET: CardDef = {
  ...HOST,
  id: 'W35-LIFECYCLE-TARGET',
  no: 'test/W35-LIFECYCLE-TARGET',
  names: ['帰還対象'],
  level: 6,
  abilities: [{
    id: 'cutin',
    type: 'triggered',
    scope: 'on-hand',
    trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: '【カットイン】',
    ruleRefs: [],
  }],
};

const resolveCard = (cardId: string): ResolvedCardMeta => ({
  name: cardId,
  color: '青',
  ap: 9000,
  lp: 1,
  lv: 1,
});

function lifecycleState(cardIds: readonly string[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.scene = [sceneChar(HOST.id, 'host', {
    setCards: cardIds.map((cardId, index) => ({
      cardId,
      instanceId: `set:gone:${index + 1}`,
      faceUp: true,
    })),
  })];
  state.players.self.remove = [RETURN_TARGET.id];
  mutate.scene.removeToRemove(state, 'host', 'effect');
  return state;
}

describe('Wave35 source identity after the set-card host leaves', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useGameStateStore.getState().resetMatchSessionState();
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetRegistry();
    _resetUidCounter();
    registerAll();
    register(HOST);
    register(RETURN_TARGET);
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    endMatchSession();
    beginMatchSession('self');
    useGameStateStore.setState({ spectatorMode: false, isAiPaused: true });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    endMatchSession();
    useGameStateStore.getState().setGameState(null);
  });

  it.each([
    ['base/base', [B05117.id, B05117.id], 'コンコン（通常版・1枚目）'],
    ['parallel/parallel', [B05117P.id, B05117P.id], 'コンコン（パラレル版・1枚目）'],
    ['base/parallel', [B05117.id, B05117P.id], 'コンコン（通常版）'],
  ] as const)('%s keeps the first production picker source exact after host removal', (_label, cardIds, expectedLabel) => {
    const state = lifecycleState(cardIds);
    const ordered = pendingOwnerOrderGroup(state, 'self').filter(entry => (
      entry.source.abilityId === 'b05117_set_t1'
    ));
    expect(ordered).toHaveLength(2);
    resetPresentationQueue(`qa-wave35-lifecycle-${_label.replace('/', '-')}`);
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder',
      player: 'self',
      entryIds: ordered.map(entry => entry.id),
    })).toEqual({ ok: true });

    const store = useGameStateStore.getState();
    expect(store.gameState?.players.self.scene.some(card => card.uid === 'host')).toBe(false);
    expect(store.pendingEffectPick?.source).toMatchObject({
      setCardId: cardIds[0],
      setCardInstanceId: 'set:gone:1',
    });

    act(() => root.render(<Playmat gameState={store.gameState!} resolveCard={resolveCard} />));
    const banner = container.querySelector('.card-list-modal-pick-banner');
    expect(banner?.textContent).toContain(expectedLabel);
    expect(banner?.textContent).not.toContain('退場するホスト');
    expect(banner?.textContent).not.toContain('set:gone:');
  });
});
