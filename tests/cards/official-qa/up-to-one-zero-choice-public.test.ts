// qa: card:B03007:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B03018:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B03036:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B03053:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B03056:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B03086:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B03115:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B03122:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B04024:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B05020:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B05057:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B05060:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B05082:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B06088:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B07035:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B09079:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B10054:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:D07019:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:PR061:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:PR065:3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d
// qa: card:B05016:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:B06048:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:B07073:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:B08016:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:B08020:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:B08026:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:B08050:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:B09062:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:B09074:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:B10010:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// qa: card:PR271:3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd
// Rules: 15-abilities-effects.md, 26-qa-deck-refresh.md.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAll } from '@/cards';
import { event } from '@/engine/event';
import { startCausalSession } from '@/engine/log/causal';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetRegistry, def as readDef, register } from '@/engine/read/def';
import { pendingOwnerOrderGroup } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { makeChar } from '../../helpers/fixtures';

const QA = '3cada4780b82701609f8e4c75c86d3f91df8c47707c56f10d15dda452743609d';
const QA_ENTER = '3ff94362a5adf45433f46c7c052d2cf4a4edfc526106d85c5cf811bd4c11c7cd';
const ATTACKER = 'QA-UP-TO-ATTACKER';
const SENTINEL = 'QA-UP-TO-SENTINEL';
const DECOY = 'QA-UP-TO-DECOY';
const PRIOR_TARGET = 'QA-UP-TO-PRIOR';
type Obj = Record<string, unknown>;

function asObj(value: unknown): Obj | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Obj : undefined;
}

function findAtom(value: unknown, verb: string): Obj | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAtom(item, verb);
      if (found) return found;
    }
    return undefined;
  }
  const object = asObj(value);
  if (!object) return undefined;
  if (object.kind === 'atom' && object.verb === verb) return object;
  for (const child of Object.values(object)) {
    const found = findAtom(child, verb);
    if (found) return found;
  }
  return undefined;
}

function first(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  return Array.isArray(value) && typeof value[0] === 'string' ? value[0] : undefined;
}

