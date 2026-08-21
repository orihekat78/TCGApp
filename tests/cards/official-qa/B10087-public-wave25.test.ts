// qa: card:B10087:0c9d0e7ac8e1aeccc9186815ebf6f4fcbc776e2193db1d43e5cd7294a9e3a664
// qa: card:B10087:0e4e42e4ae6216fb7c06cd07c5665d923e192e6f375dabc5f91cb4647586ac8a
// qa: card:B10087:14f6a9ae4b39e8a287431a630194c3adbb9316e4afdf6e1daa7217bc83641752
// qa: card:B10087:15fc7f08cce00e26caa258973864068bcd68794a37ad8e012cecfd8f6e667ffa
// qa: card:B10087:542ab6e3f7d75da819c1080bf11434effdeba716a7f2264c24dd990a9e4f4e40
// qa: card:B10087:56f1f553b65560fe6698737c584af90699e48b45686974049d74894f8ff57d03
// qa: card:B10087:83c10bd676d76ff59ce664bdceecc99838cc134971127fe52c8c32712509b176
// qa: card:B10087:aa5ae6d3fafba3a39ab31b8d9a6c77fa48ffe0250bcc2f7f0fa80f888a0f9ad6
// qa: card:B10087:d85a5d9b20bb3e792c9123f9d16b94f2b131bdf46624605a33275e28740109c6
// qa: card:B10087:e181ecc5ff42276b972552333d25f166d75ed1e16e91c22bc84ec257d6f2d8ae
// Rules: 07-action-flow.md, 08-contact.md, 09-cutin-disguise.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md.

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B10087 } from '@/cards/ct-p10/B10087';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow/index.js';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { AbilityDef, CardDef, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const NOOP_CUTIN = 'QA_B10087_NOOP_CUTIN';
const DRAW_CUTIN = 'QA_B10087_DRAW_CUTIN';
const DISGUISE = 'QA_B10087_DISGUISE';
const TARGET = 'QA_B10087_TARGET';
const PROTECTED = 'QA_B10087_PROTECTED';
const ATTACKER = 'QA_B10087_ATTACKER';
const VICTIM = 'QA_B10087_VICTIM';
const BLACK_PARTNER = 'QA_B10087_BLACK_PARTNER';
const CUTIN_DRAW = 'QA_B10087_CUTIN_DRAW';
const GIN_DRAW = 'QA_B10087_GIN_DRAW';
const TAIL = 'QA_B10087_TAIL';

function character(id: string, options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黒'], level: 1,
    ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...options,
  } as CardDef;
}

const noopAbility: AbilityDef = {
  id: 'cutin', type: 'triggered', scope: 'on-hand',
  condition: { kind: 'caseStatus', status: '解決編' },
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: 'condition-false cut-in', ruleRefs: [],
};

const drawAbility: AbilityDef = {
  id: 'cutin', type: 'triggered', scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  description: 'draw cut-in', ruleRefs: [],
};

const fixtures: CardDef[] = [
  character(NOOP_CUTIN, { keywords: ['カットイン'], abilities: [noopAbility] }),
  character(DRAW_CUTIN, { keywords: ['カットイン'], abilities: [drawAbility] }),
  character(DISGUISE, {
    ap: 4000,
    abilities: [{ id: 'disguise', type: 'icon-disguise', description: 'disguise', ruleRefs: [] }],
  }),
  character(TARGET, { ap: 2000 }),
  character(PROTECTED, {
    ap: 3000,
    abilities: [{
      id: 'protected', type: 'continuous', scope: 'on-scene',
      continuousModifier: { untargetableByOppEffect: true },
      description: 'opponent effect protection', ruleRefs: [],
    }],
  }),
  character(ATTACKER, { ap: 5000 }),
  character(VICTIM, { ap: 1000 }),
  character(BLACK_PARTNER, { kind: 'partner', level: 0 }),
  character(CUTIN_DRAW),
  character(GIN_DRAW),
  character(TAIL),
];

type Hook = 'action:declare' | 'action:guard-window' | 'action:guarded'
  | 'action:unguarded' | 'contact:start' | 'contact:end' | 'action:end';

function hookCounter(): Record<Hook, number> {
  const counts = {
    'action:declare': 0, 'action:guard-window': 0, 'action:guarded': 0,
    'action:unguarded': 0, 'contact:start': 0, 'contact:end': 0, 'action:end': 0,
  } satisfies Record<Hook, number>;
  for (const hook of Object.keys(counts) as Hook[]) event.on(hook, () => { counts[hook] += 1; });
  return counts;
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing B10087 Wave 25 game state');
  return state;
}

