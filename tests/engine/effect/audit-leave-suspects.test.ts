// 監査 suspect (leave:to-remove family) の候補フィルタ text-faithfulness を engine レベルで検証。
// leave→pick の UI フロー自体は B03091 の Playwright (audit-suspects-coverage.spec.ts) で実証済。
// 本 test は各カードの leave effect 引数が「テキスト通りの候補」を生むことを決定論的に確認する
// (B01063 経由の UI リムーブは AI heuristic で非決定的なため、フィルタ検証は engine が確実)。
//
// rules: 15-abilities-effects.md, 17-icons.md, 24-qa-naming-stun.md

import { describe, it, expect, beforeEach } from 'vitest';
import { runAtom } from '@/engine/effect/atom-handlers';
import { createEmptyGameState } from '@/engine/state-factory';
import { resolveEffectPicks, _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { registerAll } from '@/cards';
import { B08042 } from '@/cards/ct-p08/B08042';
import { B04030 } from '@/cards/ct-p04/B04030';
import { B03013 } from '@/cards/ct-p03/B03013';
import type { EffectCtx } from '@/engine/types';

type SC = { cardId: string; uid: string; state: 'active' | 'sleep' | 'stun'; level: number };
function sc(cardId: string, uid: string, state: SC['state']): Record<string, unknown> {
  return { cardId, uid, state, ap: 3000, lp: 1, level: 0, namedThisTurn: false, mods: { ap: 0, lp: 0, scope: 'turn' } };
}
function ctxSelf(cardId: string): EffectCtx {
  return { source: { player: 'self', area: 'scene', cardId, uid: `${cardId}#src`, abilityId: 'a1' }, bindings: {} } as unknown as EffectCtx;
}
function atomArgsOf(card: { abilities: { effect: unknown }[] }, idx: number): { verb: string; args: Record<string, unknown> } {
  const e = card.abilities[idx]!.effect as { verb: string; args: Record<string, unknown> };
  return { verb: e.verb, args: e.args };
}

describe('監査 leave suspect の候補フィルタ (B08042/B04030/B03013)', () => {
  beforeEach(() => {
    registerAll();
    _clearPendingEffectPickQueue();
  });

  // B08042 a1: sceneSetState stun, target pick {side:either, state:['sleep']}
  // → 候補 = 両 side の sleep キャラのみ (active は除外)。テキスト「スリープ状態のキャラを1枚まで」
  it('B08042: スリープ状態のキャラのみ候補 (state:[sleep] side:either)', () => {
    const s = createEmptyGameState();
    // self: D08011 sleep / D08019 active、opp: D08018 sleep / D08013 active
    s.players.self.scene.push(sc('D08011', 'self-slp', 'sleep') as never, sc('D08019', 'self-act', 'active') as never);
    s.players.opp.scene.push(sc('D08018', 'opp-slp', 'sleep') as never, sc('D08013', 'opp-act', 'active') as never);
    const { verb, args } = atomArgsOf(B08042, 0);
    // B08042 は long-form pick (uid:'$pick' + target query) → 初期 walk (resolveEffectPicks) で side-channel set
    resolveEffectPicks(s, { kind: 'atom', verb: verb as never, args } as never, ctxSelf('B08042'), {
      humanChooser: true, byPlayer: 'self', source: { cardId: 'B08042', abilityId: 'a1' },
    });
    const side = _drainPendingEffectPickSide();
    expect(side?.atomVerb).toBe('sceneSetState');
    const uids = (side?.candidates ?? []).map((c) => c.uid).sort();
    expect(uids, 'sleep のみ (active 除外)').toEqual(['opp-slp', 'self-slp']);
  });

  // B04030 a2: sceneSetState stun 短縮形 {side:either, filter:{levelMax:8}}
  // → 候補 = 両 side の level≤8 (level9 除外、state 不問)。テキスト「レベル8以下のキャラを1枚まで」
  it('B04030: level≤8 のみ候補 (levelMax:8 side:either、level9 除外)', () => {
    const s = createEmptyGameState();
    // self: D08009 lv5 / B05066 lv9、opp: D08003 lv8 / B05066 lv9
    s.players.self.scene.push(sc('D08009', 'self-l5', 'active') as never, sc('B05066', 'self-l9', 'active') as never);
    s.players.opp.scene.push(sc('D08003', 'opp-l8', 'sleep') as never, sc('B05066', 'opp-l9', 'sleep') as never);
    const { verb, args } = atomArgsOf(B04030, 0);
    runAtom(s, verb as never, args, ctxSelf('B04030'));
    const side = _drainPendingEffectPickSide();
    expect(side?.atomVerb).toBe('sceneSetState');
    const uids = (side?.candidates ?? []).map((c) => c.uid).sort();
    expect(uids, 'level≤8 のみ (lv9 除外)').toEqual(['opp-l8', 'self-l5']);
  });

  // B03013 a1: charModifyAP -2000 短縮形 {side:either, 無 filter}
  // → 候補 = 両 side の全キャラ。テキスト「キャラを1枚まで」
  it('B03013: 両 side の全キャラが候補 (side:either, filter なし)', () => {
    const s = createEmptyGameState();
    s.players.self.scene.push(sc('D08007', 'self-c', 'active') as never);
    s.players.opp.scene.push(sc('D08015', 'opp-c', 'sleep') as never);
    const { verb, args } = atomArgsOf(B03013, 0);
    runAtom(s, verb as never, args, ctxSelf('B03013'));
    const side = _drainPendingEffectPickSide();
    expect(side?.atomVerb).toBe('charModifyAP');
    const uids = (side?.candidates ?? []).map((c) => c.uid).sort();
    expect(uids, '両 side 全キャラ').toEqual(['opp-c', 'self-c']);
  });
});
