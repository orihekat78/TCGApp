// tests/cards/hybrid-batch4/manual-probes
// hybrid-batch4 手書き probe: gen-card-probes.cjs が扱えなかった ability を production dispatch 経路で検証。
// 対象:
//   B03047 京極真   — a1 継続【絆鈴木園子】AP+1000 / a2 triggered action:guarded (AP6000以下ガード) → 自身アクティブ化【ターン1】
//   B03050 怪盗キッド — a1 icon-disguise gate【変装】【事件白or赤】【FILE5】 / a2 triggered disguise:into (世良真純と入替) → 任意でリムーブ+証拠1【相手ターン中】
//   B05051 京極真   — a1 継続 caseActionBan (事件アクション不可) / a2 triggered phase:end:start【絆鈴木園子】自ターン終了時ドロー
//   B06084 安室透＆榎本梓 — a3 のみ:【カットイン】AP+2000 ($contact.byUid)。a1(enter)/a2(declared) は B06084.gen.test.ts が担当。
// 手法: これらは harness の drive kind(declared/enter/event-use/cost-gate)外 (継続 modifier / action:guarded /
//   disguise:into / phase:end:start / cutin) のため、各 hook の production emit 経路 (flow/contact・emit・
//   継続 reader) を実カードで直接叩く direct engine test。fake emit は production payload 形状を厳密に模倣。
// rules: 07/08/09/13/15/17/18/20/22/24

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { canDisguise, disguise, cutIn, canCutIn } from '@/engine/flow/contact';
import { canActionAgainstCase } from '@/engine/flow/main/action';
import {
  _drainPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import { applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { B03047 } from '@/cards/ct-p03/B03047';
import { B03050 } from '@/cards/ct-p03/B03050';
import { B05051 } from '@/cards/ct-p05/B05051';
import { B06084 } from '@/cards/ct-p06/B06084';
import type { CardDef, ActionContext, GameState } from '@/engine/types';

// ---- fixtures ----
function charDef(id: string, o: { names?: string[]; ap?: number; colors?: string[] } = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: o.names ?? [id], colors: o.colors ?? ['赤'],
    level: 1, ap: o.ap ?? 2000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}
const SONOKO = charDef('SONOKO', { names: ['鈴木園子'] }); // 絆対象
const SERA = charDef('SERA', { names: ['世良真純'] });     // 変装で入替えられる対象
const MOB = charDef('MOB', {});                            // 汎用 decoy / 非一致
const GUARD6000 = charDef('GUARD6000', { ap: 6000 });      // AP6000以下ガード (発火)
const GUARD7000 = charDef('GUARD7000', { ap: 7000 });      // AP6000超ガード (非発火)
const ATK = charDef('ATK', { ap: 2000 });                 // cutin 中の自コンタクトキャラ
const DK = charDef('DK', {});                              // deck/evidence filler

const FIXTURES = [SONOKO, SERA, MOB, GUARD6000, GUARD7000, ATK, DK];

function setHuman(s: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B03047); registerCardDef(B03050); registerCardDef(B05051); registerCardDef(B06084);
  for (const f of FIXTURES) registerCardDef(f);
  registerTriggeredListener();
  setHuman(null); // 既定は CPU (tequila 慣行: cutin own-effect は human 非依存で自動適用)
});

// ============================================================================
// B03047 京極真
// ============================================================================
describe('B03047 a1 継続【絆鈴木園子】AP+1000', () => {
  it('自現場に鈴木園子あり → AP 8000+1000 = 9000', () => {
    let kUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      kUid = mutate.scene.enter(d, 'self', 'B03047', {}).uid;
      mutate.scene.enter(d, 'self', 'SONOKO', {});
    });
    expect(engine.read.char.ap(after, kUid)).toBe(9000);
  });

  it('鈴木園子なし → 絆不成立 → AP 据置 8000', () => {
    let kUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      kUid = mutate.scene.enter(d, 'self', 'B03047', {}).uid;
    });
    expect(engine.read.char.ap(after, kUid)).toBe(8000);
  });

  it('DECOY: 鈴木園子が相手現場 → 絆は自現場のみ (rules/17) → AP 据置 8000', () => {
    let kUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      kUid = mutate.scene.enter(d, 'self', 'B03047', {}).uid;
      mutate.scene.enter(d, 'opp', 'SONOKO', {});
    });
    expect(engine.read.char.ap(after, kUid)).toBe(8000);
  });
});

