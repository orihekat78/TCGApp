// qa: card:B05095:3ebc71d3fe967142af371f16682581bf9d44ac0db1c409f0d2a20d11ffeeae41
// qa: card:B07085:3ebc71d3fe967142af371f16682581bf9d44ac0db1c409f0d2a20d11ffeeae41
// qa: card:B10028:3ebc71d3fe967142af371f16682581bf9d44ac0db1c409f0d2a20d11ffeeae41
// qa: card:D08007:3ebc71d3fe967142af371f16682581bf9d44ac0db1c409f0d2a20d11ffeeae41
// qa: card:B06099:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
// qa: card:B09012:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
// qa: card:B09030:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
// qa: card:B09031:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
// qa: card:B09043:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
// qa: card:B09052:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
// qa: card:B09059:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
// qa: card:B09076:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
// qa: card:B09077:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
// qa: card:B09098:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
// qa: card:B09099:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
// qa: card:B10059:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0
// qa: card:PR301:02302fc0994ea1eebd94ba851a2e38a51fa3e6dc54324f9029105bc44473bef0

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B05095 } from '@/cards/ct-p05/B05095';
import { B06099 } from '@/cards/ct-p06/B06099';
import { B07085 } from '@/cards/ct-p07/B07085';
import { B09012 } from '@/cards/ct-p09/B09012';
import { B09030 } from '@/cards/ct-p09/B09030';
import { B09031 } from '@/cards/ct-p09/B09031';
import { B09043 } from '@/cards/ct-p09/B09043';
import { B09052 } from '@/cards/ct-p09/B09052';
import { B09059 } from '@/cards/ct-p09/B09059';
import { B09076 } from '@/cards/ct-p09/B09076';
import { B09077 } from '@/cards/ct-p09/B09077';
import { B09098 } from '@/cards/ct-p09/B09098';
import { B09099 } from '@/cards/ct-p09/B09099';
import { B10028 } from '@/cards/ct-p10/B10028';
import { B10059 } from '@/cards/ct-p10/B10059';
import { D08007 } from '@/cards/ct-d08/D08007';
import { PR301 } from '@/cards/pr-01/PR301';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow/index.js';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const OWNER_ID = 'CUTIN_FAMILY_OWNER';
const OWNER_PLAIN_ID = 'CUTIN_FAMILY_OWNER_PLAIN';
const SUPPORT_ID = 'CUTIN_FAMILY_SUPPORT';
const OTHER_ID = 'CUTIN_FAMILY_OTHER';
const OWNER_UID = 'cutin-family-owner';
const SUPPORT_UID = 'cutin-family-support';
const OTHER_UID = 'cutin-family-other';
const TRAITS = ['警察', '喫茶ポアロ', '探偵', '高校生', '少年探偵団'];
const CARDS = [B05095, B06099, B07085, B09012, B09030, B09031, B09043, B09052, B09059,
  B09076, B09077, B09098, B09099, B10028, B10059, D08007, PR301] as const;

function character(id: string, ap: number, traits: string[] = []): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['黒'], level: 8, ap, lp: 1,
    traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

const OWNER = character(OWNER_ID, 1000, TRAITS);
const OWNER_PLAIN = character(OWNER_PLAIN_ID, 1000);
const SUPPORT = character(SUPPORT_ID, 0, TRAITS);
const OTHER = character(OTHER_ID, 5000);
const other = (player: Player): Player => player === 'self' ? 'opp' : 'self';

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(card: CardDef, owner: Player, turnPlayer: Player, traitCount: 0 | 1 | 2): void {
  endMatchSession();
  flow.action._resetActionContexts();
  useGameStateStore.getState().resetMatchSessionState();
  beginMatchSession(owner);
  const state = createEmptyGameState();
  const opponent = other(owner);
  const ownerActs = owner === turnPlayer;
  state.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].hand = [card.id];
  const actorCardId = traitCount === 0 ? OWNER_PLAIN_ID : OWNER_ID;
  state.players[owner].scene = [makeChar({ cardId: actorCardId, uid: OWNER_UID, state: ownerActs ? 'active' : 'sleep' })];
  if (traitCount === 2) {
    state.players[owner].scene.push(makeChar({ cardId: SUPPORT_ID, uid: SUPPORT_UID, state: 'sleep' }));
  }
  state.players[opponent].scene = [makeChar({ cardId: OTHER_ID, uid: OTHER_UID, state: ownerActs ? 'sleep' : 'active' })];
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function run(card: CardDef, owner: Player, turnPlayer: Player, traitCount: 0 | 1 | 2 = 1) {
  install(card, owner, turnPlayer, traitCount);
  const ownerActs = owner === turnPlayer;
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: ownerActs ? OWNER_UID : OTHER_UID,
    targetUid: ownerActs ? OTHER_UID : OWNER_UID })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  const dispatch = dispatchEngineAction({ type: 'actionContact', actionId, player: owner,
    choice: { kind: 'cutin', cardId: card.id } });
  const state = current();
  return { dispatch, hand: state.players[owner].hand, remove: state.players[owner].remove,
    cutInUsed: flow.action._getContext(state, actionId)?.cutInUsed?.[owner] === true,
    ap: readChar.ap(state, OWNER_UID), openEffects: state.pendingEffects.filter(e => e.state !== 'resolved').length,
    declaredNameActions: state.log.filter(entry => entry.action.startsWith('effect:declareName')).map(entry => entry.action) };
}

