// tests/cards/night-wA2/B04073 — 千葉和伸: action:guarded payload に targetUid 追加 (三池苗子なら +3000, else +1000)
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { read } from '@/engine/read/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { declare, tryGuard, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { B04073 } from '@/cards/ct-p04/B04073';
import type { CardDef, GameState } from '@/engine/types';

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['黄'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const ATK = mkChar('ATK', { ap: 5000 });
const GUARD = mkChar('GUARD', { ap: 2000 });
const MIIKE = mkChar('MIIKE', { names: ['三池苗子'], ap: 1000 });
const DECOY = mkChar('DECOY', { names: ['別人'], ap: 1000 });
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = v; };

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry(); _resetActionContexts();
  setHuman(null);
  for (const d of [B04073, ATK, GUARD, MIIKE, DECOY]) registerCardDef(d);
  registerTriggeredListener();
});

// opp が self のキャラを攻撃 → self が GUARD でガード。B04073 (self scene) が観測して GUARD を AP 修正。
function setup(targetCardId: string): { s: GameState; atkUid: string; guardUid: string; tgtUid: string } {
  const s = createEmptyGameState();
  s.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  mutate.scene.enter(s, 'self', 'B04073', {}); // observer
  const g = mutate.scene.enter(s, 'self', 'GUARD', {}); g.isNamed = false; mutate.scene.setState(s, g.uid, 'active');
  const t = mutate.scene.enter(s, 'self', targetCardId, {}); mutate.scene.setState(s, t.uid, 'sleep'); // アクション対象は sleep
  const atk = mutate.scene.enter(s, 'opp', 'ATK', {}); atk.isNamed = false; mutate.scene.setState(s, atk.uid, 'active');
  return { s, atkUid: atk.uid, guardUid: g.uid, tgtUid: t.uid };
}

describe('B04073 a1 — ガード時 AP 修正 (targetUid で三池苗子分岐)', () => {
  it('shape: a1 action:guarded conditional (三池苗子→+3000 / else +1000)', () => {
    expect(B04073.abilities[0].trigger?.hook).toBe('action:guarded');
    expect(B04073.abilities[0].effect?.kind).toBe('conditional');
  });

  it('対象が三池苗子 → GUARD を AP＋3000', () => {
    const { s, atkUid, guardUid, tgtUid } = setup('MIIKE');
    const ax = declare(s, atkUid, { kind: 'char', uid: tgtUid });
    tryGuard(s, ax, guardUid); // action:guarded emit {byUid, guardUid, targetUid:MIIKE}
    runAllUntilEmpty(s);
    expect(read.char.ap(s, guardUid)).toBe(2000 + 3000);
  });

  it('対象が三池苗子以外 → GUARD を AP＋1000 (else 枝)', () => {
    const { s, atkUid, guardUid, tgtUid } = setup('DECOY');
    const ax = declare(s, atkUid, { kind: 'char', uid: tgtUid });
    tryGuard(s, ax, guardUid);
    runAllUntilEmpty(s);
    expect(read.char.ap(s, guardUid)).toBe(2000 + 1000);
  });
});
