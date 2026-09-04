import { beforeEach, describe, expect, it } from 'vitest';
import { engine } from '@/engine';
import { registerAll } from '@/cards';
import { B06027 } from '@/cards/ct-p06/B06027';
import { event } from '@/engine/event';
import {
  _resetHiramekiRegistered,
  _resetPendingHirameki,
  registerHiramekiListener,
} from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { bindPendingDecision, type EngineAction } from '@/ui/hooks/useEngineDispatch/types';
import { useGameStateStore } from '@/ui/state/store';
import { dispatchCurrentDecision } from '../helpers/dispatch-current-decision';
import { openCaseHirameki } from '../helpers/open-case-hirameki';

function reset(): void {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetPendingHirameki();
  _resetHiramekiRegistered();
  _resetTriggeredRegistered();
  registerAll();
  registerHiramekiListener();
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  useGameStateStore.setState({ gameState: null, pendingHirameki: null });
}

function finishCaseAction(actionId: string): void {
  for (let step = 0; step < 2 && useGameStateStore.getState().activeActionId === actionId; step += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function openFullSceneHirameki() {
  const state = createEmptyGameState();
  state.players.self.case.status = '解決編';
  state.players.self.remove = ['B06027'];
  const scene = Array.from({ length: 5 }, () => mutate.scene.enter(state, 'self', 'D08005', {}));
  return { ...openCaseHirameki(state, 'B06027'), scene };
}

function fireWithSwitch(
  pending: ReturnType<typeof openCaseHirameki>['pending'],
  switchRemoveUid?: string,
) {
  return dispatchEngineAction({
    ...bindPendingDecision(pending, { type: 'hiramekiResolve', choice: 'fire' }),
    ...(switchRemoveUid === undefined ? {} : { switchRemoveUid }),
  } as EngineAction);
}

describe('B06027 カマキリ男＆ナマコ男＆ヒトデ男', () => {
  beforeEach(reset);

  it('registers its cutin and case-closed hirameki self reentry', () => {
    const card = B06027;
    expect(card?.kind).toBe('character');
    const hirameki = card?.abilities.find(ability => ability.id === 'a2');
    expect(hirameki).toMatchObject({
      scope: 'on-evidence',
      trigger: { hook: 'evidence:remove-by-action', optional: true },
      condition: { kind: 'caseStatus', status: '解決編' },
      effect: {
        kind: 'atom', verb: 'sceneEnter',
        args: { player: 'self', cardId: '$occurrence.cardId', enterSleep: true, sourceRequired: true },
      },
    });
  });

  it('enters the held evidence card sleeping through the public CASE action and preserves a remove sibling', () => {
    const state = createEmptyGameState();
    state.players.self.case.status = '解決編';
    state.players.self.remove = ['B06027'];
    const { actionId, pending } = openCaseHirameki(state, 'B06027');
    expect(pending.occurrence).toBeUndefined();
    expect(pending.heldEvidence).toEqual(expect.objectContaining({ player: 'self', cardId: 'B06027' }));

    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
    finishCaseAction(actionId);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.map(card => ({ cardId: card.cardId, state: card.state }))).toEqual([
      { cardId: 'B06027', state: 'sleep' },
    ]);
    expect(after.players.self.remove).toEqual(['B06027']);
  });

  it('does not enter when the case is not closed', () => {
    const state = createEmptyGameState();
    state.players.self.case.status = '事件編';
    const { actionId, pending } = openCaseHirameki(state, 'B06027');
    expect(pending.effectValid).toBe(false);

    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
    finishCaseAction(actionId);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene).toHaveLength(0);
    expect(after.players.self.remove).toEqual(['B06027']);
  });

  // qa: card:B06027:9dd8f52aa8602ce40ade4ab560b3351e1d400f64e03787df0d7e58f0d4c8838a
  it('skip finalizes the held evidence card to remove without entering it', () => {
    const state = createEmptyGameState();
    state.players.self.case.status = '解決編';
    const { actionId } = openCaseHirameki(state, 'B06027');

    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'skip' })).toEqual({ ok: true });
    finishCaseAction(actionId);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene).toHaveLength(0);
    expect(after.players.self.remove).toEqual(['B06027']);
  });

  // qa: card:B06027:9478a6ac2ae9084406e27b813b87d9bc6270dd7dfebb3363720ec54adc08ee08
  it('switches the exact chosen own character when the held card enters a full scene', () => {
    const { actionId, pending, scene } = openFullSceneHirameki();
    const victim = scene[2]!;

    expect(fireWithSwitch(pending, victim.uid)).toEqual({ ok: true });
    finishCaseAction(actionId);

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene).toHaveLength(5);
    expect(after.players.self.scene.some(card => card.uid === victim.uid)).toBe(false);
    expect(after.players.self.scene.filter(card => card.cardId === 'D08005').map(card => card.uid)).toEqual(
      scene.filter(card => card.uid !== victim.uid).map(card => card.uid),
    );
    expect(after.players.self.scene.at(-1)).toMatchObject({ cardId: 'B06027', state: 'sleep' });
    expect(after.players.self.remove).toEqual(['B06027', 'D08005']);
    expect(after.log.some(entry => entry.action === 'effect:sceneEnter:scene-full-skip')).toBe(false);
  });

  it.each([
    ['missing', undefined],
    ['forged', 'not-a-live-self-scene-uid'],
  ] as const)('rejects a %s full-scene switch witness without consuming the held card', (_label, switchRemoveUid) => {
    const { pending } = openFullSceneHirameki();
    const before = structuredClone(useGameStateStore.getState().gameState);

    expect(fireWithSwitch(pending, switchRemoveUid)).toEqual({ ok: false, reason: 'not-allowed' });
    expect(useGameStateStore.getState().gameState).toEqual(before);
    expect(useGameStateStore.getState().pendingHirameki).toEqual(pending);
  });
});
