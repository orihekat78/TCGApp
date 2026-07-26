import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { pay } from '@/engine/cost/pay';
import { runAtom } from '@/engine/effect/atom-handlers';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { run as runEffect } from '@/engine/effect/resolver';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';
import { makeCtx } from '../helpers/fixtures';

const character = (id: string): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['青'], traits: [],
  level: 1, ap: 1000, lp: 1, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});

const terminalEnterCharacter: CardDef = {
  ...character('TERMINAL_ENTER'),
  abilities: [{
    id: 'a1',
    type: 'triggered',
    scope: 'on-scene',
    trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
    description: 'terminal regression observer',
    ruleRefs: ['rules/14-refresh.md', 'rules/15-abilities-effects.md'],
  }],
};

function state(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
}

function sceneCtx(s: GameState, source: EffectCtx['source'] = { player: 'self', cardId: 'HOST' }): EffectCtx {
  const host = mutate.scene.enter(s, source.player, 'HOST', {});
  return { source: { ...source, uid: host.uid }, bindings: {}, dyn: {} } as EffectCtx;
}

function multiEnterFromDeck(s: GameState, ctx: EffectCtx, player: 'self' | 'opp', cardIds: string[]): void {
  runAtom(s, 'sceneEnter' as never, {
    player,
    cardIds,
    target: {
      kind: 'pick',
      query: { area: 'deck', side: 'self' },
      n: { min: 0, max: cardIds.length },
      chooser: 'owner',
    },
  }, ctx);
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  registerCardDef(character('HOST'));
  registerCardDef(character('C1'));
  registerCardDef(character('C2'));
  registerCardDef(terminalEnterCharacter);
  registerTriggeredListener();
});

