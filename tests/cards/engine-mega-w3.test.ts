// tests/cards/engine-mega-w3
// engine mega-wave W3 (2026-07-03): observer hook 5 primitive の TDD probe。
//   r10 disguise:replaced hook + disguiseReplacedByMatches (B03052 被置換側反応)
//   r51 disguise:into payload.replacedChar + disguiseReplacedMatches (B02047 入替え元 filter)
//   r12 invokeLeaveToRemoveOfCard verb (B08078 a2 用 engine-only、card は DEFER)
//   r17 hand:removed hook + triggerByPlayerIs (B05115) + sceneEnter sourceRequired
//   r18 hand:reveal hook + triggerRevealMatches (B09004)
// rules: 09/10/15/17/19/21/23/25 + 各カード公式Q&A
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { disguise } from '@/engine/flow/contact';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate/index';
import { char as readChar } from '@/engine/read/char';
import { evalCond } from '@/engine/cond/eval';
import { pay } from '@/engine/cost/pay';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../helpers/fixtures';
import { B03052 } from '@/cards/ct-p03/B03052';
import { B03052P } from '@/cards/ct-p03/B03052P';
import { B02047 } from '@/cards/ct-p02/B02047';
import { B05115 } from '@/cards/ct-p05/B05115';
import { B09004 } from '@/cards/ct-p09/B09004';
import type { AbilityDef, CardDef, Effect, EffectCtx, GameState, ActionContext, SceneCharacter } from '@/engine/types';
import { dispatchCurrentDecision } from '../helpers/dispatch-current-decision';

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = s; };

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const DRAW1: Effect = { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } } as never;
const disguiseAb = (id = 'd1'): AbilityDef => ({
  id, type: 'icon-disguise', scope: 'on-scene', description: '【変装】', ruleRefs: [],
} as AbilityDef);

// ---- r10 合成 def ----
const RETREAT = mkChar('RETREAT', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'disguise:replaced', selfOnly: true, matcherCondition: { kind: 'disguiseReplacedByMatches', filter: { cardName: 'ベルモット' } } },
    effect: DRAW1, description: '', ruleRefs: [],
  } as never],
});
const INCOMING_VERMOUTH = mkChar('INCOMING_VERMOUTH', { names: ['ベルモット'], abilities: [disguiseAb()] });
const INCOMING_OTHER = mkChar('INCOMING_OTHER', { names: ['別人'], abilities: [disguiseAb()] });
const WATCHER = mkChar('WATCHER', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'disguise:replaced', selfOnly: true },
    effect: DRAW1, description: '', ruleRefs: [],
  } as never],
});
const PLAIN = mkChar('PLAIN');
// ---- r51 合成 def ----
const REP_W2 = mkChar('REP_W2', { colors: ['白'], lp: 2 });
const REP_W1_CONTINUOUS = mkChar('REP_W1_CONTINUOUS', {
  colors: ['白'], lp: 1,
  abilities: [{
    id: 'lp-plus-one', type: 'continuous', scope: 'on-scene',
    continuousModifier: { lpDelta: 1 }, description: '', ruleRefs: [],
  } as never],
});
const REP_K1 = mkChar('REP_K1', { colors: ['黒'], lp: 1 });
// ---- r12 合成 def ----
const LEAVER = mkChar('LEAVER', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'leave:to-remove', selfOnly: true },
    effect: DRAW1, description: '【現場リムーブ時】draw1', ruleRefs: [],
  } as never],
});
const LEAVER_OPPTURN = mkChar('LEAVER_OPPTURN', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'leave:to-remove', selfOnly: true },
    condition: { kind: 'turn', player: 'opp' },
    effect: DRAW1, description: '', ruleRefs: [],
  } as never],
});
const LEAVE_OBSERVER = mkChar('LEAVE_OBSERVER', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'leave:to-remove' }, // 非 selfOnly = 盤面 observer
    effect: DRAW1, description: '', ruleRefs: [],
  } as never],
});
// ---- r17/r18 合成 observer ----
const HAND_OBS = mkChar('HAND_OBS', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'hand:removed', matcherCondition: { kind: 'triggerByPlayerIs', side: 'opp' } },
    effect: DRAW1, description: '', ruleRefs: [],
  } as never],
});
const REVEAL_OBS = mkChar('REVEAL_OBS', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'hand:reveal', matcherCondition: { kind: 'triggerRevealMatches', side: 'self', cardName: '工藤新一' } },
    effect: DRAW1, description: '', ruleRefs: [],
  } as never],
});
const SHINICHI = mkChar('SHINICHI', { names: ['工藤新一'] });
const SHINICHI_KYOGOKU = mkChar('SHINICHI_KYOGOKU', { names: ['工藤新一'] });
const RAN_CARD = mkChar('RAN_CARD', { names: ['毛利蘭'] });
const MOB = mkChar('MOB', { names: ['モブ'] });

