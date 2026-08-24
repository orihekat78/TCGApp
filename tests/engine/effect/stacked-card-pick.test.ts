import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run } from '@/engine/effect/resolver';
import { runAtom } from '@/engine/effect/atom-handlers';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation, applyPickSkipAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { evalDyn } from '@/engine/dyn/eval';
import type { CardDef, Effect, EffectCtx, GameState } from '@/engine/types';

const CARD = (id: string, level: number): CardDef => ({ id, no: id, kind: 'character', names: [id], colors: ['青'], level, ap: 0, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });

function setup(): { state: GameState; ctx: EffectCtx; hostUid: string } {
  const state = createEmptyGameState();
  state.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  const source = mutate.scene.enter(state, 'self', 'SOURCE', {});
  const host = mutate.scene.enter(state, 'opp', 'HOST', {});
  host.stackedCards = [
    { cardId: 'STACK2', instanceId: 'stack:host:a' },
    { cardId: 'STACK5', instanceId: 'stack:host:b' },
  ];
  return { state, hostUid: host.uid, ctx: { source: { player: 'self', uid: source.uid, cardId: 'SOURCE' }, bindings: {}, dyn: {} } as EffectCtx };
}

function start(state: GameState, ctx: EffectCtx, hostUid: string, remainder: Effect = { kind: 'atom', verb: 'noop', args: {} }): void {
  const effect: Effect = { kind: 'sequence', steps: [
    { kind: 'atom', verb: 'stackedCardPick', args: { hostUid, player: 'opp', min: 0, max: 2, bind: '$stack', selectedInstanceIds: '$pick.uids' } },
    remainder,
  ] };
  run(state, effect, ctx);
}

beforeEach(() => {
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  [CARD('SOURCE', 1), CARD('HOST', 1), CARD('STACK2', 2), CARD('STACK5', 5)].forEach(registerCardDef);
});

