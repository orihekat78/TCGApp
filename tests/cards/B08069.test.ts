import { beforeEach, describe, expect, it } from 'vitest';
import { B08069 } from '@/cards/ct-p08/B08069';
import { event } from '@/engine/event';
import {
  _clearPendingEffectPickQueue,
  _peekPendingEffectPickSide,
} from '@/engine/effect/pending-state';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import {
  registerReservedEffectListener,
  _resetReservedEffectsRegistered,
} from '@/engine/listeners/reserved-effects';
import {
  registerTriggeredListener,
  _resetTriggeredRegistered,
} from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { pendingOwnerOrderGroup, runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../helpers/fixtures';

function character(id: string, level: number, traits: string[] = []): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['黄'],
    level,
    ap: 1000,
    lp: 1,
    traits,
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

const COP4 = character('B08069_COP4', 4, ['警察']);
const FILLER = character('B08069_FILLER', 1);
const END_DRAW: CardDef = {
  ...character('B08069_END_DRAW', 1),
  abilities: [{
    id: 'a1',
    type: 'triggered',
    scope: 'on-scene',
    trigger: { hook: 'phase:end:start' },
    condition: { kind: 'turn', player: 'self' },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: 'draw at end',
    ruleRefs: [],
  }],
};

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetReservedEffectsRegistered();
  _resetRegistry();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
  [B08069, COP4, FILLER, END_DRAW].forEach(registerCardDef);
  registerTriggeredListener();
  registerReservedEffectListener();
});

describe('B08069 official Q&A', () => {
  it('defers its hand target until the owner chooses the order of simultaneous end effects', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar(B08069.id, 'kazami'),
      sceneChar(END_DRAW.id, 'draw-source'),
    ];
    state.players.self.deck = [COP4.id, FILLER.id];

    activateDeclaredAbility(state, 'kazami', 'a1');
    runAllUntilEmpty(state);
    event.emit(state, 'phase:end:start', { player: 'self' }, undefined);

    const group = pendingOwnerOrderGroup(state, 'self');
    expect(group).toHaveLength(2);
    expect(_peekPendingEffectPickSide()).toBeNull();

    const drawEntry = group.find((entry) => entry.source.cardId === END_DRAW.id)!;
    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: drawEntry.id, order: 0, player: 'self' })).toEqual({ ok: true });
    const ordered = pendingOwnerOrderGroup(useGameStateStore.getState().gameState!, 'self');
    expect(dispatchEngineAction({ type: 'resolveEffectOrder', entryIds: ordered.map((entry) => entry.id), player: 'self' })).toEqual({ ok: true });
    const after = useGameStateStore.getState();

    expect(after.gameState!.players.self.hand).toContain(COP4.id);
    expect(after.pendingEffectPick?.candidates.map((candidate) => candidate.cardId)).toEqual([COP4.id]);
  });

  it('leaves the newly drawn candidate in hand when the owner resolves B08069 before the draw', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar(B08069.id, 'kazami'),
      sceneChar(END_DRAW.id, 'draw-source'),
    ];
    state.players.self.deck = [COP4.id, FILLER.id];

    activateDeclaredAbility(state, 'kazami', 'a1');
    runAllUntilEmpty(state);
    event.emit(state, 'phase:end:start', { player: 'self' }, undefined);

    const group = pendingOwnerOrderGroup(state, 'self');
    const b08069Entry = group.find((entry) => entry.source.cardId === B08069.id)!;
    useGameStateStore.setState({ gameState: state });
    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: b08069Entry.id, order: 0, player: 'self' })).toEqual({ ok: true });
    const ordered = pendingOwnerOrderGroup(useGameStateStore.getState().gameState!, 'self');
    expect(dispatchEngineAction({ type: 'resolveEffectOrder', entryIds: ordered.map((entry) => entry.id), player: 'self' })).toEqual({ ok: true });
    const emptyPick = useGameStateStore.getState().pendingEffectPick;
    expect(emptyPick?.candidates).toEqual([]);
    expect(dispatchEngineAction(bindPendingDecision(emptyPick!, { type: 'effectPickResolve', pickedUid: null }))).toEqual({ ok: true });
    const after = useGameStateStore.getState();

    expect(after.gameState!.players.self.hand).toContain(COP4.id);
    expect(after.gameState!.players.self.scene.some((card) => card.cardId === COP4.id)).toBe(false);
    expect(after.pendingEffectPick).toBeNull();
  });

  it('evaluates its hand target only after an earlier simultaneous effect resolves', () => {
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar(B08069.id, 'kazami'),
      sceneChar(END_DRAW.id, 'draw-source'),
    ];
    state.players.self.deck = [COP4.id, FILLER.id];

    activateDeclaredAbility(state, 'kazami', 'a1');
    runAllUntilEmpty(state);
    event.emit(state, 'phase:end:start', { player: 'self' }, undefined);
    runAllUntilEmpty(state);

    expect(state.players.self.hand).not.toContain(COP4.id);
    expect(state.players.self.scene.some((card) => card.cardId === COP4.id)).toBe(true);
    expect(_peekPendingEffectPickSide()).toBeNull();
  });
});
