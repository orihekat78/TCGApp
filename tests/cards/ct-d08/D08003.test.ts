// tests/cards/ct-d08/D08003
// spec: .claude/specs/cards-analysis/D08003.md

import { describe, it, expect } from 'vitest';
import { D08003 } from '@/cards/ct-d08/D08003';
import { D08004 } from '@/cards/ct-d08/D08004';

describe('D08003 江戸川コナン (character, Lv8 multi-ability)', () => {
  it('shape: id, kind, level=8, ap=7000, lp=2', () => {
    expect(D08003.id).toBe('D08003');
    expect(D08003.no).toBe('0489/D08003');
    expect(D08003.kind).toBe('character');
    expect(D08003.names).toEqual(['江戸川コナン']);
    expect(D08003.colors).toEqual(['青']);
    expect(D08003.level).toBe(8);
    expect(D08003.ap).toBe(7000);
    expect(D08003.lp).toBe(2);
    expect(D08003.traits).toEqual(['探偵', '毛利探偵事務所', '少年探偵団']);
    expect(D08003.abilities.length).toBe(2);
  });

  it('a1: パートナー青 enter chain (discard → sceneRemove) — 拡張 5 chain semantics', () => {
    // refactor: 旧 optional+sequence → chain (公式テキスト「そうした場合」を 1:1 表現)
    // step 1 (discard max:1) skip / no-candidate なら chain break で step 2 実行されない
    const a1 = D08003.abilities[0];
    expect(a1.id).toBe('a1');
    expect(a1.type).toBe('triggered');
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '青' });
    expect(a1.trigger?.hook).toBe('enter');
    expect(a1.trigger?.selfOnly).toBe(true);
    expect(a1.effect?.kind).toBe('chain');
  });

  it('a2: ターン終了時 sceneHas[少年探偵団]≥3 で 1ドロー', () => {
    const a2 = D08003.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('triggered');
    expect(a2.trigger?.hook).toBe('phase:end:start');
    expect(a2.condition).toEqual({ kind: 'turn', player: 'self' });
    expect(a2.effect?.kind).toBe('conditional');
  });

  it('D08004 variant shares abilities with D08003', () => {
    expect(D08004.abilities).toBe(D08003.abilities);
    expect(D08004.id).toBe('D08004');
    expect(D08004.imageUrl).not.toBe(D08003.imageUrl);
  });
});
