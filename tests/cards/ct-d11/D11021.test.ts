// tests/cards/ct-d11/D11021
// spec: .claude/specs/cards-analysis/D11021.md

import { describe, it, expect } from 'vitest';
import { D11021 } from '@/cards/ct-d11/D11021';

describe('D11021 千速と重悟の婚活パーティー (case)', () => {
  it('shape: id, kind=case, caseLevel=7, color=黄', () => {
    expect(D11021.id).toBe('D11021');
    expect(D11021.no).toBe('0946/D11021');
    expect(D11021.kind).toBe('case');
    expect(D11021.caseLevel).toBe(7);
    expect(D11021.caseTraits).toEqual(['婚活パーティー']);
    expect(D11021.colors).toEqual(['黄']);
  });

  it('a1: caseResolvedHandRemove n=1 (triggered)', () => {
    const a1 = D11021.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.description).toMatch(/解決編.*手札.*1.*リムーブ/);
  });

  it('a2: caseDeclaredEvidenceFlip delta=-1000 with sceneHas(神奈川県警) extra cond', () => {
    const a2 = D11021.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('declared');
    expect(a2.description).toMatch(/AP－1000/);
    expect(a2.cost).toMatchObject({ kind: 'flipFaceUpEvidence' });
    // condition は and(caseStatus, sceneHas) で結合される
    const cond = a2.condition as { kind: string; cs: { kind: string }[] };
    expect(cond.kind).toBe('and');
    const hasSceneHas = cond.cs.some(c => c.kind === 'sceneHas');
    expect(hasSceneHas).toBe(true);
  });

  it('ruleRefs 非空', () => {
    expect(D11021.ruleRefs.length).toBeGreaterThan(0);
  });
});
