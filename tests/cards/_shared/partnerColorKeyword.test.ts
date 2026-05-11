// tests/cards/_shared/partnerColorKeyword
// spec: .claude/specs/shared-classes/partnerColorKeyword.md

import { describe, it, expect } from 'vitest';
import { partnerColorKeyword } from '@/cards/_shared/partnerColorKeyword';

describe('partnerColorKeyword', () => {
  it('returns continuous AbilityDef with default abilityId/scope', () => {
    const d = partnerColorKeyword({ color: '青', kw: '突撃' });
    expect(d.id).toBe('a_pck_突撃');
    expect(d.type).toBe('continuous');
    expect(d.scope).toBe('on-scene');
    expect(d.description).toBe('【パートナー青】〚突撃〛');
    expect(d.ruleRefs).toContain('rules/13-keywords.md');
    expect(d.ruleRefs).toContain('rules/17-icons.md');
    expect(d.ruleRefs!.length).toBeGreaterThan(0);
  });

  it('passes abilityId/scope through and joins multi-color labels', () => {
    const d = partnerColorKeyword({
      color: ['青', '黄'],
      kw: '迅速',
      scope: 'on-partner-area',
      abilityId: 'a_custom',
    });
    expect(d.id).toBe('a_custom');
    expect(d.scope).toBe('on-partner-area');
    expect(d.description).toBe('【パートナー青/黄】〚迅速〛');
  });

  it('builds condition as bare partnerColor when no additionalCondition', () => {
    const d = partnerColorKeyword({ color: '青', kw: '突撃' });
    expect(d.condition).toEqual({ kind: 'partnerColor', color: '青' });
  });

  it('wraps condition in AND when additionalCondition is given', () => {
    const extra = { kind: 'caseStatus', status: '解決編' } as const;
    const d = partnerColorKeyword({ color: '黄', kw: '迅速', additionalCondition: extra });
    expect(d.condition).toEqual({
      kind: 'and',
      cs: [{ kind: 'partnerColor', color: '黄' }, extra],
    });
  });

  it('continuousModifier.grantKeywords returns [kw]', () => {
    const d = partnerColorKeyword({ color: '青', kw: '突撃[キャラ]' });
    const kws = d.continuousModifier?.grantKeywords?.(undefined as never, undefined as never);
    expect(kws).toEqual(['突撃[キャラ]']);
  });

  it('has no effect (continuous type) — engine.effect.validate not invoked here', () => {
    const d = partnerColorKeyword({ color: '青', kw: '突撃' });
    expect(d.effect).toBeUndefined();
  });
});
