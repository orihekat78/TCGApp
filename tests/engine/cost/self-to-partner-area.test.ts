import { beforeEach, describe, expect, it } from 'vitest';
import { canPayAtomically, pay } from '@/engine/cost/pay';
import { enumerateMoves } from '@/ai/move-enumerator';
import { event } from '@/engine/event';
import { endTurn } from '@/engine/flow/turn';
import { mutate } from '@/engine/mutate';
import { produce } from '@/engine/produce';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, Cost, EffectCtx, GameState } from '@/engine/types';
import { enumDeclaredAbilitySources } from '@/ui/hooks/useActionsPanelFlow/enumerators';
import { makeChar } from '../../helpers/fixtures';

const MR = 'PA-COST-MR';
const OTHER = 'PA-COST-OTHER';
const COST = {
  kind: 'pay',
  items: [{ kind: 'sleepSelf' }, { kind: 'selfToPartnerArea' }],
} as unknown as Cost;

function card(id: string, rarity: 'MR' | 'C'): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: [], level: 1, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity, imageUrl: '', abilities: id === MR ? [{
      id: 'pa', type: 'declared', scope: 'on-partner-area',
      effect: { kind: 'atom', verb: 'noop', args: {} }, description: '', ruleRefs: [],
    }] : [], ruleRefs: [],
  } as CardDef;
}

function state(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.scene = [makeChar({
    cardId: MR,
    uid: 'mr#original',
    state: 'active',
    isNamed: true,
    declaredUseCount: { a1: 1 },
    turnEffects: { apMod_turn: 2000, grantedAbilities: [{ id: 'grant', type: 'triggered' }] },
    setCards: [{ cardId: 'SET', faceUp: false, instanceId: 'set#1' }],
    stackedCards: [{ cardId: 'STACK', instanceId: 'stack#1' }],
  })];
  return s;
}

function ctx(): EffectCtx {
  return { source: { cardId: MR, uid: 'mr#original', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} };
}

beforeEach(() => {
  _resetRegistry();
  event._resetRegistry();
  register(card(MR, 'MR'));
  register(card(OTHER, 'C'));
});

describe('Cost.selfToPartnerArea', () => {
  it('moves the exact own scene MR atomically, preserves its identity/state, and does not emit a scene-leave hook', () => {
    const source = state();
    const leaves: unknown[] = [];
    event.on('leave:to-remove', (_draft, payload) => { leaves.push(payload); });

    expect(canPayAtomically(source, COST, ctx())).toBe(true);
    const after = produce(source, draft => { pay(draft, COST, ctx()); });
    const mr = after.players.self.partnerAreaMR!;

    expect(after.players.self.scene).toEqual([]);
    expect(mr).toMatchObject({
      cardId: MR,
      uid: 'mr#original',
      state: 'sleep',
      isNamed: false,
      declaredUseCount: { a1: 1 },
      turnEffects: expect.objectContaining({ apMod_turn: 2000 }),
      setCards: [],
      stackedCards: 0,
    });
    expect(after.players.self.remove).toEqual(['SET', 'STACK']);
    expect(leaves).toEqual([]);
  });

  it.each([
    ['occupied PA slot', (s: GameState) => { s.players.self.partnerAreaMR = makeChar({ cardId: OTHER, uid: 'occupied' }); }],
    ['stale source card', (s: GameState) => { s.players.self.scene[0]!.cardId = OTHER; }],
  ])('rejects %s before sleepSelf mutates', (_name, arrange) => {
    const source = state();
    arrange(source);
    const before = JSON.stringify(source);

    expect(canPayAtomically(source, COST, ctx())).toBe(false);
    expect(() => produce(source, draft => { pay(draft, COST, ctx()); })).toThrow('cost is not fully payable');
    expect(JSON.stringify(source)).toBe(before);
  });

  it('clears PA-MR turn effects at endTurn', () => {
    const moved = produce(state(), draft => { pay(draft, COST, ctx()); });
    const after = produce(moved, draft => { endTurn(draft, 'self'); });

    expect(after.players.self.partnerAreaMR?.turnEffects['apMod_turn']).toBeUndefined();
    expect(after.players.self.partnerAreaMR?.turnEffects['grantedAbilities']).toBeUndefined();
  });

  it('keeps the actual uid usable by UI and AI while in the PA slot', () => {
    const moved = produce(state(), draft => { pay(draft, COST, ctx()); });

    expect(enumDeclaredAbilitySources(moved, 'self')).toContain('mr#original');
    expect(enumerateMoves(moved, 'self')).toContainEqual({ kind: 'declaredAbility', uid: 'mr#original', abilityId: 'pa' });
  });

  it('does not accept a non-MR own scene character', () => {
    const source = state();
    source.players.self.scene[0]!.cardId = OTHER;
    expect(canPayAtomically(source, COST, ctx())).toBe(false);
  });
});
