import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { createMainGameState as createEmptyGameState } from '../../helpers/main-game-state';
import {
  abortIfMissing,
  advance,
  declare,
  passGuard,
  tryGuard,
  snapshotAP,
  startFromEffect,
} from '@/engine/flow/action/state-machine';
import { cutIn, judge, pass } from '@/engine/flow/contact';
import { event } from '@/engine/event';
import { mutate } from '@/engine/mutate';
import { runAllUntilEmpty } from '@/engine/resolve';
import {
  appendCausal,
  startCausalSession,
  validateCausalLog,
} from '@/engine/log/causal';
import { withStructuredCausalResolution } from '@/engine/log/effect-causal';
import { _resetUidCounter } from '@/engine/mutate/scene';
import {
  _resetRegistry as resetDefRegistry,
  register as registerCardDef,
} from '@/engine/read/def';
import type {
  CardDef,
  CausalEffectTrace,
  CausalLogEntryV1,
  GameState,
} from '@/engine/types';

function card(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: options.kind ?? 'character',
    names: options.names ?? [id],
    colors: options.colors ?? ['青'],
    level: options.level ?? 1,
    ap: options.ap ?? 1000,
    lp: options.lp ?? 1,
    traits: options.traits ?? [],
    rarity: options.rarity ?? 'C',
    imageUrl: options.imageUrl ?? '',
    abilities: options.abilities ?? [],
    ruleRefs: options.ruleRefs ?? [],
  };
}

function contactState(selfHand: string[] = []): {
  state: GameState;
  selfUid: string;
  oppUid: string;
} {
  registerCardDef(card('PUBLIC-ATK', { ap: 2000 }));
  registerCardDef(card('PUBLIC-DEF', { ap: 1000 }));
  registerCardDef(card('PUBLIC-CASE', { kind: 'case' }));
  registerCardDef(card('PRIVATE-CUTIN', {
    kind: 'event',
    abilities: [{
      id: 'cutin-a1',
      type: 'triggered',
      scope: 'on-hand',
      trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
      effect: { kind: 'custom', fn: () => undefined },
    }],
  }));

  let selfUid = '';
  let oppUid = '';
  const state = produce(createEmptyGameState(), (draft) => {
    selfUid = mutate.scene.enter(draft, 'self', 'PUBLIC-ATK', {}).uid;
    oppUid = mutate.scene.enter(draft, 'opp', 'PUBLIC-DEF', {}).uid;
    mutate.scene.setState(draft, oppUid, 'sleep');
    mutate.case.init(draft, 'opp', 'PUBLIC-CASE', ['青']);
    mutate.hand.add(draft, 'self', selfHand);
  });
  return { state, selfUid, oppUid };
}

function causalEntries(state: GameState): CausalLogEntryV1[] {
  return state.log.filter((entry): entry is CausalLogEntryV1 => entry.schemaVersion === 1);
}

