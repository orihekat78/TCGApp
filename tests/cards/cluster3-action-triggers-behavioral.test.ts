// cluster3 — 実カードを実 engine 経路で駆動する挙動テスト (MCP 実機 decoy の決定論版)
// 構造アサーション (cluster3-action-triggers.test.ts) + engine 機構 pin (wave2-cluster3...test.ts) に加え、
// 「実カード def が engine に正しく配線され、decoy 条件下で 1対1 に発火/非発火するか」を検証する。
// rules: 07/10/15/22 + TSV qAndA

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { declare, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { actionCase } from '@/engine/flow/action-case';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { makeChar } from '../helpers/fixtures';
import type { CardDef, GameState, ActionContext } from '@/engine/types';
import { B01036 } from '@/cards/ct-p01/B01036';
import { B08048 } from '@/cards/ct-p08/B08048';
import { B08012 } from '@/cards/ct-p08/B08012';
import { B01067 } from '@/cards/ct-p01/B01067';
import { PR086 } from '@/cards/pr-01/PR086';

// 汎用 decoy def (色/レベル可変)
function plain(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function base(): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.players.self.partner = { cardId: 'P-self', state: 'active', location: 'partner-area' };
  s.players.opp.partner = { cardId: 'P-opp', state: 'active', location: 'partner-area' };
  s.players.self.case = { cardId: 'cs', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
  s.players.opp.case = { cardId: 'co', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} };
  s.players.self.deck.push('d1', 'd2', 'd3', 'd4', 'd5');
  s.players.opp.deck.push('e1', 'e2', 'e3');
  // rules/07: 証拠が1つもない事件は action[事件] の対象外 → case アクションを合法化するため相手証拠を1つ置く
  s.players.opp.evidence.push({ cardId: 'ev-opp', faceUp: false, origin: { turn: 1, via: 'action-case' } });
  s.turn = { number: 2, player: 'self' } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetActionContexts();
});

