// qa: card:B07093:212da49cce2aca6921fdb352e94b610cbdeeebd02d0ab5c66e8200c0164c3a0e
// qa: card:B07093:d3f368d5baca2d075770eacd3703dd420726b14f2957c03c2f001e21b37e73f9
// qa: card:B07093:7b6adc85165927a9ffcabeeb29496cd3029d2be83a247dd80556d7f351a8a2d3
// qa: card:B07093:636d66e72f92b3a3945a9d5e3618003348be0080c29c488fa2626a46dd44a131
// qa: card:B07093:6300260a5146582a98ccc4157ad67f0dfb8fc9b9805795efc6070527d5ff9520
// Rules: 03-field-areas, 05-turn-phases, 13-keywords, 15-abilities-effects,
// 17-icons, 20-color-and-switch, 21-declared-ability-cost, 23-qa-disguise-cutin.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves, type Move } from '@/ai/move-enumerator';
import type { AIPolicy } from '@/ai/policy';
import {
  recordMatch,
  replayLog,
  ScriptedPolicy,
  type ReplayLogV1,
  type ReplayLogV2,
} from '@/ai/replay';
import { registerAll } from '@/cards';
import { B07093 } from '@/cards/ct-p07/B07093';
import { B07093P } from '@/cards/ct-p07/B07093P';
import { declaredAbilityUseCountKey } from '@/engine/effect/source-identity';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow/index.js';
import { findDeclaredAbilityOccurrences } from '@/engine/flow/main/declared-ability';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { produce } from '@/engine/produce';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import {
  bindPendingDecision,
  dispatchEngineAction,
  surfacePendingSideChannels,
} from '@/ui/hooks/useEngineDispatch';
import { enumDeclaredAbilityChoicesFor } from '@/ui/hooks/useActionsPanelFlow/enumerators';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const BLACK_PARTNER = 'W44_BLACK_PARTNER';
const RED_PARTNER = 'W44_RED_PARTNER';
const HAND_ENTRY = 'W44_HAND_ENTRY';
const REMOVE_ENTRY = 'W44_REMOVE_ENTRY';
const LEVEL_DECOY = 'W44_LEVEL_DECOY';
const TRAIT_DECOY = 'W44_TRAIT_DECOY';
const EVENT_DECOY = 'W44_EVENT_DECOY';
const DISGUISE_FACE = 'W44_DISGUISE_FACE';
const DRAW_SENTINEL = 'W44_DRAW_SENTINEL';
const DECK_FILLER = 'W44_DECK_FILLER';
const LEVEL_TARGET = 'W44_LEVEL_TARGET';
const REMOVER = 'W44_REMOVER';
const SOURCE_UID = 'source';

type Store = ReturnType<typeof useGameStateStore.getState>;
type PendingChoice = NonNullable<Store['pendingEffectChoice']>;
type PendingPick = NonNullable<Store['pendingEffectPick']>;

function card(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['黒'],
    level: 4,
    ap: 3000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...options,
  } as CardDef;
}

const enterDraw: AbilityDef = {
  id: 'enter-draw',
  type: 'triggered',
  scope: 'on-scene',
  trigger: { hook: 'enter', selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: '【登場時】カードを1枚引く。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/17-icons.md'],
};

const disguiseAbility: AbilityDef = {
  id: 'disguise',
  type: 'icon-disguise',
  description: '【変装】',
  ruleRefs: ['rules/09-cutin-disguise.md', 'rules/23-qa-disguise-cutin.md'],
};

const removeAbility: AbilityDef = {
  id: 'remove',
  type: 'declared',
  scope: 'on-scene',
  effect: {
    kind: 'atom',
    verb: 'sceneRemove',
    args: { player: 'self', max: 1, side: 'self', cause: 'effect' },
  },
  description: '【宣言】自分のキャラを1枚までリムーブする。',
  ruleRefs: ['rules/15-abilities-effects.md', 'rules/21-declared-ability-cost.md'],
};

