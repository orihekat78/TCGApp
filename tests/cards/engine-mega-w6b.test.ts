// tests/cards/engine-mega-w6b
// engine mega-wave W6 後半 (2026-07-04): structural step7-11 の TDD probe。
//   step7 (row70): setEvidenceGainSuppress verb + gainSelfEvidence gate + hirameki defer 再順序化
//                  (B02088/B03126 ヒラメキ「相手はこのアクションによって証拠を得られない」)
//   step8 (row75): reservedEffects queue (離場後予約 — B08069 ターン終了時 / B01058 next-match)
//   step9 (row65): startContact 本実装 (B06020/B06042 コンタクト発生効果、アクションではない)
//   step10 (row9): leave:intercept pre-splice consult hook (B01092 hand redirect / B01039 kept-in-scene)
//   step11 (row999 item3+4): hand-declared scope gate + findDeclaredAbility rider + removeAreaToDeckTop
// rules: 07/08/10/14/15/16/21/22/25 + 各カード公式Q&A
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate/index';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { run as runEffect } from '@/engine/effect/resolver';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { registerReservedEffectListener, _resetReservedEffectsRegistered } from '@/engine/listeners/reserved-effects';
import { endTurn } from '@/engine/flow/turn';
import { action as flowAction } from '@/engine/flow/action/state-machine';
import { contact as contactFlow } from '@/engine/flow/contact';
import { _drainPendingContactStartAxId } from '@/engine/effect/atom-handlers/_shared';
import { findCardOnBoard, canDeclaredAbility, useDeclaredAbility, findDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { sceneChar } from '../helpers/fixtures';
import type { CardDef, Effect, EffectCtx, EvidenceCard, GameState } from '@/engine/types';

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = s; };

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const DRAW1: Effect = { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } as never;
const ev = (cardId: string): EvidenceCard => ({ cardId, faceUp: false, origin: { turn: 1, via: 'effect' } });

// ---- step7 合成 def ----
// B02088 a3 相当: 【ヒラメキ】相手はこのアクションによって証拠を得られない
const HSUP = mkChar('HSUP', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-evidence',
    trigger: { hook: 'evidence:remove-by-action', optional: true },
    effect: { kind: 'atom', verb: 'setEvidenceGainSuppress', args: { player: 'opp' } },
    description: '【ヒラメキ】相手はこのアクションによって証拠を得られない', ruleRefs: [],
  } as never],
});
// 通常ヒラメキ (draw) — suppress を持たない optional 比較対象
const HDRAW = mkChar('HDRAW', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-evidence',
    trigger: { hook: 'evidence:remove-by-action', optional: true },
    effect: DRAW1, description: '【ヒラメキ】draw1', ruleRefs: [],
  } as never],
});
const PLAIN7 = mkChar('PLAIN7');
const MOB7 = mkChar('MOB7');

/** self attacker vs opp case のアクション[事件] 盤面。opp evidence top を指定。 */
function caseAttackBase(oppEvidenceTop: string): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.scene = [sceneChar('PLAIN7', 'atk')];
  s.players.self.deck = ['MOB7', 'MOB7', 'MOB7'];
  s.players.opp.evidence = [ev(oppEvidenceTop)];
  s.players.opp.deck = ['MOB7', 'MOB7'];
  return s;
}

/** actionDeclareCase → passGuard → actionJudge を dispatch で駆動し actionId を返す */
function driveUnguardedCaseAction(): string {
  const r1 = dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'atk', targetPlayer: 'opp' } as never);
  expect(r1.ok, `declare: ${JSON.stringify(r1)}`).toBe(true);
  const axId = useGameStateStore.getState().activeActionId!;
  expect(axId).toBeTruthy();
  const r2 = dispatchEngineAction({ type: 'actionGuard', actionId: axId, guarderUid: null } as never);
  expect(r2.ok, `guard-pass: ${JSON.stringify(r2)}`).toBe(true);
  const r3 = dispatchEngineAction({ type: 'actionJudge', actionId: axId } as never);
  expect(r3.ok, `judge: ${JSON.stringify(r3)}`).toBe(true);
  return axId;
}

// ---- step8 合成 def ----
const ARMER = mkChar('ARMER');
const COP4 = mkChar('COP4', { level: 4, traits: ['警察'] });
const COP5 = mkChar('COP5', { level: 5, traits: ['警察'] });
const SLEEPY1 = mkChar('SLEEPY1');
const SLEEPY2 = mkChar('SLEEPY2');

