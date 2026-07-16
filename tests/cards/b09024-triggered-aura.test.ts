import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { B09024 } from '@/cards/ct-p09/B09024';
import type { CardDef, GameState } from '@/engine/types';

const char = (id: string, traits: string[] = []): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1,
  traits, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
});
const OSAKA = char('OSAKA', ['大阪府警']);
const DECOY = char('DECOY');
const DRAW = char('DRAW');
const POLICE = char('POLICE', ['警察']);
const SLEEP7: CardDef = { ...char('SLEEP7'), level: 7 };
const ACTIVE7: CardDef = { ...char('ACTIVE7'), level: 7 };
const LEVEL8: CardDef = { ...char('LEVEL8'), level: 8 };

function state(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 2, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); resetDefRegistry(); _resetUidCounter();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  for (const d of [B09024, OSAKA, DECOY, DRAW, POLICE, SLEEP7, ACTIVE7, LEVEL8]) registerCardDef(d);
  registerTriggeredListener();
});

describe('B09024 triggered ability aura', () => {
  it.each([
    ['bearer first', ['bearer', 'recipient']],
    ['recipient first', ['recipient', 'bearer']],
  ] as const)('keeps the aura for a simultaneous removal batch (%s)', (_name, order) => {
    const s = state();
    const bearer = mutate.scene.enter(s, 'self', 'B09024', {});
    const recipient = mutate.scene.enter(s, 'self', 'OSAKA', {});
    s.players.self.deck = ['DRAW'];
    s.players.self.hand = ['DECOY'];

    const uids = order.map(x => x === 'bearer' ? bearer.uid : recipient.uid);
    const batch = mutate.scene as typeof mutate.scene & {
      removeToRemoveBatch: (state: GameState, targetUids: string[], cause: 'effect') => void;
    };
    batch.removeToRemoveBatch(s, uids, 'effect');

    expect(s.pendingEffects).toHaveLength(1);
  });

  it('does not keep an aura across separate removal operations', () => {
    const s = state();
    const bearer = mutate.scene.enter(s, 'self', 'B09024', {});
    const recipient = mutate.scene.enter(s, 'self', 'OSAKA', {});

    mutate.scene.removeToRemove(s, bearer.uid, 'effect');
    mutate.scene.removeToRemove(s, recipient.uid, 'effect');

    expect(s.pendingEffects).toHaveLength(0);
  });

  it('matching other recipient alone queues one draw/discard trigger', () => {
    const s = state();
    mutate.scene.enter(s, 'self', 'B09024', {});
    const recipient = mutate.scene.enter(s, 'self', 'OSAKA', {});
    s.players.self.deck = ['DRAW'];
    s.players.self.hand = ['DECOY'];

    mutate.scene.removeToRemove(s, recipient.uid, 'effect');
    expect(s.pendingEffects).toHaveLength(1);
    runAllUntilEmpty(s);

    expect(s.players.self.hand).toEqual(['DRAW']);
    // DRAW 取得で deck が exact exhaustion → 先に remove 済みの OSAKA は即 refresh。
    // その後に捨てた DECOY だけが remove に残る (rules/14, 26)。
    expect(s.players.self.deck).toEqual(['OSAKA']);
    expect(s.players.self.remove).toEqual(['DECOY']);
    expect(s.refreshCount.self).toBe(1);
    expect(s.players.opp.evidence).toHaveLength(1);
  });

  it('two aura bearers create two independently queued triggers', () => {
    const s = state();
    mutate.scene.enter(s, 'self', 'B09024', {});
    mutate.scene.enter(s, 'self', 'B09024', {});
    const recipient = mutate.scene.enter(s, 'self', 'OSAKA', {});
    s.players.self.deck = ['DRAW', 'DRAW'];
    s.players.self.hand = ['DECOY', 'DECOY'];

    mutate.scene.removeToRemove(s, recipient.uid, 'effect');
    expect(s.pendingEffects).toHaveLength(2);
  });

  it('aura excludes its bearer and does not fire on controller turn', () => {
    const s = state();
    const bearer = mutate.scene.enter(s, 'self', 'B09024', {});
    mutate.scene.removeToRemove(s, bearer.uid, 'effect');
    expect(s.pendingEffects).toHaveLength(0);

    const s2 = state(); s2.turn.player = 'self';
    mutate.scene.enter(s2, 'self', 'B09024', {});
    const recipient = mutate.scene.enter(s2, 'self', 'OSAKA', {});
    mutate.scene.removeToRemove(s2, recipient.uid, 'effect');
    expect(s2.pendingEffects).toHaveLength(0);
  });
});

describe('B09024 a2 declared ability', () => {
  function declaredState(targetId: string, targetState: 'active' | 'sleep', deck: string[] = ['DRAW']): { s: GameState; sourceUid: string; targetUid: string } {
    const s = state();
    s.players.self.partner.cardId = 'B09024';
    s.players.self.hand = ['POLICE'];
    s.players.self.deck = [...deck];
    const source = mutate.scene.enter(s, 'self', 'B09024', {});
    const target = mutate.scene.enter(s, 'opp', targetId, { active: targetState === 'active' });
    return { s, sourceUid: source.uid, targetUid: target.uid };
  }

  it('pays partner-green and police reveal cost, then sets deck top facedown after sleep target removal', () => {
    const { s, sourceUid, targetUid } = declaredState('SLEEP7', 'sleep');

    expect(canDeclaredAbility(s, sourceUid, 'a2')).toBe(true);
    activateDeclaredAbility(s, sourceUid, 'a2');
    runAllUntilEmpty(s);
    _drainAllEffectPicksForTest(s);

    expect(s.players.self.hand).toEqual(['POLICE']);
    expect(s.players.opp.scene.some(c => c.uid === targetUid)).toBe(false);
    expect(s.players.self.scene.find(c => c.uid === sourceUid)?.setCards).toEqual([{ cardId: 'DRAW', faceUp: false, instanceId: 'set:1' }]);
  });

  it('does not set a card after active target removal', () => {
    const { s, sourceUid } = declaredState('ACTIVE7', 'active');

    activateDeclaredAbility(s, sourceUid, 'a2');
    runAllUntilEmpty(s);
    _drainAllEffectPicksForTest(s);

    expect(s.players.self.scene.find(c => c.uid === sourceUid)?.setCards).toEqual([]);
    expect(s.players.self.deck).toEqual(['DRAW']);
  });

  it('does not set a card when no legal target is selected', () => {
    const { s, sourceUid, targetUid } = declaredState('LEVEL8', 'sleep');

    activateDeclaredAbility(s, sourceUid, 'a2');
    runAllUntilEmpty(s);
    _drainAllEffectPicksForTest(s);

    expect(s.players.opp.scene.some(c => c.uid === targetUid)).toBe(true);
    expect(s.players.self.scene.find(c => c.uid === sourceUid)?.setCards).toEqual([]);
    expect(s.players.self.deck).toEqual(['DRAW']);
  });

  it('does not create a set card from an empty deck', () => {
    const { s, sourceUid } = declaredState('SLEEP7', 'sleep', []);

    activateDeclaredAbility(s, sourceUid, 'a2');
    runAllUntilEmpty(s);
    _drainAllEffectPicksForTest(s);

    expect(s.players.self.scene.find(c => c.uid === sourceUid)?.setCards).toEqual([]);
    expect(s.gameResult?.reason).toBe('deck-out');
  });
});
