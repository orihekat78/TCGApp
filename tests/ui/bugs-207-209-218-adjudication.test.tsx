// BUG-207/209/218 adjudication regressions.
// rules: 06-card-types.md, 07-action-flow.md, 09-cutin-disguise.md,
//        10-action-event.md, 21-declared-ability-cost.md

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { D08005 } from '@/cards/ct-d08/D08005';
import { D08007 } from '@/cards/ct-d08/D08007';
import { D08017 } from '@/cards/ct-d08/D08017';
import { D08023 } from '@/cards/ct-d08/D08023';
import { event } from '@/engine/event';
import { handUseCard, canHandUseCard } from '@/engine/flow/main/hand-use-card';
import { produce } from '@/engine/produce';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { _getContext, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { Playmat } from '@/ui/components/Playmat';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';
import {
  enumDeclaredAbilityIdsFor,
  enumDeclaredAbilitySources,
  runActionFlow,
} from '@/ui/hooks/useActionsPanelFlow';
import { useConfirmationStore } from '@/ui/hooks/useConfirmation';
import { useTargetPicker, useTargetPickerStore } from '@/ui/hooks/useTargetPicker';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../helpers/fixtures';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const resolveCard = (cardId: string): ResolvedCardMeta => ({
  name: cardId,
  color: 'blue',
  ap: 1000,
  lp: 1,
  lv: 2,
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function mountPlaymat(state: ReturnType<typeof createEmptyGameState>): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => root!.render(<Playmat gameState={state} resolveCard={resolveCard} />));
}

function unmountPlaymat(): void {
  if (root) act(() => root!.unmount());
  root = null;
  container?.remove();
  container = null;
}

beforeEach(() => {
  event._resetRegistry();
  resetDefRegistry();
  _resetActionContexts();
  useTargetPickerStore.getState()._reset();
  useConfirmationStore.getState()._reset();
  useGameStateStore.setState({
    gameState: null,
    activeActionId: null,
    pendingEffectPick: null,
    spectatorMode: false,
    aiSpeedMs: 0,
  });
});

afterEach(() => {
  unmountPlaymat();
  useTargetPickerStore.getState()._reset();
  useConfirmationStore.getState()._reset();
  _resetActionContexts();
  resetDefRegistry();
});

describe('BUG-207 rule adjudication', () => {
  it.each([D08017, D08023])(
    '$id is a normal character hand-use candidate; cut-in is an additional path',
    (card) => {
      registerCardDef(card);
      const state = createEmptyGameState();
      state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
      state.players.self.case.colors = ['青'];
      state.players.self.file = Array.from({ length: card.level ?? 0 }, () => ({ type: 'card-back' as const }));
      state.players.self.hand = [card.id];

      expect(card.kind).toBe('character');
      expect(card.abilities.some((a) => a.scope === 'on-hand')).toBe(true);
      expect(canHandUseCard(state, 'self', card.id)).toBe(true);

      const after = produce(state, (draft) => handUseCard(draft, 'self', card.id));
      expect(after.players.self.hand).not.toContain(card.id);
      expect(after.players.self.scene.some((c) => c.cardId === card.id && c.isNamed)).toBe(true);
    },
  );
});

describe('BUG-209 source adjudication', () => {
  it('excludes D08007 on-hand cut-in while keeping real D08005 declared ability', () => {
    registerCardDef(D08007);
    registerCardDef(D08005);
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.evidence = [
      { cardId: 'E1', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
    state.players.self.scene = [
      makeChar({ cardId: D08007.id, uid: 'ayumi', state: 'active' }),
      makeChar({ cardId: D08005.id, uid: 'haibara', state: 'active' }),
    ];

    expect(enumDeclaredAbilitySources(state, 'self')).toEqual(['haibara']);
    expect(enumDeclaredAbilityIdsFor(state, 'ayumi')).toEqual([]);
    expect(enumDeclaredAbilityIdsFor(state, 'haibara')).toEqual(['a2']);
  });

  it('keeps the declared-ability action disabled when D08007 is the only scene card', () => {
    registerCardDef(D08007);
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [makeChar({ cardId: D08007.id, uid: 'ayumi', state: 'active' })];
    useGameStateStore.setState({ gameState: state });
    mountPlaymat(state);

    const item = container!.querySelector<HTMLElement>('[data-action-id="declared-ability"]');
    expect(item?.getAttribute('aria-disabled')).toBe('true');
    act(() => item!.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(useTargetPickerStore.getState().phase).toEqual({ phase: 'idle' });
  });
});

describe('BUG-218 Playmat interaction adjudication', () => {
  it('marks and clicks the opponent case despite a sleeping mustBeTargeted character', async () => {
    registerCardDef(D08017);
    registerCardDef(D08005);
    const state = createEmptyGameState();
    state.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.scene = [makeChar({ cardId: D08017.id, uid: 'attacker', state: 'active' })];
    state.players.opp.scene = [makeChar({
      cardId: D08005.id,
      uid: 'must-target',
      state: 'sleep',
      turnEffects: { contactImmune: false, removeOnTurnEnd: false, mustBeTargeted: true },
    })];
    state.players.opp.case = {
      cardId: 'CASE-OPP',
      status: '事件編',
      requiredEvidence: 7,
      colors: ['青'],
    };
    state.players.opp.evidence = [
      { cardId: 'E1', faceUp: false, origin: { turn: 1, via: 'reasoning' } },
    ];
    state.players.self.deck = ['SELF-EVIDENCE'];
    useGameStateStore.setState({ gameState: state });

    const flowPromise = runActionFlow({ player: 'self' });
    act(() => {
      const picker = useTargetPicker();
      picker.pick('attacker');
      picker.confirm();
    });
    await act(async () => Promise.resolve());

    const targetPhase = useTargetPickerStore.getState().phase;
    expect(targetPhase.phase).toBe('picking');
    if (targetPhase.phase === 'picking') {
      expect(targetPhase.candidates).toContain('must-target');
      expect(targetPhase.candidates).toContain('case:opp');
    }

    mountPlaymat(state);
    const caseArea = container!.querySelector<HTMLElement>('.case-area.side-opp');
    expect(caseArea?.classList.contains('case-area--candidate')).toBe(true);
    await act(async () => {
      caseArea!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });
    expect(useConfirmationStore.getState().current?.body).toContain('相手の事件');

    // Avoid the mounted contact driver consuming the just-declared ActionContext.
    unmountPlaymat();
    const confirm = useConfirmationStore.getState();
    const resolver = confirm._resolver!;
    confirm._setCurrent(null);
    confirm._setResolver(null);
    resolver(true);

    await expect(flowPromise).resolves.toEqual({ ok: true });
    const actionId = useGameStateStore.getState().activeActionId;
    expect(actionId).not.toBeNull();
    expect(_getContext(actionId!)?.target).toEqual({ kind: 'case', player: 'opp' });
  });
});
