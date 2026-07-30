// tests/cards/engine-mega-w4
// engine mega-wave W4 (2026-07-03): stack/scope 8 primitive の TDD probe。
//   step1 r82 bindPick atom (pick-only bind、G33 pick-then-branch) — B08035 怪盗キッド
//   step2 r83 fromGroup + enter:group (G34 group-scoped 1-of-N) — B01012/B08003
//   step3 r5  charStackCard scene-source (現場キャラを別キャラ下に重ねる) — B06008
//   step4 r6/r7 stack-under cost 2種 — B09048/B08006
//   step5 r84 perSideMax quota — B08019
//   step6 r62 filtered-突撃 grant — B07096
//   step7 r1  protection rider (opponentRestrict on-set-host walk) — B05041
// rules: 03(状態)/13(突撃)/15(まで=0可)/16(重ねる)/18(MR)/21(コスト)/24(スタン)/25(そうした場合)
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { event } from '@/engine/event/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate/index';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { canPay as canPayCost } from '@/engine/cost/evaluate';
import { pay } from '@/engine/cost/pay';
import { resolve as resolveTarget } from '@/engine/target/resolve';
import { canAction, canActionAgainstChar } from '@/engine/flow/main/action';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../helpers/fixtures';
import { B08035 } from '@/cards/ct-p08/B08035';
import { B01012 } from '@/cards/ct-p01/B01012';
import { B06008 } from '@/cards/ct-p06/B06008';
import { B06008P } from '@/cards/ct-p06/B06008P';
import { B09048 } from '@/cards/ct-p09/B09048';
import { B08006 } from '@/cards/ct-p08/B08006';
import { B07096 } from '@/cards/ct-p07/B07096';
import { B05041 } from '@/cards/ct-p05/B05041';
import { B05041P } from '@/cards/ct-p05/B05041P';
import type { CardDef, Effect, EffectCtx, GameState } from '@/engine/types';
import { dispatchCurrentDecision } from '../helpers/dispatch-current-decision';

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = s; };

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});

const selfCtx = (): EffectCtx => ({
  source: { cardId: 'SRC', uid: 'src#1', abilityId: 'a1', player: 'self', area: 'scene' },
  bindings: {},
} as EffectCtx);

// ---- step1 r82: B08035 a1 相当 (bindPick → 排他 conditional 分岐) ----
// 印字: 「相手の現場にいるキャラを1枚まで選ぶ。そのキャラがスリープ状態の場合、スタンさせる。
//        そのキャラがアクティブ状態の場合、スリープさせる。」
const PICK_BRANCH_EFFECT: Effect = {
  kind: 'sequence',
  steps: [
    { kind: 'atom', verb: 'bindPick', args: { player: 'self', side: 'opp', bind: 't', max: 1 } },
    {
      kind: 'conditional',
      if: { kind: 'charStateIs', ref: { kind: 'fromBound', bindKey: 't' }, state: 'sleep' },
      then: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$t.uid', state: 'stun' } },
      else: {
        kind: 'conditional',
        if: { kind: 'charStateIs', ref: { kind: 'fromBound', bindKey: 't' }, state: 'active' },
        then: { kind: 'atom', verb: 'sceneSetState', args: { uid: '$t.uid', state: 'sleep' } },
      },
    },
  ],
} as never;

function stageStep1(oppState: 'active' | 'sleep' | 'stun' | 'none'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.scene = [sceneChar('SRC', 'src#1')];
  if (oppState !== 'none') {
    const v = sceneChar('VICTIM', 'victim#1');
    v.state = oppState;
    s.players.opp.scene = [v];
  }
  return s;
}

function runPickBranch(s: GameState): GameState {
  const mid = produce(s, (d) => {
    runEffect(d, PICK_BRANCH_EFFECT, selfCtx());
    runAllUntilEmpty(d);
  });
  useGameStateStore.getState().setGameState(mid);
  surfacePendingSideChannels();
  return mid;
}

describe('W4 step1 r82: bindPick atom (pick-only bind → 排他 conditional)', () => {
  beforeEach(() => {
    resetDefRegistry();
    registerCardDef(mkChar('SRC'));
    registerCardDef(mkChar('VICTIM'));
    _clearPendingEffectPickQueue();
    useGameStateStore.getState().setGameState(null as never);
    useGameStateStore.getState().setPendingEffectPick(null);
    setHuman('self');
  });

  it('happy-sleep: スリープ対象を pick → スタンになる', () => {
    runPickBranch(stageStep1('sleep'));
    const pend = useGameStateStore.getState().pendingEffectPick;
    expect(pend, 'bindPick pending pick surface').not.toBeNull();
    expect(pend!.atomVerb).toBe('bindPick');
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'victim#1' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene[0]!.state, 'sleep → stun (印字通り)').toBe('stun');
  });

  it('happy-active: アクティブ対象を pick → スリープになる', () => {
    runPickBranch(stageStep1('active'));
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'victim#1' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene[0]!.state, 'active → sleep').toBe('sleep');
  });

  it('edge-stun: スタン対象を pick → 両分岐 false で状態不変 (rules/03)', () => {
    runPickBranch(stageStep1('stun'));
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'victim#1' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene[0]!.state, 'stun のまま (印字は stun 分岐に触れない)').toBe('stun');
  });

  it('edge-decline: pick を辞退 → bind 無し → 状態不変・crash なし', () => {
    runPickBranch(stageStep1('sleep'));
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene[0]!.state, 'decline で不変').toBe('sleep');
  });

  it('edge-0候補: 相手現場が空 → pick surface されず状態例外なし', () => {
    const mid = runPickBranch(stageStep1('none'));
    const pend = useGameStateStore.getState().pendingEffectPick;
    expect(pend, '0候補は auto-skip').toBeNull();
    expect(mid.players.opp.scene.length).toBe(0);
  });

  it('cross-side guard: side:opp なので自分キャラは候補に入らない', () => {
    const s = stageStep1('sleep');
    const mine = sceneChar('SRC', 'mine#2');
    mine.state = 'sleep';
    s.players.self.scene.push(mine);
    runPickBranch(s);
    const pend = useGameStateStore.getState().pendingEffectPick;
    expect(pend).not.toBeNull();
    const uids = pend!.candidates.map(c => c.uid);
    expect(uids).toContain('victim#1');
    expect(uids, '自分側 sleep キャラは対象外').not.toContain('mine#2');
  });
});

