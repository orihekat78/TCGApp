// qa: card:B02038:9a7ccef11a5002bcfc03a28064e814701347f8287061fa3575d710a68d789a48
// qa: card:B02041:9a7ccef11a5002bcfc03a28064e814701347f8287061fa3575d710a68d789a48
// qa: card:B02043:9a7ccef11a5002bcfc03a28064e814701347f8287061fa3575d710a68d789a48
// qa: card:B02044:9a7ccef11a5002bcfc03a28064e814701347f8287061fa3575d710a68d789a48
// qa: card:B02045:9a7ccef11a5002bcfc03a28064e814701347f8287061fa3575d710a68d789a48
// qa: card:B02047:9a7ccef11a5002bcfc03a28064e814701347f8287061fa3575d710a68d789a48
// qa: card:B03050:bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6
// qa: card:B03051:bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6
// qa: card:B03052:bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6
// qa: card:B03129:bde0a3a5b0127797c2caad230a469d5a24f2a164829581273d0d8e77589383d6
// Rules: 03-field-areas, 08-contact, 09-cutin-disguise, 15-abilities-effects,
// 16-card-set, 17-icons, 19-special-rules, 20-color-and-switch, 23-qa-disguise-cutin.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, def as readDef, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player, SceneCharacter } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const OLD_FACE = 'W82-OLD-FACE';
const TARGET = 'W82-CONTACT-TARGET';
const WHITE_PARTNER = 'W82-WHITE-PARTNER';
const RED_PARTNER = 'W82-RED-PARTNER';
const WHITE_CASE = 'W82-WHITE-CASE';
const WHITE_MULTI_CASE = 'D06019';
const RED_BLUE_CASE = 'W82-RED-BLUE-CASE';
const SET_A = 'W83-SET-A';
const SET_B = 'W83-SET-B';
const STACK_A = 'W83-STACK-A';
const STACK_B = 'W83-STACK-B';
const FILE_CARD = 'W82-FILE';
const DECK_TOP = 'W83-DECK-TOP';
const DECK_TAIL = 'W83-DECK-TAIL';
const CUTIN = 'W83-CUTIN';
const ENTER_OBSERVER = 'W83-ENTER-OBSERVER';
const ACTOR_UID = 'waves82-83-actor';
const TARGET_UID = 'waves82-83-target';

type HookEvidence = { hook: string; abilityId: string };
type Wave82Row = {
  physical: string;
  file: number;
  expectedHooks: HookEvidence[];
};
type Wave83Row = {
  physical: string;
  incoming: string;
  oldFace: string;
  file: number;
  caseId: string;
  incomingHooks: HookEvidence[];
  incomingNames: string[];
  incomingColors: string[];
};

const WAVE82_ROWS: Wave82Row[] = [
  { physical: 'B02038', file: 6, expectedHooks: [{ hook: 'disguise:into', abilityId: 'a1' }] },
  { physical: 'B02038P', file: 6, expectedHooks: [{ hook: 'disguise:into', abilityId: 'a1' }] },
  { physical: 'B02041', file: 6, expectedHooks: [{ hook: 'disguise:into', abilityId: 'a2' }] },
  { physical: 'B02041P', file: 6, expectedHooks: [{ hook: 'disguise:into', abilityId: 'a2' }] },
  { physical: 'B02043', file: 5, expectedHooks: [] },
  { physical: 'B02044', file: 4, expectedHooks: [{ hook: 'disguise:into', abilityId: 'a2' }] },
  { physical: 'B02044P', file: 4, expectedHooks: [{ hook: 'disguise:into', abilityId: 'a2' }] },
  { physical: 'B02045', file: 4, expectedHooks: [{ hook: 'disguise:into', abilityId: 'a2' }] },
  { physical: 'B02047', file: 6, expectedHooks: [{ hook: 'disguise:into', abilityId: 'a2' }] },
];

