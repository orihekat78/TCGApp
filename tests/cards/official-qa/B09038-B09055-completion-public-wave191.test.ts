// qa: card:B09038:56b2d90b685607e904d39158be2555fcc2be59c6192e97014396a02ba908324f
// qa: card:B09040:ccfd4718c55f312b6e3d9e68cd0a79c23b25c6bd34ba3514db3c020bcbe6359d
// qa: card:B09041:e4a8be25d1df1ed6eaebc5d52ef4db8ecddf8a180b3691cd421120c85c1d7551
// qa: card:B09047:25e17b48d633cf3b18cc3eaca3275c611a8fc1365206c61a492e5d1a8d697620
// qa: card:B09048:7124f41d3267d0e2df2692070acfdd9e66fca11edbbbfb6b64ada8bee4c94b79
// qa: card:B09048:801430e41b8bba0a80712bc0ae76bb5c7ac726aea9c6bcc905c41ff1f9d37670
// qa: card:B09050:c056998b7e5216cbe86e8aba420c46e2769a7f4aac3ca8ea0ea48c91c8a5c466
// qa: card:B09055:5cd641b5128932814c29c2d1177af359548f137dd66f80fb726079fba400a222

import { describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09038 } from '@/cards/ct-p09/B09038';
import { B09040 } from '@/cards/ct-p09/B09040';
import { B09041 } from '@/cards/ct-p09/B09041';
import { B09047 } from '@/cards/ct-p09/B09047';
import { B09048 } from '@/cards/ct-p09/B09048';
import { B09050 } from '@/cards/ct-p09/B09050';
import { B09055 } from '@/cards/ct-p09/B09055';
import { event } from '@/engine/event';
import { applyChoiceAndContinuation, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectChoiceSide, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef } from '@/engine/types';
import { runCardScenario } from '../../helpers/card-probe-harness';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['白'],
    level: 3, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const HAND_EFFECTIVE_LEVEL_FOUR: CardDef = {
  id: 'W191_HAND_LEVEL_4', no: 'test/W191_HAND_LEVEL_4', kind: 'character',
  names: ['鈴木財閥の探偵'], colors: ['白'], level: 6, ap: 1000, lp: 1,
  traits: ['鈴木財閥', '探偵'], keywords: [], rarity: 'T', imageUrl: '',
  abilities: [{
    id: 'hand-level', type: 'continuous', scope: 'on-hand',
    continuousModifier: { lvlOverrideInHand: 4 },
  }],
  ruleRefs: [],
};

const SCENE_EFFECTIVE_LEVEL_FIVE: CardDef = {
  id: 'W191_SCENE_LEVEL_5', no: 'test/W191_SCENE_LEVEL_5', kind: 'character',
  names: ['実効レベル5'], colors: ['白'], level: 3, ap: 1000, lp: 1,
  traits: ['探偵'], keywords: [], rarity: 'T', imageUrl: '',
  abilities: [{
    id: 'scene-level', type: 'continuous', scope: 'on-scene',
    continuousModifier: { lvlDelta: 2 },
  }],
  ruleRefs: [],
};

const SCENE_EFFECTIVE_LEVEL_FOUR: CardDef = {
  id: 'W191_SCENE_LEVEL_4', no: 'test/W191_SCENE_LEVEL_4', kind: 'character',
  names: ['実効レベル4'], colors: ['白'], level: 4, ap: 1000, lp: 1,
  traits: ['探偵'], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [],
};

const W191_YUSAKU = fixture('W191_YUSAKU', { names: ['工藤優作'], level: 6 });
const W191_SET_CARD = fixture('W191_SET_CARD');
const W191_GUARD = fixture('W191_GUARD', { level: 6 });
const W191_BLUE_ENTRY = fixture('W191_BLUE_ENTRY', { colors: ['青'], level: 4 });
const W191_POLICE = fixture('W191_POLICE', { colors: ['黄'], level: 6, traits: ['警察'] });
const W191_AKAI_SERA = fixture('W191_AKAI_SERA', {
  names: ['赤井秀一&世良真純', '赤井秀一', '世良真純'], colors: ['赤'],
});
const W191_HAND_DECOY = fixture('W191_HAND_DECOY', { level: 1 });
const W191_FILLERS = Array.from({ length: 4 }, (_, index) => fixture(`W191_FILLER_${index}`));

function resetManualRuntime(): void {
  resetPendingRuntimeState();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  registerAll();
  [
    HAND_EFFECTIVE_LEVEL_FOUR, SCENE_EFFECTIVE_LEVEL_FIVE, SCENE_EFFECTIVE_LEVEL_FOUR,
    W191_GUARD, W191_BLUE_ENTRY, W191_HAND_DECOY, ...W191_FILLERS,
  ].forEach(register);
  registerTriggeredListener();
}

