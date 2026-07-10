// engine.cond.eval — removedCharMatches.byPlayer (attribution mini-wave ①, 2026-07-10)
// spec: .claude/specs/miniwave-attribution-byplayer.md
// 「自分の能力や効果によって〜リムーブされたとき」(B03116/B05107/B03112/B04089/B04091/B04094)。
// leave:to-remove payload に byPlayer (効果 owner、absolute Player) を additive 追加し、
// cond.byPlayer ('self'|'opp' = owner-relative) で gate する。
// 既存 `by` field (コンタクト勝者 uid 判定) とは別軸 — 混同禁止。
import { describe, it, expect, beforeEach } from 'vitest';
import { evalCond } from '@/engine/cond/eval';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { produce } from '@/engine/produce';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import type { CardDef, EffectCtx, GameState, SceneCharacter } from '@/engine/types';
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

describe('engine.cond.eval — removedCharMatches.byPlayer (attribution ①)', () => {
  beforeEach(() => {
    _resetRegistry();
    event._resetRegistry(); // handler 累積 → N 重発火防止 (mini-wave #4 教訓)
  });

  it("byPlayer:'self' — payload.byPlayer が owner と同じ ('self') なら発火", () => {
    const cond = { kind: 'removedCharMatches', side: 'self', cause: 'effect', byPlayer: 'self' } as const;
    const ctx = ctxWith({ uid: 'x', cause: 'effect', side: 'self', byPlayer: 'self' });
    expect(evalCond(createEmptyGameState(), cond, ctx)).toBe(true);
  });

  it("byPlayer:'self' — 相手が自分(相手)の効果で除去 (payload.byPlayer='opp') では非発火 [過剰発火 pin]", () => {
    const cond = { kind: 'removedCharMatches', side: 'self', cause: 'effect', byPlayer: 'self' } as const;
    const ctx = ctxWith({ uid: 'x', cause: 'effect', side: 'self', byPlayer: 'opp' });
    expect(evalCond(createEmptyGameState(), cond, ctx)).toBe(false);
  });

  it("byPlayer:'self' — payload.byPlayer 未設定 (legacy caller: turn-end/MR②/switch/cost) は非発火 [fail-closed pin]", () => {
    const cond = { kind: 'removedCharMatches', side: 'self', cause: 'effect', byPlayer: 'self' } as const;
    const ctx = ctxWith({ uid: 'x', cause: 'effect', side: 'self' });
    expect(evalCond(createEmptyGameState(), cond, ctx)).toBe(false);
  });

  it("byPlayer:'opp' — payload.byPlayer='opp' (owner から見て相手の効果) なら発火", () => {
    const cond = { kind: 'removedCharMatches', side: 'self', cause: 'effect', byPlayer: 'opp' } as const;
    const ctx = ctxWith({ uid: 'x', cause: 'effect', side: 'self', byPlayer: 'opp' });
    expect(evalCond(createEmptyGameState(), cond, ctx)).toBe(true);
  });

  it("byPlayer:'opp' — payload.byPlayer='self' では非発火", () => {
    const cond = { kind: 'removedCharMatches', side: 'self', cause: 'effect', byPlayer: 'opp' } as const;
    const ctx = ctxWith({ uid: 'x', cause: 'effect', side: 'self', byPlayer: 'self' });
    expect(evalCond(createEmptyGameState(), cond, ctx)).toBe(false);
  });

  it('byPlayer 省略 — 既存挙動不変 (byPlayer payload 有無に関わらず side/cause のみで判定) [回帰 pin]', () => {
    const cond = { kind: 'removedCharMatches', side: 'self', cause: 'effect' } as const;
    expect(evalCond(createEmptyGameState(), cond, ctxWith({ uid: 'x', cause: 'effect', side: 'self' }))).toBe(true);
    expect(evalCond(createEmptyGameState(), cond, ctxWith({ uid: 'x', cause: 'effect', side: 'self', byPlayer: 'opp' }))).toBe(true);
  });

  it('opp 側 observer — payload.byPlayer=opp + cond byPlayer:self (owner=opp 自身の効果) なら発火 [owner-relative pin]', () => {
    const cond = { kind: 'removedCharMatches', side: 'self', cause: 'effect', byPlayer: 'self' } as const;
    const ctx = makeCtx({ source: { player: 'opp', area: 'scene', uid: 'obs2' }, triggerPayload: { uid: 'x', cause: 'effect', side: 'opp', byPlayer: 'opp' } });
    expect(evalCond(createEmptyGameState(), cond, ctx)).toBe(true);
  });

  // ---- emit 配線 (mutate/scene.ts removeToRemove → leave:to-remove payload) ----
  it('removeToRemove opts.byPlayer が leave:to-remove payload に載る [emit 配線 pin]', () => {
    registerCardDef(defOf({ id: 'RM1' }));
    const s = withScene(createEmptyGameState(), 'opp', [makeChar({ uid: 'victim', cardId: 'RM1' })]);
    const captured: unknown[] = [];
    event.on('leave:to-remove', (_st, payload) => { captured.push(payload); });
    produce(s, draft => {
      mutate.scene.removeToRemove(draft, 'victim', 'effect', undefined, { byPlayer: 'self' });
    });
    expect(captured).toHaveLength(1);
    expect((captured[0] as { byPlayer?: string }).byPlayer).toBe('self');
  });

  it('removeToRemove opts.byPlayer 未指定 (legacy caller) は payload.byPlayer=undefined [回帰 pin]', () => {
    registerCardDef(defOf({ id: 'RM2' }));
    const s = withScene(createEmptyGameState(), 'opp', [makeChar({ uid: 'victim2', cardId: 'RM2' })]);
    const captured: unknown[] = [];
    event.on('leave:to-remove', (_st, payload) => { captured.push(payload); });
    produce(s, draft => {
      mutate.scene.removeToRemove(draft, 'victim2', 'switch');
    });
    expect(captured).toHaveLength(1);
    expect((captured[0] as { byPlayer?: string }).byPlayer).toBeUndefined();
  });
});
