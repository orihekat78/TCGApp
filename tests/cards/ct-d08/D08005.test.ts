// tests/cards/ct-d08/D08005
// spec: .claude/specs/cards-analysis/D08005.md

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { char as charRead } from '@/engine/read/char';
import { D08005 } from '@/cards/ct-d08/D08005';
import { D08006 } from '@/cards/ct-d08/D08006';
import type { GameState } from '@/engine/types';

describe('D08005 灰原哀 (character, continuous AP per evidence + declared flip→突撃)', () => {
  it('shape: id, kind, level=7, ap=6000, lp=1, traits科学者+少年探偵団', () => {
    expect(D08005.id).toBe('D08005');
    expect(D08005.no).toBe('0490/D08005');
    expect(D08005.kind).toBe('character');
    expect(D08005.names).toEqual(['灰原哀']);
    expect(D08005.colors).toEqual(['青']);
    expect(D08005.level).toBe(7);
    expect(D08005.ap).toBe(6000);
    expect(D08005.lp).toBe(1);
    expect(D08005.traits).toEqual(['少年探偵団', '科学者']);
    expect(D08005.abilities.length).toBe(2);
  });

  it('a1: continuous (自分ターン中 × apDelta dyn 宣言形)', () => {
    const a1 = D08005.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'turn', player: 'self' });
    // 宣言形 (dyn 式): 自分の表向き証拠数 * 1000 (closure 廃止)
    expect(a1.continuousModifier?.apDelta).toEqual({ dyn: '$self.faceUpEvidence * 1000' });
  });

  it('a2: declared, limit turn1, cost flipFaceUpEvidence, grantKeyword 突撃', () => {
    const a2 = D08005.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('declared');
    expect(a2.limit).toEqual({ kind: 'turn', n: 1 });
    expect(a2.cost?.kind).toBe('flipFaceUpEvidence');
    const eff = a2.effect as { kind: string; verb: string; args: { kw: string } };
    expect(eff.kind).toBe('atom');
    expect(eff.verb).toBe('charGrantKeyword');
    expect(eff.args.kw).toBe('突撃');
  });

  it('D08006 variant shares abilities with D08005', () => {
    expect(D08006.abilities).toBe(D08005.abilities);
    expect(D08006.id).toBe('D08006');
    expect(D08006.imageUrl).not.toBe(D08005.imageUrl);
  });
});

// a1 が実機で動作することの数値オラクル (旧 closure はデッドコードで AP に反映されていなかった)。
// engine.read.char.ap が continuousModifier.apDelta (dyn) を read 時に走査・合算する。
describe('D08005 a1 behavioral — engine.read.char.ap が表向き証拠でスケール (rules/24 常時有効型)', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    engine.cards.register(D08005);
  });

  function makeState(opts: {
    faceUp: number;
    faceDown: number;
    turnPlayer: 'self' | 'opp';
    side?: 'self' | 'opp';
  }): GameState {
    const side = opts.side ?? 'self';
    return produce(createEmptyGameState(), (d) => {
      d.turn.player = opts.turnPlayer;
      d.players[side].scene.push({
        cardId: 'D08005',
        uid: 'D08005#0',
        state: 'active',
        isNamed: false,
        enterOrder: 1,
        enterOrderThisTurn: 1,
        setCards: [],
        stackedCards: 0,
        keywordOverrides: { granted: [], disabledOriginal: false },
        apOverride: null,
        lpOverride: null,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false },
        declaredUseCount: {},
      });
      for (let i = 0; i < opts.faceUp; i++) {
        d.players[side].evidence.push({ cardId: `up${i}`, faceUp: true, origin: { turn: 1, via: 'reasoning' } });
      }
      for (let i = 0; i < opts.faceDown; i++) {
        d.players[side].evidence.push({ cardId: `dn${i}`, faceUp: false, origin: { turn: 1, via: 'reasoning' } });
      }
    });
  }

  it('自分ターン中・表向き証拠3枚 (+裏向き2) → AP = base6000 + 3*1000 = 9000', () => {
    const s = makeState({ faceUp: 3, faceDown: 2, turnPlayer: 'self' });
    expect(charRead.ap(s, 'D08005#0')).toBe(9000);
  });

  it('表向き証拠0枚 (裏向きのみ) → AP = 6000 (裏向きは数えない)', () => {
    const s = makeState({ faceUp: 0, faceDown: 4, turnPlayer: 'self' });
    expect(charRead.ap(s, 'D08005#0')).toBe(6000);
  });

  it('相手ターン中 → condition {turn:self} false で加算なし (AP = 6000)', () => {
    const s = makeState({ faceUp: 3, faceDown: 0, turnPlayer: 'opp' });
    expect(charRead.ap(s, 'D08005#0')).toBe(6000);
  });

  it('相手 scene 上 (owner=opp) + opp ターン → opp の表向き証拠2枚で AP = 8000', () => {
    const s = makeState({ faceUp: 2, faceDown: 1, turnPlayer: 'opp', side: 'opp' });
    expect(charRead.ap(s, 'D08005#0')).toBe(8000);
  });
});