function matchingCard(cardId: string, args: Obj): CardDef {
  const filterAny = Array.isArray(args.filterAny) ? asObj(args.filterAny[0]) : undefined;
  const filter = filterAny ?? asObj(args.filter) ?? {};
  const kind = filter.kind === 'event' ? 'event' : 'character';
  const name = first(filter.cardName) ?? cardId;
  const color = first(filter.color) ?? '青';
  const trait = first(filter.trait);
  const keyword = first(filter.keyword);
  return {
    id: cardId,
    no: cardId,
    kind,
    names: [name],
    colors: [color],
    level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: trait ? [trait] : [],
    keywords: keyword ? [keyword] : [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function fixtureCard(id: string, ap = 1000): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1, ap, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing game state');
  return state;
}

function install(state: GameState, label: string): void {
  endMatchSession();
  beginMatchSession('self');
  startCausalSession(state, label);
  resetPresentationQueue(label);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function removeThroughPublicContact(): void {
  expect(dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'source' })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'self', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionContact', actionId, player: 'opp', choice: { kind: 'pass' } })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  expect(dispatchEngineAction({ type: 'actionJudge', actionId })).toEqual({ ok: true });
}

function installDeckLook(card: CardDef, targetId: string, deck = [targetId]) {
  const state = createEmptyGameState();
  const isLeave = card.id === 'B03018' || card.id === 'B05020';
  state.turn = { number: 6, player: isLeave ? 'opp' : 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = card.id === 'B10054' ? ['赤', '黄'] : [...card.colors];
  if (card.id === 'B08016') {
    state.players.self.case.colors = ['青', '黒'];
    state.players.self.case.status = '事件編';
  }
  if (card.id === 'B06048') state.players.self.case.status = '解決編';
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
  state.players.self.deck = card.id === 'B09074' && deck.length === 1
    ? [`${DECOY}-DRAW`, deck[0]!, DECOY, `${DECOY}-2`, `${DECOY}-3`]
    : [...deck];
  state.players.self.hand = [card.id, SENTINEL];
  if (card.id === 'B07035') state.players.self.case.status = '解決編';
  if (isLeave) {
    state.players.self.scene = [makeChar({ cardId: card.id, uid: 'source', state: 'sleep' })];
    state.players.opp.scene = [makeChar({ cardId: ATTACKER, uid: 'attacker', state: 'active' })];
  } else {
    state.players.self.hand.unshift(card.id);
    if (card.id === 'B03115') {
      state.players.opp.scene = [makeChar({ cardId: PRIOR_TARGET, uid: 'prior-target', state: 'sleep' })];
    }
  }
  install(state, `qa-up-to-${card.id}`);
  if (isLeave) removeThroughPublicContact();
  else expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id })).toEqual({ ok: true });
  if (isLeave) return { uid: 'source', area: 'scene' as const };
  if (card.kind === 'event') {
    return { uid: `hand:self:${card.id}`, area: 'hand' as const, resolutionKind: 'normal-event' as const };
  }
  const entered = current().players.self.scene.find(sceneCard => sceneCard.cardId === card.id);
  if (!entered) throw new Error(`${card.id}: used character did not enter the scene`);
  if (card.id === 'B09074') {
    const entries = current().pendingEffects.filter(entry =>
      entry.state === 'pending' && entry.source.uid === entered.uid && entry.source.cardId === card.id);
    expect(entries.map(entry => entry.source.abilityId).sort(), 'B09074 simultaneous enter effects').toEqual(['a1', 'a2']);
    const deckLook = entries.find(entry => entry.source.abilityId === 'a2')!;
    expect(dispatchEngineAction({ type: 'setEffectOrder', entryId: deckLook.id, order: 0, player: 'self' })).toEqual({ ok: true });
    const ordered = pendingOwnerOrderGroup(current(), 'self');
    expect(dispatchEngineAction({
      type: 'resolveEffectOrder', player: 'self', entryIds: ordered.map(entry => entry.id),
    })).toEqual({ ok: true });
  }
  return { uid: entered.uid, area: 'scene' as const };
}

function deckLookPending(cardId: string) {
  for (let index = 0; index < 6; index += 1) {
    const optional = useGameStateStore.getState().pendingEffectOptional;
    if (optional) {
      expect(optional.source.cardId, `${cardId}: preceding optional source`).toBe(cardId);
      expect(dispatchEngineAction(bindPendingDecision(optional, { type: 'optionalResolve', run: true }))).toEqual({ ok: true });
      continue;
    }
    const pending = useGameStateStore.getState().pendingEffectPick;
    if (!pending) throw new Error(`${cardId}: missing pending pick`);
    if (pending.atomVerb === 'deckRevealUntil') return pending;
    expect(pending.nMin, `${cardId}: preceding choice minimum`).toBe(cardId === 'B07073' ? 1 : 0);
    const preceding = cardId === 'B03115'
      ? pending.candidates.find(candidate => candidate.uid === 'prior-target')?.uid ?? null
      : cardId === 'B07073'
        ? pending.candidates.find(candidate => candidate.cardId === SENTINEL)?.uid ?? null
        : null;
    expect(dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid: preceding }))).toEqual({ ok: true });
  }
  throw new Error(`${cardId}: deck look was not reached`);
}

function settle(preferredCardIds: readonly string[] = []): void {
  if (useGameStateStore.getState().pendingDeckReveal) useGameStateStore.getState().setPendingDeckReveal(null);
  for (let index = 0; index < 4 && useGameStateStore.getState().pendingEffectPick; index += 1) {
    const pending = useGameStateStore.getState().pendingEffectPick!;
    const preferred = pending.candidates.find(candidate => preferredCardIds.includes(candidate.cardId));
    expect(preferred !== undefined || pending.nMin === 0, `${pending.source.cardId}: unresolved mandatory tail`).toBe(true);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve',
      pickedUid: preferred?.uid ?? null,
    }))).toEqual({ ok: true });
  }
  const reorder = useGameStateStore.getState().pendingDeckReorder;
  if (reorder) {
    expect(dispatchEngineAction(bindPendingDecision(reorder, {
      type: 'deckReorderResolve', order: [...reorder.cardIds],
    }))).toEqual({ ok: true });
  }
  const actionId = useGameStateStore.getState().activeActionId;
  for (let index = 0; index < 2 && actionId && useGameStateStore.getState().activeActionId === actionId; index += 1) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
}