// ---- step1 exemplar B08035 怪盗キッド ----
describe('W4 step1 B08035 怪盗キッド (shape + behavioral)', () => {
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
    registerCardDef(B08035);
    registerCardDef(mkChar('VICTIM'));
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    useGameStateStore.getState().setGameState(null as never);
    useGameStateStore.getState().setPendingEffectPick(null);
    setHuman('self');
  });

  it('shape: 白 lv6 ap5000 lp1 怪盗、a1=enter+caseStatus解決編+bindPick sequence、a2=declared sleepSelf chain', () => {
    expect(B08035.no).toBe('0874/B08035');
    expect(B08035.colors).toEqual(['白']);
    expect(B08035.level).toBe(6);
    expect(B08035.ap).toBe(5000);
    expect(B08035.lp).toBe(1);
    expect(B08035.traits).toEqual(['怪盗']);
    const a1 = B08035.abilities[0]!;
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    expect(a1.condition).toEqual({ kind: 'caseStatus', status: '解決編' });
    const seq = a1.effect as { kind: string; steps: Array<{ kind: string; verb?: string }> };
    expect(seq.kind).toBe('sequence');
    expect(seq.steps[0]!.verb).toBe('bindPick');
    expect(seq.steps[1]!.kind).toBe('conditional');
    const a2 = B08035.abilities[1]!;
    expect(a2.type).toBe('declared');
    expect(a2.cost).toEqual({ kind: 'sleepSelf' });
    const ch = a2.effect as { kind: string; steps: Array<{ verb: string; args: Record<string, unknown> }> };
    expect(ch.kind).toBe('chain');
    expect(ch.steps[0]!.args.faceDownOnly).toBe(true);
    expect(ch.steps[0]!.args.side).toBe('either');
    expect((ch.steps[0]!.args.filter as Record<string, unknown>).hasFaceDownSetCards).toBe(true);
  });

  it('a1 実 enter 経路: 解決編 + 相手 sleep キャラ pick → スタン', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.case.status = '解決編';
    s.players.self.remove = ['B08035'];
    const v = sceneChar('VICTIM', 'victim#1');
    v.state = 'sleep';
    s.players.opp.scene = [v];
    const ctx: EffectCtx = { source: { cardId: 'VICTIM', uid: 'x#1', abilityId: 'aX', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      // 効果登場経路 (atomSceneEnter 単一 path) — 'enter' emit → a1 trigger
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'B08035', target: { query: { area: 'remove', side: 'self' } } } } as never, ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    const pend = useGameStateStore.getState().pendingEffectPick;
    expect(pend, 'a1 発火 → bindPick surface').not.toBeNull();
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'victim#1' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene[0]!.state, '解決編 sleep → stun').toBe('stun');
  });

  it('a1 gate: 事件編のままなら発火しない (相手キャラ不変)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.case.status = '事件編';
    s.players.self.remove = ['B08035'];
    const v = sceneChar('VICTIM', 'victim#1');
    v.state = 'sleep';
    s.players.opp.scene = [v];
    const ctx: EffectCtx = { source: { cardId: 'VICTIM', uid: 'x#1', abilityId: 'aX', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'B08035', target: { query: { area: 'remove', side: 'self' } } } } as never, ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick, '事件編は gate で不発火').toBeNull();
    expect(mid.players.opp.scene[0]!.state).toBe('sleep');
  });

  it('a2 faceDownOnly: 裏向きセット持ちのみ候補、リムーブは裏向き優先 (表向きは残る)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    const fdHost = sceneChar('VICTIM', 'fd#1');
    fdHost.setCards = [{ cardId: 'SETA', faceUp: true }, { cardId: 'SETB', faceUp: false }];
    const fuHost = sceneChar('VICTIM', 'fu#1');
    fuHost.setCards = [{ cardId: 'SETC', faceUp: true }];
    s.players.opp.scene = [fdHost, fuHost];
    const kid = sceneChar('B08035', 'kid#1');
    s.players.self.scene = [kid];
    const a2eff = B08035.abilities[1]!.effect!;
    const ctx: EffectCtx = { source: { cardId: 'B08035', uid: 'kid#1', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, a2eff, ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    const pend = useGameStateStore.getState().pendingEffectPick;
    expect(pend).not.toBeNull();
    const uids = pend!.candidates.map(c => c.uid);
    expect(uids, '裏向きセット持ちは候補').toContain('fd#1');
    expect(uids, '表向きのみのキャラは候補外 (hasFaceDownSetCards)').not.toContain('fu#1');
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'fd#1' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    const host = after.players.opp.scene.find(c => c.uid === 'fd#1')!;
    expect(host.setCards.length, '1枚だけリムーブ').toBe(1);
    expect(host.setCards[0]!.faceUp, '残るのは表向き SETA (faceDownOnly)').toBe(true);
    expect(after.players.opp.remove, '裏向き SETB は表向きにしてリムーブ (rules/16)').toContain('SETB');
    // そうした場合 → AP+2000 pick が続く
    const pend2 = useGameStateStore.getState().pendingEffectPick;
    expect(pend2?.atomVerb, 'chain 2段目 charModifyAP').toBe('charModifyAP');
  });
});

// ---- step2 r83: enter:group hook + TargetQuery.fromGroup (B01012 阿笠博士) ----
// 印字: 「【ターン1】能力や効果によってレベル6以下の〚特徴［少年探偵団］〛のキャラが自分の現場に
//        登場したとき、その中から1枚をアクティブにし、ターン終了時までそのキャラに〚迅速〛を与える。」
const GROUP_OBSERVER = mkChar('GROUP_OBS', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'enter:group' },
    condition: {
      kind: 'and',
      cs: [
        { kind: 'triggerPlayerIs', side: 'self' },
        { kind: 'boundAnyMatchesFilter', bindKey: 'enterGroup', filter: { kind: 'character', levelMax: 6, trait: '少年探偵団' } },
      ],
    },
    limit: { kind: 'turn', n: 1 },
    effect: {
      kind: 'sequence',
      steps: [
        { kind: 'atom', verb: 'sceneSetState', args: { player: 'self', side: 'self', n: 1, state: 'active', fromGroup: 'enterGroup', filter: { kind: 'character', levelMax: 6, trait: '少年探偵団' }, bind: 'picked' } },
        { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$picked.uid', kw: '迅速', scope: 'turn' } },
      ],
    },
    description: '', ruleRefs: [],
  } as never],
});
const SB_LV3 = mkChar('SB_LV3', { level: 3, traits: ['少年探偵団'] });
const SB_LV3B = mkChar('SB_LV3B', { level: 3, traits: ['少年探偵団'] });
const SB_LV9 = mkChar('SB_LV9', { level: 9, traits: ['少年探偵団'] });

