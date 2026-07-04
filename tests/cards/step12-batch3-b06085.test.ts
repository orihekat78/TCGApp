// CARD PHASE step12 batch3 probe — B06085 松田陣平 + engine touch-up evidenceGain faceUp
//
// rules: 01 (証拠), 10 (ヒラメキ), 15 (「〜まで」=0可 / 逐次解決), 17 (【パートナー黄】【ターン1】),
//        18 (MR① 証拠→PA redirect、B06085 公式Q&A), 21 (【スリープ】cost)
//
// 検証面: 第2gate 再certify (全句 engine 実測)。宣言経路は production dispatch
// (activateDeclaredAbility + runAllUntilEmpty) — BUG-171 教訓 (queue 境界を踏む)。

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
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canPay } from '@/engine/cost/index';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { resolveEffectPicks } from '@/engine/effect/resolve-picks';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

import { B06085 } from '@/cards/ct-p06/B06085';

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = s; };

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});

// faceUp probe 用 fixture: 【登場時】相手はデッキ上から1枚**表向き**で証拠として得る
const FACEUP_PROBE: CardDef = mkChar('FACEUP_PROBE', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'atom', verb: 'evidenceGain', args: { player: 'opp', n: 1, faceUp: true } },
    description: 'probe', ruleRefs: [],
  }],
});
// 既定 (faceUp 未指定) は裏向きのまま — 既存挙動 pin
const FACEDOWN_PROBE: CardDef = mkChar('FACEDOWN_PROBE', {
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'atom', verb: 'evidenceGain', args: { player: 'opp', n: 1 } },
    description: 'probe', ruleRefs: [],
  }],
});

const FIXTURES: CardDef[] = [
  FACEUP_PROBE, FACEDOWN_PROBE, B06085,
  mkChar('MOB8K', { ap: 8000 }),
  mkChar('AP9K', { ap: 9000 }),
  mkChar('MR8K', { ap: 8000, rarity: 'MR' }),
  mkChar('YPARTNER', { colors: ['黄'] }),
  mkChar('BPARTNER', { colors: ['青'] }),
];

function baseState(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['MOB8K', 'MOB8K', 'MOB8K'];
  s.players.opp.deck = ['MOB8K', 'MOB8K', 'MOB8K'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  setHuman(null);
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
});

function enterAndDrain(s0: GameState, cardId: string, player: 'self' | 'opp'): GameState {
  return produce(s0, (d) => {
    const c = mutateAll.scene.enter(d, player, cardId, {});
    event.emit(d, 'enter', { uid: c.uid, player, enterOrder: 1, enterOrderThisTurn: 1 }, { player, cardId: c.cardId, uid: c.uid });
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });
}

// ============== engine touch-up — evidenceGain faceUp arg ==============
describe('engine touch-up — evidenceGain faceUp (B06085 第3句)', () => {
  it('faceUp:true → 相手はデッキ上から1枚**表向き**で証拠として得る', () => {
    const after = enterAndDrain(baseState(), 'FACEUP_PROBE', 'self');
    expect(after.players.opp.evidence.length, '相手証拠 +1').toBe(1);
    expect(after.players.opp.evidence[0].faceUp, '表向き').toBe(true);
    expect(after.players.opp.deck.length, '相手デッキ -1').toBe(2);
  });
  it('faceUp 未指定 → 裏向き (既存挙動 pin)', () => {
    const after = enterAndDrain(baseState(), 'FACEDOWN_PROBE', 'self');
    expect(after.players.opp.evidence.length).toBe(1);
    expect(after.players.opp.evidence[0].faceUp, '裏向きのまま').toBe(false);
  });
});

