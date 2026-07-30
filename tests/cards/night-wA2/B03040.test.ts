// tests/cards/night-wA2/B03040 — 和田進一: peekOwnEvidence (自証拠 top1 私的閲覧、zone 不変)
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { B03040 } from '@/cards/ct-p03/B03040';
import type { CardDef, GameState } from '@/engine/types';

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const REASONER = mkChar('REASONER');
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = v; };

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  setHuman(null);
  for (const d of [B03040, REASONER]) registerCardDef(d);
  registerTriggeredListener();
});

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  mutate.scene.enter(s, 'self', 'B03040', {}); // observer
  const r = mutate.scene.enter(s, 'self', 'REASONER', {});
  s.players.self.evidence.push({ cardId: 'REASONER', faceUp: false }); // top 裏向き
  return s;
}
const peekLogs = (s: GameState) => s.log.filter(e => e.action === 'effect:evidencePeek');

describe('B03040 a1 — 自分が証拠を得たとき自証拠 top1 を peek (zone 不変)', () => {
  it('shape: a1 multi-hook evidence:gain/reasoning:end → peekOwnEvidence', () => {
    expect(B03040.abilities[0].trigger?.hook).toBe('evidence:gain');
    expect(B03040.abilities[0].trigger?.hooks).toContain('reasoning:end');
    expect((B03040.abilities[0].effect as { verb?: string }).verb).toBe('peekOwnEvidence');
  });

  it('reasoning:end (自分) → peek 発火 / 証拠 zone・faceUp 不変', () => {
    const s = base();
    const evLenBefore = s.players.self.evidence.length;
    event.emit(s, 'reasoning:end', { uid: 'r#1', player: 'self', gained: 1 }, { player: 'self', uid: 'r#1' });
    runAllUntilEmpty(s);
    expect(peekLogs(s).length).toBe(1);
    expect(peekLogs(s)[0].result).toBe('faceDown'); // 裏向き証拠を見た
    expect(peekLogs(s)[0].targetAudience).toBe('self');
    expect(s.players.self.evidence.length).toBe(evLenBefore); // zone 不変
    expect(s.players.self.evidence[s.players.self.evidence.length - 1].faceUp).toBe(false); // 元に戻す = faceUp 不変
  });

  it('evidence:gain (自分) でも発火 / 【ターン1】で2回目は不発', () => {
    const s = base();
    event.emit(s, 'evidence:gain', { player: 'self', uid: 'x', via: 'action-case', gained: 1 }, { player: 'self', uid: 'x' });
    runAllUntilEmpty(s);
    event.emit(s, 'reasoning:end', { uid: 'r#1', player: 'self', gained: 1 }, { player: 'self', uid: 'r#1' });
    runAllUntilEmpty(s);
    expect(peekLogs(s).length).toBe(1); // limit turn:1
  });

  it('相手が証拠を得ても発火しない (triggerPlayerIs self)', () => {
    const s = base();
    event.emit(s, 'evidence:gain', { player: 'opp', uid: 'x', via: 'action-case', gained: 1 }, { player: 'opp', uid: 'x' });
    runAllUntilEmpty(s);
    expect(peekLogs(s).length).toBe(0);
  });
});
