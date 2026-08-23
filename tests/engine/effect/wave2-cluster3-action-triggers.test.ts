// engine拡張 wave#2 cluster3 — action-lifecycle trigger 族 pin tests (TDD 先行)
// X9: evidence:gain emit (action-case 限定 + 実獲得時のみ + refresh guard)
// X10: TRIGGERED_HOOKS に action:end / evidence:gain 追加
// X11: triggerActionKind cond (+and 複合で JSON 純化)
// X12: scope:'action' modifier の read/filter 合算 + 清掃 2 経路
// X13: action:declare payload の flat targetUid
// X14: CPU declare-trigger drain 順序 (BUG-141 — 公式裁定: 効果もガード判定前に解決)
// X15: evidenceGain verb の refresh guard (BUG-142 — rules/14)
// rules: 07-action-flow.md, 08-contact.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md,
//        22-qa-action-contact.md, 25-qa-effects-resolution.md + TSV qAndA (_raw_cards.md)
// spec: .claude/specs/engine-wave2-action-triggers-design.md (v2)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createMainGameState as createEmptyGameState } from '../../helpers/main-game-state';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered, TRIGGERED_HOOKS } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { evalCond, CONDITION_KINDS } from '@/engine/cond/eval';
import { runAtom } from '@/engine/effect/atom-handlers';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { declare, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { actionCase } from '@/engine/flow/action-case';
import { read } from '@/engine/read/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { resolveActionAgainstChar } from '@/ai/action-resolution';
import { makeChar, makeCtx } from '../../helpers/fixtures';
import type { CardDef, AbilityDef, GameState, ActionContext, Condition, Effect } from '@/engine/types';

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function defWith(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9999/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 3, ap: 1000, lp: 1, traits: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  };
}

/** 基本盤面: self 攻撃役 (active) + opp 対象 (sleep) + opp ガード候補 (active) + partner/case */
function makeBoard(): { s: GameState; atkUid: string; tgtUid: string; guardUid: string } {
  _resetUidCounter();
  const s = createEmptyGameState();
  const atkUid = 'u-atk'; const tgtUid = 'u-tgt'; const guardUid = 'u-guard';
  s.players.self.scene.push(makeChar({ uid: atkUid, cardId: 'ATK', state: 'active' }));
  s.players.opp.scene.push(makeChar({ uid: tgtUid, cardId: 'TGT', state: 'sleep' }));
  s.players.opp.scene.push(makeChar({ uid: guardUid, cardId: 'GRD', state: 'active' }));
  s.players.self.partner = { cardId: 'P-self', state: 'active', location: 'partner-area' };
  s.players.opp.partner = { cardId: 'P-opp', state: 'active', location: 'partner-area' };
  s.players.self.case = { cardId: 'case-self', status: '事件編', requiredEvidence: 7, colors: ['赤'], declaredUseCount: {} };
  s.players.opp.case = { cardId: 'case-opp', status: '事件編', requiredEvidence: 6, colors: ['赤'], declaredUseCount: {} };
  s.players.self.deck.push('D1', 'D2', 'D3', 'D4');
  s.turn = { number: 1, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return { s, atkUid, tgtUid, guardUid };
}

const DRAW1: Effect = { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetActionContexts();
});

// ---------------------------------------------------------------------------
// P1/X11: triggerActionKind cond — triggerPayload.target.kind 読み
// ---------------------------------------------------------------------------

