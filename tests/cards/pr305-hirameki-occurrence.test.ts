import { describe, expect, it } from 'vitest';
import { PR305 } from '@/cards/pr-01/PR305';
import { B03088 } from '@/cards/ct-p03/B03088';
import { runCardScenario } from '../helpers/card-probe-harness';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { mutate } from '@/engine/mutate';
import { validateCards } from '@/engine/effect/validate';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { runAllUntilEmpty } from '@/engine/resolve';
import { event } from '@/engine/event';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';

describe('PR305 physical-occurrence Hirameki invocation', () => {
  it('validates its declared physical-occurrence effect', () => {
    expect(PR305.no, 'official card identity').toBe('1158/PR305');
    expect(validateCards([PR305]).ok).toBe(true);
  });

  it('gets AP+1000 during its controller turn with two 警察 characters', () => {
    registerCardDef(PR305);
    registerCardDef(B03088);
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    const hagiwara = mutate.scene.enter(state, 'self', 'PR305', {}).uid;
    mutate.scene.enter(state, 'self', 'B03088', {});

    expect(readChar.ap(state, hagiwara)).toBe(6000);
  });

  it('is payable with exactly three own deck cards and a 松田陣平 bond', () => {
    runCardScenario(PR305, [B03088], {
      name: 'PR305 exact deck-top payment gate',
      setup: {
        selfScene: [
          { cardId: 'PR305', uid: 'hagiwara' },
          { cardId: 'B03088', uid: 'matsuda-picked' },
        ],
        deckSize: 3,
      },
      drive: { kind: 'cost-gate', uid: 'hagiwara', abilityId: 'a3', expectCanPay: true },
      expect: [],
    });
  });

  it('pays exactly three cards, picks the B03088 scene UID, and moves that exact instance to hand', () => {
    const state = runCardScenario(PR305, [B03088], {
      name: 'PR305 invokes the selected B03088 scene occurrence',
      setup: {
        selfScene: [
          { cardId: 'PR305', uid: 'hagiwara' },
          { cardId: 'B03088', uid: 'matsuda-picked' },
        ],
        deckSize: 4,
      },
      drive: { kind: 'declared', uid: 'hagiwara', abilityId: 'a3' },
      script: [{ pickUid: 'matsuda-picked' }],
      expect: [
        { kind: 'zone', side: 'self', zone: 'scene', cardId: 'B03088', present: false },
        { kind: 'zone', side: 'self', zone: 'hand', cardId: 'B03088', present: true },
        { kind: 'deckDelta', side: 'self', n: -3 },
      ],
    });

    expect(state.players.self.hand).toEqual(['B03088']);
  });

  it('AI declared resolution binds the selected B03088 scene occurrence before queueing', () => {
    event._resetRegistry();
    resetDefRegistry();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    _clearPendingEffectOptionalSide();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    registerCardDef(PR305);
    registerCardDef(B03088);

    const state = createEmptyGameState();
    state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.deck = ['D1', 'D2', 'D3', 'D4'];
    const hagiwara = mutate.scene.enter(state, 'self', 'PR305', {}).uid;
    const selected = mutate.scene.enter(state, 'self', 'B03088', {}).uid;
    const duplicate = mutate.scene.enter(state, 'self', 'B03088', {}).uid;

    activateDeclaredAbility(state, hagiwara, 'a3');

    const declared = state.pendingEffects.find((entry) =>
      entry.source.cardId === 'PR305' && entry.source.abilityId === 'a3',
    );
    expect(declared?.effect).toMatchObject({
      kind: 'atom',
      verb: 'invokeHiramekiOfCard',
      args: {
        occurrence: {
          uid: selected,
          cardId: 'B03088',
          player: 'self',
          area: 'scene',
        },
      },
    });

    runAllUntilEmpty(state);
    expect(state.players.self.scene.some((card) => card.uid === selected)).toBe(false);
    expect(state.players.self.scene.some((card) => card.uid === duplicate)).toBe(true);
    expect(state.players.self.hand).toEqual(['B03088']);
  });

  it('invokes the selected B03088 effect even while normal Hirameki activation is suppressed', () => {
    const state = runCardScenario(PR305, [B03088], {
      name: 'PR305 invokes a Hirameki effect through activation suppression',
      setup: {
        selfScene: [
          { cardId: 'PR305', uid: 'hagiwara' },
          { cardId: 'B03088', uid: 'matsuda-suppressed' },
        ],
        deckSize: 3,
        hiramekiSuppressed: true,
      },
      drive: { kind: 'declared', uid: 'hagiwara', abilityId: 'a3' },
      script: [{ pickUid: 'matsuda-suppressed' }],
      expect: [
        { kind: 'zone', side: 'self', zone: 'scene', cardId: 'B03088', present: false },
        { kind: 'zone', side: 'self', zone: 'hand', cardId: 'B03088', present: true },
      ],
    });

    expect(state.turnState.self.hiramekiSuppressed, 'PR305 does not clear the unrelated suppression authority').toBe(true);
  });

  it('allows the printed up-to-one choice to decline after paying the deck cost', () => {
    const state = runCardScenario(PR305, [B03088], {
      name: 'PR305 zero-card Hirameki choice',
      setup: {
        selfScene: [
          { cardId: 'PR305', uid: 'hagiwara' },
          { cardId: 'B03088', uid: 'matsuda-declined' },
        ],
        deckSize: 4,
      },
      drive: { kind: 'declared', uid: 'hagiwara', abilityId: 'a3' },
      script: ['pick:skip'],
      expect: [
        { kind: 'zone', side: 'self', zone: 'scene', cardId: 'B03088', present: true },
        { kind: 'deckDelta', side: 'self', n: -3 },
      ],
    });

    expect(state.players.self.hand, 'PR305 decline invokes no Hirameki effect').not.toContain('B03088');
  });

  it('is fail-closed when fewer than three own deck cards are available', () => {
    runCardScenario(PR305, [B03088], {
      name: 'PR305 exact deck-top cost gate',
      setup: {
        selfScene: [
          { cardId: 'PR305', uid: 'hagiwara' },
          { cardId: 'B03088', uid: 'matsuda-picked' },
        ],
        deckSize: 2,
      },
      drive: { kind: 'cost-gate', uid: 'hagiwara', abilityId: 'a3', expectCanPay: false },
      expect: [],
    });
  });
});