function makeAx(): ActionContext {
  return {
    id: 'ax', byUid: 'atk', byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
    phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
    apSnapshot: { aUid: 'atk', aAP: 4000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
  } as unknown as ActionContext;
}

/** self atk / opp dft のコンタクト盤面。atk の cardId を差替え可能。 */
function contactBase(atkCardId: string, hand: string[]): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.scene = [sceneChar(atkCardId, 'atk')];
  s.players.opp.scene = [sceneChar('PLAIN', 'dft')];
  s.players.self.hand = [...hand];
  s.players.self.deck = ['MOB', 'MOB', 'MOB'];
  return s;
}

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  _clearPendingEffectPickQueue();
  // optional side-channel の test 間残留を清掃 (surface して未消費のまま次 test に漏れる)
  const og = globalThis as { __pendingEffectOptionalSide?: unknown; __pendingEffectOptionalResume?: unknown; __pendingEffectOptionalBindings?: unknown };
  og.__pendingEffectOptionalSide = null; og.__pendingEffectOptionalResume = null; og.__pendingEffectOptionalBindings = null;
  useGameStateStore.getState().setPendingEffectOptional?.(null as never);
  setHuman(null);
  for (const d of [RETREAT, INCOMING_VERMOUTH, INCOMING_OTHER, WATCHER, PLAIN, REP_W2, REP_W1_CONTINUOUS, REP_K1,
    LEAVER, LEAVER_OPPTURN, LEAVE_OBSERVER, HAND_OBS, REVEAL_OBS, SHINICHI, SHINICHI_KYOGOKU, RAN_CARD, MOB]) registerCardDef(d);
  registerCardDef(B03052); registerCardDef(B03052P); registerCardDef(B02047);
  registerCardDef(B05115); registerCardDef(B09004);
  registerCardDef(mkChar('KYOGOKU_SHINICHI', { names: ['工藤新一'] }));
  registerTriggeredListener();
});

// ================= r10 disguise:replaced =================

