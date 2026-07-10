// tests/cards/night-w0/B09027 — 大岡紅葉 (夜間 W0 cost-choice 初 consumer probe)
//   a1: 【宣言】【ターン1】〚裏向きセットカード1枚 か 手札1枚リムーブ〛: スリープキャラ1枚まで選びスタン。
//   検証点: cost choice branch (costChoice 明示 0/1 + 未供給 fallback) / sleep filter (active decoy 非候補) /
//           「まで」=0 可 / 【ターン1】 / canPay (両 branch 不能なら宣言不可) / owner='opp' pin (BUG-174)。
// production dispatch 経由 (activateDeclaredAbility + runAllUntilEmpty)。
// rules: 03 (スタン) / 15 (「まで」=0可・either) / 16 (裏向きセット) / 21 (コスト自分のみ) / 24 (スタンQ&A)
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { canPay } from '@/engine/cost/evaluate';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { B09027 } from '@/cards/ct-p09/B09027';
import type { CardDef, GameState } from '@/engine/types';

function mkChar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
const FIXTURES: CardDef[] = [
  B09027,
  mkChar('SLEEPER'), mkChar('AWAKE'), mkChar('H1'), mkChar('H2'), mkChar('SETA'),
];

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = v; };

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  resetDefRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
  setHuman('self');
});

/** self 現場に B09027 + スリープ/アクティブ decoy を配置。 */
function setup(s: GameState, owner: 'self' | 'opp' = 'self') {
  const me = mutate.scene.enter(s, owner, 'B09027', {});
  const sleeper = mutate.scene.enter(s, owner === 'self' ? 'opp' : 'self', 'SLEEPER', {});
  mutate.scene.setState(s, sleeper.uid, 'sleep');
  const awake = mutate.scene.enter(s, owner, 'AWAKE', {});
  return { me, sleeper, awake };
}

describe('B09027 a1 — cost choice (removeSetCard / removeFromHand) → sleep キャラをスタン', () => {
  it('costChoice=1 (手札 branch): 手札1枚リムーブ → sleep キャラのみ候補 → スタン', () => {
    const s = base();
    const { me, sleeper, awake } = setup(s);
    s.players.self.hand = ['H1', 'H2'];
    expect(canDeclaredAbility(s, me.uid, 'a1'), '手札ありで宣言可').toBe(true);
    activateDeclaredAbility(s, me.uid, 'a1', { costChoice: 1 });
    runAllUntilEmpty(s);
    expect(s.players.self.hand.length, '手札 1 枚リムーブ (head-fixed)').toBe(1);
    expect(s.players.self.remove.length, 'リムーブへ 1 枚').toBe(1);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'stun 対象 pick が surface').toBeTruthy();
    const cands = pick!.candidates as Array<{ uid: string }>;
    expect(cands.map((c) => c.uid), '候補 = sleep のみ (active decoy 除外、side either)').toEqual([sleeper.uid]);
    expect(cands.some((c) => c.uid === awake.uid), 'アクティブ decoy は非候補').toBe(false);
    applyPickAndContinuation(s, pick!, sleeper.uid, [sleeper.uid]);
    runAllUntilEmpty(s);
    const t = s.players.opp.scene.find((c) => c.uid === sleeper.uid)!;
    expect(t.state, 'スタン化 (rules/03)').toBe('stun');
  });

  it('costChoice=0 (セットカード branch): 裏向きセットカード 1 枚リムーブ、手札不変', () => {
    const s = base();
    const { me, sleeper } = setup(s);
    const host = s.players.self.scene.find((c) => c.uid === me.uid)!;
    host.setCards = [{ cardId: 'SETA', faceUp: false }];
    s.players.self.hand = ['H1'];
    activateDeclaredAbility(s, me.uid, 'a1', { costChoice: 0 });
    runAllUntilEmpty(s);
    expect(host.setCards.length, '裏向きセットカードが 1 枚消費').toBe(0);
    expect(s.players.self.hand, '手札は不変').toEqual(['H1']);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'stun pick surface').toBeTruthy();
    applyPickAndContinuation(s, pick!, sleeper.uid, [sleeper.uid]);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene.find((c) => c.uid === sleeper.uid)!.state).toBe('stun');
  });

  it('costChoice 未供給: first payable branch (セットカード) auto — 従来姿勢の回帰', () => {
    const s = base();
    const { me } = setup(s);
    const host = s.players.self.scene.find((c) => c.uid === me.uid)!;
    host.setCards = [{ cardId: 'SETA', faceUp: false }];
    s.players.self.hand = ['H1'];
    activateDeclaredAbility(s, me.uid, 'a1');
    runAllUntilEmpty(s);
    expect(host.setCards.length, 'branch0 (removeSetCard) が auto 選択').toBe(0);
    expect(s.players.self.hand, '手札不変').toEqual(['H1']);
    _drainPendingEffectPickSide();
  });

  it('「1枚まで」= 0 選択可 (pick nMin=0)', () => {
    const s = base();
    const { me } = setup(s);
    s.players.self.hand = ['H1'];
    activateDeclaredAbility(s, me.uid, 'a1', { costChoice: 1 });
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick!.nMin, '0 枚可 (rules/15)').toBe(0);
    expect(pick!.nMax).toBe(1);
  });

  it('両 branch 不能 (手札0 + 裏向きセット0) → canPay false / 表向きセットのみも false (cost gate は呼出元責務)', () => {
    const s = base();
    const { me } = setup(s);
    s.players.self.hand = [];
    const ctx = { source: { cardId: 'B09027', uid: me.uid, abilityId: 'a1', player: 'self' as const, area: 'scene' as const }, bindings: {} };
    const cost = B09027.abilities[0]!.cost!;
    expect(canPay(s, cost, ctx), '支払不能 (rules/21 一部でも行えなければ使用不可)').toBe(false);
    const host = s.players.self.scene.find((c) => c.uid === me.uid)!;
    host.setCards = [{ cardId: 'SETA', faceUp: true }]; // 表向き = 対象外 (「裏向きで」)
    expect(canPay(s, cost, ctx), '表向きセットは数えない (rules/16 裏向き指定)').toBe(false);
    host.setCards = [{ cardId: 'SETA', faceUp: false }];
    expect(canPay(s, cost, ctx), '裏向きなら支払可').toBe(true);
  });

  it('【ターン1】: 2回目は宣言不可', () => {
    const s = base();
    const { me, sleeper } = setup(s);
    s.players.self.hand = ['H1', 'H2'];
    activateDeclaredAbility(s, me.uid, 'a1', { costChoice: 1 });
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    if (pick) { applyPickAndContinuation(s, pick, sleeper.uid, [sleeper.uid]); runAllUntilEmpty(s); }
    expect(canDeclaredAbility(s, me.uid, 'a1'), '【ターン1】消費済').toBe(false);
  });

  it('owner=opp pin (BUG-174): opp 所有の B09027 が self 側 sleeper をスタン', () => {
    const s = base();
    s.turn.player = 'opp';
    const { me, sleeper } = setup(s, 'opp'); // sleeper は self 現場
    s.players.opp.hand = ['H1'];
    setHuman(null);
    activateDeclaredAbility(s, me.uid, 'a1', { costChoice: 1 });
    runAllUntilEmpty(s);
    expect(s.players.opp.hand.length, 'opp 手札からコスト').toBe(0);
    const t = s.players.self.scene.find((c) => c.uid === sleeper.uid)!;
    expect(t.state, 'self 側 sleeper がスタン (side either, AI auto-pick)').toBe('stun');
  });
});
