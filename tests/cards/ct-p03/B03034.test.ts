// BUG-114: B03034 稲尾一久 カットイン実装。
// 【カットイン】AP＋1000、相手の現場にいるコンタクト中のキャラを1枚まで選び、
//   相手のデッキのカードを上から1枚裏向きでセットする
// charSetCard{player:'opp', fromDeckTop, faceUp:false, max:1, inContact:true}
//   = コンタクト相手を0〜1枚選び、選択時だけ相手デッキ上端を裏向きセット。
// rules: 09-cutin-disguise.md, 16-card-set.md
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { B03034 } from '@/cards/ct-p03/B03034';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as charRead } from '@/engine/read/char';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';


describe('B03034 稲尾一久 — カットイン (AP+1000 + 相手デッキ上端を相手コンタクトキャラに裏向きセット)', () => {
  beforeAll(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetDefRegistry();
    registerAll();
    registerTriggeredListener();
  });

  beforeEach(() => {
    useGameStateStore.getState().resetMatchSessionState();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  });

  function contactState(): GameState {
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [sceneChar('D11013', 'atk')];
    const target = sceneChar('B03034', 'contact-target');
    target.state = 'sleep';
    state.players.opp.scene = [target, sceneChar('D11013', 'decoy')];
    state.players.self.hand = ['B03034'];
    state.players.opp.deck = ['DECK-TOP', 'DECK-NEXT'];
    return state;
  }

  function startCardEffect() {
    const state = contactState();
    const apBefore = charRead.ap(state, 'atk');
    expect(useGameStateStore.getState().setGameState(state)).toBe(true);
    expect(dispatchEngineAction({
      type: 'actionDeclareChar', byUid: 'atk', targetUid: 'contact-target',
    })).toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).not.toBeNull();
    expect(dispatchEngineAction({ type: 'actionGuard', actionId: actionId!, guarderUid: null }))
      .toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId: actionId! })).toEqual({ ok: true });
    expect(dispatchEngineAction({
      type: 'actionContact',
      actionId: actionId!,
      player: 'self',
      choice: { kind: 'cutin', cardId: 'B03034' },
    })).toEqual({ ok: true });
    return { pending: useGameStateStore.getState().pendingEffectPick, apBefore };
  }

  it('shape: cutin (effect:declared optional, sequence)', () => {
    expect(B03034.abilities.length).toBe(1);
    const a = B03034.abilities[0]!;
    expect(a.trigger?.hook).toBe('effect:declared');
    expect(a.trigger?.optional).toBe(true);
    expect(a.scope).toBe('on-hand');
    expect(a.effect).toMatchObject({
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
        {
          kind: 'atom',
          verb: 'charSetCard',
          args: { player: 'opp', fromDeckTop: true, faceUp: false, max: 1, inContact: true },
        },
      ],
    });
  });

  it('card-bound dispatch: 0〜1枚で、コンタクト相手だけを候補にする', () => {
    const { pending, apBefore } = startCardEffect();

    expect(pending).toMatchObject({
      atomVerb: 'charSetCard',
      player: 'self',
      nMin: 0,
      nMax: 1,
      candidates: [{ uid: 'contact-target', player: 'opp' }],
    });
    expect(charRead.ap(useGameStateStore.getState().gameState!, 'atk')).toBe(apBefore + 1000);
  });

  it('card-bound dispatch: skipしてもAP+1000は適用し、deck/set枚数を変えない', () => {
    const { pending, apBefore } = startCardEffect();
    expect(pending).not.toBeNull();
    expect(dispatchEngineAction(bindPendingDecision(
      pending!, { type: 'effectPickResolve', pickedUid: null },
    ))).toEqual({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    expect(charRead.ap(after, 'atk')).toBe(apBefore + 1000);
    expect(after.players.opp.deck).toEqual(['DECK-TOP', 'DECK-NEXT']);
    expect(after.players.opp.scene.flatMap(character => character.setCards)).toEqual([]);
  });

  it('card-bound dispatch: selectで相手deckの正確な上端1枚を対象へ裏向きセットする', () => {
    const { pending, apBefore } = startCardEffect();
    expect(pending).not.toBeNull();
    expect(dispatchEngineAction(bindPendingDecision(
      pending!, { type: 'effectPickResolve', pickedUid: 'contact-target' },
    ))).toEqual({ ok: true });

    const after = useGameStateStore.getState().gameState!;
    expect(charRead.ap(after, 'atk')).toBe(apBefore + 1000);
    expect(after.players.opp.scene.find(character => character.uid === 'contact-target')?.setCards)
      .toEqual([{ cardId: 'DECK-TOP', faceUp: false, instanceId: expect.any(String) }]);
    expect(after.players.opp.scene.find(character => character.uid === 'decoy')?.setCards).toEqual([]);
    expect(after.players.opp.deck).toEqual(['DECK-NEXT']);
    const setLog = after.log.filter(entry => entry.action === 'effect:charSetCard').at(-1);
    expect(setLog).toMatchObject({ target: 'contact-target', result: 'face-down' });
    expect(JSON.stringify(setLog)).not.toContain('DECK-TOP');
  });
});
