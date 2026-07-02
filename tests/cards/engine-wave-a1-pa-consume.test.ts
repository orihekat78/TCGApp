// engine wave A1 — partnerAreaRemove verb + PA-read sceneHas (G39 PA 計数・消費、wave-12 の直接継続)
//
// 新 primitive:
//   · atom verb 'partnerAreaRemove' — PA 一般カード枠 (partnerAreaCards, wave-12) から filter 一致 N 枚
//     選びリムーブ (mutate.partner.removeAreaCardsToRemove)。atomHandReveal の clone に zone 変化を追加。
//     短縮形 n:N = exact-N gate (PA 候補 < N → chainStepNoApply で「そうした場合」chain break)。
//   · PA-read = engine 変更0。既存 sceneHas が candidates(query area:'partner-area') 経由で PA を列挙する。
//
// exemplar:
//   · B07037 黒羽快斗 — 【登場時】optional{chain[partnerAreaRemove n:2 (ビッグジュエル), sceneEnter from:remove
//     (中森青子 Lv6以下 sleep)]}。
//   · B07045 セリザベス女王 — ミスリード1 + ターン終了時 PA に[ビッグジュエル]あれば自身 active
//     (conditional{sceneHas area:'partner-area'})。
//
// 検証: §A runAtom 直接 (pre-resolved target) / §B mutate 直接 (lastIndexOf・不在 skip) /
//       §C exact-N gate (chainStepNoApply) / §D PA-read Condition (evalCond、partner singleton 除外) /
//       §E B07037 e2e (enter→optional run→2枚除去→revive) / §F B07037 <2枚 gate (revive せず) /
//       §G B07045 turn-end (PA jewel 有→active / 無→sleep) / §H 登録。
// rules: 03-field-areas.md (§PA), 15-abilities-effects.md (§「そうした場合」), 17-icons.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { _peekPendingEffectOptionalSide, _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingHirameki } from '@/engine/listeners/hirameki';
import { mutate } from '@/engine/mutate/index';
import { evalCond } from '@/engine/cond/eval';
import { sceneChar, makeCtx } from '../helpers/fixtures';
import { B07037 } from '@/cards/ct-p07/B07037';
import { B07045 } from '@/cards/ct-p07/B07045';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };
const ch = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 2, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
// ctx: PA-remove の owner 解決は ctx.source.player
const ectx = (player: 'self' | 'opp' = 'self'): EffectCtx =>
  makeCtx({ source: { player, cardId: 'B07037', abilityId: 'a1', uid: `x:${player}` } as EffectCtx['source'], bindings: {}, dyn: {} } as Partial<EffectCtx>);

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  setHuman(null);
  resetDefRegistry();
  registerAll();
  // ビッグジュエル カード (PA 常駐)・中森青子 (revive 対象)・decoy
  registerCardDef(ch('JEWEL1', { names: ['ビッグジュエル1'], traits: ['ビッグジュエル'], kind: 'character', level: 3 }));
  registerCardDef(ch('JEWEL2', { names: ['ビッグジュエル2'], traits: ['ビッグジュエル'], kind: 'character', level: 3 }));
  registerCardDef(ch('AOKO', { names: ['中森青子'], colors: ['白'], level: 4 }));
  registerCardDef(ch('AOKO9', { names: ['中森青子'], colors: ['白'], level: 9 })); // Lv9 = filter 外 decoy
  registerCardDef(ch('OTHER', { names: ['他'], colors: ['緑'] }));
  registerCardDef({ ...ch('PW'), kind: 'partner', names: ['白パートナー'], colors: ['白'], lp: 2, ap: undefined });
  registerTriggeredListener();
  _drainPendingHirameki();
});

describe('§A partnerAreaRemove — runAtom 直接 (pre-resolved target)', () => {
  it('A1 target 指定の cardIds を PA から remove へ移す', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.partnerAreaCards = ['JEWEL1', 'JEWEL2', 'OTHER'];
    });
    const ctx = ectx();
    const after = produce(s0, (d) => {
      runAtom(d, 'partnerAreaRemove', { player: 'self', target: ['JEWEL1', 'JEWEL2'], bind: '$removed' }, ctx);
    });
    expect(after.players.self.partnerAreaCards).toEqual(['OTHER']); // jewel 2枚除去、OTHER 残る
    expect([...after.players.self.remove].sort()).toEqual(['JEWEL1', 'JEWEL2']);
    expect(ctx.bindings.$removed).toEqual([{ cardId: 'JEWEL1' }, { cardId: 'JEWEL2' }]); // bind
  });

  it('A2 opp 側: owner = ctx.source.player (self PA は不変)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.opp.partnerAreaCards = ['JEWEL1'];
      d.players.self.partnerAreaCards = ['JEWEL1']; // decoy
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'partnerAreaRemove', { player: 'self', target: ['JEWEL1'] }, ectx('opp'));
    });
    expect(after.players.opp.partnerAreaCards).toEqual([]);
    expect(after.players.opp.remove).toEqual(['JEWEL1']);
    expect(after.players.self.partnerAreaCards).toEqual(['JEWEL1']); // self 不変
  });
});

