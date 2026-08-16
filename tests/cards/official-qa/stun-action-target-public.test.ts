// qa: card:B01058:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40
// qa: card:B01095:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40
// qa: card:B02083:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40
// qa: card:B03046:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40
// qa: card:B03048:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40
// qa: card:B03054:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40
// qa: card:B03060:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40
// qa: card:B03085:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40
// qa: card:B03092:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40
// qa: card:B03103:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40
// qa: card:D03002:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40
// qa: card:B04042:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B04071:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B04085:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B05032:0dd408dcc0047e0a74d73621e0719a67f2842fc764bd17aba1bb5b5aa322c3b9
// qa: card:B06071:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B06075:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B06094:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B08004:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B08006:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B08035:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B08042:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B09027:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B09046:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B09050:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B09081:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:B09082:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:D06013:782fd0f5160159eba91a381169832f1a1f384ccf91d8654acdd24e0633027f2f
// qa: card:PR157:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// qa: card:PR163:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe
// Rules: 07-action-flow.md.

import { ALL_CARDS, registerAll } from '@/cards';
import { engine } from '@/engine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState, Player, SceneCharacter } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sceneChar } from '../../helpers/fixtures';

const ACTOR = 'QA_STUN_ACTION_ACTOR';
const TARGET = 'QA_STUN_ACTION_TARGET';

function character(id: string): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

function card(cardId: string): CardDef {
  const found = ALL_CARDS.find(candidate => candidate.id === cardId);
  if (!found) throw new Error(`missing shipped card ${cardId}`);
  return found;
}

function hasStunContract(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasStunContract);
  if (value === null || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (item.kind === 'stunChar') return true;
  if (item.verb === 'sceneSetState' && item.args && typeof item.args === 'object' && (item.args as Record<string, unknown>).state === 'stun') return true;
  return Object.values(item).some(hasStunContract);
}

function state(targetState: SceneCharacter['state'], targetOwner: Player): GameState {
  const next = createEmptyGameState();
  next.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  next.players.self.scene = [sceneChar(ACTOR, 'actor', { state: 'active' })];
  next.players[targetOwner].scene.push(sceneChar(TARGET, 'target', { state: targetState }));
  return next;
}

function probe(targetState: SceneCharacter['state'], targetOwner: Player): unknown {
  useGameStateStore.getState().resetMatchSessionState();
  expect(useGameStateStore.getState().setGameState(state(targetState, targetOwner))).toBe(true);
  const result = dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'actor', targetUid: 'target' });
  const store = useGameStateStore.getState();
  const action = store.gameState?.actionContexts?.[store.activeActionId ?? ''];
  return { result, targetUid: action?.target.uid ?? null, actorState: store.gameState?.players.self.scene.find(char => char.uid === 'actor')?.state };
}

function prove(cardId: string): unknown {
  return { contract: hasStunContract(card(cardId)), stun: probe('stun', 'opp'), sleep: probe('sleep', 'opp'), active: probe('active', 'opp'), own: probe('stun', 'self') };
}

const PROOF = {
  contract: true,
  stun: { result: { ok: true }, targetUid: 'target', actorState: 'sleep' },
  sleep: { result: { ok: true }, targetUid: 'target', actorState: 'sleep' },
  active: { result: { ok: false, reason: 'not-allowed' }, targetUid: null, actorState: 'active' },
  own: { result: { ok: false, reason: 'not-allowed' }, targetUid: null, actorState: 'active' },
} as const;

beforeEach(() => {
  engine.event._resetRegistry(); _resetRegistry(); _resetTriggeredRegistered(); _resetTargetExpanders(); registerAll(); register(character(ACTOR)); register(character(TARGET)); registerTriggeredListener();
  endMatchSession(); beginMatchSession('self'); useGameStateStore.getState().resetMatchSessionState();
});