// ============== B06085 a1 — 宣言 production dispatch (BUG-171 教訓: queue 境界を踏む) ==============
describe('B06085 a1 — 【パートナー黄】【宣言】【ターン1】【スリープ】', () => {
  function board(over: { partnerCardId?: string } = {}) {
    const s = baseState();
    s.players.self.partner.cardId = over.partnerCardId ?? 'YPARTNER'; // partnerColor は def 色参照
    const matsuda = mutateAll.scene.enter(s, 'self', 'B06085', {});
    return { s, matsuda };
  }
  function activateAndDrain(s0: GameState, uid: string): GameState {
    return produce(s0, (d) => {
      activateDeclaredAbility(d, uid, 'a1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
  }

  it('パートナー黄でない → 宣言不可 / 黄 → 宣言可 (rules/17 条件外は能力を持たない扱い)', () => {
    const blue = board({ partnerCardId: 'BPARTNER' });
    expect(canDeclaredAbility(blue.s, blue.matsuda.uid, 'a1'), '青パートナー → 不可').toBe(false);
    const yellow = board();
    expect(canDeclaredAbility(yellow.s, yellow.matsuda.uid, 'a1'), '黄パートナー → 可').toBe(true);
  });
  it('self が sleep → cost 支払不可 (rules/21 一部でも行えなければ使用不可)', () => {
    const { s, matsuda } = board();
    const ctx = { source: { player: 'self', uid: matsuda.uid, cardId: 'B06085', abilityId: 'a1' }, bindings: {} } as unknown as EffectCtx;
    expect(canPay(s, { kind: 'sleepSelf' }, ctx), 'active → 支払可').toBe(true);
    mutateAll.scene.setState(s, matsuda.uid, 'sleep');
    expect(canPay(s, { kind: 'sleepSelf' }, ctx), 'sleep → 支払不可').toBe(false);
  });
  it('非MR (AP8000) を選択 → 相手証拠に表向きで移動 + 追加 gain なし / AP9K は候補外', () => {
    const { s, matsuda } = board();
    s.players.opp.evidence = [{ cardId: 'EV1', faceUp: false, origin: { turn: 1, via: 'effect' } }];
    mutateAll.scene.enter(s, 'opp', 'MOB8K', {});
    mutateAll.scene.enter(s, 'opp', 'AP9K', {});
    const oppDeck0 = s.players.opp.deck.length;
    const after = activateAndDrain(s, matsuda.uid);
    // cost: self sleep
    const self0 = after.players.self.scene.find(c => c.cardId === 'B06085');
    expect(self0?.state, '【スリープ】cost').toBe('sleep');
    // step1: 相手証拠 1 → 相手デッキ下 (AI greedy pick)
    expect(after.players.opp.evidence.some(e => e.cardId === 'EV1'), 'EV1 は証拠から離脱').toBe(false);
    expect(after.players.opp.deck[after.players.opp.deck.length - 1], 'EV1 は相手デッキ最下').toBe('EV1');
    // step2: MOB8K (AP8000以下) が相手証拠へ表向き / AP9K は残存
    const gained = after.players.opp.evidence.find(e => e.cardId === 'MOB8K');
    expect(gained, 'MOB8K が相手の証拠に').toBeTruthy();
    expect(gained?.faceUp, '表向きのまま').toBe(true);
    expect(after.players.opp.scene.some(c => c.cardId === 'AP9K'), 'AP9K (AP8000超) は候補外で残存').toBe(true);
    // step3: 非MR → 追加 evidenceGain 不発 (EV1 デッキ下 +1 のみ)
    expect(after.players.opp.deck.length, '追加 gain なし (EV1 分 +1 のみ)').toBe(oppDeck0 + 1);
  });
  it('MR (AP8000) を選択 → MR① で相手 PA へ + 相手はデッキ上1枚を表向きで証拠として得る', () => {
    const { s, matsuda } = board();
    mutateAll.scene.enter(s, 'opp', 'MR8K', {});
    const oppDeck0 = s.players.opp.deck.length;
    const after = activateAndDrain(s, matsuda.uid);
    // MR① redirect (公式Q&A: 証拠として得る → MR能力で PA へ)
    expect(after.players.opp.partnerAreaMR?.cardId, 'MR は相手 PA へ').toBe('MR8K');
    expect(after.players.opp.evidence.some(e => e.cardId === 'MR8K'), '証拠には残らない').toBe(false);
    // conditional boundIsMr → evidenceGain faceUp:true
    const bonus = after.players.opp.evidence[after.players.opp.evidence.length - 1];
    expect(bonus, '相手が証拠 1 獲得').toBeTruthy();
    expect(bonus.faceUp, '表向きで得る').toBe(true);
    expect(after.players.opp.deck.length, '相手デッキ -1').toBe(oppDeck0 - 1);
  });
  it('両 pick とも 0枚 選択可 (「〜まで」rules/15) — 宣言は成立し発動済カウント', () => {
    const { s, matsuda } = board();
    // 相手盤面/証拠なし → pick 候補 0 で自動 skip、宣言自体は成立
    const after = activateAndDrain(s, matsuda.uid);
    expect(after.players.self.scene.find(c => c.cardId === 'B06085')?.state, 'cost は支払済').toBe('sleep');
    expect(after.players.opp.evidence.length, '証拠変動なし').toBe(0);
  });
});

// ============== BUG-174 — 短縮形 side の二重相対化 (owner='opp' で対象反転) ==============
describe('BUG-174 — CPU (owner=opp) の B06085 a1 が人間側 (self) を対象にする', () => {
  it('opp が宣言 → sceneToEvidence は self (真の相手) の現場から取る', () => {
    const s = baseState();
    s.turn.player = 'opp';
    s.players.opp.partner.cardId = 'YPARTNER';
    const matsuda = mutateAll.scene.enter(s, 'opp', 'B06085', {});
    mutateAll.scene.enter(s, 'opp', 'MOB8K', {}); // CPU 自陣の decoy (対象になってはいけない)
    mutateAll.scene.enter(s, 'self', 'AP9K', {}); // 人間側 AP8000超 decoy (filter 外)
    const human = mutateAll.scene.enter(s, 'self', 'MOB8K', {}); // 真の対象
    const after = produce(s, (d) => {
      activateDeclaredAbility(d, matsuda.uid, 'a1');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    // 人間側 MOB8K が人間側の証拠へ (所有者の証拠 = self)
    expect(after.players.self.scene.some(c => c.uid === human.uid), '人間側 MOB8K が現場を離れる').toBe(false);
    expect(after.players.self.evidence.some(e => e.cardId === 'MOB8K'), '人間側の証拠に表向きで').toBe(true);
    // CPU 自陣 decoy は残る (自陣を対象にしない)
    expect(after.players.opp.scene.filter(c => c.cardId === 'MOB8K').length, 'CPU 自陣 MOB8K 残存').toBe(1);
    expect(after.players.opp.evidence.length, 'CPU 側の証拠は増えない').toBe(0);
  });
});

// ============== B06085 a2 — 【ヒラメキ】キャラ1枚までスリープ (PR144 a2 同型) ==============
describe('B06085 a2 — ヒラメキ sleep pick', () => {
  it('証拠からアクションでリムーブ → pending 発火 → fire でキャラ 1枚 sleep', () => {
    _resetPendingHirameki();
    const s = baseState();
    const tgt = mutateAll.scene.enter(s, 'opp', 'MOB8K', {});
    expect(tgt.state).toBe('active');
    // Step 1: emit → triggered.ts が pendingHirameki side-channel に push (fire/skip は所有者選択)
    produce(s, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B06085' } }, { player: 'opp', uid: 'atk' });
    });
    const pending = _drainPendingHirameki();
    expect(pending?.cardId, 'B06085 のヒラメキが pending').toBe('B06085');
    // Step 2: fire — production hiramekiResolve と同じ resolveEffectPicks → queue → runAllUntilEmpty
    const a2 = B06085.abilities.find(a => a.id === (pending?.abilityId ?? 'a2'))!;
    const after = produce(s, (d) => {
      const ctx = {
        source: { player: 'self', cardId: 'B06085', area: 'evidence' },
        bindings: {},
        triggerPayload: { player: 'self', ev: { cardId: 'B06085' } },
      } as unknown as EffectCtx;
      const resolved = resolveEffectPicks(d, a2.effect as never, ctx, { byPlayer: 'self' });
      event.queue(d, resolved as never, { player: 'self', cardId: 'B06085' }, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B06085' } });
      runAllUntilEmpty(d);
      drainAiEffectPicks(d);
      runAllUntilEmpty(d);
    });
    expect(after.players.opp.scene.find(c => c.cardId === 'MOB8K')?.state, '選択キャラが sleep').toBe('sleep');
  });
});
