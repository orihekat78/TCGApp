import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards/index.js';
import { B02052 } from '@/cards/ct-p02/B02052.js';
import { B02052P } from '@/cards/ct-p02/B02052P.js';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def.js';
import { createEmptyGameState } from '@/engine/state-factory.js';
import { mutate } from '@/engine/mutate/index.js';
import { _drainPendingSetCardReplacementSide } from '@/engine/effect/pending-state.js';
import { applySetCardReplacement } from '@/engine/effect/apply-pick.js';
import type { CardDef } from '@/engine/types';

const KAITOU: CardDef = { id: 'KAITOU', no: 'test/KAITOU', kind: 'character', names: ['怪盗'], colors: ['白'], level: 5, ap: 0, lp: 1, traits: ['怪盗'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const DECOY: CardDef = { id: 'DECOY', no: 'test/DECOY', kind: 'character', names: ['探偵'], colors: ['白'], level: 5, ap: 0, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

beforeEach(() => {
  resetDefRegistry(); registerAll(); registerCardDef(KAITOU); registerCardDef(DECOY);
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

describe('B02052 トランプ銃', () => {
  it('moves a face-up occurrence to another own 怪盗 instead of removing it, then records turn-1 on that occurrence', () => {
    const s = createEmptyGameState(); s.turn.player = 'opp';
    const from = mutate.scene.enter(s, 'self', 'KAITOU', {});
    const to = mutate.scene.enter(s, 'self', 'KAITOU', {});
    mutate.scene.enter(s, 'self', 'DECOY', {});
    mutate.char.setCard(s, from.uid, 'B02052', true);
    expect(mutate.char.removeOneSetCard(s, from.uid)).toBeNull();
    expect(s.players.self.remove).toEqual([]);
    expect(s.players.self.scene.find((c) => c.uid === from.uid)?.setCards).toHaveLength(0);
    expect(s.players.self.scene.find((c) => c.uid === to.uid)?.setCards.map((e) => e.cardId)).toEqual(['B02052']);
    expect(mutate.char.removeOneSetCard(s, to.uid)).toBe('B02052');
    expect(s.players.self.remove).toEqual(['B02052']);
  });

  it('offers the owner a target or decline without exposing a face-down card, and rejects the decoy target', () => {
    const s = createEmptyGameState(); s.turn.player = 'opp';
    const from = mutate.scene.enter(s, 'self', 'KAITOU', {});
    const to = mutate.scene.enter(s, 'self', 'KAITOU', {});
    const decoy = mutate.scene.enter(s, 'self', 'DECOY', {});
    mutate.char.setCard(s, from.uid, 'B02052', true);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    expect(mutate.char.removeOneSetCard(s, from.uid)).toBeNull();
    const pending = _drainPendingSetCardReplacementSide();
    expect(pending?.candidates.map((c) => c.uid)).toEqual([to.uid]);
    expect(pending?.candidates.map((c) => c.uid)).not.toContain(decoy.uid);
    applySetCardReplacement(s, pending!, to.uid);
    expect(s.players.self.scene.find((c) => c.uid === to.uid)?.setCards.map((e) => e.cardId)).toEqual(['B02052']);
  });

  it('also relocates before its host leaves the scene', () => {
    const s = createEmptyGameState(); s.turn.player = 'opp';
    const from = mutate.scene.enter(s, 'self', 'KAITOU', {});
    const to = mutate.scene.enter(s, 'self', 'KAITOU', {});
    mutate.char.setCard(s, from.uid, 'B02052', true);
    mutate.scene.removeToRemove(s, from.uid, 'effect');
    expect(s.players.self.remove).toEqual(['KAITOU']);
    expect(s.players.self.scene.find((c) => c.uid === to.uid)?.setCards.map((e) => e.cardId)).toEqual(['B02052']);
  });

  it('suspends a human host leave, then resumes the same removal after target selection', () => {
    const s = createEmptyGameState(); s.turn.player = 'opp';
    const from = mutate.scene.enter(s, 'self', 'KAITOU', {});
    const to = mutate.scene.enter(s, 'self', 'KAITOU', {});
    mutate.char.setCard(s, from.uid, 'B02052', true);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const result = mutate.scene.removeToRemove(s, from.uid, 'effect');
    expect(result.deferred).toBe(true);
    expect(s.players.self.scene.some((c) => c.uid === from.uid)).toBe(true);
    const pending = _drainPendingSetCardReplacementSide();
    expect(pending?.resume).toMatchObject({ kind: 'scene-remove', cause: 'effect' });
    applySetCardReplacement(s, pending!, to.uid);
    expect(s.players.self.scene.some((c) => c.uid === from.uid)).toBe(false);
    expect(s.players.self.remove).toEqual(['KAITOU']);
    expect(s.players.self.scene.find((c) => c.uid === to.uid)?.setCards.map((e) => e.cardId)).toEqual(['B02052']);
  });

  it.each(['deck', 'hand', 'evidence', 'stack'] as const)('suspends and resumes every other host-leave route (%s)', (route) => {
    const s = createEmptyGameState(); s.turn.player = 'opp';
    const from = mutate.scene.enter(s, 'self', 'KAITOU', {});
    const to = mutate.scene.enter(s, 'self', 'KAITOU', {});
    const stackHost = mutate.scene.enter(s, 'self', 'KAITOU', {});
    mutate.char.setCard(s, from.uid, 'B02052', true);
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    if (route === 'deck') mutate.scene.toDeck(s, from.uid);
    if (route === 'hand') mutate.scene.toHand(s, from.uid);
    if (route === 'evidence') mutate.scene.toEvidence(s, from.uid, true);
    if (route === 'stack') mutate.scene.toStack(s, from.uid, stackHost.uid);
    expect(s.players.self.scene.some((c) => c.uid === from.uid)).toBe(true);
    const pending = _drainPendingSetCardReplacementSide();
    expect(pending?.resume?.kind).toBe(`scene-to-${route}`);
    applySetCardReplacement(s, pending!, to.uid);
    expect(s.players.self.scene.some((c) => c.uid === from.uid)).toBe(false);
    expect(s.players.self.scene.find((c) => c.uid === to.uid)?.setCards.map((e) => e.cardId)).toEqual(['B02052']);
  });

  it('does not replace a face-down occurrence or a same-turn second removal', () => {
    const s = createEmptyGameState(); s.turn.player = 'opp';
    const from = mutate.scene.enter(s, 'self', 'KAITOU', {});
    mutate.scene.enter(s, 'self', 'KAITOU', {});
    mutate.char.setCard(s, from.uid, 'B02052', false);
    expect(mutate.char.removeOneSetCard(s, from.uid)).toBe('B02052');
    mutate.char.setCard(s, from.uid, 'B02052', true);
    expect(mutate.char.removeOneSetCard(s, from.uid)).toBeNull();
    const moved = s.players.self.scene.find((c) => c.uid !== from.uid)!;
    expect(mutate.char.removeOneSetCard(s, moved.uid)).toBe('B02052');
  });

  it('keeps base and parallel ability data equal', () => {
    expect(JSON.stringify(B02052.abilities)).toBe(JSON.stringify(B02052P.abilities));
  });
});