afterEach(() => { endMatchSession(); useGameStateStore.getState().resetMatchSessionState(); _resetTargetExpanders(); });
describe('official QA stunned-character public action targeting', () => {
  it('card:B01058:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40', () => { expect(prove('B01058'), 'B01058').toEqual(PROOF); });
  it('card:B01095:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40', () => { expect(prove('B01095'), 'B01095').toEqual(PROOF); });
  it('card:B02083:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40', () => { expect(prove('B02083'), 'B02083').toEqual(PROOF); });
  it('card:B03046:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40', () => { expect(prove('B03046'), 'B03046').toEqual(PROOF); });
  it('card:B03048:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40', () => { expect(prove('B03048'), 'B03048').toEqual(PROOF); });
  it('card:B03054:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40', () => { expect(prove('B03054'), 'B03054').toEqual(PROOF); });
  it('card:B03060:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40', () => { expect(prove('B03060'), 'B03060').toEqual(PROOF); });
  it('card:B03085:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40', () => { expect(prove('B03085'), 'B03085').toEqual(PROOF); });
  it('card:B03092:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40', () => { expect(prove('B03092'), 'B03092').toEqual(PROOF); });
  it('card:B03103:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40', () => { expect(prove('B03103'), 'B03103').toEqual(PROOF); });
  it('card:D03002:aa0d036ceb280b0e5be3f9445e5df0b58ecd48763914b7de9a13ba5d8ded9b40', () => { expect(prove('D03002'), 'D03002').toEqual(PROOF); });
  it('card:B04042:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B04042'), 'B04042').toEqual(PROOF); });
  it('card:B04071:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B04071'), 'B04071').toEqual(PROOF); });
  it('card:B04085:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B04085'), 'B04085').toEqual(PROOF); });
  it('card:B05032:0dd408dcc0047e0a74d73621e0719a67f2842fc764bd17aba1bb5b5aa322c3b9', () => { expect(prove('B05032'), 'B05032').toEqual(PROOF); });
  it('card:B06071:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B06071'), 'B06071').toEqual(PROOF); });
  it('card:B06075:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B06075'), 'B06075').toEqual(PROOF); });
  it('card:B06094:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B06094'), 'B06094').toEqual(PROOF); });
  it('card:B08004:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B08004'), 'B08004').toEqual(PROOF); });
  it('card:B08006:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B08006'), 'B08006').toEqual(PROOF); });
  it('card:B08035:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B08035'), 'B08035').toEqual(PROOF); });
  it('card:B08042:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B08042'), 'B08042').toEqual(PROOF); });
  it('card:B09027:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B09027'), 'B09027').toEqual(PROOF); });
  it('card:B09046:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B09046'), 'B09046').toEqual(PROOF); });
  it('card:B09050:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B09050'), 'B09050').toEqual(PROOF); });
  it('card:B09081:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B09081'), 'B09081').toEqual(PROOF); });
  it('card:B09082:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('B09082'), 'B09082').toEqual(PROOF); });
  it('card:D06013:782fd0f5160159eba91a381169832f1a1f384ccf91d8654acdd24e0633027f2f', () => { expect(prove('D06013'), 'D06013').toEqual(PROOF); });
  it('card:PR157:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('PR157'), 'PR157').toEqual(PROOF); });
  it('card:PR163:bd2d9135e77cd20272d351740bbc65e757a5096d00d80aecf99990dff33779fe', () => { expect(prove('PR163'), 'PR163').toEqual(PROOF); });
});

// qa: card:B04042:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B04071:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B04085:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B06071:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B06075:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B07041:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B07054:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B08004:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B08035:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B08042:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B09027:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B09046:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B09047:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B09050:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:B09082:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:PR157:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333
// qa: card:PR163:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333

