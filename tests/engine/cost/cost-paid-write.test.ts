// engine.cost.pay — costPaid write 4 case (attribution mini-wave ②, 2026-07-10)
// spec: .claude/specs/miniwave-attribution-costpaid.md
// removeDeckTop/flipFaceUpEvidence と同型: pay() が導出値を ctx.costPaid[key] に確定格納し、
// dyn `$cost.<key>.<path>` / costRemovedMatches{key} / costRevealedMatches が読む。
// rules/21 (コスト「自分の」省略・すべて行う) / rules/25 逐次内挿。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { pay } from '@/engine/cost/pay';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type { CardDef, Cost, GameState, SceneCharacter } from '@/engine/types';
import { makeChar, makeCtx } from '../../helpers/fixtures';

function defOf(overrides: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: overrides.id, no: overrides.no ?? 'NO', kind: 'character', names: ['default'],
    colors: [], traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...overrides,
  };
}
function withScene(s: GameState, p: 'self' | 'opp', chars: SceneCharacter[]): GameState {
  return { ...s, players: { ...s.players, [p]: { ...s.players[p], scene: chars } } };
}
function withHand(s: GameState, ids: string[]): GameState {
  return { ...s, players: { ...s.players, self: { ...s.players.self, hand: ids } } };
}

describe('engine.cost.pay — costPaid write (attribution ②)', () => {
  beforeEach(() => _resetRegistry());

  it("removeFromHand — costPaid['removeFromHand'] = { ids, level } (B09050/B09060)", () => {
    registerCardDef(defOf({ id: 'HND5', level: 5 }));
    const s = withHand(createEmptyGameState(), ['HND5', 'X']);
    const cost: Cost = {
      kind: 'removeFromHand',
      target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'owner' },
      n: 1,
    };
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'src' } });
    produce(s, draft => { pay(draft, cost, ctx); });
    const rec = ctx.costPaid?.['removeFromHand'] as { ids?: string[]; level?: number } | undefined;
    expect(rec?.ids).toEqual(['HND5']);
    expect(rec?.level).toBe(5);
  });

  it("revealFromHand — costPaid['revealFromHand'] = { ids, count } (B08068/B09005)", () => {
    registerCardDef(defOf({ id: 'RVA', traits: ['喫茶ポアロ'] }));
    const s = withHand(createEmptyGameState(), ['RVA', 'RVA', 'X']);
    const cost: Cost = {
      kind: 'revealFromHand',
      target: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { trait: '喫茶ポアロ' } }, n: { min: 0, max: 99 }, chooser: 'owner' },
      n: { min: 0, max: 99 },
    } as Cost;
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'src' } });
    produce(s, draft => { pay(draft, cost, ctx); });
    const rec = ctx.costPaid?.['revealFromHand'] as { ids?: string[]; count?: number } | undefined;
    expect(rec?.ids).toEqual(['RVA', 'RVA']);
    expect(rec?.count).toBe(2);
  });

  it("sceneToDeckBottom — costPaid['sceneToDeckBottom'] = { ids, level } (B07025)", () => {
    registerCardDef(defOf({ id: 'MAG4', level: 4, traits: ['マジシャン'] }));
    const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'm1', cardId: 'MAG4' })]);
    const cost: Cost = {
      kind: 'sceneToDeckBottom',
      target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { trait: 'マジシャン' } }, n: { min: 1, max: 1 }, chooser: 'owner' },
      n: 1,
    } as Cost;
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'src' } });
    produce(s, draft => { pay(draft, cost, ctx); });
    const rec = ctx.costPaid?.['sceneToDeckBottom'] as { ids?: string[]; level?: number } | undefined;
    expect(rec?.ids).toEqual(['MAG4']);
    expect(rec?.level).toBe(4);
  });

  it("removeSetCard hostSelf — host を能力使用キャラ自身に限定 (B08041「このキャラに」) [decoy pin]", async () => {
    const { canPay } = await import('@/engine/cost/evaluate');
    registerCardDef(defOf({ id: 'SETX', kind: 'event' }));
    const src = makeChar({ uid: 'src', cardId: 'HOSTA' });
    src.setCards = [{ cardId: 'SETX', faceUp: false }];
    const decoy = makeChar({ uid: 'decoy', cardId: 'HOSTB' });
    decoy.setCards = [{ cardId: 'SETX', faceUp: false }];
    const s = withScene(createEmptyGameState(), 'self', [decoy, src]); // decoy が scene 先頭 (fallback 走査順の罠を pin)
    const cost: Cost = { kind: 'removeSetCard', n: 1, hostSelf: true } as Cost;
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'src' } });
    const result = produce(s, draft => { pay(draft, cost, ctx); });
    expect(result.players.self.scene.find(c => c.uid === 'src')?.setCards, '自身のセットが除去される').toHaveLength(0);
    expect(result.players.self.scene.find(c => c.uid === 'decoy')?.setCards, 'decoy のセットは残る').toHaveLength(1);
    // canPay: 自身にセット無し + decoy のみ有り → 支払不可 (fail-closed)
    const s2 = withScene(createEmptyGameState(), 'self', [decoy, makeChar({ uid: 'src', cardId: 'HOSTA' })]);
    expect(canPay(s2, cost, ctx)).toBe(false);
  });

  it("removeSetCard — costPaid['removeSetCard'] = { ids, kinds } (B08041)", () => {
    registerCardDef(defOf({ id: 'SETEV', kind: 'event' }));
    const host = makeChar({ uid: 'h1', cardId: 'HOSTC' });
    host.setCards = [{ cardId: 'SETEV', faceUp: false }];
    const s = withScene(createEmptyGameState(), 'self', [host]);
    const cost: Cost = { kind: 'removeSetCard', n: 1 } as Cost;
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', uid: 'src' } });
    produce(s, draft => { pay(draft, cost, ctx); });
    const rec = ctx.costPaid?.['removeSetCard'] as { ids?: string[]; kinds?: (string | undefined)[] } | undefined;
    expect(rec?.ids).toEqual(['SETEV']);
    expect(rec?.kinds).toEqual(['event']);
  });
});