// B08069 相当: ターン終了時、手札からレベル4以下の特徴[警察] キャラを1枚まで登場させる (予約)
const RESERVE_TURNEND: Effect = { kind: 'atom', verb: 'reserveEffect', args: {
  hook: 'phase:end:start', mode: 'turn-end',
  effect: { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', from: 'hand', max: 1, viaEffect: true, filter: { levelMax: 4, trait: '警察', kind: 'character' } } },
} } as never;
// B01058 相当 (第2句): このターン中、次に相手の証拠がリムーブされたとき、スリープ状態のキャラを1枚まで選びスタン
const RESERVE_NEXTMATCH: Effect = { kind: 'atom', verb: 'reserveEffect', args: {
  hook: 'evidence:removed', mode: 'next-match', condition: { kind: 'triggerPlayerIs', side: 'opp' },
  effect: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$pick', state: 'stun', target: { kind: 'pick', query: { area: 'scene', side: 'self', state: ['sleep'] }, n: { min: 0, max: 1 }, chooser: 'self' } } },
} } as never;

const rctx = (): EffectCtx =>
  ({ source: { player: 'self', cardId: 'ARMER', uid: 'armer', abilityId: 'a1', area: 'scene' }, bindings: {} } as EffectCtx);

function reserveBase(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.scene = [sceneChar('ARMER', 'armer')];
  s.players.self.hand = ['COP4', 'COP5'];
  s.players.self.deck = ['MOB7', 'MOB7'];
  s.players.opp.deck = ['MOB7', 'MOB7'];
  return s;
}

beforeEach(() => {
  useGameStateStore.getState().resetMatchSessionState();
  event._resetRegistry(); _resetTriggeredRegistered(); _resetReservedEffectsRegistered(); _resetUidCounter(); resetDefRegistry();
  _clearPendingEffectPickQueue();
  setHuman(null);
  for (const d of [HSUP, HDRAW, PLAIN7, MOB7, ARMER, COP4, COP5, SLEEPY1, SLEEPY2]) registerCardDef(d);
  registerTriggeredListener();
  registerReservedEffectListener();
  useGameStateStore.getState().setPendingHirameki?.(null as never);
});

describe('W6b step7 (row70): setEvidenceGainSuppress + hirameki defer', () => {
  it('§7-1 fast path 回帰: ヒラメキ無し証拠 → actionJudge 同 dispatch 内で self 証拠+1 / opp 証拠-1', () => {
    useGameStateStore.getState().setGameState(caseAttackBase('PLAIN7'));
    driveUnguardedCaseAction();
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence.length).toBe(1);
    expect(after.players.opp.evidence.length).toBe(0);
    expect(useGameStateStore.getState().pendingHirameki).toBeNull();
  });

  it('§7-2 HSUP 証拠 top → gain は defer され pendingHirameki.gainDeferred=true', () => {
    useGameStateStore.getState().setGameState(caseAttackBase('HSUP'));
    driveUnguardedCaseAction();
    const after = useGameStateStore.getState().gameState!;
    // gain は hiramekiResolve まで保留 (rules/10 + B02088 Q&A)
    expect(after.players.self.evidence.length).toBe(0);
    const pending = useGameStateStore.getState().pendingHirameki as { gainDeferred?: boolean; actorUid?: string } | null;
    expect(pending).not.toBeNull();
    expect(pending!.gainDeferred).toBe(true);
    expect(pending!.actorUid).toBe('atk');
  });

  it('§7-3 skip 選択 → deferred gain が実行され self 証拠+1 + evidence:gain emit', () => {
    useGameStateStore.getState().setGameState(caseAttackBase('HSUP'));
    let gainFired = 0;
    const off = event.on('evidence:gain', () => { gainFired += 1; });
    driveUnguardedCaseAction();
    const r = dispatchEngineAction({ type: 'hiramekiResolve', choice: 'skip' } as never);
    expect(r.ok).toBe(true);
    off();
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence.length).toBe(1);
    expect(gainFired).toBe(1);
  });

  it('§7-4 fire 選択 → suppress 消費で gain 不発 + evidence:gain 非 emit (依存 trigger も不発)', () => {
    useGameStateStore.getState().setGameState(caseAttackBase('HSUP'));
    let gainFired = 0;
    const off = event.on('evidence:gain', () => { gainFired += 1; });
    driveUnguardedCaseAction();
    const r = dispatchEngineAction({ type: 'hiramekiResolve', choice: 'fire' } as never);
    expect(r.ok).toBe(true);
    off();
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence.length).toBe(0); // 得られない
    expect(gainFired).toBe(0); // 依存 trigger (「証拠を得たとき」) も発火しない
    // 単発消費: flag は consume-on-read で false に戻る
    expect(after.turnState.self.evidenceGainSuppressed).toBeFalsy();
  });

  it('§7-5 deferred gain 時点で deck0 → refresh 後に獲得 (rules/14)', () => {
    const s = caseAttackBase('HSUP');
    s.players.self.deck = [];
    s.players.self.remove = ['MOB7', 'MOB7'];
    useGameStateStore.getState().setGameState(s);
    driveUnguardedCaseAction();
    const r = dispatchEngineAction({ type: 'hiramekiResolve', choice: 'skip' } as never);
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence.length).toBe(1); // refresh → gain
    expect(after.gameResult).toBeUndefined();
  });

  it('§7-6 resetTurnFlags が evidenceGainSuppressed を backstop 清掃', () => {
    const s = produce(createEmptyGameState(), (d) => {
      (d.turnState.self as Record<string, unknown>).evidenceGainSuppressed = true;
    });
    const cleaned = produce(s, (d) => { mutate.flag.resetTurnFlags(d, 'self'); });
    expect(cleaned.turnState.self.evidenceGainSuppressed).toBe(false);
  });

  it('§7-7 通常ヒラメキ (HDRAW) でも gain は defer され、fire 後に gain も hirameki 効果も両方走る', () => {
    const s = caseAttackBase('HDRAW');
    s.players.opp.deck = ['MOB7', 'MOB7', 'MOB7'];
    useGameStateStore.getState().setGameState(s);
    driveUnguardedCaseAction();
    const mid = useGameStateStore.getState().gameState!;
    expect(mid.players.self.evidence.length).toBe(0); // defer 中
    const oppHandBefore = mid.players.opp.hand.length;
    const r = dispatchEngineAction({ type: 'hiramekiResolve', choice: 'fire' } as never);
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.evidence.length).toBe(1); // suppress 無し → gain は走る
    expect(after.players.opp.hand.length).toBe(oppHandBefore + 1); // hirameki draw も解決済
  });
});

