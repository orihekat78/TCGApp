// engine.effect.resolveEffectPicks — Phase 7-2 unit tests
// spec: .claude/bugs/BUG-035.md
//
// 5 effect kind 全網羅: atom / choice / sequence / conditional / optional
// + parallel / forEach / replace のネスト再帰
// + 候補 0 件の no-op fallback

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveEffectPicks, _clearPendingEffectPickQueue, _drainPendingEffectPickSide, _peekPendingEffectOptionalSide, _clearPendingEffectOptionalSide } from '@/engine/effect/resolve-picks';
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

  it('conditional (stable if=true): TAKEN branch のみ walk、非taken は raw のまま (BUG-145 over-fire 防止)', () => {
    // BUG-145: stable な if (binding 非依存) は pre-walk で taken branch のみ解決し、非taken の $pick/
    // choice/optional が eager-surface しないようにする。runtime resolver が if を再評価し taken のみ実行。
    const s = stateWithSelfChar('self-1');
    const effect: Effect = {
      kind: 'conditional',
      if: { kind: 'true' },
      then: PICK_ATOM,
      else: PICK_ATOM,
    };
    const resolved = resolveEffectPicks(s, effect, ctxSelf()) as { kind: string; then: { args: { uid: string } }; else: { args: { uid: string } } };
    expect(resolved.kind).toBe('conditional');
    expect(resolved.then.args.uid, 'taken(then) は substitute される').toBe('self-1');
    expect(resolved.else.args.uid, '非taken(else) は raw $pick のまま (surface しない)').toBe('$pick');
  });

  it('conditional (stable if=false): else のみ walk、then は raw のまま', () => {
    const s = stateWithSelfChar('self-1');
    const effect: Effect = {
      kind: 'conditional',
      if: { kind: 'false' },
      then: PICK_ATOM,
      else: PICK_ATOM,
    };
    const resolved = resolveEffectPicks(s, effect, ctxSelf()) as { kind: string; then: { args: { uid: string } }; else: { args: { uid: string } } };
    expect(resolved.then.args.uid, '非taken(then) は raw のまま').toBe('$pick');
    expect(resolved.else.args.uid, 'taken(else) は substitute される').toBe('self-1');
  });

  it('conditional (binding-dependent if): binding 未設定は raw、bind 後は selected branch のみ walk', () => {
    // 前段の bind が未解決なら branch を pre-walk せず raw のまま返す。continuation が bind 後に
    // 再入した時点でだけ condition を評価し、selected branch のみを walk する。
    const s = stateWithSelfChar('self-1');
    const effect: Effect = {
      kind: 'conditional',
      if: { kind: 'bound', key: '$matched', presence: 'matched' },
      then: PICK_ATOM,
      else: PICK_ATOM,
    };
    const ctx = ctxSelf();
    const unresolved = resolveEffectPicks(s, effect, ctx) as { kind: string; then: { args: { uid: string } }; else: { args: { uid: string } } };
    expect(unresolved).toBe(effect);

    ctx.bindings.$matched = [{ cardId: 'MATCHED' }];
    const resolved = resolveEffectPicks(s, effect, ctx) as { kind: string; then: { args: { uid: string } }; else: { args: { uid: string } } };
    expect(resolved.then.args.uid, 'bind 後 selected then のみ substitute').toBe('self-1');
    expect(resolved.else.args.uid, 'non-selected else は raw のまま').toBe('$pick');
  });

  // 2026-06-06 タスクC: optional 決定の配線。旧「inner を再帰 passthrough」から
  // 「optionalRun 指定で walk / 非human は skip / human は surface して pause」に変更。
  it('optional (run): ctx.dyn.optionalRun=true で内部 effect を walk ($pick 解決)', () => {
    _clearPendingEffectOptionalSide();
    const s = stateWithSelfChar('self-1');
    const effect: Effect = { kind: 'optional', effect: PICK_ATOM };
    const ctx = ctxSelf();
    ctx.dyn = { optionalRun: true };
    const resolved = resolveEffectPicks(s, effect, ctx) as { kind: string; args: { uid: string } };
    expect(resolved.kind).toBe('atom');
    expect(resolved.args.uid).toBe('self-1');
  });

  it('optional (skip): 非 human (humanChooser 未指定) は no-op (空 parallel)', () => {
    _clearPendingEffectOptionalSide();
    const s = stateWithSelfChar('self-1');
    const effect: Effect = { kind: 'optional', effect: PICK_ATOM };
    const resolved = resolveEffectPicks(s, effect, ctxSelf()) as { kind: string; steps: unknown[] };
    expect(resolved.kind).toBe('parallel');
    expect(resolved.steps).toHaveLength(0);
    expect(_peekPendingEffectOptionalSide(), '非 human は surface しない').toBeNull();
  });

  it('optional (human): pendingEffectOptional を surface して no-op pause', () => {
    _clearPendingEffectOptionalSide();
    const s = stateWithSelfChar('self-1');
    const effect: Effect = { kind: 'optional', effect: PICK_ATOM };
    const resolved = resolveEffectPicks(s, effect, ctxSelf(), {
      humanChooser: true, byPlayer: 'self', source: { cardId: 'X', abilityId: 'a1' },
    }) as { kind: string; steps: unknown[] };
    expect(resolved.kind).toBe('parallel');
    expect(resolved.steps).toHaveLength(0);
    expect(_peekPendingEffectOptionalSide(), 'human は pendingEffectOptional を surface').not.toBeNull();
    _clearPendingEffectOptionalSide();
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

// BUG-065: pattern B (uid なし + target.kind='pick') の解決
// 例: discard atom の target 配列 / evidenceToHand の target 配列
const DISCARD_PICK_ATOM: Effect = {
  kind: 'atom',
  verb: 'discard',
  args: {
    player: 'self',
    target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' },
  },
} as Effect;

function stateWithSelfHand(...handCards: string[]): GameState {
  const s = createEmptyGameState();
  s.players.self.hand.push(...handCards);
  return s;
}

describe('engine.effect.resolveEffectPicks — pattern B (BUG-065)', () => {
  beforeEach(() => {
    _clearPendingEffectPickQueue();
  });

  it('atom: discard target を first candidate cardId 配列に substitute (AI heuristic fallback)', () => {
    const s = stateWithSelfHand('D08015', 'D08001');
    const resolved = resolveEffectPicks(s, DISCARD_PICK_ATOM, ctxSelf()) as {
      args: { player: string; target?: unknown };
    };
    expect(Array.isArray(resolved.args.target)).toBe(true);
    expect(resolved.args.target).toEqual(['D08015']);
    expect(resolved.args.player).toBe('self');
  });

  it('atom: 候補 0 件は元 atom そのまま (target 未解決のまま)', () => {
    const s = createEmptyGameState();
    const resolved = resolveEffectPicks(s, DISCARD_PICK_ATOM, ctxSelf()) as {
      args: { target: { kind?: string } };
    };
    expect(resolved.args.target.kind).toBe('pick');
  });

  it('atom: humanChooser=true 初期 walk では Pattern B の side-channel を set しない (BUG-077)', () => {
    // BUG-077: 初期 walk (resolveEffectPicks) は Pattern B (uid 不在) の side-channel set を
    // 抑止する。理由: sequence の後続 step が先行 step の target を横取りする問題を回避。
    // runtime atom-handler awaiting-pick (tryRePickFromAtom 経由) で正しく set される。
    _clearPendingEffectPickQueue();
    const s = stateWithSelfHand('D08015', 'D08001');
    const resolved = resolveEffectPicks(s, DISCARD_PICK_ATOM, ctxSelf(), {
      humanChooser: true,
      source: { cardId: 'D08015', abilityId: 'a1' },
    }) as { args: { target: { kind?: string } } };
    expect(resolved.args.target.kind).toBe('pick');
    const side = _drainPendingEffectPickSide();
    expect(side, '初期 walk では Pattern B side-channel を set しない').toBeFalsy();
  });

  it('atom: humanChooser=true + _fromAtomHandler=true (runtime path) は Pattern B でも side-channel set (BUG-077)', () => {
    // BUG-077: runtime atom-handler awaiting-pick から呼ばれる tryRePickFromAtom 経由では
    // _fromAtomHandler=true 渡され、Pattern B でも正しく side-channel set される。
    _clearPendingEffectPickQueue();
    const s = stateWithSelfHand('D08015', 'D08001');
    resolveEffectPicks(s, DISCARD_PICK_ATOM, ctxSelf(), {
      humanChooser: true,
      _fromAtomHandler: true,
      source: { cardId: 'D08015', abilityId: 'a1' },
    });
    const side = _drainPendingEffectPickSide() as {
      candidates: { cardId: string }[];
      atomVerb: string;
      nMin: number;
      nMax: number;
    } | null;
    expect(side).toBeTruthy();
    expect(side?.atomVerb).toBe('discard');
    expect(side?.candidates.map((c) => c.cardId).sort()).toEqual(['D08001', 'D08015']);
    expect(side?.nMin).toBe(1);
    expect(side?.nMax).toBe(1);
  });

  it('atom: chooseAtomTarget が返した candidate の cardId を target に反映', () => {
    const s = stateWithSelfHand('D08015', 'D08001');
    const chooser = (
      _state: GameState,
      _verb: string,
      _args: Readonly<Record<string, unknown>>,
      cands: ReadonlyArray<{ kind: string; cardId: string }>,
    ) => cands.find((c) => c.cardId === 'D08001') ?? null;
    const resolved = resolveEffectPicks(s, DISCARD_PICK_ATOM, ctxSelf(), {
      chooseAtomTarget: chooser as never,
      byPlayer: 'self',
    }) as { args: { target: string[] } };
    expect(resolved.args.target).toEqual(['D08001']);
  });
});