function terminalCleared(): boolean {
  const store = useGameStateStore.getState();
  return store.pendingEffectPick === null
    && store.pendingDeckReorder === null
    && store.activeActionId === null
    && current().pendingEffects.every(item => item.state === 'resolved');
}

function proveDeckLookBranch(cardId: string, selectMatch: boolean) {
  const card = readDef.card(cardId)!;
  const ability = card.abilities.find(item => findAtom(item.effect, 'deckRevealUntil'))!;
  const args = asObj(findAtom(ability.effect, 'deckRevealUntil')!.args)!;
  const targetId = `QA-UP-TO-POS-${cardId}`;
  if (selectMatch) register(matchingCard(targetId, args));
  installDeckLook(card, targetId, selectMatch ? [targetId, DECOY] : [DECOY]);
  const pending = deckLookPending(cardId);
  const selected = pending.candidates.find(candidate => candidate.cardId === targetId);
  expect(pending.candidates.map(candidate => candidate.cardId)).toEqual(selectMatch ? [targetId] : []);
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve',
    pickedUid: selected?.uid ?? null,
  }))).toEqual({ ok: true });
  settle([SENTINEL, targetId]);
  const state = current();
  const zones = state.players.self;
  const targetCopies = zones.hand.filter(id => id === targetId).length
    + zones.deck.filter(id => id === targetId).length
    + zones.remove.filter(id => id === targetId).length
    + zones.scene.filter(char => char.cardId === targetId).length;
  return {
    selected: selected?.cardId ?? null,
    targetInHand: zones.hand.includes(targetId),
    targetInScene: zones.scene.some(char => char.cardId === targetId),
    targetCopies,
    decoyInHand: zones.hand.includes(DECOY),
    decoyCopies: zones.deck.filter(id => id === DECOY).length + zones.remove.filter(id => id === DECOY).length,
    sentinelInHand: zones.hand.includes(SENTINEL),
    priorResolved: cardId !== 'B03115'
      || zones.remove.includes(PRIOR_TARGET)
      || state.players.opp.remove.includes(PRIOR_TARGET),
    terminalCleared: terminalCleared(),
  };
}

function proveRemovePickBranch(selectMatch: boolean) {
  const card = readDef.card('B03053')!;
  const targetId = 'QA-UP-TO-POS-B03053';
  if (selectMatch) register({ ...fixtureCard(targetId), names: ['鈴木史郎'], traits: ['鈴木財閥'] });
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...card.colors];
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
  state.players.self.hand = [card.id, SENTINEL];
  state.players.self.remove = [selectMatch ? targetId : DECOY];
  install(state, `qa-up-to-branch-B03053-${selectMatch ? 'positive' : 'none'}`);
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id })).toEqual({ ok: true });
  const pending = useGameStateStore.getState().pendingEffectPick;
  if (!pending) {
    expect(selectMatch, 'B03053 only auto-skips when no eligible remove card exists').toBe(false);
    settle([SENTINEL]);
    return {
      selected: null,
      targetInHand: false,
      targetInRemove: false,
      decoyInRemove: current().players.self.remove.includes(DECOY),
      sentinelInHand: current().players.self.hand.includes(SENTINEL),
      terminalCleared: terminalCleared(),
    };
  }
  const selected = pending.candidates.find(candidate => candidate.cardId === targetId);
  expect(pending.candidates.map(candidate => candidate.cardId)).toEqual(selectMatch ? [targetId] : []);
  expect(dispatchEngineAction(bindPendingDecision(pending, {
    type: 'effectPickResolve',
    pickedUid: selected?.uid ?? null,
  }))).toEqual({ ok: true });
  settle([SENTINEL]);
  return {
    selected: selected?.cardId ?? null,
    targetInHand: current().players.self.hand.includes(targetId),
    targetInRemove: current().players.self.remove.includes(targetId),
    decoyInRemove: current().players.self.remove.includes(DECOY),
    sentinelInHand: current().players.self.hand.includes(SENTINEL),
    terminalCleared: terminalCleared(),
  };
}