function install(state: GameState): void {
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
  surfacePendingSideChannels();
}

function ownerOf(uid: string): Player {
  return current().players.self.scene.some(character => character.uid === uid) ? 'self' : 'opp';
}

type ContactChoice = { kind: 'cutin'; cardId: string } | { kind: 'disguise'; cardId: string };

function driveContact(actionId: string, ginUid: string, choice?: ContactChoice): boolean {
  let used = false;
  for (let step = 0; step < 18; step += 1) {
    const context = flow.action._getContext(current(), actionId);
    if (!context) return used;
    if (context.phase === 'action-1' || context.phase === 'action-2' || context.phase === 'action-1-redo') {
      const actingUid = context.phase === 'action-2' ? context.secondUid : context.firstUid;
      const player = ownerOf(actingUid!);
      const useChoice = choice && !used && player === 'self' && actingUid === ginUid;
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player,
        choice: useChoice ? choice : { kind: 'pass' },
      })).toEqual({ ok: true });
      if (useChoice) used = true;
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
  throw new Error(`B10087 contact ${actionId} did not finish`);
}

type Role = 'attacker' | 'target' | 'guard';

function normalContact(role: Role, cutinCardId: string, deck: string[]): void {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: role === 'attacker' ? 'self' : 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.status = '事件編';
  state.players.self.hand = [cutinCardId];
  state.players.self.deck = [...deck];
  state.players.self.scene = role === 'attacker'
    ? [makeChar({ cardId: B10087.id, uid: 'gin', state: 'active' })]
    : role === 'target'
      ? [makeChar({ cardId: B10087.id, uid: 'gin', state: 'sleep' })]
      : [
        makeChar({ cardId: VICTIM, uid: 'victim', state: 'sleep' }),
        makeChar({ cardId: B10087.id, uid: 'gin', state: 'active' }),
      ];
  state.players.opp.scene = role === 'attacker'
    ? [makeChar({ cardId: TARGET, uid: 'target', state: 'sleep' })]
    : [makeChar({ cardId: ATTACKER, uid: 'attacker', state: 'active' })];
  install(state);

  expect(dispatchEngineAction({
    type: 'actionDeclareChar',
    byUid: role === 'attacker' ? 'gin' : 'attacker',
    targetUid: role === 'attacker' ? 'target' : role === 'target' ? 'gin' : 'victim',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({
    type: 'actionGuard', actionId, guarderUid: role === 'guard' ? 'gin' : null,
  })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(driveContact(actionId, 'gin', { kind: 'cutin', cardId: cutinCardId })).toBe(true);
}

function effectEntryState(handExtra: string, deck: string[]): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = ['黒'];
  state.players.self.case.status = '事件編';
  state.players.self.partner = { cardId: BLACK_PARTNER, state: 'active' };
  state.players.self.file = Array.from({ length: 8 }, () => ({ type: 'card-back' as const, cardId: TAIL }));
  state.players.self.hand = [B10087.id, handExtra];
  state.players.self.deck = [...deck];
  state.players.opp.scene = [
    makeChar({ cardId: TARGET, uid: 'target', state: 'active' }),
    makeChar({ cardId: PROTECTED, uid: 'protected', state: 'active' }),
  ];
  return state;
}

function startEffectContact(state: GameState): { actionId: string; ginUid: string } {
  install(state);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B10087.id })).toEqual({ ok: true });
  surfacePendingSideChannels();
  const optional = useGameStateStore.getState().pendingEffectOptional;
  expect(optional?.source).toMatchObject({ cardId: B10087.id, abilityId: 'a2' });
  expect(dispatchEngineAction(bindPendingDecision(optional!, {
    type: 'optionalResolve', run: true,
  }))).toEqual({ ok: true });
  surfacePendingSideChannels();
  const pick = useGameStateStore.getState().pendingEffectPick;
  expect(pick?.candidates.map(candidate => candidate.uid)).toEqual(['target']);
  expect(dispatchEngineAction(bindPendingDecision(pick!, {
    type: 'effectPickResolve', pickedUid: 'target',
  }))).toEqual({ ok: true });
  const ginUid = current().players.self.scene.find(character => character.cardId === B10087.id)?.uid;
  const actionId = useGameStateStore.getState().activeActionId;
  expect(ginUid).toBeTruthy();
  expect(actionId).toBeTruthy();
  return { actionId: actionId!, ginUid: ginUid! };
}