describe('W6b step8 (row75): reservedEffects queue', () => {
  it('§8-1 turn-end 予約: arm → 同 main phase では不発 → phase:end:start で発火し単発消費', () => {
    let s = produce(reserveBase(), (d) => {
      runEffect(d, RESERVE_TURNEND as never, rctx());
    });
    expect(s.reservedEffects).toHaveLength(1);
    expect(s.reservedEffects[0]!.trigger).toMatchObject({ mode: 'turn-end', hook: 'phase:end:start', player: 'self', armedTurn: 5 });
    // arm 元キャラが離場 (コスト=デッキ下想定) しても entry は残る
    s = produce(s, (d) => {
      d.players.self.scene = [];
      runAllUntilEmpty(d);
    });
    expect(s.reservedEffects).toHaveLength(1);
    expect(s.players.self.scene).toHaveLength(0); // main phase 中は不発
    // ターン終了時発火
    s = produce(s, (d) => {
      event.emit(d, 'phase:end:start', { player: 'self' }, undefined);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.map((c) => c.cardId)).toEqual(['COP4']); // level4 警察 のみ登場
    expect(s.players.self.hand).toEqual(['COP5']);
    expect(s.reservedEffects).toHaveLength(0); // 単発消費
  });

  it('§8-2 filter 不一致 (COP5 のみ) → 0-pick で clean 不発 + entry は消費', () => {
    const base = reserveBase();
    base.players.self.hand = ['COP5'];
    let s = produce(base, (d) => { runEffect(d, RESERVE_TURNEND as never, rctx()); });
    s = produce(s, (d) => {
      event.emit(d, 'phase:end:start', { player: 'self' }, undefined);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.map((c) => c.cardId)).toEqual(['ARMER']);
    expect(s.players.self.hand).toEqual(['COP5']);
    expect(s.reservedEffects).toHaveLength(0);
  });

  it('§8-3 armedTurn guard: 翌ターンの phase:end:start では発火しない', () => {
    let s = produce(reserveBase(), (d) => { runEffect(d, RESERVE_TURNEND as never, rctx()); });
    s = produce(s, (d) => { d.turn.number = 6; });
    s = produce(s, (d) => {
      event.emit(d, 'phase:end:start', { player: 'self' }, undefined);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.map((c) => c.cardId)).toEqual(['ARMER']); // 登場なし
    expect(s.players.self.hand).toEqual(['COP4', 'COP5']);
  });

  it('§8-4 next-match: 相手証拠リムーブで発火 → スリープキャラがスタン + 単発消費', () => {
    const base = reserveBase();
    base.players.self.scene = [sceneChar('ARMER', 'armer'), sceneChar('SLEEPY1', 'sl1', { state: 'sleep' })];
    base.players.opp.evidence = [ev('PLAIN7')];
    let s = produce(base, (d) => { runEffect(d, RESERVE_NEXTMATCH as never, rctx()); });
    expect(s.reservedEffects).toHaveLength(1);
    s = produce(s, (d) => {
      mutate.evidence.removeTop(d, 'opp');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.uid === 'sl1')!.state).toBe('stun');
    expect(s.reservedEffects).toHaveLength(0);
  });

  it('§8-5 next-match decoy: 自分の証拠リムーブでは発火せず、その後の相手リムーブで発火', () => {
    const base = reserveBase();
    base.players.self.scene = [sceneChar('ARMER', 'armer'), sceneChar('SLEEPY1', 'sl1', { state: 'sleep' })];
    base.players.self.evidence = [ev('PLAIN7')];
    base.players.opp.evidence = [ev('PLAIN7')];
    let s = produce(base, (d) => { runEffect(d, RESERVE_NEXTMATCH as never, rctx()); });
    s = produce(s, (d) => {
      mutate.evidence.removeTop(d, 'self'); // 自分側 → 条件不成立
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.uid === 'sl1')!.state).toBe('sleep');
    expect(s.reservedEffects).toHaveLength(1); // 未消費で残る
    s = produce(s, (d) => {
      mutate.evidence.removeTop(d, 'opp'); // 相手側 → 発火
      runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.uid === 'sl1')!.state).toBe('stun');
    expect(s.reservedEffects).toHaveLength(0);
  });

  it('§8-6 turn 境界: 未消費 next-match は endTurn で失効し翌ターンに漏れない', () => {
    let s = produce(reserveBase(), (d) => { runEffect(d, RESERVE_NEXTMATCH as never, rctx()); });
    expect(s.reservedEffects).toHaveLength(1);
    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d);
    });
    expect(s.reservedEffects).toHaveLength(0);
  });

  it('§8-7 同 hook に独立 arm した 2 entry は 1 emit で両方発火 (rules/25 同時発動)', () => {
    const base = reserveBase();
    base.players.self.scene = [
      sceneChar('SLEEPY1', 'sl1', { state: 'sleep' }),
      sceneChar('SLEEPY2', 'sl2', { state: 'sleep' }),
    ];
    base.players.opp.evidence = [ev('PLAIN7')];
    let s = produce(base, (d) => {
      runEffect(d, RESERVE_NEXTMATCH as never, rctx());
      runEffect(d, RESERVE_NEXTMATCH as never, rctx());
    });
    expect(s.reservedEffects).toHaveLength(2);
    s = produce(s, (d) => {
      mutate.evidence.removeTop(d, 'opp');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    // 両 entry とも発火・消費される (rules/25 同時発動)。pick は listener の queue 時
    // pre-resolve (triggered.ts と同 posture) のため両 entry が同一 char を選びうる —
    // 解決時盤面 pick への一般化は declaredReaction 限定 deferred resolver の拡張が要る
    // (DEFERRED-INDEX megaw6b 節、既存 engine-wide posture と同 class)。
    expect(s.players.self.scene.some((c) => c.state === 'stun')).toBe(true);
    expect(s.reservedEffects).toHaveLength(0);
  });
});

describe('W6b step9 (row65): startContact 本実装 (効果によるコンタクト発生)', () => {
  const CUTIN2000 = mkChar('CUTIN2000', {
    abilities: [{
      id: 'c1', type: 'triggered', scope: 'on-hand',
      trigger: { hook: 'effect:declared', optional: true },
      effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: 'dft', delta: 2000, scope: 'contact' } },
      description: '【カットイン】AP+2000', ruleRefs: [],
    } as never],
  });

  function contactEffectBase(): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('PLAIN7', 'atk')]; // AP3000
    s.players.opp.scene = [sceneChar('COP4', 'dft', { state: 'active' })]; // AP3000・アクティブ
    s.players.self.deck = ['MOB7', 'MOB7'];
    s.players.opp.deck = ['MOB7', 'MOB7'];
    return s;
  }
  const scCtx = (): EffectCtx =>
    ({ source: { player: 'self', cardId: 'PLAIN7', uid: 'atk', abilityId: 'a2', area: 'scene' }, bindings: {} } as EffectCtx);
  const START: Effect = { kind: 'atom', verb: 'startContact', args: { targetUid: 'dft' } } as never;

  it('§9-1 アクティブな相手キャラとも発生し、declare/guard 系 emit ゼロ + actor 非スリープ + 非計上', () => {
    registerCardDef(CUTIN2000);
    const counters: Record<string, number> = {};
    for (const h of ['action:declare', 'action:guard-window', 'action:guarded', 'action:unguarded', 'contact:start']) {
      event.on(h as never, () => { counters[h] = (counters[h] ?? 0) + 1; });
    }
    const s = produce(contactEffectBase(), (d) => {
      runEffect(d, START as never, scCtx());
      runAllUntilEmpty(d);
    });
    const axId = _drainPendingContactStartAxId();
    expect(axId).toBeTruthy();
    const ax = flowAction._getContext(axId!)!;
    expect(ax.phase).toBe('action-1'); // contact-pending → action-1 まで自動遷移
    expect(ax.generatedByEffect).toBe(true);
    expect(ax.guardUid).toBeUndefined(); // ガード窓は存在しない
    expect(counters['contact:start']).toBe(1);
    expect(counters['action:declare'] ?? 0).toBe(0);
    expect(counters['action:guard-window'] ?? 0).toBe(0);
    expect(counters['action:guarded'] ?? 0).toBe(0);
    expect(counters['action:unguarded'] ?? 0).toBe(0);
    // actor はスリープしない (Q&A) + actedCharThisTurn も立たない (アクションではない)
    const atk = s.players.self.scene.find((c) => c.uid === 'atk')!;
    expect(atk.state).toBe('active');
    expect(atk.turnEffects.actedCharThisTurn).toBeFalsy();
    flowAction._deleteContext(axId!);
  });

  it('§9-2 AP 判定 → 敗者リムーブ + contact:end は emit / action:end は emit しない', () => {
    let actionEnd = 0; let contactEnd = 0;
    event.on('action:end', () => { actionEnd += 1; });
    event.on('contact:end', () => { contactEnd += 1; });
    const base = contactEffectBase();
    base.players.self.scene = [sceneChar('PLAIN7', 'atk', { apOverride: 5000 })];
    let axId: string | null = null;
    const s = produce(base, (d) => {
      runEffect(d, START as never, scCtx());
      axId = _drainPendingContactStartAxId();
      const ax = flowAction._getContext(axId!)!;
      // action-1/action-2 両者 pass → judge → contact-end → action-end (driver 相当を直接駆動)
      contactFlow.pass(d, ax, ax.firstUid === 'atk' ? 'self' : 'opp');
      flowAction.advance(d, ax);
      contactFlow.pass(d, ax, ax.secondUid === 'atk' ? 'self' : 'opp');
      flowAction.advance(d, ax);
      expect(ax.phase).toBe('judge');
      flowAction.snapshotAP(d, ax);
      contactFlow.judge(d, ax);
      flowAction.advance(d, ax); // judge → contact-end
      flowAction.advance(d, ax); // contact-end → action-end (emit 抑止分岐)
      runAllUntilEmpty(d);
    });
    expect(s.players.opp.scene).toHaveLength(0); // AP5000 >= 3000 → 対象リムーブ
    expect(s.players.opp.remove).toContain('COP4');
    expect(contactEnd).toBe(1);
    expect(actionEnd).toBe(0); // Q&A: これはアクションではない
  });

  it('§9-3 カットイン使用可 (Q&A) — 防御側 cutin AP+2000 で判定が覆る', () => {
    registerCardDef(CUTIN2000);
    const base = contactEffectBase();
    base.players.opp.hand = ['CUTIN2000'];
    let axId: string | null = null;
    const s = produce(base, (d) => {
      runEffect(d, START as never, scCtx());
      axId = _drainPendingContactStartAxId();
      const ax = flowAction._getContext(axId!)!;
      // 防御側 (opp) がカットイン、攻撃側 pass
      const oppFirst = ax.firstUid === 'dft';
      if (oppFirst) {
        contactFlow.cutIn(d, ax, 'opp', 'CUTIN2000');
        flowAction.advance(d, ax);
        contactFlow.pass(d, ax, 'self');
        flowAction.advance(d, ax);
      } else {
        contactFlow.pass(d, ax, 'self');
        flowAction.advance(d, ax);
        contactFlow.cutIn(d, ax, 'opp', 'CUTIN2000');
        flowAction.advance(d, ax);
      }
      runAllUntilEmpty(d); // cutin effect (AP+2000) を解決
      if (ax.phase === 'action-1-redo') { contactFlow.pass(d, ax, 'self'); flowAction.advance(d, ax); }
      flowAction.snapshotAP(d, ax);
      contactFlow.judge(d, ax);
      flowAction.advance(d, ax);
      flowAction.advance(d, ax);
      runAllUntilEmpty(d);
    });
    // 3000 < 3000+2000 → 対象は残る (何も起こらない rules/08 §5)
    expect(s.players.opp.scene.map((c) => c.uid)).toEqual(['dft']);
    // contact scope の AP 修正は contact-end で清掃済 (回帰)
    expect(s.players.opp.scene[0]!.turnEffects['apMod_contact']).toBeUndefined();
  });

  it('§9-4 0枚選択 ($bind 未解決) / 対象不在 → no-op', () => {
    const s0 = contactEffectBase();
    const s = produce(s0, (d) => {
      runEffect(d, { kind: 'atom', verb: 'startContact', args: { targetUid: '$target.uid' } } as never, scCtx());
      runEffect(d, { kind: 'atom', verb: 'startContact', args: { targetUid: 'no-such-uid' } } as never, scCtx());
      runAllUntilEmpty(d);
    });
    expect(_drainPendingContactStartAxId()).toBeNull();
    expect(s.players.opp.scene).toHaveLength(1); // 盤面不変
  });
});