describe('W4 step2 r83: enter:group + fromGroup (group-scoped 1-of-N)', () => {
  beforeEach(() => {
    event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
    registerCardDef(GROUP_OBSERVER); registerCardDef(SB_LV3); registerCardDef(SB_LV3B);
    registerCardDef(SB_LV9); registerCardDef(mkChar('VICTIM'));
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    useGameStateStore.getState().setGameState(null as never);
    useGameStateStore.getState().setPendingEffectPick(null);
    setHuman('self');
  });

  function stage(): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    const obs = sceneChar('GROUP_OBS', 'obs#1');
    s.players.self.scene = [obs];
    return s;
  }

  it('group N=2: multi-cid 効果登場 → 1回だけ発火、pick 母集合 = 登場した2枚のみ、1枚 active+迅速', () => {
    const s = stage();
    s.players.self.remove = ['SB_LV3', 'SB_LV3B'];
    // 既存の場に居る decoy (少年探偵団 lv3、fromGroup で除外されるべき)
    const decoy = sceneChar('SB_LV3', 'decoy#1');
    decoy.state = 'sleep';
    s.players.self.scene.push(decoy);
    const ctx: EffectCtx = { source: { cardId: 'GROUP_OBS', uid: 'obs#1', abilityId: 'aX', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardIds: ['SB_LV3', 'SB_LV3B'], enterSleep: true, target: { query: { area: 'remove', side: 'self' } } } } as never, ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    const pend = useGameStateStore.getState().pendingEffectPick;
    expect(pend, 'observer 発火 → group pick surface').not.toBeNull();
    const uids = pend!.candidates.map(c => c.uid);
    expect(uids.length, '母集合 = 同時登場2枚のみ (既存 decoy 除外)').toBe(2);
    expect(uids, 'decoy は fromGroup 外').not.toContain('decoy#1');
    const target = pend!.candidates.find(c => c.cardId === 'SB_LV3')!;
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: target.uid });
    expect(JSON.stringify(r)).toBe('{"ok":true}');
    const after = useGameStateStore.getState().gameState!;
    const pickedChar = after.players.self.scene.find(c => c.uid === target.uid)!;
    expect(pickedChar.state, 'picked → active').toBe('active');
    expect(JSON.stringify(pickedChar), '迅速 granted').toContain('迅速');
    const other = after.players.self.scene.find(c => c.cardId === 'SB_LV3B')!;
    expect(other.state, 'もう1枚は sleep のまま').toBe('sleep');
  });

  it('filter 不一致 (lv9 のみ登場) → 発火しない・【ターン1】未消費', () => {
    const s = stage();
    s.players.self.remove = ['SB_LV9'];
    const ctx: EffectCtx = { source: { cardId: 'GROUP_OBS', uid: 'obs#1', abilityId: 'aX', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardIds: ['SB_LV9'], target: { query: { area: 'remove', side: 'self' } } } } as never, ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick, 'lv9 は boundAnyMatchesFilter 不一致').toBeNull();
    const obs = mid.players.self.scene.find(c => c.uid === 'obs#1')!;
    expect(obs.declaredUseCount?.['a1'] ?? 0, '【ターン1】未消費 (発動自体していない)').toBe(0);
  });

  it('相手側への効果登場 → triggerPlayerIs(self) 不成立で発火しない', () => {
    const s = stage();
    s.players.opp.remove = ['SB_LV3'];
    const oppCtx: EffectCtx = { source: { cardId: 'VICTIM', uid: 'ov#1', abilityId: 'aX', player: 'opp', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardIds: ['SB_LV3'], target: { query: { area: 'remove', side: 'self' } } } } as never, oppCtx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick, '相手現場への登場では発火しない').toBeNull();
  });

  it('B01012 shape: 青 lv7 ap6000 lp1 発明家、a1 = enter:group + ターン1 + carrier/rider', () => {
    expect(B01012.no).toBe('0008/B01012');
    expect(B01012.colors).toEqual(['青']);
    expect(B01012.level).toBe(7);
    expect(B01012.ap).toBe(6000);
    expect(B01012.lp).toBe(1);
    expect(B01012.traits).toEqual(['発明家']);
    const a1 = B01012.abilities[0]!;
    expect(a1.trigger?.hook).toBe('enter:group');
    expect(a1.limit).toEqual({ kind: 'turn', n: 1 });
    const seq = a1.effect as { kind: string; steps: Array<{ verb: string; args: Record<string, unknown> }> };
    expect(seq.steps[0]!.args.fromGroup).toBe('enterGroup');
    expect(seq.steps[0]!.args.n).toBe(1);
    expect(seq.steps[1]!.args.uid).toBe('$picked.uid');
  });

  it('B01012 実挙動: 効果登場 (sleep) → active + 迅速、同ターン2回目は【ターン1】で不発火', () => {
    const s = stage();
    // observer を実カード B01012 に差し替え
    registerCardDef(B01012);
    s.players.self.scene = [sceneChar('B01012', 'agasa#1')];
    s.players.self.remove = ['SB_LV3', 'SB_LV3B'];
    const ctx: EffectCtx = { source: { cardId: 'VICTIM', uid: 'x#1', abilityId: 'aX', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'SB_LV3', enterSleep: true, target: { query: { area: 'remove', side: 'self' } } } } as never, ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    const pend = useGameStateStore.getState().pendingEffectPick;
    expect(pend, 'B01012 a1 発火').not.toBeNull();
    const target = pend!.candidates[0]!;
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: target.uid });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    const sb = after.players.self.scene.find(c => c.cardId === 'SB_LV3')!;
    expect(sb.state, 'sleep 登場 → active 化').toBe('active');
    expect(JSON.stringify(sb), '迅速 granted (turn scope)').toContain('迅速');
    // 同ターン 2 回目 → 【ターン1】で不発火
    const mid2 = produce(after, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'SB_LV3B', enterSleep: true, target: { query: { area: 'remove', side: 'self' } } } } as never, ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid2);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick, '【ターン1】消費済 → 不発火').toBeNull();
    expect(mid2.players.self.scene.find(c => c.cardId === 'SB_LV3B')!.state, '2枚目は sleep のまま').toBe('sleep');
  });

  it('viaEffect:false の登場では enter:group が emit されない', () => {
    const s = stage();
    s.players.self.remove = ['SB_LV3'];
    const ctx: EffectCtx = { source: { cardId: 'GROUP_OBS', uid: 'obs#1', abilityId: 'aX', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardIds: ['SB_LV3'], viaEffect: false, target: { query: { area: 'remove', side: 'self' } } } } as never, ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectPick, '「能力や効果によって」ではない登場 → 不発火').toBeNull();
  });
});