function proveDeckLook(cardId: string) {
  const card = readDef.card(cardId);
  if (!card) throw new Error(`${cardId}: missing CardDef`);
  const ability = card.abilities.find(item => findAtom(item.effect, 'deckRevealUntil'));
  const atom = ability && findAtom(ability.effect, 'deckRevealUntil');
  const args = atom && asObj(atom.args);
  if (!ability || !args || args.chooseMatch !== 'upTo') throw new Error(`${cardId}: missing up-to deck look`);
  const targetId = `QA-UP-TO-${cardId}`;
  register(matchingCard(targetId, args));
  const sourceAuthority = installDeckLook(card, targetId);
  const pending = deckLookPending(cardId);
  const proof = {
    contract: args.chooseMatch,
    source: {
      cardId: pending.source.cardId,
      abilityId: pending.source.abilityId,
      area: pending.source.area,
      uidMatchesOrigin: pending.source.uid === sourceAuthority.uid,
      ...(sourceAuthority.resolutionKind ? { resolutionKind: pending.source.resolutionKind } : {}),
    },
    range: [pending.nMin, pending.nMax],
    candidates: pending.candidates.map(item => item.cardId),
  };
  expect(dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid: null }))).toEqual({ ok: true });
  settle();
  return {
    ...proof,
    targetInHand: current().players.self.hand.includes(targetId),
    targetCopies: current().players.self.deck.filter(id => id === targetId).length
      + current().players.self.remove.filter(id => id === targetId).length,
    sameCardSiblingInHand: current().players.self.hand.filter(id => id === cardId).length,
    sentinelInHand: current().players.self.hand.includes(SENTINEL),
    priorResolved: cardId !== 'B03115' || current().players.opp.scene.every(card => card.uid !== 'prior-target'),
    terminalCleared: terminalCleared(),
  };
}

function expectedDeckLook(cardId: string) {
  const card = readDef.card(cardId)!;
  const isLeave = cardId === 'B03018' || cardId === 'B05020';
  return {
    contract: 'upTo',
    source: {
      cardId,
      abilityId: 'a1',
      area: isLeave ? 'scene' : card.kind === 'event' ? 'hand' : 'scene',
      uidMatchesOrigin: true,
      ...(card.kind === 'event' ? { resolutionKind: 'normal-event' } : {}),
    },
    range: [0, 1],
    candidates: [`QA-UP-TO-${cardId}`],
    targetInHand: false,
    targetCopies: 1,
    sameCardSiblingInHand: 1,
    sentinelInHand: true,
    priorResolved: true,
    terminalCleared: true,
  };
}

function expectedEnterDeckLook(cardId: string, abilityId: string) {
  return {
    contract: 'upTo',
    source: { cardId, abilityId, area: 'scene', uidMatchesOrigin: true },
    range: [0, 1],
    candidates: [`QA-UP-TO-${cardId}`],
    targetInHand: false,
    targetCopies: 1,
    sameCardSiblingInHand: 1,
    sentinelInHand: cardId !== 'B07073',
    priorResolved: true,
    terminalCleared: true,
  };
}