describe('B03047 a2 triggered action:guarded (AP6000以下ガード → 自身アクティブ化)', () => {
  // production emit payload: { byUid, guardUid } / source { player: byPlayer, uid: byUid }
  it('AP6000のキャラにガードされた → 京極真 sleep→active', () => {
    let kUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      kUid = mutate.scene.enter(d, 'self', 'B03047', { active: false }).uid; // sleep
      const gUid = mutate.scene.enter(d, 'opp', 'GUARD6000', {}).uid;
      event.emit(d, 'action:guarded', { byUid: kUid, guardUid: gUid }, { player: 'self', uid: kUid });
      runAllUntilEmpty(d);
    });
    expect(after.players.self.scene.find((c) => c.uid === kUid)?.state).toBe('active');
  });

  it('DECOY: AP7000のキャラにガードされた → matcher(apMax6000)不成立 → sleep 据置', () => {
    let kUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      kUid = mutate.scene.enter(d, 'self', 'B03047', { active: false }).uid;
      const gUid = mutate.scene.enter(d, 'opp', 'GUARD7000', {}).uid;
      event.emit(d, 'action:guarded', { byUid: kUid, guardUid: gUid }, { player: 'self', uid: kUid });
      runAllUntilEmpty(d);
    });
    expect(after.players.self.scene.find((c) => c.uid === kUid)?.state).toBe('sleep');
  });

  it('DECOY: selfOnly — 別キャラのアクションがガードされた → 京極真 不発火 (pendingEffects 0)', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      mutate.scene.enter(d, 'self', 'B03047', { active: false });
      const otherUid = mutate.scene.enter(d, 'self', 'MOB', {}).uid; // 攻撃者は別キャラ
      const gUid = mutate.scene.enter(d, 'opp', 'GUARD6000', {}).uid;
      event.emit(d, 'action:guarded', { byUid: otherUid, guardUid: gUid }, { player: 'self', uid: otherUid });
    });
    expect(after.pendingEffects.length).toBe(0);
  });

  it('【ターン1】limit: 同ターン2回ガードされても発火は1回 (pendingEffects 1→1)', () => {
    produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      const kUid = mutate.scene.enter(d, 'self', 'B03047', { active: false }).uid;
      const gUid = mutate.scene.enter(d, 'opp', 'GUARD6000', {}).uid;
      event.emit(d, 'action:guarded', { byUid: kUid, guardUid: gUid }, { player: 'self', uid: kUid });
      expect(d.pendingEffects.length).toBe(1);
      event.emit(d, 'action:guarded', { byUid: kUid, guardUid: gUid }, { player: 'self', uid: kUid });
      expect(d.pendingEffects.length).toBe(1); // limit turn1 で2回目は skip
    });
  });
});

// ============================================================================
// B03050 怪盗キッド
// ============================================================================
describe('B03050 a1 icon-disguise gate【変装】【事件白or赤】【FILE5】', () => {
  const FB = { type: 'card-back' as const, cardId: 'DK' };
  function baseState(): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    mutate.scene.enter(s, 'self', 'ATK', {}); // 自コンタクトキャラ (入替え対象)
    mutate.scene.enter(s, 'opp', 'MOB', {});
    s.players.self.hand = ['B03050'];
    return s;
  }
  function ax(atkUid: string, dftUid: string): ActionContext {
    return {
      id: 'ax', byUid: atkUid, byPlayer: 'self', target: { kind: 'char', uid: dftUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: atkUid, aAP: 4000, bUid: dftUid, bAP: 1000 }, contactImmune: false,
    };
  }

  it('事件白 + FILE5 → 変装可', () => {
    const s = baseState();
    s.players.self.case.colors = ['白'];
    s.players.self.file = [FB, FB, FB, FB, FB];
    const a = ax(s.players.self.scene[0].uid, s.players.opp.scene[0].uid);
    expect(canDisguise(s, a, 'self', 'B03050')).toBe(true);
  });

  it('事件赤 + FILE5 → 変装可 (or 条件)', () => {
    const s = baseState();
    s.players.self.case.colors = ['赤'];
    s.players.self.file = [FB, FB, FB, FB, FB];
    const a = ax(s.players.self.scene[0].uid, s.players.opp.scene[0].uid);
    expect(canDisguise(s, a, 'self', 'B03050')).toBe(true);
  });

  it('DECOY: 事件青 (白/赤いずれも無) + FILE5 → 変装不可', () => {
    const s = baseState();
    s.players.self.case.colors = ['青'];
    s.players.self.file = [FB, FB, FB, FB, FB];
    const a = ax(s.players.self.scene[0].uid, s.players.opp.scene[0].uid);
    expect(canDisguise(s, a, 'self', 'B03050')).toBe(false);
  });

  it('DECOY: 事件白 + FILE4 (5未満) → 変装不可', () => {
    const s = baseState();
    s.players.self.case.colors = ['白'];
    s.players.self.file = [FB, FB, FB, FB];
    const a = ax(s.players.self.scene[0].uid, s.players.opp.scene[0].uid);
    expect(canDisguise(s, a, 'self', 'B03050')).toBe(false);
  });
});

