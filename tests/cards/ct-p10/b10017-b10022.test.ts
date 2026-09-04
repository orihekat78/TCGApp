import { beforeEach, describe, expect, it } from 'vitest';
import { B10017, B10017P } from '@/cards/ct-p10/B10017';
import { B10022, B10022P } from '@/cards/ct-p10/B10022';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canActivateDeclaredAbility, findDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { canPayAtomically } from '@/engine/cost/pay';
import { eligibleRemoveSetCards } from '@/engine/cost/remove-set-card-eligible';
import { _resetRegistry, register } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef } from '@/engine/types';

const BELT: CardDef = { id: 'BELT', no: 'T/BELT', kind: 'event', names: ['どこでもボール射出ベルト'], colors: [], level: 0, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const HATTORI: CardDef = { id: 'HATTORI', no: 'T/HATTORI', kind: 'character', names: ['服部平次'], colors: ['緑'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const POLICE: CardDef = { id: 'POLICE', no: 'T/POLICE', kind: 'character', names: ['警察'], colors: ['緑'], level: 1, ap: 1000, lp: 1, traits: ['警察'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const OTHER: CardDef = { id: 'OTHER', no: 'T/OTHER', kind: 'character', names: ['OTHER'], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

beforeEach(() => {
  _resetRegistry();
  [B10017, B10017P, B10022, B10022P, BELT, HATTORI, POLICE, OTHER].forEach(register);
});

describe('B10017 キック力増強シューズ', () => {
  it('has printed metadata and exact set-host ball-belt payment', () => {
    expect(B10017).toMatchObject({ id: 'B10017', no: '1079/B10017', names: ['キック力増強シューズ'], colors: ['青'], level: 6, rarity: 'C', imageUrl: '1783904094995853.jpg' });
    const cost = B10017.abilities[1]!.cost as { kind: string; n: number; face: string; hostSelf: boolean; filter: { cardName: string } };
    expect(cost).toMatchObject({ kind: 'removeSetCard', n: 1, face: 'up', hostSelf: true, filter: { cardName: 'どこでもボール射出ベルト' } });
    expect((B10017.abilities[1]!.effect as { verb: string }).verb).toBe('sceneRemove');
  });
  it('P is an exact ability clone with its own printing metadata', () => {
    expect(B10017P.abilities).toEqual(B10017.abilities);
    expect(B10017P).toMatchObject({ id: 'B10017P', no: '1079/B10017P', rarity: 'CP', imageUrl: '1783904095002056.jpg' });
  });

  it('activates through the set host only with an exact face-up belt witness', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar('HATTORI', 'host', { setCards: [
      { cardId: 'B10017', faceUp: true, instanceId: 'set:rider' },
      { cardId: 'BELT', faceUp: true, instanceId: 'set:belt' },
    ] })];
    const exact = { removeSetCard: { hostUids: ['host'], instanceIds: ['set:belt'] } };
    const sourceRef = { setCardId: 'B10017', setCardInstanceId: 'set:rider' };

    const ability = findDeclaredAbility(state, 'host', 'HATTORI', 'scene', 'a2');
    expect(ability).toBeDefined();
    expect(BELT.names).toContain((ability!.cost as { filter: { cardName: string } }).filter.cardName);
    const paymentCtx = {
      source: { cardId: 'HATTORI', uid: 'host', abilityId: 'a2', player: 'self', area: 'scene' },
      bindings: {}, dyn: { costParams: exact },
    } as const;
    expect(eligibleRemoveSetCards(state, ability!.cost as never, paymentCtx)).toEqual(expect.arrayContaining([
      expect.objectContaining({ entry: expect.objectContaining({ instanceId: 'set:belt' }) }),
    ]));
    expect(canPayAtomically(state, ability!.cost!, paymentCtx)).toBe(true);
    expect(canActivateDeclaredAbility(state, 'host', 'a2', exact, { sourceRef })).toBe(true);
    activateDeclaredAbility(state, 'host', 'a2', exact, sourceRef);

    expect(state.players.self.remove).toEqual(['BELT']);
    expect(state.players.self.scene[0]!.setCards.map((entry) => entry.instanceId)).toEqual(['set:rider']);
    expect(state.players.self.scene[0]!.setCards[0]!.abilityUseCounts?.a2).toEqual({ turn: 2, count: 1 });
    expect(state.players.self.scene[0]!.declaredUseCount.a2).toBeUndefined();
  });
});
describe('B10022 遠山和葉', () => {
  it('has both declared abilities and filtered two-card face-down cost', () => {
    expect(B10022).toMatchObject({ id: 'B10022', no: '1083/B10022', names: ['遠山和葉'], colors: ['緑'], level: 8, ap: 7000, lp: 1, traits: ['高校生'], rarity: 'SR' });
    expect(B10022.abilities[0]!.cost).toMatchObject({ kind: 'sleepSelf' });
    const cost = B10022.abilities[1]!.cost as { kind: string; n: number; face: string; hostQuery: { filterAny: unknown[] } };
    expect(cost).toMatchObject({ kind: 'removeSetCard', n: 2, face: 'down' });
    expect(cost.hostQuery.filterAny).toEqual([{ cardName: '服部平次' }, { color: '緑', trait: '警察' }]);
    expect(B10022.abilities[1]!.limit).toEqual({ kind: 'turn', n: 1 });
  });
  it('P is an exact ability clone with its own printing metadata', () => {
    expect(B10022P.abilities).toEqual(B10022.abilities);
    expect(B10022P).toMatchObject({ id: 'B10022P', no: '1083/B10022P', rarity: 'SRP', imageUrl: '1783904095077137.jpg' });
  });

  it('activates with exact face-down witnesses from both hostQuery branches only', () => {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [
      sceneChar('B10022', 'kazuha'),
      sceneChar('HATTORI', 'hattori', { setCards: [{ cardId: 'HATTORI-SET', faceUp: false, instanceId: 'set:hattori' }] }),
      sceneChar('POLICE', 'police', { setCards: [{ cardId: 'POLICE-SET', faceUp: false, instanceId: 'set:police' }] }),
      sceneChar('OTHER', 'other', { setCards: [{ cardId: 'OTHER-SET', faceUp: false, instanceId: 'set:other' }] }),
    ];
    const exact = { removeSetCard: { hostUids: ['hattori', 'police'], instanceIds: ['set:hattori', 'set:police'] } };

    expect(canActivateDeclaredAbility(state, 'kazuha', 'a2', exact)).toBe(true);
    activateDeclaredAbility(state, 'kazuha', 'a2', exact);

    expect(state.players.self.remove).toEqual(['HATTORI-SET', 'POLICE-SET']);
    expect(state.players.self.scene.find((char) => char.uid === 'other')!.setCards).toHaveLength(1);
    expect(readChar.declaredUseCount(state, 'kazuha', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 1,
    })).toBe(1);
    expect(state.players.self.scene.find((char) => char.uid === 'kazuha')!.declaredUseCount.a2).toBeUndefined();
  });
});
