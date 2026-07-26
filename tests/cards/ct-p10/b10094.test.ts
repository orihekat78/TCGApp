import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { enumerateMoves } from '@/ai/move-enumerator';
import { REUSE_CARDS } from '@/cards';
import { B10094 } from '@/cards/ct-p10/B10094';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canActivateDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { produce } from '@/engine/produce';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import { candidates } from '@/engine/target/candidates';
import type { CardDef, GameState } from '@/engine/types';
import { enumDeclaredAbilitySources } from '@/ui/hooks/useActionsPanelFlow/enumerators';
import { sceneChar } from '../../helpers/fixtures';

const PA_CHAR: CardDef = { id: 'PA_CHAR', no: 'PA_CHAR', kind: 'character', names: ['PAキャラ'], colors: ['白'], level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const PA_EVENT: CardDef = { id: 'PA_EVENT', no: 'PA_EVENT', kind: 'event', names: ['PAイベント'], colors: ['白'], traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const PA_OTHER: CardDef = { id: 'PA_OTHER', no: 'PA_OTHER', kind: 'case', names: ['除外対象'], colors: ['白'], traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const REAL_PARTNER: CardDef = { id: 'REAL_PARTNER', no: 'REAL_PARTNER', kind: 'character', names: ['本体パートナー'], colors: ['白'], level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const PA_MR: CardDef = { id: 'PA_MR', no: 'PA_MR', kind: 'character', names: ['PA MR'], colors: ['白'], level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'MR', imageUrl: '', abilities: [], ruleRefs: [] };

const globals = globalThis as { __humanPlayerSide?: 'self' | 'opp' | null };

function base(): GameState {
  return produce(createEmptyGameState(), (draft) => {
    draft.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    draft.players.opp.partner.cardId = 'REAL_PARTNER';
    draft.players.opp.partnerAreaCards = ['PA_EVENT', 'PA_CHAR', 'PA_EVENT', 'PA_OTHER'];
    draft.players.opp.partnerAreaMR = sceneChar('PA_MR', 'partnerMR:opp');
  });
}

function activateAndGetPick(state: GameState, uid: string) {
  let activated = produce(state, (draft) => activateDeclaredAbility(draft, uid, 'a1'));
  const immediate = _drainPendingEffectPickSide();
  if (immediate) return { activated: structuredClone(activated), pick: immediate };
  activated = structuredClone(activated);
  runAllUntilEmpty(activated);
  return { activated, pick: _drainPendingEffectPickSide() };
}

beforeEach(() => {
  globals.__humanPlayerSide = 'self';
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _clearPendingEffectPickQueue();
  [B10094, PA_CHAR, PA_EVENT, PA_OTHER, REAL_PARTNER, PA_MR].forEach(register);
  registerTriggeredListener();
});

afterEach(() => { globals.__humanPlayerSide = null; });

describe('B10094 犯人', () => {
  it('matches the official metadata and declares from scene plus face-up evidence / FILE', () => {
    expect(B10094).toMatchObject({
      id: 'B10094', no: '1149/B10094', kind: 'character', names: ['犯人'], colors: ['黒'], level: 4, ap: 4000, lp: 0,
      traits: ['犯人'], rarity: 'C', imageUrl: '1783904232373960.jpg',
    });
    expect(B10094.abilities[0]).toMatchObject({
      type: 'declared', scope: 'on-evidence-file', cost: { kind: 'selfToRemove' },
      effect: { kind: 'atom', verb: 'partnerAreaRemove', args: { player: 'opp', cardIds: '$pick.cardIds' } },
    });
    expect(REUSE_CARDS.filter(card => card.id === 'B10094')).toEqual([B10094]);
    expect(new Set(REUSE_CARDS.map(card => card.id)).size).toBe(REUSE_CARDS.length);

    const scene = produce(base(), (draft) => { draft.players.self.scene = [sceneChar('B10094', 'scene-src')]; });
    const evidence = produce(base(), (draft) => { draft.players.self.evidence = [{ cardId: 'B10094', faceUp: true, origin: 'action' }]; });
    const file = produce(base(), (draft) => { draft.players.self.file = [{ type: 'card-back', cardId: 'B10094', faceUp: true }]; });
    for (const [state, uid] of [[scene, 'scene-src'], [evidence, 'evidence:self:0'], [file, 'file:self:0']] as const) {
      expect(canActivateDeclaredAbility(state, uid, 'a1')).toBe(true);
      const { activated, pick } = activateAndGetPick(state, uid);
      expect(activated.players.self.remove).toContain('B10094');
      expect(pick?.source).toMatchObject({ cardId: 'B10094', abilityId: 'a1' });
    }
  });

  it('offers only opponent general-PA characters/events; real partner and PA-MR remain excluded', () => {
    const state = produce(base(), (draft) => { draft.players.self.scene = [sceneChar('B10094', 'src')]; });
    expect(candidates(state, B10094.abilities[0]!.effect!.kind === 'atom'
      ? B10094.abilities[0]!.effect!.args.target as never
      : {} as never, { source: { player: 'self', area: 'scene' }, bindings: {} } as never).map(candidate => candidate.cardId)).toEqual(['PA_EVENT', 'PA_CHAR', 'PA_EVENT']);
    const { pick } = activateAndGetPick(state, 'src');

    expect(pick?.candidates.map(candidate => candidate.cardId)).toEqual(['PA_EVENT', 'PA_CHAR', 'PA_EVENT']);
    expect(pick?.candidates.every(candidate => candidate.area === 'partner-area' && candidate.player === 'opp')).toBe(true);
  });

  it('removes the selected duplicate PA occurrence exactly, without a scene leave hook', () => {
    const state = produce(base(), (draft) => { draft.players.self.scene = [sceneChar('B10094', 'src')]; });
    const { activated, pick } = activateAndGetPick(state, 'src');
    const selected = pick!.candidates.find(candidate => candidate.cardId === 'PA_EVENT' && candidate.index === 2)!;
    const leaveHooks: unknown[] = [];
    event.on('leave:to-remove', (_draft, payload) => { leaveHooks.push(payload); });

    applyPickAndContinuation(activated, pick!, selected.uid);

    expect(activated.players.opp.partnerAreaCards).toEqual(['PA_EVENT', 'PA_CHAR', 'PA_OTHER']);
    expect(activated.players.opp.remove).toEqual(['PA_EVENT']);
    expect(leaveHooks).toEqual([]);
  });

  it('fails closed when the chosen PA occurrence changes before resolution', () => {
    const state = produce(base(), (draft) => { draft.players.self.scene = [sceneChar('B10094', 'src')]; });
    const { activated, pick } = activateAndGetPick(state, 'src');
    const selected = pick!.candidates.find(candidate => candidate.cardId === 'PA_EVENT' && candidate.index === 2)!;
    activated.players.opp.partnerAreaCards!.splice(2, 1);
    const before = [...activated.players.opp.partnerAreaCards!];

    applyPickAndContinuation(activated, pick!, selected.uid);

    expect(activated.players.opp.partnerAreaCards).toEqual(before);
    expect(activated.players.opp.remove).toEqual([]);
    expect(activated.log.at(-1)).toMatchObject({ action: 'effect:partnerAreaRemove', result: 'stale-selection' });
  });

  it('allows target zero and keeps the source payment; UI/AI enumerate every legal source occurrence', () => {
    const noTarget = produce(base(), (draft) => {
      draft.players.self.scene = [sceneChar('B10094', 'scene-src')];
      draft.players.opp.partnerAreaCards = ['PA_OTHER'];
    });
    const after = structuredClone(noTarget);
    activateDeclaredAbility(after, 'scene-src', 'a1');
    runAllUntilEmpty(after);
    expect(after.players.self.remove).toEqual(['B10094']);
    expect(after.players.opp.partnerAreaCards).toEqual(['PA_OTHER']);
    expect(_drainPendingEffectPickSide()).toBeNull();

    const sources = produce(base(), (draft) => {
      draft.players.self.scene = [sceneChar('B10094', 'scene-src')];
      draft.players.self.evidence = [{ cardId: 'B10094', faceUp: true, origin: 'action' }];
      draft.players.self.file = [{ type: 'card-back', cardId: 'B10094', faceUp: true }];
    });
    expect(enumDeclaredAbilitySources(sources, 'self')).toEqual(['scene-src', 'evidence:self:0', 'file:self:0']);
    expect(enumerateMoves(sources, 'self').filter(move => move.kind === 'declaredAbility')).toEqual([
      { kind: 'declaredAbility', uid: 'scene-src', abilityId: 'a1' },
      { kind: 'declaredAbility', uid: 'evidence:self:0', abilityId: 'a1' },
      { kind: 'declaredAbility', uid: 'file:self:0', abilityId: 'a1' },
    ]);
  });
});