describe('§B mutate.partner.removeAreaCardsToRemove — 直接', () => {
  it('B1 lastIndexOf: 同 cardId 複数は末尾から', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partnerAreaCards = ['JEWEL1', 'OTHER', 'JEWEL1'];
      mutate.partner.removeAreaCardsToRemove(d, 'self', ['JEWEL1']);
    });
    expect(after.players.self.partnerAreaCards).toEqual(['JEWEL1', 'OTHER']); // 末尾の JEWEL1 が抜ける
    expect(after.players.self.remove).toEqual(['JEWEL1']);
  });

  it('B2 不在 cardId は skip (crash せず)', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.players.self.partnerAreaCards = ['OTHER'];
      mutate.partner.removeAreaCardsToRemove(d, 'self', ['JEWEL1']);
    });
    expect(after.players.self.partnerAreaCards).toEqual(['OTHER']);
    expect(after.players.self.remove).toEqual([]);
  });

  it('B3 PA 未初期化 (undefined) → no-op', () => {
    const after = produce(createEmptyGameState(), (d) => {
      mutate.partner.removeAreaCardsToRemove(d, 'self', ['JEWEL1']);
    });
    expect(after.players.self.partnerAreaCards ?? []).toEqual([]);
    expect(after.players.self.remove).toEqual([]);
  });
});

describe('§C exact-N gate — 短縮形 n:2', () => {
  it('C1 PA jewel 1枚 (< n:2) → chainStepNoApply、除去せず', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.partnerAreaCards = ['JEWEL1', 'OTHER']; // jewel は 1枚のみ
    });
    const ctx = ectx();
    const after = produce(s0, (d) => {
      runAtom(d, 'partnerAreaRemove', { player: 'self', n: 2, filter: { trait: 'ビッグジュエル' } }, ctx);
    });
    expect(ctx.dyn?.chainStepNoApply).toBe(true); // gate 発火
    expect(after.players.self.partnerAreaCards).toEqual(['JEWEL1', 'OTHER']); // 不変
    expect(after.players.self.remove).toEqual([]);
  });

  it('C2 PA jewel 2枚 (= n:2) → gate せず (pick へ = chainStepNoApply false)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.partnerAreaCards = ['JEWEL1', 'JEWEL2'];
    });
    const ctx = ectx();
    produce(s0, (d) => {
      runAtom(d, 'partnerAreaRemove', { player: 'self', n: 2, filter: { trait: 'ビッグジュエル' } }, ctx);
    });
    expect(ctx.dyn?.chainStepNoApply).toBeFalsy(); // 候補足りる → gate せず pick await
  });
});

describe('§D PA-read — sceneHas area:partner-area (engine0)', () => {
  const cond = { kind: 'sceneHas', query: { area: 'partner-area', side: 'self', filter: { trait: 'ビッグジュエル' } }, nMin: 1 } as never;
  it('D1 PA に jewel あり → true', () => {
    const s = produce(createEmptyGameState(), (d) => { d.players.self.partnerAreaCards = ['JEWEL1']; });
    expect(evalCond(s, cond, makeCtx({ source: { player: 'self' } }))).toBe(true);
  });
  it('D2 PA に jewel なし → false', () => {
    const s = produce(createEmptyGameState(), (d) => { d.players.self.partnerAreaCards = ['OTHER']; });
    expect(evalCond(s, cond, makeCtx({ source: { player: 'self' } }))).toBe(false);
  });
  it('D3 partner singleton は trait 非一致で計数されない (PW=白パートナー、jewel 無し)', () => {
    const s = produce(createEmptyGameState(), (d) => { d.players.self.partner.cardId = 'PW'; });
    expect(evalCond(s, cond, makeCtx({ source: { player: 'self' } }))).toBe(false);
  });
});