describe('W6b step10 (row9): leave:intercept pre-splice consult (B01092 hand / B01039 kept-in-scene)', () => {
  // B01092 松田陣平 相当: 【相手ターン中】自分の現場の他キャラが相手の能力/効果/コンタクトで離れるとき、
  // このキャラをリムーブしてもよい → そのキャラは代わりに手札へ
  const GUARDIAN = mkChar('GUARDIAN', {
    abilities: [{
      id: 'a1', type: 'triggered', scope: 'on-scene',
      trigger: {
        hook: 'leave:intercept', optional: true,
        matcherCondition: { kind: 'and', cs: [
          { kind: 'turn', player: 'opp' },
          { kind: 'leaveCauseIn', causes: ['contact-ap', 'effect'] },
          { kind: 'leaveOwnerIs', player: 'self' },
        ] },
      },
      effect: { kind: 'atom', verb: 'leaveInterceptRedirect', args: { destination: 'hand' } },
      description: '', ruleRefs: [],
    } as never],
  });
  // B01039 相当: セットされたキャラが相手起因で離れるとき、このイベントをリムーブし現場に残る (強制)
  const SETGUARD = mkChar('SETGUARD', {
    kind: 'event',
    abilities: [{
      id: 'a1', type: 'triggered', scope: 'on-set-host',
      trigger: {
        hook: 'leave:intercept',
        matcherCondition: { kind: 'leaveCauseIn', causes: ['contact-ap', 'effect'] },
      },
      effect: { kind: 'atom', verb: 'leaveInterceptRedirect', args: { destination: 'kept-in-scene' } },
      description: '', ruleRefs: [],
    } as never],
  });
  const VICTIM = mkChar('VICTIM');
  // step11 合成 def
  const HANDDECL = mkChar('HANDDECL', {
    abilities: [{
      id: 'a1', type: 'declared', scope: 'on-hand', limit: { kind: 'turn', n: 1 },
      effect: DRAW1, description: '【宣言】この能力はこのカードが手札にある場合に宣言できる', ruleRefs: [],
    } as never],
  });
  const SCENEDECL = mkChar('SCENEDECL', {
    abilities: [{
      id: 'a1', type: 'declared', scope: 'on-scene',
      effect: DRAW1, description: '【宣言】', ruleRefs: [],
    } as never],
  });
  const RIDERDECL = mkChar('RIDERDECL', {
    kind: 'event',
    abilities: [{
      id: 'r1', type: 'declared', scope: 'on-set-host',
      effect: { kind: 'atom', verb: 'removeAreaToDeckTop', args: { player: 'self', max: 1, filter: { kind: 'character' } } },
      description: '【宣言】【ターン1】リムーブエリアのキャラを1枚まで選び、デッキの上に移す', ruleRefs: [],
    } as never],
  });
  const LEAVE_OBS = mkChar('LEAVE_OBS', {
    abilities: [{
      id: 'a1', type: 'triggered', scope: 'on-scene',
      trigger: { hook: 'leave:to-remove', selfOnly: true },
      effect: DRAW1, description: '【現場リムーブ時】', ruleRefs: [],
    } as never],
  });

  function interceptBase(turnPlayer: 'self' | 'opp' = 'opp'): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('VICTIM', 'victim'), sceneChar('GUARDIAN', 'grd')];
    s.players.opp.scene = [sceneChar('PLAIN7', 'atk')];
    s.players.self.deck = ['MOB7', 'MOB7'];
    s.players.self.hand = [];
    return s;
  }

  beforeEach(() => {
    for (const d of [GUARDIAN, SETGUARD, VICTIM, LEAVE_OBS, HANDDECL, SCENEDECL, RIDERDECL]) registerCardDef(d);
  });

  it('§10-1 相手ターン contact-ap → 代わりに手札へ (interceptor はコストでリムーブ、本人の離場 hook は不発)', () => {
    const emitted: string[] = [];
    event.on('leave:to-remove', (_s, p) => { emitted.push((p as { uid: string }).uid); });
    const s = produce(interceptBase('opp'), (d) => {
      const r = mutate.scene.removeToRemove(d, 'victim', 'contact-ap', 'atk');
      expect(r.prevented).toBe(true);
      expect(r.redirectedTo).toBe('hand');
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand).toEqual(['VICTIM']); // 代わりに手札
    expect(s.players.self.remove).toContain('GUARDIAN'); // コスト支払 (自身リムーブ)
    expect(s.players.self.scene.map((c) => c.uid)).toEqual([]); // victim も grd も現場に居ない
    // victim 自身の leave:to-remove は不発 (B01092P Q&A「離れる行為そのものを行わなかった」)。
    // GUARDIAN のコストリムーブ分は発火する (rules/17 リムーブ方法は問わない)。
    expect(emitted).toEqual(['grd']);
  });

  it('§10-2 自分ターン → 【相手ターン中】不成立で通常リムーブ', () => {
    const s = produce(interceptBase('self'), (d) => {
      const r = mutate.scene.removeToRemove(d, 'victim', 'contact-ap', 'atk');
      expect(r.prevented).toBeFalsy();
      runAllUntilEmpty(d);
    });
    expect(s.players.self.remove).toContain('VICTIM');
    expect(s.players.self.scene.map((c) => c.cardId)).toEqual(['GUARDIAN']);
  });

  it('§10-3 cause=switch/cost は opponent-attribution 外 → 通常リムーブ', () => {
    const s = produce(interceptBase('opp'), (d) => {
      const r = mutate.scene.removeToRemove(d, 'victim', 'switch');
      expect(r.prevented).toBeFalsy();
    });
    expect(s.players.self.remove).toContain('VICTIM');
  });

  it('§10-4 cause=effect は source player 帰属で gate (自傷=素通し / 相手起因=intercept)', () => {
    // 自分の効果で自分のキャラを removeToRemove → intercept しない (相手の能力や効果 でない)
    const s1 = produce(interceptBase('opp'), (d) => {
      const r = mutate.scene.removeToRemove(d, 'victim', 'effect', undefined, { byPlayer: 'self' });
      expect(r.prevented).toBeFalsy();
    });
    expect(s1.players.self.remove).toContain('VICTIM');
    // 相手の効果由来 → intercept
    const s2 = produce(interceptBase('opp'), (d) => {
      const r = mutate.scene.removeToRemove(d, 'victim', 'effect', undefined, { byPlayer: 'opp' });
      expect(r.prevented).toBe(true);
      runAllUntilEmpty(d);
    });
    expect(s2.players.self.hand).toEqual(['VICTIM']);
    // byPlayer 未指定 (帰属不明の legacy caller) は fail-closed で intercept しない
    const s3 = produce(interceptBase('opp'), (d) => {
      const r = mutate.scene.removeToRemove(d, 'victim', 'effect');
      expect(r.prevented).toBeFalsy();
    });
    expect(s3.players.self.remove).toContain('VICTIM');
  });

  it('§10-5 B01039 型 set-card (強制): キャラは現場に残り、セットカードのみリムーブ。2枚重ねは両方消費', () => {
    const base = interceptBase('opp');
    base.players.self.scene = [
      sceneChar('VICTIM', 'victim', { setCards: [{ cardId: 'SETGUARD', faceUp: true }, { cardId: 'SETGUARD', faceUp: true }] }),
    ];
    const s = produce(base, (d) => {
      const r = mutate.scene.removeToRemove(d, 'victim', 'contact-ap', 'atk');
      expect(r.prevented).toBe(true);
      expect(r.redirectedTo).toBe('kept-in-scene');
      expect(r.setCardsRemoved).toEqual(['SETGUARD', 'SETGUARD']); // Q&A: 2枚とも消費
    });
    expect(s.players.self.scene.map((c) => c.uid)).toEqual(['victim']); // 現場に残る (1回だけ)
    expect(s.players.self.scene[0]!.setCards).toEqual([]);
    expect(s.players.self.remove).toEqual(['SETGUARD', 'SETGUARD']);
    expect(s.players.self.hand).toEqual([]);
  });

  it('§10-5b 裏向き set-card は rider として扱われない (rules/16) → 通常リムーブ', () => {
    const base = interceptBase('opp');
    base.players.self.scene = [
      sceneChar('VICTIM', 'victim', { setCards: [{ cardId: 'SETGUARD', faceUp: false }] }),
    ];
    const s = produce(base, (d) => {
      const r = mutate.scene.removeToRemove(d, 'victim', 'contact-ap', 'atk');
      expect(r.prevented).toBeFalsy();
    });
    expect(s.players.self.remove).toContain('VICTIM');
  });

  it('§10-6 human 所有 interceptor → consult は素通し (DEFER boundary、silent double-remove しない)', () => {
    setHuman('self');
    const s = produce(interceptBase('opp'), (d) => {
      const r = mutate.scene.removeToRemove(d, 'victim', 'contact-ap', 'atk');
      expect(r.deferred).toBe(true);
      expect(r.pendingLeaveIntercept).toEqual({ player: 'self', targetUid: 'victim', interceptorUid: 'grd' });
    });
    expect(s.players.self.remove).toEqual([]);
    expect(s.players.self.scene.map((c) => c.cardId)).toEqual(['VICTIM', 'GUARDIAN']);
  });

  it('§11-1 findCardOnBoard hand sentinel: 在中 → area hand / 不在 → null', () => {
    const s = createEmptyGameState();
    s.players.self.hand = ['HANDDECL'];
    expect(findCardOnBoard(s, 'hand:self:HANDDECL')).toEqual({ player: 'self', cardId: 'HANDDECL', area: 'hand' });
    expect(findCardOnBoard(s, 'hand:self:PLAIN7')).toBeNull();
    expect(findCardOnBoard(s, 'hand:opp:HANDDECL')).toBeNull();
  });

  it('§11-2 scope 対称 gate: on-hand は hand uid のみ / on-scene は hand uid 不可', () => {
    const s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.hand = ['HANDDECL'];
    s.players.self.scene = [sceneChar('HANDDECL', 'hd-scene'), sceneChar('SCENEDECL', 'sd')];
    expect(canDeclaredAbility(s, 'hand:self:HANDDECL', 'a1')).toBe(true);
    expect(canDeclaredAbility(s, 'hd-scene', 'a1')).toBe(false); // on-hand は現場から使えない (B06103 対称制約)
    expect(canDeclaredAbility(s, 'sd', 'a1')).toBe(true); // 既存 on-scene 回帰
    s.players.self.hand.push('SCENEDECL');
    expect(canDeclaredAbility(s, 'hand:self:SCENEDECL', 'a1')).toBe(false); // on-scene を hand から不可
  });

  it('§11-3 hand-declared の【ターン1】が turnState fallback で enforce される', () => {
    const s0 = createEmptyGameState();
    s0.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s0.players.self.hand = ['HANDDECL'];
    s0.players.self.deck = ['MOB7', 'MOB7'];
    const uid = 'hand:self:HANDDECL';
    expect(canDeclaredAbility(s0, uid, 'a1')).toBe(true);
    const s1 = produce(s0, (d) => {
      useDeclaredAbility(d, uid, 'a1');
      runAllUntilEmpty(d);
    });
    expect(s1.players.self.hand.length).toBeGreaterThanOrEqual(1); // draw1 効果が走った (hand に +1)
    expect(canDeclaredAbility(s1, uid, 'a1')).toBe(false); // 【ターン1】消費済
  });

  it('§11-4 on-set-host rider declared: faceUp rider が host から宣言可能・効果も解決', () => {
    const s0 = createEmptyGameState();
    s0.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s0.players.self.scene = [sceneChar('PLAIN7', 'host', { setCards: [{ cardId: 'RIDERDECL', faceUp: true }] })];
    s0.players.self.remove = ['COP4'];
    s0.players.self.deck = ['MOB7', 'MOB7'];
    expect(findDeclaredAbility(s0, 'host', 'PLAIN7', 'scene', 'r1')).toBeTruthy();
    expect(canDeclaredAbility(s0, 'host', 'r1')).toBe(true);
    const s1 = produce(s0, (d) => {
      useDeclaredAbility(d, 'host', 'r1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s1.players.self.deck[0]).toBe('COP4'); // removeAreaToDeckTop: デッキの上へ
    expect(s1.players.self.remove).toEqual([]);
  });

  it('§11-4b faceDown rider は宣言不可 (rules/16)', () => {
    const s0 = createEmptyGameState();
    s0.players.self.scene = [sceneChar('PLAIN7', 'host', { setCards: [{ cardId: 'RIDERDECL', faceUp: false }] })];
    expect(findDeclaredAbility(s0, 'host', 'PLAIN7', 'scene', 'r1')).toBeUndefined();
    expect(canDeclaredAbility(s0, 'host', 'r1')).toBe(false);
  });

  it('§11-5 removeAreaToDeckTop: 0候補は clean no-op / filter 不一致は選ばれない', () => {
    const s0 = createEmptyGameState();
    s0.players.self.remove = [];
    s0.players.self.deck = ['MOB7'];
    const ctx = { source: { player: 'self', cardId: 'PLAIN7', uid: 'x', area: 'scene' }, bindings: {} } as unknown as EffectCtx;
    const s1 = produce(s0, (d) => {
      runEffect(d, { kind: 'atom', verb: 'removeAreaToDeckTop', args: { player: 'self', max: 1, filter: { kind: 'character' } } } as never, ctx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(s1.players.self.deck).toEqual(['MOB7']); // 不変
  });

  it('§10-7 judge 統合: intercept 時 JudgeResult.defenderRemoved=false', () => {
    const base = interceptBase('opp'); // opp ターン、opp の atk が self の victim へ
    const ax = {
      id: 'jx', byUid: 'atk', byPlayer: 'opp', target: { kind: 'char', uid: 'victim' },
      phase: 'judge', cutInUsed: {}, startedAt: { turn: 5, nano: 0 },
      apSnapshot: { aUid: 'atk', aAP: 9000, bUid: 'victim', bAP: 1000 },
    } as never;
    const s = produce(base, (d) => {
      const jr = contactFlow.judge(d, ax);
      expect(jr.defenderRemoved).toBe(false); // prevented → 除去されていない
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand).toEqual(['VICTIM']);
  });
});
