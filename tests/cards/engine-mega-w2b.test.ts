// tests/cards/engine-mega-w2b
// engine mega-wave W2b (2026-07-03): UI重 restriction 2 primitive の TDD probe。
//   r27 mustBeSelectedByOppEvent — 「相手はイベントの効果によってこのキャラを選べる場合、必ず選ぶ」
//       (B08087 吞口重彦)。ContinuousModifier flag + effect-pick 全 selection site の forced-inclusion。
//   r28 mustGuard enforce — 「このキャラはガードできる場合、必ずガードする。」(B09040 鈴木園子 a2)。
//       guard.mustGuardCandidates + passGuard/tryGuard fail-safe + AI 強制。
// rules: 07/08/13/15/17/24 + B08087/B09040 公式Q&A
import { describe, it, expect, beforeEach } from 'vitest';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { resolveEffectPicks, _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { createMainGameState as createEmptyGameState } from '../helpers/main-game-state';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate/index';
import { char as readChar } from '@/engine/read/char';
import { candidates as guardCandidates, mustGuardCandidates } from '@/engine/flow/guard';
import { declare, tryGuard, passGuard, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { resolveActionAgainstChar, resolveActionAgainstCase } from '@/ai/action-resolution';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B08087 } from '@/cards/ct-p08/B08087';
import { B09040 } from '@/cards/ct-p09/B09040';
import type { CardDef, AbilityDef, Effect, EffectCtx, GameState } from '@/engine/types';
import type { AIPolicy } from '@/ai/policy';

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const contAb = (id: string, mod: Record<string, unknown>, condition?: unknown): AbilityDef => ({
  id, type: 'continuous', scope: 'on-scene',
  ...(condition ? { condition } : {}),
  continuousModifier: mod as never,
  description: id, ruleRefs: [],
} as AbilityDef);

// r27 合成 def
const FORCED = mkChar('FORCED', { abilities: [contAb('a1', { mustBeSelectedByOppEvent: true })] });
const PLAIN_A = mkChar('PLAIN_A');
const PLAIN_B = mkChar('PLAIN_B');
const EVT: CardDef = {
  id: 'EVT', no: 'EVT', kind: 'event', names: ['EVT'], colors: ['赤'], level: 1, ap: 0, lp: 0,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const CHAR_SRC = mkChar('CHAR_SRC');
// r28 合成 def
const ATK = mkChar('ATK', { ap: 5000 });
const ATK_BULLET = mkChar('ATK_BULLET', { ap: 5000, keywords: ['ブレット'] });
const TGT = mkChar('TGT', { ap: 1000 });
const GUARD_X = mkChar('GUARD_X', { ap: 2000 });
const GUARD_Y = mkChar('GUARD_Y', { ap: 2000 });
// B09040 a1 検証用
const KYOGOKU = mkChar('KYOGOKU', { names: ['京極真'] });
const ZAIBATSU3 = mkChar('ZAIBATSU3', { traits: ['鈴木財閥'], level: 3 });
const NOTRAIT5 = mkChar('NOTRAIT5', { level: 5 });
const VICT3 = mkChar('VICT3', { level: 3 });
const VICT4 = mkChar('VICT4', { level: 4 });

const setHuman = (s: 'self' | 'opp' | null) => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
};
// イベント使用の自効果 ctx (effect:declared event-use payload。triggered.ts resolveCtx と同 shape)
const evtCtx = (cardId = 'EVT'): EffectCtx =>
  ({ source: { cardId, uid: `${cardId}#src`, abilityId: 'a1', player: 'self', area: 'remove' }, bindings: {},
     triggerPayload: { kind: 'event-use', cardId, player: 'self' } }) as unknown as EffectCtx;
// イベント印字の【ヒラメキ】相当 ctx (source は event card だが event-use payload ではない)
const hiramekiOnEventCtx = (cardId = 'EVT'): EffectCtx =>
  ({ source: { cardId, uid: `${cardId}#src`, abilityId: 'a2', player: 'self', area: 'remove' }, bindings: {},
     triggerPayload: { removedCardId: cardId } }) as unknown as EffectCtx;
// イベント使用に反応した第三者キャラ効果の ctx (payload は event-use だが source ≠ そのイベント)
const reactionCtx = (): EffectCtx =>
  ({ source: { cardId: 'CHAR_SRC', uid: 'CHAR_SRC#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {},
     triggerPayload: { kind: 'event-use', cardId: 'EVT', player: 'self' } }) as unknown as EffectCtx;

// 「両側のキャラを max 枚まで選びリムーブ」型イベント効果 (short-form scene pick)
const removeBoth = (max: number): Effect =>
  ({ kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max, side: 'either', filter: { kind: 'character' } } }) as never;

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  _clearPendingEffectPickQueue(); _resetActionContexts();
  setHuman(null);
  for (const d of [FORCED, PLAIN_A, PLAIN_B, EVT, CHAR_SRC, ATK, ATK_BULLET, TGT, GUARD_X, GUARD_Y,
    KYOGOKU, ZAIBATSU3, NOTRAIT5, VICT3, VICT4]) registerCardDef(d);
  registerCardDef(B08087); registerCardDef(B09040);
  registerTriggeredListener();
});