describe('r10 disguise:replaced hook + disguiseReplacedByMatches', () => {
  it('emit payload 形状: {uid, fromCardId, newCardId, player} / source.cardId=fromCardId', () => {
    const s = contactBase('PLAIN', ['INCOMING_VERMOUTH']);
    const captured: unknown[] = [];
    event.on('disguise:replaced', (_s, payload, source) => { captured.push({ payload, source }); });
    produce(s, (d) => { disguise(d, makeAx(), 'self', 'INCOMING_VERMOUTH'); });
    expect(captured.length).toBe(1);
    expect((captured[0] as { payload: unknown }).payload).toMatchObject({ uid: 'atk', fromCardId: 'PLAIN', newCardId: 'INCOMING_VERMOUTH', player: 'self' });
    expect((captured[0] as { source: unknown }).source).toMatchObject({ player: 'self', uid: 'atk', cardId: 'PLAIN' });
  });

  it('被置換側 selfOnly 反応: ベルモットと入替 → 発火 (draw) / 別人と入替 → 不発', () => {
    for (const [incoming, expectFire] of [['INCOMING_VERMOUTH', true], ['INCOMING_OTHER', false]] as const) {
      _resetUidCounter();
      const s = contactBase('RETREAT', [incoming]);
      const after = produce(s, (d) => {
        disguise(d, makeAx(), 'self', incoming);
        runAllUntilEmpty(d);
      });
      expect(after.players.self.hand.length, `${incoming} → fire=${expectFire}`).toBe(expectFire ? 1 : 0);
    }
  });

  it('第三者観測は起きない: 別キャラの被置換で bystander の同 hook は不発', () => {
    const s = contactBase('PLAIN', ['INCOMING_VERMOUTH']);
    s.players.self.scene.push(sceneChar('WATCHER', 'w1'));
    const after = produce(s, (d) => {
      disguise(d, makeAx(), 'self', 'INCOMING_VERMOUTH');
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, 'WATCHER 不発 (draw 無し)').toBe(0);
  });

  it('B03052 exemplar: ベルモットが変装で入れ替わったとき → 1枚まで選びスリープ (AI)', () => {
    const s = contactBase('B03052', ['INCOMING_VERMOUTH']);
    const tgt = sceneChar('PLAIN', 'sleepme');
    tgt.state = 'active';
    s.players.opp.scene.push(tgt);
    const after = produce(s, (d) => {
      disguise(d, makeAx(), 'self', 'INCOMING_VERMOUTH');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });
    const slept = [...after.players.self.scene, ...after.players.opp.scene].filter(c => c.state === 'sleep');
    expect(slept.length, '1枚スリープ (AI pick)').toBeGreaterThanOrEqual(1);
  });
});

// ================= r51 disguiseReplacedMatches =================

describe('r51 disguise:into payload.replacedChar + disguiseReplacedMatches', () => {
  const ctxOf = (payload: unknown): EffectCtx =>
    ({ source: { cardId: 'B02047', uid: 'atk', abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {}, triggerPayload: payload }) as unknown as EffectCtx;
  const repChar = (cardId: string): SceneCharacter =>
    ({ ...sceneChar(cardId, 'x#1::disguise-replaced') });

  it('unit: filter{lpMin:2, color:白} — REP_W2 一致 / REP_K1 (黒lp1) 不一致 / replacedChar 不在 false', () => {
    const s = createEmptyGameState();
    const cond = { kind: 'disguiseReplacedMatches', filter: { lpMin: 2, color: '白' } } as never;
    expect(evalCond(s, cond, ctxOf({ player: 'self', replacedChar: repChar('REP_W2') }))).toBe(true);
    expect(evalCond(s, cond, ctxOf({ player: 'self', replacedChar: repChar('REP_K1') }))).toBe(false);
    expect(evalCond(s, cond, ctxOf({ player: 'self' }))).toBe(false);
  });

  it('unit: sentinel uid 汚染防止 — scene の同素 uid キャラの継続 buff が混入しない', () => {
    const s = createEmptyGameState();
    // scene に lpDelta+10 持ちの新カードを 'x#1' で配置。snapshot uid は 'x#1::disguise-replaced' → miss
    registerCardDef(mkChar('BUFFED', {
      lp: 1,
      abilities: [{ id: 'a1', type: 'continuous', scope: 'on-scene', continuousModifier: { lpDelta: 10 } as never, description: '', ruleRefs: [] } as never],
    }));
    s.players.self.scene = [sceneChar('BUFFED', 'x#1')];
    const cond = { kind: 'disguiseReplacedMatches', filter: { lpMin: 2 } } as never;
    // snapshot は素の REP_K1 (lp1)。新カードの継続 +10 が混入すると誤 true になる
    expect(evalCond(s, cond, ctxOf({ player: 'self', replacedChar: repChar('REP_K1') }))).toBe(false);
  });

  it('integration: disguise:into payload に replacedChar (cardId=fromCardId) が載る', () => {
    const s = contactBase('REP_W2', ['INCOMING_VERMOUTH']);
    const captured: unknown[] = [];
    event.on('disguise:into', (_s, payload) => { captured.push(payload); });
    produce(s, (d) => { disguise(d, makeAx(), 'self', 'INCOMING_VERMOUTH'); });
    const pl = captured[0] as { replacedChar?: SceneCharacter };
    expect(pl.replacedChar?.cardId).toBe('REP_W2');
    expect(pl.replacedChar?.uid).toContain('::disguise-replaced');
  });

  it('B02047 exemplar: LP2白と入替 → contactImmune / 黒LP1と入替 → 付与なし', () => {
    for (const [fromId, expectImmune] of [
      ['REP_W2', true], ['REP_W1_CONTINUOUS', true], ['REP_K1', false],
    ] as const) {
      _resetUidCounter();
      const s = contactBase(fromId, ['B02047']);
      if (fromId === 'REP_W1_CONTINUOUS') expect(readChar.lp(s, 'atk')).toBe(2);
      s.players.self.case.colors = ['白'];
      s.players.self.file = Array.from({ length: 6 }, () => ({ type: 'card-back' as const, cardId: 'MOB' }));
      const after = produce(s, (d) => {
        disguise(d, makeAx(), 'self', 'B02047');
        runAllUntilEmpty(d);
      });
      const ch = after.players.self.scene.find(c => c.uid === 'atk')!;
      expect(ch.cardId).toBe('B02047');
      expect(readChar.hasTextAbility(after, 'atk', 'contactImmune'), `${fromId} → immune=${expectImmune}`)
        .toBe(expectImmune);
      expect(ch.turnEffects['contactImmune_action'] === true, `${fromId} → action-scoped immune=${expectImmune}`)
        .toBe(expectImmune);
      expect(ch.turnEffects.contactImmune).toBe(false);
    }
  });
});

// ================= r12 invokeLeaveToRemoveOfCard =================

describe('r12 invokeLeaveToRemoveOfCard verb (engine-only、B08078 は DEFER)', () => {
  const invokeAtom = (cardId: string): Effect =>
    ({ kind: 'atom', verb: 'invokeLeaveToRemoveOfCard', args: { cardId, player: 'self' } }) as never;
  const srcCtx = (): EffectCtx =>
    ({ source: { cardId: 'PLAIN', uid: 'src#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} }) as EffectCtx;

  it('リムーブ中カードの【現場リムーブ時】selfOnly 効果を発動させる (draw 解決)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.remove = ['LEAVER'];
    s.players.self.deck = ['MOB', 'MOB'];
    const after = produce(s, (d) => { runEffect(d, invokeAtom('LEAVER'), srcCtx()); runAllUntilEmpty(d); });
    expect(after.players.self.hand.length, 'LEAVER の draw1 発動').toBe(1);
  });

  it('盤面 observer (非 selfOnly leave:to-remove) は誤発火しない', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('LEAVE_OBSERVER', 'obs#1')];
    s.players.self.remove = ['PLAIN']; // 【現場リムーブ時】を持たないカードを invoke
    s.players.self.deck = ['MOB', 'MOB'];
    const after = produce(s, (d) => { runEffect(d, invokeAtom('PLAIN'), srcCtx()); runAllUntilEmpty(d); });
    expect(after.players.self.hand.length, 'observer 不発 + 対象能力なし = 何も起きない').toBe(0);
  });

  it('ability.condition honor: 【相手ターン中】条件は自ターン invoke で不発 (B08078 Q&A「有効でない効果は発動できるが何も起こらない」)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.remove = ['LEAVER_OPPTURN'];
    s.players.self.deck = ['MOB', 'MOB'];
    const after = produce(s, (d) => { runEffect(d, invokeAtom('LEAVER_OPPTURN'), srcCtx()); runAllUntilEmpty(d); });
    expect(after.players.self.hand.length, '条件不成立 → 効果なし').toBe(0);
  });

  it('未登録 cardId は silent no-op', () => {
    const s = createEmptyGameState();
    s.players.self.deck = ['MOB'];
    const after = produce(s, (d) => { runEffect(d, invokeAtom('UNKNOWN_XYZ'), srcCtx()); runAllUntilEmpty(d); });
    expect(after.players.self.hand.length).toBe(0);
  });
});

// ================= r17 hand:removed + triggerByPlayerIs =================

describe('r17 hand:removed hook + triggerByPlayerIs', () => {
  it('相手効果による discard → hand:removed emit (byPlayer=相手) → observer 発火', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('HAND_OBS', 'obs#1')];
    s.players.self.hand = ['MOB'];
    s.players.self.deck = ['PLAIN', 'PLAIN'];
    // opp の効果が self の手札をリムーブ (B01077 型 discardRandom = 出荷済の相手手札リムーブ経路。
    // args.player/side は source 相対 — 'opp' = source(opp) の相手 = self)
    const oppCtx: EffectCtx = { source: { cardId: 'PLAIN', uid: 'opp#1', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} } as EffectCtx;
    const after = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'discardRandom', args: { player: 'opp', n: 1 } } as never, oppCtx);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, 'MOB discard 済 + HAND_OBS draw1').toBe(1);
    expect(after.players.self.remove).toContain('MOB');
  });

  it('自分効果による discard → triggerByPlayerIs side:opp 不成立 → 不発', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('HAND_OBS', 'obs#1')];
    s.players.self.hand = ['MOB'];
    s.players.self.deck = ['PLAIN', 'PLAIN'];
    const selfCtx: EffectCtx = { source: { cardId: 'PLAIN', uid: 'self#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const after = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } } as never, selfCtx);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, 'discard のみ、draw なし').toBe(0);
  });

  it('rules/21: 宣言コスト (removeFromHand viaCost) では emit しない', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('HAND_OBS', 'obs#1')];
    s.players.self.hand = ['MOB'];
    s.players.self.deck = ['PLAIN', 'PLAIN'];
    let fired = 0;
    event.on('hand:removed', () => { fired += 1; });
    const selfCostCtx: EffectCtx = { source: { cardId: 'PLAIN', uid: 'self#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    produce(s, (d) => {
      pay(d, { kind: 'removeFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 } as never, selfCostCtx);
    });
    expect(fired, 'viaCost は emit 抑止').toBe(0);
  });

  it('sceneEnter sourceRequired: 対象がリムーブに無ければ登場しない (B05115 Q&A)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.remove = []; // 不在
    const ctx: EffectCtx = { source: { cardId: 'PLAIN', uid: 'x#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const after = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'sceneEnter', args: { player: 'self', cardId: 'PLAIN', viaEffect: true, sourceRequired: true, target: { query: { area: 'remove', side: 'self' } } } } as never, ctx);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.scene.length, '不在 → 登場しない').toBe(0);
  });
});

