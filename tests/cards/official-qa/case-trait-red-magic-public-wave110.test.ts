// qa: card:B07031:dcf72f7ad683c115b3f581b518e42b1c728f361ea984bfb38ac165c79eb83ce4
// qa: card:B07034:dcf72f7ad683c115b3f581b518e42b1c728f361ea984bfb38ac165c79eb83ce4
// qa: card:B07052:dcf72f7ad683c115b3f581b518e42b1c728f361ea984bfb38ac165c79eb83ce4

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B07031 } from '@/cards/ct-p07/B07031';
import { B07031P } from '@/cards/ct-p07/B07031P';
import { B07034 } from '@/cards/ct-p07/B07034';
import { B07034P } from '@/cards/ct-p07/B07034P';
import { B07052 } from '@/cards/ct-p07/B07052';
import { event } from '@/engine/event';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { canAction } from '@/engine/flow';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const RED_MAGIC = caseDef('W110_RED_MAGIC', ['赤魔術']);
const RED_MAGIC_PLUS = caseDef('W110_RED_MAGIC_PLUS', ['まじっく快斗', '赤魔術']);
const MISSING = caseDef('W110_MISSING', ['まじっく快斗']);
const NEAR = caseDef('W110_NEAR', ['赤魔法']);
const COST = fixture('W110_COST');
const SET_TOP = fixture('W110_SET_TOP');
const DRAW = fixture('W110_DRAW');
const TAIL = fixture('W110_TAIL');
const CASES = [
  { definition: RED_MAGIC, valid: true },
  { definition: RED_MAGIC_PLUS, valid: true },
  { definition: MISSING, valid: false },
  { definition: NEAR, valid: false },
] as const;
const DECLARED = [B07031, B07031P] as const;
const LEAVE_DRAW = [B07034, B07034P] as const;
const DECLARED_CASES = DECLARED.flatMap(source => (['self', 'opp'] as const)
  .flatMap(owner => CASES.map(caseRow => ({ source, owner, caseRow }))));
const LEAVE_DRAW_CASES = LEAVE_DRAW.flatMap(source => (['self', 'opp'] as const)
  .flatMap(owner => CASES.map(caseRow => ({ source, owner, caseRow }))));
const ASSAULT_CASES = (['self', 'opp'] as const)
  .flatMap(owner => CASES.map(caseRow => ({ owner, caseRow })));

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['白'],
    level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function caseDef(id: string, caseTraits: string[]): CardDef {
  return {
    id, no: `test/${id}`, kind: 'case', names: [id], colors: ['白'],
    caseLevel: 7, caseTraits, traits: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function setCase(state: GameState, player: Player, definition: CardDef): void {
  state.players[player].case = {
    cardId: definition.id,
    status: '事件編',
    requiredEvidence: 7,
    colors: ['白'],
    declaredUseCount: {},
  };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave110 state');
  return state;
}

function installBase(
  source: CardDef,
  owner: Player,
  caseDefinition: CardDef,
  options: { deck?: readonly string[]; named?: boolean } = {},
): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  setCase(state, owner, caseDefinition);
  setCase(state, other(owner), RED_MAGIC);
  state.players[owner].scene = [sceneChar(source.id, 'source', { isNamed: options.named ?? false })];
  state.players[owner].hand = [COST.id];
  state.players[owner].deck = [...(options.deck ?? [])];
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  return state;
}

function dispatchDeclared(owner: Player) {
  return dispatchEngineAction({
    type: 'declaredAbility',
    uid: 'source',
    abilId: 'a2',
    costParams: { removeFromHand: { indices: [0] } },
    abilityOrigin: 'printed',
    abilityIndex: 1,
  });
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _resetTargetExpanders();
  _resetUidCounter();
  registerAll();
  for (const card of [RED_MAGIC, RED_MAGIC_PLUS, MISSING, NEAR, COST, SET_TOP, DRAW, TAIL]) register(card);
  registerTriggeredListener();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe('official QA Wave110: B07031/P declaration uses the owner case trait exactly', () => {
  // Card-bound physical rows: B07031 B07031P.
  it.each(DECLARED_CASES)(
    '$source.id owner $owner case $caseRow.definition.id validity $caseRow.valid',
    ({ source, owner, caseRow }) => {
      const before = installBase(source, owner, caseRow.definition);
      const beforeJson = JSON.stringify(before);
      const result = dispatchDeclared(owner);
      if (!caseRow.valid) {
        expect(result).toEqual({ ok: false, reason: 'not-allowed' });
        expect(JSON.stringify(current())).toBe(beforeJson);
        expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
        return;
      }
      expect(result).toEqual({ ok: true });
      expect(current().players[owner].scene.find(card => card.uid === 'source')?.state).toBe('sleep');
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[owner].remove).toContain(COST.id);
      expect(useGameStateStore.getState().pendingEffectPick).toMatchObject({
        atomVerb: 'sceneRemove', player: owner, source: { cardId: source.id, abilityId: 'a2' },
      });
    },
  );
});

describe('official QA Wave110: B07034/P leave draw is disabled with invalid incident trait', () => {
  // Card-bound physical rows: B07034 B07034P.
  it.each(LEAVE_DRAW_CASES)(
    '$source.id owner $owner case $caseRow.definition.id validity $caseRow.valid',
    ({ source, owner, caseRow }) => {
      installBase(source, owner, caseRow.definition, { deck: [SET_TOP.id, DRAW.id, TAIL.id] });
      expect(dispatchDeclared(owner)).toEqual({ ok: true });
      const pending = useGameStateStore.getState().pendingEffectPick;
      expect(pending).toMatchObject({ atomVerb: 'sceneRemove', player: owner });
      expect(pending?.candidates.map(candidate => candidate.uid)).toContain('source');
      expect(dispatchEngineAction(bindPendingDecision(pending!, {
        type: 'effectPickResolve', pickedUid: 'source',
      }))).toEqual({ ok: true });

      expect(current().players[owner].scene.some(card => card.uid === 'source')).toBe(false);
      expect(current().players[owner].remove).toEqual(expect.arrayContaining([COST.id, SET_TOP.id, source.id]));
      expect(current().players[owner].hand).toEqual(caseRow.valid ? [DRAW.id] : []);
      expect(current().players[owner].deck).toEqual(caseRow.valid ? [TAIL.id] : [DRAW.id, TAIL.id]);
    },
  );
});

describe('official QA Wave110: B07052 Assault grant is owner-relative and exact', () => {
  // Card-bound physical row: B07052.
  it.each(ASSAULT_CASES)(
    'owner $owner case $caseRow.definition.id validity $caseRow.valid',
    ({ owner, caseRow }) => {
      installBase(B07052, owner, caseRow.definition, { named: true });
      expect(readChar.hasKeyword(current(), 'source', '突撃')).toBe(caseRow.valid);
      expect(canAction(current(), 'source')).toBe(caseRow.valid);
    },
  );
});
