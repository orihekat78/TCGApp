// tests/cards/night-wA2/B02084 — 安室の愛車: on-set-self setcard:leave 自己反応 (handleSetcardLeaveSelf, faceUp gate)
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { B02084 } from '@/cards/ct-p02/B02084';
import type { CardDef, GameState } from '@/engine/types';

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['黄'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const HOST6 = mkChar('HOST6', { level: 6 });
const POLICE5 = mkChar('POLICE5', { traits: ['警察'], level: 5 });
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = v; };

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  setHuman(null);
  for (const d of [B02084, HOST6, POLICE5]) registerCardDef(d);
  registerTriggeredListener();
});

// host に B02084 をセット、self remove に POLICE5、【相手ターン中】に host を除去 → setcard:leave 自己反応
function setup(faceUp: boolean, turnPlayer: 'self' | 'opp'): { s: GameState; hostUid: string } {
  const s = createEmptyGameState();
  s.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  const host = mutate.scene.enter(s, 'self', 'HOST6', {});
  mutate.char.setCard(s, host.uid, 'B02084', faceUp);
  s.players.self.remove.push('POLICE5'); // 手札に加える候補
  return { s, hostUid: host.uid };
}

describe('B02084 a2 — セットカード自身の setcard:leave 反応 (on-set-self)', () => {
  it('shape: a2 = on-set-self setcard:leave, condition turn:opp', () => {
    expect(B02084.abilities[1].scope).toBe('on-set-self');
    expect(B02084.abilities[1].trigger?.hook).toBe('setcard:leave');
    expect(B02084.abilities[1].condition).toEqual({ kind: 'turn', player: 'opp' });
  });

  it('faceUp セット + 【相手ターン中】host 除去 → 警察を remove から手札へ', () => {
    const { s, hostUid } = setup(true, 'opp');
    expect(s.players.self.hand.includes('POLICE5')).toBe(false);
    mutate.scene.removeToRemove(s, hostUid, 'effect'); // host 除去 → setcard:leave emit (B02084 faceUp)
    runAllUntilEmpty(s); drainAiEffectPicks(s);
    expect(s.players.self.hand.includes('POLICE5')).toBe(true);
    expect(s.players.self.remove.includes('POLICE5')).toBe(false);
  });

  it('裏向きセット → 発火しない (rules/16 情報を持たない、Q&A)', () => {
    const { s, hostUid } = setup(false, 'opp');
    mutate.scene.removeToRemove(s, hostUid, 'effect');
    runAllUntilEmpty(s); drainAiEffectPicks(s);
    expect(s.players.self.hand.includes('POLICE5')).toBe(false); // 裏向き不発
  });

  it('自分ターン中 → 発火しない (【相手ターン中】gate)', () => {
    const { s, hostUid } = setup(true, 'self');
    mutate.scene.removeToRemove(s, hostUid, 'effect');
    runAllUntilEmpty(s); drainAiEffectPicks(s);
    expect(s.players.self.hand.includes('POLICE5')).toBe(false);
  });
});
