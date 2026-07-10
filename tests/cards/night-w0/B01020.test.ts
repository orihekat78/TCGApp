// tests/cards/night-w0/B01020 毛利小五郎 probe (DEFER解禁 B04072 clone, untargetableByActionAura、engine変更0)
//   a1: このキャラがスリープ状態の場合、相手は自分の現場にいるレベル4以下のキャラを指定してアクションできない。
//       => continuous condition{charStateIs self sleep} + continuousModifier.untargetableByActionAura{levelMax:4}
//       (色制限なし = level のみ。B04072 から color を外した clone)。
//   a2: 【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//       => triggered on-evidence evidence:remove-by-action optional + sceneSetState sleep pick (side either, n0-1)。
// production dispatch: a1 = target-expander.candidates() 負 filter / a2 = event.emit evidence:remove-by-action
//   → pendingHirameki side-channel + runEffect(sceneSetState) の実 pick 解決。owner='opp' 逆側 pin 含む (BUG-174)。
// rules: 07 (アクション対象) / 10 (ヒラメキ) / 15 (「まで」=0可・side either) / 24 (スタン≠スリープ)
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate as mutateAll } from '@/engine/mutate/index';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import { _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { candidates as targetCandidates } from '@/engine/flow/action/target-expander';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { B01020 } from '@/cards/ct-p01/B01020';
import type { CardDef, Effect, EffectCtx, GameState } from '@/engine/types';

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = s; };

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});

const FIXTURES: CardDef[] = [
  B01020,
  mkChar('ATK', { ap: 5000 }),
  mkChar('RED4', { colors: ['赤'], level: 4 }), // lv4 非青 — 色に関係なく除外されることの確認
  mkChar('BLUE3', { colors: ['青'], level: 3 }),
  mkChar('BLUE6', { colors: ['青'], level: 6 }),
  mkChar('OPPT', { ap: 4000 }),
  mkChar('OWNC', { ap: 3000 }),
];

function ctxFor(player: 'self' | 'opp', uid: string, cardId: string, abilityId = 'a1'): EffectCtx {
  return { source: { player, uid, cardId, abilityId, area: 'scene' }, bindings: {} } as EffectCtx;
}

function baseState(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _resetPendingHirameki();
  setHuman(null);
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
});

// ============== shape ==============
describe('B01020 毛利小五郎 — shape', () => {
  it('metadata: no/kind/level/ap/lp/traits/names', () => {
    expect(B01020.no).toBe('0016/B01020');
    expect(B01020.kind).toBe('character');
    expect(B01020.names).toEqual(['毛利小五郎']);
    expect(B01020.colors).toEqual(['青']);
    expect(B01020.level).toBe(5);
    expect(B01020.ap).toBe(5000);
    expect(B01020.lp).toBe(1);
    expect(B01020.traits).toEqual(['探偵', '毛利探偵事務所']);
    expect(B01020.abilities.length).toBe(2);
  });

  it('a1: continuous + charStateIs sleep condition + untargetableByActionAura{levelMax:4} (色指定なし)', () => {
    const a1 = B01020.abilities[0];
    expect(a1.type).toBe('continuous');
    expect(a1.scope).toBe('on-scene');
    expect(a1.condition).toEqual({ kind: 'charStateIs', ref: { kind: 'self' }, state: 'sleep' });
    const filter = a1.continuousModifier?.untargetableByActionAura as { levelMax?: number; color?: unknown };
    expect(filter?.levelMax).toBe(4);
    expect(filter?.color, '色制限なし').toBeUndefined();
  });

  it('a2: hirameki triggered (evidence:remove-by-action optional) + sceneSetState sleep pick (side either, 1枚まで=0可)', () => {
    const a2 = B01020.abilities[1];
    expect(a2.type).toBe('triggered');
    expect(a2.scope).toBe('on-evidence');
    expect(a2.trigger?.hook).toBe('evidence:remove-by-action');
    expect(a2.trigger?.optional).toBe(true);
    const eff = a2.effect as { verb?: string; args?: { state?: string; target?: { query?: { side?: string }; n?: { min?: number; max?: number } } } };
    expect(eff.verb).toBe('sceneSetState');
    expect(eff.args?.state).toBe('sleep');
    expect(eff.args?.target?.query?.side).toBe('either');
    expect(eff.args?.target?.n?.min, '「1枚まで」= 0枚可').toBe(0);
    expect(eff.args?.target?.n?.max).toBe(1);
  });
});