// ---- step3 r5: charStackCard fromSelf (現場キャラを別キャラの下に重ねる) — B06008 仮面ヤイバー ----
// 印字 a2: 「このキャラのアクション終了時、自分の現場にいる〚カード名［仮面ヤイバー］〛以外のキャラを
//          1枚選び、このキャラをそのキャラの下に重ねる。（選べる場合、必ず選んで重ねる）重ねた場合、
//          カードを1枚引く。」
const STACK_SELF_CHAIN: Effect = {
  kind: 'chain',
  steps: [
    { kind: 'atom', verb: 'charStackCard', args: { fromSelf: true, player: 'self', side: 'self', n: 1, filter: { cardNameNot: '仮面ヤイバー' } } },
    { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
  ],
} as never;

describe('W4 step3 r5: charStackCard fromSelf (scene→stack、非リムーブ離場)', () => {
  beforeEach(() => {
    resetDefRegistry();
    registerCardDef(mkChar('KY', { names: ['仮面ヤイバー'] }));
    registerCardDef(mkChar('KY_MR', { names: ['仮面ヤイバー'], isMR: true } as never));
    registerCardDef(mkChar('HOSTX', { names: ['ホスト'] }));
    _clearPendingEffectPickQueue();
    useGameStateStore.getState().setGameState(null as never);
    useGameStateStore.getState().setPendingEffectPick(null);
    setHuman('self');
  });

  const kyCtx = (uid = 'ky#1', cardId = 'KY'): EffectCtx => ({
    source: { cardId, uid, abilityId: 'a2', player: 'self', area: 'scene' },
    bindings: {},
  } as EffectCtx);

  function runChain(s: GameState, ctx: EffectCtx): GameState {
    const mid = produce(s, (d) => {
      runEffect(d, STACK_SELF_CHAIN, ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    return mid;
  }

  it('happy: host pick → self 離場 (scene から消える)、host.stackedCards=1、draw、リムーブ発生なし', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('KY', 'ky#1'), sceneChar('HOSTX', 'host#1')];
    s.players.self.deck = ['SB_LV3', 'SB_LV3B'];
    runChain(s, kyCtx());
    const pend = useGameStateStore.getState().pendingEffectPick;
    expect(pend, 'host pick surface').not.toBeNull();
    const uids = pend!.candidates.map(c => c.uid);
    expect(uids, '仮面ヤイバー (自分) は候補外').not.toContain('ky#1');
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'host#1' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.some(c => c.uid === 'ky#1'), 'self は scene から離場').toBe(false);
    const host = after.players.self.scene.find(c => c.uid === 'host#1')!;
    expect(Array.isArray(host.stackedCards) ? host.stackedCards.length : host.stackedCards, 'host の下に1枚重なる').toBe(1);
    expect(after.players.self.remove.length, 'リムーブではない (remove 不変)').toBe(0);
    expect(after.players.self.hand.length, '重ねた場合 → draw1').toBe(1);
  });

  it('0候補 (他が全て仮面ヤイバー) → auto-skip、self 残存、draw なし (chain gate)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('KY', 'ky#1'), sceneChar('KY', 'ky#2')];
    s.players.self.deck = ['SB_LV3'];
    const mid = runChain(s, kyCtx());
    expect(useGameStateStore.getState().pendingEffectPick, '0候補 → pick なし').toBeNull();
    expect(mid.players.self.scene.some(c => c.uid === 'ky#1'), 'self 残存').toBe(true);
    expect(mid.players.self.hand.length, '重ねていない → draw なし').toBe(0);
  });

  it('cascade: self の setCards/stacked は離場時リムーブ (rules/16)、host へは +1 のみ', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    const ky = sceneChar('KY', 'ky#1');
    ky.setCards = [{ cardId: 'SETX', faceUp: true }];
    ky.stackedCards = 2;
    s.players.self.scene = [ky, sceneChar('HOSTX', 'host#1')];
    // Leave one card after the chain draw.  This case isolates the leave
    // cascade; exact deck exhaustion and refresh are covered separately.
    s.players.self.deck = ['SB_LV3', 'SB_LV3B'];
    runChain(s, kyCtx());
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'host#1' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.remove, 'set card リムーブ').toContain('SETX');
    expect(after.players.self.remove.filter(c => c === 'back-card').length, '重なっていた2枚もリムーブ').toBe(2);
    { const stacked = after.players.self.scene.find(c => c.uid === 'host#1')!.stackedCards; expect(Array.isArray(stacked) ? stacked.length : stacked, 'host は +1 のみ').toBe(1); }
  });

  it('B06008 shape: 青 lv5 ap6000 lp0 ヒーロー、a1=enter+removeTraitAtLeast、a2=action:end fromSelf chain', () => {
    expect(B06008.no).toBe('0633/B06008');
    expect(B06008.colors).toEqual(['青']);
    expect(B06008.level).toBe(5);
    expect(B06008.ap).toBe(6000);
    expect(B06008.lp).toBe(0);
    expect(B06008.traits).toEqual(['ヒーロー']);
    const a1 = B06008.abilities[0]!;
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    expect(a1.condition).toEqual({ kind: 'removeTraitAtLeast', player: 'self', trait: '少年探偵団', n: 1 });
    const a2 = B06008.abilities[1]!;
    expect(a2.trigger).toEqual({ hook: 'action:end', selfOnly: true });
    const ch = a2.effect as { kind: string; steps: Array<{ verb: string; args: Record<string, unknown> }> };
    expect(ch.kind).toBe('chain');
    expect(ch.steps[0]!.args.fromSelf).toBe(true);
    expect(ch.steps[0]!.args.n).toBe(1);
    expect((ch.steps[0]!.args.filter as Record<string, unknown>).cardNameNot).toBe('仮面ヤイバー');
    expect(B06008P.id).toBe('B06008P');
    expect(B06008P.abilities).toBe(B06008.abilities);
  });

  it('B06008 実挙動: action:end → host pick → 重なる + draw / a1 は remove に少年探偵団ある時のみ突撃', () => {
    registerCardDef(B06008); registerCardDef(mkChar('SB', { traits: ['少年探偵団'] }));
    // triggered listener 再登録 (この describe の beforeEach は def registry のみ reset)
    event._resetRegistry(); _resetTriggeredRegistered(); registerTriggeredListener();
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('B06008', 'kyb#1'), sceneChar('HOSTX', 'host#1')];
    s.players.self.deck = ['SB'];
    s.players.self.remove = ['SB']; // a1 条件用 (少年探偵団 in remove)
    // a1: 効果登場で enter → 突撃 grant
    const mid0 = produce(s, (d) => {
      // enter 経路は step2 で検証済のため、ここでは a2 の action:end を直接 emit (cluster3 PR086 idiom)
      event.emit(d, 'action:end', { byUid: 'kyb#1', result: 'completed' }, { player: 'self', uid: 'kyb#1', cardId: 'B06008' });
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid0);
    surfacePendingSideChannels();
    const pend = useGameStateStore.getState().pendingEffectPick;
    expect(pend, 'a2 発火 → host pick').not.toBeNull();
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'host#1' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.some(c => c.uid === 'kyb#1'), 'B06008 は host の下へ').toBe(false);
    { const stacked = after.players.self.scene.find(c => c.uid === 'host#1')!.stackedCards; expect(Array.isArray(stacked) ? stacked.length : stacked).toBe(1); }
    expect(after.players.self.hand.length, '重ねた場合 draw1').toBe(1);
  });

  it('MR 非redirect: 相手ターン中でも MR は PA へ行かず重なる (公式Q&A B09048)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('KY_MR', 'kymr#1'), sceneChar('HOSTX', 'host#1')];
    s.players.self.deck = ['SB_LV3'];
    runChain(s, kyCtx('kymr#1', 'KY_MR'));
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'host#1' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    { const stacked = after.players.self.scene.find(c => c.uid === 'host#1')!.stackedCards; expect(Array.isArray(stacked) ? stacked.length : stacked, 'MR も重なる').toBe(1); }
    expect(after.players.self.partnerAreaMR ?? null, 'PA redirect しない').toBeFalsy();
  });
});

