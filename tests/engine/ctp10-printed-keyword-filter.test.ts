// CT-P10 B10098/B10101 Q&A: a conditional keyword printed behind this card's
// own icon qualifies; an ordinary ability that grants the same keyword does not.
import { beforeEach, describe, expect, it } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { targetFilterToPredicateWithCtx } from '@/engine/effect/atom-handlers/_shared';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { matchOneFilter } from '@/engine/target/candidates';
import { makeCtx, sceneChar } from '../helpers/fixtures';
import type { Candidate, CardDef, GameState, TargetFilter } from '@/engine/types';

function char(id: string, keywords: string[] = [], abilities: CardDef['abilities'] = []): CardDef {
  return { id, no: `CT-P10/${id}`, kind: 'character', names: [id], colors: ['緑'], level: 5, ap: 3000, lp: 1, traits: [], keywords, rarity: 'C', imageUrl: '', abilities, ruleRefs: [] };
}
const printed = char('PRINTED', ['突撃']);
const icon = char('ICON', [], [{ id: 'icon', type: 'continuous', scope: 'on-scene', continuousModifier: { grantKeywords: () => ['突撃'], printedKeywordWhenIconValid: true }, description: '【パートナー緑】〚突撃〛' }]);
const iconUnmet = char('ICON_UNMET', [], [{ id: 'icon', type: 'continuous', scope: 'on-scene', condition: { kind: 'false' }, continuousModifier: { grantKeywords: () => ['突撃'], printedKeywordWhenIconValid: true }, description: '【パートナー緑】〚突撃〛' }]);
const ordinaryGrant = char('ORDINARY_GRANT', [], [{ id: 'grant', type: 'continuous', scope: 'on-scene', continuousModifier: { grantKeywords: () => ['突撃'] }, description: 'このキャラは〚突撃〛を持つ。' }]);
const filter: TargetFilter = { keywordFromPrintOrConditionIcon: '突撃' };

let state: GameState;
beforeEach(() => {
  resetDefRegistry();
  [printed, icon, iconUnmet, ordinaryGrant].forEach(registerCardDef);
  state = createEmptyGameState();
});

function sceneMatches(cardId: string): boolean {
  const char = sceneChar(cardId, `${cardId}#1`);
  state.players.self.scene = [char];
  const candidate: Candidate = { kind: 'char', uid: char.uid, cardId, player: 'self' };
  return matchOneFilter(state, cardId, filter, char, candidate);
}

describe('CT-P10 printed-or-condition-icon keyword filter', () => {
  it('permits printed and active icon keywords but not ordinary grants', () => {
    expect(sceneMatches('PRINTED')).toBe(true);
    expect(sceneMatches('ICON')).toBe(true);
    expect(sceneMatches('ICON_UNMET')).toBe(false);
    expect(sceneMatches('ORDINARY_GRANT')).toBe(false);
  });

  it('keeps deck/remove and bound paths on the same provenance rule', () => {
    const pred = targetFilterToPredicateWithCtx(state, filter, undefined, 'self');
    expect(pred('PRINTED')).toBe(true);
    expect(pred('ICON')).toBe(true);
    expect(pred('ICON_UNMET')).toBe(false);
    expect(pred('ORDINARY_GRANT')).toBe(false);
    const ctx = makeCtx({ bindings: { chosen: [{ cardId: 'ICON', player: 'self' }] } });
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'chosen', filter }, ctx)).toBe(true);
    ctx.bindings.chosen = [{ cardId: 'ORDINARY_GRANT', player: 'self' }];
    expect(evalCond(state, { kind: 'boundMatchesFilter', bindKey: 'chosen', filter }, ctx)).toBe(false);
  });
});
