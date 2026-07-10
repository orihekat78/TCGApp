// tests/cards/night-wA2/B03008 — 阿笠博士: state:change (active→sleep) 観測 → draw1 + discard1
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { B03008 } from '@/cards/ct-p03/B03008';
import type { CardDef, GameState } from '@/engine/types';

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const BOY = mkChar('BOY', { traits: ['少年探偵団'] });    // 少年探偵団
const NOTBOY = mkChar('NOTBOY', { traits: ['探偵'] });    // 非少年探偵団 decoy
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = v; };

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  setHuman(null);
  for (const d of [B03008, BOY, NOTBOY]) registerCardDef(d);
  registerTriggeredListener();
});

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  mutate.scene.enter(s, 'self', 'B03008', {}); // observer
  s.players.self.deck.push('BOY', 'NOTBOY', 'BOY', 'NOTBOY'); // draw 用
  s.players.self.hand.push('BOY', 'NOTBOY'); // discard 用
  return s;
}
const fired = (s: GameState, before: number) => s.players.self.deck.length === before - 1; // draw1 = deck -1

describe('B03008 a1 — active→sleep の少年探偵団を観測して draw+discard', () => {
  it('shape: a1 state:change → sequence[draw, discard]', () => {
    expect(B03008.abilities[0].trigger?.hook).toBe('state:change');
    expect(B03008.abilities[0].effect?.kind).toBe('sequence');
  });

  it('自分の少年探偵団が active→sleep → 発火 (deck -1)', () => {
    const s = base();
    const boy = mutate.scene.enter(s, 'self', 'BOY', {}); mutate.scene.setState(s, boy.uid, 'active');
    const deckBefore = s.players.self.deck.length;
    mutate.scene.setState(s, boy.uid, 'sleep'); // active→sleep → state:change emit
    runAllUntilEmpty(s); drainAiEffectPicks(s);
    expect(fired(s, deckBefore)).toBe(true);
  });

  it('非少年探偵団の active→sleep → 不発 (trait gate)', () => {
    const s = base();
    const nb = mutate.scene.enter(s, 'self', 'NOTBOY', {}); mutate.scene.setState(s, nb.uid, 'active');
    const deckBefore = s.players.self.deck.length;
    mutate.scene.setState(s, nb.uid, 'sleep');
    runAllUntilEmpty(s);
    expect(s.players.self.deck.length).toBe(deckBefore);
  });

  it('相手の少年探偵団の active→sleep → 不発 (side:self gate)', () => {
    const s = base();
    const boy = mutate.scene.enter(s, 'opp', 'BOY', {}); mutate.scene.setState(s, boy.uid, 'active');
    const deckBefore = s.players.self.deck.length;
    mutate.scene.setState(s, boy.uid, 'sleep');
    runAllUntilEmpty(s);
    expect(s.players.self.deck.length).toBe(deckBefore);
  });

  it('stun→sleep (アクティブ経由でない) → state:change 不 emit → 不発 (hot-path 静穏)', () => {
    const s = base();
    const boy = mutate.scene.enter(s, 'self', 'BOY', {}); mutate.scene.setState(s, boy.uid, 'active');
    // stun にしてから activate → stun→sleep 遷移 (active 経由でない)
    const c = s.players.self.scene.find(x => x.uid === boy.uid)!; c.state = 'stun';
    const deckBefore = s.players.self.deck.length;
    mutate.scene.setState(s, boy.uid, 'active'); // stun + active 要求 → sleep 化 (but not active→sleep)
    runAllUntilEmpty(s);
    expect(s.players.self.deck.length).toBe(deckBefore); // emit されない
  });

  it('【ターン1】: 2体目の active→sleep は不発', () => {
    const s = base();
    const b1 = mutate.scene.enter(s, 'self', 'BOY', {}); mutate.scene.setState(s, b1.uid, 'active');
    const b2 = mutate.scene.enter(s, 'self', 'BOY', {}); mutate.scene.setState(s, b2.uid, 'active');
    mutate.scene.setState(s, b1.uid, 'sleep');
    runAllUntilEmpty(s); drainAiEffectPicks(s);
    const deckAfter1 = s.players.self.deck.length;
    mutate.scene.setState(s, b2.uid, 'sleep');
    runAllUntilEmpty(s); drainAiEffectPicks(s);
    expect(s.players.self.deck.length).toBe(deckAfter1); // 2回目は limit turn:1 で不発
  });
});
