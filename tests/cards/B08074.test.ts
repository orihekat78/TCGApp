import { beforeEach, describe, expect, it } from 'vitest';
import { B08074 } from '@/cards/ct-p08/B08074';
import { registerAll } from '@/cards';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../helpers/fixtures';
import { event } from '@/engine/event';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _clearPendingEffectChoiceSide, _drainPendingEffectChoiceSide } from '@/engine/effect/pending-state';
import { applyChoiceAndContinuation } from '@/engine/effect/apply-pick';
import { char as readChar } from '@/engine/read/char';

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _clearPendingEffectChoiceSide();
  resetDefRegistry(); registerAll(); registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('B08074 Rei Furuya trait declaration', () => {
  it('binds the chosen trait, counts all three revealed cards, and returns them to the opponent deck', () => {
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('B08074', 'rei')];
    s.players.opp.deck = ['B08074', 'B08074', 'B08074'];
    event.emit(s, 'enter', { uid: 'rei' }, { player: 'self', uid: 'rei', cardId: 'B08074' });
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectChoiceSide();
    const policeIndex = pending!.options.find((option) => option.label === '\u8b66\u5bdf')!.index;
    applyChoiceAndContinuation(s, pending!, policeIndex);
    expect(readChar.keywords(s, 'rei')).toEqual(expect.arrayContaining(['\u7a81\u6483[\u30ad\u30e3\u30e9]', '\u7a81\u6483', '\u8fc5\u901f']));
    expect(s.players.opp.deck).toEqual(['B08074', 'B08074', 'B08074']);
  });
});