const fixtures = [
  card(BLACK_PARTNER, { kind: 'partner', level: 0, lp: 5, colors: ['黒'] }),
  card(RED_PARTNER, { kind: 'partner', level: 0, lp: 5, colors: ['赤'] }),
  card(HAND_ENTRY, { traits: ['黒ずくめの組織'], abilities: [enterDraw] }),
  card(REMOVE_ENTRY, { traits: ['黒ずくめの組織'], abilities: [enterDraw] }),
  card(LEVEL_DECOY, { level: 5, traits: ['黒ずくめの組織'] }),
  card(TRAIT_DECOY, { level: 4, traits: ['警察'] }),
  card(EVENT_DECOY, { kind: 'event', level: 4, traits: ['黒ずくめの組織'] }),
  card(DISGUISE_FACE, { ap: 3000, abilities: [disguiseAbility] }),
  card(REMOVER, { abilities: [removeAbility] }),
  card(DRAW_SENTINEL),
  card(DECK_FILLER),
  card(LEVEL_TARGET, { level: 8, ap: 5000, lp: 2, colors: ['青'] }),
  card('W44_FILLER_1'),
  card('W44_FILLER_2'),
  card('W44_FILLER_3'),
  card('W44_FILLER_4'),
];

function cardBacks(count: number) {
  return Array.from({ length: count }, (_value, index) => ({
    type: 'card-back' as const,
    cardId: `W44_FILE_${index}`,
  }));
}

function prepared(
  sourceCardId: typeof B07093.id | typeof B07093P.id = B07093.id,
  fileBeforeAssist = 6,
  partnerCardId = BLACK_PARTNER,
): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.partner = { cardId: partnerCardId, state: 'active', location: 'partner-area' };
  state.players.self.file = cardBacks(fileBeforeAssist);
  state.players.self.scene = [sceneChar(sourceCardId, SOURCE_UID)];
  state.players.self.hand = [HAND_ENTRY, LEVEL_DECOY, TRAIT_DECOY, EVENT_DECOY];
  state.players.self.remove = [REMOVE_ENTRY, LEVEL_DECOY, TRAIT_DECOY, EVENT_DECOY];
  state.players.self.deck = [DRAW_SENTINEL, DECK_FILLER];
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave44 state');
  return state;
}

function pendingChoice(cardId: string): PendingChoice {
  surfacePendingSideChannels();
  const choice = useGameStateStore.getState().pendingEffectChoice;
  expect(choice?.source).toMatchObject({
    cardId,
    uid: SOURCE_UID,
    abilityId: 'a1',
    abilityOrigin: 'printed',
    abilityIndex: 2,
  });
  return choice!;
}

function pendingPick(cardId: string): PendingPick {
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.source).toMatchObject({
    cardId,
    uid: SOURCE_UID,
    abilityId: 'a1',
    abilityOrigin: 'printed',
    abilityIndex: 2,
  });
  expect(pick?.atomVerb).toBe('sceneEnter');
  return pick!;
}

function declareA1(cardId: string): void {
  expect(dispatchEngineAction({
    type: 'declaredAbility',
    uid: SOURCE_UID,
    abilId: 'a1',
    abilityOrigin: 'printed',
    abilityIndex: 2,
  }), `${cardId}: a1 declaration`).toEqual({ ok: true });
}

function chooseSource(cardId: string, choiceIndex: 0 | 1): PendingPick {
  declareA1(cardId);
  const choice = pendingChoice(cardId);
  expect(choice.options).toHaveLength(2);
  expect(dispatchEngineAction(bindPendingDecision(choice, {
    type: 'choiceResolve',
    choiceIndex,
  }))).toEqual({ ok: true });
  return pendingPick(cardId);
}

function assistAndChoose(cardId: string, choiceIndex: 0 | 1): PendingPick {
  expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: true });
  return chooseSource(cardId, choiceIndex);
}

