// CT-P10 B10074/B10102: "【カットイン】と【ヒラメキ】以外" excludes a
// character with either keyword.  Scene grants are effective; deck/bound
// candidates use their printed definition only.
import { beforeEach, describe, expect, it } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { targetFilterToPredicateWithCtx } from '@/engine/effect/atom-handlers/_shared';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { matchOneFilter } from '@/engine/target/candidates';
import { makeCtx, sceneChar } from '../helpers/fixtures';
import type { Candidate, CardDef, GameState, TargetFilter } from '@/engine/types';

function char(id: string, keywords: string[] = []): CardDef {
  return { id, no: `CT-P10/${id}`, kind: 'character', names: [id], colors: ['黄'], level: 3, ap: 3000, lp: 1, traits: [], keywords, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

const CUTIN = char('CUTIN', ['カットイン']);
const HIRAMEKI = char('HIRAMEKI', ['ヒラメキ']);
const VANILLA = char('VANILLA');
const neitherKeyword: TargetFilter = { keywordNot: ['カットイン', 'ヒラメキ'] };

let state: GameState;
beforeEach(() => {
  resetDefRegistry();
  [CUTIN, HIRAMEKI, VANILLA].forEach(registerCardDef);
  state = createEmptyGameState();
});

function sceneMatches(cardId: string, granted: string[] = []): boolean {
  const char = sceneChar(cardId, `${cardId}#1`, { keywordOverrides: { granted, disabledOriginal: false } });
  state.players.self.scene = [char];
  const candidate: Candidate = { kind: 'char', uid: char.uid, cardId, player: 'self' };
  return matchOneFilter(state, cardId, neitherKeyword, char, candidate);
}

describe('CT-P10 keyword exclusion filter', () => {
  it('requires neither CutIn nor Hirameki, including a current external grant', () => {
    expect(sceneMatches('CUTIN')).toBe(false);
    expect(sceneMatches('HIRAMEKI')).toBe(false);
    expect(sceneMatches('VANILLA')).toBe(true);
    expect(sceneMatches('VANILLA', ['カットイン'])).toBe(false);
  });

  it('keeps deck predicates and bound conditions aligned on printed keywords', () => {
    const pred = targetFilterToPredicateWithCtx(undefined, neitherKeyword);
    expect(pred('CUTIN')).toBe(false);
    expect(pred('HIRAMEKI')).toBe(false);
    expect(pred('VANILLA')).toBe(true);

    const ctx = makeCtx({ bindings: { chosen: [{ cardId: 'CUTIN', player: 'self' }] } });
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'chosen', filter: neitherKeyword }, ctx)).toBe(false);
    ctx.bindings.chosen = [{ cardId: 'VANILLA', player: 'self' }];
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'chosen', filter: neitherKeyword }, ctx)).toBe(true);
  });
});
