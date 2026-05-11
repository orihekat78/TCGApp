// tests/cards/ct-d08/D08026
// spec: .claude/specs/cards-analysis/D08026.md

import { describe, it, expect } from 'vitest';
import { D08026 } from '@/cards/ct-d08/D08026';

describe('D08026 青の古城探索事件 (case)', () => {
  it('shape: id, kind, caseLevel=7, caseTraits, color', () => {
    expect(D08026.id).toBe('D08026');
    expect(D08026.no).toBe('0499/D08026');
    expect(D08026.kind).toBe('case');
    expect(D08026.caseLevel).toBe(7);
    expect(D08026.caseTraits).toEqual(['古城']);
    expect(D08026.colors).toEqual(['青']);
  });

  it('a1: caseResolvedHandRemove n=1 (triggered)', () => {
    const a1 = D08026.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.description).toMatch(/解決編.*手札.*1.*リムーブ/);
  });

  it('a2: caseDeclaredEvidenceFlip delta=+1000 self trait=少年探偵団', () => {
    const a2 = D08026.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('declared');
    expect(a2.description).toMatch(/AP＋1000/);
    expect(a2.cost).toMatchObject({ kind: 'flipFaceUpEvidence' });
  });

  it('ruleRefs 非空', () => {
    expect(D08026.ruleRefs.length).toBeGreaterThan(0);
  });
});
