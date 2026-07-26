// CT-P10 B10050: "【カットイン】と【ヒラメキ】以外の元の能力を持たない"
// permits printed CutIn/Hirameki icons, but rejects every other printed ability.
import { beforeEach, describe, expect, it } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { targetFilterToPredicate } from '@/engine/effect/atom-handlers/_shared';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { matchOneFilter } from '@/engine/target/candidates';
import { makeCtx, sceneChar } from '../helpers/fixtures';
import type { Candidate, CardDef, GameState, TargetFilter } from '@/engine/types';

const cutin = { id: 'cutin', type: 'triggered', scope: 'on-hand', trigger: { hook: 'effect:declared', optional: true }, description: 'cutin' } as const;
const hirameki = { id: 'hirameki', type: 'triggered', scope: 'on-scene', trigger: { hook: 'evidence:remove-by-action', optional: true }, description: 'hirameki' } as const;
const triggered = { id: 'triggered', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true }, description: 'enter' } as const;
function char(id: string, abilities: CardDef['abilities']): CardDef {
  return { id, no: `CT-P10/${id}`, kind: 'character', names: [id], colors: ['赤'], level: 5, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities, ruleRefs: [] };
}

const CUTIN = char('CUTIN', [cutin]);
const HIRAMEKI = char('HIRAMEKI', [hirameki]);
const BOTH = char('BOTH', [cutin, hirameki]);
const TRIGGERED = char('TRIGGERED', [triggered]);
const MIXED = char('MIXED', [cutin, triggered]);
const VANILLA = char('VANILLA', []);
const PRINTED_KEYWORD = { ...char('PRINTED_KEYWORD', []), keywords: ['突撃'] };
const filter: TargetFilter = { hasNoOriginalAbilityExceptIcons: ['カットイン', 'ヒラメキ'] };

let state: GameState;
beforeEach(() => {
  resetDefRegistry();
  [CUTIN, HIRAMEKI, BOTH, TRIGGERED, MIXED, VANILLA, PRINTED_KEYWORD].forEach(registerCardDef);
  state = createEmptyGameState();
});

function sceneMatches(cardId: string): boolean {
  const char = sceneChar(cardId, `${cardId}#1`);
  state.players.self.scene = [char];
  const candidate: Candidate = { kind: 'char', uid: char.uid, cardId, player: 'self' };
  return matchOneFilter(state, cardId, filter, char, candidate);
}

describe('CT-P10 original ability except icon filter', () => {
  it('allows only the named printed icons', () => {
    expect(sceneMatches('VANILLA')).toBe(true);
    expect(sceneMatches('CUTIN')).toBe(true);
    expect(sceneMatches('HIRAMEKI')).toBe(true);
    expect(sceneMatches('BOTH')).toBe(true);
    expect(sceneMatches('TRIGGERED')).toBe(false);
    expect(sceneMatches('MIXED')).toBe(false);
    expect(sceneMatches('PRINTED_KEYWORD')).toBe(false);
  });

  it('keeps deck and bound readers identical', () => {
    const pred = targetFilterToPredicate(filter);
    expect(pred('CUTIN')).toBe(true);
    expect(pred('MIXED')).toBe(false);
    expect(pred('PRINTED_KEYWORD')).toBe(false);
    const ctx = makeCtx({ bindings: { chosen: [{ cardId: 'HIRAMEKI', player: 'self' }] } });
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'chosen', filter }, ctx)).toBe(true);
    ctx.bindings.chosen = [{ cardId: 'TRIGGERED', player: 'self' }];
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'chosen', filter }, ctx)).toBe(false);
  });
});
