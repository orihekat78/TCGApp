// tests/cards/_shared/index — barrel export smoke test
// spec: .claude/specs/shared-classes/INDEX.md

import { describe, it, expect } from 'vitest';
import * as shared from '@/cards/_shared';

describe('cards/_shared barrel', () => {
  it('exports all 8 shared class factories', () => {
    expect(typeof shared.partnerColorKeyword).toBe('function');
    expect(typeof shared.cutinFixedAP).toBe('function');
    expect(typeof shared.hiramekiCharStun).toBe('function');
    expect(typeof shared.hiramekiDraw).toBe('function');
    expect(typeof shared.caseTraitConditioned).toBe('function');
    expect(typeof shared.caseResolvedHandRemove).toBe('function');
    expect(typeof shared.caseDeclaredEvidenceFlip).toBe('function');
    expect(typeof shared.eventRemoveByAP).toBe('function');
  });
});