// ---- step6 r62: filtered-突撃 grant (B07096 ウォッカ) ----
// 印字 a1: 「【パートナー黒】〚突撃［レベル4以下のキャラ］〛（登場したターンからすぐにレベル4以下の
//          キャラを指定してアクションできる）」
const FILTERED_ASSAULT = mkChar('VODKA_LIKE', {
  abilities: [{
    id: 'a1', type: 'continuous', scope: 'on-scene',
    condition: { kind: 'partnerColor', color: '黒' },
    continuousModifier: { grantFilteredAssault: [{ targetKind: 'char', filter: { levelMax: 4 } }] },
    description: '', ruleRefs: [],
  } as never],
});
const PRINTED_ASSAULT_CHAR = mkChar('PRINTED_AC', { keywords: ['突撃[キャラ]'] });

describe('W4 step6 r62: filtered-突撃 (grantFilteredAssault + namedException 橋渡し)', () => {
  beforeEach(() => {
    resetDefRegistry();
    registerCardDef(FILTERED_ASSAULT); registerCardDef(PRINTED_ASSAULT_CHAR);
    registerCardDef(mkChar('T_LV4', { level: 4 })); registerCardDef(mkChar('T_LV5', { level: 5 }));
    registerCardDef(mkChar('P_BLACK', { colors: ['黒'] }));
    registerCardDef(mkChar('P_WHITE', { colors: ['白'] }));
  });

  function stage6(partnerBlack: boolean): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    const v = sceneChar('VODKA_LIKE', 'vd#1');
    v.isNamed = true; // 登場ターン (名乗り状態)
    v.state = 'active';
    s.players.self.scene = [v];
    s.players.self.partner.cardId = partnerBlack ? 'P_BLACK' : 'P_WHITE';
    const t4 = sceneChar('T_LV4', 't4#1'); t4.state = 'sleep';
    const t5 = sceneChar('T_LV5', 't5#1'); t5.state = 'sleep';
    s.players.opp.scene = [t4, t5];
    return s;
  }

  it('名乗り中 + パートナー黒: lv4 対象 OK / lv5 対象 NG / actor 列挙 (canAction) OK', () => {
    const s = stage6(true);
    expect(canActionAgainstChar(s, 'vd#1', 't4#1'), 'lv4 は指定可').toBe(true);
    expect(canActionAgainstChar(s, 'vd#1', 't5#1'), 'lv5 は指定不可 (filter)').toBe(false);
    expect(canAction(s, 'vd#1'), 'actor としては列挙される').toBe(true);
  });

  it('パートナー黒でない: 条件不成立 → 名乗り中はアクション不可', () => {
    const s = stage6(false);
    expect(canActionAgainstChar(s, 'vd#1', 't4#1')).toBe(false);
    expect(canAction(s, 'vd#1')).toBe(false);
  });

  it('名乗りでなければ lv5 以上も指定可 (公式Q&A: filter は名乗り例外のみを縛る)', () => {
    const s = stage6(true);
    s.players.self.scene.find(c => c.uid === 'vd#1')!.isNamed = false;
    expect(canActionAgainstChar(s, 'vd#1', 't5#1'), '非名乗りは無条件').toBe(true);
  });

  it('効果でレベルが下がったキャラも指定可 (公式Q&A: 効果込み evaluated level)', () => {
    const s = stage6(true);
    const t5 = s.players.opp.scene.find(c => c.uid === 't5#1')!;
    t5.turnEffects = { ...t5.turnEffects, lvlMod_turn: -1 } as never; // lv5 → 4
    expect(canActionAgainstChar(s, 'vd#1', 't5#1'), '効果後 lv4 = 指定可').toBe(true);
  });

  it('bundled fix: 印字 突撃[キャラ] のみ持ちも canAction (any) で列挙される', () => {
    const s = stage6(true);
    const pc = sceneChar('PRINTED_AC', 'pa#1');
    pc.isNamed = true; pc.state = 'active';
    s.players.self.scene.push(pc);
    expect(canAction(s, 'pa#1'), '突撃[キャラ] 持ちは actor 列挙可 (旧: any で false)').toBe(true);
    expect(canActionAgainstChar(s, 'pa#1', 't5#1'), '突撃[キャラ] は filter なし (レベル不問)').toBe(true);
  });

  it('B07096 shape: 黒 lv5 ap4000 黒ずくめの組織、a1=filtered-突撃 / a2=removedCharMatches observer / a3=cutin', () => {
    expect(B07096.no).toBe('0823/B07096');
    expect(B07096.colors).toEqual(['黒']);
    expect(B07096.level).toBe(5);
    expect(B07096.ap).toBe(4000);
    expect(B07096.traits).toEqual(['黒ずくめの組織']);
    const a1 = B07096.abilities[0]!;
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '黒' });
    expect(a1.continuousModifier?.grantFilteredAssault).toEqual([{ targetKind: 'char', filter: { kind: 'character', levelMax: 4 } }]);
    const a2 = B07096.abilities[1]!;
    expect(a2.trigger?.hook).toBe('leave:to-remove');
    expect(a2.trigger?.matcherCondition).toEqual({ kind: 'removedCharMatches', side: 'opp', removedFilter: { kind: 'character', levelMax: 4 } });
    expect(a2.condition).toEqual({ kind: 'turn', player: 'self' });
    expect(a2.limit).toEqual({ kind: 'turn', n: 1 });
  });

  it('B07096 実挙動: 名乗り + パートナー黒 → lv4 のみ指定可', () => {
    registerCardDef(B07096);
    const s = stage6(true);
    const vk = sceneChar('B07096', 'vk#1');
    vk.isNamed = true; vk.state = 'active';
    s.players.self.scene.push(vk);
    expect(canActionAgainstChar(s, 'vk#1', 't4#1'), 'lv4 指定可').toBe(true);
    expect(canActionAgainstChar(s, 'vk#1', 't5#1'), 'lv5 指定不可').toBe(false);
  });
});