function proveRemovePick() {
  const card = readDef.card('B03053')!;
  const ability = card.abilities.find(item => findAtom(item.effect, 'handAddFromRemove'))!;
  const atom = findAtom(ability.effect, 'handAddFromRemove')!;
  const args = asObj(atom.args)!;
  const targetId = 'QA-UP-TO-B03053';
  register({ ...fixtureCard(targetId), names: ['鈴木史郎'], traits: ['鈴木財閥'] });
  const state = createEmptyGameState();
  state.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case.colors = [...card.colors];
  state.players.self.file = Array.from({ length: 10 }, () => ({ type: 'card-back' as const, cardId: 'FILE' }));
  state.players.self.hand = [card.id, card.id, SENTINEL];
  state.players.self.remove = [targetId];
  install(state, 'qa-up-to-B03053');
  expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: card.id })).toEqual({ ok: true });
  const entered = current().players.self.scene.find(sceneCard => sceneCard.cardId === card.id);
  if (!entered) throw new Error('B03053: used character did not enter the scene');
  const pending = useGameStateStore.getState().pendingEffectPick!;
  const proof = {
    contract: args.max,
    source: {
      cardId: pending.source.cardId,
      abilityId: pending.source.abilityId,
      area: pending.source.area,
      uidMatchesOrigin: pending.source.uid === entered.uid,
    },
    atomVerb: pending.atomVerb,
    range: [pending.nMin, pending.nMax],
    candidates: pending.candidates.map(item => item.cardId),
  };
  expect(dispatchEngineAction(bindPendingDecision(pending, { type: 'effectPickResolve', pickedUid: null }))).toEqual({ ok: true });
  settle();
  return {
    ...proof,
    targetInHand: current().players.self.hand.includes(targetId),
    targetInRemove: current().players.self.remove.includes(targetId),
    sameCardSiblingInHand: current().players.self.hand.filter(id => id === card.id).length,
    sentinelInHand: current().players.self.hand.includes(SENTINEL),
    terminalCleared: terminalCleared(),
  };
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  registerAll();
  register(fixtureCard(ATTACKER, 9000));
  register(fixtureCard(SENTINEL));
  register(fixtureCard(DECOY));
  register(fixtureCard(`${DECOY}-2`));
  register(fixtureCard(`${DECOY}-3`));
  register(fixtureCard(`${DECOY}-DRAW`));
  register(fixtureCard(PRIOR_TARGET));
  registerTriggeredListener();
  endMatchSession();
  beginMatchSession('self');
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  vi.restoreAllMocks();
  endMatchSession();
  useGameStateStore.getState().setGameState(null);
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('official QA: an up-to-one match may be declined through public dispatch', () => {
  it(`card:B03007:${QA}`, () => expect(proveDeckLook('B03007'), 'B03007 public zero choice').toEqual(expectedDeckLook('B03007')));
  it(`card:B03018:${QA}`, () => expect(proveDeckLook('B03018'), 'B03018 public zero choice').toEqual(expectedDeckLook('B03018')));
  it(`card:B03036:${QA}`, () => expect(proveDeckLook('B03036'), 'B03036 public zero choice').toEqual(expectedDeckLook('B03036')));
  it(`card:B03053:${QA}`, () => expect(proveRemovePick(), 'B03053 public zero choice').toEqual({
    contract: 1, source: { cardId: 'B03053', abilityId: 'a2', area: 'scene', uidMatchesOrigin: true }, atomVerb: 'handAddFromRemove',
    range: [0, 1], candidates: ['QA-UP-TO-B03053'], targetInHand: false, targetInRemove: true,
    sameCardSiblingInHand: 1, sentinelInHand: true, terminalCleared: true,
  }));
  it(`card:B03056:${QA}`, () => expect(proveDeckLook('B03056'), 'B03056 public zero choice').toEqual(expectedDeckLook('B03056')));
  it(`card:B03086:${QA}`, () => expect(proveDeckLook('B03086'), 'B03086 public zero choice').toEqual(expectedDeckLook('B03086')));
  it(`card:B03115:${QA}`, () => expect(proveDeckLook('B03115'), 'B03115 public zero choice').toEqual(expectedDeckLook('B03115')));
  it(`card:B03122:${QA}`, () => expect(proveDeckLook('B03122'), 'B03122 public zero choice').toEqual(expectedDeckLook('B03122')));
  it(`card:B04024:${QA}`, () => expect(proveDeckLook('B04024'), 'B04024 public zero choice').toEqual(expectedDeckLook('B04024')));
  it(`card:B05020:${QA}`, () => expect(proveDeckLook('B05020'), 'B05020 public zero choice').toEqual(expectedDeckLook('B05020')));
  it(`card:B05057:${QA}`, () => expect(proveDeckLook('B05057'), 'B05057 public zero choice').toEqual(expectedDeckLook('B05057')));
  it(`card:B05060:${QA}`, () => expect(proveDeckLook('B05060'), 'B05060 public zero choice').toEqual(expectedDeckLook('B05060')));
  it(`card:B05082:${QA}`, () => expect(proveDeckLook('B05082'), 'B05082 public zero choice').toEqual(expectedDeckLook('B05082')));
  it(`card:B06088:${QA}`, () => expect(proveDeckLook('B06088'), 'B06088 public zero choice').toEqual(expectedDeckLook('B06088')));
  it(`card:B07035:${QA}`, () => expect(proveDeckLook('B07035'), 'B07035 public zero choice').toEqual(expectedDeckLook('B07035')));
  it(`card:B09079:${QA}`, () => expect(proveDeckLook('B09079'), 'B09079 public zero choice').toEqual(expectedDeckLook('B09079')));
  it(`card:B10054:${QA}`, () => expect(proveDeckLook('B10054'), 'B10054 public zero choice').toEqual(expectedDeckLook('B10054')));
  it(`card:D07019:${QA}`, () => expect(proveDeckLook('D07019'), 'D07019 public zero choice').toEqual(expectedDeckLook('D07019')));
  it(`card:PR061:${QA}`, () => expect(proveDeckLook('PR061'), 'PR061 public zero choice').toEqual(expectedDeckLook('PR061')));
  it(`card:PR065:${QA}`, () => expect(proveDeckLook('PR065'), 'PR065 public zero choice').toEqual(expectedDeckLook('PR065')));
});

