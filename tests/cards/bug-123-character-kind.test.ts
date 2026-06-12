// BUG-123: イベントを含むエリア (remove/hand) からの「キャラ」pick は kind:'character' 必須。
// remove/hand には同色イベントが居りうるため、color/level のみの filter だと誤候補化する。

import { describe, it, expect, beforeEach } from 'vitest';
import { B01094 } from '@/cards/ct-p01/B01094';
import { B09044 } from '@/cards/ct-p09/B09044';
import { candidates } from '@/engine/target/candidates';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type { CardDef, TargetFilter } from '@/engine/types';
import { makeCtx } from '../helpers/fixtures';

// 効果ツリーから args.filter / args.target.query.filter を取り出すゆるいヘルパ
function filterOf(node: unknown): TargetFilter | undefined {
  const args = (node as { args?: Record<string, unknown> })?.args;
  if (!args) return undefined;
  if (args.filter) return args.filter as TargetFilter;
  const target = args.target as { query?: { filter?: TargetFilter } } | undefined;
  return target?.query?.filter;
}

describe('BUG-123: 構造検証 — remove/hand pick の filter に kind:character', () => {
  it("B01094 a1 ① handAddFromRemove(remove,黄) は kind:'character'", () => {
    const seq = (B01094.abilities[0].effect as { steps: unknown[] }).steps;
    const f = filterOf(seq[0]);
    expect(f?.color).toBe('黄');
    expect(f?.kind).toBe('character');
  });

  it("B09044 a1 sceneEnter(hand,青/白) は kind:'character'", () => {
    const opt0 = (B09044.abilities[0].effect as { options: unknown[] }).options[0];
    const f = filterOf(opt0);
    expect(f?.color).toEqual(['青', '白']);
    expect(f?.kind).toBe('character');
  });

  it("B09044 a2 handAddFromRemove(remove,青/白) は kind:'character'", () => {
    const f = filterOf(B09044.abilities[1].effect);
    expect(f?.color).toEqual(['青', '白']);
    expect(f?.kind).toBe('character');
  });
});

describe('BUG-123: behavioral — kind:character filter が remove の同色イベントを除外', () => {
  beforeEach(() => _resetRegistry());

  function defOf(o: Partial<CardDef> & { id: string }): CardDef {
    return { id: o.id, no: 'NO', kind: 'character', names: ['x'], colors: [], traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...o };
  }

  it('remove に【黄】キャラ + 【黄】イベント → キャラのみ候補', () => {
    registerCardDef(defOf({ id: 'CHAR', kind: 'character', colors: ['黄'], level: 3 }));
    registerCardDef(defOf({ id: 'EVENT', kind: 'event', colors: ['黄'], level: 3 }));
    let s = createEmptyGameState();
    s = { ...s, players: { ...s.players, self: { ...s.players.self, remove: ['CHAR', 'EVENT'] } } };
    const result = candidates(
      s,
      { kind: 'pick', query: { area: 'remove', side: 'self', filter: { color: '黄', kind: 'character' } }, n: { min: 0, max: 1 }, chooser: 'self' },
      makeCtx(),
    );
    expect(result).toHaveLength(1);
    expect((result[0] as { cardId: string }).cardId).toBe('CHAR');
  });
});
