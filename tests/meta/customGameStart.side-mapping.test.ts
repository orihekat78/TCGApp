import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerAll } from '@/cards/index';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { declaredNameCandidates } from '@/engine/effect/declared-name-domain';
import type { PlayerState } from '@/engine/types/game-state';
import { BUG_274_PARTNER } from '@/ui/fixtures/bug274PartnerFixture.js';
import { _resetMulliganStore, resolveMulligan, useMulliganStore } from '@/ui/hooks/useMulligan';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../meta-app/src/data/sampleDeck';
import { BUG_274_PARTNER_ID, BUG_274_PUBLIC_DECK } from '../../meta-app/src/data/bug274ValidationDeck';
import type { DeckRecord } from '../../meta-app/src/data/types';
import { customGameStart } from '../../meta-app/src/util/customGameStart';

function expanded(deck: DeckRecord): string[] {
  return deck.cards.flatMap(({ num, count }) => Array.from({ length: count }, () => num)).sort();
}

function mainZoneCards(player: PlayerState): string[] {
  return [
    ...player.deck,
    ...player.hand,
    ...player.file.map((card) => card.cardId),
    ...player.evidence.map((card) => card.cardId),
    ...player.remove,
    ...player.scene.map((card) => card.cardId),
  ].sort();
}

