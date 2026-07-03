// B03033 遠山和葉 — live consumer E2E: 【自分ターン中】相手のセット済キャラ AP-1000 (apDeltaAuraOpp)。
// engine 機構自体は engine-additive-wave-0629b が網羅。本テストは登録済 real CardDef の wiring を確認。
import { describe, it, expect, beforeEach } from 'vitest';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { read } from '@/engine/read/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef, GameState, SetCardEntry } from '@/engine/types';
import { B03033 } from '@/cards/ct-p03/B03033';

const SET: SetCardEntry[] = [{ cardId: 'DUMMY', faceUp: true }];

function decoy(id: string, ap: number): CardDef {
  return { id, no: `x/${id}`, kind: 'character', names: [id], colors: ['黒'], level: 5, ap, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

function turn(s: GameState, player: 'self' | 'opp'): void {
  s.turn = { number: 5, player, phase: 'main', isFirstPlayerFirstTurn: false };
}

beforeEach(() => {
  event._resetRegistry();
  _resetUidCounter();
  resetDefRegistry();
  registerCardDef(B03033);
  registerCardDef(decoy('OPPSET', 5000));
  registerCardDef(decoy('OPPNO', 5000));
});

describe('B03033 遠山和葉 — apDeltaAuraOpp live consumer', () => {
  it('自分ターン中: opp の set済キャラ -1000 / set無 decoy 不変 / bearer 自身不変', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('B03033', 'k#1')];
    s.players.opp.scene = [sceneChar('OPPSET', 'os#1', { setCards: SET }), sceneChar('OPPNO', 'on#1')];
    expect(read.char.ap(s, 'os#1'), 'opp set済 5000→4000').toBe(4000);
    expect(read.char.ap(s, 'on#1'), 'opp set無は対象外').toBe(5000);
    expect(read.char.ap(s, 'k#1'), 'bearer 遠山和葉 base4000 不変').toBe(4000);
  });

  it('相手ターン中は aura 不発 (【自分ターン中】gate)', () => {
    const s = createEmptyGameState();
    turn(s, 'opp');
    s.players.self.scene = [sceneChar('B03033', 'k#1')];
    s.players.opp.scene = [sceneChar('OPPSET', 'os#1', { setCards: SET })];
    expect(read.char.ap(s, 'os#1'), '相手ターン中不発').toBe(5000);
  });

  it('遠山和葉 2枚は -1000 が重複 (QA: それぞれ AP-1000)', () => {
    const s = createEmptyGameState();
    turn(s, 'self');
    s.players.self.scene = [sceneChar('B03033', 'k#1'), sceneChar('B03033', 'k#2')];
    s.players.opp.scene = [sceneChar('OPPSET', 'os#1', { setCards: SET })];
    expect(read.char.ap(s, 'os#1'), 'bearer2枚で 5000→3000').toBe(3000);
  });
});
