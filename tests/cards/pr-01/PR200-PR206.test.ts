// PR200/PR206 大滝悟郎 — scene-wide face-down set-card count unlock

import { describe, expect, it } from 'vitest';
import { PR200 } from '@/cards/pr-01/PR200';
import { PR206 } from '@/cards/pr-01/PR206';
import { ALL_CARDS } from '@/cards';
import { char } from '@/engine/read/char';
import { _resetRegistry, register as registerCardDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import type { SceneCharacter } from '@/engine/types';

function makeChar(uid: string, cardId: string, setCards: SceneCharacter['setCards'] = []): SceneCharacter {
  return {
    uid, cardId, setCards, state: 'active', isNamed: false, enterOrder: 1, stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false }, apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false }, declaredUseCount: {},
  };
}

describe('PR200/PR206 大滝悟郎', () => {
  it('registers both printings and keeps every non-art clause identical', () => {
    expect(ALL_CARDS.map(card => card.id)).toEqual(expect.arrayContaining(['PR200', 'PR206']));
    expect(JSON.parse(JSON.stringify({ ...PR200, id: '', no: '', imageUrl: '' })))
      .toEqual(JSON.parse(JSON.stringify({ ...PR206, id: '', no: '', imageUrl: '' })));
  });

  it('grants assault only at two face-down set cards across the owner scene', () => {
    _resetRegistry();
    registerCardDef(PR200);
    const state = createEmptyGameState();
    state.players.self.scene = [
      makeChar('otaki', 'PR200', [{ cardId: 'A', faceUp: false }]),
      makeChar('police', 'POLICE', [{ cardId: 'B', faceUp: false }]),
    ];
    state.players.opp.scene = [makeChar('opp', 'OPP', [{ cardId: 'C', faceUp: false }, { cardId: 'D', faceUp: false }])];

    expect(char.hasKeyword(state, 'otaki', '突撃')).toBe(true);
    state.players.self.scene[1]!.setCards[0]!.faceUp = true;
    expect(char.hasKeyword(state, 'otaki', '突撃'), 'face-up and opposing set cards do not count').toBe(false);
  });

  it('maps declaration, limit, and hirameki through existing production descriptors', () => {
    const a2 = PR200.abilities[1]!;
    const a3 = PR200.abilities[2]!;
    expect(a2).toMatchObject({ type: 'declared', limit: { kind: 'turn', n: 1 }, effect: { kind: 'atom', verb: 'charSetCard', args: { player: 'self', side: 'self', max: 1, filter: { trait: '警察' }, fromDeckTop: true, faceUp: false } } });
    expect(a3).toMatchObject({ type: 'triggered', scope: 'on-evidence', trigger: { hook: 'evidence:remove-by-action', optional: true }, effect: { kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', max: 1, filter: { kind: 'character', trait: '大阪府警' } } } });
  });
});
