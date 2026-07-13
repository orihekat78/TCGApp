// M2 latter batch カード probe (2026-07-10): PR234/PR240 毛利蘭 + B01057 「最も出会いたくない…」。
// atom レベルは tests/engine/effect/m2latter-setcard-turn-filter.test.ts (P6/P7) /
// m2latter-bundleb.test.ts (P14/P15) が担保。ここでは production dispatch (実 hook emit +
// triggered listener + human pick 経路 harness) でカード DSL が engine に評価されることを踏む。
//   - PR234 a1: enter 実 emit → bindPick host → charSetCard area:['hand','remove'] union pick →
//     faceUp:true セット (hand 消費 / remove 消費の両 source)。
//   - PR234 a2: setcard:leave 実 emit (removeToRemove) → 相手ターン中のみ optional{handAddFromRemove}
//     が queue (condition gate)。表向き gate (setCardMatches) / 名前 gate / 【ターン1】limit。
//   - B01057 a1: event-use 実 flow → fromSelf 表向きセット (【白】filter、非白 decoy 除外)。
//   - B01057 a2 rider: host removeToRemove (実 emit) → 相手ターン中のみ rider sceneEnter queue /
//     自分ターン中不発 / 裏向きセット不発 (M2 latter P14 walk)。
// rules: 13 (突撃) / 15 / 16 (セット) / 17 (【現場リムーブ時】/【相手ターン中】/【ターン1】) / 20
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _clearPendingEffectPickQueue, _clearPendingEffectOptionalSide, _drainPendingEffectOptionalSide } from '@/engine/effect/pending-state';
import { applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { runCardScenario } from '../helpers/card-probe-harness';
import type { ProbeScenario } from '../helpers/card-probe-harness';
import { PR234 } from '@/cards/pr-01/PR234';
import { PR240 } from '@/cards/pr-01/PR240';
import { B01057 } from '@/cards/ct-p01/B01057';
import { B01023 } from '@/cards/ct-p01/B01023'; // シャッフルロマンス (実 def — PR234 の対象カード)
import type { CardDef, GameState } from '@/engine/types';

// ---- fixtures ----
const HOSTC: CardDef = { id: 'HOSTC', no: 'HOSTC', kind: 'character', names: ['主'], colors: ['赤'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
// 名前違いイベント decoy (a1 の cardName filter / a2 の setCardMatches 名前 gate 用)
const EV_OTH: CardDef = { id: 'EV_OTH', no: 'EV_OTH', kind: 'event', names: ['ほかのイベント'], colors: ['青'], level: 2, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] } as unknown as CardDef;
// B01057 a1 用: 【白】host + 非白 decoy
const WHT: CardDef = { id: 'WHT', no: 'WHT', kind: 'character', names: ['白キャラ'], colors: ['白'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const REDD: CardDef = { id: 'REDD', no: 'REDD', kind: 'character', names: ['赤キャラ'], colors: ['赤'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };

beforeEach(() => {
  resetDefRegistry();
  _resetUidCounter();
  _resetTriggeredRegistered();
  event._resetRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
});

// ============================================================
// PR234 a1 — 【登場時】hand∪remove からシャッフルロマンスを表向きセット (harness = 実 enter emit + human pick)
// ============================================================
describe('PR234 a1 (enter → union pick → faceUp set)', () => {
  const FIXTURES: CardDef[] = [B01023, HOSTC, EV_OTH];

  it('hand source: 手札のシャッフルロマンスを host に表向きセット (hand 消費 / 名前違い decoy 除外)', () => {
    const sc: ProbeScenario = {
      name: 'PR234 a1 hand source',
      setup: {
        selfScene: [{ cardId: 'PR234', uid: '__RAN__' }, { cardId: 'HOSTC', uid: '__HU__' }],
        hand: ['B01023', 'EV_OTH'],
        caseColors: ['青'],
      },
      drive: { kind: 'enter', cardId: 'PR234', uid: '__RAN__' },
      script: [{ pickCardId: 'HOSTC' }, { pickCardId: 'B01023' }],
      expect: [
        { kind: 'candidatesExclude', pickIndex: 1, cardId: 'EV_OTH' }, // cardName filter
        { kind: 'zone', cardId: 'B01023', zone: 'hand', side: 'self', present: false }, // hand 消費
      ],
    };
    const s = runCardScenario(PR234, FIXTURES, sc);
    const host = s.players.self.scene.find((c) => c.uid === '__HU__')!;
    expect(host.setCards).toEqual([{ cardId: 'B01023', faceUp: true, instanceId: 'set:1' }]); // 「表向きでセット」(a2 の参照と整合)
  });

  it('remove source (union): リムーブエリアのシャッフルロマンスも同一 pick で選べ、remove から消費される', () => {
    const sc: ProbeScenario = {
      name: 'PR234 a1 remove source',
      setup: {
        selfScene: [{ cardId: 'PR234', uid: '__RAN__' }, { cardId: 'HOSTC', uid: '__HU__' }],
        hand: ['EV_OTH'],
        remove: ['B01023'],
        caseColors: ['青'],
      },
      drive: { kind: 'enter', cardId: 'PR234', uid: '__RAN__' },
      script: [{ pickCardId: 'HOSTC' }, { pickCardId: 'B01023' }],
      expect: [
        { kind: 'candidatesExclude', pickIndex: 1, cardId: 'EV_OTH' },
        { kind: 'zone', cardId: 'B01023', zone: 'remove', side: 'self', present: false }, // remove 消費
      ],
    };
    const s = runCardScenario(PR234, FIXTURES, sc);
    const host = s.players.self.scene.find((c) => c.uid === '__HU__')!;
    expect(host.setCards).toEqual([{ cardId: 'B01023', faceUp: true, instanceId: 'set:1' }]);
  });
});

// ============================================================
// PR234 a2 — setcard:leave (実 emit) → optional{handAddFromRemove} queue (queue-time condition/limit gate)
// ============================================================
describe('PR234 a2 (setcard:leave → handAddFromRemove queue)', () => {
  function base(turnPlayer: 'self' | 'opp'): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 3, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    return s;
  }
  function registerDefs(): void {
    for (const d of [PR234, B01023, HOSTC, EV_OTH]) registerCardDef(d);
  }
  /** PR234 + set 済 host を配置 (listener 登録前 = a1 enter noise なし) → listener 登録 → host リムーブ。 */
  function runLeave(turnPlayer: 'self' | 'opp', sets: { cardId: string; faceUp: boolean }[]): GameState {
    registerDefs();
    const s0 = produce(base(turnPlayer), (d) => {
      mutate.scene.enter(d, 'self', 'PR234', {});
      const h = mutate.scene.enter(d, 'self', 'HOSTC', {});
      for (const e of sets) mutate.char.setCard(d, h.uid, e.cardId, e.faceUp);
    });
    registerTriggeredListener();
    return produce(s0, (d) => {
      const h = d.players.self.scene.find((c) => c.cardId === 'HOSTC')!;
      mutate.scene.removeToRemove(d, h.uid, 'effect');
    });
  }
  const q = (s: GameState) => s.pendingEffects.filter((pe) => pe.triggeredBy.hook === 'setcard:leave');

  it('相手ターン中: host リムーブ → setcard:leave 経由で optional が surface、take で当該カードが手札へ (human path)', () => {
    registerDefs();
    // human path: queue-time walk が optional を side-channel に surface する
    // (AI path は optional auto-decline — reference-engine-additive-wave3-observer)
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
    const s = base('opp');
    const ranUid = mutate.scene.enter(s, 'self', 'PR234', {}).uid;
    const h = mutate.scene.enter(s, 'self', 'HOSTC', {});
    mutate.char.setCard(s, h.uid, 'B01023', true);
    registerTriggeredListener();
    mutate.scene.removeToRemove(s, h.uid, 'effect');
    const riders = q(s);
    expect(riders).toHaveLength(1);
    expect(riders[0]!.source.cardId).toBe('PR234');
    expect(riders[0]!.source.uid).toBe(ranUid);
    // payload に当該 set card が乗る (「その中から1枚」= $trigger.setCardId、P7 resolveBindRef の入力)
    expect((riders[0]!.triggeredBy.payload as { setCardId?: string }).setCardId).toBe('B01023');
    // セットカード自体は remove に着地している (rules/16)
    expect(s.players.self.remove).toContain('B01023');
    // optional 「〜してもよい」 side-channel → take → handAddFromRemove('$trigger.setCardId') 実行
    const opt = _drainPendingEffectOptionalSide();
    expect(opt).not.toBeNull();
    expect(opt!.player).toBe('self');
    applyOptionalAndContinuation(s, opt!, true);
    expect(s.players.self.hand).toContain('B01023');
    expect(s.players.self.remove).not.toContain('B01023');
  });

  it('自分ターン中は不発 (condition turn:opp gate、queue-time 評価)', () => {
    expect(q(runLeave('self', [{ cardId: 'B01023', faceUp: true }]))).toHaveLength(0);
  });

  it('裏向きセットは不発 (setCardMatches は faceUp===true を要求 — 「表向きでセットされていた」)', () => {
    expect(q(runLeave('opp', [{ cardId: 'B01023', faceUp: false }]))).toHaveLength(0);
  });

  it('名前違いの表向きセットは不発 (setCardMatches cardName gate)', () => {
    expect(q(runLeave('opp', [{ cardId: 'EV_OTH', faceUp: true }]))).toHaveLength(0);
  });

  it('【ターン1】: 2枚同時離場でも queue は1つ (limit turn1、queue-time 記録)', () => {
    const after = runLeave('opp', [
      { cardId: 'B01023', faceUp: true },
      { cardId: 'B01023', faceUp: true },
    ]);
    expect(q(after)).toHaveLength(1);
  });
});

// ============================================================
// PR240 — PR234 と印字完全同文 (id/no/imageUrl のみ差) の DSL clone 検証
// ============================================================
describe('PR240 (PR234 同文 clone)', () => {
  it('abilities は PR234 と deep-equal / メタは id/no/imageUrl のみ差', () => {
    expect(PR240.abilities).toEqual(PR234.abilities);
    expect(PR240.no).toBe('0932/PR240');
    expect(PR240.imageUrl).not.toBe(PR234.imageUrl);
    expect({ ...PR240, id: PR234.id, no: PR234.no, imageUrl: PR234.imageUrl }).toEqual(PR234);
  });
});

// ============================================================
// B01057 a1 — event-use (実 flow) → fromSelf 表向きセット (【白】filter)
// ============================================================
describe('B01057 a1 (event-use → fromSelf faceUp set, 【白】filter)', () => {
  it('使用イベント自身を【白】キャラに表向きセット (非白 decoy は候補外)', () => {
    const sc: ProbeScenario = {
      name: 'B01057 a1 self-set',
      setup: {
        selfScene: [{ cardId: 'WHT', uid: '__WU__' }, { cardId: 'REDD', uid: '__RU__' }],
        hand: ['B01057'],
        caseColors: ['白'],
        fileCount: 7, // level 5 ≤ FILE 7 (手札の使用条件)
      },
      drive: { kind: 'event-use', cardId: 'B01057' },
      script: [{ pickCardId: 'WHT' }],
      expect: [
        { kind: 'candidatesExclude', pickIndex: 0, cardId: 'REDD' }, // 【白】filter
        { kind: 'zone', cardId: 'B01057', zone: 'hand', side: 'self', present: false },
        { kind: 'zone', cardId: 'B01057', zone: 'remove', side: 'self', present: false }, // remove からセットへ移動済
      ],
    };
    const s = runCardScenario(B01057, [WHT, REDD], sc);
    const host = s.players.self.scene.find((c) => c.uid === '__WU__')!;
    expect(host.setCards).toEqual([{ cardId: 'B01057', faceUp: true, instanceId: 'set:1' }]); // fromSelf = 常に表向き (rider walk 前提)
  });
});

// ============================================================
// B01057 a2 rider — host removeToRemove (実 emit) → on-set-host leave:to-remove walk
// ============================================================
describe('B01057 a2 rider (on-set-host leave:to-remove)', () => {
  function base(turnPlayer: 'self' | 'opp'): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 3, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    return s;
  }
  /** host に B01057 をセット → listener 登録 → host を removeToRemove。 */
  function runHostRemove(turnPlayer: 'self' | 'opp', faceUp: boolean): GameState {
    for (const d of [B01057, HOSTC]) registerCardDef(d);
    const s0 = produce(base(turnPlayer), (d) => {
      const h = mutate.scene.enter(d, 'self', 'HOSTC', {});
      mutate.char.setCard(d, h.uid, 'B01057', faceUp);
    });
    registerTriggeredListener();
    return produce(s0, (d) => {
      const h = d.players.self.scene.find((c) => c.cardId === 'HOSTC')!;
      mutate.scene.removeToRemove(d, h.uid, 'effect');
    });
  }
  const q = (s: GameState) => s.pendingEffects.filter((pe) => pe.triggeredBy.hook === 'leave:to-remove');

  it('相手ターン中: host リムーブ → rider sceneEnter が queue (source = host)', () => {
    const after = runHostRemove('opp', true);
    const riders = q(after);
    expect(riders).toHaveLength(1);
    expect(riders[0]!.source.cardId).toBe('HOSTC');
    expect(riders[0]!.effect).toEqual(B01057.abilities.find((a) => a.id === 'b01057_set_t1')!.effect);
    // host + セット済 B01057 は remove へ (rules/16)
    expect(after.players.self.remove).toEqual(expect.arrayContaining(['HOSTC', 'B01057']));
  });

  it('自分ターン中は不発 (【相手ターン中】condition gate)', () => {
    expect(q(runHostRemove('self', true))).toHaveLength(0);
  });

  it('裏向きセットは不発 (rules/16 — 裏向きセットはカードとして扱われない)', () => {
    expect(q(runHostRemove('opp', false))).toHaveLength(0);
  });
});