describe('§E B07037 e2e — 【登場時】optional run → 2枚除去 → revive', () => {
  function fire(paCards: string[], removeCards: string[]): GameState {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B07037', 'kk0', { state: 'active' })];
    s.players.self.partnerAreaCards = paCards;
    s.players.self.remove = removeCards;
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'kk0', viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'B07037', uid: 'kk0' });
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true); // 「する」
      for (let i = 0; i < 6; i++) { _drainAllEffectPicksForTest(d); runAllUntilEmpty(d); }
    });
    return s;
  }

  it('E1 jewel 2枚 + remove に中森青子: 2枚除去 → 中森青子が sleep 登場', () => {
    const s = fire(['JEWEL1', 'JEWEL2'], ['AOKO']);
    expect(s.players.self.partnerAreaCards, 'PA jewel 2枚除去').toEqual([]);
    expect(s.players.self.remove).toContain('JEWEL1');
    expect(s.players.self.remove).toContain('JEWEL2');
    const aoko = s.players.self.scene.find((c) => c.cardId === 'AOKO');
    expect(aoko, '中森青子が登場').toBeTruthy();
    expect(aoko!.state, 'スリープ状態で登場').toBe('sleep');
    expect(s.players.self.remove, 'AOKO は remove から出た').not.toContain('AOKO');
  });

  it('E3 PA jewel 3枚 (> n:2) → 正確に2枚のみ除去 (BUG-165 collapse なし)、1枚残る', () => {
    const s = fire(['JEWEL1', 'JEWEL2', 'OTHER'].concat(['JEWEL1']), ['AOKO']);
    // PA = [JEWEL1, JEWEL2, OTHER, JEWEL1] → jewel 3枚。n:2 で 2枚のみ除去 → PA に jewel 1 + OTHER が残る。
    const paJewels = s.players.self.partnerAreaCards.filter((c) => c === 'JEWEL1' || c === 'JEWEL2');
    expect(paJewels.length, 'jewel は 3→1 (正確に2枚除去)').toBe(1);
    expect(s.players.self.partnerAreaCards, 'OTHER は非 jewel で残る').toContain('OTHER');
    const removedJewels = s.players.self.remove.filter((c) => c === 'JEWEL1' || c === 'JEWEL2');
    expect(removedJewels.length, 'remove に jewel 2枚').toBe(2);
  });

  it('E2 Lv9 中森青子は filter 外 → 登場せず (revive 候補 0 だが 2枚除去は実行)', () => {
    const s = fire(['JEWEL1', 'JEWEL2'], ['AOKO9']);
    expect(s.players.self.partnerAreaCards, 'jewel 2枚は除去済').toEqual([]);
    expect(s.players.self.scene.some((c) => c.cardId === 'AOKO9'), 'Lv9 は登場しない').toBe(false);
    expect(s.players.self.remove).toContain('AOKO9'); // remove に残る
  });
});

describe('§F B07037 — jewel < 2 で optional run しても gate (revive せず)', () => {
  it('F1 jewel 1枚 + optional run=true → exact-N gate で 2枚除去不可 → revive せず、jewel も残る', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B07037', 'kk0', { state: 'active' })];
    s.players.self.partnerAreaCards = ['JEWEL1'];
    s.players.self.remove = ['AOKO'];
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'kk0', viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'B07037', uid: 'kk0' });
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      applyOptionalAndContinuation(d, p!, true);
      for (let i = 0; i < 6; i++) { _drainAllEffectPicksForTest(d); runAllUntilEmpty(d); }
    });
    expect(s.players.self.partnerAreaCards, 'jewel 除去されない (< 2)').toEqual(['JEWEL1']);
    expect(s.players.self.scene.some((c) => c.cardId === 'AOKO'), 'revive せず').toBe(false);
    expect(s.players.self.remove).toContain('AOKO');
  });
});

describe('§G B07045 e2e — ターン終了時 PA-read で自身 active', () => {
  function endTurn(paCards: string[]): GameState {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B07045', 'sr0', { state: 'sleep' })]; // 推理でスリープ済み想定
    s.players.self.partnerAreaCards = paCards;
    s = produce(s, (d) => {
      event.emit(d, 'phase:end:start', {}, { player: 'self', cardId: 'B07045', uid: 'sr0' });
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d);
      runAllUntilEmpty(d);
    });
    return s;
  }
  it('G1 PA に jewel あり → 自身が active に戻る', () => {
    const s = endTurn(['JEWEL1']);
    expect(s.players.self.scene.find((c) => c.cardId === 'B07045')!.state).toBe('active');
  });
  it('G2 PA に jewel なし → sleep のまま', () => {
    const s = endTurn(['OTHER']);
    expect(s.players.self.scene.find((c) => c.cardId === 'B07045')!.state).toBe('sleep');
  });

  it('G3 stun 状態 + PA jewel あり → active 化効果を受けても代わりに sleep (rules/03 §スタン特殊挙動)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'end', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B07045', 'sr0', { state: 'stun' })];
    s.players.self.partnerAreaCards = ['JEWEL1'];
    s = produce(s, (d) => {
      event.emit(d, 'phase:end:start', {}, { player: 'self', cardId: 'B07045', uid: 'sr0' });
      runAllUntilEmpty(d); _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.cardId === 'B07045')!.state, 'stun→active は sleep に化ける').toBe('sleep');
  });

  it('G4 相手ターン中は発動しない (condition turn:self)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 6, player: 'opp', phase: 'end', isFirstPlayerFirstTurn: false }; // opp ターン
    s.players.self.scene = [sceneChar('B07045', 'sr0', { state: 'sleep' })];
    s.players.self.partnerAreaCards = ['JEWEL1'];
    s = produce(s, (d) => {
      event.emit(d, 'phase:end:start', {}, { player: 'self', cardId: 'B07045', uid: 'sr0' });
      runAllUntilEmpty(d); _drainAllEffectPicksForTest(d); runAllUntilEmpty(d);
    });
    expect(s.players.self.scene.find((c) => c.cardId === 'B07045')!.state, 'opp ターンでは active 化しない').toBe('sleep');
  });
});

describe('§H 登録', () => {
  it('H1 B07037 / B07045 が ALL_CARDS に登録 (registerAll 後 def 取得可)', () => {
    expect(B07037.abilities[0]!.effect.kind).toBe('optional');
    expect(B07045.abilities.length).toBe(2); // misread + turn-end
  });
});