describe('official QA: enter-triggered up-to-one matches may also be declined', () => {
  it(`card:B05016:${QA_ENTER}`, () => expect(proveDeckLook('B05016'), 'B05016 public enter zero choice').toEqual(expectedEnterDeckLook('B05016', 'a1')));
  it(`card:B06048:${QA_ENTER}`, () => expect(proveDeckLook('B06048'), 'B06048 public enter zero choice').toEqual(expectedEnterDeckLook('B06048', 'a1')));
  it(`card:B07073:${QA_ENTER}`, () => expect(proveDeckLook('B07073'), 'B07073 public enter zero choice').toEqual(expectedEnterDeckLook('B07073', 'a2')));
  it(`card:B08016:${QA_ENTER}`, () => expect(proveDeckLook('B08016'), 'B08016 public enter zero choice').toEqual(expectedEnterDeckLook('B08016', 'a1')));
  it(`card:B08020:${QA_ENTER}`, () => expect(proveDeckLook('B08020'), 'B08020 public enter zero choice').toEqual(expectedEnterDeckLook('B08020', 'a1')));
  it(`card:B08026:${QA_ENTER}`, () => expect(proveDeckLook('B08026'), 'B08026 public enter zero choice').toEqual(expectedEnterDeckLook('B08026', 'a1')));
  it(`card:B08050:${QA_ENTER}`, () => expect(proveDeckLook('B08050'), 'B08050 public enter zero choice').toEqual(expectedEnterDeckLook('B08050', 'a2')));
  it(`card:B09062:${QA_ENTER}`, () => expect(proveDeckLook('B09062'), 'B09062 public enter zero choice').toEqual(expectedEnterDeckLook('B09062', 'a1')));
  it(`card:B09074:${QA_ENTER}`, () => expect(proveDeckLook('B09074'), 'B09074 public enter zero choice').toEqual(expectedEnterDeckLook('B09074', 'a2')));
  it(`card:B10010:${QA_ENTER}`, () => expect(proveDeckLook('B10010'), 'B10010 public enter zero choice').toEqual(expectedEnterDeckLook('B10010', 'a2')));
  it(`card:PR271:${QA_ENTER}`, () => expect(proveDeckLook('PR271'), 'PR271 public enter zero choice').toEqual(expectedEnterDeckLook('PR271', 'a1')));

  it('B08026 shuffles only the five looked cards below the untouched deck tail', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const card = readDef.card('B08026')!;
    const args = asObj(findAtom(card.abilities[0]!.effect, 'deckRevealUntil')!.args)!;
    const targetId = 'QA-UP-TO-B08026-SHUFFLED';
    register(matchingCard(targetId, args));
    installDeckLook(card, targetId, [
      targetId, DECOY, `${DECOY}-2`, `${DECOY}-3`, `${DECOY}-DRAW`, SENTINEL, PRIOR_TARGET,
    ]);
    const pending = deckLookPending(card.id);
    expect(dispatchEngineAction(bindPendingDecision(pending, {
      type: 'effectPickResolve', pickedUid: null,
    }))).toEqual({ ok: true });

    expect(useGameStateStore.getState().pendingDeckReorder).toBeNull();
    expect(current().players.self.deck).toEqual([
      SENTINEL, PRIOR_TARGET, DECOY, `${DECOY}-2`, `${DECOY}-3`, `${DECOY}-DRAW`, targetId,
    ]);
    settle();
    expect(terminalCleared()).toBe(true);
  });
});

