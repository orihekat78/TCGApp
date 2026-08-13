// Official Q&A cluster: these seven cases share the same printed
// partnerSolveOverride gated by 【黒】 partner. A non-black partner is legal and
// keeps the partner's ordinary 【事件解決】 ability unchanged.
import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { B05118 } from '@/cards/ct-p05/B05118';
import { B05119 } from '@/cards/ct-p05/B05119';
import { B06105 } from '@/cards/ct-p06/B06105';
import { B06106 } from '@/cards/ct-p06/B06106';
import { B06107 } from '@/cards/ct-p06/B06107';
import { B06108 } from '@/cards/ct-p06/B06108';
import { D07024 } from '@/cards/ct-d07/D07024';
import { event } from '@/engine/event';
import { _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { _clearPendingEffectOptionalSide } from '@/engine/effect/resolve-picks';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { partner as partnerMutate } from '@/engine/mutate/partner';
import { game } from '@/engine/read/game';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, EvidenceCard, GameState } from '@/engine/types';

const QA_SUFFIX = '4884b70d9b28923ff8aa12110cd31e8a1dbcc3b34ef9dea7cdc81f1a5b856a9b';
const CASES = [B05118, B05119, B06105, B06106, B06107, B06108, D07024] as const;
const BLACK_PARTNER = 'QA-BLACK-PARTNER';
const RED_PARTNER = 'QA-RED-PARTNER';

function partnerDef(id: string, color: string): CardDef {
  return {
    id,
    no: id,
    kind: 'partner',
    names: [id],
    colors: [color],
    traits: [],
    keywords: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
    lp: 5,
  } as CardDef;
}

function evidence(cardId: string): EvidenceCard {
  return { cardId, faceUp: false, origin: { turn: 1, via: 'effect' } };
}

function solvable(caseId: string, partnerId: string): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  state.players.self.case = {
    cardId: caseId,
    status: '解決編',
    requiredEvidence: 2,
    colors: ['黒'],
    declaredUseCount: {},
  };
  state.players.self.evidence = [evidence('E1'), evidence('E2')];
  state.players.self.partner = {
    cardId: partnerId,
    state: 'active',
    location: 'partner-area',
  } as GameState['players']['self']['partner'];
  return state;
}

beforeEach(() => {
  event._resetRegistry();
  _resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  for (const card of CASES) register(card);
  register(partnerDef(BLACK_PARTNER, '黒'));
  register(partnerDef(RED_PARTNER, '赤'));
  registerTriggeredListener();
});

// Exact Q&A members exercised by every assertion below:
// B05118, B05119, B06105, B06106, B06107, B06108, D07024.
describe.each(CASES)('$id official Q&A — non-black partner keeps ordinary case solve', (caseDef) => {
  const qaId = `card:${caseDef.id}:${QA_SUFFIX}`;

  it(`${qaId}: 赤 partner is legal; ordinary evidence win remains`, () => {
    const state = solvable(caseDef.id, RED_PARTNER);

    expect(game.canPartnerSolveCase(state, 'self'), `${qaId}: public action remains available`).toBe(true);
    expect(game.partnerSolveOverride(state, 'self'), `${qaId}: non-black gate must not rewrite`).toBe(false);

    const after = produce(state, (draft) => partnerMutate.solveCase(draft, 'self'));
    expect(after.gameResult, `${qaId}: ordinary 【事件解決】 remains`).toEqual({
      winner: 'self',
      reason: 'evidence',
    });
    expect(after.players.self.evidence, `${qaId}: ordinary solve does not pay erase-evidence cost`).toHaveLength(2);
  });

  it(`${qaId}: 黒 partner control rewrites case solve to the printed alt-lose path`, () => {
    const state = solvable(caseDef.id, BLACK_PARTNER);

    expect(game.partnerSolveOverride(state, 'self'), `${qaId}: black gate enables rewrite`).toBe(true);
    const after = produce(state, (draft) => partnerMutate.solveCase(draft, 'self'));
    expect(after.gameResult, `${qaId}: rewritten solve`).toEqual({ winner: 'self', reason: 'alt-lose' });
    expect(after.players.self.evidence, `${qaId}: required evidence is erased`).toHaveLength(0);
    expect(after.players.self.partner.state, `${qaId}: printed sleep cost`).toBe('sleep');
  });
});
