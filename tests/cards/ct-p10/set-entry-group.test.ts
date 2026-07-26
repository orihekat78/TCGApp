import { beforeEach, describe, expect, it } from 'vitest';
import { B10012, B10012P } from '@/cards/ct-p10/B10012';
import { B10013, B10013P } from '@/cards/ct-p10/B10013';
import { B10021, B10021P } from '@/cards/ct-p10/B10021';
import { applyPickAndContinuation, applyPickSkipAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canActivateDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

const BLUE_PARTNER: CardDef = {
  id: 'SET_ENTRY_BLUE_PARTNER', no: 'SET_ENTRY_BLUE_PARTNER', kind: 'partner', names: ['Blue partner'], colors: ['青'], level: 0, ap: 0, lp: 3,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const GREEN_PARTNER: CardDef = { ...BLUE_PARTNER, id: 'SET_ENTRY_GREEN_PARTNER', no: 'SET_ENTRY_GREEN_PARTNER', colors: ['緑'] };
const POLICE: CardDef = {
  id: 'SET_ENTRY_POLICE', no: 'SET_ENTRY_POLICE', kind: 'character', names: ['Police'], colors: ['緑'], level: 1, ap: 1000, lp: 1,
  traits: ['警察'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const LEVEL9: CardDef = { ...POLICE, id: 'SET_ENTRY_LEVEL9', no: 'SET_ENTRY_LEVEL9', traits: [], level: 9 };
const SET_CARD: CardDef = { ...POLICE, id: 'SET_ENTRY_CARD', no: 'SET_ENTRY_CARD' };

const globals = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };

function settleAi(state: GameState): void {
  for (let i = 0; i < 4; i += 1) {
    runAllUntilEmpty(state);
    const queued = (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue ?? [];
    if (queued.length === 0) return;
    drainAiEffectPicks(state, new HeuristicPolicy());
  }
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectPickQueue();
  _resetRegistry();
  _resetUidCounter();
  [B10012, B10012P, B10013, B10013P, B10021, B10021P, BLUE_PARTNER, GREEN_PARTNER, POLICE, LEVEL9, SET_CARD].forEach(register);
  registerTriggeredListener();
  globals.__humanPlayerSide = null;
});

describe('CT-P10 set-entry group', () => {
  it.each([
    [B10012, B10012P, 'B10012P', '1074/B10012P', 'CP'],
    [B10013, B10013P, 'B10013P', '1075/B10013P', 'CP'],
    [B10021, B10021P, 'B10021P', '1082/B10021P', 'MRP'],
  ] as const)('%s has a printing-equivalent P card', (base, printing, id, no, rarity) => {
    const { imageUrl: _baseImage, ...baseWithoutImage } = base;
    expect(printing).toMatchObject({ ...baseWithoutImage, id, no, rarity });
    expect(printing.abilities).toBe(base.abilities);
  });

  it('B10021 keeps both printed split names', () => {
    expect(B10021.names).toEqual(['服部平蔵＆遠山銀司郎', '服部平蔵', '遠山銀司郎']);
  });

  it.each([B10012, B10012P, B10013, B10013P])('%s sets the last deck card face-down before its refresh', (printing) => {
    const state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner = { cardId: BLUE_PARTNER.id, state: 'active', location: 'partner-area' };
    state.players.self.deck = [SET_CARD.id];
    state.players.self.remove = ['REFRESH_CARD'];

    const source = mutate.scene.enter(state, 'self', printing.id, {});
    event.emit(state, 'enter', {
      uid: source.uid, viaEffect: false, enterOrder: source.enterOrder, enterOrderThisTurn: source.enterOrderThisTurn,
    }, { player: 'self', uid: source.uid, cardId: printing.id });
    settleAi(state);

    expect(state.players.self.scene.find((char) => char.uid === source.uid)?.setCards).toMatchObject([
      { cardId: SET_CARD.id, faceUp: false },
    ]);
    expect(state.players.self.deck).toEqual(['REFRESH_CARD']);
    expect(state.players.self.remove).toEqual([]);
    expect(state.refreshCount.self).toBe(1);
  });

  it.each([B10021, B10021P])('%s continues to police deck-top set after declining optional removal', (printing) => {
    const state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partner = { cardId: GREEN_PARTNER.id, state: 'active', location: 'partner-area' };
    state.players.self.scene = [sceneChar(printing.id, 'source'), sceneChar(POLICE.id, 'police')];
    state.players.opp.scene = [sceneChar(LEVEL9.id, 'victim')];
    state.players.self.deck = [SET_CARD.id];
    state.players.self.remove = ['REFRESH_CARD'];
    globals.__humanPlayerSide = 'self';

    expect(canActivateDeclaredAbility(state, 'source', 'a1')).toBe(true);
    activateDeclaredAbility(state, 'source', 'a1');
    runAllUntilEmpty(state);
    const removePick = _drainPendingEffectPickSide();
    expect(removePick).toMatchObject({ atomVerb: 'sceneRemove', nMin: 0, nMax: 1 });
    applyPickSkipAndContinuation(state, removePick!, false);
    runAllUntilEmpty(state);

    const setPick = _drainPendingEffectPickSide();
    expect(setPick).toMatchObject({ atomVerb: 'charSetCard', nMin: 0, nMax: 1 });
    applyPickAndContinuation(state, setPick!, 'police');
    runAllUntilEmpty(state);

    expect(state.players.opp.scene.map((char) => char.uid)).toEqual(['victim']);
    expect(state.players.self.scene.find((char) => char.uid === 'police')?.setCards).toMatchObject([
      { cardId: SET_CARD.id, faceUp: false },
    ]);
    expect(state.players.self.deck).toEqual(['REFRESH_CARD']);
    expect(state.players.self.remove).toEqual([]);
  });

  it.each([B10021, B10021P])('%s PA ability pays one exact hidden set then draws and discards', (printing) => {
    const state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.partnerAreaMR = sceneChar(printing.id, 'partnerMR:self');
    state.players.self.scene = [sceneChar(POLICE.id, 'host', {
      setCards: [{ cardId: SET_CARD.id, faceUp: false, instanceId: 'set:one' }],
    })];
    state.players.self.deck = ['DRAW_CARD'];

    const payment = { removeSetCard: { hostUids: ['host'], instanceIds: ['set:one'] } };
    expect(canActivateDeclaredAbility(state, 'partnerMR:self', 'a2', payment)).toBe(true);
    activateDeclaredAbility(state, 'partnerMR:self', 'a2', payment);
    settleAi(state);

    expect(state.players.self.scene[0]?.setCards).toEqual([]);
    expect(state.players.self.hand).toEqual([]);
    expect(state.players.self.deck).toEqual([SET_CARD.id]);
    expect(state.players.self.remove).toEqual(['DRAW_CARD']);
  });
});
