// Track B compiler — canonical 正規化の単体テスト。
import { describe, it, expect } from 'vitest';
const { canonicalize, canonicalCard, stableStringify, hasClosure } = require('../../scripts/compiler/canonical.cjs');

describe('compiler/canonical', () => {
  it('key 順の違いを吸収する', () => {
    expect(stableStringify({ b: 1, a: { d: 2, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 2 }, b: 1 }));
  });

  it('undefined フィールドを除去する', () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });

  it('配列の順序は保持する (abilities の a1/a2 順は意味を持つ)', () => {
    expect(stableStringify([1, 2])).not.toBe(stableStringify([2, 1]));
  });

  it('関数は <closure> marker になり hasClosure が検出する', () => {
    const withFn = { effect: { run: () => 0 } };
    expect(canonicalize(withFn).effect.run).toBe('<closure>');
    expect(hasClosure(withFn)).toBe(true);
    expect(hasClosure({ effect: { kind: 'atom' } })).toBe(false);
  });

  it('canonicalCard は abilities+keywords のみ比較対象にし keywords 順序を吸収する', () => {
    const a = canonicalCard({ id: 'X1', ap: 3000, keywords: ['突撃', '迅速'], abilities: [{ type: 'triggered' }] });
    const b = canonicalCard({ id: 'X1', lp: 2, keywords: ['迅速', '突撃'], abilities: [{ type: 'triggered' }] });
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('keywords / abilities 欠落は空配列に正規化される', () => {
    const c = canonicalCard({ id: 'X2' });
    expect(c.keywords).toEqual([]);
    expect(c.abilities).toEqual([]);
  });

  it('semanticCard: id/name/description/ruleRefs は非意味 metadata として比較から落ちる (a1/a2 揺れ吸収)', () => {
    const { semanticCard } = require('../../scripts/compiler/canonical.cjs');
    const a = semanticCard({ abilities: [{ id: 'a1', name: 'N', description: 'D。', ruleRefs: ['rules/x'], type: 'triggered', scope: 'on-scene' }] });
    const b = semanticCard({ abilities: [{ id: 'a2', description: 'D', type: 'triggered', scope: 'on-scene' }] });
    expect(stableStringify(a)).toBe(stableStringify(b));
  });

  it('semanticCard: type/scope/trigger/condition/effect の差は意味差として保持される', () => {
    const { semanticCard } = require('../../scripts/compiler/canonical.cjs');
    const a = semanticCard({ abilities: [{ id: 'a1', type: 'triggered' }] });
    const b = semanticCard({ abilities: [{ id: 'a1', type: 'continuous' }] });
    expect(stableStringify(a)).not.toBe(stableStringify(b));
  });
});