describe('B05115 exemplar (human optional 経路)', () => {
  function stage(): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.hand = ['B05115'];
    s.players.self.deck = ['MOB', 'MOB'];
    return s;
  }

  it('相手ターン + 相手効果で手札の B05115 リムーブ → optional opt-in で自身をリムーブから登場', () => {
    setHuman('self');
    const s = stage();
    const oppCtx: EffectCtx = { source: { cardId: 'PLAIN', uid: 'opp#1', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'discardRandom', args: { player: 'opp', n: 1 } } as never, oppCtx);
      runAllUntilEmpty(d);
    });
    expect(mid.players.self.remove).toContain('B05115');
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional, 'optional surface').not.toBeNull();
    const r = dispatchCurrentDecision({ type: 'optionalResolve', run: true });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.some(c => c.cardId === 'B05115'), 'リムーブから登場').toBe(true);
    expect(after.players.self.remove).not.toContain('B05115');
  });

  it('Q&A: 解決前にリムーブエリアを離れていたら登場できない', () => {
    setHuman('self');
    const s = stage();
    const oppCtx: EffectCtx = { source: { cardId: 'PLAIN', uid: 'opp#1', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'discardRandom', args: { player: 'opp', n: 1 } } as never, oppCtx);
      runAllUntilEmpty(d);
    });
    // 解決前にリムーブから離す (リフレッシュ相当)
    // qa: card:B05115:5171672c0eaee3a84dded05fce799e16ccd57911a1397e87474850f57dac45d2
    const gone = produce(mid, (d) => { d.players.self.remove = d.players.self.remove.filter(id => id !== 'B05115'); });
    useGameStateStore.getState().setGameState(gone);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional, 'optional surface').not.toBeNull();
    const r = dispatchCurrentDecision({ type: 'optionalResolve', run: true });
    expect(r.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.some(c => c.cardId === 'B05115'), '登場しない (sourceRequired)').toBe(false);
  });

  it('自分ターン (【相手ターン中】不成立) は発火しない', () => {
    setHuman('self');
    const s = stage();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    const oppCtx: EffectCtx = { source: { cardId: 'PLAIN', uid: 'opp#1', abilityId: 'a1', player: 'opp', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'discardRandom', args: { player: 'opp', n: 1 } } as never, oppCtx);
      runAllUntilEmpty(d);
    });
    expect(mid.players.self.remove, 'discard 自体は成立').toContain('B05115');
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional ?? null, 'optional surface しない').toBeNull();
  });
});

