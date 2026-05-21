// engine.effect.resolveEffectPicks — Phase 7-2 unit tests
// spec: .claude/bugs/BUG-035.md
//
// 5 effect kind 全網羅: atom / choice / sequence / conditional / optional
// + parallel / forEach / replace のネスト再帰
// + 候補 0 件の no-op fallback

import { describe, it, expect } from 'vitest';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import type { Effect, EffectCtx, GameState } from '@/engine/types';

function ctxSelf(): EffectCtx {
  return { source: { player: 'self', area: 'scene' }, bindings: {} };
}

function stateWithSelfChar(uid = 'self-1', cardId = 'D08001'): GameState {
  const s = createEmptyGameState();
  s.players.self.scene.push({
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  });
  return s;
}

const PICK_ATOM: Effect = {
  kind: 'atom',
  verb: 'sceneSetState',
  args: {
    uid: '$pick',
    state: 'sleep',
    target: { kind: 'pick', query: { area: 'scene', side: 'self' }, n: { min: 0, max: 1 }, chooser: 'self' },
  },
} as Effect;

describe('engine.effect.resolveEffectPicks', () => {
  it('atom: $pick を first candidate (scene char uid) に substitute、target は削除', () => {
    const s = stateWithSelfChar('self-1');
    const resolved = resolveEffectPicks(s, PICK_ATOM, ctxSelf()) as { kind: string; args: { uid: string; target?: unknown; state: string } };
    expect(resolved.kind).toBe('atom');
    expect(resolved.args.uid).toBe('self-1');
    expect(resolved.args.target).toBeUndefined();
    expect(resolved.args.state).toBe('sleep');
  });

  it('atom: 候補 0 件は元 atom そのまま (no-op fallback)', () => {
    const s = createEmptyGameState(); // scene 空
    const resolved = resolveEffectPicks(s, PICK_ATOM, ctxSelf()) as { args: { uid: string } };
    expect(resolved.args.uid).toBe('$pick'); // 置換されない
  });

  it('choice: 各 option を再帰的に処理', () => {
    const s = stateWithSelfChar('self-1');
    const effect: Effect = { kind: 'choice', chooser: 'self', options: [PICK_ATOM, PICK_ATOM] };
    const resolved = resolveEffectPicks(s, effect, ctxSelf()) as { kind: string; options: { args: { uid: string } }[] };
    expect(resolved.kind).toBe('choice');
    expect(resolved.options[0]?.args.uid).toBe('self-1');
    expect(resolved.options[1]?.args.uid).toBe('self-1');
  });

  it('sequence: 各 step を再帰的に処理', () => {
    const s = stateWithSelfChar('self-1');
    const effect: Effect = { kind: 'sequence', steps: [PICK_ATOM, PICK_ATOM] };
    const resolved = resolveEffectPicks(s, effect, ctxSelf()) as { kind: string; steps: { args: { uid: string } }[] };
    expect(resolved.kind).toBe('sequence');
    expect(resolved.steps[0]?.args.uid).toBe('self-1');
    expect(resolved.steps[1]?.args.uid).toBe('self-1');
  });

  it('conditional: then と else を再帰的に処理', () => {
    const s = stateWithSelfChar('self-1');
    const effect: Effect = {
      kind: 'conditional',
      if: { kind: 'true' },
      then: PICK_ATOM,
      else: PICK_ATOM,
    };
    const resolved = resolveEffectPicks(s, effect, ctxSelf()) as { kind: string; then: { args: { uid: string } }; else: { args: { uid: string } } };
    expect(resolved.kind).toBe('conditional');
    expect(resolved.then.args.uid).toBe('self-1');
    expect(resolved.else.args.uid).toBe('self-1');
  });

  it('optional: inner effect を再帰的に処理', () => {
    const s = stateWithSelfChar('self-1');
    const effect: Effect = { kind: 'optional', effect: PICK_ATOM };
    const resolved = resolveEffectPicks(s, effect, ctxSelf()) as { kind: string; effect: { args: { uid: string } } };
    expect(resolved.kind).toBe('optional');
    expect(resolved.effect.args.uid).toBe('self-1');
  });

  it('parallel: 各 step を再帰的に処理', () => {
    const s = stateWithSelfChar('self-1');
    const effect: Effect = { kind: 'parallel', steps: [PICK_ATOM, PICK_ATOM] };
    const resolved = resolveEffectPicks(s, effect, ctxSelf()) as { kind: string; steps: { args: { uid: string } }[] };
    expect(resolved.kind).toBe('parallel');
    expect(resolved.steps[0]?.args.uid).toBe('self-1');
    expect(resolved.steps[1]?.args.uid).toBe('self-1');
  });

  it('atom (非 $pick): 元 atom そのまま', () => {
    const s = stateWithSelfChar('self-1');
    const effect: Effect = { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } as Effect;
    const resolved = resolveEffectPicks(s, effect, ctxSelf());
    expect(resolved).toStrictEqual(effect); // 不変
  });

  it('深いネスト (sequence → choice → atom $pick) を再帰処理', () => {
    const s = stateWithSelfChar('self-1');
    const effect: Effect = {
      kind: 'sequence',
      steps: [
        { kind: 'choice', chooser: 'self', options: [PICK_ATOM] },
        { kind: 'conditional', if: { kind: 'true' }, then: PICK_ATOM },
      ],
    };
    const resolved = resolveEffectPicks(s, effect, ctxSelf()) as { steps: ({ options: { args: { uid: string } }[] } | { then: { args: { uid: string } } })[] };
    expect((resolved.steps[0] as { options: { args: { uid: string } }[] }).options[0]?.args.uid).toBe('self-1');
    expect((resolved.steps[1] as { then: { args: { uid: string } } }).then.args.uid).toBe('self-1');
  });

  // Phase 7-3: opts.chooseAtomTarget callback (AIPolicy.chooseAtomTarget) 経由の選択
  it('Phase 7-3: opts.chooseAtomTarget 指定時に hook の返り値で uid を置換', () => {
    const s = stateWithSelfChar('self-1');
    // 2 体目を追加
    s.players.self.scene.push({
      cardId: 'D08002', uid: 'self-2', state: 'active', isNamed: false, enterOrder: 2,
      setCards: [], stackedCards: 0,
      keywordOverrides: { granted: [], disabledOriginal: false },
      apOverride: null, lpOverride: null,
      turnEffects: { contactImmune: false, removeOnTurnEnd: false },
      declaredUseCount: {},
    });
    const chooser = (
      _state: unknown,
      _verb: string,
      _args: Readonly<Record<string, unknown>>,
      cands: ReadonlyArray<{ kind: string; uid?: string }>,
    ) => cands.find((c) => c.kind === 'char' && (c as { uid: string }).uid === 'self-2') ?? null;
    const resolved = resolveEffectPicks(s, PICK_ATOM, ctxSelf(), {
      chooseAtomTarget: chooser as never,
      byPlayer: 'self',
    }) as { args: { uid: string } };
    expect(resolved.args.uid).toBe('self-2'); // hook 戻り値が反映
  });

  it('Phase 7-3: opts.chooseAtomTarget が null を返した場合は先頭採用 fallback', () => {
    const s = stateWithSelfChar('self-1');
    const chooser = () => null;
    const resolved = resolveEffectPicks(s, PICK_ATOM, ctxSelf(), {
      chooseAtomTarget: chooser as never,
      byPlayer: 'self',
    }) as { args: { uid: string } };
    expect(resolved.args.uid).toBe('self-1'); // first-pick fallback
  });

  it('Phase 7-3: opts 省略時は Phase 7-2 互換 (先頭採用)', () => {
    const s = stateWithSelfChar('self-1');
    const resolved = resolveEffectPicks(s, PICK_ATOM, ctxSelf()) as { args: { uid: string } };
    expect(resolved.args.uid).toBe('self-1');
  });
});
