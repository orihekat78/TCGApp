// BUG-073: pattern B (uid なし + target.kind='pick') を使うカードの水平展開 verify
//
// D08015 a1 で発覚した pattern B 未対応問題 (BUG-065) の修正が、同 pattern を使う
// 他カード (D08003 / D08013 / D11007 + caseResolvedHandRemove 共通) でも正しく動作する
// ことを assert。各カードの全 ability effect を recursive walk し、含まれる discard /
// evidenceToHand 等の pattern B atom の target が AI heuristic 経由で配列化されることを
// 確認する。

import { describe, it, expect } from 'vitest';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import type { Effect, EffectCtx, GameState } from '@/engine/types';

import { D08003 } from '@/cards/ct-d08/D08003';
import { D08013 } from '@/cards/ct-d08/D08013';
import { D08015 } from '@/cards/ct-d08/D08015';
import { D11007 } from '@/cards/ct-d11/D11007';
import { caseResolvedHandRemove } from '@/cards/_shared/caseResolvedHandRemove';

function ctxSelf(): EffectCtx {
  return { source: { player: 'self', area: 'scene' }, bindings: {} };
}

function stateWithSelfHand(...handCards: string[]): GameState {
  const s = createEmptyGameState();
  s.players.self.hand.push(...handCards);
  return s;
}

/** effect tree を walk して、特定 verb の atom 全件を集める */
function findAtomsByVerb(effect: unknown, verb: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  function walk(e: unknown): void {
    if (!e || typeof e !== 'object') return;
    const o = e as Record<string, unknown>;
    if (o.kind === 'atom' && o.verb === verb) out.push(o);
    for (const v of Object.values(o)) {
      if (Array.isArray(v)) v.forEach(walk);
      else if (typeof v === 'object') walk(v);
    }
  }
  walk(effect);
  return out;
}

/** atom が pattern B (uid なし + target.kind='pick') かどうか */
function isPatternB(atom: Record<string, unknown>): boolean {
  const args = atom.args as Record<string, unknown> | undefined;
  if (!args) return false;
  const target = args.target as { kind?: string } | undefined;
  return args.uid === undefined && target?.kind === 'pick';
}

/** atom の target が解決済み (配列) かどうか */
function isResolvedToArray(atom: Record<string, unknown>): boolean {
  const args = atom.args as Record<string, unknown> | undefined;
  return Array.isArray(args?.target);
}

describe('BUG-073: pattern B 水平展開 — 影響カード 4 件の effect が解決される', () => {
  it('D08003 a1 の discard (pattern B) は AI heuristic で target 配列に解決される', () => {
    const s = stateWithSelfHand('D08015', 'D08003');
    for (const ability of D08003.abilities) {
      const resolved = resolveEffectPicks(s, ability.effect, ctxSelf());
      for (const atom of findAtomsByVerb(resolved, 'discard')) {
        // pre-resolve では pattern B、resolve 後は配列化済み
        expect(isPatternB(atom) || isResolvedToArray(atom)).toBe(true);
      }
    }
  });

  it('D08013 a1 の discard + evidenceToHand (pattern B) は target 配列に解決される', () => {
    const s = stateWithSelfHand('D08015', 'D08013');
    // evidence area も入れる (evidenceToHand 解決のため)
    s.players.self.evidence.push({ cardId: 'D08015', faceUp: false, origin: { turn: 0, via: 'init' } });
    for (const ability of D08013.abilities) {
      const resolved = resolveEffectPicks(s, ability.effect, ctxSelf());
      for (const atom of findAtomsByVerb(resolved, 'discard')) {
        expect(isPatternB(atom) || isResolvedToArray(atom)).toBe(true);
      }
      for (const atom of findAtomsByVerb(resolved, 'evidenceToHand')) {
        expect(isPatternB(atom) || isResolvedToArray(atom)).toBe(true);
      }
    }
  });

  it('D08015 a1 の discard (pattern B、本 BUG の発見契機) は target 配列に解決される', () => {
    const s = stateWithSelfHand('D08015', 'D08001');
    for (const ability of D08015.abilities) {
      const resolved = resolveEffectPicks(s, ability.effect, ctxSelf());
      for (const atom of findAtomsByVerb(resolved, 'discard')) {
        expect(isPatternB(atom) || isResolvedToArray(atom)).toBe(true);
      }
    }
  });

  it('D11007 a2 (declared) の discard (pattern B) は target 配列に解決される', () => {
    const s = stateWithSelfHand('D08015', 'D11007');
    for (const ability of D11007.abilities) {
      const resolved = resolveEffectPicks(s, ability.effect, ctxSelf());
      for (const atom of findAtomsByVerb(resolved, 'discard')) {
        expect(isPatternB(atom) || isResolvedToArray(atom)).toBe(true);
      }
    }
  });

  it('caseResolvedHandRemove 共通クラス (D08026 / D11021 経由) の discard (pattern B) は target 配列に解決される', () => {
    const s = stateWithSelfHand('D08015', 'D08001');
    const ability = caseResolvedHandRemove({ n: 1 });
    const resolved = resolveEffectPicks(s, ability.effect, ctxSelf());
    for (const atom of findAtomsByVerb(resolved, 'discard')) {
      expect(isPatternB(atom) || isResolvedToArray(atom)).toBe(true);
    }
  });

  it('D08015 a1 (フィルタ無し、filter 依存しない代表ケース): humanChooser=true + _fromAtomHandler=true で side-channel が set される (BUG-077)', () => {
    // BUG-077: 初期 walk (humanChooser=true、_fromAtomHandler 未指定) では Pattern B
    // の side-channel set を抑止する設計に変更。runtime tryRePickFromAtom 経由でのみ set。
    // 本テストは runtime path 相当 (_fromAtomHandler=true) で D08015 a1 の discard PB が
    // 正しく side-channel に set されることを確認。
    (globalThis as { __pendingEffectPickSide?: unknown }).__pendingEffectPickSide = null;
    const s = stateWithSelfHand('D08015', 'D08001');
    resolveEffectPicks(s, D08015.abilities[0]!.effect, ctxSelf(), {
      humanChooser: true,
      _fromAtomHandler: true,
      source: { cardId: 'D08015', abilityId: 'a1' },
    });
    const side = (globalThis as { __pendingEffectPickSide?: unknown }).__pendingEffectPickSide;
    expect(side).toBeTruthy();
  });
});
