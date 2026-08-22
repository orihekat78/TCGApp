// qaId=card:B02020:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B02026:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B02049:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B02062:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B02079:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B02080:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B03008:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B03096:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B04017:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B04039:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B04091:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B04094:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B05011:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B06057:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B07016:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B07063:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B09003:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B09004:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B09026:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B09078:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:B10025:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:PR036:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:PR117:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
// qaId=card:PR118:f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9
import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import {
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
} from '@/engine/effect/pending-state';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, def as readDef, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision } from '@/ui/hooks/useEngineDispatch/types';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

const QA_SUFFIX = 'f2b57018b3c980aff7e272e3bbf30d5ca6934d3fc8ea0c0a954d366f9ecfc5c9';

const CASES = [
  ['B02020', 'a1'], ['B02026', 'a1'], ['B02049', 'a1'], ['B02062', 'a1'],
  ['B02079', 'a1'], ['B02080', 'a1'], ['B03008', 'a1'], ['B03096', 'a1'],
  ['B04017', 'a1'], ['B04039', 'a1'], ['B04091', 'a1'], ['B04094', 'a1'],
  ['B05011', 'a1'], ['B06057', 'a1'], ['B07016', 'a1'], ['B07063', 'a1'],
  ['B09003', 'a2'], ['B09004', 'a1'], ['B09026', 'a2'], ['B09078', 'a2'],
  ['B10025', 'a3'], ['PR036', 'a1'], ['PR117', 'a2'], ['PR118', 'a2'],
] as const;

type WaveCardId = (typeof CASES)[number][0];

function character(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: 'character',
    names: [id],
    colors: ['青'],
    level: 3,
    ap: 3000,
    lp: 1,
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    ...over,
  };
}

function eventCard(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    ...character(id, over),
    kind: 'event',
    level: 0,
    ap: 0,
    lp: 0,
  };
}

function partner(id: string, color: string): CardDef {
  return {
    ...character(id, { colors: [color] }),
    kind: 'partner',
    level: 0,
    ap: 0,
    lp: 2,
  };
}

const FIXTURES: CardDef[] = [
  character('W17_ACT'),
  character('W17_THIEF', { traits: ['怪盗'] }),
  character('W17_BOY', { traits: ['少年探偵団'] }),
  character('W17_KAZUHA', { names: ['遠山和葉'], colors: ['緑'] }),
  character('W17_HAKUBA', { names: ['白馬探'] }),
  character('W17_KOGORO', { names: ['毛利小五郎'] }),
  character('W17_AP7K', { ap: 7000 }),
  character('W17_ENTER', { colors: ['青'], level: 7 }),
  character('W17_SHINICHI', { names: ['工藤新一'] }),
  character('W17_REVEAL', { names: ['毛利蘭'] }),
  character('W17_VICTIM'),
  character('W17_OOKA', { names: ['大岡紅葉'], level: 6 }),
  character('W17_AZUSA', { names: ['榎本棓'] }),
  character('W17_DETECTIVE', { traits: ['探偵'] }),
  character('W17_DRAW_A'),
  character('W17_DRAW_B'),
  eventCard('W17_WHITE_YAIBA', { colors: ['白'], traits: ['YAIBA'] }),
  eventCard('W17_GREEN_EVENT', { colors: ['緑'] }),
  partner('W17_GREEN_PARTNER', '緑'),
  partner('W17_BLACK_PARTNER', '黒'),
];

function base(cardId: WaveCardId): { state: GameState; bearerA: string; bearerB: string } {
  const state = createEmptyGameState();
  state.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  const bearerA = `${cardId}:copy-a`;
  const bearerB = `${cardId}:copy-b`;
  state.players.self.scene = [
    sceneChar(cardId, bearerA, { enterOrder: 1, enterOrderThisTurn: 1 }),
    sceneChar(cardId, bearerB, { enterOrder: 2, enterOrderThisTurn: 2 }),
  ];
  return { state, bearerA, bearerB };
}

function addSelf(state: GameState, cardId: string, uid: string, over: Partial<SceneCharacter> = {}): void {
  state.players.self.scene.push(sceneChar(cardId, uid, over));
}

function addOpp(state: GameState, cardId: string, uid: string, over: Partial<SceneCharacter> = {}): void {
  state.players.opp.scene.push(sceneChar(cardId, uid, over));
}

