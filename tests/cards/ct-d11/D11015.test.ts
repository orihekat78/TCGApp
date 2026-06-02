// tests/cards/ct-d11/D11015
// spec: .claude/specs/cards-analysis/D11015.md

import { describe, it, expect } from 'vitest';
import { D11015 } from '@/cards/ct-d11/D11015';

describe('D11015 目暮十三 (action:declare buff + enter conditional 突撃)', () => {
  it('shape: id, level=5, ap=5000, lp=1, 黄, 警察|警視庁', () => {
    expect(D11015.id).toBe('D11015');
    expect(D11015.no).toBe('0942/D11015');
    expect(D11015.kind).toBe('character');
    expect(D11015.colors).toEqual(['黄']);
    expect(D11015.level).toBe(5);
    expect(D11015.ap).toBe(5000);
    expect(D11015.lp).toBe(1);
    expect(D11015.traits).toEqual(['警察', '警視庁']);
    expect(D11015.abilities.length).toBe(2);
  });

  it('a1 = action:declare triggered → choose 1 char, AP+1000', () => {
    const a1 = D11015.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger?.hook).toBe('action:declare');
    expect(a1.trigger?.selfOnly).toBe(true);
    // 冗長 choice→options:[charModifyAP] を pick 駆動の短縮形 atom に置換 (動作不変)
    expect(a1.effect?.kind).toBe('atom');
    expect((a1.effect as { verb?: string }).verb).toBe('charModifyAP');
  });

  it('a2 = enter triggered with two conditional grants (突撃[キャラ] / 突撃[事件])', () => {
    const a2 = D11015.abilities[1];
    expect(a2.type).toBe('triggered');
    expect(a2.trigger?.hook).toBe('enter');
    expect(a2.effect?.kind).toBe('sequence');
    expect(a2.description).toMatch(/突撃/);
  });
});
