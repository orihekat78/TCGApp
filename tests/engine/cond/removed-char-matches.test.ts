// engine.cond.eval — removedCharMatches (cluster15 反撃カード一族, 2026-06-16)
// spec: .claude/specs/engine-cluster15-contact-removal-observer-design.md
// leave:to-remove payload snapshot {uid,cause,side,byUid} を scene 再取得せず読む condition。
// opus 3-lens 敵対設計レビューが要求した pin: self-not-firing / by:'self' / by:{filter}+excludeSource /
// cause filter / cardName split-name。
import { describe, it, expect, beforeEach } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import type { CardDef, GameState, SceneCharacter, EffectCtx } from '@/engine/types';
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
// observer (= ctx.source) は self 側 uid='obs' を既定とする
function ctxWith(payload: Record<string, unknown>, sourceUid = 'obs'): EffectCtx {
  return makeCtx({ source: { player: 'self', area: 'scene', uid: sourceUid }, triggerPayload: payload });
}

describe('engine.cond.eval — removedCharMatches (cluster15)', () => {
  beforeEach(() => _resetRegistry());

  // ---- side ----
  it('side:opp — 相手キャラが除去 (payload.side=opp) で発火', () => {
    const ctx = ctxWith({ uid: 'x', cause: 'contact-ap', side: 'opp', byUid: 'a' });
    expect(evalCond(createEmptyGameState(), { kind: 'removedCharMatches', side: 'opp' }, ctx)).toBe(true);
  });
  it('side:opp — 自分キャラが除去 (payload.side=self) では非発火 [self-not-firing pin]', () => {
    const ctx = ctxWith({ uid: 'x', cause: 'contact-ap', side: 'self', byUid: 'a' });
    expect(evalCond(createEmptyGameState(), { kind: 'removedCharMatches', side: 'opp' }, ctx)).toBe(false);
  });
  it('side 欠落 payload は非発火 (安全側)', () => {
    const ctx = ctxWith({ uid: 'x', cause: 'contact-ap' });
    expect(evalCond(createEmptyGameState(), { kind: 'removedCharMatches', side: 'opp' }, ctx)).toBe(false);
  });

  // ---- cause ----
  it('cause:contact-ap — contact 除去で発火 / effect 除去では非発火', () => {
    const cond = { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap' } as const;
    expect(evalCond(createEmptyGameState(), cond, ctxWith({ side: 'opp', cause: 'contact-ap', byUid: 'a' }))).toBe(true);
    expect(evalCond(createEmptyGameState(), cond, ctxWith({ side: 'opp', cause: 'effect', byUid: 'a' }))).toBe(false);
  });
  it('cause 省略 (ANY-METHOD) — effect/switch/cost 除去でも発火 [B05106 pin]', () => {
    const cond = { kind: 'removedCharMatches', side: 'opp' } as const;
    for (const cause of ['contact-ap', 'effect', 'switch', 'cost']) {
      expect(evalCond(createEmptyGameState(), cond, ctxWith({ side: 'opp', cause }))).toBe(true);
    }
  });

  // ---- by:'self' (CONTACT-SELF「このキャラとの」) ----
  it("by:self — 除去者 byUid が observer 自身なら発火 / 別キャラなら非発火", () => {
    const cond = { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: 'self' } as const;
    expect(evalCond(createEmptyGameState(), cond, ctxWith({ side: 'opp', cause: 'contact-ap', byUid: 'obs' }))).toBe(true);
    expect(evalCond(createEmptyGameState(), cond, ctxWith({ side: 'opp', cause: 'contact-ap', byUid: 'other' }))).toBe(false);
  });

  // ---- by:{filter} (CONTACT-FILTER「自分の現場の〚X〛との」) ----
  it('by:{filter trait} — 除去者(=winner, 生存)が filter 一致なら発火', () => {
    registerCardDef(defOf({ id: 'WPOL', names: ['降谷零'], traits: ['警察'] }));
    registerCardDef(defOf({ id: 'WDET', names: ['毛利小五郎'], traits: ['探偵'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'w1', cardId: 'WPOL' }), makeChar({ uid: 'w2', cardId: 'WDET' })]);
    const cond = { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: { filter: { trait: '警察' } } } as const;
    expect(evalCond(s, cond, ctxWith({ side: 'opp', cause: 'contact-ap', byUid: 'w1' }))).toBe(true);  // 警察
    expect(evalCond(s, cond, ctxWith({ side: 'opp', cause: 'contact-ap', byUid: 'w2' }))).toBe(false); // 探偵
  });
  it('by:{filter,excludeSource:true} — 除去者が observer 自身なら非発火 [B06067 「このキャラ以外」pin]', () => {
    registerCardDef(defOf({ id: 'WPOL', names: ['中森銀三'], traits: ['警察'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'obs', cardId: 'WPOL' })]);
    const cond = { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: { filter: { trait: '警察' }, excludeSource: true } } as const;
    expect(evalCond(s, cond, ctxWith({ side: 'opp', cause: 'contact-ap', byUid: 'obs' }))).toBe(false); // 自身=除外
  });
  it('by:{filter} excludeSource 省略 — 除去者が observer 自身 (警察) でも発火 [D09010 self-count pin]', () => {
    registerCardDef(defOf({ id: 'WPOL', names: ['降谷零'], traits: ['警察'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'obs', cardId: 'WPOL' })]);
    const cond = { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: { filter: { trait: '警察' } } } as const;
    expect(evalCond(s, cond, ctxWith({ side: 'opp', cause: 'contact-ap', byUid: 'obs' }))).toBe(true);
  });
  it('by:{filter cardName} — 分割名 (rules/19) の構成要素に一致 [B09026 split-name pin]', () => {
    // B08019 大岡紅葉＆伊織無我 = names に分割要素を含む。cardName:伊織無我 が一致すべき。
    registerCardDef(defOf({ id: 'SPLIT', names: ['大岡紅葉＆伊織無我', '大岡紅葉', '伊織無我'] }));
    let s = createEmptyGameState();
    s = withScene(s, 'self', [makeChar({ uid: 'w1', cardId: 'SPLIT' })]);
    const cond = { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: { filter: { cardName: '伊織無我' } } } as const;
    expect(evalCond(s, cond, ctxWith({ side: 'opp', cause: 'contact-ap', byUid: 'w1' }))).toBe(true);
  });
  it('by:{filter} — winner が scene 不在 (partner uid 等) なら非発火', () => {
    registerCardDef(defOf({ id: 'WPOL', names: ['降谷零'], traits: ['警察'] }));
    const s = withScene(createEmptyGameState(), 'self', [makeChar({ uid: 'obs', cardId: 'WPOL' })]);
    const cond = { kind: 'removedCharMatches', side: 'opp', cause: 'contact-ap', by: { filter: { trait: '警察' } } } as const;
    expect(evalCond(s, cond, ctxWith({ side: 'opp', cause: 'contact-ap', byUid: 'partner:self' }))).toBe(false);
  });
});
