// BUG-114: B06050 宮本武蔵 複数カットイン択一 = 1 cutin ability + choice{options:[opt_a, opt_b]}。
// opt_a 【自分ターン中】AP+2000 / opt_b 【事件YAIBA】reanimate (data gate で現状不発火)。
//
// 検証: choice が cutin の $contact.byUid binding を保持して resume されること (BUG-114 choice-binding fix)。
// rules: 09-cutin-disguise.md, 15-abilities-effects.md, 17-icons.md
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { B06050 } from '@/cards/ct-p06/B06050';
import { B06050P } from '@/cards/ct-p06/B06050P';
import {
  resolveEffectPicks,
  _drainPendingEffectChoiceSide,
  _clearPendingEffectChoiceSide,
  _clearPendingEffectPickQueue,
} from '@/engine/effect/resolve-picks';
import { applyChoiceAndContinuation } from '@/engine/effect/apply-pick';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { char as charRead } from '@/engine/read/char';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards';
import type { SceneCharacter, EffectCtx, GameState } from '@/engine/types';

function sceneChar(cardId: string, uid: string): SceneCharacter {
  return {
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };
}
function contactCtx(): EffectCtx {
  return {
    source: { player: 'self', cardId: 'B06050', abilityId: 'a1' },
    bindings: { contact: [{ byUid: 'atk', targetUid: 'def', attackerSide: 'self' }] },
  } as unknown as EffectCtx;
}

describe('B06050 宮本武蔵 — 複数カットイン択一 (choice)', () => {
  beforeAll(() => registerAll());
  beforeEach(() => {
    _clearPendingEffectPickQueue();
    _clearPendingEffectChoiceSide();
  });

  it('shape: 1 cutin ability, effect=choice with 2 options', () => {
    expect(B06050.abilities.length).toBe(1);
    const a = B06050.abilities[0]!;
    expect(a.trigger?.hook).toBe('effect:declared');
    expect(a.trigger?.optional).toBe(true);
    expect(a.effect?.kind).toBe('choice');
    expect((a.effect as { options: unknown[] }).options.length).toBe(2);
  });

  it('opt_a (index0) 【自分ターン中】: $contact.byUid(atk) を AP+2000 (choice が contact binding を保持)', () => {
    const s: GameState = createEmptyGameState(); // turn.player='self'
    s.players.self.scene = [sceneChar('D11013', 'atk')]; // printed AP 1000
    const walked = resolveEffectPicks(s, B06050.abilities[0]!.effect!, contactCtx(), {
      humanChooser: true, byPlayer: 'self', source: { cardId: 'B06050', abilityId: 'a1' },
    });
    runEffect(s, walked as never, contactCtx());
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectChoiceSide();
    expect(pending, 'choice surfaced').not.toBeNull();
    applyChoiceAndContinuation(s, pending!, 0);
    expect(charRead.ap(s, 'atk')).toBe(3000); // 1000 + 2000
  });

  it('B06050P は B06050 の abilities を継承', () => {
    expect(B06050P.abilities).toBe(B06050.abilities);
    expect(B06050P.id).toBe('B06050P');
  });
});
