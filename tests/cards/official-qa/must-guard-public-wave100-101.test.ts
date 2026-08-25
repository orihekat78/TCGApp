// qa: card:B09040:6b3466d6028ee8cf6bd4dc34f5b93627c4da5a38c1229747dde4f1ba5a8b8ee6
// qa: card:PR290:6b3466d6028ee8cf6bd4dc34f5b93627c4da5a38c1229747dde4f1ba5a8b8ee6
// qa: card:PR296:6b3466d6028ee8cf6bd4dc34f5b93627c4da5a38c1229747dde4f1ba5a8b8ee6
// qa: card:B09040:ebc300cd2852f7cc3e2d52664bcc7405d5e9146ec924a4907a24a2545f389883
// qa: card:PR290:ebc300cd2852f7cc3e2d52664bcc7405d5e9146ec924a4907a24a2545f389883
// qa: card:PR296:ebc300cd2852f7cc3e2d52664bcc7405d5e9146ec924a4907a24a2545f389883

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09040 } from '@/cards/ct-p09/B09040';
import { B09040P } from '@/cards/ct-p09/B09040P';
import { PR290 } from '@/cards/pr-01/PR290';
import { PR296 } from '@/cards/pr-01/PR296';
import { event } from '@/engine/event';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const ATTACKER_ID = 'W100_ATTACKER';
const ACTION_TARGET_ID = 'W100_ACTION_TARGET';
const FORCED_ID = 'W100_FORCED';
const PLAIN_ID = 'W100_PLAIN';
const KYOGOKU_ID = 'W100_KYOGOKU';
const ATTACKER_UID = 'wave100-attacker';
const ACTION_TARGET_UID = 'wave100-action-target';
const FORCED_ONE_UID = 'wave100-forced-1';
const FORCED_TWO_UID = 'wave100-forced-2';
const PLAIN_UID = 'wave100-plain';

type Row = {
  card: CardDef;
  abilityId: 'a2' | 'a3';
  abilityIndex: 1 | 2;
  needsBond: boolean;
};

const ROWS: Row[] = [
  { card: B09040, abilityId: 'a2', abilityIndex: 1, needsBond: true },
  { card: B09040P, abilityId: 'a2', abilityIndex: 1, needsBond: true },
  { card: PR290, abilityId: 'a3', abilityIndex: 2, needsBond: false },
  { card: PR296, abilityId: 'a3', abilityIndex: 2, needsBond: false },
];

function fixture(id: string, options: { names?: string[]; level?: number; ap?: number } = {}): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: options.names ?? [id],
    colors: ['緑'],
    level: options.level ?? 3,
    ap: options.ap ?? 3000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

const ATTACKER = fixture(ATTACKER_ID, { ap: 5000 });
const ACTION_TARGET = fixture(ACTION_TARGET_ID, { level: 1, ap: 1000 });
const FORCED = fixture(FORCED_ID, { level: 5, ap: 2000 });
const PLAIN = fixture(PLAIN_ID, { level: 5, ap: 2000 });
const KYOGOKU = fixture(KYOGOKU_ID, { names: ['京極真'], level: 5 });

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function stateFor(row: Row, owner: Player, sourceCount = 1): GameState {
  const defender = other(owner);
  const state = createEmptyGameState();
  state.turn = { number: 7, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case.colors = ['緑', '白'];
  state.players[owner].scene = [
    ...Array.from({ length: sourceCount }, (_value, index) => makeChar({
      cardId: row.card.id,
      uid: `wave100-source-${index + 1}`,
    })),
    makeChar({ cardId: ATTACKER_ID, uid: ATTACKER_UID }),
    ...(row.needsBond ? [makeChar({ cardId: KYOGOKU_ID, uid: 'wave100-bond' })] : []),
  ];
  state.players[defender].scene = [
    makeChar({ cardId: FORCED_ID, uid: FORCED_ONE_UID }),
    makeChar({ cardId: FORCED_ID, uid: FORCED_TWO_UID }),
    makeChar({ cardId: PLAIN_ID, uid: PLAIN_UID }),
    makeChar({ cardId: ACTION_TARGET_ID, uid: ACTION_TARGET_UID, state: 'sleep' }),
  ];
  state.players.self.deck = [PLAIN_ID, PLAIN_ID];
  state.players.opp.deck = [PLAIN_ID, PLAIN_ID];
  return state;
}

function install(state: GameState, owner: Player, label: string): void {
  endMatchSession();
  beginMatchSession(owner);
  resetPresentationQueue(`qa-wave100-${label}`);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = owner;
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave100 state');
  return state;
}

function grant(row: Row, sourceNumber: number, targetUid: string): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility',
    uid: `wave100-source-${sourceNumber}`,
    abilId: row.abilityId,
    abilityOrigin: 'printed',
    abilityIndex: row.abilityIndex,
  })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending?.source).toMatchObject({ cardId: row.card.id, abilityId: row.abilityId });
  expect(pending?.candidates.map(candidate => candidate.uid)).toContain(targetUid);
  expect(dispatchEngineAction(bindPendingDecision(pending!, {
    type: 'effectPickResolve',
    pickedUid: targetUid,
  }))).toEqual({ ok: true });
  const granted = current().players[other(current().turn.player)].scene.find(card => card.uid === targetUid);
  expect(granted?.turnEffects.mustGuard).toBe(true);
}