// ---- step7 r1: protection rider (B05041「オレのそばから離れんなや…」) ----
describe('W4 step7 r1: on-set-host protection rider (opponentRestrict remove/sleep/stun)', () => {
  beforeEach(() => {
    resetDefRegistry();
    registerCardDef(B05041);
    registerCardDef(mkChar('GREEN_HOST', { colors: ['緑'] }));
    _clearPendingEffectPickQueue();
    useGameStateStore.getState().setGameState(null as never);
    useGameStateStore.getState().setPendingEffectPick(null);
    setHuman('self');
  });

  function stage7r1(faceUp = true): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    const host = sceneChar('GREEN_HOST', 'gh#1');
    host.setCards = [{ cardId: 'B05041', faceUp }];
    s.players.self.scene = [host];
    s.players.opp.scene = [sceneChar('GREEN_HOST', 'og#1')];
    return s;
  }

  const oppCtx7 = (): EffectCtx => ({
    source: { cardId: 'GREEN_HOST', uid: 'og#1', abilityId: 'aX', player: 'opp', area: 'scene' },
    bindings: {},
  } as EffectCtx);
  const selfCtx7 = (): EffectCtx => ({
    source: { cardId: 'GREEN_HOST', uid: 'gh#1', abilityId: 'aX', player: 'self', area: 'scene' },
    bindings: {},
  } as EffectCtx);

  it('相手効果の sceneRemove → block (現場残存) / 自分効果 → 通る', () => {
    const s = stage7r1();
    const blocked = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneRemove', args: { uid: 'gh#1', cause: 'effect' } } as never, oppCtx7());
      runAllUntilEmpty(d);
    });
    expect(blocked.players.self.scene.some(c => c.uid === 'gh#1'), '相手効果リムーブは無効').toBe(true);
    const own = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneRemove', args: { uid: 'gh#1', cause: 'effect' } } as never, selfCtx7());
      runAllUntilEmpty(d);
    });
    expect(own.players.self.scene.some(c => c.uid === 'gh#1'), '自分の効果は保護対象外 (「相手の」)').toBe(false);
  });

  it('相手効果の sleep/stun → block / active 化は通る (不利益でない)', () => {
    const s = stage7r1();
    s.players.self.scene[0]!.state = 'active';
    const afterSleep = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneSetState', args: { uid: 'gh#1', state: 'sleep' } } as never, oppCtx7());
      runAllUntilEmpty(d);
    });
    expect(afterSleep.players.self.scene[0]!.state, 'sleep block').toBe('active');
    const afterStun = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneSetState', args: { uid: 'gh#1', state: 'stun' } } as never, oppCtx7());
      runAllUntilEmpty(d);
    });
    expect(afterStun.players.self.scene[0]!.state, 'stun block').toBe('active');
    const s2 = stage7r1();
    s2.players.self.scene[0]!.state = 'sleep';
    const afterActive = produce(s2, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneSetState', args: { uid: 'gh#1', state: 'active' } } as never, oppCtx7());
      runAllUntilEmpty(d);
    });
    expect(afterActive.players.self.scene[0]!.state, 'active 化は妨げない').toBe('active');
  });

  it('解釈 pin: 保護中スタンキャラへ相手の activate → rules/03 代替 (sleep) は貫通する (fable 裁定)', () => {
    // 保護が列挙するのは「スリープさせる効果」等の効果種別 — activate 効果は該当しない (B05041 Q&A 整合)。
    // 公式裁定が出た場合はこの pin を意識的に反転する。
    const s = stage7r1();
    s.players.self.scene[0]!.state = 'stun';
    const after = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneSetState', args: { uid: 'gh#1', state: 'active' } } as never, oppCtx7());
      runAllUntilEmpty(d);
    });
    expect(after.players.self.scene[0]!.state, 'stun + 相手 activate → 代替 sleep (貫通、現解釈)').toBe('sleep');
  });

  it('B08035 a2 decline 経路: charRemoveSetCard 0枚辞退 → AP+2000 不発 (chain gate、BUG-111 前歴)', () => {
    registerCardDef(B08035);
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    const kid = sceneChar('B08035', 'kid#9');
    const host = sceneChar('GREEN_HOST', 'fdh#1');
    host.setCards = [{ cardId: 'SETZ', faceUp: false }];
    s.players.self.scene = [kid];
    s.players.opp.scene = [host];
    const ctx: EffectCtx = { source: { cardId: 'B08035', uid: 'kid#9', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, B08035.abilities[1]!.effect!, ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    const pend = useGameStateStore.getState().pendingEffectPick;
    expect(pend?.atomVerb).toBe('charRemoveSetCard');
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene.find(c => c.uid === 'fdh#1')!.setCards.length, 'セット card は残る').toBe(1);
    expect(useGameStateStore.getState().pendingEffectPick, 'AP+2000 pick は続かない (そうした場合 gate)').toBeNull();
  });

  it('コンタクト (contact-ap) による除去は貫通 (公式Q&A)', () => {
    const s = stage7r1();
    const after = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'gh#1', 'contact-ap');
    });
    expect(after.players.self.scene.some(c => c.uid === 'gh#1'), 'コンタクト除去は妨げない').toBe(false);
  });

  it('裏向きセットでは保護なし (rules/16: 裏向きセットは能力を持たない)', () => {
    const s = stage7r1(false);
    const after = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneRemove', args: { uid: 'gh#1', cause: 'effect' } } as never, oppCtx7());
      runAllUntilEmpty(d);
    });
    expect(after.players.self.scene.some(c => c.uid === 'gh#1'), '裏向き rider は無効').toBe(false);
  });

  it('B05041 shape + a1 fromSelf set 実挙動 (緑キャラに表向きセット)', () => {
    expect(B05041.no).toBe('0545/B05041');
    expect(B05041.kind).toBe('event');
    expect(B05041.colors).toEqual(['緑']);
    expect(B05041.level).toBe(8);
    const a2 = B05041.abilities[1]!;
    expect(a2.scope).toBe('on-set-host');
    expect(a2.continuousModifier?.opponentRestrict).toEqual(['remove', 'sleep', 'stun']);
    expect(B05041P.id).toBe('B05041P');
    // a1 実挙動: 使用済イベント (remove に居る) を緑キャラへ表向きセット
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('GREEN_HOST', 'gh#2')];
    s.players.self.remove = ['B05041'];
    const ctx: EffectCtx = { source: { cardId: 'B05041', uid: 'ev#1', abilityId: 'a1', player: 'self', area: 'remove' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, B05041.abilities[0]!.effect!, ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    const pend = useGameStateStore.getState().pendingEffectPick;
    expect(pend, 'host pick surface').not.toBeNull();
    const r = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'gh#2' });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    const host = after.players.self.scene.find(c => c.uid === 'gh#2')!;
    expect(host.setCards).toEqual([{ cardId: 'B05041', faceUp: true, instanceId: 'set:1' }]);
    expect(after.players.self.remove, 'イベント自身は remove から host へ').not.toContain('B05041');
  });
});