const WAVE83_ROWS: Wave83Row[] = [
  {
    physical: 'B03050', incoming: 'B03050', oldFace: OLD_FACE, file: 5, caseId: WHITE_CASE,
    incomingHooks: [], incomingNames: ['怪盗キッド'], incomingColors: ['白'],
  },
  {
    physical: 'B03051', incoming: 'B03051', oldFace: OLD_FACE, file: 6, caseId: WHITE_CASE,
    incomingHooks: [], incomingNames: ['怪盗キッド'], incomingColors: ['白'],
  },
  {
    physical: 'B03052', incoming: 'B03129', oldFace: 'B03052', file: 6, caseId: RED_BLUE_CASE,
    incomingHooks: [{ hook: 'disguise:into', abilityId: 'a2' }],
    incomingNames: ['ベルモット'], incomingColors: ['黒'],
  },
  {
    physical: 'B03052P', incoming: 'B03129', oldFace: 'B03052P', file: 6, caseId: RED_BLUE_CASE,
    incomingHooks: [{ hook: 'disguise:into', abilityId: 'a2' }],
    incomingNames: ['ベルモット'], incomingColors: ['黒'],
  },
  {
    physical: 'B03129', incoming: 'B03129', oldFace: OLD_FACE, file: 6, caseId: RED_BLUE_CASE,
    incomingHooks: [{ hook: 'disguise:into', abilityId: 'a2' }],
    incomingNames: ['ベルモット'], incomingColors: ['黒'],
  },
  {
    physical: 'B03129P', incoming: 'B03129P', oldFace: OLD_FACE, file: 6, caseId: RED_BLUE_CASE,
    incomingHooks: [{ hook: 'disguise:into', abilityId: 'a2' }],
    incomingNames: ['ベルモット'], incomingColors: ['黒'],
  },
];

function fixture(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['白'], level: 3,
    ap: 3000, lp: 2, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

const enterObserver: CardDef = fixture(ENTER_OBSERVER, {
  abilities: [{
    id: 'observe-enter', type: 'triggered', scope: 'on-scene',
    trigger: {
      hook: 'enter',
      matcherCondition: {
        kind: 'triggerCharMatches', side: 'self', excludeSource: true,
        payloadKey: 'uid', filter: { kind: 'character' },
      },
    },
    effect: {
      kind: 'atom', verb: 'charSetTurnEffect',
      args: { uid: '$self', key: 'externalEnterObserved_turn', val: true },
    },
    description: '別の自分のキャラが登場したとき観測する。', ruleRefs: [],
  } as never],
});

const noopCutin = {
  id: 'cutin', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 0 } },
  description: '【カットイン】', ruleRefs: [],
} as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function fileCards(count: number) {
  return Array.from({ length: count }, () => ({ type: 'card-back' as const, cardId: FILE_CARD }));
}

function inheritedActor(cardId: string): SceneCharacter {
  return sceneChar(cardId, ACTOR_UID, {
    state: 'active',
    isNamed: true,
    setCards: [
      { cardId: SET_A, faceUp: false, instanceId: 'wave83-set-a' },
      { cardId: SET_B, faceUp: true, instanceId: 'wave83-set-b' },
    ],
    stackedCards: [
      { cardId: STACK_A, instanceId: 'wave83-stack-a' },
      { cardId: STACK_B, instanceId: 'wave83-stack-b' },
    ],
    keywordOverrides: { granted: ['突撃'], disabledOriginal: false },
    apOverride: 2300,
    lpOverride: 3,
    turnEffects: {
      contactImmune: false,
      removeOnTurnEnd: true,
      apMod_wave83: 400,
      lpMod_wave83: 1,
      grantedTraits_turn: ['Wave83Trait'],
      nameOverride: '継承名',
    },
  });
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Waves82-83 state');
  return state;
}

function caseColors(caseId: string): string[] {
  if (caseId === WHITE_CASE) return ['白'];
  if (caseId === WHITE_MULTI_CASE) return ['緑', '白'];
  return ['赤', '青'];
}

function contactState(options: {
  owner: Player;
  incoming: string;
  oldFace?: string;
  file: number;
  caseId: string;
}): GameState {
  const { owner, incoming, oldFace = OLD_FACE, file, caseId } = options;
  const state = createEmptyGameState();
  state.turn = { number: 26, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  state.players[owner].case = {
    ...state.players[owner].case,
    cardId: caseId,
    colors: caseColors(caseId),
  };
  state.players[owner].partner = { cardId: WHITE_PARTNER, state: 'active', location: 'partner-area' };
  state.players[owner].file = fileCards(file);
  state.players[owner].hand = [incoming];
  state.players[owner].deck = [DECK_TOP, DECK_TAIL];
  state.players[owner].scene = [
    inheritedActor(oldFace),
    sceneChar(ENTER_OBSERVER, `${owner}-enter-observer`),
  ];
  state.players[other(owner)].scene = [sceneChar(TARGET, TARGET_UID, { state: 'sleep' })];
  return state;
}

function install(state: GameState, label: string, human: Player): void {
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function ownerOf(uid: string): Player {
  return current().players.self.scene.some(card => card.uid === uid) ? 'self' : 'opp';
}

function reachOwnerWindow(owner: Player): string {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: ACTOR_UID, targetUid: TARGET_UID }))
    .toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 14; step += 1) {
    const context = flow.action._getContext(current(), actionId);
    if (!context) throw new Error('contact ended before owner disguise window');
    if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
      const actingUid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
      const player = ownerOf(actingUid!);
      if (player === owner && actingUid === ACTOR_UID) return actionId;
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('owner disguise window not reached');
}

