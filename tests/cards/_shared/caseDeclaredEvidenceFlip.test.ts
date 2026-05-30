// tests/cards/_shared/caseDeclaredEvidenceFlip
// spec: .claude/specs/shared-classes/caseDeclaredEvidenceFlip.md

import { describe, it, expect } from 'vitest';
import { caseDeclaredEvidenceFlip } from '@/cards/_shared/caseDeclaredEvidenceFlip';
import { validate as effectValidate } from '@/engine/effect/validate';

describe('caseDeclaredEvidenceFlip', () => {
  it('returns declared AbilityDef with defaults', () => {
    const d = caseDeclaredEvidenceFlip({ delta: 1000 });
    expect(d.id).toBe('a_case_decl_flip');
    expect(d.type).toBe('declared');
    // user_request 20260522_01 #5 fix: case area で発動するため 'always' に変更
    expect(d.scope).toBe('always');
    expect(d.limit).toEqual({ kind: 'turn', n: 1 });
    expect(d.cost).toEqual({ kind: 'flipFaceUpEvidence', n: { min: 1, max: Infinity } });
    expect(d.description).toMatch(/【解決編】【宣言】【ターン1】/);
    expect(d.description).toMatch(/AP＋1000/);
    expect(d.ruleRefs!.length).toBeGreaterThan(0);
  });

  it('formats negative delta with minus sign', () => {
    const d = caseDeclaredEvidenceFlip({ delta: -1000 });
    expect(d.description).toMatch(/AP－1000/);
  });

  it('condition bare caseStatus when no additionalCondition', () => {
    const d = caseDeclaredEvidenceFlip({ delta: 1000 });
    expect(d.condition).toEqual({ kind: 'caseStatus', status: '解決編' });
  });

  it('condition wrapped in AND when additionalCondition is given', () => {
    const extra = {
      kind: 'sceneHas',
      query: { side: 'self', filter: { trait: '神奈川県警' } },
      nMin: 1,
    } as const;
    const d = caseDeclaredEvidenceFlip({ delta: -1000, additionalCondition: extra });
    expect(d.condition).toEqual({
      kind: 'and',
      cs: [{ kind: 'caseStatus', status: '解決編' }, extra],
    });
  });

  it('passes targetFilter / side / abilityId through', () => {
    const d = caseDeclaredEvidenceFlip({
      delta: 1000,
      targetFilter: { trait: '少年探偵団' },
      side: 'self',
      abilityId: 'a_x',
    });
    expect(d.id).toBe('a_x');
    const choice = d.effect as { options: { args: { target: { query: { side: string; filter: unknown } } } }[] };
    const target = choice.options[0].args.target;
    expect(target.query.side).toBe('self');
    expect(target.query.filter).toEqual({ trait: '少年探偵団' });
  });

  it('effect encodes delta as dyn expression cost.flipFaceUpEvidence.count * <delta>', () => {
    const d = caseDeclaredEvidenceFlip({ delta: 1500 });
    const choice = d.effect as { options: { kind: string; verb: string; args: { uid: string; delta: unknown; scope: string } }[] };
    const atom = choice.options[0];
    expect(atom.kind).toBe('atom');
    expect(atom.verb).toBe('charModifyAP');
    expect(atom.args.uid).toBe('$pick');
    expect(atom.args.scope).toBe('turn');
    expect(atom.args.delta).toEqual({ dyn: '$cost.flipFaceUpEvidence.count * 1500' });
  });

  it('effect passes engine.effect.validate', () => {
    const d = caseDeclaredEvidenceFlip({ delta: 1000 });
    const r = effectValidate(d.effect!);
    expect(r.ok).toBe(true);
  });
});
