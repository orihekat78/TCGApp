import { beforeEach, describe, expect, it } from 'vitest';
import { B01082 } from '@/cards/ct-p01/B01082';
import { candidates, canGuard } from '@/engine/flow/guard';
import { candidates as actionCandidates } from '@/engine/flow/action/target-expander';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { runAutoPhase } from '@/engine/flow/auto-phase';
import { mutate } from '@/engine/mutate';
import { runCardScenario } from '../helpers/card-probe-harness';
import type { CardDef } from '@/engine/types';

const card = (id: string, keywords: string[] = []): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 4000, lp: 1,
  traits: [], keywords, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});
const ATTACKER = card('B01082_ATTACKER');
const OTHER = card('B01082_OTHER');
const BULLET = card('B01082_BULLET', ['ブレット']);
const PARTNER = { ...card('B01082_PARTNER'), kind: 'partner' as const, colors: ['黄'] };
const LOW7 = { ...card('B01082_LOW7'), level: 7 };
const HIGH8 = { ...card('B01082_HIGH8'), level: 8 };

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _clearPendingEffectPickQueue(); _resetRegistry();
  [B01082, ATTACKER, OTHER, BULLET, PARTNER, LOW7, HIGH8].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('B01082 bearer cannot guard', () => {
  it('maps the bearer-only continuous guard prohibition', () => {
    expect(B01082.abilities).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'continuous', scope: 'on-scene', continuousModifier: expect.objectContaining({ cannotGuard: true }) }),
    ]));
  });

  it('maps enter pick→sleep→source-bound auto-phase lock', () => {
    expect(B01082.abilities.find(a => a.id === 'a1')).toMatchObject({
      type: 'triggered', trigger: { hook: 'enter', selfOnly: true },
      effect: { kind: 'chain', steps: [
        { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', max: 1, side: 'either', state: 'sleep', filter: { kind: 'character', levelMax: 7 }, bind: '$pick' } },
        { kind: 'atom', verb: 'charSetTurnEffect', args: { uid: '$pick.uid', key: 'noAutoActivateBySourceUid', val: '$self' } },
      ] },
    });
  });

  it('production guard enumeration excludes only the B01082 bearer while other active guards remain', () => {
    const state = createEmptyGameState();
    state.players.opp.partner.cardId = 'B01082_PARTNER';
    state.players.self.scene = [sceneChar('B01082_ATTACKER', 'attacker')];
    state.players.opp.scene = [sceneChar('B01082', 'bearer'), sceneChar('B01082_OTHER', 'other')];
    expect(candidates(state, 'attacker').map(c => c.uid)).toEqual(['other']);
    expect(canGuard(state, 'attacker', 'bearer')).toBe(false);
    expect(canGuard(state, 'attacker', 'other')).toBe(true);
    state.players.opp.scene.forEach(c => { c.state = 'sleep'; });
    expect(actionCandidates(state, 'attacker').map(c => c.uid)).toEqual(['other']);
  });

  it('is owner-neutral: an opponent-owned B01082 cannot guard, while a Bullet attacker still independently forbids all guards', () => {
    const state = createEmptyGameState();
    state.players.self.partner.cardId = 'B01082_PARTNER';
    state.players.opp.scene = [sceneChar('B01082_ATTACKER', 'opp-attacker')];
    state.players.self.scene = [sceneChar('B01082', 'self-bearer'), sceneChar('B01082_OTHER', 'self-other')];
    expect(candidates(state, 'opp-attacker').map(c => c.uid)).toEqual(['self-other']);

    const bullet = createEmptyGameState();
    bullet.players.self.partner.cardId = 'B01082_PARTNER';
    bullet.players.self.scene = [sceneChar('B01082_BULLET', 'bullet-attacker')];
    bullet.players.opp.scene = [sceneChar('B01082_OTHER', 'guard')];
    expect(candidates(bullet, 'bullet-attacker')).toEqual([]);

    const zero = createEmptyGameState();
    zero.players.opp.partner.cardId = 'B01082_PARTNER';
    zero.players.self.scene = [sceneChar('B01082_ATTACKER', 'attacker')];
    zero.players.opp.scene = [sceneChar('B01082', 'only-bearer')];
    expect(candidates(zero, 'attacker')).toEqual([]);
  });

  it('production enter: picks a level-7 character, sleeps it, and locks only that target while source remains', () => {
    const state = runCardScenario(B01082, [LOW7, HIGH8], {
      name: 'B01082 enter low7 sleep lock',
      setup: { selfScene: [{ cardId: 'B01082', uid: 'source' }], oppScene: [{ cardId: 'B01082_LOW7', uid: 'low' }, { cardId: 'B01082_HIGH8', uid: 'high' }] },
      drive: { kind: 'enter', cardId: 'B01082', uid: 'source' }, script: [{ pickUid: 'low' }],
      expect: [{ kind: 'state', uid: 'low', state: 'sleep' }, { kind: 'candidatesExclude', pickIndex: 0, uid: 'high' }],
    });
    expect(state.players.opp.scene.find(c => c.uid === 'low')?.state).toBe('sleep');
    expect(state.players.opp.scene.find(c => c.uid === 'low')?.turnEffects['noAutoActivateBySourceUid']).toBe('source');
    state.players.opp.deck = ['d1', 'd2', 'd3'];
    runAutoPhase(state, 'opp');
    expect(state.players.opp.scene.find(c => c.uid === 'low')?.state).toBe('sleep');
    expect(state.players.opp.scene.find(c => c.uid === 'high')?.state).toBe('active');
  });

  it('production enter allows zero choice and unlocks when either selected target or source leaves', () => {
    const zero = runCardScenario(B01082, [], {
      name: 'B01082 enter zero choice', setup: { selfScene: [{ cardId: 'B01082', uid: 'source' }] },
      drive: { kind: 'enter', cardId: 'B01082', uid: 'source' }, script: ['pick:skip'],
      expect: [{ kind: 'state', uid: 'source', state: 'active' }],
    });
    expect(zero.players.self.scene[0]?.state).toBe('active');

    const state = runCardScenario(B01082, [LOW7], {
      name: 'B01082 source leave unlock', setup: { selfScene: [{ cardId: 'B01082', uid: 'source' }], oppScene: [{ cardId: 'B01082_LOW7', uid: 'low' }] },
      drive: { kind: 'enter', cardId: 'B01082', uid: 'source' }, script: [{ pickUid: 'low' }], expect: [],
    });
    mutate.scene.removeToRemove(state, 'source', { cause: 'effect' });
    state.players.opp.deck = ['d1', 'd2', 'd3'];
    runAutoPhase(state, 'opp');
    expect(state.players.opp.scene.find(c => c.uid === 'low')?.state).toBe('active');
  });

  it('production enter target leave leaves no stale auto-phase lock', () => {
    const state = runCardScenario(B01082, [LOW7], {
      name: 'B01082 target leave cleanup',
      setup: { selfScene: [{ cardId: 'B01082', uid: 'source' }], oppScene: [{ cardId: 'B01082_LOW7', uid: 'low' }] },
      drive: { kind: 'enter', cardId: 'B01082', uid: 'source' }, script: [{ pickUid: 'low' }], expect: [],
    });
    mutate.scene.removeToRemove(state, 'low', { cause: 'effect' });
    state.players.opp.deck = ['d1', 'd2', 'd3'];
    expect(() => runAutoPhase(state, 'opp')).not.toThrow();
    expect(state.players.opp.scene.some(c => c.uid === 'low')).toBe(false);
  });

  it('production enter is owner=opp symmetric', () => {
    const state = createEmptyGameState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    state.players.opp.scene = [sceneChar('B01082', 'opp-source')];
    state.players.self.scene = [sceneChar('B01082_LOW7', 'self-low')];
    event.emit(state, 'enter', { uid: 'opp-source', viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1, sourceCardId: undefined }, { player: 'opp', uid: 'opp-source', cardId: 'B01082' });
    runAllUntilEmpty(state);
    const pick = _drainPendingEffectPickSide();
    expect(pick?.ownerPlayer).toBe('opp');
    applyPickAndContinuation(state, pick!, 'self-low'); runAllUntilEmpty(state);
    expect(state.players.self.scene.find(c => c.uid === 'self-low')?.state).toBe('sleep');
    expect(state.players.self.scene.find(c => c.uid === 'self-low')?.turnEffects['noAutoActivateBySourceUid']).toBe('opp-source');
  });
});
