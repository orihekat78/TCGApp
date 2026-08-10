import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B08063 } from '@/cards/ct-p08/B08063';
import { B08063P } from '@/cards/ct-p08/B08063P';
import { registerAll } from '@/cards/index';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { char as charRead } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _drainPendingEffectOptionalSide, _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyOptionalAndContinuation, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { mutate } from '@/engine/mutate';
import { register } from '@/engine/read/def';
import type { CardDef } from '@/engine/types';

const nagano = (id: string, name = id, ap = 7000): CardDef => ({ id, no: id, kind: 'character', names: [name], colors: ['青'], level: 6, ap, lp: 1, traits: ['長野県警'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
const OTHER: CardDef = { ...nagano('OTHER'), traits: [] };

beforeEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  event._resetRegistry(); _resetTriggeredRegistered(); _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerAll();
  [nagano('N1'), nagano('N2'), nagano('N3'), nagano('HIT'), OTHER, nagano('AP8000', 'AP8000', 8000), nagano('AP8001', 'AP8001', 8001)].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('B08063 黒田兵衛', () => {
  it('grants 長野県警 only while it is on the scene', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [sceneChar('B08063', 'kuroda')];

    expect(charRead.traits(state, 'kuroda')).toContain('長野県警');
  });

  it('uses the resolution-time distinct 長野県警 count, mandatory draw/discard, and a bound mill gate', () => {
    const [a1, a2, a3] = B08063.abilities;
    expect(a1).toMatchObject({
      type: 'continuous', scope: 'on-scene', continuousModifier: { grantTraits: ['長野県警'] },
    });
    expect(a2).toMatchObject({
      type: 'triggered', scope: 'on-scene', trigger: { hook: 'phase:end:start' },
      condition: { kind: 'turn', player: 'self' },
      effect: {
        kind: 'conditional',
        if: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '長野県警' }, distinctNames: true }, nMin: 3 },
        then: { kind: 'chain', steps: [
          { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
          { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } },
        ] },
      },
    });
    expect(a3).toMatchObject({
      type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
      condition: { kind: 'partnerColor', color: '黄' },
      effect: { kind: 'optional', effect: { kind: 'chain', steps: [
        { kind: 'atom', verb: 'mill', args: { player: 'self', n: 3, gate: true, bind: '$milled' } },
        { kind: 'conditional', if: { kind: 'boundAnyMatchesFilter', bindKey: '$milled', filter: { trait: '長野県警', kind: 'character' } }, then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { apMax: 8000 } } } },
      ] } },
    });
  });

  it('has an independent but structurally identical ability spread', () => {
    expect(B08063P).not.toBe(B08063);
    expect(B08063P.abilities).not.toBe(B08063.abilities);
    expect(B08063P.abilities).toEqual(B08063.abilities);
    expect(B08063P.id).toBe('B08063P');
    expect(B08063P.imageUrl).not.toBe(B08063.imageUrl);
  });

  it('production end-turn dispatch requires three distinct Nagano names, then draws and forces a discard', () => {
    const s = createEmptyGameState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    s.turn = { number: 2, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B08063', 'host'), sceneChar('N1', 'n1')];
    // draw1後も非terminalにし、本テストのdistinct-name→discard契約だけを観測する。
    s.players.self.hand = ['OTHER']; s.players.self.deck = ['N3', 'OTHER'];
    event.emit(s, 'phase:end:start', { player: 'self' }, undefined); runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide()).toBeNull();

    s.players.self.scene.push(sceneChar('N3', 'n3'));
    event.emit(s, 'phase:end:start', { player: 'self' }, undefined); runAllUntilEmpty(s);
    const discard = _drainPendingEffectPickSide();
    expect(discard?.atomVerb).toBe('discard');
    expect(s.players.self.hand).toContain('N3');
    applyPickAndContinuation(s, discard!, discard!.candidates.find(c => c.cardId === 'OTHER')!.uid); runAllUntilEmpty(s);
    expect(s.players.self.remove).toContain('OTHER');
  });

  it('a2 evaluates the distinct Nagano count when the queued effect resolves', () => {
    const s = createEmptyGameState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    s.turn = { number: 2, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B08063', 'host'), sceneChar('N1', 'n1')];
    s.players.self.hand = ['OTHER'];
    s.players.self.deck = ['N3', 'OTHER'];

    event.emit(s, 'phase:end:start', { player: 'self' }, undefined);
    s.players.self.scene.push(sceneChar('N3', 'n3'));
    runAllUntilEmpty(s);

    const discard = _drainPendingEffectPickSide();
    expect(discard?.atomVerb).toBe('discard');
    expect(s.players.self.hand).toContain('N3');
    applyPickAndContinuation(s, discard!, discard!.candidates.find(c => c.cardId === 'OTHER')!.uid);
    runAllUntilEmpty(s);
    expect(s.players.self.remove).toContain('OTHER');
  });

  it('a2 still resolves after its B08063 source leaves the scene', () => {
    const s = createEmptyGameState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    s.turn = { number: 2, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      sceneChar('B08063', 'host'),
      sceneChar('N1', 'n1'),
      sceneChar('N2', 'n2'),
      sceneChar('N3', 'n3'),
    ];
    s.players.self.hand = ['OTHER'];
    s.players.self.deck = ['HIT', 'OTHER'];

    event.emit(s, 'phase:end:start', { player: 'self' }, undefined);
    mutate.scene.removeToRemove(s, 'host', 'effect');
    runAllUntilEmpty(s);

    const discard = _drainPendingEffectPickSide();
    expect(s.players.self.remove).toContain('B08063');
    expect(discard?.atomVerb, 'the fired effect survives its source leaving').toBe('discard');
    expect(s.players.self.hand).toContain('HIT');
  });

  it('a1 does not grant Nagano to a B08063 occurrence milled from the deck', () => {
    const s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner.cardId = 'B08063';
    s.players.self.scene = [sceneChar('B08063', 'host'), sceneChar('AP8000', 'target')];
    s.players.self.deck = ['B08063', 'OTHER', 'OTHER', 'OTHER'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';

    event.emit(s, 'enter', { uid: 'host', viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', uid: 'host', cardId: 'B08063' });
    runAllUntilEmpty(s);
    applyOptionalAndContinuation(s, _drainPendingEffectOptionalSide()!, true);

    expect(s.players.self.remove).toContain('B08063');
    expect(_drainPendingEffectPickSide(), 'off-scene B08063 keeps only its printed traits').toBeNull();
    expect(s.players.self.scene.some(c => c.uid === 'target')).toBe(true);
  });

  it('a3 production dispatch honors optional choice, mill trait gate, AP boundary, and opp ownership', () => {
    const s = createEmptyGameState();
    s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.opp.partner.cardId = 'B08063';
    s.players.opp.scene = [sceneChar('B08063', 'opp-host')];
    s.players.self.scene = [sceneChar('AP8000', 'ap8000'), sceneChar('AP8001', 'ap8001')];
    s.players.opp.deck = ['HIT', 'OTHER', 'OTHER'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';

    event.emit(s, 'enter', { uid: 'opp-host', viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'opp', uid: 'opp-host', cardId: 'B08063' });
    runAllUntilEmpty(s);
    const optional = _drainPendingEffectOptionalSide();
    expect(optional?.player).toBe('opp');
    applyOptionalAndContinuation(s, optional!, true);
    const pick = _drainPendingEffectPickSide();
    expect(pick?.candidates.map(c => c.uid)).toContain('ap8000');
    expect(pick?.candidates.map(c => c.uid)).not.toContain('ap8001');
    applyPickAndContinuation(s, pick!, 'ap8000');
    expect(s.players.self.remove).toContain('AP8000');
    expect(s.players.self.scene.some(c => c.uid === 'ap8001')).toBe(true);

    const declined = createEmptyGameState();
    declined.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    declined.players.self.partner.cardId = 'B08063';
    declined.players.self.scene = [sceneChar('B08063', 'self-host'), sceneChar('AP8000', 'target')];
    declined.players.self.deck = ['HIT', 'OTHER', 'OTHER'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    event.emit(declined, 'enter', { uid: 'self-host', viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', uid: 'self-host', cardId: 'B08063' });
    runAllUntilEmpty(declined);
    applyOptionalAndContinuation(declined, _drainPendingEffectOptionalSide()!, false);
    expect(declined.players.self.scene.some(c => c.uid === 'target')).toBe(true);

    const decoy = createEmptyGameState();
    decoy.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    decoy.players.self.partner.cardId = 'B08063';
    decoy.players.self.scene = [sceneChar('B08063', 'decoy-host'), sceneChar('AP8000', 'decoy-target')];
    decoy.players.self.deck = ['OTHER', 'OTHER', 'OTHER'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    event.emit(decoy, 'enter', { uid: 'decoy-host', viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', uid: 'decoy-host', cardId: 'B08063' });
    runAllUntilEmpty(decoy);
    applyOptionalAndContinuation(decoy, _drainPendingEffectOptionalSide()!, true);
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(decoy.players.self.scene.some(c => c.uid === 'decoy-target')).toBe(true);

    const refreshed = createEmptyGameState();
    refreshed.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    refreshed.players.self.partner.cardId = 'B08063';
    refreshed.players.self.scene = [sceneChar('B08063', 'refresh-host'), sceneChar('AP8000', 'refresh-target')];
    refreshed.players.self.deck = ['OTHER'];
    refreshed.players.self.remove = ['HIT', 'OTHER'];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    event.emit(refreshed, 'enter', { uid: 'refresh-host', viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'self', uid: 'refresh-host', cardId: 'B08063' });
    runAllUntilEmpty(refreshed);
    applyOptionalAndContinuation(refreshed, _drainPendingEffectOptionalSide()!, true);
    expect(refreshed.log).toEqual(expect.arrayContaining([expect.objectContaining({ action: 'effect:mill', result: 'gate-skip' })]));
    expect(refreshed.log.some(x => x.action === 'refresh')).toBe(false);
    expect(_drainPendingEffectPickSide()).toBeNull();
    expect(refreshed.players.self.scene.some(c => c.uid === 'refresh-target')).toBe(true);
  });
});
