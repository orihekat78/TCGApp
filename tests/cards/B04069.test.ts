import { beforeEach, describe, expect, it } from 'vitest';
import type { AbilityDef } from '@/engine/types';
import { B04069 } from '@/cards/ct-p04/B04069';
import { B04069P } from '@/cards/ct-p04/B04069P';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register, _resetRegistry } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve';
import { sceneChar } from '../helpers/fixtures';
import { runCardScenario } from '../helpers/card-probe-harness';
import { _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';

const police = (id: string, name = id, ap = 3000) => ({ id, no: id, kind: 'character' as const, names: [name], colors: ['青'], level: 7, ap, lp: 1, traits: ['警察'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });
const TAKAGI = police('TAKAGI', '高木渉');
const DECOY = police('DECOY', '佐藤美和子');
const removable = (id: string, level: number) => ({ ...police(id), level });
const LOW8 = removable('LOW8', 8);
const HIGH9 = removable('HIGH9', 9);

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetRegistry();
  [B04069, B04069P, TAKAGI, DECOY, police('POLICE_1'), police('POLICE_2'), police('POLICE_3'), LOW8, HIGH9].forEach(register);
  registerTriggeredListener();
});

describe('B04069 佐藤美和子', () => {
  const [conditionalLp, takagiAura, partnerEnter] = B04069.abilities as AbilityDef[];

  it('maps every printed clause to the existing descriptor DSL', () => {
    expect(B04069).toMatchObject({
      no: '0455/B04069', names: ['佐藤美和子'], colors: ['黄'],
      level: 8, ap: 7000, lp: 1, traits: ['警察', '警視庁'], rarity: 'SR',
    });
    expect(conditionalLp).toMatchObject({
      type: 'continuous', scope: 'on-scene',
      condition: { kind: 'sceneHas', query: { area: 'scene', side: 'self', filter: { trait: '警察' } }, nMin: 3 },
      continuousModifier: { lpDelta: 1 },
    });
    expect(takagiAura).toMatchObject({
      type: 'continuous', scope: 'on-scene',
      condition: { kind: 'and', cs: [{ kind: 'bond', cardName: '高木渉' }, { kind: 'turn', player: 'self' }] },
      continuousModifier: { apDeltaAura: 1000, auraFilter: { cardName: '高木渉', kind: 'character' } },
    });
    expect(partnerEnter).toMatchObject({
      type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
      condition: { kind: 'partnerColor', color: '黄' },
      effect: {
        kind: 'conditional',
        if: { kind: 'removeTraitAtLeast', player: 'self', trait: '警察', n: 3 },
        then: { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { levelMax: 8 } } },
      },
    });
  });

  it('keeps the parallel printing effect-identical without shared definition identity', () => {
    expect(B04069P.abilities).not.toBe(B04069.abilities);
    expect(B04069P.abilities).toEqual(B04069.abilities);
    expect(B04069P).toMatchObject({ id: 'B04069P', no: '0455/B04069P', rarity: 'SRP' });
  });

  it('production continuous dispatch: LP turns on at exactly three police, and the Takagi aura is owner-turn only', () => {
    const two = createEmptyGameState();
    two.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    two.players.self.scene = [sceneChar('B04069', 'host'), sceneChar('POLICE_1', 'p1')];
    expect(readChar.lp(two, 'host')).toBe(1);
    two.players.self.scene.push(sceneChar('POLICE_2', 'p2'));
    expect(readChar.lp(two, 'host')).toBe(2);

    two.players.self.scene.push(sceneChar('TAKAGI', 'takagi'), sceneChar('DECOY', 'decoy'));
    expect(readChar.ap(two, 'takagi')).toBe(4000);
    expect(readChar.ap(two, 'decoy')).toBe(3000);
    two.turn.player = 'opp';
    expect(readChar.ap(two, 'takagi')).toBe(3000);
  });

  it('production enter: yellow partner and three police in remove allow an either-side level-8 target', () => {
    const state = runCardScenario(B04069, [LOW8, HIGH9, police('POLICE_1'), police('POLICE_2'), police('POLICE_3')], {
      name: 'B04069 partner enter removes opponent level 8',
      setup: { partnerColors: B04069.colors, remove: ['POLICE_1', 'POLICE_2', 'POLICE_3'], selfScene: [{ cardId: 'B04069', uid: 'host' }], oppScene: [{ cardId: 'LOW8', uid: 'opp-low' }, { cardId: 'HIGH9', uid: 'opp-high' }] },
      drive: { kind: 'enter', cardId: 'B04069', uid: 'host' }, script: [{ pickUid: 'opp-low' }],
      expect: [{ kind: 'zone', cardId: 'LOW8', zone: 'remove', side: 'opp', present: true }, { kind: 'candidatesExclude', pickIndex: 0, uid: 'opp-high' }],
    });
    expect(state.players.opp.scene.some(c => c.uid === 'opp-high')).toBe(true);
  });

  it('production enter: fewer than three police, or no level-8-or-lower candidate, is a no-op', () => {
    runCardScenario(B04069, [HIGH9, police('POLICE_1'), police('POLICE_2')], {
      name: 'B04069 remove trait gate closed',
      setup: { partnerColors: B04069.colors, remove: ['POLICE_1', 'POLICE_2'], selfScene: [{ cardId: 'B04069', uid: 'host' }], oppScene: [{ cardId: 'HIGH9', uid: 'opp-high' }] },
      drive: { kind: 'enter', cardId: 'B04069', uid: 'host' }, expect: [{ kind: 'noPromptSurfaced' }, { kind: 'zone', cardId: 'HIGH9', zone: 'scene', side: 'opp', present: true }],
    });
    runCardScenario(B04069, [HIGH9, police('POLICE_1'), police('POLICE_2'), police('POLICE_3')], {
      name: 'B04069 zero-selection no-op',
      setup: { partnerColors: B04069.colors, remove: ['POLICE_1', 'POLICE_2', 'POLICE_3'], selfScene: [{ cardId: 'B04069', uid: 'host' }], oppScene: [{ cardId: 'HIGH9', uid: 'opp-high' }] },
      drive: { kind: 'enter', cardId: 'B04069', uid: 'host' }, script: ['pick:skip'], expect: [{ kind: 'zone', cardId: 'B04069', zone: 'scene', side: 'self', present: true }, { kind: 'zone', cardId: 'HIGH9', zone: 'scene', side: 'opp', present: true }],
    });
  });

  it('production enter resolves from an opponent-owned host against either side without borrowing self remove cards', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.opp.partner.cardId = 'B04069';
    state.players.opp.remove = ['POLICE_1', 'POLICE_2', 'POLICE_3'];
    state.players.opp.scene = [sceneChar('B04069', 'opp-host')];
    state.players.self.scene = [sceneChar('LOW8', 'self-low')];
    event.emit(state, 'enter', { uid: 'opp-host', viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1 }, { player: 'opp', uid: 'opp-host', cardId: 'B04069' });
    runAllUntilEmpty(state);
    const pick = _drainPendingEffectPickSide();
    expect(pick?.ownerPlayer).toBe('opp');
    expect(pick?.candidates.map(c => c.uid)).toContain('self-low');
    applyPickAndContinuation(state, pick!, 'self-low'); runAllUntilEmpty(state);
    expect(state.players.self.scene.some(c => c.uid === 'self-low')).toBe(false);
    expect(state.players.self.remove).toContain('LOW8');
  });
});
