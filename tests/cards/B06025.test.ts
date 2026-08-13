import { beforeEach, describe, expect, it } from 'vitest';
import { engine } from '@/engine';
import { registerAll } from '@/cards';
import { B06025 } from '@/cards/ct-p06/B06025';
import {
  _resetHiramekiRegistered,
  _resetPendingHirameki,
  registerHiramekiListener,
} from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { event } from '@/engine/event';
import { createEmptyGameState } from '@/engine/state-factory';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { char as readChar } from '@/engine/read/char';
import { mutate } from '@/engine/mutate';
import { produce } from '@/engine/produce';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _clearPendingEffectChoiceSide, _drainPendingEffectChoiceSide } from '@/engine/effect/pending-state';
import { dispatchCurrentDecision } from '../helpers/dispatch-current-decision';
import { openCaseHirameki } from '../helpers/open-case-hirameki';

function reset(): void {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetPendingHirameki();
  _resetHiramekiRegistered();
  _resetTriggeredRegistered();
  registerAll();
  engine.cards.register(B06025);
  registerHiramekiListener();
  registerTriggeredListener();
  _clearPendingEffectChoiceSide();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  useGameStateStore.setState({ gameState: null, pendingHirameki: null });
}

function targetChar() {
  return {
    uid: 'target', cardId: 'D08005', state: 'active' as const, isNamed: false,
    enterOrder: 1, enterOrderThisTurn: 1, setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  };
}

function enterA1(state: ReturnType<typeof createEmptyGameState>, player: 'self' | 'opp') {
  const source = state.players[player].scene.find(c => c.uid === 'ker')!;
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = player;
  event.emit(state, 'enter', { uid: source.uid, viaEffect: true, enterOrder: source.enterOrder, enterOrderThisTurn: source.enterOrderThisTurn }, { player, uid: source.uid, cardId: 'B06025' });
  runAllUntilEmpty(state);
  const choice = _drainPendingEffectChoiceSide();
  useGameStateStore.setState({ gameState: state, pendingEffectChoice: choice });
  return choice;
}

function kerChar() {
  return { ...targetChar(), uid: 'ker', cardId: 'B06025' };
}