// ============== a1: untargetableByActionAura (production 経路 = candidates) ==============
describe('B01020 a1 — untargetableByActionAura', () => {
  // bearer(B01020) が bearerSide にスリープで居るとき、相手(atkSide)は bearerSide の lv4以下を対象にできない
  function board(bearerSide: 'self' | 'opp', bearerState: 'active' | 'sleep' | 'stun') {
    const atkSide = bearerSide === 'self' ? 'opp' : 'self';
    const s = baseState();
    const atk = mutateAll.scene.enter(s, atkSide, 'ATK', { active: true });
    const bearer = mutateAll.scene.enter(s, bearerSide, 'B01020', {});
    mutateAll.scene.setState(s, bearer.uid, bearerState);
    // 対象候補 = bearerSide の sleep キャラ (rules/07 アクティブ相手は対象不可)
    const red4 = mutateAll.scene.enter(s, bearerSide, 'RED4', {});
    mutateAll.scene.setState(s, red4.uid, 'sleep');
    const blue3 = mutateAll.scene.enter(s, bearerSide, 'BLUE3', {});
    mutateAll.scene.setState(s, blue3.uid, 'sleep');
    const blue6 = mutateAll.scene.enter(s, bearerSide, 'BLUE6', {});
    mutateAll.scene.setState(s, blue6.uid, 'sleep');
    return { s, atk, bearer, red4, blue3, blue6 };
  }

  it('bearer スリープ (self側) — lv4以下は色不問で除外、lv5以上は残る', () => {
    const { s, atk, bearer, red4, blue3, blue6 } = board('self', 'sleep');
    const cands = targetCandidates(s, atk.uid);
    expect(cands.some(c => c.uid === red4.uid), 'lv4 赤 = 除外 (色不問)').toBe(false);
    expect(cands.some(c => c.uid === blue3.uid), 'lv3 青 = 除外').toBe(false);
    expect(cands.some(c => c.uid === blue6.uid), 'lv6 青 = 残る').toBe(true);
    expect(cands.some(c => c.uid === bearer.uid), '小五郎自身 (lv5) = 残る').toBe(true);
  });

  it('bearer アクティブ/スタン — aura 無効 (Q&A: スタン状態は条件を満たさない)', () => {
    for (const st of ['active', 'stun'] as const) {
      const { s, atk, red4 } = board('self', st);
      const cands = targetCandidates(s, atk.uid);
      expect(cands.some(c => c.uid === red4.uid), `bearer ${st} → lv4 も対象可`).toBe(true);
    }
  });

  it('逆側 pin (BUG-174): bearer が opp側スリープ — self attacker から opp の lv4以下が除外される', () => {
    const { s, atk, red4, blue3, blue6 } = board('opp', 'sleep');
    const cands = targetCandidates(s, atk.uid);
    expect(cands.some(c => c.uid === red4.uid), 'lv4 = 除外').toBe(false);
    expect(cands.some(c => c.uid === blue3.uid), 'lv3 = 除外').toBe(false);
    expect(cands.some(c => c.uid === blue6.uid), 'lv6 = 残る').toBe(true);
  });
});

// ============== a2: hirameki (real emit + effect 解決) ==============
describe('B01020 a2 — ヒラメキ', () => {
  const sleepCount = (s: GameState) =>
    s.players.self.scene.filter(c => c.state === 'sleep').length +
    s.players.opp.scene.filter(c => c.state === 'sleep').length;

  it('real emit: evidence:remove-by-action で pendingHirameki に push (fire/skip 委譲)', () => {
    let s = baseState();
    s = produce(s, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B01020' } }, { player: 'opp', uid: 'atk' });
    });
    const pend = _drainPendingHirameki();
    expect(pend, 'ヒラメキ発火 (pending set)').not.toBeNull();
    expect(pend?.player).toBe('self');
    expect(pend?.cardId).toBe('B01020');
    expect(pend?.abilityId).toBe('a2');
  });

  it('real emit 逆側 (BUG-174): player=opp でリムーブ → opp の pending', () => {
    let s = baseState();
    s = produce(s, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'opp', ev: { cardId: 'B01020' } }, { player: 'self', uid: 'atk' });
    });
    const pend = _drainPendingHirameki();
    expect(pend?.player).toBe('opp');
    expect(pend?.abilityId).toBe('a2');
  });

  it('effect: キャラを1枚選びスリープ (side either、両現場が候補、自身も選べる)', () => {
    setHuman('self');
    const s = baseState();
    const own = mutateAll.scene.enter(s, 'self', 'OWNC', { active: true });
    const oppTgt = mutateAll.scene.enter(s, 'opp', 'OPPT', { active: true });
    expect(sleepCount(s)).toBe(0);
    const a2 = B01020.abilities.find(a => a.id === 'a2')!;
    // 実 hirameki fire と同一経路 (triggered.ts 強制発動 path 準拠):
    //   resolveEffectPicks (humanChooser=true) → event.queue → runAllUntilEmpty で
    //   atom-handler が Pattern A pick を human side-channel へ surface。
    const baseCtx = {
      source: { cardId: 'B01020', uid: 'evidence:self', abilityId: 'a2', player: 'self', area: 'evidence' },
      bindings: {},
      triggerPayload: { player: 'self', ev: { cardId: 'B01020' } },
    } as unknown as EffectCtx;
    const resolved = resolveEffectPicks(s, a2.effect as Effect, baseCtx, {
      byPlayer: 'self',
      humanChooser: true,
      source: { cardId: 'B01020', abilityId: 'a2' },
    });
    event.queue(s, resolved, { player: 'self', uid: 'evidence:self', cardId: 'B01020' }, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B01020' } });
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'sleep 対象 pick が surface').toBeTruthy();
    expect(pick!.nMin, '「1枚まで」= 0枚可').toBe(0);
    expect(pick!.nMax).toBe(1);
    const candUids = (pick!.candidates as Array<{ uid: string }>).map(c => c.uid);
    expect(candUids, 'side either = 相手現場キャラも候補').toContain(oppTgt.uid);
    expect(candUids, 'side either = 自現場キャラも候補').toContain(own.uid);
    // 相手キャラを選択 → スリープ化
    applyPickAndContinuation(s, pick!, oppTgt.uid, [oppTgt.uid]);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene.find(c => c.uid === oppTgt.uid)?.state, '選択キャラはスリープ').toBe('sleep');
    expect(sleepCount(s), '正確に1枚のみ').toBe(1);
  });
});