function declareAction(): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar',
    byUid: ATTACKER_UID,
    targetUid: ACTION_TARGET_UID,
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId;
  if (!actionId) throw new Error('Wave100 action did not expose an ID');
  return actionId;
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetRegistry();
  _resetUidCounter();
  _resetTriggeredRegistered();
  registerAll();
  for (const card of [ATTACKER, ACTION_TARGET, FORCED, PLAIN, KYOGOKU]) register(card);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Waves100-101: B09040/P PR290 PR296 must-guard choices', () => {
  it.each(ROWS.flatMap(row => (['self', 'opp'] as const).map(owner => ({ row, owner }))))(
    '$row.card.id owner $owner requires its active granted character and rejects pass or a plain guard',
    ({ row, owner }) => {
      install(stateFor(row, owner), owner, `${row.card.id}-${owner}-required`);
      grant(row, 1, FORCED_ONE_UID);
      const actionId = declareAction();

      expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
        .toEqual({ ok: false, reason: 'not-allowed' });
      expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: PLAIN_UID }))
        .toEqual({ ok: false, reason: 'not-allowed' });
      expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: FORCED_ONE_UID }))
        .toEqual({ ok: true });
      expect(current().players[other(owner)].scene.find(card => card.uid === FORCED_ONE_UID)?.state)
        .toBe('sleep');
    },
  );

  it.each(ROWS)('$card.id allows pass or a normal guard when its granted character cannot guard', row => { // Card-bound: B09040 B09040P PR290 PR296.
    const prepare = () => {
      install(stateFor(row, 'self'), 'self', `${row.card.id}-unavailable`);
      grant(row, 1, FORCED_ONE_UID);
      const state = structuredClone(current()) as GameState;
      state.players.opp.scene.find(card => card.uid === FORCED_ONE_UID)!.state = 'sleep';
      expect(useGameStateStore.getState().setGameState(state)).toBe(true);
      return declareAction();
    };

    const passActionId = prepare();
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: passActionId, guarderUid: null }))
      .toEqual({ ok: true });

    const guardActionId = prepare();
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: guardActionId, guarderUid: PLAIN_UID }))
      .toEqual({ ok: true });
  });

  it.each(ROWS)('$card.id lets the defender choose one of two active must-guard characters', row => { // Card-bound: B09040 B09040P PR290 PR296.
    install(stateFor(row, 'self', 2), 'self', `${row.card.id}-multiple`);
    grant(row, 1, FORCED_ONE_UID);
    grant(row, 2, FORCED_TWO_UID);
    const actionId = declareAction();

    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: FORCED_TWO_UID }))
      .toEqual({ ok: true });
    expect(current().players.opp.scene.find(card => card.uid === FORCED_ONE_UID)?.state).toBe('active');
    expect(current().players.opp.scene.find(card => card.uid === FORCED_TWO_UID)?.state).toBe('sleep');
  });
});

// qa: card:B10016:ba833eaf820ef15094d039d1057fd271f5a7bb23b43e95a1c2ac2a5bb5e4687a

describe('official QA Wave126: a sleeping B10016 honors granted must-guard', () => {
  it.each(['self', 'opp'] as const)('grant owner %s', owner => {
    const row = ROWS[0]!;
    const state = stateFor(row, owner);
    const defender = other(owner);
    const bearer = state.players[defender].scene
      .find(character => character.uid === FORCED_ONE_UID)!;
    bearer.cardId = 'B10016';
    bearer.state = 'sleep';
    expect('B10016').toBe(bearer.cardId);
    install(state, owner, 'B10016-' + owner + '-sleep-must-guard');
    grant(row, 1, FORCED_ONE_UID);
    expect(current().players[defender].scene.find(character => character.uid === FORCED_ONE_UID))
      .toMatchObject({ cardId: 'B10016', state: 'sleep', turnEffects: { mustGuard: true } });

    const actionId = declareAction();
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null }))
      .toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: FORCED_ONE_UID }))
      .toEqual({ ok: true });
  });
});