describe('X11 triggerActionKind (P1)', () => {
  it('target.kind=char → v:char は true / v:case は false', () => {
    const s = createEmptyGameState();
    const ctx = makeCtx({ triggerPayload: { target: { kind: 'char', uid: 'x' } } });
    expect(evalCond(s, { kind: 'triggerActionKind', v: 'char' } as Condition, ctx)).toBe(true);
    expect(evalCond(s, { kind: 'triggerActionKind', v: 'case' } as Condition, ctx)).toBe(false);
  });
  it('target.kind=case → v:case true', () => {
    const s = createEmptyGameState();
    const ctx = makeCtx({ triggerPayload: { target: { kind: 'case', player: 'opp' } } });
    expect(evalCond(s, { kind: 'triggerActionKind', v: 'case' } as Condition, ctx)).toBe(true);
  });
  it('triggerPayload 無し / target 無し → false (発火させない安全側)', () => {
    const s = createEmptyGameState();
    expect(evalCond(s, { kind: 'triggerActionKind', v: 'char' } as Condition, makeCtx())).toBe(false);
    expect(evalCond(s, { kind: 'triggerActionKind', v: 'char' } as Condition, makeCtx({ triggerPayload: {} }))).toBe(false);
  });
  it('CONDITION_KINDS に triggerActionKind が含まれる (3点同期の union 側)', () => {
    expect(CONDITION_KINDS.has('triggerActionKind')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P3/X11: and 複合 (observer × subtype) — B01036 正準形状の listener 発火
// ---------------------------------------------------------------------------

describe('X11 and 複合 matcherCondition (P3, B01036 正準)', () => {
  function setupObserver(matcherCondition: Condition) {
    const obs = defWith('OBS', {
      abilities: [{
        id: 'a1', type: 'triggered', scope: 'on-scene',
        trigger: { hook: 'action:declare', matcherCondition },
        effect: DRAW1, description: '(test observer)',
      } as AbilityDef],
    });
    registerCardDef(obs);
    registerCardDef(defWith('GREEN', { colors: ['緑'] }));
    registerCardDef(defWith('RED', { colors: ['赤'] }));
    registerTriggeredListener();
    const { s } = makeBoard();
    s.players.self.scene.push(makeChar({ uid: 'u-obs', cardId: 'OBS', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-green', cardId: 'GREEN', state: 'active' }));
    s.players.self.scene.push(makeChar({ uid: 'u-red', cardId: 'RED', state: 'active' }));
    s.players.opp.scene.push(makeChar({ uid: 'u-ogreen', cardId: 'GREEN', state: 'active' }));
    return s;
  }
  const COND: Condition = {
    kind: 'and', cs: [
      { kind: 'triggerActionKind', v: 'char' } as Condition,
      { kind: 'triggerCharMatches', side: 'self', filter: { color: '緑' } },
    ],
  };
  function emitDeclare(s: GameState, actorUid: string, actorPlayer: 'self' | 'opp', targetKind: 'char' | 'case') {
    return produce(s, (d) => {
      const target = targetKind === 'char' ? { kind: 'char', uid: 'u-tgt' } : { kind: 'case', player: 'opp' };
      event.emit(d, 'action:declare',
        { byUid: actorUid, target, targetUid: targetKind === 'char' ? 'u-tgt' : undefined, uid: actorUid, player: actorPlayer },
        { player: actorPlayer, uid: actorUid, cardId: 'X' });
    });
  }
  it('自分の緑キャラの action[キャラ] で発火', () => {
    const after = emitDeclare(setupObserver(COND), 'u-green', 'self', 'char');
    expect(after.pendingEffects).toHaveLength(1);
  });
  it('action[事件] では発火しない (subtype 1対1)', () => {
    const after = emitDeclare(setupObserver(COND), 'u-green', 'self', 'case');
    expect(after.pendingEffects).toHaveLength(0);
  });
  it('緑以外のキャラでは発火しない', () => {
    const after = emitDeclare(setupObserver(COND), 'u-red', 'self', 'char');
    expect(after.pendingEffects).toHaveLength(0);
  });
  it('相手の緑キャラでは発火しない (side:self)', () => {
    const after = emitDeclare(setupObserver(COND), 'u-ogreen', 'opp', 'char');
    expect(after.pendingEffects).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// P5/X10: action:end — selfOnly + 離場不発 (qAndA: 現場離脱→アクション終了の順)
// ---------------------------------------------------------------------------

describe('X10 action:end trigger (P5)', () => {
  it('TRIGGERED_HOOKS に action:end / evidence:gain が含まれる', () => {
    expect((TRIGGERED_HOOKS as readonly string[]).includes('action:end')).toBe(true);
    expect((TRIGGERED_HOOKS as readonly string[]).includes('evidence:gain')).toBe(true);
  });
  function setupActor() {
    const actor = defWith('ACT', {
      abilities: [{
        id: 'a1', type: 'triggered', scope: 'on-scene',
        trigger: { hook: 'action:end', selfOnly: true },
        effect: DRAW1, description: 'このキャラのアクション終了時 (test)',
      } as AbilityDef],
    });
    registerCardDef(actor);
    registerTriggeredListener();
    const { s } = makeBoard();
    s.players.self.scene.push(makeChar({ uid: 'u-act', cardId: 'ACT', state: 'sleep' }));
    return s;
  }
  function emitEnd(s: GameState) {
    return produce(s, (d) => {
      event.emit(d, 'action:end', { byUid: 'u-act', result: 'completed' }, { player: 'self', uid: 'u-act' });
    });
  }
  it('actor が現場に居る → 発火', () => {
    expect(emitEnd(setupActor()).pendingEffects).toHaveLength(1);
  });
  it('actor が現場を離れている → 不発 (in-play scan、PR086/B03073/B05108 qAndA)', () => {
    const s = setupActor();
    s.players.self.scene = s.players.self.scene.filter((c) => c.uid !== 'u-act');
    expect(emitEnd(s).pendingEffects).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// P4/X9: evidence:gain emit — action-case 限定 + 実獲得時のみ + refresh guard
// ---------------------------------------------------------------------------

describe('X9 evidence:gain emit (P4)', () => {
  function setupGainListener() {
    const actor = defWith('ACT', {
      abilities: [{
        id: 'a2', type: 'triggered', scope: 'on-scene',
        trigger: { hook: 'evidence:gain', selfOnly: true },
        effect: DRAW1, description: 'このキャラのアクション[事件]によって証拠を得たとき (test)',
      } as AbilityDef],
    });
    registerCardDef(actor);
    registerTriggeredListener();
    const { s } = makeBoard();
    s.players.self.scene.push(makeChar({ uid: 'u-act', cardId: 'ACT', state: 'sleep' }));
    return s;
  }
  const AX = { id: 'ax1', byUid: 'u-act', byPlayer: 'self', target: { kind: 'case', player: 'opp' }, phase: 'judge' } as ActionContext;

  it('gainSelfEvidence → 証拠+1 + evidence:gain 発火 (payload via=action-case)', () => {
    const s = setupGainListener();
    let captured: Record<string, unknown> | undefined;
    const after = produce(s, (d) => {
      event.on('evidence:gain', (_s, payload) => { captured = payload as Record<string, unknown>; });
      actionCase.gainSelfEvidence(d, AX);
    });
    expect(after.players.self.evidence).toHaveLength(1);
    expect(after.pendingEffects).toHaveLength(1);
    expect(captured?.via).toBe('action-case');
    expect(captured?.byUid).toBe('u-act');
  });
  it('deck0 + remove あり → refresh 後に獲得 + 発火 (rules/14)', () => {
    const s = setupGainListener();
    s.players.self.deck = [];
    s.players.self.remove.push('R1', 'R2');
    const after = produce(s, (d) => { actionCase.gainSelfEvidence(d, AX); });
    expect(after.players.self.evidence).toHaveLength(1);
    expect(after.players.opp.evidence).toHaveLength(1); // refresh penalty (rules/14)
    expect(after.pendingEffects).toHaveLength(1);
  });
  it('deck0 + remove0 → 敗北、獲得なし、emit なし (false-fire 防止)', () => {
    const s = setupGainListener();
    s.players.self.deck = [];
    s.players.self.remove = [];
    const after = produce(s, (d) => { actionCase.gainSelfEvidence(d, AX); });
    expect(after.gameResult?.reason).toBe('deck-out');
    expect(after.players.self.evidence).toHaveLength(0);
    expect(after.pendingEffects).toHaveLength(0);
  });
  it('効果由来 (evidenceGain verb) では evidence:gain は発火しない (排他性)', () => {
    const s = setupGainListener();
    const after = produce(s, (d) => {
      runAtom(d, 'evidenceGain', { player: 'self', n: 1 }, makeCtx({ source: { player: 'self', uid: 'u-act', cardId: 'ACT' } }));
    });
    expect(after.players.self.evidence).toHaveLength(1);
    expect(after.pendingEffects).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// X12: scope:'action' modifier — read/filter 合算 + 清掃 2 経路
// ---------------------------------------------------------------------------

describe('X12 scope:action modifier', () => {
  function withMod(): { s: GameState; uid: string } {
    registerCardDef(defWith('ATK', { ap: 1000, level: 3 }));
    const { s, atkUid } = makeBoard();
    const s2 = produce(s, (d) => {
      runAtom(d, 'charModifyAP', { uid: atkUid, delta: 2000, scope: 'action' }, makeCtx());
    });
    return { s: s2, uid: atkUid };
  }
  it('read.char.ap が apMod_action を合算する', () => {
    const { s, uid } = withMod();
    expect(read.char.ap(s, uid)).toBe(3000);
  });
  it('filter 経路 (triggerCharMatches→matchOneFilter) も同値を見る (第4合算サイト)', () => {
    const { s, uid } = withMod();
    const ctx = makeCtx({ source: { player: 'self', uid: 'u-x', cardId: 'X' }, triggerPayload: { uid, player: 'self' } });
    expect(evalCond(s, { kind: 'triggerCharMatches', side: 'self', filter: { apMin: 3000 } }, ctx)).toBe(true);
    expect(evalCond(s, { kind: 'triggerCharMatches', side: 'self', filter: { apMax: 2999 } }, ctx)).toBe(false);
  });
  it("clearTurnEffects('action') で失効 (アクション終了清掃)", () => {
    const { s, uid } = withMod();
    const after = produce(s, (d) => { mutate.char.clearTurnEffects(d, uid, 'action'); });
    expect(read.char.ap(after, uid)).toBe(1000);
  });
  it("clearTurnEffects('turn') の safety net でも失効", () => {
    const { s, uid } = withMod();
    const after = produce(s, (d) => { mutate.char.clearTurnEffects(d, uid, 'turn'); });
    expect(read.char.ap(after, uid)).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// P7/X13: targetUid payload + B08048 正準形状 (修正後 level conditional)
// ---------------------------------------------------------------------------

describe('X13 targetUid payload + B08048 形状 (P7)', () => {
  it('declare (char target) → payload.targetUid = 対象 uid', () => {
    registerCardDef(defWith('ATK'));
    registerCardDef(defWith('TGT'));
    const { s, atkUid, tgtUid } = makeBoard();
    let captured: Record<string, unknown> | undefined;
    produce(s, (d) => {
      event.on('action:declare', (_s, payload) => { captured = payload as Record<string, unknown>; });
      declare(d, atkUid, { kind: 'char', uid: tgtUid });
    });
    expect(captured?.targetUid).toBe(tgtUid);
  });
  function b08048Board(targetLevel: number) {
    const atk = defWith('ATK', {
      ap: 5000, level: 6,
      abilities: [{
        id: 'a1', type: 'triggered', scope: 'on-scene',
        trigger: { hook: 'action:declare', selfOnly: true, matcherCondition: { kind: 'triggerActionKind', v: 'char' } as Condition },
        effect: {
          kind: 'sequence', steps: [
            { kind: 'atom', verb: 'charModifyLevel', args: { uid: '$trigger.targetUid', delta: -1, scope: 'turn' } },
            {
              kind: 'conditional',
              if: { kind: 'triggerCharMatches', payloadKey: 'targetUid', filter: { levelMax: 6 } },
              then: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 3000, scope: 'action' } },
            },
          ],
        } as Effect,
        description: 'B08048 a1 正準形状 (test)',
      } as AbilityDef],
    });
    registerCardDef(atk);
    registerCardDef(defWith('TGT', { level: targetLevel }));
    registerTriggeredListener();
    const { s, atkUid, tgtUid } = makeBoard();
    return { s, atkUid, tgtUid };
  }
  it('レベル7対象 → -1で6 → 修正後 level で conditional 成立 → AP+3000 (action scope)', () => {
    const { s, atkUid, tgtUid } = b08048Board(7);
    const after = produce(s, (d) => {
      declare(d, atkUid, { kind: 'char', uid: tgtUid });
      runAllUntilEmpty(d);
    });
    expect(read.char.level(after, tgtUid)).toBe(6);
    expect(read.char.ap(after, atkUid)).toBe(8000);
  });
  it('レベル8対象 → -1で7 → conditional 不成立 → AP 不変', () => {
    const { s, atkUid, tgtUid } = b08048Board(8);
    const after = produce(s, (d) => {
      declare(d, atkUid, { kind: 'char', uid: tgtUid });
      runAllUntilEmpty(d);
    });
    expect(read.char.level(after, tgtUid)).toBe(7);
    expect(read.char.ap(after, atkUid)).toBe(5000);
  });
});

// ---------------------------------------------------------------------------
// X14 (BUG-141): CPU 経路 — declare trigger 効果はガード判定前に解決済
// ---------------------------------------------------------------------------

describe('X14 CPU declare-drain 順序 (BUG-141)', () => {
  it('chooseGuard 呼出時点で declare trigger の draw が解決済 (公式: ガード判定前に解決)', () => {
    const atk = defWith('ATK', {
      abilities: [{
        id: 'a1', type: 'triggered', scope: 'on-scene',
        trigger: { hook: 'action:declare', selfOnly: true },
        effect: DRAW1, description: 'このキャラがアクションしたとき draw1 (test)',
      } as AbilityDef],
    });
    registerCardDef(atk);
    registerCardDef(defWith('TGT'));
    registerCardDef(defWith('GRD'));
    registerTriggeredListener();
    const { s, atkUid, tgtUid } = makeBoard();
    let handAtGuard = -1;
    produce(s, (d) => {
      resolveActionAgainstChar(d, atkUid, tgtUid, {
        chooseGuard: (st) => { handAtGuard = st.players.self.hand.length; return null; },
      });
    });
    expect(handAtGuard).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// X15 (BUG-142): evidenceGain verb の refresh guard (1枚ごと事前 check)
// ---------------------------------------------------------------------------

describe('X15 evidenceGain refresh guard (BUG-142)', () => {
  it('n=2 / deck=1 / remove あり → 1枚獲得 → refresh → 残り1枚獲得 (rules/14)', () => {
    const { s } = makeBoard();
    s.players.self.deck = ['D1'];
    s.players.self.remove.push('R1', 'R2');
    const after = produce(s, (d) => {
      runAtom(d, 'evidenceGain', { player: 'self', n: 2 }, makeCtx());
    });
    expect(after.players.self.evidence).toHaveLength(2);
    expect(after.players.opp.evidence).toHaveLength(1); // refresh penalty
    expect(after.gameResult).toBeUndefined();
  });
  it('deck0 + remove0 → 敗北 (rules/14)', () => {
    const { s } = makeBoard();
    s.players.self.deck = [];
    s.players.self.remove = [];
    const after = produce(s, (d) => {
      runAtom(d, 'evidenceGain', { player: 'self', n: 1 }, makeCtx());
    });
    expect(after.gameResult?.reason).toBe('deck-out');
  });
});