describe('official QA Wave191: card-bound runtime paths', () => {
  it('B09040 resolves both the discarded hand card and scene targets at effective level', () => {
    const state = runCardScenario(B09040, [HAND_EFFECTIVE_LEVEL_FOUR, SCENE_EFFECTIVE_LEVEL_FIVE, SCENE_EFFECTIVE_LEVEL_FOUR], {
      name: 'B09040 effective-level removal',
      setup: {
        selfScene: [{ cardId: B09040.id, uid: 'source' }],
        oppScene: [
          { cardId: SCENE_EFFECTIVE_LEVEL_FIVE.id, uid: 'effective-five' },
          { cardId: SCENE_EFFECTIVE_LEVEL_FOUR.id, uid: 'effective-four' },
        ],
        hand: [HAND_EFFECTIVE_LEVEL_FOUR.id],
      },
      drive: { kind: 'enter', cardId: B09040.id, uid: 'source' },
      script: ['optional:take', { pickCardId: HAND_EFFECTIVE_LEVEL_FOUR.id }, { pickUid: 'effective-four' }],
      expect: [
        { kind: 'zone', cardId: HAND_EFFECTIVE_LEVEL_FOUR.id, zone: 'remove', side: 'self', present: true },
        { kind: 'zone', cardId: SCENE_EFFECTIVE_LEVEL_FOUR.id, zone: 'remove', side: 'opp', present: true },
        { kind: 'candidatesExclude', pickIndex: 1, uid: 'effective-five' },
      ],
    });
    expect(state.players.opp.scene.some(card => card.uid === 'effective-five'), B09040.id).toBe(true);
    expect(state.players.opp.remove).toContain(SCENE_EFFECTIVE_LEVEL_FOUR.id);
  });

  it('B09050 snapshots the removed hand card effective level before paying its cost', () => {
    const state = runCardScenario(B09050, [HAND_EFFECTIVE_LEVEL_FOUR, SCENE_EFFECTIVE_LEVEL_FIVE, SCENE_EFFECTIVE_LEVEL_FOUR], {
      name: 'B09050 effective-level stun',
      setup: {
        selfScene: [{ cardId: B09050.id, uid: 'source' }],
        oppScene: [
          { cardId: SCENE_EFFECTIVE_LEVEL_FIVE.id, uid: 'effective-five' },
          { cardId: SCENE_EFFECTIVE_LEVEL_FOUR.id, uid: 'effective-four' },
        ],
        hand: [HAND_EFFECTIVE_LEVEL_FOUR.id],
      },
      drive: { kind: 'declared', uid: 'source', abilityId: 'a1' },
      script: [{ pickUid: 'effective-four' }],
      expect: [
        { kind: 'zone', cardId: HAND_EFFECTIVE_LEVEL_FOUR.id, zone: 'remove', side: 'self', present: true },
        { kind: 'state', uid: 'effective-four', state: 'stun' },
        { kind: 'candidatesExclude', pickIndex: 0, uid: 'effective-five' },
      ],
    });
    expect(state.players.opp.scene.find(card => card.uid === 'effective-five')?.state, B09050.id).toBe('active');
    expect(state.players.opp.scene.find(card => card.uid === 'effective-four')?.state).toBe('stun');
  });

  it('B09050 owner=opp honors the exact hand occurrence and effective level in authorization and payment', () => {
    resetManualRuntime();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'opp';
    const state = createEmptyGameState();
    state.turn = { number: 191, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    const source = mutate.scene.enter(state, 'opp', B09050.id, {});
    const effectiveFive = mutate.scene.enter(state, 'self', SCENE_EFFECTIVE_LEVEL_FIVE.id, {});
    const effectiveFour = mutate.scene.enter(state, 'self', SCENE_EFFECTIVE_LEVEL_FOUR.id, {});
    state.players.opp.hand = [W191_HAND_DECOY.id, HAND_EFFECTIVE_LEVEL_FOUR.id];

    activateDeclaredAbility(state, source.uid, 'a1', { removeFromHand: { indices: [1] } });
    runAllUntilEmpty(state);
    const pick = _drainPendingEffectPickSide()!;
    expect(pick.candidates.map(candidate => candidate.uid), B09050.id).toContain(effectiveFour.uid);
    expect(pick.candidates.map(candidate => candidate.uid), B09050.id).not.toContain(effectiveFive.uid);
    applyPickAndContinuation(state, pick, effectiveFour.uid);
    runAllUntilEmpty(state);

    expect(state.players.opp.hand).toEqual([W191_HAND_DECOY.id]);
    expect(state.players.opp.remove).toContain(HAND_EFFECTIVE_LEVEL_FOUR.id);
    expect(state.players.self.scene.find(card => card.uid === effectiveFour.uid)?.state).toBe('stun');
  });

  it('B09038 entered by an effect fires, sleeps itself, enters 工藤優作, and sets a deck card', () => {
    const state = runCardScenario(B09038, [W191_YUSAKU, W191_SET_CARD], {
      name: 'B09038 effect entry trigger',
      setup: {
        selfScene: [{ cardId: B09038.id, uid: 'source' }],
        hand: [W191_YUSAKU.id], deckTop: [W191_SET_CARD.id],
      },
      drive: { kind: 'enter', cardId: B09038.id, uid: 'source' },
      script: ['optional:take', { pickCardId: W191_YUSAKU.id }],
      expect: [
        { kind: 'state', uid: 'source', state: 'sleep' },
        { kind: 'zone', cardId: W191_YUSAKU.id, zone: 'scene', side: 'self', present: true },
      ],
    });
    const entered = state.players.self.scene.find(card => card.cardId === W191_YUSAKU.id)!;
    expect(entered.setCards, B09038.id).toEqual([expect.objectContaining({ cardId: W191_SET_CARD.id, faceUp: false })]);
  });

  it('B09041 contact immunity does not prevent later effect removal', () => {
    resetManualRuntime();
    const state = createEmptyGameState();
    const source = mutate.scene.enter(state, 'self', B09041.id, {});
    const guard = mutate.scene.enter(state, 'opp', W191_GUARD.id, {});

    event.emit(state, 'action:guarded', { byUid: source.uid, guardUid: guard.uid, targetUid: guard.uid }, {
      player: 'self', uid: source.uid,
    });
    runAllUntilEmpty(state);
    expect(state.players.opp.scene.find(card => card.uid === guard.uid)?.turnEffects.contactImmune_action).toBe(true);

    mutate.scene.removeToRemove(state, guard.uid, 'effect');
    expect(state.players.opp.scene.some(card => card.uid === guard.uid), B09041.id).toBe(false);
    expect(state.players.opp.remove).toContain(W191_GUARD.id);
  });

  it('B09047 can switch itself out for the character entered by its action trigger', () => {
    resetManualRuntime();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const state = createEmptyGameState();
    const source = mutate.scene.enter(state, 'self', B09047.id, {});
    for (const filler of W191_FILLERS) mutate.scene.enter(state, 'self', filler.id, {});
    state.players.self.remove = [W191_BLUE_ENTRY.id];

    event.emit(state, 'action:declare', { byUid: source.uid }, {
      player: 'self', uid: source.uid, cardId: source.cardId,
    });
    runAllUntilEmpty(state);
    const choice = _drainPendingEffectChoiceSide()!;
    applyChoiceAndContinuation(state, choice, 0);
    const pick = _drainPendingEffectPickSide()!;
    const selected = pick.candidates.find(candidate => candidate.cardId === W191_BLUE_ENTRY.id)!;
    applyPickAndContinuation(state, pick, selected.uid!, undefined, source.uid);
    runAllUntilEmpty(state);

    expect(state.players.self.scene.some(card => card.uid === source.uid), B09047.id).toBe(false);
    expect(state.players.self.remove).toContain(B09047.id);
    expect(state.players.self.scene.some(card => card.cardId === W191_BLUE_ENTRY.id)).toBe(true);
  });

  it('B09048 re-enters the Police card it discarded and may switch out the source itself', () => {
    const state = runCardScenario(B09048, [W191_POLICE, ...W191_FILLERS], {
      name: 'B09048 discard re-entry full-scene switch',
      setup: {
        selfScene: [
          { cardId: B09048.id, uid: 'source' },
          ...W191_FILLERS.map((card, index) => ({ cardId: card.id, uid: `filler-${index}` })),
        ],
        hand: [W191_POLICE.id],
      },
      drive: { kind: 'enter', cardId: B09048.id, uid: 'source' },
      script: [{ pickCardId: W191_POLICE.id }, { pickCardId: W191_POLICE.id, switchRemoveUid: 'source' }],
      expect: [
        { kind: 'zone', cardId: B09048.id, zone: 'remove', side: 'self', present: true },
        { kind: 'zone', cardId: W191_POLICE.id, zone: 'scene', side: 'self', present: true },
      ],
    });
    expect(state.players.self.remove, B09048.id).toContain(B09048.id);
    expect(state.players.self.scene.some(card => card.cardId === W191_POLICE.id), B09048.id).toBe(true);
  });

  it('B09055 can enter the same split-name card just removed from hand as its cost', () => {
    const state = runCardScenario(B09055, [W191_AKAI_SERA], {
      name: 'B09055 cost card re-entry',
      setup: {
        partnerColors: ['赤'], fileCount: 8,
        selfScene: [{ cardId: B09055.id, uid: 'source' }],
        hand: [W191_AKAI_SERA.id],
      },
      drive: { kind: 'declared', uid: 'source', abilityId: 'a2' },
      script: [{ pickCardId: W191_AKAI_SERA.id }],
      expect: [
        { kind: 'zone', cardId: B09055.id, zone: 'remove', side: 'self', present: true },
        { kind: 'zone', cardId: W191_AKAI_SERA.id, zone: 'scene', side: 'self', present: true },
      ],
    });
    expect(state.players.self.remove).toContain(B09055.id);
    expect(state.players.self.scene.some(card => card.cardId === W191_AKAI_SERA.id), B09055.id).toBe(true);
  });
});