function attemptDisguise(owner: Player, cardId: string) {
  const actionId = reachOwnerWindow(owner);
  const beforeSceneCount = current().players[owner].scene.length;
  const before = JSON.parse(JSON.stringify(
    current().players[owner].scene.find(card => card.uid === ACTOR_UID),
  )) as SceneCharacter;
  const beforeStateJson = JSON.stringify(current());
  const result = dispatchEngineAction({
    type: 'actionContact', actionId, player: owner,
    choice: { kind: 'disguise', cardId },
  });
  return { actionId, before, beforeSceneCount, beforeStateJson, result };
}

function sourceHooks(cardId: string): HookEvidence[] {
  return current().pendingEffects
    .filter(effect => effect.source.cardId === cardId)
    .map(effect => ({ hook: effect.triggeredBy.hook, abilityId: effect.source.abilityId }));
}

beforeEach(() => {
  resetPendingRuntimeState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  [
    fixture(OLD_FACE, { names: ['変装元'], colors: ['白'], ap: 1000, lp: 2 }),
    fixture(TARGET, { names: ['コンタクト相手'], colors: ['青'], ap: 9000, lp: 2 }),
    fixture(WHITE_PARTNER, { kind: 'partner', colors: ['白'], level: 0, lp: 5 }),
    fixture(RED_PARTNER, { kind: 'partner', colors: ['赤'], level: 0, lp: 5 }),
    fixture(WHITE_CASE, { kind: 'case', colors: ['白'], caseLevel: 7, caseTraits: [] }),
    fixture(RED_BLUE_CASE, { kind: 'case', colors: ['赤', '青'], caseLevel: 7, caseTraits: [] }),
    fixture(SET_A, { kind: 'event' }), fixture(SET_B, { kind: 'event' }),
    fixture(STACK_A), fixture(STACK_B), fixture(FILE_CARD), fixture(DECK_TOP), fixture(DECK_TAIL),
    fixture(CUTIN, { kind: 'event', abilities: [noopCutin as never] }),
    enterObserver,
  ].forEach(register);
  registerTriggeredListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide;
});

describe('official QA Wave82: a multicolor case containing white enables disguise', () => {
  it.each(WAVE82_ROWS)('$physical accepts a public disguise with the green+white D06019 case', row => {
    install(contactState({
      owner: 'self', incoming: row.physical, file: row.file, caseId: WHITE_MULTI_CASE,
    }), `${row.physical}:wave82-white-red`, 'self');

    const { result } = attemptDisguise('self', row.physical);
    // Card-bound physicals: B02038/P B02041/P B02043 B02044/P B02045 B02047.
    expect(result).toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === ACTOR_UID)?.cardId).toBe(row.physical);
    expect(current().players.self.hand).not.toContain(row.physical);
    expect(current().players.self.deck.at(-1)).toBe(OLD_FACE);
    expect(sourceHooks(row.physical)).toEqual(row.expectedHooks);
    expect(current().players.self.scene.find(card => card.cardId === ENTER_OBSERVER)
      ?.turnEffects.externalEnterObserved_turn).not.toBe(true);
  });

  it('B02045 matched control accepts a white-only case', () => {
    const row = WAVE82_ROWS.find(candidate => candidate.physical === 'B02045')!;
    install(contactState({
      owner: 'self', incoming: row.physical, file: row.file, caseId: WHITE_CASE,
    }), 'B02045:wave82-white-only-control', 'self');

    expect(attemptDisguise('self', row.physical).result).toEqual({ ok: true });
    expect(current().players.self.scene.find(card => card.uid === ACTOR_UID)?.cardId).toBe('B02045');
  });

  it.each(['B02041', 'B02041P'])('%s can disguise with a non-white partner but does not fire its rider', physical => {
    const row = WAVE82_ROWS.find(candidate => candidate.physical === physical)!;
    const state = contactState({
      owner: 'self', incoming: row.physical, file: row.file, caseId: WHITE_MULTI_CASE,
    });
    state.players.self.partner = { cardId: RED_PARTNER, state: 'active', location: 'partner-area' };
    install(state, `${physical}:wave82-nonwhite-partner`, 'self');

    expect(attemptDisguise('self', physical).result).toEqual({ ok: true });
    expect(sourceHooks(physical)).toEqual([]);
    expect(current().players.self.scene.find(card => card.uid === ACTOR_UID)?.cardId).toBe(physical);
  });

  it.each(WAVE82_ROWS)('$physical rejects a red+blue case atomically', row => {
    install(contactState({
      owner: 'self', incoming: row.physical, file: row.file, caseId: RED_BLUE_CASE,
    }), `${row.physical}:wave82-nonwhite`, 'self');

    const { beforeStateJson, result } = attemptDisguise('self', row.physical);
    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(beforeStateJson);
  });

  it.each(WAVE82_ROWS)('$physical rejects FILE one below its threshold atomically', row => {
    install(contactState({
      owner: 'self', incoming: row.physical, file: row.file - 1, caseId: WHITE_MULTI_CASE,
    }), `${row.physical}:wave82-file-negative`, 'self');

    const { beforeStateJson, result } = attemptDisguise('self', row.physical);
    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(beforeStateJson);
  });

  it.each(WAVE82_ROWS.filter(row => !row.physical.endsWith('P')))(
    '$physical evaluates the opponent owner case, not the human side case',
    row => {
      install(contactState({
        owner: 'opp', incoming: row.physical, file: row.file, caseId: WHITE_MULTI_CASE,
      }), `${row.physical}:wave82-owner-opp`, 'opp');

      expect(attemptDisguise('opp', row.physical).result).toEqual({ ok: true });
      expect(current().players.opp.scene.find(card => card.uid === ACTOR_UID)?.cardId).toBe(row.physical);
      expect(current().players.opp.deck.at(-1)).toBe(OLD_FACE);
      expect(current().players.self.scene[0]?.cardId).toBe(TARGET);
    },
  );
});