function actionPayload(uid: string, player: 'self' | 'opp') {
  return {
    byUid: uid,
    target: { kind: 'case' as const, player: player === 'self' ? 'opp' as const : 'self' as const },
    uid,
    player,
    targetUid: undefined,
  };
}

function emitScenario(cardId: WaveCardId, state: GameState, bearerA: string, bearerB: string): void {
  switch (cardId) {
    case 'B02020':
      event.emit(state, 'setcard:leave', {
        player: 'opp', hostUid: 'opp-host', hostCardId: 'W17_ACT', setCardId: 'W17_GREEN_EVENT',
        setCardInstanceId: 'set-1', faceUp: false, cause: 'effect',
      }, { player: 'opp', uid: 'opp-host', cardId: 'W17_ACT' });
      return;
    case 'B02026':
      addOpp(state, 'W17_ACT', 'opp-action');
      state.players.self.deck = ['W17_DRAW_A', 'W17_DRAW_B'];
      event.emit(state, 'action:declare', actionPayload('opp-action', 'opp'), {
        player: 'opp', uid: 'opp-action', cardId: 'W17_ACT',
      });
      return;
    case 'B02049':
      addSelf(state, 'W17_THIEF', 'thief');
      event.emit(state, 'action:declare', actionPayload('thief', 'self'), {
        player: 'self', uid: 'thief', cardId: 'W17_THIEF',
      });
      return;
    case 'B02062':
      state.players.self.deck = ['W17_DRAW_A', 'W17_DRAW_B'];
      event.emit(state, 'evidence:removed', { player: 'opp' }, { player: 'opp' });
      return;
    case 'B02079':
      addOpp(state, 'W17_ACT', 'contact-target');
      event.emit(state, 'contact:start', { aUid: bearerA, bUid: 'contact-target' }, {
        player: 'self', uid: bearerA, cardId,
      });
      return;
    case 'B02080':
      addOpp(state, 'W17_ACT', 'contact-target');
      event.emit(state, 'cutin:used', { player: 'self', cardId: 'W17_GREEN_EVENT' }, {
        player: 'self',
        cardId: 'W17_GREEN_EVENT',
        bindings: { contact: [{ byUid: bearerA, targetUid: 'contact-target', attackerSide: 'self' }] },
      });
      return;
    case 'B03008':
      addSelf(state, 'W17_BOY', 'boy', { state: 'sleep' });
      state.players.self.deck = ['W17_DRAW_A', 'W17_DRAW_B'];
      event.emit(state, 'state:change', {
        player: 'self', uid: 'boy', from: 'active', to: 'sleep', cause: 'effect',
      }, { player: 'self', uid: 'boy', cardId: 'W17_BOY' });
      return;
    case 'B03096':
      event.emit(state, 'reasoning:end', { uid: bearerA, player: 'self', gained: 1 }, {
        player: 'self', uid: bearerA, cardId,
      });
      return;
    case 'B04017':
      state.players.self.partner.cardId = 'W17_GREEN_PARTNER';
      addSelf(state, 'W17_KAZUHA', 'kazuha');
      event.emit(state, 'enter', {
        uid: 'kazuha', viaEffect: false, enterOrder: 3, enterOrderThisTurn: 3,
      }, { player: 'self', uid: 'kazuha', cardId: 'W17_KAZUHA' });
      return;
    case 'B04039':
      addSelf(state, 'W17_HAKUBA', 'hakuba');
      event.emit(state, 'action:declare', actionPayload('hakuba', 'self'), {
        player: 'self', uid: 'hakuba', cardId: 'W17_HAKUBA',
      });
      return;
    case 'B04091':
    case 'B04094': {
      state.players.self.partner.cardId = 'W17_BLACK_PARTNER';
      const removedChar = sceneChar('W17_VICTIM', 'victim');
      event.emit(state, 'leave:to-remove', {
        uid: 'victim', cause: 'effect', side: 'opp', byUid: undefined, byPlayer: 'self',
        cardId: 'W17_VICTIM', removedChar,
      }, { player: 'opp', uid: 'victim', cardId: 'W17_VICTIM' });
      return;
    }
    case 'B05011':
      addSelf(state, 'W17_KOGORO', 'kogoro');
      event.emit(state, 'reasoning:end', { uid: 'kogoro', player: 'self', gained: 1 }, {
        player: 'self', uid: 'kogoro', cardId: 'W17_KOGORO',
      });
      return;
    case 'B06057':
      state.players.self.deck = ['W17_DRAW_A', 'W17_DRAW_B'];
      event.emit(state, 'effect:declared', {
        kind: 'event-use', cardId: 'W17_WHITE_YAIBA', player: 'self',
      }, { player: 'self', cardId: 'W17_WHITE_YAIBA' });
      return;
    case 'B07016':
      event.emit(state, 'effect:declared', {
        kind: 'event-use', cardId: 'W17_GREEN_EVENT', player: 'self',
      }, { player: 'self', cardId: 'W17_GREEN_EVENT' });
      return;
    case 'B07063':
      addSelf(state, 'W17_AP7K', 'ap7k');
      event.emit(state, 'action:declare', actionPayload('ap7k', 'self'), {
        player: 'self', uid: 'ap7k', cardId: 'W17_AP7K',
      });
      return;
    case 'B09003':
      state.players.self.case.colors = ['青', '緑'];
      addSelf(state, 'W17_ENTER', 'entrant');
      addOpp(state, 'W17_VICTIM', 'b09003-target-a');
      addOpp(state, 'W17_VICTIM', 'b09003-target-b');
      event.emit(state, 'enter', {
        uid: 'entrant', viaEffect: false, enterOrder: 3, enterOrderThisTurn: 3,
      }, { player: 'self', uid: 'entrant', cardId: 'W17_ENTER' });
      return;
    case 'B09004':
      addSelf(state, 'W17_SHINICHI', 'shinichi');
      state.players.self.hand = ['W17_REVEAL', 'W17_DRAW_A'];
      event.emit(state, 'hand:reveal', {
        player: 'self', revealed: ['W17_REVEAL'], byPlayer: 'self', cause: 'effect',
      }, { player: 'self' });
      return;
    case 'B09026': {
      state.players.self.remove = ['W17_OOKA'];
      const removedChar = sceneChar('W17_VICTIM', 'victim');
      event.emit(state, 'leave:to-remove', {
        uid: 'victim', cause: 'contact-ap', side: 'opp', byUid: bearerA,
        cardId: 'W17_VICTIM', removedChar,
      }, { player: 'opp', uid: 'victim', cardId: 'W17_VICTIM' });
      return;
    }
    case 'B09078':
      state.players.self.case.status = '解決編';
      addSelf(state, 'W17_AZUSA', 'azusa');
      event.emit(state, 'enter:group', {
        player: 'self', uids: ['azusa'], sourceCardId: 'W17_GREEN_EVENT', sourcePlayer: 'self',
      }, {
        player: 'self',
        bindings: { enterGroup: [{ kind: 'char', uid: 'azusa', cardId: 'W17_AZUSA', player: 'self' }] },
      });
      return;
    case 'B10025':
      state.players.self.case.status = '解決編';
      event.emit(state, 'evidence:gain', { player: 'self', gained: 1 }, {
        player: 'self', cardId: 'W17_GREEN_EVENT',
      });
      return;
    case 'PR036':
      event.emit(state, 'enter', {
        uid: bearerB, viaEffect: false, enterOrder: 2, enterOrderThisTurn: 2,
      }, { player: 'self', uid: bearerB, cardId });
      return;
    case 'PR117':
    case 'PR118':
      addSelf(state, 'W17_DETECTIVE', 'detective');
      state.players.self.hand = ['W17_DRAW_A', 'W17_DRAW_B'];
      event.emit(state, 'enter', {
        uid: 'detective', viaEffect: false, enterOrder: 3, enterOrderThisTurn: 3,
      }, { player: 'self', uid: 'detective', cardId: 'W17_DETECTIVE' });
  }
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.setState({ gameState: null, pendingEffectPick: null, pendingEffectOptional: null });
});
// Card-bound matrix: B02020 B02026 B02049 B02062 B02079 B02080 B03008 B03096 B04017 B04039 B04091 B04094 B05011 B06057 B07016 B07063 B09003 B09004 B09026 B09078 B10025 PR036 PR117 PR118.
describe('official Q&A same CardDef multi-copy order — Wave17', () => {
  it.each(CASES)('%s %s: both physical copies fire and public owner order is accepted', (cardId, abilityId) => {
    const qaId = `card:${cardId}:${QA_SUFFIX}`;
    const { state, bearerA, bearerB } = base(cardId);
    emitScenario(cardId, state, bearerA, bearerB);

    const initial = pendingOwnerOrderGroup(state, 'self').filter((entry) =>
      entry.source.cardId === cardId && entry.source.abilityId === abilityId
    );
    expect(initial.map((entry) => entry.source.uid), `${qaId}: both physical UIDs`).toEqual([bearerA, bearerB]);
    expect(new Set(initial.map((entry) => entry.triggerBatch)).size, `${qaId}: one simultaneous batch`).toBe(1);
    expect(initial[0]?.triggerBatch, `${qaId}: batch identity`).toBeTypeOf('number');

    const ability = readDef.card(cardId)?.abilities.find((candidate) => candidate.id === abilityId);
    if (ability?.limit?.kind === 'turn') {
      const firstSource = initial.find(entry => entry.source.uid === bearerA)!.source;
      const secondSource = initial.find(entry => entry.source.uid === bearerB)!.source;
      expect(readChar.declaredUseCount(state, bearerA, abilityId, {
        abilityOrigin: firstSource.abilityOrigin,
        abilityIndex: firstSource.abilityIndex,
      }), `${qaId}: first copy limit`).toBe(1);
      expect(readChar.declaredUseCount(state, bearerB, abilityId, {
        abilityOrigin: secondSource.abilityOrigin,
        abilityIndex: secondSource.abilityIndex,
      }), `${qaId}: second copy limit`).toBe(1);
    }

    useGameStateStore.setState({ gameState: state });
    const second = initial.find((entry) => entry.source.uid === bearerB)!;
    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: second.id, order: 0, player: 'self' }), `${qaId}: set order`)
      .toEqual({ ok: true });
    const ordered = pendingOwnerOrderGroup(useGameStateStore.getState().gameState!, 'self').filter((entry) =>
      entry.source.cardId === cardId && entry.source.abilityId === abilityId
    );
    expect(ordered.map((entry) => entry.source.uid), `${qaId}: reverse owner order`).toEqual([bearerB, bearerA]);
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map((entry) => entry.id),
    }), `${qaId}: confirm order`).toEqual({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    const entries = after.pendingEffects.filter((entry) =>
      entry.source.cardId === cardId && entry.source.abilityId === abilityId
    );
    expect(entries.find((entry) => entry.source.uid === bearerB), `${qaId}: chosen first persisted`)
      .toMatchObject({ ownerChosenOrder: 0, ownerOrderConfirmed: true });
    expect(entries.find((entry) => entry.source.uid === bearerA), `${qaId}: chosen second persisted`)
      .toMatchObject({ ownerChosenOrder: 1, ownerOrderConfirmed: true });

    if (cardId === 'B02026') {
      expect(entries.map((entry) => entry.state), `${qaId}: one-by-one terminal completion`).toEqual(['resolved', 'resolved']);
      expect(after.players.self.hand, `${qaId}: both effects resolved`).toHaveLength(2);
      expect(useGameStateStore.getState().pendingEffectPick, `${qaId}: no open decision`).toBeNull();
    }
  });

  it('B04039 resolves two after-sleep reactions in public order before reasoning continues', () => {
    const { state, bearerA, bearerB } = base('B04039');
    addSelf(state, 'D03008', 'hakuba', { enterOrder: 3, enterOrderThisTurn: 3 });
    state.players.self.deck = ['W17_DRAW_A', 'W17_DRAW_B', 'W17_ENTER', 'W17_ACT'];
    useGameStateStore.setState({ gameState: state });

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'hakuba' })).toEqual({ ok: true });
    const atOrderBoundary = useGameStateStore.getState().gameState!;
    const initial = pendingOwnerOrderGroup(atOrderBoundary, 'self').filter((entry) =>
      entry.source.cardId === 'B04039' && entry.source.abilityId === 'a1'
    );
    expect(atOrderBoundary.players.self.scene.find((card) => card.uid === 'hakuba')?.state).toBe('sleep');
    expect(atOrderBoundary.players.self.hand).toEqual([]);
    expect(atOrderBoundary.players.self.evidence).toEqual([]);
    expect(atOrderBoundary.pendingReasoningContinuation).toBeDefined();
    expect(initial.map((entry) => entry.source.uid)).toEqual([bearerA, bearerB]);
    expect(new Set(initial.map((entry) => entry.triggerBatch)).size).toBe(1);
    const firstSource = initial.find(entry => entry.source.uid === bearerA)!.source;
    const secondSource = initial.find(entry => entry.source.uid === bearerB)!.source;
    expect(readChar.declaredUseCount(atOrderBoundary, bearerA, 'a1', {
      abilityOrigin: firstSource.abilityOrigin,
      abilityIndex: firstSource.abilityIndex,
    })).toBe(1);
    expect(readChar.declaredUseCount(atOrderBoundary, bearerB, 'a1', {
      abilityOrigin: secondSource.abilityOrigin,
      abilityIndex: secondSource.abilityIndex,
    })).toBe(1);

    const uidByEntryId = new Map(initial.map((entry) => [entry.id, entry.source.uid]));
    const executionLog: string[] = [];
    const record = (phase: 'start' | 'end') => (_state: GameState, payload: unknown) => {
      const entryId = (payload as { effectId: string }).effectId;
      const uid = uidByEntryId.get(entryId);
      if (uid) executionLog.push(`${phase}:${uid}`);
    };
    const stopStart = event.on('effect:resolve:start', record('start'));
    const stopEnd = event.on('effect:resolve:end', record('end'));
    try {
      const second = initial.find((entry) => entry.source.uid === bearerB)!;
      expect(dispatchEngineAction({
        type: 'setEffectOrder', entryId: second.id, order: 0, player: 'self',
      })).toEqual({ ok: true });
      const ordered = pendingOwnerOrderGroup(useGameStateStore.getState().gameState!, 'self').filter((entry) =>
        uidByEntryId.has(entry.id)
      );
      expect(ordered.map((entry) => entry.source.uid)).toEqual([bearerB, bearerA]);
      expect(dispatchEngineAction({
        type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map((entry) => entry.id),
      })).toEqual({ ok: true });
    } finally {
      stopStart();
      stopEnd();
    }

    const after = useGameStateStore.getState().gameState!;
    const entries = after.pendingEffects.filter((entry) => uidByEntryId.has(entry.id));
    expect(executionLog).toEqual([
      `start:${bearerB}`, `end:${bearerB}`, `start:${bearerA}`, `end:${bearerA}`,
    ]);
    expect(entries.find((entry) => entry.source.uid === bearerB)).toMatchObject({
      state: 'resolved', ownerChosenOrder: 0, ownerOrderConfirmed: true,
    });
    expect(entries.find((entry) => entry.source.uid === bearerA)).toMatchObject({
      state: 'resolved', ownerChosenOrder: 1, ownerOrderConfirmed: true,
    });
    expect(pendingOwnerOrderGroup(after, 'self')).toEqual([]);
    expect(after.pendingReasoningContinuation).toBeUndefined();
    expect(after.players.self.scene.find((card) => card.uid === 'hakuba')?.state).toBe('sleep');
    expect(after.players.self.hand).toEqual(['W17_DRAW_A', 'W17_DRAW_B']);
    expect(after.players.self.evidence.map((card) => card.cardId)).toEqual(['W17_ENTER']);
    expect(after.players.self.deck).toEqual(['W17_ACT']);
  });

  it('B09003 resolves reverse-ordered copy picks one at a time and clears both entries', () => {
    const { state, bearerA, bearerB } = base('B09003');
    emitScenario('B09003', state, bearerA, bearerB);
    const initial = pendingOwnerOrderGroup(state, 'self').filter((entry) =>
      entry.source.cardId === 'B09003' && entry.source.abilityId === 'a2'
    );
    const initialIds = new Set(initial.map((entry) => entry.id));
    useGameStateStore.setState({ gameState: state });
    const second = initial.find((entry) => entry.source.uid === bearerB)!;
    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: second.id, order: 0, player: 'self' })).toEqual({ ok: true });
    const ordered = pendingOwnerOrderGroup(useGameStateStore.getState().gameState!, 'self');
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map((entry) => entry.id),
    })).toEqual({ ok: true });

    const firstPick = useGameStateStore.getState().pendingEffectPick;
    expect(firstPick?.source.uid).toBe(bearerB);
    expect(dispatchEngineAction(bindPendingDecision(firstPick!, {
      type: 'effectPickResolve', pickedUid: 'b09003-target-b',
    }))).toEqual({ ok: true });
    const secondPick = useGameStateStore.getState().pendingEffectPick;
    expect(secondPick?.source.uid).toBe(bearerA);
    expect(dispatchEngineAction(bindPendingDecision(secondPick!, {
      type: 'effectPickResolve', pickedUid: 'b09003-target-a',
    }))).toEqual({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    const entries = after.pendingEffects.filter((entry) => initialIds.has(entry.id));
    expect(entries.map((entry) => entry.state)).toEqual(['resolved', 'resolved']);
    expect(after.players.opp.scene.some((card) => card.uid.startsWith('b09003-target-'))).toBe(false);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('B07063 keeps two same-card grants independent through contact removal', () => {
    const { state, bearerB } = base('B07063');
    state.players.self.deck = ['W17_DRAW_A', 'W17_DRAW_B'];
    addOpp(state, 'W17_VICTIM', 'b07063-victim', { state: 'sleep' });
    emitScenario('B07063', state, 'B07063:copy-a', bearerB);
    const initial = pendingOwnerOrderGroup(state, 'self').filter((entry) =>
      entry.source.cardId === 'B07063' && entry.source.abilityId === 'a1'
    );
    useGameStateStore.setState({ gameState: state });
    const second = initial.find((entry) => entry.source.uid === bearerB)!;
    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: second.id, order: 0, player: 'self' })).toEqual({ ok: true });
    const orderedGrants = pendingOwnerOrderGroup(useGameStateStore.getState().gameState!, 'self');
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: 'self', entryIds: orderedGrants.map((entry) => entry.id),
    })).toEqual({ ok: true });

    const afterGrant = useGameStateStore.getState().gameState!;
    const recipient = afterGrant.players.self.scene.find((card) => card.uid === 'ap7k')!;
    const granted = recipient.turnEffects.grantedAbilities as Array<{ id: string }>;
    expect(granted).toHaveLength(2);
    expect(new Set(granted.map((ability) => ability.id)).size).toBe(2);
    const grantedIds = granted.map((ability) => ability.id);
    expect(grantedIds).toEqual(['b07063_granted_drain', 'b07063_granted_drain#1']);

    const afterRemoval = produce(afterGrant, (draft) => {
      mutate.scene.removeToRemove(draft, 'b07063-victim', 'contact-ap', 'ap7k');
    });
    const reactions = pendingOwnerOrderGroup(afterRemoval, 'self').filter((entry) =>
      entry.source.uid === 'ap7k' && grantedIds.includes(entry.source.abilityId)
    );
    expect(reactions).toHaveLength(2);
    expect(new Set(reactions.map((entry) => entry.triggerBatch)).size).toBe(1);
    useGameStateStore.setState({ gameState: afterRemoval });
    const secondReaction = reactions[1]!;
    expect(dispatchEngineAction({
      type: 'setEffectOrder', entryId: secondReaction.id, order: 0, player: 'self',
    })).toEqual({ ok: true });
    const orderedReactions = pendingOwnerOrderGroup(useGameStateStore.getState().gameState!, 'self');
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: 'self', entryIds: orderedReactions.map((entry) => entry.id),
    })).toEqual({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand).toHaveLength(2);
    expect(reactions.map((entry) => readChar.declaredUseCount(after, 'ap7k', entry.source.abilityId!, {
      abilityOrigin: entry.source.abilityOrigin,
      abilityIndex: entry.source.abilityIndex,
    }))).toEqual([1, 1]);

    const afterSecondRemoval = produce(after, (draft) => {
      addOpp(draft, 'W17_VICTIM', 'b07063-victim-2', { state: 'sleep' });
      mutate.scene.removeToRemove(draft, 'b07063-victim-2', 'contact-ap', 'ap7k');
    });
    expect(pendingOwnerOrderGroup(afterSecondRemoval, 'self').filter((entry) =>
      entry.source.uid === 'ap7k' && grantedIds.includes(entry.source.abilityId)
    )).toEqual([]);
  });
});