// ================= r18 hand:reveal + triggerRevealMatches =================

describe('r18 hand:reveal hook + triggerRevealMatches', () => {
  it('handReveal atom → emit → observer (cardName any-match) 発火 / 非該当名は不発', () => {
    for (const [revealed, expectFire] of [['SHINICHI', true], ['MOB', false]] as const) {
      _resetUidCounter(); _clearPendingEffectPickQueue();
      const s = createEmptyGameState();
      s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
      s.players.self.scene = [sceneChar('REVEAL_OBS', 'obs#1')];
      s.players.self.hand = [revealed];
      s.players.self.deck = ['PLAIN', 'PLAIN'];
      const ctx: EffectCtx = { source: { cardId: 'PLAIN', uid: 'x#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
      const after = produce(s, (d) => {
        runEffect(d, { kind: 'atom', verb: 'handReveal', args: { player: 'self', target: [revealed] } } as never, ctx);
        runAllUntilEmpty(d);
      });
      expect(after.players.self.hand.length, `${revealed} → fire=${expectFire} (zone 不変 + draw)`).toBe(expectFire ? 2 : 1);
    }
  });

  it('revealFromHand cost 経路でも emit (B09004「【宣言】能力のコストによって」)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('REVEAL_OBS', 'obs#1')];
    s.players.self.hand = ['SHINICHI'];
    s.players.self.deck = ['PLAIN', 'PLAIN'];
    let fired = 0;
    event.on('hand:reveal', () => { fired += 1; });
    const ctx: EffectCtx = { source: { cardId: 'PLAIN', uid: 'x#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    produce(s, (d) => {
      pay(d, { kind: 'revealFromHand', target: { kind: 'pick', query: { area: 'hand', side: 'self' }, n: { min: 1, max: 1 }, chooser: 'self' }, n: 1 } as never, ctx);
    });
    expect(fired, 'cost 経路も emit (カード側が cost 由来を明記して拾う)').toBe(1);
  });
});

describe('B09004 exemplar (human optional 経路)', () => {
  function stage(): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.scene = [sceneChar('B09004', 'ran#1'), sceneChar('KYOGOKU_SHINICHI', 'shin#1')];
    s.players.self.hand = ['SHINICHI', 'MOB'];
    s.players.self.deck = ['PLAIN', 'PLAIN'];
    const v7 = sceneChar('PLAIN', 'victim#1'); // lv3 ≤ 7
    s.players.opp.scene = [v7];
    return s;
  }

  it('突撃 keyword + 手札公開 (工藤新一) → optional opt-in → 手札1枚リムーブ → lv7以下1枚リムーブ', () => {
    setHuman('self');
    const s = stage();
    expect(B09004.keywords).toContain('突撃');
    const ctx: EffectCtx = { source: { cardId: 'PLAIN', uid: 'x#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    const mid = produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'handReveal', args: { player: 'self', target: ['SHINICHI'] } } as never, ctx);
      runAllUntilEmpty(d);
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    expect(useGameStateStore.getState().pendingEffectOptional, 'optional surface').not.toBeNull();
    const r = dispatchCurrentDecision({ type: 'optionalResolve', run: true });
    expect(r.ok).toBe(true);
    // 手札 discard pick → 2枚から1枚 (human pick surface)
    const pend1 = useGameStateStore.getState().pendingEffectPick;
    expect(pend1?.atomVerb).toBe('discard');
    const r2 = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pend1!.candidates[0]!.uid });
    expect(r2.ok).toBe(true);
    // lv7以下 sceneRemove pick
    const pend2 = useGameStateStore.getState().pendingEffectPick;
    expect(pend2?.atomVerb).toBe('sceneRemove');
    const victim = pend2!.candidates.find(c => c.uid === 'victim#1');
    expect(victim, 'lv3 victim が候補').toBeDefined();
    const r3 = dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: victim!.uid });
    expect(r3.ok).toBe(true);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand.length, '公開2枚のうち1枚リムーブ').toBe(1);
    expect(after.players.opp.scene.some(c => c.uid === 'victim#1'), 'victim リムーブ').toBe(false);
  });

  it('絆不成立 (工藤新一が現場に居ない) → 発火しない', () => {
    setHuman('self');
    const s = stage();
    s.players.self.scene = [sceneChar('B09004', 'ran#1')]; // 絆なし
    const ctx: EffectCtx = { source: { cardId: 'PLAIN', uid: 'x#1', abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as EffectCtx;
    produce(s, (d) => {
      runEffect(d, { kind: 'atom', verb: 'handReveal', args: { player: 'self', target: ['SHINICHI'] } } as never, ctx);
      runAllUntilEmpty(d);
    });
    expect((globalThis as { __pendingEffectOptionalSide?: unknown }).__pendingEffectOptionalSide ?? null).toBeNull();
  });
});
