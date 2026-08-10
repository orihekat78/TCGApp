import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { PR100 } from '@/cards/pr-01/PR100';
import { event } from '@/engine/event';
import { applyOptionalAndContinuation, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
  _drainPendingEffectOptionalSide,
  _drainPendingEffectPickSide,
} from '@/engine/effect/pending-state';
import { cutIn } from '@/engine/flow/contact';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { ActionContext, CardDef } from '@/engine/types';

function character(id: string, level: number, names: string[] = [id]): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names,
    colors: ['赤'],
    level,
    ap: 1000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

const HOST = character('PR100_HOST', 5);
const OPP = character('PR100_OPP', 5);
const FILE_TOP = character('PR100_FILE_TOP', 1);
const SHELLY5 = character('PR100_SHELLY5', 5, ['シェリー']);
const SHELLY6 = character('PR100_SHELLY6', 6, ['シェリー']);
const SHIHO6 = character('PR100_SHIHO6', 6, ['宮野志保']);
const WRONG5 = character('PR100_WRONG5', 5, ['対象外']);

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  [PR100, HOST, OPP, FILE_TOP, SHELLY5, SHELLY6, SHIHO6, WRONG5].forEach(registerCardDef);
  registerTriggeredListener();
});

describe('PR100 official Q&A', () => {
  it('offers only a named level-5-or-lower character after taking the top FILE card', () => {
    let state = createEmptyGameState();
    state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    const attacker = mutate.scene.enter(state, 'self', HOST.id, {});
    const defender = mutate.scene.enter(state, 'opp', OPP.id, {});
    state.players.self.hand = [PR100.id];
    state.players.self.case.status = '解決編';
    state.players.self.file = [
      { type: 'card-back', cardId: 'PR100_F1' },
      { type: 'card-back', cardId: 'PR100_F2' },
      { type: 'card-back', cardId: 'PR100_F3' },
      { type: 'card-back', cardId: FILE_TOP.id },
    ];
    state.players.self.remove = [SHELLY5.id, SHELLY6.id, SHIHO6.id, WRONG5.id];
    const action = {
      id: 'pr100-cutin',
      byUid: attacker.uid,
      byPlayer: 'self',
      target: { kind: 'char', uid: defender.uid },
      phase: 'action-1',
      cutInUsed: {},
      startedAt: { turn: 3, nano: 0 },
      contactImmune: false,
    } as ActionContext;

    state = produce(state, draft => {
      cutIn(draft, action, 'self', PR100.id);
      runAllUntilEmpty(draft);
    });
    const optional = _drainPendingEffectOptionalSide();
    expect(optional?.source.cardId).toBe(PR100.id);

    state = produce(state, draft => {
      applyOptionalAndContinuation(draft, optional!, true);
    });
    const pick = _drainPendingEffectPickSide();
    expect(pick?.atomVerb).toBe('sceneEnter');
    expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual([SHELLY5.id]);

    state = produce(state, draft => {
      applyPickAndContinuation(draft, pick!, pick!.candidates[0]!.uid);
      runAllUntilEmpty(draft);
    });
    expect(state.players.self.hand).toEqual([FILE_TOP.id]);
    expect(state.players.self.file).toHaveLength(3);
    expect(state.players.self.scene.some(characterInScene => characterInScene.cardId === SHELLY5.id)).toBe(true);
    expect(state.players.self.remove).toEqual(expect.arrayContaining([
      PR100.id,
      SHELLY6.id,
      SHIHO6.id,
      WRONG5.id,
    ]));
  });
});