describe('B06025 ケロ介: action-removed evidence occurrence reentry', () => {
  beforeEach(reset);

  it('keeps the exact later duplicate occurrence, removes a target, then enters from that occurrence', () => {
    expect(B06025.id).toBe('B06025');
    expect(B06025.colors).toEqual(['緑']);
    const state = createEmptyGameState();
    state.players.self.remove = ['B06025'];
    state.players.self.deck = ['D08005'];
    state.players.opp.scene = [targetChar()];
    const { pending, actorUid } = openCaseHirameki(state, 'B06025');
    expect(pending.occurrence).toEqual({ uid: 'card:self:remove:B06025#1', player: 'self', cardId: 'B06025', area: 'remove', index: 1, occurrenceWitness: 'occ:v1:self:remove:1' });

    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick?.atomVerb).toBe('sceneRemove');
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'target' }).ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene.map(c => c.uid)).toEqual([actorUid]);
    expect(after.players.self.scene.map(c => c.cardId)).toEqual(['B06025']);
    expect(after.players.self.remove).toEqual(['B06025']);
    expect(after.players.opp.remove).toEqual(['D08005']);
  });

  it('skip leaves the removed occurrence and target unchanged', () => {
    const state = createEmptyGameState();
    state.players.self.remove = ['B06025'];
    state.players.opp.scene = [targetChar()];
    const { actorUid } = openCaseHirameki(state, 'B06025');

    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'skip' }).ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene.map(c => c.uid)).toEqual(['target', actorUid]);
    expect(after.players.self.scene).toHaveLength(0);
    expect(after.players.self.remove).toEqual(['B06025', 'B06025']);
  });

  it('does not enter when zero targets are selected', () => {
    const state = createEmptyGameState();
    const { actorUid } = openCaseHirameki(state, 'B06025');

    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene).toHaveLength(0);
    expect(after.players.self.remove).toEqual(['B06025']);
  });

  it('does not enter a stale occurrence even when target removal succeeds', () => {
    const state = createEmptyGameState();
    state.players.opp.scene = [targetChar()];
    const { actorUid } = openCaseHirameki(state, 'B06025');

    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' }).ok).toBe(true);
    const current = useGameStateStore.getState().gameState!;
    useGameStateStore.setState({
      gameState: produce(current, draft => {
        mutate.remove.removeFromHere(draft, 'self', ['B06025', 'B06025']);
      }),
    });
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'target' }).ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene.map(c => c.uid)).toEqual([actorUid]);
    expect(after.players.self.scene).toHaveLength(0);
    expect(after.players.self.remove).toEqual([]);
    expect(after.players.opp.remove).toEqual(['D08005']);
  });

  it('a1 requires another YAIBA and exposes turn-scoped Assault/AP+1000 choices', () => {
    const a1 = B06025.abilities.find(a => a.id === 'a1')!;
    expect(a1.effect).toMatchObject({
      kind: 'conditional',
      if: { kind: 'sceneHas', query: { filter: { trait: 'YAIBA' }, excludeSelf: true }, nMin: 1 },
      then: { kind: 'choice' },
    });
    const options = (a1.effect as { then: { options: unknown[] } }).then.options;
    expect(options).toEqual([
      { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '突撃', scope: 'turn' } },
      { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'turn' } },
    ]);
  });

  it('a1 enters with no other YAIBA: no choice prompt', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [kerChar()];
    expect(enterA1(state, 'self')).toBeNull();
  });

  it('a1 self owner: choice 0 grants Assault and it expires at turn end', () => {
    const state = createEmptyGameState();
    state.players.self.scene = [kerChar(), { ...targetChar(), uid: 'ally', cardId: 'B06024' }];
    const choice = enterA1(state, 'self');
    expect(choice?.options).toHaveLength(2);
    expect(dispatchCurrentDecision({ type: 'choiceResolve', choiceIndex: 0 }).ok).toBe(true);
    let after = useGameStateStore.getState().gameState!;
    expect(readChar.hasKeyword(after, 'ker', '突撃')).toBe(true);
    after = produce(after, draft => mutate.char.clearTurnEffects(draft, 'ker', 'turn'));
    expect(readChar.hasKeyword(after, 'ker', '突撃')).toBe(false);
  });

  it('a1 opp owner: choice 1 grants AP+1000 and it expires at turn end', () => {
    const state = createEmptyGameState();
    state.players.opp.scene = [kerChar(), { ...targetChar(), uid: 'ally', cardId: 'B06024' }];
    const choice = enterA1(state, 'opp');
    expect(choice?.player).toBe('opp');
    expect(dispatchCurrentDecision({ type: 'choiceResolve', choiceIndex: 1 }).ok).toBe(true);
    let after = useGameStateStore.getState().gameState!;
    expect(readChar.ap(after, 'ker')).toBe(6000);
    after = produce(after, draft => mutate.char.clearTurnEffects(draft, 'ker', 'turn'));
    expect(readChar.ap(after, 'ker')).toBe(5000);
  });

  it('a1 turn-scoped AP choice expires and remains owner-relative for opp', () => {
    const state = createEmptyGameState();
    state.players.opp.scene = [targetChar(), { ...targetChar(), uid: 'yaiba', cardId: 'B06024' }];
    const boosted = produce(state, draft => {
      mutate.char.modifyAP(draft, 'target', 1000, 'turn');
    });
    expect(readChar.ap(boosted, 'target')).toBe(7000);
    const expired = produce(boosted, draft => mutate.char.clearTurnEffects(draft, 'target', 'turn'));
    expect(readChar.ap(expired, 'target')).toBe(6000);
  });
});