// ---- step4 r6/r7: stack-under cost 2種 (B09048 / B08006) ----
describe('W4 step4 r6: sceneStackUnderSelf cost (B09048 型)', () => {
  // B09048 a2 cost: 〚現場にいるレベル6以上の【黄】の特徴［警察］のキャラを1枚このキャラの下に重ねる〛
  const COST = {
    kind: 'sceneStackUnderSelf',
    n: 1,
    target: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { kind: 'character', levelMin: 6, color: '黄', trait: '警察' } }, n: { min: 1, max: 1 }, chooser: 'self' },
  } as never;

  const hostCtx = (): EffectCtx => ({
    source: { cardId: 'NAKAMORI', uid: 'naka#1', abilityId: 'a2', player: 'self', area: 'scene' },
    bindings: {},
  } as EffectCtx);

  beforeEach(() => {
    resetDefRegistry();
    registerCardDef(mkChar('NAKAMORI', { colors: ['白'], level: 7, traits: ['警察', '警視庁'] }));
    registerCardDef(mkChar('POL_Y6', { colors: ['黄'], level: 6, traits: ['警察'] }));
    registerCardDef(mkChar('POL_W6', { colors: ['白'], level: 6, traits: ['警察'] }));
    registerCardDef(mkChar('DET_Y6', { colors: ['黄'], level: 6, traits: ['探偵'] }));
  });

  function stage4(withCand: boolean): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('NAKAMORI', 'naka#1')];
    if (withCand) s.players.self.scene.push(sceneChar('POL_Y6', 'poly#1'));
    // decoy: 色違い/特徴違い + 相手側一致
    s.players.self.scene.push(sceneChar('POL_W6', 'polw#1'), sceneChar('DET_Y6', 'dety#1'));
    s.players.opp.scene = [sceneChar('POL_Y6', 'oppy#1')];
    return s;
  }

  it('canPay: 自陣に条件一致1枚で true / 0枚で false (decoy 3軸 + cross-side 除外)', () => {
    expect(canPayCost(stage4(true), COST, hostCtx())).toBe(true);
    expect(canPayCost(stage4(false), COST, hostCtx()), '色/特徴 decoy と相手側は数えない').toBe(false);
  });

  it('pay: 候補が scene から離場 (remove に入らない)、host.stackedCards=1', () => {
    const s = stage4(true);
    const after = produce(s, (d) => { pay(d, COST, hostCtx()); });
    expect(after.players.self.scene.some(c => c.uid === 'poly#1'), '重なった (scene から消える)').toBe(false);
    { const stacked = after.players.self.scene.find(c => c.uid === 'naka#1')!.stackedCards; expect(Array.isArray(stacked) ? stacked.length : stacked).toBe(1); }
    expect(after.players.self.remove.length, 'リムーブではない').toBe(0);
  });

  it('状態不問: stun 候補も cost として重ねられる (rules/16 state 前提なし)', () => {
    const s = stage4(true);
    s.players.self.scene.find(c => c.uid === 'poly#1')!.state = 'stun';
    expect(canPayCost(s, COST, hostCtx())).toBe(true);
  });
});

describe('W4 step4 r7: handStackUnder cost (B08006 型)', () => {
  // B08006 a1 cost: 〚手札から特徴［少年探偵団］のキャラを1枚公開し、自分の現場にいる【青】のキャラ1枚の下に重ねる〛
  const COST = {
    kind: 'handStackUnder',
    cardTarget: { kind: 'pick', query: { area: 'hand', side: 'self', filter: { kind: 'character', trait: '少年探偵団' } }, n: { min: 1, max: 1 }, chooser: 'self' },
    hostTarget: { kind: 'pick', query: { area: 'scene', side: 'self', filter: { kind: 'character', color: '青' } }, n: { min: 1, max: 1 }, chooser: 'self' },
  } as never;

  const genCtx = (): EffectCtx => ({
    source: { cardId: 'GENTA', uid: 'gen#1', abilityId: 'a1', player: 'self', area: 'scene' },
    bindings: {},
  } as EffectCtx);

  beforeEach(() => {
    resetDefRegistry();
    registerCardDef(mkChar('GENTA', { colors: ['青'], level: 7, traits: ['少年探偵団'] }));
    registerCardDef(mkChar('SB_HAND', { colors: ['青'], level: 3, traits: ['少年探偵団'] }));
    registerCardDef(mkChar('RED_HOST', { colors: ['赤'] }));
  });

  function stage7(hand: string[], blueHost: boolean): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = blueHost ? [sceneChar('GENTA', 'gen#1')] : [sceneChar('RED_HOST', 'red#1')];
    s.players.self.hand = hand;
    return s;
  }

  it('canPay: 手札に少年探偵団 + 現場に青キャラで true / どちらか欠けたら false', () => {
    expect(canPayCost(stage7(['SB_HAND'], true), COST, genCtx())).toBe(true);
    expect(canPayCost(stage7([], true), COST, genCtx()), '手札候補なし').toBe(false);
    expect(canPayCost(stage7(['SB_HAND'], false), COST, genCtx()), '青 host なし').toBe(false);
  });

  it('pay: 手札-1、host.stackedCards=1 (公式Q&A: 自身の下にも重ねられる)', () => {
    const s = stage7(['SB_HAND', 'RED_HOST'], true);
    const after = produce(s, (d) => { pay(d, COST, genCtx()); });
    expect(after.players.self.hand.length, '公開した1枚が手札から消える').toBe(1);
    { const stacked = after.players.self.scene.find(c => c.uid === 'gen#1')!.stackedCards; expect(Array.isArray(stacked) ? stacked.length : stacked, '青キャラ (自身可) の下に重なる').toBe(1); }
    expect(after.players.self.remove.length, 'リムーブではない').toBe(0);
  });
});