describe('contact causal graph', () => {
  beforeEach(() => {
    event._resetRegistry();
    resetDefRegistry();
    _resetUidCounter();
  });

  it('records one ordered public graph from action declaration through contact judgment', () => {
    const setup = contactState();
    const seeded = produce(setup.state, (draft) => {
      startCausalSession(draft, 'contact-normal');
    });

    const after = produce(seeded, (draft) => {
      const ax = declare(draft, setup.selfUid, { kind: 'char', uid: setup.oppUid });
      passGuard(draft, ax);
      advance(draft, ax);
      advance(draft, ax);
      pass(draft, ax, 'opp');
      ax.firstActed = false;
      advance(draft, ax);
      pass(draft, ax, 'self');
      ax.secondActed = false;
      advance(draft, ax);
      snapshotAP(draft, ax);
      judge(draft, ax);
      advance(draft, ax);
      advance(draft, ax);
    });

    const entries = validateCausalLog(causalEntries(after));
    expect(entries.map((entry) => entry.kind)).toEqual([
      'declare', 'sleep', 'select', 'declare', 'select', 'select', 'summary',
    ]);
    expect(entries.slice(1).map((entry) => entry.parentEventId))
      .toEqual(entries.slice(0, -1).map((entry) => entry.eventId));
    expect(entries[3]).toMatchObject({ tags: ['contact'] });
    expect(entries.at(-1)).toMatchObject({ tags: ['contact'], outcome: { type: 'state', state: 'success' } });
    expect(after.actionContexts).toEqual({});
  });

  it('classifies a guarded case as contact from start through terminal summary', () => {
    const setup = contactState();
    const seeded = produce(setup.state, (draft) => {
      mutate.scene.setState(draft, setup.oppUid, 'active');
      draft.players.opp.evidence.push({
        cardId: 'PUBLIC-EVIDENCE',
        faceUp: true,
        origin: { turn: 0, via: 'reasoning' },
      });
      startCausalSession(draft, 'guarded-case-contact');
    });

    const after = produce(seeded, (draft) => {
      const ax = declare(draft, setup.selfUid, { kind: 'case', player: 'opp' });
      tryGuard(draft, ax, setup.oppUid);
      advance(draft, ax);
      advance(draft, ax);
      pass(draft, ax, 'opp');
      ax.firstActed = false;
      advance(draft, ax);
      pass(draft, ax, 'self');
      ax.secondActed = false;
      advance(draft, ax);
      snapshotAP(draft, ax);
      judge(draft, ax);
      advance(draft, ax);
      advance(draft, ax);
    });
    const entries = validateCausalLog(causalEntries(after));
    const contactStart = entries.find((entry) => entry.kind === 'declare' && entry.tags?.includes('contact'));

    expect(contactStart).toMatchObject({
      source: { kind: 'card', side: 'self' },
      targets: [{ kind: 'card', side: 'opp' }],
    });
    expect(entries.at(-1)).toMatchObject({
      kind: 'summary',
      tags: ['contact'],
      outcome: { type: 'state', state: 'success' },
    });
    expect(after.actionContexts).toEqual({});
  });

  it('correlates effect-generated contact to the exact outer effect and cancels without action:end', () => {
    const setup = contactState();
    let actionEndCount = 0;
    event.on('action:end', () => { actionEndCount += 1; });
    const seeded = produce(setup.state, (draft) => {
      startCausalSession(draft, 'contact-effect');
      appendCausal(draft, {
        actor: 'self',
        kind: 'declare',
        source: { kind: 'scene-card', side: 'self', uid: setup.selfUid },
        targets: [],
        outcome: { type: 'state', state: 'active' },
      });
    });

    const after = produce(seeded, (draft) => {
      const outerTrace: CausalEffectTrace = {
        rootEventId: 'contact-effect:1',
        tailEventId: 'contact-effect:1',
      };
      withStructuredCausalResolution(draft, () => {
        const ax = startFromEffect(draft, setup.selfUid, setup.oppUid)!;
        draft.players.opp.scene = [];
        abortIfMissing(draft, ax);
      }, outerTrace);
    });

    const entries = validateCausalLog(causalEntries(after));
    expect(entries[1]).toMatchObject({
      kind: 'declare',
      tags: ['contact'],
      correlationEventId: 'contact-effect:1',
    });
    expect(entries[2]).toMatchObject({
      kind: 'cancel',
      tags: ['contact'],
      parentEventId: entries[1]?.eventId,
    });
    expect(actionEndCount).toBe(0);
  });

  it('keeps a hidden cut-in private and correlates its queued effect to the cut-in decision', () => {
    const setup = contactState(['PRIVATE-CUTIN']);
    event.on('effect:declared', () => ({ kind: 'custom', fn: () => undefined }));
    const seeded = produce(setup.state, (draft) => {
      startCausalSession(draft, 'contact-cutin');
    });

    const after = produce(seeded, (draft) => {
      const ax = declare(draft, setup.selfUid, { kind: 'char', uid: setup.oppUid });
      passGuard(draft, ax);
      advance(draft, ax);
      advance(draft, ax);
      cutIn(draft, ax, 'self', 'PRIVATE-CUTIN');
      runAllUntilEmpty(draft);
    });

    const entries = validateCausalLog(causalEntries(after));
    const decision = entries.find((entry) => entry.tags?.includes('cutin') && entry.kind === 'use');
    expect(decision).toBeDefined();
    const childRoot = entries.find((entry) => entry.correlationEventId === decision?.eventId);
    expect(childRoot).toBeDefined();
    expect(JSON.stringify(entries.filter((entry) => entry.tags?.includes('cutin'))))
      .not.toContain('PRIVATE-CUTIN');
  });
});