function expectDeckRepresentative(cardId: string, options: { discard?: boolean; enter?: boolean } = {}): void {
  const targetId = `QA-UP-TO-POS-${cardId}`;
  expect(proveDeckLookBranch(cardId, true), `${cardId} public positive branch`).toEqual({
    selected: targetId,
    targetInHand: options.enter !== true,
    targetInScene: options.enter === true,
    targetCopies: 1,
    decoyInHand: false,
    decoyCopies: 1,
    sentinelInHand: options.discard !== true,
    priorResolved: true,
    terminalCleared: true,
  });
  expect(proveDeckLookBranch(cardId, false), `${cardId} public no-match branch`).toEqual({
    selected: null,
    targetInHand: false,
    targetInScene: false,
    targetCopies: 0,
    decoyInHand: false,
    decoyCopies: 1,
    sentinelInHand: true,
    priorResolved: true,
    terminalCleared: true,
  });
}

describe('official QA: representative positive and no-match continuations stay card-bound', () => {
  it('B03007 keeps the match and gates its discard', () => expectDeckRepresentative('B03007', { discard: true }));
  it('B03018 completes the opponent-turn leave and shuffle', () => expectDeckRepresentative('B03018'));
  it('B03086 removes the revealed remainder', () => expectDeckRepresentative('B03086'));
  it('B03115 resolves the prior scene pick before its match and discard', () => expectDeckRepresentative('B03115', { discard: true }));
  it('B07035 applies filterAny and the solved-case discard gate', () => expectDeckRepresentative('B07035', { discard: true }));
  it('B10054 applies the two-color and matched-level discard gates', () => expectDeckRepresentative('B10054', { discard: true }));
  it('B05082 settles its event remainder and downstream scene entry', () => expectDeckRepresentative('B05082', { enter: true }));
  it('B03053 gates discard on the exact remove-area choice', () => {
    expect(proveRemovePickBranch(true), 'B03053 public positive branch').toEqual({
      selected: 'QA-UP-TO-POS-B03053', targetInHand: true, targetInRemove: false,
      decoyInRemove: false, sentinelInHand: false, terminalCleared: true,
    });
    expect(proveRemovePickBranch(false), 'B03053 public no-match branch').toEqual({
      selected: null, targetInHand: false, targetInRemove: false,
      decoyInRemove: true, sentinelInHand: true, terminalCleared: true,
    });
  });
});
