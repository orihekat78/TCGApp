// BUG-140 reopened: deferred real-card abilities B05039 / B06035.
// rules: 09-cutin-disguise.md, 10-action-event.md, 15-abilities-effects.md, 17-icons.md

import { beforeEach, describe, expect, it } from 'vitest';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { registerAll } from '@/cards';
import { B05039 } from '@/cards/ct-p05/B05039';
import { B06035 } from '@/cards/ct-p06/B06035';
import { event } from '@/engine/event';
import { resolveEffectPicks, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { cutIn } from '@/engine/flow/contact';
import { removeOpponentEvidenceTop } from '@/engine/flow/action-case';
import {
  _drainPendingHirameki,
  _resetHiramekiRegistered,
  _resetPendingHirameki,
  registerHiramekiListener,
} from '@/engine/listeners/hirameki';
import {
  _resetTriggeredRegistered,
  registerTriggeredListener,
} from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { produce } from '@/engine/produce';
import { def as readDef, register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { ActionContext, CardDef, EffectCtx, GameState } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';

type Player = 'self' | 'opp';
const globals = globalThis as { __humanPlayerSide?: Player | null };

function character(id: string, traits: string[] = []): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'], level: 3,
    ap: 3000, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

function caseCard(id: string, traits: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'case', names: [id], colors: ['緑'], traits: [],
    caseLevel: 6, caseTraits: traits, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const DETECTIVE = character('DETECTIVE', ['探偵']);
const NON_DETECTIVE = character('NON_DETECTIVE');
const DEFENDER = character('DEFENDER');
const VICTIM = character('VICTIM');
const CASE_YAIBA = caseCard('CASE_YAIBA', ['YAIBA']);
const CASE_PLAIN = caseCard('CASE_PLAIN', []);

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetHiramekiRegistered();
  _resetPendingHirameki();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerAll();
  for (const card of [DETECTIVE, NON_DETECTIVE, DEFENDER, VICTIM, CASE_YAIBA, CASE_PLAIN]) registerCardDef(card);
  registerTriggeredListener();
  registerHiramekiListener();
  globals.__humanPlayerSide = null;
  useGameStateStore.setState({
    gameState: null,
    activeActionId: null,
    pendingHirameki: null,
    pendingEffectPick: null,
    pendingEffectOptional: null,
  });
});

function contactState(actorCardId: string, turnPlayer: Player): {
  state: GameState;
  action: ActionContext;
  selfContactUid: string;
} {
  let state = createEmptyGameState();
  let selfContactUid = '';
  let attackerUid = '';
  let defenderUid = '';
  state = produce(state, draft => {
    draft.turn = { number: 3, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
    const selfCard = turnPlayer === 'self' ? actorCardId : 'DEFENDER';
    const oppCard = turnPlayer === 'self' ? 'DEFENDER' : actorCardId;
    const selfChar = mutate.scene.enter(draft, 'self', selfCard, { active: true });
    const oppChar = mutate.scene.enter(draft, 'opp', oppCard, { active: true });
    selfContactUid = selfChar.uid;
    attackerUid = turnPlayer === 'self' ? selfChar.uid : oppChar.uid;
    defenderUid = turnPlayer === 'self' ? oppChar.uid : selfChar.uid;
    draft.players.self.hand = ['B05039'];
    draft.players.self.deck = ['NON_DETECTIVE'];
  });
  const action = {
    id: 'ax', byUid: attackerUid, byPlayer: turnPlayer,
    target: { kind: 'char', uid: defenderUid }, phase: 'action-1', cutInUsed: {},
    startedAt: { turn: 3, nano: 0 }, contactImmune: false,
  } as ActionContext;
  return { state, action, selfContactUid };
}

describe('B05039 cut-in', () => {
  it('自分ターン＋探偵にカットイン: AP+1000して1枚引く', () => {
    const { state, action, selfContactUid } = contactState('DETECTIVE', 'self');
    const after = produce(state, draft => {
      cutIn(draft, action, 'self', 'B05039');
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.scene.find(c => c.uid === selfContactUid)!.turnEffects.apMod_contact).toBe(1000);
    expect(after.players.self.hand).toEqual(['NON_DETECTIVE']);
  });

  it('自分ターン＋非探偵: AP+1000のみでドローしない', () => {
    const { state, action, selfContactUid } = contactState('NON_DETECTIVE', 'self');
    const after = produce(state, draft => {
      cutIn(draft, action, 'self', 'B05039');
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.scene.find(c => c.uid === selfContactUid)!.turnEffects.apMod_contact).toBe(1000);
    expect(after.players.self.hand).toEqual([]);
    expect(after.players.self.deck).toEqual(['NON_DETECTIVE']);
  });

  it('相手ターンでも使用は可能だが、AP上昇もドローもない', () => {
    const { state, action, selfContactUid } = contactState('DETECTIVE', 'opp');
    const after = produce(state, draft => {
      cutIn(draft, action, 'self', 'B05039');
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.hand).toEqual([]);
    expect(after.players.self.remove).toContain('B05039');
    expect(after.players.self.scene.find(c => c.uid === selfContactUid)!.turnEffects.apMod_contact).toBeUndefined();
    expect(after.players.self.deck).toEqual(['NON_DETECTIVE']);
  });
});

function hiramekiBoard(caseId = 'CASE_YAIBA', status: '事件編' | '解決編' = '解決編'): {
  state: GameState;
  attackerUid: string;
  victimUid: string;
} {
  let state = createEmptyGameState();
  let attackerUid = '';
  let victimUid = '';
  state = produce(state, draft => {
    draft.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    draft.players.self.case.cardId = caseId;
    draft.players.self.case.status = status;
    draft.players.self.evidence = [{ cardId: 'B06035', faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
    draft.players.self.hand = ['NON_DETECTIVE'];
    attackerUid = mutate.scene.enter(draft, 'opp', 'DETECTIVE', { active: true }).uid;
    victimUid = mutate.scene.enter(draft, 'opp', 'VICTIM', { active: true }).uid;
  });
  return { state, attackerUid, victimUid };
}

function removeEvidenceByAction(state: GameState, attackerUid: string): GameState {
  return produce(state, draft => {
    const action = {
      id: 'ax-case', byUid: attackerUid, byPlayer: 'opp',
      target: { kind: 'case', player: 'self' }, phase: 'judge', startedAt: { turn: 4, nano: 0 },
    } as ActionContext;
    removeOpponentEvidenceTop(draft, action);
  });
}

function fireHumanHirameki(state: GameState, attackerUid: string): void {
  globals.__humanPlayerSide = 'self';
  const afterEvidence = removeEvidenceByAction(state, attackerUid);
  const pending = _drainPendingHirameki();
  expect(pending).not.toBeNull();
  useGameStateStore.setState({ gameState: afterEvidence, pendingHirameki: pending });
  expect(dispatchEngineAction({ type: 'hiramekiResolve', choice: 'fire' }).ok).toBe(true);
}

describe('B06035 hirameki', () => {
  it('human: 手札1枚をリムーブし、選んだキャラ1枚をリムーブする', () => {
    const { state, attackerUid, victimUid } = hiramekiBoard();
    fireHumanHirameki(state, attackerUid);
    expect(useGameStateStore.getState().pendingEffectOptional).not.toBeNull();
    expect(dispatchEngineAction({ type: 'optionalResolve', run: true }).ok).toBe(true);
    let pick = useGameStateStore.getState().pendingEffectPick!;
    expect(pick.candidates.map(c => c.cardId)).toEqual(['NON_DETECTIVE']);
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: pick.candidates[0]!.uid }).ok).toBe(true);
    pick = useGameStateStore.getState().pendingEffectPick!;
    expect(pick.nMin).toBe(0);
    expect(pick.candidates.map(c => c.uid)).toContain(victimUid);
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: victimUid }).ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand).not.toContain('NON_DETECTIVE');
    expect(after.players.self.remove).toContain('NON_DETECTIVE');
    expect(after.players.opp.scene.some(c => c.uid === victimUid)).toBe(false);
    expect(after.players.opp.remove).toContain('VICTIM');
  });

  it('human: コスト支払い後もキャラ選択を0枚にできる', () => {
    const { state, attackerUid } = hiramekiBoard();
    fireHumanHirameki(state, attackerUid);
    dispatchEngineAction({ type: 'optionalResolve', run: true });
    const handPick = useGameStateStore.getState().pendingEffectPick!;
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: handPick.candidates[0]!.uid });
    expect(useGameStateStore.getState().pendingEffectPick!.nMin).toBe(0);
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null }).ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene).toHaveLength(2);
    expect(after.players.self.remove).toContain('NON_DETECTIVE');
  });

  it('human: 手札リムーブ自体を辞退でき、後続pickは出ない', () => {
    const { state, attackerUid } = hiramekiBoard();
    fireHumanHirameki(state, attackerUid);
    expect(dispatchEngineAction({ type: 'optionalResolve', run: false }).ok).toBe(true);
    const after = useGameStateStore.getState();
    expect(after.pendingEffectPick).toBeNull();
    expect(after.gameState!.players.self.hand).toEqual(['NON_DETECTIVE']);
    expect(after.gameState!.players.opp.scene).toHaveLength(2);
  });

  it('AI: 手札があるとコストと対象選択を連鎖解決できる', () => {
    const { state, attackerUid } = hiramekiBoard();
    const afterEvidence = removeEvidenceByAction(state, attackerUid);
    const pending = _drainPendingHirameki()!;
    const after = produce(afterEvidence, draft => {
      const ability = readDef.card(pending.cardId)!.abilities.find(a => a.id === pending.abilityId)!;
      const ctx: EffectCtx = {
        source: { player: pending.player, cardId: pending.cardId, abilityId: pending.abilityId, area: 'evidence' },
        bindings: {},
        triggerPayload: { player: pending.player, ev: { cardId: pending.cardId }, byUid: pending.actorUid },
      };
      const policy = new HeuristicPolicy();
      const resolved = resolveEffectPicks(draft, ability.effect!, ctx, {
        chooseAtomTarget: policy.chooseAtomTarget?.bind(policy),
        byPlayer: pending.player,
        humanChooser: false,
        source: { cardId: pending.cardId, abilityId: pending.abilityId },
      });
      event.queue(draft, resolved, ctx.source, 'evidence:remove-by-action', ctx.triggerPayload);
      runAllUntilEmpty(draft);
      _drainAllEffectPicksForTest(draft, policy);
      runAllUntilEmpty(draft);
      _drainAllEffectPicksForTest(draft, policy);
    });
    expect(after.players.self.hand).toEqual([]);
    expect(after.players.self.remove).toContain('NON_DETECTIVE');
    expect(after.players.opp.scene).toHaveLength(1);
    expect(after.players.opp.remove).toHaveLength(1);
  });

  it.each([
    ['事件編は不成立', 'CASE_YAIBA', '事件編'],
    ['YAIBA以外は不成立', 'CASE_PLAIN', '解決編'],
  ] as const)('%s', (_label, caseId, status) => {
    const { state, attackerUid } = hiramekiBoard(caseId, status);
    removeEvidenceByAction(state, attackerUid);
    expect(_drainPendingHirameki()).toMatchObject({ effectValid: false });
  });

  it('実カードdescriptorはYAIBA＋解決編のANDとoptional chainを持つ', () => {
    const ability = B06035.abilities.find(a => a.id === 'a2');
    expect(B05039.abilities.find(a => a.id === 'a2')).toBeDefined();
    expect(ability?.condition).toEqual({
      kind: 'and',
      cs: [{ kind: 'caseTrait', trait: 'YAIBA' }, { kind: 'caseStatus', status: '解決編' }],
    });
    expect(ability?.effect).toMatchObject({ kind: 'optional', effect: { kind: 'chain' } });
  });
});
