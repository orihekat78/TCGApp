import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards/index';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import type { PlayerState } from '@/engine/types/game-state';
import { SAMPLE_DECK, SAMPLE_DECK_OPP } from '../../meta-app/src/data/sampleDeck';
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
    registerAll();
  });

  it('固有partner/case/40枚をside別に保ち、反転した2回目開始でも前回sideを引き継がない', async () => {
    const first = await customGameStart(SAMPLE_DECK, SAMPLE_DECK_OPP, { spectator: true, firstPlayer: 'self' });
    expect(first.players.self.partner.cardId).toBe(SAMPLE_DECK.partner);
    expect(first.players.self.case.cardId).toBe(SAMPLE_DECK.case);
    expect(mainZoneCards(first.players.self)).toEqual(expanded(SAMPLE_DECK));
    expect(first.players.opp.partner.cardId).toBe(SAMPLE_DECK_OPP.partner);
    expect(first.players.opp.case.cardId).toBe(SAMPLE_DECK_OPP.case);
    expect(mainZoneCards(first.players.opp)).toEqual(expanded(SAMPLE_DECK_OPP));

    const second = await customGameStart(SAMPLE_DECK_OPP, SAMPLE_DECK, { spectator: true, firstPlayer: 'opp' });
    expect(second.players.self.partner.cardId).toBe(SAMPLE_DECK_OPP.partner);
    expect(second.players.self.case.cardId).toBe(SAMPLE_DECK_OPP.case);
    expect(mainZoneCards(second.players.self)).toEqual(expanded(SAMPLE_DECK_OPP));
    expect(second.players.opp.partner.cardId).toBe(SAMPLE_DECK.partner);
    expect(second.players.opp.case.cardId).toBe(SAMPLE_DECK.case);
    expect(mainZoneCards(second.players.opp)).toEqual(expanded(SAMPLE_DECK));
  });
});