describe('r27 mustBeSelectedByOppEvent — reader', () => {
  it('現場の flag 持ちで true / 素キャラ false / B08087 実カードでも true', () => {
    const s = createEmptyGameState();
    const f = mutate.scene.enter(s, 'opp', 'FORCED', {});
    const p = mutate.scene.enter(s, 'opp', 'PLAIN_A', {});
    const b = mutate.scene.enter(s, 'opp', 'B08087', {});
    expect(readChar.selfContinuousFlag(s, f.uid, 'mustBeSelectedByOppEvent')).toBe(true);
    expect(readChar.selfContinuousFlag(s, p.uid, 'mustBeSelectedByOppEvent')).toBe(false);
    expect(readChar.selfContinuousFlag(s, b.uid, 'mustBeSelectedByOppEvent')).toBe(true);
  });
});

describe('r27 — human push 経路 (pending.forcedUids)', () => {
  it('event source + 相手側 flag char → forcedUids に載る / 味方 decoy は載らない', () => {
    setHuman('self');
    const s = createEmptyGameState();
    mutate.scene.enter(s, 'self', 'PLAIN_A', {});
    const f = mutate.scene.enter(s, 'opp', 'FORCED', {});
    mutate.scene.enter(s, 'opp', 'PLAIN_B', {});
    runEffect(s, removeBoth(2), evtCtx());
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.atomVerb).toBe('sceneRemove');
    expect(pending?.forcedUids).toEqual([f.uid]);
  });

  it('character source (イベントでない) → forcedUids 無し', () => {
    setHuman('self');
    const s = createEmptyGameState();
    mutate.scene.enter(s, 'opp', 'FORCED', {});
    runEffect(s, removeBoth(2), evtCtx('CHAR_SRC'));
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.forcedUids ?? []).toEqual([]);
  });

  it('混成 review blocker 回帰: イベント印字の【ヒラメキ】pick (event-use payload でない) → 強制なし', () => {
    setHuman('self');
    const s = createEmptyGameState();
    mutate.scene.enter(s, 'opp', 'FORCED', {});
    runEffect(s, removeBoth(2), hiramekiOnEventCtx());
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.forcedUids ?? []).toEqual([]);
  });

  it('混成 review blocker 回帰: イベント使用への第三者 reaction (source ≠ イベント) → 強制なし', () => {
    setHuman('self');
    const s = createEmptyGameState();
    mutate.scene.enter(s, 'opp', 'FORCED', {});
    runEffect(s, removeBoth(2), reactionCtx());
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect(pending?.forcedUids ?? []).toEqual([]);
  });

  it('flag char が chooser 自陣 → forced されない (「相手は」の方向)', () => {
    setHuman('self');
    const s = createEmptyGameState();
    const f = mutate.scene.enter(s, 'self', 'FORCED', {});
    mutate.scene.enter(s, 'opp', 'PLAIN_B', {});
    runEffect(s, removeBoth(2), evtCtx());
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    expect((pending?.forcedUids ?? []).includes(f.uid)).toBe(false);
  });

  it('候補外 (filter 不一致) の flag char は強制しない (「選べる場合」gate)', () => {
    setHuman('self');
    const s = createEmptyGameState();
    const f = mutate.scene.enter(s, 'opp', 'FORCED', {});
    mutate.scene.enter(s, 'opp', 'PLAIN_B', {});
    // FORCED (level3) を弾く levelMax:1 filter → 候補に入らない → 強制なし
    const eff: Effect = { kind: 'atom', verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { kind: 'character', levelMax: 1 } } } as never;
    runEffect(s, eff, evtCtx());
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();
    if (pending) {
      expect((pending.forcedUids ?? []).includes(f.uid)).toBe(false);
    }
  });
});

