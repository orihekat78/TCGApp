import { beforeEach, describe, expect, it } from 'vitest';
import { B06012 } from '@/cards/ct-p06/B06012';
import { B06012P } from '@/cards/ct-p06/B06012P';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event';
import { mutate } from '@/engine/mutate';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { applyOptionalAndContinuation, drainAiEffectPicks, _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _drainPendingEffectOptionalSide, _clearPendingEffectOptionalSide } from '@/engine/effect/resolve-picks';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import type { CardDef } from '@/engine/types';

const charDef = (id: string, traits: string[] = [], level = 1): CardDef => ({ id, no: id, kind: 'character', names: [id], colors: ['青'], level, ap: 1000, lp: 1, traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] });

beforeEach(() => {
  resetDefRegistry(); event._resetRegistry(); _resetTriggeredRegistered();
  registerCardDef(B06012); registerCardDef(charDef('HOST', ['少年探偵団'])); registerCardDef(charDef('阿笠博士', [], 8));
  registerTriggeredListener(); _clearPendingEffectOptionalSide();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('B06012 self set-card removal', () => {
  it('keeps the printed set, rider, and phase-end exact-remove contracts', () => {
    expect(B06012.abilities).toHaveLength(3);
    expect(B06012.abilities[0]).toMatchObject({
      scope: 'on-hand', effect: { kind: 'atom', verb: 'charSetCard', args: { fromSelf: true, n: 1, filter: { color: '青', kind: 'character' } } },
    });
    expect(B06012.abilities[1]).toMatchObject({
      scope: 'on-set-host', type: 'triggered', trigger: { hook: 'contact:start', selfOnly: true },
      condition: { kind: 'charMatches', ref: { kind: 'self' }, filter: { trait: '少年探偵団' } },
    });
    expect(B06012.abilities[2]).toMatchObject({
      scope: 'on-set-self', trigger: { hook: 'phase:end:start' },
      effect: { kind: 'optional', effect: { kind: 'chain' } },
    });
  });

  it('keeps the base and parallel rules text equal', () => {
    expect(JSON.stringify(B06012P.abilities, (_key, value) => typeof value === 'function' ? '[function]' : value)).toBe(JSON.stringify(B06012.abilities, (_key, value) => typeof value === 'function' ? '[function]' : value));
    expect(B06012P.names).toEqual(B06012.names);
  });

  it('removes only the triggering duplicate and re-enters 阿笠博士 asleep', () => {
    const after = produce(createEmptyGameState(), draft => {
      const host = mutate.scene.enter(draft, 'self', 'HOST', {});
      // Hydrated legacy state has no occurrence IDs. Phase dispatch must backfill,
      // then bind the selected event occurrence instead of falling back to pop().
      host.setCards.push({ cardId: 'B06012', faceUp: true }, { cardId: 'B06012', faceUp: true });
      draft.players.self.remove = ['阿笠博士'];
      event.emit(draft, 'phase:end:start', { player: 'self' }, { player: 'self' });
      // Both occurrences trigger simultaneously. Confirm their owner-selected
      // order before resolving the first optional effect.
      expect(draft.pendingEffects).toHaveLength(2);
      draft.pendingEffects.forEach((entry, order) => {
        entry.ownerChosenOrder = order;
        entry.ownerOrderConfirmed = true;
      });
      runAllUntilEmpty(draft);
      const optional = _drainPendingEffectOptionalSide();
      expect(optional).not.toBeNull();
      applyOptionalAndContinuation(draft, optional!, true);
      drainAiEffectPicks(draft, new HeuristicPolicy());
      _drainAllEffectPicksForTest(draft);
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.scene.find(c => c.cardId === 'HOST')?.setCards).toHaveLength(1);
    expect(after.players.self.remove).toContain('B06012');
    expect(after.players.self.scene.find(c => c.cardId === '阿笠博士')?.state).toBe('sleep');
  });

  it('allocates after hydrated IDs without collision', () => {
    const after = produce(createEmptyGameState(), draft => {
      const host = mutate.scene.enter(draft, 'self', 'HOST', {});
      host.setCards.push({ cardId: 'OLD', faceUp: true, instanceId: 'set:1' });
      draft.setCardInstanceSeq = 1;
      mutate.char.setCard(draft, host.uid, 'B06012', true);
    });
    expect(after.players.self.scene[0]?.setCards.map(entry => entry.instanceId)).toEqual(['set:1', 'set:2']);
  });

  it('does not reanimate after the selected set occurrence leaves before optional continuation', () => {
    const after = produce(createEmptyGameState(), draft => {
      const host = mutate.scene.enter(draft, 'self', 'HOST', {});
      mutate.char.setCard(draft, host.uid, 'B06012', true);
      draft.players.self.remove = ['阿笠博士'];
      event.emit(draft, 'phase:end:start', { player: 'self' }, { player: 'self' });
      runAllUntilEmpty(draft);
      const optional = _drainPendingEffectOptionalSide();
      expect(optional).not.toBeNull();
      mutate.char.removeOneSetCard(draft, host.uid, { setCardInstanceId: host.setCards[0]!.instanceId });
      applyOptionalAndContinuation(draft, optional!, true);
      _drainAllEffectPicksForTest(draft);
      runAllUntilEmpty(draft);
    });
    expect(after.players.self.scene.some(c => c.cardId === '阿笠博士')).toBe(false);
    expect(after.players.self.remove).toContain('阿笠博士');
  });
});
