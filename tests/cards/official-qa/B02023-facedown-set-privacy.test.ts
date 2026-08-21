// qa: card:B02023:7066f8a33831bd760fec4c8dcb62ddde100267dda13da44eaf70a3be425c607b

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B02023 } from '@/cards/ct-p02/B02023';
import { D08006 } from '@/cards/ct-d08/D08006';
import { D08007 } from '@/cards/ct-d08/D08007';
import { D08013 } from '@/cards/ct-d08/D08013';
import { D08019 } from '@/cards/ct-d08/D08019';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry as resetDefRegistry, def as readDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { sceneChar } from '../../helpers/fixtures';

function deployB02023() {
  const state = createEmptyGameState();
  state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...B02023.colors];
  state.players.self.file = Array.from(
    { length: B02023.level ?? 0 },
    () => ({ type: 'card-back' as const, cardId: D08019.id }),
  );
  state.players.self.hand = [B02023.id];
  state.players.self.deck = [D08013.id, D08019.id];
  state.players.self.scene = [
    sceneChar(D08006.id, 'target'),
    sceneChar(D08007.id, 'decoy'),
  ];
  startCausalSession(state, 'qa-b02023-facedown-set-privacy');
  resetPresentationQueue('qa-b02023-facedown-set-privacy');
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B02023.id }))
    .toEqual({ ok: true });

  const pending = useGameStateStore.getState().pendingEffectPick;
  expect(pending).toMatchObject({
    player: 'self',
    atomVerb: 'charSetCard',
    nMin: 0,
    nMax: 1,
    source: { cardId: B02023.id, abilityId: 'a1' },
    decisionId: expect.any(String),
  });
  expect(pending!.candidates).toHaveLength(3);
  expect(pending!.candidates.map(candidate => candidate.uid)).toEqual(
    expect.arrayContaining(['target', 'decoy']),
  );
  expect(pending!.candidates).toContainEqual(expect.objectContaining({ cardId: B02023.id }));
  return pending!;
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  registerAll();
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
});

afterEach(() => {
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
});

describe('B02023 facedown set-card privacy', () => {
  it('sets the exact deck-top card under the selected host without publishing its identity', () => {
    deployB02023();

    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'target' }))
      .toEqual({ ok: true });
    const state = useGameStateStore.getState().gameState!;
    expect(state.players.self.deck).toEqual([D08019.id]);
    expect(state.players.self.scene.find(char => char.uid === 'target')!.setCards)
      .toEqual([expect.objectContaining({ cardId: D08013.id, faceUp: false })]);
    expect(state.players.self.scene.find(char => char.uid === 'decoy')!.setCards).toEqual([]);
    expect(state.players.self.scene.find(char => char.cardId === B02023.id)!.setCards).toEqual([]);
    expect(state.log).toContainEqual(expect.objectContaining({
      player: 'self',
      action: 'causal.zone-move',
      result: 'deck->set-card:1',
    }));
    expect(JSON.stringify(state.log)).not.toContain(D08013.id);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });
});

function faceDownSetAtoms(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(faceDownSetAtoms);
  if (value === null || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  const args = record.args;
  const own = record.verb === 'charSetCard'
    && args !== null
    && typeof args === 'object'
    && (args as Record<string, unknown>).faceUp === false
    ? [record]
    : [];
  return own.concat(Object.values(record).flatMap(faceDownSetAtoms));
}

const FACE_DOWN_SET_SOURCE_IDS = [
  'B02018', 'B02018P', 'B02020', 'B02020P', 'B02030', 'B02040', 'B02040P',
  'B03032', 'B03032P', 'B03034', 'B03061', 'B05029', 'B05029P', 'B05031',
  'B05031P', 'B05035', 'B05075', 'PR099', 'PR105', 'PR136',
] as const;

describe('face-down set-card Q&A source binding', () => {
  it.each(FACE_DOWN_SET_SOURCE_IDS)('%s owns an explicit face-down set operation', (cardId) => {
    const card = readDef.card(cardId);
    expect(card).toBeDefined();
    expect(faceDownSetAtoms(card!.abilities)).not.toHaveLength(0);
  });
});

describe('face-down set-card public classification', () => {
  it('keeps the set card outside character/event candidates and hides its public identity', async () => {
    const { candidates } = await import('@/engine/target/candidates');
    const { FILE_CARD_BACK_PLACEHOLDER } = await import('@/engine/types');
    const { projectReplayStateForViewer } = await import('@/ui/services/replayViewerProjection');
    const queryCandidates = (area: 'scene' | 'set-card', kind: 'character' | 'event') => candidates(
      useGameStateStore.getState().gameState!,
      {
        kind: 'all',
        query: { area, side: 'self', filter: { kind } },
      },
      {
        source: { cardId: B02023.id, abilityId: 'a1', player: 'self', area: 'scene' },
        bindings: {},
      },
    );

    deployB02023();
    const sceneCharactersBefore = queryCandidates('scene', 'character');
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'target' }))
      .toEqual({ ok: true });

    expect(queryCandidates('scene', 'character')).toEqual(sceneCharactersBefore);
    expect(queryCandidates('scene', 'event')).toEqual([]);
    expect(queryCandidates('set-card', 'character')).toEqual([]);
    expect(queryCandidates('set-card', 'event')).toEqual([]);
    const publicState = projectReplayStateForViewer(useGameStateStore.getState().gameState!, 'solo-self');
    expect(publicState.players.self.scene.find(char => char.uid === 'target')!.setCards)
      .toEqual([{ cardId: FILE_CARD_BACK_PLACEHOLDER, faceUp: false, instanceId: 'hidden-set:0' }]);
    expect(JSON.stringify(publicState)).not.toContain(D08013.id);
  });
});

// qa: card:B02018:7066f8a33831bd760fec4c8dcb62ddde100267dda13da44eaf70a3be425c607b
// qa: card:B02020:7066f8a33831bd760fec4c8dcb62ddde100267dda13da44eaf70a3be425c607b
// qa: card:B02030:7066f8a33831bd760fec4c8dcb62ddde100267dda13da44eaf70a3be425c607b
// qa: card:B02040:7066f8a33831bd760fec4c8dcb62ddde100267dda13da44eaf70a3be425c607b
// qa: card:B03032:7066f8a33831bd760fec4c8dcb62ddde100267dda13da44eaf70a3be425c607b
// qa: card:B03034:7066f8a33831bd760fec4c8dcb62ddde100267dda13da44eaf70a3be425c607b
// qa: card:B03061:7066f8a33831bd760fec4c8dcb62ddde100267dda13da44eaf70a3be425c607b
// qa: card:B05029:7066f8a33831bd760fec4c8dcb62ddde100267dda13da44eaf70a3be425c607b
// qa: card:B05031:99f0b0d913b46580a670f59061691894914b57219aaed6750f3f6f34a2de4162
// qa: card:B05035:99f0b0d913b46580a670f59061691894914b57219aaed6750f3f6f34a2de4162
// qa: card:B05075:8b7bcabca268273e462f32584d43665c09fa58a0e7552c81b57da97570c83363
// qa: card:PR099:99f0b0d913b46580a670f59061691894914b57219aaed6750f3f6f34a2de4162
// qa: card:PR105:99f0b0d913b46580a670f59061691894914b57219aaed6750f3f6f34a2de4162
// qa: card:PR136:eae5569655e228acf5ae95649166bd538ea4089bceabe6f055b6f1a2b5a5194d