describe('r27 — AI 経路 (drain + 同期 walk)', () => {
  it('AI drain: greedy が先頭2枚を取る所、末尾の flag char が必ず含まれる', () => {
    const s = createEmptyGameState();
    mutate.scene.enter(s, 'opp', 'PLAIN_A', {});
    mutate.scene.enter(s, 'opp', 'PLAIN_B', {});
    const f = mutate.scene.enter(s, 'opp', 'FORCED', {}); // 候補順で末尾
    runEffect(s, removeBoth(2), evtCtx());
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());
    expect(s.players.opp.scene.some(c => c.uid === f.uid), 'flag char はリムーブ済').toBe(false);
    expect(s.players.opp.scene.length, '2枚だけリムーブ').toBe(1);
  });

  it('AI drain OFF 対照: flag 無しなら greedy 先頭2枚 (末尾は残る) = byte 等価', () => {
    const s = createEmptyGameState();
    mutate.scene.enter(s, 'opp', 'PLAIN_A', {});
    mutate.scene.enter(s, 'opp', 'PLAIN_B', {});
    const tail = mutate.scene.enter(s, 'opp', 'CHAR_SRC', {});
    runEffect(s, removeBoth(2), evtCtx());
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());
    expect(s.players.opp.scene.some(c => c.uid === tail.uid), '末尾は残る (greedy 先頭2)').toBe(true);
  });

  it('AI 同期 walk (resolveEffectPicks): 明示 target 単一 pick で flag char が heuristic を上書き', () => {
    const s = createEmptyGameState();
    const p = mutate.scene.enter(s, 'opp', 'PLAIN_A', {});
    const f = mutate.scene.enter(s, 'opp', 'FORCED', {});
    const c = evtCtx();
    // 明示 Pattern A (uid:'$pick' + target)。PA 短縮形は runtime awaiting-pick 専用で walk 不可、
    // sceneRemove handler は uid-based のため Pattern A が walk 経路の実使用形。
    const eff: Effect = { kind: 'atom', verb: 'sceneRemove', args: { uid: '$pick', player: 'self', target: { kind: 'pick', query: { area: 'scene', side: 'either', filter: { kind: 'character' } }, n: { min: 0, max: 1 }, chooser: 'self' } } } as never;
    const resolved = resolveEffectPicks(s, eff, c, {
      byPlayer: 'self',
      source: { cardId: 'EVT', abilityId: 'a1' },
      // decoy を選ぶ heuristic — forced が上書きするはず
      chooseAtomTarget: (_s, _v, _a, cands) => cands.find(x => (x as { uid?: string }).uid === p.uid) ?? null,
    });
    runEffect(s, resolved, c);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene.some(x => x.uid === f.uid), 'forced がリムーブされる').toBe(false);
    expect(s.players.opp.scene.some(x => x.uid === p.uid), 'decoy は残る').toBe(true);
  });

  it('B08087 Q&A: flag 2枚 + nMax=1 → どちらか1枚に clamp (両立不能の緩和)', () => {
    const s = createEmptyGameState();
    const f1 = mutate.scene.enter(s, 'opp', 'FORCED', {});
    const f2 = mutate.scene.enter(s, 'opp', 'B08087', {});
    mutate.scene.enter(s, 'opp', 'PLAIN_A', {});
    runEffect(s, removeBoth(1), evtCtx());
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());
    const gone = [f1.uid, f2.uid].filter(u => !s.players.opp.scene.some(c => c.uid === u));
    expect(gone.length, 'flag 持ちのうち丁度1枚').toBe(1);
    expect(s.players.opp.scene.length).toBe(2);
  });

  it('B08087 Q&A: flag 2枚 + nMax=2 → 両方必ず選ぶ', () => {
    const s = createEmptyGameState();
    mutate.scene.enter(s, 'opp', 'PLAIN_A', {});
    mutate.scene.enter(s, 'opp', 'PLAIN_B', {});
    const f1 = mutate.scene.enter(s, 'opp', 'FORCED', {});
    const f2 = mutate.scene.enter(s, 'opp', 'B08087', {});
    runEffect(s, removeBoth(2), evtCtx());
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());
    expect(s.players.opp.scene.some(c => c.uid === f1.uid)).toBe(false);
    expect(s.players.opp.scene.some(c => c.uid === f2.uid)).toBe(false);
  });
});

