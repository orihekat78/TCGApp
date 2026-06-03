// tests/cards/_shared/index — barrel export smoke test
// spec: .claude/specs/shared-classes/INDEX.md

import { describe, it, expect } from 'vitest';
import * as shared from '@/cards/_shared';

describe('cards/_shared barrel', () => {
  it('exports shared class factories (cutinFixedAP は 2026-06-02 廃止)', () => {
    expect(typeof shared.partnerColorKeyword).toBe('function');
    expect((shared as Record<string, unknown>).cutinFixedAP).toBeUndefined(); // 廃止確認
    expect((shared as Record<string, unknown>).hiramekiCharStun).toBeUndefined(); // 2026-06-03 廃止
    expect((shared as Record<string, unknown>).hiramekiDraw).toBeUndefined(); // 2026-06-03 廃止
    expect(typeof shared.caseTraitConditioned).toBe('function');
    expect(typeof shared.caseResolvedHandRemove).toBe('function');
    expect(typeof shared.caseDeclaredEvidenceFlip).toBe('function');
    expect(typeof shared.eventRemoveByAP).toBe('function');
  });
});