function prove(card: CardDef, ownTurnAp: number, owner: Player = 'self') {
  const shape = (ap: number) => ({ dispatch: { ok: true }, hand: [], remove: [card.id],
    cutInUsed: true, ap, openEffects: 0, declaredNameActions: [] });
  return { actual: { ownTurn: run(card, owner, owner), opponentTurn: run(card, owner, other(owner)) },
    expected: { ownTurn: shape(ownTurnAp), opponentTurn: shape(1000) } };
}

function proveDynamic(card: CardDef) {
  const shape = (ap: number) => ({ dispatch: { ok: true }, hand: [], remove: [card.id],
    cutInUsed: true, ap, openEffects: 0, declaredNameActions: [] });
  return {
    actual: {
      zeroTraits: run(card, 'self', 'self', 0),
      oneTrait: run(card, 'self', 'self', 1),
      twoTraits: run(card, 'self', 'self', 2),
      opponentTurnWithTwoTraits: run(card, 'self', 'opp', 2),
    },
    expected: {
      zeroTraits: shape(1000),
      oneTrait: shape(2000),
      twoTraits: shape(3000),
      opponentTurnWithTwoTraits: shape(1000),
    },
  };
}

beforeEach(() => {
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  flow.action._resetActionContexts();
  useGameStateStore.getState().resetMatchSessionState();
  for (const card of [...CARDS, OWNER, OWNER_PLAIN, SUPPORT, OTHER]) register(card);
  registerTriggeredListener();
});

afterEach(() => endMatchSession());

describe('expanded turn-conditioned cut-in public authority', () => {
  it('card:B05095:3ebc71 proves Police-count AP then opponent-turn no-text', () => {
    const proof = proveDynamic(B05095); expect({ B05095: proof.actual }).toEqual({ B05095: proof.expected });
  });
  it('card:B07085:3ebc71 proves Poirot-count AP then opponent-turn no-text', () => {
    const proof = proveDynamic(B07085); expect({ B07085: proof.actual }).toEqual({ B07085: proof.expected });
  });
  it('card:B10028:3ebc71 proves student-count AP then opponent-turn no-text', () => {
    const proof = proveDynamic(B10028); expect({ B10028: proof.actual }).toEqual({ B10028: proof.expected });
  });
  it('card:D08007:3ebc71 proves Detective-Boys-count AP then opponent-turn no-text', () => {
    const proof = proveDynamic(D08007); expect({ D08007: proof.actual }).toEqual({ D08007: proof.expected });
  });
  it('card:B06099:02302f proves +3000 then opponent-turn no-text', () => {
    const proof = prove(B06099, 4000); expect({ B06099: proof.actual }).toEqual({ B06099: proof.expected });
  });
  it('card:B09012:02302f proves +3000 then opponent-turn no-text', () => {
    const proof = prove(B09012, 4000); expect({ B09012: proof.actual }).toEqual({ B09012: proof.expected });
  });
  it('card:B09030:02302f proves +3000 then opponent-turn no-text', () => {
    const proof = prove(B09030, 4000); expect({ B09030: proof.actual }).toEqual({ B09030: proof.expected });
  });
  it('card:B09031:02302f proves Detective-count AP then opponent-turn no-text', () => {
    const proof = proveDynamic(B09031); expect({ B09031: proof.actual }).toEqual({ B09031: proof.expected });
  });
  it('card:B09043:02302f proves +3000 then opponent-turn no-text', () => {
    const proof = prove(B09043, 4000); expect({ B09043: proof.actual }).toEqual({ B09043: proof.expected });
  });
  it('card:B09052:02302f accepts the cut-in off-turn without running its name declaration', () => {
    const actual = run(B09052, 'self', 'opp', 2);
    expect({ B09052: actual }).toEqual({ B09052: { dispatch: { ok: true }, hand: [], remove: ['B09052'],
      cutInUsed: true, ap: 1000, openEffects: 0, declaredNameActions: [] } });
  });
  it('card:B09059:02302f proves +3000 then opponent-turn no-text', () => {
    const proof = prove(B09059, 4000); expect({ B09059: proof.actual }).toEqual({ B09059: proof.expected });
  });
  it('card:B09076:02302f proves +2000 then opponent-turn no-text', () => {
    const proof = prove(B09076, 3000); expect({ B09076: proof.actual }).toEqual({ B09076: proof.expected });
  });
  it('card:B09077:02302f proves +3000 then opponent-turn no-text', () => {
    const proof = prove(B09077, 4000); expect({ B09077: proof.actual }).toEqual({ B09077: proof.expected });
  });
  it('card:B09098:02302f proves +3000 then opponent-turn no-text', () => {
    const proof = prove(B09098, 4000); expect({ B09098: proof.actual }).toEqual({ B09098: proof.expected });
  });
  it('card:B09099:02302f proves +2000 then opponent-turn no-text', () => {
    const proof = prove(B09099, 3000); expect({ B09099: proof.actual }).toEqual({ B09099: proof.expected });
  });
  it('card:B10059:02302f proves +2000 then opponent-turn no-text', () => {
    const proof = prove(B10059, 3000); expect({ B10059: proof.actual }).toEqual({ B10059: proof.expected });
  });
  it('card:PR301:02302f proves +3000 then opponent-turn no-text', () => {
    const proof = prove(PR301, 4000); expect({ PR301: proof.actual }).toEqual({ PR301: proof.expected });
  });
  it('evaluates the condition relative to an opponent-owned printing', () => {
    const proof = prove(B06099, 4000, 'opp'); expect(proof.actual).toEqual(proof.expected);
  });
});
