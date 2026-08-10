import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { validateCausalLog } from '@/engine/log/causal';
import {
  FILE_CARD_BACK_PLACEHOLDER,
  type CausalLogEntryV1,
  type SceneCharacter,
} from '@/engine/types';
import {
  projectPublicCausalLogEntry,
  projectReplayStateForViewer,
} from '@/ui/services/replayViewerProjection';

function sceneCharacter(): SceneCharacter {
  return {
    cardId: 'PUBLIC-SCENE-CARD',
    uid: 'scene:self:1',
    state: 'active',
    isNamed: false,
    enterOrder: 1,
    setCards: [
      { cardId: 'SELF-HIDDEN-SET', faceUp: false, instanceId: 'set:hidden' },
      { cardId: 'PUBLIC-FACE-UP-SET', faceUp: true, instanceId: 'set:public' },
    ],
    stackedCards: [{ cardId: 'SELF-HIDDEN-STACK', instanceId: 'stack:hidden' }],
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}

function privateState() {
  const state = createEmptyGameState();
  state.players.self.hand = ['SELF-HAND-SECRET'];
  state.players.opp.hand = ['OPP-HAND-SECRET'];
  state.players.self.deck = ['SELF-DECK-SECRET'];
  state.players.opp.deck = ['OPP-DECK-SECRET'];
  state.players.self.evidence = [{
    cardId: 'SELF-HIDDEN-EVIDENCE',
    faceUp: false,
    origin: { turn: 1, via: 'effect', sourceCardId: 'SELF-HIDDEN-SOURCE' },
  }];
  state.players.self.partner = {
    cardId: 'PUBLIC-ASSISTED-PARTNER',
    state: 'sleep',
    location: 'file-area',
  };
  state.players.self.file = [
    { type: 'card-back', cardId: 'SELF-HIDDEN-FILE' },
    { type: 'assisted-partner', cardId: 'PUBLIC-ASSISTED-PARTNER' },
  ];
  state.players.self.scene = [sceneCharacter()];
  state.log = [
    {
      ts: 1,
      player: 'self',
      turn: 1,
      action: 'private-self',
      target: 'SELF-LOG-SECRET',
      targetAudience: 'self',
      result: 'SELF-RESULT-SECRET',
    },
    {
      ts: 2,
      player: 'opp',
      turn: 1,
      action: 'private-opp',
      target: 'OPP-LOG-SECRET',
      targetAudience: 'opp',
      result: 'OPP-RESULT-SECRET',
    },
  ];
  state.pendingRuntimeState = {
    token: 1,
    snapshot: [{ key: '__privateReplayDecision', present: true, value: 'RUNTIME-SECRET' }],
  };
  state.pendingEffects.push({
    id: 'runtime-custom-effect',
    source: { player: 'opp', cardId: 'D11005' },
    triggeredBy: { hook: 'enter' },
    triggeredAt: { turn: 1, phase: 'main', nano: 1 },
    effect: { kind: 'custom', fn: () => undefined },
    state: 'resolved',
  });
  state.actionContexts = {};
  return state;
}

describe('projectReplayStateForViewer', () => {
  it.each(['file', 'evidence', 'set-card'] as const)(
    'fails closed when a public and hidden %s occurrence share one card number',
    (zone) => {
      const state = createEmptyGameState();
      const cardNumber = `DUPLICATE-${zone}`;
      if (zone === 'file') {
        state.players.opp.partner = { cardId: cardNumber, state: 'active', location: 'partner-area' };
        state.players.opp.file = [{ type: 'card-back', cardId: cardNumber }];
      } else if (zone === 'evidence') {
        state.players.opp.evidence = [
          { cardId: cardNumber, faceUp: true, origin: { turn: 1, via: 'effect' } },
          { cardId: cardNumber, faceUp: false, origin: { turn: 1, via: 'effect' } },
        ];
      } else {
        const host = sceneCharacter();
        host.setCards = [
          { cardId: cardNumber, faceUp: true, instanceId: 'set:public-duplicate' },
          { cardId: cardNumber, faceUp: false, instanceId: 'set:hidden-duplicate' },
        ];
        state.players.opp.scene = [host];
      }
      const ref = {
        visibility: 'public' as const,
        kind: 'card' as const,
        label: cardNumber,
        side: 'opp' as const,
        zone,
        cardNumber,
      };
      const entry: CausalLogEntryV1 = {
        schemaVersion: 1,
        eventId: 'duplicate-publicity:1',
        sessionId: 'duplicate-publicity',
        sequence: 1,
        ts: 1,
        player: 'opp',
        actor: 'opp',
        turn: 1,
        action: 'causal.select',
        target: cardNumber,
        kind: 'select',
        source: ref,
        targets: [ref],
        outcome: { type: 'none' },
      };

      const projected = projectPublicCausalLogEntry(state, entry);

      expect(projected.source).toMatchObject({ kind: 'zone', side: 'opp', zone });
      expect(projected.targets[0]).toMatchObject({ kind: 'zone', side: 'opp', zone });
      expect(JSON.stringify(projected)).not.toContain(cardNumber);
    },
  );

  it('removes every hidden identity and live continuation from spectator state', () => {
    const projected = projectReplayStateForViewer(privateState(), 'spectator');
    const serialized = JSON.stringify(projected);

    for (const secret of [
      'SELF-HAND-SECRET', 'OPP-HAND-SECRET', 'SELF-DECK-SECRET', 'OPP-DECK-SECRET',
      'SELF-HIDDEN-EVIDENCE', 'SELF-HIDDEN-SOURCE', 'SELF-HIDDEN-FILE',
      'SELF-HIDDEN-SET', 'SELF-HIDDEN-STACK',
      'SELF-LOG-SECRET', 'OPP-LOG-SECRET',
      'SELF-RESULT-SECRET', 'OPP-RESULT-SECRET', 'RUNTIME-SECRET',
    ]) {
      expect(serialized).not.toContain(secret);
    }

    expect(projected.players.self.hand).toEqual([FILE_CARD_BACK_PLACEHOLDER]);
    expect(projected.players.opp.hand).toEqual([FILE_CARD_BACK_PLACEHOLDER]);
    expect(serialized).toContain('PUBLIC-ASSISTED-PARTNER');
    expect(serialized).toContain('PUBLIC-FACE-UP-SET');
    expect(projected.pendingEffects).toEqual([]);
    expect(projected.reservedEffects).toEqual([]);
    expect(projected.actionContexts).toEqual({});
    expect(projected.pendingRuntimeState).toBeUndefined();
    expect(projected.pendingReasoningContinuation).toBeUndefined();
  });

  it('keeps only the solo owner hand and owner-private legacy detail', () => {
    const projected = projectReplayStateForViewer(privateState(), 'solo-self');
    const serialized = JSON.stringify(projected);

    expect(projected.players.self.hand).toEqual(['SELF-HAND-SECRET']);
    expect(serialized).toContain('SELF-LOG-SECRET');
    expect(serialized).toContain('SELF-RESULT-SECRET');
    for (const secret of [
      'OPP-HAND-SECRET', 'SELF-DECK-SECRET', 'OPP-DECK-SECRET', 'OPP-LOG-SECRET',
      'OPP-RESULT-SECRET', 'SELF-HIDDEN-EVIDENCE', 'SELF-HIDDEN-FILE',
      'SELF-HIDDEN-SET', 'SELF-HIDDEN-STACK', 'RUNTIME-SECRET',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).toContain('PUBLIC-ASSISTED-PARTNER');
  });

  it('keeps historical assisted-partner FILE refs public after auto-phase return without exposing forged hidden refs', () => {
    const state = privateState();
    const causal = (sequence: number, source: CausalLogEntryV1['source']): CausalLogEntryV1 => ({
      schemaVersion: 1,
      eventId: `replay-private:${sequence}`,
      sessionId: 'replay-private',
      sequence,
      ts: sequence,
      player: 'opp',
      actor: 'opp',
      turn: 1,
      action: 'causal.use',
      target: source?.label,
      result: 'success',
      kind: 'use',
      source,
      targets: source ? [source] : [],
      outcome: { type: 'state', state: 'success' },
    });
    state.log = [
      causal(1, {
        visibility: 'public',
        kind: 'card',
        label: 'PRIVATE-LABEL-SECRET',
        side: 'opp',
        zone: 'deck',
        cardNumber: 'PRIVATE-CARD-ID',
      }),
      causal(2, {
        visibility: 'public',
        kind: 'card',
        label: 'PRIVATE-VISIBLE-LABEL',
        side: 'self',
        zone: 'scene',
        cardNumber: 'PUBLIC-SCENE-CARD',
      }),
      causal(3, {
        visibility: 'public',
        kind: 'card',
        label: 'UNTRUSTED-ASSISTED-LABEL',
        side: 'self',
        zone: 'file',
        cardNumber: 'PUBLIC-ASSISTED-PARTNER',
      }),
      causal(4, {
        visibility: 'public',
        kind: 'card',
        label: 'FORGED-HAND-LABEL',
        side: 'self',
        zone: 'hand',
        cardNumber: 'SELF-HAND-SECRET',
      }),
    ];
    // Auto phase has returned the assisted partner, so its historical FILE entry
    // is no longer present in the current frame.
    state.players.self.partner = {
      cardId: 'PUBLIC-ASSISTED-PARTNER',
      state: 'active',
      location: 'partner-area',
    };
    state.players.self.file = [{ type: 'card-back', cardId: 'SELF-HIDDEN-FILE' }];

    const projected = projectReplayStateForViewer(state, 'spectator');
    const serialized = JSON.stringify(projected);

    for (const secret of [
      'PRIVATE-LABEL-SECRET',
      'PRIVATE-CARD-ID',
      'PRIVATE-VISIBLE-LABEL',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(projected.log[0]).toMatchObject({
      action: 'causal.use',
      source: { kind: 'zone', side: 'opp', zone: 'deck' },
    });
    expect(projected.log[1]).toMatchObject({
      source: {
        kind: 'card',
        side: 'self',
        zone: 'scene',
        cardNumber: 'PUBLIC-SCENE-CARD',
        label: 'PUBLIC-SCENE-CARD',
      },
    });
    expect(projected.log[2]).toMatchObject({
      source: {
        kind: 'card',
        side: 'self',
        zone: 'file',
        cardNumber: 'PUBLIC-ASSISTED-PARTNER',
        label: 'PUBLIC-ASSISTED-PARTNER',
      },
    });
    expect(projected.log[3]).toMatchObject({
      source: { kind: 'zone', side: 'self', zone: 'hand' },
    });
    for (const secret of [
      'UNTRUSTED-ASSISTED-LABEL',
      'FORGED-HAND-LABEL',
      'SELF-HAND-SECRET',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(() => validateCausalLog(projected.log as CausalLogEntryV1[])).not.toThrow();
  });
});