describe('BUG-180: completed deck take refreshes on exact exhaustion', () => {
  it('removeDeckTop cost: exact payment refreshes immediately', () => {
    const s = state();
    s.players.self.deck = ['A', 'B'];
    s.players.self.remove = ['R'];

    const after = produce(s, draft => {
      pay(draft, { kind: 'removeDeckTop', player: 'self', n: 2 }, makeCtx());
    });

    expect([...after.players.self.deck].sort()).toEqual(['A', 'B', 'R']);
    expect(after.players.self.remove).toEqual([]);
    expect(after.players.opp.evidence).toHaveLength(1);
    expect(after.scratchTrace.opp).toBe('発見済');
    expect(after.refreshCount.self).toBe(1);
  });

  it('removeDeckTop cost: opponent deck uses opponent refresh orientation', () => {
    const s = state();
    s.players.opp.deck = ['A'];
    s.players.opp.remove = ['R'];

    const after = produce(s, draft => {
      pay(draft, { kind: 'removeDeckTop', player: 'opp', n: 1 }, makeCtx());
    });

    expect([...after.players.opp.deck].sort()).toEqual(['A', 'R']);
    expect(after.players.opp.remove).toEqual([]);
    expect(after.players.self.evidence).toHaveLength(1);
    expect(after.refreshCount.opp).toBe(1);
  });

  it('removeDeckTop cost: non-empty remainder does not refresh', () => {
    const s = state();
    s.players.self.deck = ['A', 'B', 'C'];
    s.players.self.remove = ['R'];

    const after = produce(s, draft => {
      pay(draft, { kind: 'removeDeckTop', player: 'self', n: 2 }, makeCtx());
    });

    expect(after.players.self.deck).toEqual(['C']);
    expect(after.players.self.remove).toEqual(['R', 'A', 'B']);
    expect(after.players.opp.evidence).toHaveLength(0);
    expect(after.refreshCount.self).toBe(0);
  });

  it('multi sceneEnter: exact deck take refreshes after all selected cards enter', () => {
    const s = state();
    const ctx = sceneCtx(s);
    s.players.self.deck = ['C1', 'C2'];
    s.players.self.remove = ['R'];

    multiEnterFromDeck(s, ctx, 'self', ['C1', 'C2']);

    expect(s.players.self.scene.map(c => c.cardId)).toEqual(['HOST', 'C1', 'C2']);
    expect(s.players.self.deck).toEqual(['R']);
    expect(s.players.self.remove).toEqual([]);
    expect(s.players.opp.evidence).toHaveLength(1);
  });

  it('multi sceneEnter: last card with empty remove causes deck-out loss', () => {
    const s = state();
    const ctx = sceneCtx(s);
    s.players.self.deck = ['C1'];
    s.players.self.remove = [];
    let groupObserverRan = false;
    event.on('enter:group', () => { groupObserverRan = true; });

    multiEnterFromDeck(s, ctx, 'self', ['C1']);

    expect(s.players.self.scene.map(c => c.cardId)).toContain('C1');
    expect(s.gameResult).toMatchObject({ winner: 'opp', reason: 'deck-out' });
    expect(groupObserverRan).toBe(false);
  });

  it('final-card sceneEnter stops the current tail and cancels enter observers after deck-out', () => {
    const s = state();
    const effectCtx = sceneCtx(s);
    s.players.self.deck = ['TERMINAL_ENTER'];
    s.players.self.remove = [];
    let groupObserverRan = false;
    event.on('enter:group', () => { groupObserverRan = true; });

    runEffect(s, {
      kind: 'sequence',
      steps: [
        {
          kind: 'atom',
          verb: 'sceneEnter',
          args: {
            player: 'self',
            cardId: 'TERMINAL_ENTER',
            viaEffect: true,
            target: {
              kind: 'pick',
              query: { area: 'deck', side: 'self' },
              n: { min: 1, max: 1 },
              chooser: 'owner',
            },
          },
        },
        { kind: 'atom', verb: 'charModifyAP', args: { uid: effectCtx.source.uid, delta: 2000, scope: 'turn' } },
      ],
    }, effectCtx);
    runAllUntilEmpty(s);

    expect(s.gameResult).toEqual({ winner: 'opp', reason: 'deck-out' });
    expect(s.players.self.scene.find(c => c.uid === effectCtx.source.uid)?.turnEffects.apMod_turn).toBeUndefined();
    expect(s.players.self.scene.find(c => c.cardId === 'TERMINAL_ENTER')?.turnEffects.apMod_turn).toBeUndefined();
    expect(s.pendingEffects.some(entry => entry.state === 'pending' || entry.state === 'resolving')).toBe(false);
    expect(groupObserverRan).toBe(false);
  });

  it('multi sceneEnter: resolving normal event stays excluded from refresh', () => {
    const s = state();
    const ctx = sceneCtx(s, {
      player: 'self', cardId: 'EVENT', area: 'remove', resolutionKind: 'normal-event',
    });
    s.players.self.deck = ['C1'];
    s.players.self.remove = ['R', 'EVENT'];

    multiEnterFromDeck(s, ctx, 'self', ['C1']);

    expect(s.players.self.deck).toEqual(['R']);
    expect(s.players.self.remove).toEqual(['EVENT']);
    expect(s.players.opp.evidence).toHaveLength(1);
  });

  it('single sceneEnter completes enter before the exact-exhaustion refresh checkpoint', () => {
    const s = state();
    const ctx = sceneCtx(s);
    s.players.self.deck = ['C1'];
    s.players.self.remove = ['R'];

    runAtom(s, 'sceneEnter' as never, {
      player: 'self', cardId: 'C1',
      target: { kind: 'pick', query: { area: 'deck', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'owner' },
    }, ctx);

    expect(s.players.self.scene.map(c => c.cardId)).toContain('C1');
    const enterLog = s.log.findIndex(entry => entry.action === 'effect:sceneEnter');
    const refreshLog = s.log.findIndex(entry => entry.action === 'refresh');
    expect(enterLog).toBeGreaterThanOrEqual(0);
    expect(refreshLog).toBeGreaterThan(enterLog);
  });

  it('draw: taking the exact last card refreshes even when no further draw remains', () => {
    const s = state();
    s.players.self.deck = ['A'];
    s.players.self.remove = ['R'];

    const after = produce(s, draft => {
      mutate.deck.draw(draft, 'self', 1);
    });

    expect(after.players.self.hand).toEqual(['A']);
    expect(after.players.self.deck).toEqual(['R']);
    expect(after.players.self.remove).toEqual([]);
    expect(after.players.opp.evidence).toHaveLength(1);
  });

  it('evidence and FILE takes refresh on exact final take', () => {
    const evidenceState = state();
    evidenceState.players.self.deck = ['A'];
    evidenceState.players.self.remove = ['R'];
    const afterEvidence = produce(evidenceState, draft => {
      mutate.evidence.addFromDeck(draft, 'self', 1, false, { turn: 3, via: 'reasoning' });
    });
    expect(afterEvidence.players.self.evidence.map(e => e.cardId)).toEqual(['A']);
    expect(afterEvidence.players.self.deck).toEqual(['R']);
    expect(afterEvidence.players.opp.evidence).toHaveLength(1);

    const fileState = state();
    fileState.players.self.deck = ['A'];
    fileState.players.self.remove = ['R'];
    const afterFile = produce(fileState, draft => {
      mutate.file.addFromDeckTop(draft, 'self', 1);
    });
    expect(afterFile.players.self.file.map(f => f.cardId)).toEqual(['A']);
    expect(afterFile.players.self.deck).toEqual(['R']);
    expect(afterFile.players.opp.evidence).toHaveLength(1);
  });

  it('charSetCard from deck top refreshes after setting the exact last card', () => {
    const s = state();
    const ctx = sceneCtx(s);
    const hostUid = s.players.self.scene[0]!.uid;
    s.players.self.deck = ['C1'];
    s.players.self.remove = ['R'];

    runAtom(s, 'charSetCard' as never, {
      uid: hostUid, fromDeckTop: true, faceUp: false, player: 'self',
    }, ctx);

    expect(s.players.self.scene[0]!.setCards.map(c => c.cardId)).toEqual(['C1']);
    expect(s.players.self.deck).toEqual(['R']);
    expect(s.players.self.remove).toEqual([]);
    expect(s.players.opp.evidence).toHaveLength(1);
  });

  it('charSetCard exact exhaustion completes the set before refresh emits remove:exit', () => {
    const s = state();
    const ctx = sceneCtx(s);
    const hostUid = s.players.self.scene[0]!.uid;
    s.players.self.deck = ['C1'];
    s.players.self.remove = ['R'];
    let setEnterState: { deck: string[]; remove: string[] } | undefined;
    let removeExitSetCards: string[] | undefined;
    event.on('setcard:enter', (observed) => {
      setEnterState = { deck: [...observed.players.self.deck], remove: [...observed.players.self.remove] };
    });
    event.on('remove:exit', (observed) => {
      removeExitSetCards = observed.players.self.scene[0]!.setCards.map((entry) => entry.cardId);
    });

    runAtom(s, 'charSetCard' as never, {
      uid: hostUid, fromDeckTop: true, faceUp: false, player: 'self',
    }, ctx);

    expect(setEnterState).toEqual({ deck: [], remove: ['R'] });
    expect(removeExitSetCards).toEqual(['C1']);
  });

  it('mill n=0 is not a take and does not refresh an empty deck', () => {
    const s = state();
    const ctx = sceneCtx(s);
    s.players.self.deck = [];
    s.players.self.remove = ['R'];

    runAtom(s, 'mill' as never, { player: 'self', n: 0 }, ctx);

    expect(s.players.self.deck).toEqual([]);
    expect(s.players.self.remove).toEqual(['R']);
    expect(s.players.opp.evidence).toHaveLength(0);
    expect(s.gameResult).toBeUndefined();
  });

  it('mill n>0 resolves a pre-empty deck before attempting the take', () => {
    const s = state();
    const ctx = sceneCtx(s);
    s.players.self.deck = [];
    s.players.self.remove = ['R1', 'R2'];

    runAtom(s, 'mill' as never, { player: 'self', n: 1 }, ctx);

    expect(s.players.self.remove).toEqual([]);
    expect(s.players.self.deck).toHaveLength(2);
    expect(s.players.opp.evidence).toHaveLength(1);
  });
});