describe('W4 step4 exemplar shapes (B09048 / B08006)', () => {
  it('B09048: 白 lv7、a1=enter chain[discard, sceneEnter from:remove enterSleep]、a2=caseColor and + sceneStackUnderSelf cost', () => {
    expect(B09048.no).toBe('0991/B09048');
    expect(B09048.colors).toEqual(['白']);
    expect(B09048.traits).toEqual(['警察', '警視庁']);
    const a1 = B09048.abilities[0]!;
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    const ch = a1.effect as { kind: string; steps: Array<{ verb: string; args: Record<string, unknown> }> };
    expect(ch.kind).toBe('chain');
    expect(ch.steps[0]!.verb).toBe('discard');
    expect(ch.steps[1]!.verb).toBe('sceneEnter');
    expect(ch.steps[1]!.args.enterSleep).toBe(true);
    expect(ch.steps[1]!.args.from).toBe('remove');
    const a2 = B09048.abilities[1]!;
    expect(a2.type).toBe('declared');
    expect(a2.condition).toEqual({ kind: 'caseColor', color: ['白', '黄'], combine: 'and' });
    const cost = a2.cost as { kind: string; n: number; target: { query: { filter: Record<string, unknown> } } };
    expect(cost.kind).toBe('sceneStackUnderSelf');
    expect(cost.target.query.filter).toEqual({ kind: 'character', levelMin: 6, color: '黄', trait: '警察' });
  });

  it('B08006: 青 lv7 少年探偵団、a1=pay[sleepSelf, handStackUnder]、a2=ヒラメキ 解決編 $trigger.byUid スタン', () => {
    expect(B08006.no).toBe('0847/B08006');
    expect(B08006.colors).toEqual(['青']);
    const a1 = B08006.abilities[0]!;
    expect(a1.type).toBe('declared');
    const cost = a1.cost as { kind: string; items: Array<{ kind: string }> };
    expect(cost.kind).toBe('pay');
    expect(cost.items.map(i => i.kind)).toEqual(['sleepSelf', 'handStackUnder']);
    const a2 = B08006.abilities[1]!;
    expect(a2.trigger).toEqual({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.condition).toEqual({ kind: 'caseStatus', status: '解決編' });
    expect((a2.effect as { args: Record<string, unknown> }).args.uid).toBe('$trigger.byUid');
  });

  it('r84 perSideMax AI 経路: side either n:2 perSideMax:1 → 自陣2/相手1 から 各side 1枚ずつ', () => {
    resetDefRegistry();
    registerCardDef(mkChar('HOST_A')); registerCardDef(mkChar('HOST_B')); registerCardDef(mkChar('HOST_O'));
    _clearPendingEffectPickQueue();
    setHuman(null); // AI drain 経路
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    const mk = (id: string, uid: string) => { const c = sceneChar(id, uid); c.setCards = [{ cardId: 'SET_' + uid, faceUp: false }]; return c; };
    s.players.self.scene = [mk('HOST_A', 'ha#1'), mk('HOST_B', 'hb#1')];
    s.players.opp.scene = [mk('HOST_O', 'ho#1')];
    const ctx: EffectCtx = { source: { cardId: 'HOST_A', uid: 'ha#1', abilityId: 'aX', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const after = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'charRemoveSetCard', args: { player: 'self', side: 'either', n: 2, perSideMax: 1, filter: { hasSetCards: true } } } as never, ctx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    const selfRemoved = after.players.self.scene.filter(c => c.setCards.length === 0).length;
    const oppRemoved = after.players.opp.scene.filter(c => c.setCards.length === 0).length;
    expect(selfRemoved, '自陣から1枚のみ (perSideMax:1、2枚とも自陣は禁止)').toBe(1);
    expect(oppRemoved, '相手陣から1枚').toBe(1);
    setHuman('self');
  });

  it('r84 perSideMax resolve backstop: 同一 side 2枚 pick は throw', () => {
    resetDefRegistry();
    registerCardDef(mkChar('HOST_A')); registerCardDef(mkChar('HOST_B'));
    const s = createEmptyGameState();
    s.players.self.scene = [sceneChar('HOST_A', 'ha#2'), sceneChar('HOST_B', 'hb#2')];
    const ctx: EffectCtx = { source: { cardId: 'HOST_A', uid: 'ha#2', abilityId: 'aX', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const ref = { kind: 'pick', query: { area: 'scene', side: 'either', perSideMax: 1 }, n: { min: 0, max: 2 }, chooser: 'self' } as never;
    const both = [
      { kind: 'char', uid: 'ha#2', cardId: 'HOST_A', player: 'self', area: 'scene' },
      { kind: 'char', uid: 'hb#2', cardId: 'HOST_B', player: 'self', area: 'scene' },
    ] as never;
    expect(() => resolveTarget(s, ref, ctx, both)).toThrow(/perSideMax/);
  });

  it('B09048 a2 canPay 実測: 事件白黄 + 自陣に黄警察 lv6 → true / 事件白のみ → 能力条件は engine gate (canPay は cost のみ)', () => {
    resetDefRegistry();
    registerCardDef(B09048);
    registerCardDef(mkChar('POL_Y6B', { colors: ['黄'], level: 6, traits: ['警察'] }));
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('B09048', 'naka#2'), sceneChar('POL_Y6B', 'py#1')];
    const ctx: EffectCtx = { source: { cardId: 'B09048', uid: 'naka#2', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    expect(canPayCost(s, B09048.abilities[1]!.cost as never, ctx)).toBe(true);
    const after = produce(s, (d) => { pay(d, B09048.abilities[1]!.cost as never, ctx); });
    { const stacked = after.players.self.scene.find(c => c.uid === 'naka#2')!.stackedCards; expect(Array.isArray(stacked) ? stacked.length : stacked, 'cost で自身の下に重なる').toBe(1); }
    expect(after.players.self.scene.some(c => c.uid === 'py#1')).toBe(false);
  });
});