function proveStunLifecycle(cardId: string): unknown {
  const initial = createEmptyGameState();
  initial.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  initial.players.self.deck = [ACTOR, TARGET, ACTOR];
  initial.players.self.scene = [sceneChar(TARGET, 'target', { state: 'active' })];
  const stunned = structuredClone(initial);
  engine.mutate.scene.setState(stunned, 'target', 'stun');
  const sleepRequested = structuredClone(stunned);
  engine.mutate.scene.setState(sleepRequested, 'target', 'sleep');
  const stunRequested = structuredClone(stunned);
  engine.mutate.scene.setState(stunRequested, 'target', 'stun');
  const effectActivated = structuredClone(stunned);
  engine.mutate.scene.tryActivate(effectActivated, 'target');
  const autoActivated = structuredClone(stunned);
  engine.flow.runAutoPhase(autoActivated, 'self');
  const targetState = (value: GameState) => value.players.self.scene.find(char => char.uid === 'target')?.state;
  return {
    contract: hasStunContract(card(cardId)),
    applied: targetState(stunned),
    sleepRequest: targetState(sleepRequested),
    stunRequest: targetState(stunRequested),
    effectActivation: targetState(effectActivated),
    autoActivation: targetState(autoActivated),
  };
}

const STUN_LIFECYCLE_PROOF = {
  contract: true,
  applied: 'stun',
  sleepRequest: 'stun',
  stunRequest: 'stun',
  effectActivation: 'sleep',
  autoActivation: 'sleep',
} as const;

describe('official QA stun state lifecycle', () => {
  it('card:B04042:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B04042'), 'B04042').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B04071:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B04071'), 'B04071').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B04085:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B04085'), 'B04085').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B06071:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B06071'), 'B06071').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B06075:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B06075'), 'B06075').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B07041:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B07041'), 'B07041').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B07054:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B07054'), 'B07054').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B08004:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B08004'), 'B08004').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B08035:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B08035'), 'B08035').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B08042:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B08042'), 'B08042').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B09027:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B09027'), 'B09027').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B09046:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B09046'), 'B09046').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B09047:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B09047'), 'B09047').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B09050:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B09050'), 'B09050').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B09082:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('B09082'), 'B09082').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:PR157:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('PR157'), 'PR157').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:PR163:49f9f1cd1ade4da46a546a2984aa239d8eef7b3362d5bec6997d6d6c7d32e333', () => { expect(proveStunLifecycle('PR163'), 'PR163').toEqual(STUN_LIFECYCLE_PROOF); });
});

// qa: card:B01058:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18
// qa: card:B01095:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18
// qa: card:B02052:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18
// qa: card:B02083:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18
// qa: card:B03046:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18
// qa: card:B03048:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18
// qa: card:B03054:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18
// qa: card:B03060:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18
// qa: card:B03085:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18
// qa: card:B03092:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18
// qa: card:B03103:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18
// qa: card:B05032:b358181e7fb698606f1cdf3a8cbb96db5309131066a98e55cb22bc9ec4a62e74

describe('official QA stun state lifecycle for early products', () => {
  it('card:B01058:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18', () => { expect(proveStunLifecycle('B01058'), 'B01058').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B01095:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18', () => { expect(proveStunLifecycle('B01095'), 'B01095').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B02052:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18', () => { expect(proveStunLifecycle('B02052'), 'B02052').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B02083:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18', () => { expect(proveStunLifecycle('B02083'), 'B02083').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B03046:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18', () => { expect(proveStunLifecycle('B03046'), 'B03046').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B03048:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18', () => { expect(proveStunLifecycle('B03048'), 'B03048').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B03054:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18', () => { expect(proveStunLifecycle('B03054'), 'B03054').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B03060:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18', () => { expect(proveStunLifecycle('B03060'), 'B03060').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B03085:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18', () => { expect(proveStunLifecycle('B03085'), 'B03085').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B03092:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18', () => { expect(proveStunLifecycle('B03092'), 'B03092').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B03103:7d12c26b5b7d34de08871ace2ae1d5c66d5ff2a06642ecfba6fe7d92a6b5ba18', () => { expect(proveStunLifecycle('B03103'), 'B03103').toEqual(STUN_LIFECYCLE_PROOF); });
  it('card:B05032:b358181e7fb698606f1cdf3a8cbb96db5309131066a98e55cb22bc9ec4a62e74', () => { expect(proveStunLifecycle('B05032'), 'B05032').toEqual(STUN_LIFECYCLE_PROOF); });
});
