import { beforeEach, describe, expect, it } from 'vitest';
import { evalDyn } from '@/engine/dyn/eval';
import { evalCond } from '@/engine/cond/eval';
import { def, register, _resetRegistry } from '@/engine/read/def';
import { registerAll } from '@/cards';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';
import { runCardScenario } from '../helpers/card-probe-harness';
import { B09036 } from '@/cards/ct-p09/B09036';
import { B09036P } from '@/cards/ct-p09/B09036P';
import { char as readChar } from '@/engine/read/char';

const kid = (id: string, name: string) => ({
  id, no: id, kind: 'character' as const, names: [name], colors: ['白'], level: 8,
  ap: 7000, lp: 2, traits: ['怪盗'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});

describe('B09036 engine primitive — effective same-card-name count', () => {
  beforeEach(() => _resetRegistry());

  it('counts the source itself and uses its turn nameOverride, not printed name', () => {
    register(kid('KID', '怪盗キッド'));
    register(kid('TWIN', '江戸川コナン'));
    register(kid('DECOY', '怪盗キッド'));
    const state = createEmptyGameState();
    state.players.self.scene = [
      sceneChar('KID', 'source'),
      sceneChar('TWIN', 'same'),
      sceneChar('DECOY', 'old-name-decoy'),
    ];
    state.players.self.scene[0]!.turnEffects.nameOverride = '江戸川コナン';

    expect(evalDyn(state, '$self.sameNameCount', {
      source: { player: 'self', uid: 'source', cardId: 'KID' }, bindings: {},
    })).toBe(2);
    expect(evalCond(state, { kind: 'sameNameCountAtLeast', n: 2 } as never, {
      source: { player: 'self', uid: 'source', cardId: 'KID' }, bindings: {},
    })).toBe(true);
    expect(evalCond(state, { kind: 'sameNameCountAtLeast', n: 3 } as never, {
      source: { player: 'self', uid: 'source', cardId: 'KID' }, bindings: {},
    })).toBe(false);
  });
});

describe('B09036 怪盗キッド', () => {
  const twin = kid('TWIN', '怪盗キッド');
  const revealed = kid('REVEALED', '江戸川コナン');
  const target = { ...kid('TARGET', '標的'), ap: 8000 };
  const tooHigh = { ...kid('HIGH', '高AP'), ap: 8001 };

  it('has independent P text-equivalent definitions and maps both threshold clauses', () => {
    expect(B09036).toMatchObject({ id: 'B09036', no: '0979/B09036', names: ['怪盗キッド'], colors: ['白'], level: 8, ap: 7000, lp: 2, traits: ['怪盗'], rarity: 'SR' });
    expect(B09036P).toMatchObject({ id: 'B09036P', no: '0979/B09036P', rarity: 'SRP' });
    expect(B09036P).not.toBe(B09036);
    expect(B09036P.abilities).not.toBe(B09036.abilities);
    expect(B09036P.abilities).toEqual(B09036.abilities);
    const a2 = B09036.abilities[1]!;
    expect(a2).toMatchObject({
      type: 'declared', scope: 'on-scene', limit: { kind: 'turn', n: 1 },
      condition: { kind: 'fileAtLeast', n: 5 },
      effect: { kind: 'conditional', if: { kind: 'sameNameCountAtLeast', n: 5 } },
    });
  });

  it('registerAll exposes both printings exactly once', () => {
    registerAll();
    expect(def.card('B09036')?.id).toBe('B09036');
    expect(def.card('B09036P')?.id).toBe('B09036P');
  });

  it('production declared: two matching effective names move one AP8000-or-lower scene character to its owner deck bottom', () => {
    const state = runCardScenario(B09036, [twin, target, tooHigh], {
      name: 'B09036 threshold two removes eligible opponent character to bottom',
      setup: { fileCount: 5, selfScene: [{ cardId: 'B09036', uid: 'kid' }, { cardId: 'TWIN', uid: 'twin' }], oppScene: [{ cardId: 'TARGET', uid: 'target' }, { cardId: 'HIGH', uid: 'high' }] },
      drive: { kind: 'declared', uid: 'kid', abilityId: 'a2' }, script: [{ pickUid: 'target' }],
      expect: [{ kind: 'zone', cardId: 'TARGET', zone: 'deck', side: 'opp', present: true }, { kind: 'candidatesExclude', pickIndex: 0, uid: 'high' }],
    });
    expect(state.players.opp.deck.at(-1)).toBe('TARGET');
  });

  it('production enter: optional reveal writes the revealed effective card name to this source only', () => {
    const state = runCardScenario(B09036, [revealed], {
      name: 'B09036 enter reveal renames source',
      setup: { selfScene: [{ cardId: 'B09036', uid: 'kid' }], hand: ['REVEALED'] },
      drive: { kind: 'enter', cardId: 'B09036', uid: 'kid' }, script: ['optional:take', { pickCardId: 'REVEALED' }],
      expect: [{ kind: 'zone', cardId: 'REVEALED', zone: 'hand', side: 'self', present: true }],
    });
    expect(readChar.names(state, 'kid')).toEqual(['江戸川コナン']);
  });

  it('five-name threshold snapshots before selecting a same-name target, then still grants 突撃[事件]', () => {
    const state = runCardScenario(B09036, [twin], {
      name: 'B09036 five threshold stays true after own same-name target leaves',
      setup: { fileCount: 5, selfScene: [
        { cardId: 'B09036', uid: 'kid' }, { cardId: 'TWIN', uid: 't1' }, { cardId: 'TWIN', uid: 't2' },
        { cardId: 'TWIN', uid: 't3' }, { cardId: 'TWIN', uid: 't4' },
      ] },
      drive: { kind: 'declared', uid: 'kid', abilityId: 'a2' }, script: [{ pickUid: 't1' }],
      expect: [{ kind: 'zone', cardId: 'TWIN', zone: 'deck', side: 'self', present: true }],
    });
    expect(readChar.keywords(state, 'kid')).toContain('突撃[事件]');
  });
});