describe('B03050 a2 triggered disguise:into (世良真純と入替) → 任意リムーブ+証拠1【相手ターン中】', () => {
  const FB = { type: 'card-back' as const, cardId: 'DK' };
  // 相手ターン中に self が防御側で変装する state を作る。
  // ax: 攻撃者=opp 'oatk' / 対象=self participant (入替えられるキャラ)。
  function buildDefender(replacedCardId: string, turnPlayer: 'self' | 'opp'): { s: GameState; ax: ActionContext; selfUid: string } {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
    const selfUid = mutate.scene.enter(s, 'self', replacedCardId, {}).uid; // 入替えられる自キャラ
    const oatkUid = mutate.scene.enter(s, 'opp', 'MOB', {}).uid;
    s.players.self.hand = ['B03050'];
    s.players.self.case.colors = ['白'];
    s.players.self.file = [FB, FB, FB, FB, FB]; // canDisguise 用
    s.players.self.deck = ['DK', 'DK']; // evidenceGain 用
    const ax: ActionContext = {
      id: 'ax', byUid: oatkUid, byPlayer: 'opp', target: { kind: 'char', uid: selfUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: oatkUid, aAP: 3000, bUid: selfUid, bAP: 1000 }, contactImmune: false,
    };
    return { s, ax, selfUid };
  }

  it('相手ターン + 世良真純と入替 + 任意 take → 怪盗キッドをリムーブ + 証拠+1', () => {
    setHuman('self'); // optional を surface させ take を制御
    const { s, ax } = buildDefender('SERA', 'opp');
    expect(canDisguise(s, ax, 'self', 'B03050')).toBe(true);
    disguise(s, ax, 'self', 'B03050');
    runAllUntilEmpty(s);
    const opt = _drainPendingEffectOptionalSide();
    expect(opt, '任意効果が surface する').toBeTruthy();
    applyOptionalAndContinuation(s, opt!, true); // take
    runAllUntilEmpty(s);
    expect(s.players.self.scene.some((c) => c.cardId === 'B03050'), '怪盗キッドはリムーブ済').toBe(false);
    expect(s.players.self.evidence.length, '証拠+1').toBe(1);
  });

  it('相手ターン + 世良真純と入替 + 任意 decline → リムーブせず 証拠変化なし', () => {
    setHuman('self');
    const { s, ax } = buildDefender('SERA', 'opp');
    disguise(s, ax, 'self', 'B03050');
    runAllUntilEmpty(s);
    const opt = _drainPendingEffectOptionalSide();
    expect(opt).toBeTruthy();
    applyOptionalAndContinuation(s, opt!, false); // decline
    runAllUntilEmpty(s);
    expect(s.players.self.scene.some((c) => c.cardId === 'B03050'), '怪盗キッドは残存').toBe(true);
    expect(s.players.self.evidence.length, '証拠据置').toBe(0);
  });

  it('DECOY: 相手ターン + 非世良真純(MOB)と入替 → matcher不成立 → 不発火 (surface なし)', () => {
    setHuman('self');
    const { s, ax } = buildDefender('MOB', 'opp');
    disguise(s, ax, 'self', 'B03050');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectOptionalSide(), '任意効果は surface しない').toBeNull();
    expect(s.players.self.scene.some((c) => c.cardId === 'B03050'), '怪盗キッドは残存').toBe(true);
    expect(s.players.self.evidence.length).toBe(0);
  });

  it('DECOY: 自ターン + 世良真純と入替 → condition(相手ターン中)不成立 → 不発火', () => {
    setHuman('self');
    // 自ターンでは self が攻撃側で変装 → ax を攻撃者=self に組み替え
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    const seraUid = mutate.scene.enter(s, 'self', 'SERA', {}).uid;
    const dftUid = mutate.scene.enter(s, 'opp', 'MOB', {}).uid;
    s.players.self.hand = ['B03050'];
    s.players.self.case.colors = ['白'];
    s.players.self.file = [FB, FB, FB, FB, FB];
    s.players.self.deck = ['DK', 'DK'];
    const ax: ActionContext = {
      id: 'ax', byUid: seraUid, byPlayer: 'self', target: { kind: 'char', uid: dftUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: seraUid, aAP: 4000, bUid: dftUid, bAP: 1000 }, contactImmune: false,
    };
    disguise(s, ax, 'self', 'B03050');
    runAllUntilEmpty(s);
    expect(_drainPendingEffectOptionalSide(), '自ターンでは condition 不成立 → surface なし').toBeNull();
    expect(s.players.self.scene.some((c) => c.cardId === 'B03050')).toBe(true);
    expect(s.players.self.evidence.length).toBe(0);
  });
});