describe('customGameStart P1/P2 binding', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    event._resetRegistry();
    _resetMulliganStore();
    registerAll();
  });

  it('固有partner/case/40枚をside別に保ち、反転した2回目開始でも前回sideを引き継がない', async () => {
    const first = await customGameStart(SAMPLE_DECK, SAMPLE_DECK_OPP, {
      sessionId: 'side-mapping-first', spectator: true, firstPlayer: 'self',
    });
    expect(first.players.self.partner.cardId).toBe(SAMPLE_DECK.partner);
    expect(first.players.self.case.cardId).toBe(SAMPLE_DECK.case);
    expect(mainZoneCards(first.players.self)).toEqual(expanded(SAMPLE_DECK));
    expect(first.players.opp.partner.cardId).toBe(SAMPLE_DECK_OPP.partner);
    expect(first.players.opp.case.cardId).toBe(SAMPLE_DECK_OPP.case);
    expect(mainZoneCards(first.players.opp)).toEqual(expanded(SAMPLE_DECK_OPP));

    const second = await customGameStart(SAMPLE_DECK_OPP, SAMPLE_DECK, {
      sessionId: 'side-mapping-second', spectator: true, firstPlayer: 'opp',
    });
    expect(second.players.self.partner.cardId).toBe(SAMPLE_DECK_OPP.partner);
    expect(second.players.self.case.cardId).toBe(SAMPLE_DECK_OPP.case);
    expect(mainZoneCards(second.players.self)).toEqual(expanded(SAMPLE_DECK_OPP));
    expect(second.players.opp.partner.cardId).toBe(SAMPLE_DECK.partner);
    expect(second.players.opp.case.cardId).toBe(SAMPLE_DECK.case);
    expect(mainZoneCards(second.players.opp)).toEqual(expanded(SAMPLE_DECK));
  });

  it('uses the route-owned session ID for the causal graph allocator', async () => {
    const state = await customGameStart(SAMPLE_DECK, SAMPLE_DECK_OPP, {
      spectator: true,
      firstPlayer: 'self',
      sessionId: 'meta-session-42',
    });

    expect(state.causalLog).toEqual({
      schemaVersion: 1,
      sessionId: 'meta-session-42',
      nextSequence: 3,
    });
    expect(state.log.slice(0, 2)).toEqual([
      expect.objectContaining({ eventId: 'meta-session-42:1', sequence: 1 }),
      expect.objectContaining({ eventId: 'meta-session-42:2', sequence: 2 }),
    ]);
  });

  it('starts the actual BUG-274 public deck after registering its synthetic partner', async () => {
    const state = await customGameStart(BUG_274_PUBLIC_DECK, SAMPLE_DECK_OPP, {
      sessionId: 'bug-274-custom-start', spectator: true, firstPlayer: 'self', bug274Fixture: BUG_274_PUBLIC_DECK,
    });

    expect(state.players.self.partner.cardId).toBe(BUG_274_PARTNER_ID);
    expect(engine.cards.get(BUG_274_PARTNER_ID)).toBeUndefined();
    expect(mainZoneCards(state.players.self)).toEqual(expanded(BUG_274_PUBLIC_DECK));
    expect(state.turn.number).toBe(1);
    expect(state.players.self.hand).toHaveLength(6);
  });

  it('restores the registry before a forged start after canonical BUG-274 success', async () => {
    await customGameStart(BUG_274_PUBLIC_DECK, SAMPLE_DECK_OPP, {
      sessionId: 'bug-274-scoped-success', spectator: true, firstPlayer: 'self', bug274Fixture: BUG_274_PUBLIC_DECK,
    });

    expect(engine.cards.get(BUG_274_PARTNER_ID)).toBeUndefined();
    expect(declaredNameCandidates('unrestricted')).not.toContain(BUG_274_PARTNER.names[0]);
    await expect(customGameStart({ ...BUG_274_PUBLIC_DECK }, SAMPLE_DECK_OPP, {
      sessionId: 'bug-274-forged-after-success', spectator: true, firstPlayer: 'self',
    })).rejects.toThrow();
  });

  it('restores the registry after canonical BUG-274 cancellation without deleting a prior card', async () => {
    const prior = { ...BUG_274_PARTNER, names: ['prior registry card'] };
    engine.cards.register(prior);
    let checks = 0;

    await expect(customGameStart(BUG_274_PUBLIC_DECK, SAMPLE_DECK_OPP, {
      sessionId: 'bug-274-scoped-cancel', spectator: true, firstPlayer: 'self', bug274Fixture: BUG_274_PUBLIC_DECK,
      isSessionCurrent: () => ++checks < 2,
    })).rejects.toThrow(/cancelled/);

    expect(engine.cards.get(BUG_274_PARTNER_ID)).toBe(prior);
    expect(declaredNameCandidates('unrestricted')).not.toContain(BUG_274_PARTNER.names[0]);
  });

  it('does not register the synthetic partner for a persisted BUG-274 identity collision', async () => {
    await expect(customGameStart({ ...BUG_274_PUBLIC_DECK }, SAMPLE_DECK_OPP, {
      sessionId: 'bug-274-forged-start', spectator: true, firstPlayer: 'self',
      bug274Fixture: BUG_274_PUBLIC_DECK,
    })).rejects.toThrow();
    expect(engine.cards.get(BUG_274_PARTNER_ID)).toBeUndefined();
  });

  it('rejects a forged BUG-274 identity while the canonical fixture overlay is active', async () => {
    const canonicalStart = customGameStart(BUG_274_PUBLIC_DECK, SAMPLE_DECK_OPP, {
      sessionId: 'bug-274-overlap-canonical', firstPlayer: 'self',
      bug274Fixture: BUG_274_PUBLIC_DECK,
    });
    await vi.waitFor(() => {
      expect(useMulliganStore.getState().current?.player).toBe('self');
    });

    try {
      await expect(customGameStart({ ...BUG_274_PUBLIC_DECK }, SAMPLE_DECK_OPP, {
        sessionId: 'bug-274-overlap-forged', spectator: true, firstPlayer: 'self',
      })).rejects.toThrow(/BUG-274 fixture identity/);
    } finally {
      resolveMulligan([]);
      await canonicalStart;
    }
    expect(engine.cards.get(BUG_274_PARTNER_ID)).toBeUndefined();
  });

  it('rejects an illegal main deck through the custom start boundary', async () => {
    await expect(customGameStart({
      ...SAMPLE_DECK,
      cards: [{ num: 'D08001', count: 40 }],
    }, SAMPLE_DECK_OPP, {
      sessionId: 'illegal-custom-start', spectator: true, firstPlayer: 'self',
    })).rejects.toThrow(/MAIN_KIND/);
  });
});