describe('stackedCardPick', () => {
  it('surfaces exact identities with host owner and binds selected levels through the generic picker', () => {
    const { state, ctx, hostUid } = setup();
    start(state, ctx, hostUid);
    const pending = _drainPendingEffectPickSide();
    expect(pending).toMatchObject({ player: 'opp', ownerPlayer: 'self', nMin: 0, nMax: 2 });
    expect(pending?.candidates).toEqual([
      { uid: 'stack:host:a', cardId: 'STACK2', player: 'opp', hidden: false },
      { uid: 'stack:host:b', cardId: 'STACK5', player: 'opp', hidden: false },
    ]);
    applyPickAndContinuation(state, pending!, 'stack:host:a', ['stack:host:a', 'stack:host:b']);
    expect((ctx.bindings as Record<string, unknown>)['$stack']).toEqual([
      { kind: 'stacked', hostUid, cardId: 'STACK2', instanceId: 'stack:host:a' },
      { kind: 'stacked', hostUid, cardId: 'STACK5', instanceId: 'stack:host:b' },
    ]);
    expect(evalDyn(state, '$bound.$stack.levelSum', ctx)).toBe(7);
  });

  it('allows zero selection and continues without a stale binding', () => {
    const { state, ctx, hostUid } = setup();
    start(state, ctx, hostUid);
    const pending = _drainPendingEffectPickSide();
    applyPickSkipAndContinuation(state, pending!, false);
    expect((ctx.bindings as Record<string, unknown>)['$stack']).toBeUndefined();
    expect(evalDyn(state, '$bound.$stack.levelSum', ctx)).toBe(0);
  });

  it('uses the same identity contract when AI drains the picker', () => {
    const { state, ctx, hostUid } = setup();
    start(state, ctx, hostUid);
    drainAiEffectPicks(state);
    expect((ctx.bindings as Record<string, unknown>)['$stack']).toEqual([
      { kind: 'stacked', hostUid, cardId: 'STACK2', instanceId: 'stack:host:a' },
      { kind: 'stacked', hostUid, cardId: 'STACK5', instanceId: 'stack:host:b' },
    ]);
  });

  it('fails closed after the selected occurrence becomes stale', () => {
    const { state, ctx, hostUid } = setup();
    state.players.self.deck.push('STACK2');
    start(state, ctx, hostUid, { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
    const pending = _drainPendingEffectPickSide();
    const host = state.players.opp.scene.find(c => c.uid === hostUid)!;
    host.stackedCards = [];
    expect(() => applyPickAndContinuation(state, pending!, 'stack:host:a')).toThrow('stale');
    expect((ctx.bindings as Record<string, unknown>)['$stack']).toBeUndefined();
    expect(state.players.self.hand).toEqual([]);
  });

  it('rejects duplicate instance IDs before any continuation runs', () => {
    const { state, ctx, hostUid } = setup();
    start(state, ctx, hostUid);
    const pending = _drainPendingEffectPickSide();
    expect(() => applyPickAndContinuation(state, pending!, 'stack:host:a', ['stack:host:a', 'stack:host:a'])).toThrow('duplicate candidate uid');
    expect((ctx.bindings as Record<string, unknown>)['$stack']).toBeUndefined();
  });

  it('rejects below-minimum selections, including a skip', () => {
    const { state, ctx, hostUid } = setup();
    const effect: Effect = { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'stackedCardPick', args: { hostUid, player: 'opp', min: 2, max: 2, bind: '$stack', selectedInstanceIds: '$pick.uids' } },
      { kind: 'atom', verb: 'noop', args: {} },
    ] };
    run(state, effect, ctx);
    const pending = _drainPendingEffectPickSide();
    expect(() => applyPickAndContinuation(state, pending!, 'stack:host:a')).toThrow('below-minimum');
    expect(() => applyPickSkipAndContinuation(state, pending!, false)).toThrow('below-minimum');
  });

  it('keeps standalone cross-side resolution attributed to the ability owner', () => {
    const { state, ctx, hostUid } = setup();
    runAtom(state, 'stackedCardPick', { hostUid, player: 'opp', min: 1, max: 1, bind: '$stack', selectedInstanceIds: '$pick.uids' }, ctx);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.ownerPlayer).toBe('self');
    applyPickAndContinuation(state, pending!, 'stack:host:a');
    expect(state.log.at(-1)?.player).toBe('self');
  });

  it('resolves $self from the standalone pending source UID', () => {
    const { state, ctx } = setup();
    const source = state.players.self.scene.find(c => c.uid === ctx.source.uid)!;
    source.stackedCards = [{ cardId: 'STACK2', instanceId: 'stack:source:a' }];
    runAtom(state, 'stackedCardPick', { hostUid: '$self', player: 'self', min: 1, max: 1, bind: '$stack', selectedInstanceIds: '$pick.uids' }, ctx);
    const pending = _drainPendingEffectPickSide();
    applyPickAndContinuation(state, pending!, 'stack:source:a');
    expect(state.log.at(-1)).toMatchObject({ player: 'self', action: 'effect:stackedCardPick', target: 'stack:source:a' });
  });

  it('resolves a bound host UID again before continuation', () => {
    const { state, ctx, hostUid } = setup();
    (ctx.bindings as Record<string, unknown>)['$host'] = [{ uid: hostUid }];
    const effect: Effect = { kind: 'sequence', steps: [
      { kind: 'atom', verb: 'stackedCardPick', args: { hostUid: '$host.uid', player: 'opp', min: 1, max: 1, bind: '$stack', selectedInstanceIds: '$pick.uids' } },
      { kind: 'atom', verb: 'noop', args: {} },
    ] };
    run(state, effect, ctx);
    const pending = _drainPendingEffectPickSide();
    applyPickAndContinuation(state, pending!, 'stack:host:b');
    expect((ctx.bindings as Record<string, unknown>)['$stack']).toEqual([
      { kind: 'stacked', hostUid, cardId: 'STACK5', instanceId: 'stack:host:b' },
    ]);
  });
});