function resolvePick(pick: PendingPick, pickedUid: string | null, switchRemoveUid?: string): void {
  const action = switchRemoveUid
    ? { type: 'effectPickResolve' as const, pickedUid, switchRemoveUid }
    : { type: 'effectPickResolve' as const, pickedUid };
  expect(dispatchEngineAction(bindPendingDecision(pick, action))).toEqual({ ok: true });
  surfacePendingSideChannels();
}

function candidateUid(pick: PendingPick, cardId: string): string {
  const uid = pick.candidates.find((candidate) => candidate.cardId === cardId)?.uid;
  expect(uid, `${cardId}: candidate uid`).toBeTruthy();
  return uid!;
}

function expectSettled(): void {
  const store = useGameStateStore.getState();
  expect(store.pendingEffectChoice).toBeNull();
  expect(store.pendingEffectPick).toBeNull();
  expect(store.pendingEffectOptional).toBeNull();
  expect(store.activeActionId).toBeNull();
  expect(current().pendingRuntimeState).toBeUndefined();
  expect(current().pendingEffects.every((entry) => entry.state === 'resolved')).toBe(true);
}

function ownerOf(uid: string): Player {
  return current().players.self.scene.some((character) => character.uid === uid) ? 'self' : 'opp';
}

function drivePublicDisguise(actionId: string, actorUid: string): void {
  let used = false;
  for (let step = 0; step < 18; step += 1) {
    const context = flow.action._getContext(current(), actionId);
    if (!context) {
      expect(used, `${B07093.id}: public disguise used`).toBe(true);
      return;
    }
    if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
      const actingUid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
      const player = ownerOf(actingUid!);
      const useDisguise = !used && player === 'self' && actingUid === actorUid;
      expect(dispatchEngineAction({
        type: 'actionContact',
        actionId,
        player,
        choice: useDisguise
          ? { kind: 'disguise', cardId: DISGUISE_FACE }
          : { kind: 'pass' },
      })).toEqual({ ok: true });
      if (useDisguise) used = true;
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    if (context.phase === 'judge') {
      expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error(`${B07093.id}: public disguise contact did not finish`);
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetPendingRuntimeState();
  registerAll();
  fixtures.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.getState().setGameState(null);
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA Wave44: B07093 first declared ability', () => {
  it.each([
    { card: B07093, label: 'base' },
    { card: B07093P, label: 'parallel' },
  ])('$label keeps old occurrence indices and exposes a1 as printed index 2', ({ card: source }) => {
    expect(source.abilities.map((ability) => ability.id)).toEqual(['a2', 'a3', 'a1']);
    const state = prepared(source.id);
    install(state, `qa-wave44-index-${source.id}`);
    expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: true });

    expect(findDeclaredAbilityOccurrences(current(), SOURCE_UID, source.id, 'scene', 'a2')
      .map(({ origin, abilityIndex }) => ({ origin, abilityIndex })))
      .toEqual([{ origin: 'printed', abilityIndex: 0 }]);
    expect(findDeclaredAbilityOccurrences(current(), SOURCE_UID, source.id, 'scene', 'a1')
      .map(({ origin, abilityIndex }) => ({ origin, abilityIndex })))
      .toEqual([{ origin: 'printed', abilityIndex: 2 }]);

    const uiChoices = enumDeclaredAbilityChoicesFor(current(), SOURCE_UID)
      .map(({ abilId, abilityOrigin, abilityIndex }) => ({ abilId, abilityOrigin, abilityIndex }));
    expect(uiChoices).toEqual([
      { abilId: 'a2', abilityOrigin: 'printed', abilityIndex: 0 },
      { abilId: 'a1', abilityOrigin: 'printed', abilityIndex: 2 },
    ]);
    const aiMoves = enumerateMoves(current(), 'self').filter(
      (move): move is Extract<Move, { kind: 'declaredAbility' }> => (
        move.kind === 'declaredAbility' && move.uid === SOURCE_UID
      ),
    );
    expect(aiMoves).toEqual([
      { kind: 'declaredAbility', uid: SOURCE_UID, abilityId: 'a2', abilityOrigin: 'printed', abilityIndex: 0 },
      { kind: 'declaredAbility', uid: SOURCE_UID, abilityId: 'a1', abilityOrigin: 'printed', abilityIndex: 2 },
    ]);

    const exactA2 = aiMoves[0]!;
    const legacyA2: Move = { kind: 'declaredAbility', uid: SOURCE_UID, abilityId: 'a2' };
    expect(new ScriptedPolicy('legacy-v1-v2', [legacyA2]).choose(current(), [exactA2], 'self')).toEqual(exactA2);
    expect(new ScriptedPolicy('exact-v2', [exactA2]).choose(current(), [exactA2], 'self')).toEqual(exactA2);
  });

  it.each([
    { label: 'assisted FILE6', slug: 'file6', fileBefore: 5, partner: BLACK_PARTNER },
    { label: 'non-black partner at FILE7', slug: 'wrong-partner', fileBefore: 6, partner: RED_PARTNER },
  ])('rejects $label without state or decision drift', ({ slug, fileBefore, partner }) => {
    install(prepared(B07093.id, fileBefore, partner), `qa-wave44-reject-${slug}`);
    expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: true });
    const before = JSON.stringify(current().players.self);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: SOURCE_UID, abilId: 'a1',
      abilityOrigin: 'printed', abilityIndex: 2,
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(JSON.stringify(current().players.self)).toBe(before);
    expect(useGameStateStore.getState().pendingEffectChoice).toBeNull();
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it.each([
    { source: B07093, branch: 'hand', choiceIndex: 0 as const, entryId: HAND_ENTRY },
    { source: B07093, branch: 'remove', choiceIndex: 1 as const, entryId: REMOVE_ENTRY },
    { source: B07093P, branch: 'hand', choiceIndex: 0 as const, entryId: HAND_ENTRY },
    { source: B07093P, branch: 'remove', choiceIndex: 1 as const, entryId: REMOVE_ENTRY },
  ])('$source.id $branch branch filters, enters, binds all grants, and consumes turn1', ({ source, choiceIndex, entryId }) => {
    install(prepared(source.id), `qa-wave44-branch-${source.id}-${choiceIndex}`);
    const pick = assistAndChoose(source.id, choiceIndex);
    expect(pick.candidates.map((candidate) => candidate.cardId)).toEqual([entryId]);
    expect(pick.candidates.map((candidate) => candidate.cardId)).not.toContain(LEVEL_DECOY);
    expect(pick.candidates.map((candidate) => candidate.cardId)).not.toContain(TRAIT_DECOY);
    expect(pick.candidates.map((candidate) => candidate.cardId)).not.toContain(EVENT_DECOY);
    resolvePick(pick, candidateUid(pick, entryId));

    const after = current();
    const entered = after.players.self.scene.find((character) => character.cardId === entryId)!;
    expect(entered).toBeTruthy();
    expect(readChar.ap(after, entered.uid)).toBe(7000);
    expect(readChar.hasKeyword(after, entered.uid, '突撃')).toBe(true);
    expect(entered.turnEffects.toDeckBottomOnTurnEnd).toBe(true);
    if (choiceIndex === 0) expect(after.players.self.hand).not.toContain(entryId);
    else expect(after.players.self.remove).not.toContain(entryId);
    expect(readChar.declaredUseCount(after, SOURCE_UID, 'a1', {
      abilityOrigin: 'printed', abilityIndex: 2,
    })).toBe(1);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: SOURCE_UID, abilId: 'a1',
      abilityOrigin: 'printed', abilityIndex: 2,
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expectSettled();
  });

  it.each([
    { branch: 'hand', choiceIndex: 0 as const },
    { branch: 'remove', choiceIndex: 1 as const },
  ])('$branch branch permits zero and applies no rider to another character', ({ branch, choiceIndex }) => {
    install(prepared(B07093.id), `qa-wave44-zero-${branch}`);
    expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: true });
    const handBefore = [...current().players.self.hand];
    const removeBefore = [...current().players.self.remove];
    const pick = chooseSource(B07093.id, choiceIndex);
    expect(pick.nMin).toBe(0);
    resolvePick(pick, null);

    const after = current();
    expect(after.players.self.hand).toEqual(handBefore);
    expect(after.players.self.remove).toEqual(removeBefore);
    expect(after.players.self.scene).toHaveLength(1);
    expect(readChar.ap(after, SOURCE_UID)).toBe(B07093.ap);
    expect(readChar.hasKeyword(after, SOURCE_UID, '突撃')).toBe(false);
    expect(after.players.self.scene[0]?.turnEffects.toDeckBottomOnTurnEnd).not.toBe(true);
    expect(readChar.declaredUseCount(after, SOURCE_UID, 'a1', {
      abilityOrigin: 'printed', abilityIndex: 2,
    })).toBe(1);
    expectSettled();
  });

  it('allows full-scene switch of B07093 itself, fires enter, then moves the entered card to exact deck bottom', () => {
    const state = prepared(B07093.id);
    state.players.self.scene.push(
      sceneChar('W44_FILLER_1', 'full-1'),
      sceneChar('W44_FILLER_2', 'full-2'),
      sceneChar('W44_FILLER_3', 'full-3'),
      sceneChar('W44_FILLER_4', 'full-4'),
    );
    install(state, 'qa-wave44-full-scene-enter-bottom');
    const pick = assistAndChoose(B07093.id, 0);
    resolvePick(pick, candidateUid(pick, HAND_ENTRY), SOURCE_UID);

    const afterEntry = current();
    expect(afterEntry.players.self.scene).toHaveLength(5);
    expect(afterEntry.players.self.scene.some((character) => character.uid === SOURCE_UID)).toBe(false);
    expect(afterEntry.players.self.remove).toContain(B07093.id);
    const entered = afterEntry.players.self.scene.find((character) => character.cardId === HAND_ENTRY)!;
    expect(entered).toBeTruthy();
    expect(afterEntry.players.self.hand).toContain(DRAW_SENTINEL);
    expect(readChar.ap(afterEntry, entered.uid)).toBe(7000);
    expect(readChar.hasKeyword(afterEntry, entered.uid, '突撃')).toBe(true);
    expect(entered.turnEffects.toDeckBottomOnTurnEnd).toBe(true);

    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    const afterTurn = current();
    expect(afterTurn.players.self.scene.some((character) => character.uid === entered.uid)).toBe(false);
    expect(afterTurn.players.self.deck).toEqual([DECK_FILLER, HAND_ENTRY]);
    expect(afterTurn.players.self.remove).not.toContain(HAND_ENTRY);
    expectSettled();
  });

  it.each(['disguise', 'leave-early'] as const)(
    '%s preserves or clears the turn-end rider by physical-character lifetime',
    (mode) => {
      install(prepared(B07093.id), `qa-wave44-${mode}`);
      const pick = assistAndChoose(B07093.id, 0);
      resolvePick(pick, candidateUid(pick, HAND_ENTRY));
      const entered = current().players.self.scene.find((character) => character.cardId === HAND_ENTRY)!;
      expect(entered).toBeTruthy();

      const changed = produce(current(), (draft) => {
        if (mode === 'disguise') mutate.char.disguiseInto(draft, entered.uid, DISGUISE_FACE);
        else mutate.scene.removeToRemove(draft, entered.uid, 'effect');
      });
      expect(useGameStateStore.getState().setGameState(changed)).toBe(true);

      if (mode === 'disguise') {
        const disguised = current().players.self.scene.find((character) => character.uid === entered.uid)!;
        expect(disguised.cardId).toBe(DISGUISE_FACE);
        expect(readChar.ap(current(), entered.uid)).toBe(7000);
        expect(readChar.hasKeyword(current(), entered.uid, '突撃')).toBe(true);
        expect(disguised.turnEffects.toDeckBottomOnTurnEnd, `${B07093.id}: disguise rider`).toBe(true);
      } else {
        expect(current().players.self.scene.some((character) => character.uid === entered.uid)).toBe(false);
        expect(current().players.self.remove).toContain(HAND_ENTRY);
      }

      expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
      if (mode === 'disguise') {
        expect(current().players.self.deck.at(-1), `${B07093.id}: disguise deck bottom`).toBe(DISGUISE_FACE);
        expect(current().players.self.remove).not.toContain(DISGUISE_FACE);
      } else {
        expect(current().players.self.deck).not.toContain(HAND_ENTRY);
        expect(current().players.self.remove).toContain(HAND_ENTRY);
      }
    },
  );

  it.each([
    {
      label: 'exact old occurrence count',
      slug: 'exact-count',
      counts: { [declaredAbilityUseCountKey('a2', { abilityOrigin: 'printed', abilityIndex: 0 })]: 1 },
    },
    { label: 'legacy pre-Wave35 a2 count', slug: 'legacy-count', counts: { a2: 1 } },
  ])('preserves $label through JSON while keeping new a1 independent', ({ slug, counts }) => {
    const state = prepared(B07093.id);
    state.players.self.scene[0]!.declaredUseCount = counts;
    install(JSON.parse(JSON.stringify(state)) as GameState, `qa-wave44-count-${slug}`);
    expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: true });

    expect(readChar.declaredUseCount(current(), SOURCE_UID, 'a2', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(1);
    expect(enumDeclaredAbilityChoicesFor(current(), SOURCE_UID)
      .map(({ abilId, abilityIndex }) => ({ abilId, abilityIndex })))
      .toEqual([{ abilId: 'a1', abilityIndex: 2 }]);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: SOURCE_UID, abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: false, reason: 'not-allowed' });

    const pick = chooseSource(B07093.id, 0);
    resolvePick(pick, null);
    expect(readChar.declaredUseCount(current(), SOURCE_UID, 'a1', {
      abilityOrigin: 'printed', abilityIndex: 2,
    })).toBe(1);
    expectSettled();
  });

  it('keeps a1 scene-only while the existing a2 remains usable from the partner-area MR slot', () => {
    const state = prepared(B07093.id);
    state.players.self.scene = [];
    state.players.self.partnerAreaMR = {
      cardId: B07093.id,
      uid: 'partnerMR:self',
      state: 'active',
      declaredUseCount: {},
    } as GameState['players']['self']['partnerAreaMR'];
    install(state, 'qa-wave44-partner-area-scope');
    expect(dispatchEngineAction({ type: 'assist', player: 'self' })).toEqual({ ok: true });
    expect(enumDeclaredAbilityChoicesFor(current(), 'partnerMR:self')
      .map(({ abilId, abilityIndex }) => ({ abilId, abilityIndex })))
      .toEqual([{ abilId: 'a2', abilityIndex: 0 }]);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'partnerMR:self', abilId: 'a1',
      abilityOrigin: 'printed', abilityIndex: 2,
    })).toEqual({ ok: false, reason: 'not-allowed' });
  });

  it('public a2 level reduction changes only effective level and its later references', () => {
    const state = prepared(B07093.id);
    state.players.opp.scene = [sceneChar(LEVEL_TARGET, 'level-target')];
    install(state, 'qa-wave44-existing-a2-level');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: SOURCE_UID, abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick!;
    expect(pick.source).toMatchObject({
      cardId: B07093.id, abilityId: 'a2', abilityOrigin: 'printed', abilityIndex: 0,
    });
    expect(pick.candidates.map((candidate) => candidate.uid)).toEqual(['level-target']);
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid: 'level-target',
    }))).toEqual({ ok: true });

    const target = current().players.opp.scene[0]!;
    expect(readChar.level(current(), target.uid)).toBe(7);
    expect(readChar.ap(current(), target.uid)).toBe(5000);
    expect(readChar.lp(current(), target.uid)).toBe(2);
    expect(target.state).toBe('active');
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: SOURCE_UID, abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expectSettled();
  });

  it('replayLog completes exact and witness-free B07093 a2 moves in V1 and V2', () => {
    const state = createEmptyGameState();
    state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar(B07093.id, SOURCE_UID)];
    state.players.opp.scene = [sceneChar(LEVEL_TARGET, 'level-target')];
    state.players.self.deck = Array.from({ length: 10 }, () => DECK_FILLER);
    state.players.opp.deck = Array.from({ length: 10 }, () => DECK_FILLER);
    (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;

    let usedA2 = false;
    const selfPolicy: AIPolicy = {
      name: 'wave44-a2-then-end',
      choose(_state, candidates) {
        const a2 = candidates.find((move) => move.kind === 'declaredAbility'
          && move.uid === SOURCE_UID && move.abilityId === 'a2');
        if (!usedA2 && a2) {
          usedA2 = true;
          return a2;
        }
        return candidates.find((move) => move.kind === 'endTurn') ?? null;
      },
    };
    const endPolicy: AIPolicy = {
      name: 'wave44-end',
      choose(_state, candidates) {
        return candidates.find((move) => move.kind === 'endTurn') ?? null;
      },
    };
    const { result, log } = recordMatch({
      selfPolicy,
      oppPolicy: endPolicy,
      initialState: state,
      maxTurns: 6,
    });
    const exactMove = log.moves.find((entry) => entry.move.kind === 'declaredAbility'
      && entry.move.uid === SOURCE_UID && entry.move.abilityId === 'a2');
    expect(exactMove?.move, `${B07093.id}: recorded exact a2`).toMatchObject({
      abilityOrigin: 'printed', abilityIndex: 0,
    });

    const legacyMoves = log.moves.map((entry) => {
      if (entry.move.kind !== 'declaredAbility'
        || entry.move.uid !== SOURCE_UID || entry.move.abilityId !== 'a2') return entry;
      return {
        ...entry,
        move: { kind: 'declaredAbility' as const, uid: SOURCE_UID, abilityId: 'a2' },
      };
    });
    const exactV1: ReplayLogV1 = {
      schemaVersion: 1,
      initialState: structuredClone(log.initialState),
      moves: structuredClone(log.moves),
      result: structuredClone(log.result),
    };
    const legacyV1: ReplayLogV1 = { ...exactV1, moves: structuredClone(legacyMoves) };
    const exactV2: ReplayLogV2 = structuredClone(log);
    const legacyV2: ReplayLogV2 = { ...structuredClone(log), moves: structuredClone(legacyMoves) };

    for (const candidate of [exactV1, legacyV1, exactV2, legacyV2]) {
      resetPendingRuntimeState();
      expect(replayLog(candidate), `${B07093.id}: replay schema ${candidate.schemaVersion}`).toMatchObject({
        winner: result.winner,
        reason: result.reason,
        turns: result.turns,
      });
    }
  });

  it('dispatches existing a2 from partner-area MR index 0 while rejecting scene-only a1 index 2', () => {
    const state = prepared(B07093.id);
    state.players.self.scene = [];
    state.players.self.partnerAreaMR = {
      cardId: B07093.id,
      uid: 'partnerMR:self',
      state: 'active',
      declaredUseCount: {},
    } as GameState['players']['self']['partnerAreaMR'];
    state.players.opp.scene = [sceneChar(LEVEL_TARGET, 'pa-target')];
    install(state, 'qa-wave44-pa-a2-dispatch');

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'partnerMR:self', abilId: 'a1',
      abilityOrigin: 'printed', abilityIndex: 2,
    })).toEqual({ ok: false, reason: 'not-allowed' });
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'partnerMR:self', abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const pick = useGameStateStore.getState().pendingEffectPick!;
    expect(pick.source, `${B07093.id}: PA a2 source`).toMatchObject({
      cardId: B07093.id, abilityId: 'a2', abilityOrigin: 'printed', abilityIndex: 0,
    });
    expect(dispatchEngineAction(bindPendingDecision(pick, {
      type: 'effectPickResolve', pickedUid: 'pa-target',
    }))).toEqual({ ok: true });
    expect(readChar.level(current(), 'pa-target')).toBe(7);
    expect(readChar.declaredUseCount(current(), 'partnerMR:self', 'a2', {
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toBe(1);
    expectSettled();
  });

  it('public contact disguise inherits every a1 grant and the current face reaches deck bottom', () => {
    install(prepared(B07093.id), 'qa-wave44-public-disguise');
    const pick = assistAndChoose(B07093.id, 0);
    resolvePick(pick, candidateUid(pick, HAND_ENTRY));
    const entered = current().players.self.scene.find((character) => character.cardId === HAND_ENTRY)!;
    const contactState = produce(current(), (draft) => {
      draft.players.self.hand.push(DISGUISE_FACE);
      draft.players.opp.scene = [sceneChar(LEVEL_TARGET, 'disguise-target', { state: 'sleep' })];
    });
    expect(useGameStateStore.getState().setGameState(contactState)).toBe(true);
    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: entered.uid, targetUid: 'disguise-target',
    })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId!;
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
    drivePublicDisguise(actionId, entered.uid);

    const disguised = current().players.self.scene.find((character) => character.uid === entered.uid)!;
    expect(disguised.cardId, `${B07093.id}: public disguise face`).toBe(DISGUISE_FACE);
    expect(current().players.self.deck, `${B07093.id}: old face to bottom`).toContain(HAND_ENTRY);
    expect(readChar.ap(current(), entered.uid)).toBe(7000);
    expect(readChar.hasKeyword(current(), entered.uid, '突撃')).toBe(true);
    expect(disguised.turnEffects.toDeckBottomOnTurnEnd).toBe(true);
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(current().players.self.deck.at(-1), `${B07093.id}: current face to exact bottom`).toBe(DISGUISE_FACE);
  });

  it('public declared removal clears the entered character rider before end turn', () => {
    install(prepared(B07093.id), 'qa-wave44-public-early-leave');
    const pick = assistAndChoose(B07093.id, 0);
    resolvePick(pick, candidateUid(pick, HAND_ENTRY));
    const entered = current().players.self.scene.find((character) => character.cardId === HAND_ENTRY)!;
    const removalState = produce(current(), (draft) => {
      draft.players.self.scene.push(sceneChar(REMOVER, 'remover'));
    });
    expect(useGameStateStore.getState().setGameState(removalState)).toBe(true);
    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: 'remover', abilId: 'remove',
      abilityOrigin: 'printed', abilityIndex: 0,
    })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const removalPick = useGameStateStore.getState().pendingEffectPick!;
    expect(removalPick.candidates.map((candidate) => candidate.uid)).toContain(entered.uid);
    expect(dispatchEngineAction(bindPendingDecision(removalPick, {
      type: 'effectPickResolve', pickedUid: entered.uid,
    }))).toEqual({ ok: true });
    expect(current().players.self.remove, `${B07093.id}: public early leave`).toContain(HAND_ENTRY);
    expect(dispatchEngineAction({ type: 'endTurn', player: 'self' })).toEqual({ ok: true });
    expect(current().players.self.deck, `${B07093.id}: no stale rider`).not.toContain(HAND_ENTRY);
    expect(current().players.self.remove).toContain(HAND_ENTRY);
  });
});