describe('official QA Wave83: public disguise preserves the replacement contract', () => {
  it.each(WAVE83_ROWS)('$physical swaps publicly and preserves state, effects, and attached cards', row => {
    install(contactState({
      owner: 'self', incoming: row.incoming, oldFace: row.oldFace,
      file: row.file, caseId: row.caseId,
    }), `${row.physical}:wave83-contract`, 'self');

    const { actionId, before, beforeSceneCount, result } = attemptDisguise('self', row.incoming);
    expect(result).toEqual({ ok: true });
    const disguised = current().players.self.scene.find(card => card.uid === ACTOR_UID)!;
    // Card-bound physicals: B03050 B03051 B03052/P B03129/P.
    expect(disguised.cardId).toBe(row.incoming);
    expect(current().players.self.scene).toHaveLength(beforeSceneCount);
    expect(disguised.uid).toBe(before.uid);
    expect(disguised.state).toBe(before.state);
    expect(disguised.isNamed).toBe(before.isNamed);
    expect(disguised.setCards).toEqual(before.setCards);
    expect(disguised.stackedCards).toEqual(before.stackedCards);
    expect(disguised.keywordOverrides).toEqual(before.keywordOverrides);
    expect(disguised.apOverride).toBe(before.apOverride);
    expect(disguised.lpOverride).toBe(before.lpOverride);
    expect(disguised.turnEffects).toEqual(before.turnEffects);
    expect(readDef.card(row.incoming)?.names).toEqual(row.incomingNames);
    expect(readDef.card(row.incoming)?.colors).toEqual(row.incomingColors);
    expect(readChar.names(current(), ACTOR_UID)).toEqual(['継承名']);
    expect(readChar.colors(current(), ACTOR_UID)).toEqual(row.incomingColors);
    expect(current().players.self.hand).not.toContain(row.incoming);
    expect(current().players.self.deck.at(-1)).toBe(row.oldFace);
    expect(current().players.self.remove).not.toEqual(
      expect.arrayContaining([row.oldFace, SET_A, SET_B, STACK_A, STACK_B]),
    );
    expect(sourceHooks(row.incoming)).toEqual(row.incomingHooks);
    const context = flow.action._getContext(current(), actionId);
    expect([context?.firstUid, context?.secondUid]).toContain(ACTOR_UID);
    expect(current().pendingEffects.some(effect => effect.triggeredBy.hook === 'enter')).toBe(false);
    expect(current().players.self.scene.find(card => card.cardId === ENTER_OBSERVER)
      ?.turnEffects.externalEnterObserved_turn).not.toBe(true);
  });

  it.each(WAVE83_ROWS.filter(row => !row.physical.endsWith('P')))(
    '$physical preserves the same swap contract for owner=opp',
    row => {
      install(contactState({
        owner: 'opp', incoming: row.incoming, oldFace: row.oldFace,
        file: row.file, caseId: row.caseId,
      }), `${row.physical}:wave83-owner-opp`, 'opp');

      const { before, result } = attemptDisguise('opp', row.incoming);
      expect(result).toEqual({ ok: true });
      const disguised = current().players.opp.scene.find(card => card.uid === ACTOR_UID)!;
      expect(disguised.cardId).toBe(row.incoming);
      expect(disguised.setCards).toEqual(before.setCards);
      expect(disguised.turnEffects).toEqual(before.turnEffects);
      expect(current().players.opp.deck.at(-1)).toBe(row.oldFace);
      expect(current().players.self.scene[0]?.cardId).toBe(TARGET);
    },
  );

  it.each([
    { physical: 'B03050', file: 4, caseId: WHITE_CASE },
    { physical: 'B03051', file: 5, caseId: WHITE_CASE },
    { physical: 'B03129', file: 5, caseId: RED_BLUE_CASE },
  ])('$physical rejects a public disguise below its FILE threshold atomically', row => {
    install(contactState({
      owner: 'self', incoming: row.physical, file: row.file, caseId: row.caseId,
    }), `${row.physical}:wave83-file-negative`, 'self');

    const { beforeStateJson, result } = attemptDisguise('self', row.physical);
    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(beforeStateJson);
  });

  it.each(['B03052', 'B03052P'])('%s cannot be used as a disguise source', physical => {
    install(contactState({
      owner: 'self', incoming: physical, oldFace: OLD_FACE, file: 8, caseId: WHITE_CASE,
    }), `${physical}:wave83-not-disguise-source`, 'self');

    const { beforeStateJson, result } = attemptDisguise('self', physical);
    expect(result).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current())).toBe(beforeStateJson);
  });

  it('B03129 shares one public contact opportunity with cut-in in either order', () => {
    const cutinFirst = contactState({
      owner: 'self', incoming: 'B03129', file: 6, caseId: RED_BLUE_CASE,
    });
    cutinFirst.players.self.hand.push(CUTIN);
    install(cutinFirst, 'B03129:wave83-cutin-first', 'self');
    const actionId = reachOwnerWindow('self');
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'self', choice: { kind: 'cutin', cardId: CUTIN },
    })).toEqual({ ok: true });
    expect(dispatchEngineAction({
      type: 'actionContact', actionId, player: 'self', choice: { kind: 'disguise', cardId: 'B03129' },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current().players.self.hand).toContain('B03129');
    expect(current().players.self.scene.find(card => card.uid === ACTOR_UID)?.cardId).toBe(OLD_FACE);

    const disguiseFirst = contactState({
      owner: 'self', incoming: 'B03129', file: 6, caseId: RED_BLUE_CASE,
    });
    disguiseFirst.players.self.hand.push(CUTIN);
    install(disguiseFirst, 'B03129:wave83-disguise-first', 'self');
    const reverseActionId = reachOwnerWindow('self');
    expect(dispatchEngineAction({
      type: 'actionContact', actionId: reverseActionId, player: 'self',
      choice: { kind: 'disguise', cardId: 'B03129' },
    })).toEqual({ ok: true });
    expect(dispatchEngineAction({
      type: 'actionContact', actionId: reverseActionId, player: 'self',
      choice: { kind: 'cutin', cardId: CUTIN },
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(current().players.self.hand).toContain(CUTIN);
    expect(current().players.self.scene.find(card => card.uid === ACTOR_UID)?.cardId).toBe('B03129');
  });

  it('B03052P replacement state survives save hydration', () => {
    const row = WAVE83_ROWS.find(candidate => candidate.physical === 'B03052P')!;
    install(contactState({
      owner: 'self', incoming: row.incoming, oldFace: row.oldFace,
      file: row.file, caseId: row.caseId,
    }), 'B03052P:wave83-save', 'self');

    expect(attemptDisguise('self', row.incoming).result).toEqual({ ok: true });
    const saved = JSON.parse(JSON.stringify(current())) as GameState;
    expect(useGameStateStore.getState().setGameState(null)).toBe(true);
    expect(useGameStateStore.getState().setGameState(saved)).toBe(true);
    expect(current().players.self.scene.find(card => card.uid === ACTOR_UID)?.cardId).toBe('B03129');
    expect(current().players.self.scene.find(card => card.uid === ACTOR_UID)?.setCards).toHaveLength(2);
    expect(current().players.self.deck.at(-1)).toBe('B03052P');
    expect(readDef.card('B03129')?.names).toEqual(['ベルモット']);
    expect(readChar.names(current(), ACTOR_UID)).toEqual(['継承名']);
  });
});