describe('B01036 (実カード): 自分の緑キャラの action[キャラ] で対象スリープ、decoy 非発火', () => {
  function setup() {
    registerCardDef(B01036);
    registerCardDef(plain('GRN', { colors: ['緑'] }));
    registerCardDef(plain('RED', { colors: ['赤'] }));
    registerCardDef(plain('TGT'));
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-b01036', cardId: 'B01036', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-grn', cardId: 'GRN', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-red', cardId: 'RED', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'u-tgt', cardId: 'TGT', state: 'sleep' }));
    return s;
  }
  it('緑キャラ (u-grn) が opp を action[キャラ] → スリープ pick が立つ', () => {
    const s = setup();
    const after = produce(s, (d) => {
      declare(d, 'u-grn', { kind: 'char', uid: 'u-tgt' });
      runAllUntilEmpty(d);
    });
    // sceneSetState sleep の pick が queue される (max1)
    expect(after.pendingEffects.length + ((globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue?.length ?? 0)).toBeGreaterThan(0);
  });
  it('赤キャラ (u-red) の action では非発火 (color filter)', () => {
    const s = setup();
    (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue = [];
    const after = produce(s, (d) => {
      declare(d, 'u-red', { kind: 'char', uid: 'u-tgt' });
      runAllUntilEmpty(d);
    });
    expect(after.pendingEffects).toHaveLength(0);
    expect((globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue?.length ?? 0).toBe(0);
  });
  it('緑キャラの action[事件] では非発火 (subtype filter)', () => {
    const s = setup();
    (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue = [];
    const after = produce(s, (d) => {
      declare(d, 'u-grn', { kind: 'case', player: 'opp' });
      runAllUntilEmpty(d);
    });
    expect(after.pendingEffects).toHaveLength(0);
    expect((globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue?.length ?? 0).toBe(0);
  });
});

describe('B08048 (実カード): action[キャラ] で対象レベル-1 + 修正後 Lv6以下なら自分 AP+3000', () => {
  function setup(tgtLevel: number) {
    registerCardDef(B08048);
    registerCardDef(plain('TGT', { level: tgtLevel }));
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-cam', cardId: 'B08048', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'u-tgt', cardId: 'TGT', state: 'sleep' }));
    return s;
  }
  it('Lv7 対象 → -1で6 → conditional 成立 → 自分(B08048 ap 5000) +3000 = 8000', () => {
    const s = setup(7);
    const after = produce(s, (d) => {
      declare(d, 'u-cam', { kind: 'char', uid: 'u-tgt' });
      runAllUntilEmpty(d);
    });
    expect(read.char.level(after, 'u-tgt')).toBe(6);
    expect(read.char.ap(after, 'u-cam')).toBe(8000);
  });
  it('Lv8 対象 → -1で7 → conditional 不成立 → AP 不変 5000', () => {
    const s = setup(8);
    const after = produce(s, (d) => {
      declare(d, 'u-cam', { kind: 'char', uid: 'u-tgt' });
      runAllUntilEmpty(d);
    });
    expect(read.char.level(after, 'u-tgt')).toBe(7);
    expect(read.char.ap(after, 'u-cam')).toBe(5000);
  });
});

describe('B08012 / B01067 (実カード): evidence:gain (action[事件] 由来) で発火', () => {
  const AX = (uid: string) => ({ id: 'ax', byUid: uid, byPlayer: 'self', target: { kind: 'case', player: 'opp' }, phase: 'judge' }) as ActionContext;

  it('B08012: 自身の action[事件] で証拠獲得 → 1ドロー (selfOnly)', () => {
    registerCardDef(B08012);
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-hibiki', cardId: 'B08012', state: 'sleep' }));
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      actionCase.gainSelfEvidence(d, AX('u-hibiki'));
      runAllUntilEmpty(d);
    });
    expect(after.players.self.evidence.length).toBe(1);
    expect(after.players.self.hand.length).toBe(before + 1); // draw1
  });

  it('B08012: 別キャラの action[事件] では発火しない (selfOnly)', () => {
    registerCardDef(B08012);
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-hibiki', cardId: 'B08012', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-other', cardId: 'P-self', state: 'sleep' }));
    const before = s.players.self.hand.length;
    const after = produce(s, (d) => {
      actionCase.gainSelfEvidence(d, AX('u-other'));
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length).toBe(before); // u-hibiki は発火しない
  });

  it('B01067: 自身の action[事件] で証拠獲得 → 相手 Lv5以下を手札へ pick', () => {
    registerCardDef(B01067);
    registerCardDef(plain('LOW', { level: 5 }));
    registerCardDef(plain('HIGH', { level: 6 }));
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-mary', cardId: 'B01067', state: 'sleep' }));
    s.players.opp.scene.push(makeChar({ uid: 'u-low', cardId: 'LOW', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'u-high', cardId: 'HIGH', state: 'active' }));
    const after = produce(s, (d) => {
      actionCase.gainSelfEvidence(d, AX('u-mary'));
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d);
    });
    // Lv5 (u-low) が相手手札へ移動、Lv6 (u-high) は filter で候補外 (現場に残る)
    expect(after.players.opp.scene.some((c) => c.uid === 'u-low')).toBe(false);
    expect(after.players.opp.scene.some((c) => c.uid === 'u-high')).toBe(true);
    expect(after.players.opp.hand.includes('LOW')).toBe(true);
  });
});

describe('PR086 (実カード): action:end で発火、actor 離場時は非発火', () => {
  function setup() {
    registerCardDef(PR086);
    registerTriggeredListener();
    const s = base();
    s.players.self.scene.push(makeChar({ uid: 'u-date', cardId: 'PR086', state: 'sleep' }));
    return s;
  }
  function emitEnd(s: GameState) {
    return produce(s, (d) => {
      event.emit(d, 'action:end', { byUid: 'u-date', result: 'completed' }, { player: 'self', uid: 'u-date' });
    });
  }
  it('actor が現場に居る → optional が queue される', () => {
    const after = emitEnd(setup());
    expect(after.pendingEffects.length).toBeGreaterThan(0);
  });
  it('actor が現場を離れている → 非発火 (in-play scan、qAndA)', () => {
    const s = setup();
    s.players.self.scene = s.players.self.scene.filter((c) => c.uid !== 'u-date');
    expect(emitEnd(s).pendingEffects).toHaveLength(0);
  });
});