function resetHarness(): void {
  endMatchSession();
  event._resetRegistry();
  flow.action._resetActionContexts();
  _resetRegistry();
  _resetTriggeredRegistered();
  [B10087, ...fixtures].forEach(register);
  registerTriggeredListener();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  useGameStateStore.getState().resetMatchSessionState();
  useGameStateStore.setState({ gameState: null });
}

beforeEach(() => resetHarness());

afterEach(() => {
  endMatchSession();
  flow.action._resetActionContexts();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('B10087 official QA through public actions and decisions', () => {
  it('resolves the selected cut-in before Gin draws and still draws when that cut-in condition fails', () => {
    const resolutionOrder: string[] = [];
    const stop = event.on('effect:resolve:start', (state, payload) => {
      const effectId = (payload as { effectId?: unknown }).effectId;
      const entry = state.pendingEffects.find(candidate => candidate.id === effectId);
      if (entry && [DRAW_CUTIN, B10087.id].includes(entry.source.cardId ?? '')) {
        resolutionOrder.push(entry.source.cardId!);
      }
    });
    try {
      normalContact('attacker', DRAW_CUTIN, [CUTIN_DRAW, GIN_DRAW, TAIL]);
      expect(current().players.self.hand).toEqual([CUTIN_DRAW, GIN_DRAW]);
      expect(resolutionOrder).toEqual([DRAW_CUTIN, B10087.id]);
    } finally {
      stop();
    }

    for (const role of ['attacker', 'target', 'guard'] as const) {
      resetHarness();
      normalContact(role, NOOP_CUTIN, [GIN_DRAW, TAIL]);
      expect(current().players.self.hand).toEqual([GIN_DRAW]);
    }
  });

  it('starts a normal contact against an active unprotected target without action or guard accounting', () => {
    const hooks = hookCounter();
    const { actionId, ginUid } = startEffectContact(effectEntryState(
      NOOP_CUTIN,
      [NOOP_CUTIN, NOOP_CUTIN, NOOP_CUTIN, GIN_DRAW, TAIL],
    ));
    expect(flow.action._getContext(current(), actionId)).toMatchObject({
      byUid: ginUid, generatedByEffect: true, phase: 'action-1', target: { kind: 'char', uid: 'target' },
    });
    expect(current().players.self.scene.find(character => character.uid === ginUid)).toMatchObject({
      state: 'active', turnEffects: expect.not.objectContaining({ actedCharThisTurn: true }),
    });
    expect(current().players.opp.scene.find(character => character.uid === 'target')?.state).toBe('active');
    expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'protected' }))
      .toEqual({ ok: false, reason: 'not-allowed' });

    expect(driveContact(actionId, ginUid, { kind: 'cutin', cardId: NOOP_CUTIN })).toBe(true);
    expect(current().players.self.hand).toContain(GIN_DRAW);
    expect(hooks).toEqual({
      'action:declare': 0, 'action:guard-window': 0, 'action:guarded': 0,
      'action:unguarded': 0, 'contact:start': 1, 'contact:end': 1, 'action:end': 0,
    });
  });

  it('permits a public disguise during the effect-generated contact', () => {
    const { actionId, ginUid } = startEffectContact(effectEntryState(
      DISGUISE,
      [NOOP_CUTIN, NOOP_CUTIN, NOOP_CUTIN, TAIL],
    ));
    expect(driveContact(actionId, ginUid, { kind: 'disguise', cardId: DISGUISE })).toBe(true);
    expect(current().players.self.scene.find(character => character.uid === ginUid)?.cardId).toBe(DISGUISE);
    expect(current().players.self.hand).not.toContain(DISGUISE);
    expect(current().players.self.deck.at(-1)).toBe(B10087.id);
  });

  it('cannot choose the top three when only two cards remain', () => {
    const state = effectEntryState(NOOP_CUTIN, [NOOP_CUTIN, NOOP_CUTIN]);
    const beforeDeck = [...state.players.self.deck];
    install(state);
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: B10087.id })).toEqual({ ok: true });
    surfacePendingSideChannels();
    const optional = useGameStateStore.getState().pendingEffectOptional;
    expect(dispatchEngineAction(bindPendingDecision(optional!, {
      type: 'optionalResolve', run: true,
    }))).toEqual({ ok: true });

    expect(current().players.self.deck).toEqual(beforeDeck);
    expect(current().players.self.remove).toEqual([]);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(useGameStateStore.getState().activeActionId).toBeNull();
  });
});