// ---------- r28 mustGuard ----------

function setupAction(over: { atk?: string; xState?: 'active' | 'sleep'; bullet?: boolean } = {}): {
  s: GameState; atkUid: string; tgtUid: string; xUid: string; yUid: string;
} {
  const s = createEmptyGameState();
  const atk = mutate.scene.enter(s, 'self', over.bullet ? 'ATK_BULLET' : (over.atk ?? 'ATK'), { active: true });
  atk.isNamed = false;
  const t = mutate.scene.enter(s, 'opp', 'TGT', {});
  mutate.scene.setState(s, t.uid, 'sleep'); // アクション対象 (sleep)
  const x = mutate.scene.enter(s, 'opp', 'GUARD_X', {});
  x.isNamed = false;
  if (over.xState === 'sleep') mutate.scene.setState(s, x.uid, 'sleep');
  mutate.char.setTurnEffect(s, x.uid, 'mustGuard', true);
  const y = mutate.scene.enter(s, 'opp', 'GUARD_Y', {});
  y.isNamed = false;
  return { s, atkUid: atk.uid, tgtUid: t.uid, xUid: x.uid, yUid: y.uid };
}

describe('r28 mustGuard — engine enforce', () => {
  it('mustGuardCandidates: flag 持ち active のみ返す', () => {
    const { s, atkUid, tgtUid, xUid } = setupAction();
    const list = mustGuardCandidates(s, atkUid, tgtUid);
    expect(list.map(c => c.uid)).toEqual([xUid]);
  });

  it('義務あり: passGuard throw / tryGuard(非義務 Y) throw / tryGuard(X) 成立', () => {
    const { s, atkUid, tgtUid, xUid, yUid } = setupAction();
    const ax = declare(s, atkUid, { kind: 'char', uid: tgtUid });
    expect(() => passGuard(s, ax)).toThrow(/mustGuard/);
    expect(() => tryGuard(s, ax, yUid)).toThrow(/mustGuard/);
    tryGuard(s, ax, xUid);
    expect(s.players.opp.scene.find(c => c.uid === xUid)?.state).toBe('sleep');
    expect(ax.guardUid).toBe(xUid);
  });

  it('義務なし (flag off): passGuard は従来どおり成立 (byte 等価)', () => {
    const { s, atkUid, tgtUid, xUid } = setupAction();
    mutate.char.setTurnEffect(s, xUid, 'mustGuard', false);
    const ax = declare(s, atkUid, { kind: 'char', uid: tgtUid });
    expect(() => passGuard(s, ax)).not.toThrow();
  });

  it('B09040 Q&A: X がスリープ (ガード不可) なら強制されない → passGuard 可', () => {
    const { s, atkUid, tgtUid } = setupAction({ xState: 'sleep' });
    const ax = declare(s, atkUid, { kind: 'char', uid: tgtUid });
    expect(() => passGuard(s, ax)).not.toThrow();
  });

  it('攻撃側ブレット: ガード候補 0 → 義務 0 → passGuard 可', () => {
    const { s, atkUid, tgtUid } = setupAction({ bullet: true });
    expect(mustGuardCandidates(s, atkUid, tgtUid)).toEqual([]);
    const ax = declare(s, atkUid, { kind: 'char', uid: tgtUid });
    expect(() => passGuard(s, ax)).not.toThrow();
  });

  it('X 自身がアクション対象 (excludeUid): 候補外 → 義務 0', () => {
    const s = createEmptyGameState();
    const atk = mutate.scene.enter(s, 'self', 'ATK', { active: true });
    atk.isNamed = false;
    const x = mutate.scene.enter(s, 'opp', 'GUARD_X', {});
    mutate.scene.setState(s, x.uid, 'sleep');
    mutate.char.setTurnEffect(s, x.uid, 'mustGuard', true);
    mutate.char.setTurnEffect(s, x.uid, 'sleepGuard', true); // sleep でもガード可 (候補には入る前提を作る)
    // X をアクション対象に → excludeUid で候補外 → 義務なし
    expect(mustGuardCandidates(s, atk.uid, x.uid)).toEqual([]);
    const ax = declare(s, atk.uid, { kind: 'char', uid: x.uid });
    expect(() => passGuard(s, ax)).not.toThrow();
  });

  it('アクション[事件] でも enforce (passGuard throw / tryGuard(X) 成立)', () => {
    const { s, atkUid, xUid } = setupAction();
    s.players.opp.evidence.push({ cardId: 'PLAIN_A', faceUp: false });
    const ax = declare(s, atkUid, { kind: 'case', player: 'opp' });
    expect(() => passGuard(s, ax)).toThrow(/mustGuard/);
    tryGuard(s, ax, xUid);
    expect(ax.guardUid).toBe(xUid);
  });

  it('B09040 Q&A: 義務 char 2枚 → その中から1枚選んでガード (どちらも tryGuard 可)', () => {
    const { s, atkUid, tgtUid, xUid, yUid } = setupAction();
    mutate.char.setTurnEffect(s, yUid, 'mustGuard', true); // Y も義務化
    const ax = declare(s, atkUid, { kind: 'char', uid: tgtUid });
    expect(mustGuardCandidates(s, atkUid, tgtUid).length).toBe(2);
    expect(() => tryGuard(s, ax, yUid)).not.toThrow();
  });
});