// ============================================================================
// B05051 京極真
// ============================================================================
describe('B05051 a1 継続 caseActionBan (このキャラは事件を指定してアクションできない)', () => {
  function withEvidence(d: GameState): void {
    d.players.opp.evidence = [{ cardId: 'DK', faceUp: false, origin: { turn: 1, via: 'effect' } }];
  }

  it('京極真は canActionAgainstCase = false (アクション[事件]不可)', () => {
    let kUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      kUid = mutate.scene.enter(d, 'self', 'B05051', {}).uid; // active / 非名乗り
      withEvidence(d);
    });
    expect(canActionAgainstCase(after, kUid, 'opp')).toBe(false);
  });

  it('DECOY: caseActionBan を持たない汎用キャラは同 setup で canActionAgainstCase = true', () => {
    let mUid = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      mUid = mutate.scene.enter(d, 'self', 'MOB', {}).uid;
      withEvidence(d);
    });
    expect(canActionAgainstCase(after, mUid, 'opp')).toBe(true);
  });
});

describe('B05051 a2 triggered phase:end:start【絆鈴木園子】自ターン終了時ドロー', () => {
  // production emit payload: { player } / source undefined
  it('自現場に鈴木園子あり + 自ターン終了 → カード1枚ドロー (hand+1 / deck-1)', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      mutate.scene.enter(d, 'self', 'B05051', {});
      mutate.scene.enter(d, 'self', 'SONOKO', {});
      d.players.self.deck = ['DK', 'DK'];
      event.emit(d, 'phase:end:start', { player: 'self' }, undefined);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length, 'hand +1').toBe(1);
    expect(after.players.self.deck.length, 'deck -1').toBe(1);
  });

  it('DECOY: 鈴木園子なし → 絆不成立 → ドローなし', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      mutate.scene.enter(d, 'self', 'B05051', {});
      d.players.self.deck = ['DK', 'DK'];
      event.emit(d, 'phase:end:start', { player: 'self' }, undefined);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length).toBe(0);
    expect(after.players.self.deck.length).toBe(2);
  });

  it('DECOY: 鈴木園子あり + 相手ターン終了 → condition(自ターン)不成立 → ドローなし', () => {
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      mutate.scene.enter(d, 'self', 'B05051', {});
      mutate.scene.enter(d, 'self', 'SONOKO', {});
      d.players.self.deck = ['DK', 'DK'];
      event.emit(d, 'phase:end:start', { player: 'opp' }, undefined);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.hand.length).toBe(0);
    expect(after.players.self.deck.length).toBe(2);
  });
});

// ============================================================================
// B06084 安室透＆榎本梓 — a3 のみ (a1/a2 は B06084.gen.test.ts)
// ============================================================================
describe('B06084 a3【カットイン】AP+2000 ($contact.byUid)', () => {
  function mkAx(atkUid: string, dftUid: string): ActionContext {
    return {
      id: 'ax', byUid: atkUid, byPlayer: 'self', target: { kind: 'char', uid: dftUid },
      phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
      apSnapshot: { aUid: atkUid, aAP: 2000, bUid: dftUid, bAP: 3000 }, contactImmune: false,
    };
  }

  it('コンタクト中に自身をカットイン使用 → 自コンタクトキャラ($contact.byUid) AP 2000+2000 = 4000', () => {
    let atk = '';
    let dft = '';
    let bys = '';
    const after = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      atk = mutate.scene.enter(d, 'self', 'ATK', {}).uid;   // 自コンタクトキャラ (byUid)
      bys = mutate.scene.enter(d, 'self', 'MOB', {}).uid;   // DECOY: 非参加の傍観キャラ
      dft = mutate.scene.enter(d, 'opp', 'GUARD7000', {}).uid; // DECOY: コンタクト相手
      d.players.self.hand = ['B06084'];
      const ax = mkAx(atk, dft);
      expect(canCutIn(d, ax, 'self', 'B06084')).toBe(true);
      cutIn(d, ax, 'self', 'B06084');
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, atk), '自コンタクトキャラ +2000').toBe(4000);
    // DECOY: $contact.byUid 以外は据置
    expect(engine.read.char.ap(after, bys), '非参加の傍観キャラは据置').toBe(2000);
    expect(engine.read.char.ap(after, dft), 'コンタクト相手(defender)は据置').toBe(7000);
  });
});