describe('r28 mustGuard — AI 経路', () => {
  const passPolicy = { chooseGuard: () => null } as unknown as AIPolicy;

  it('resolveActionAgainstChar: policy が pass でも義務 char がガードする', () => {
    const { s, atkUid, tgtUid, xUid } = setupAction();
    resolveActionAgainstChar(s, atkUid, tgtUid, passPolicy);
    // X がガード (sleep 化) し、対象 TGT は無傷 (ガード成立でコンタクト相手が X に差替)
    expect(s.players.opp.scene.find(c => c.uid === xUid), 'ATK5000>=X2000 で X リムーブ').toBeUndefined();
    expect(s.players.opp.scene.some(c => c.uid === tgtUid), '対象は生存').toBe(true);
  });

  it('resolveActionAgainstCase: policy が pass でも義務 char がガード → 証拠不変', () => {
    const { s, atkUid, xUid } = setupAction();
    s.players.opp.evidence.push({ cardId: 'PLAIN_A', faceUp: false });
    resolveActionAgainstCase(s, atkUid, 'opp', passPolicy);
    expect(s.players.opp.evidence.length, 'ガード成立 → 証拠変動なし').toBe(1);
    expect(s.players.opp.scene.find(c => c.uid === xUid), 'X はガードしてリムーブ').toBeUndefined();
  });
});

// ---------- exemplar B09040 ----------

describe('B09040 鈴木園子 — exemplar', () => {
  it('a2【宣言】: 相手現場 lv6 以下を選び mustGuard 付与 → ターン終了で清掃', () => {
    const s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    const sonoko = mutate.scene.enter(s, 'self', 'B09040', { active: true });
    sonoko.isNamed = false;
    mutate.scene.enter(s, 'self', 'KYOGOKU', {}); // 絆
    const v3 = mutate.scene.enter(s, 'opp', 'VICT3', {});
    mutate.scene.enter(s, 'opp', 'NOTRAIT5', {}); // lv5 も 6 以下 → 候補
    const ability = (B09040.abilities ?? []).find(a => a.id === 'a2')!;
    const c: EffectCtx = { source: { cardId: 'B09040', uid: sonoko.uid, abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    // charSetTurnEffect の Pattern A pick は walk-time 解決 (runtime '$pick' は skip) — B08037 同型
    const resolved = resolveEffectPicks(s, ability.effect as Effect, c, { byPlayer: 'self', source: { cardId: 'B09040', abilityId: 'a2' } });
    runEffect(s, resolved, c);
    runAllUntilEmpty(s);
    const flagged = s.players.opp.scene.filter(x => x.turnEffects['mustGuard'] === true);
    expect(flagged.length, 'AI が 1枚選んで付与').toBe(1);
    // ターン終了清掃 (per-uid)
    for (const x of s.players.opp.scene) mutate.char.clearTurnEffects(s, x.uid, 'turn');
    expect(s.players.opp.scene.some(x => x.turnEffects['mustGuard'] === true)).toBe(false);
    void v3;
  });

  it('a1【登場時】inner chain: sleepSelf + 手札[鈴木財閥]1枚リムーブ → そのレベル以下を1枚リムーブ', () => {
    const s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    const sonoko = mutate.scene.enter(s, 'self', 'B09040', { active: true });
    sonoko.isNamed = false;
    s.players.self.hand = ['ZAIBATSU3', 'NOTRAIT5'];
    const v3 = mutate.scene.enter(s, 'opp', 'VICT3', {});
    const v4 = mutate.scene.enter(s, 'opp', 'VICT4', {});
    const a1 = (B09040.abilities ?? []).find(a => a.id === 'a1')!;
    // resolution-time active gate と optional の内側を直接駆動 (optional 機構は B04049 系で既検証)
    const gated = a1.effect as { kind: string; if: unknown; then: { kind: string; effect: Effect } };
    expect(gated.kind).toBe('conditional');
    expect(gated.if).toEqual({ kind: 'charStateIs', ref: { kind: 'self' }, state: 'active' });
    expect(gated.then.kind).toBe('optional');
    const inner = gated.then.effect;
    const c: EffectCtx = { source: { cardId: 'B09040', uid: sonoko.uid, abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    runEffect(s, inner, c);
    runAllUntilEmpty(s);
    drainAiEffectPicks(s, new HeuristicPolicy());
    // sleepSelf
    expect(s.players.self.scene.find(x => x.uid === sonoko.uid)?.state).toBe('sleep');
    // 手札から鈴木財閥のみリムーブ (NOTRAIT5 は filter 外)
    expect(s.players.self.hand).toEqual(['NOTRAIT5']);
    // lv3 (リムーブしたカードのレベル) 以下のみ対象 → VICT3 リムーブ / VICT4 残留
    expect(s.players.opp.scene.some(x => x.uid === v3.uid), 'lv3 はリムーブ').toBe(false);
    expect(s.players.opp.scene.some(x => x.uid === v4.uid), 'lv4 は範囲外で残る').toBe(true);
  });
});
