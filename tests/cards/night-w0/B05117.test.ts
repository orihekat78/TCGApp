// tests/cards/night-w0/B05117 — コンコン (event, 0613/B05117) probe。
//   DEFER 解禁: on-set-host rider leave:to-remove walk (host が現場離脱時に付与能力が発火)。
//   a1 = charSetCard fromSelf (使用イベント自身を【黒】キャラにセット)。
//   a2 (rider) = 【相手ターン中】host 現場離脱 → (自現場0枚なら) キャラ1枚までリムーブ + 自リムーブの
//                【カットイン】Lv6以下キャラを2枚まで登場。
// production dispatch: rider は mutate.scene.removeToRemove → leave:to-remove 実 emit →
//   handleLeaveToRemoveSelf が removedChar snapshot の faceUp setCards の on-set-host rider を walk。
// rules: 15 (「まで」=0可・「する」=必須・either) / 16 (セット) / 17 (【相手ターン中】【現場リムーブ時】) /
//        18 (owner 相対) / 20 (効果登場=色制限なし) / 25 (「〜場合」= 解決時評価)
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { run as runEffect } from '@/engine/effect/resolver';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { B05117 } from '@/cards/ct-p05/B05117';
import type { AbilityDef, CardDef, EffectCtx, GameState, Player } from '@/engine/types';

// 【カットイン】能力 (abilityIsCutin 形状: triggered / on-hand / effect:declared optional)
const cutin: AbilityDef = {
  id: 'c',
  type: 'triggered',
  scope: 'on-hand',
  trigger: { hook: 'effect:declared', optional: true, selfOnly: true },
  effect: { kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } },
  description: '【カットイン】AP＋1000',
  ruleRefs: [],
};

function mkChar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['黒'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

const FIXTURES: CardDef[] = [
  B05117,
  mkChar('HOST', { colors: ['黒'], level: 5 }),      // set host (黒)
  mkChar('OPPC', { names: ['相手'] }),                // 相手現場のキャラ (sceneRemove either 候補)
  mkChar('EXTRA'),                                    // 自現場に残るキャラ (条件不成立用)
  mkChar('CUT6', { level: 6, abilities: [cutin] }),   // 【カットイン】Lv6 → enter 適格 (境界)
  mkChar('CUT6B', { level: 6, abilities: [cutin] }),  // 【カットイン】Lv6 → enter 適格 (2枚目)
  mkChar('CUT7', { level: 7, abilities: [cutin] }),   // 【カットイン】Lv7 → decoy (level 超過)
  mkChar('NOCUT', { level: 3 }),                      // カットイン無し Lv3 → decoy (アイコン無し)
  mkChar('RED', { colors: ['赤'] }),                  // 非黒 → a1 セット候補 decoy
];

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = v; };

function base(turnPlayer: Player): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 4, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

/** side の現場に HOST を登場させ B05117 を faceUp セットして uid を返す */
function placeHostWithSet(s: GameState, side: Player, faceUp = true): string {
  const c = mutate.scene.enter(s, side, 'HOST', { named: true, viaEffect: false });
  mutate.char.setCard(s, c.uid, 'B05117', faceUp);
  return c.uid;
}

beforeEach(() => {
  event._resetRegistry(); // handler 累積防止 (miniwave 慣行)
  resetDefRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
  setHuman('self');
});

// ============ a1 — このイベントを自分の現場にいる【黒】のキャラ1枚にセットする ============
describe('B05117 a1 — charSetCard fromSelf【黒】(1枚, decoy 非黒 除外)', () => {
  it('黒キャラのみ候補 (赤 decoy 除外) → セットで faceUp 付与', () => {
    const s = base('self');
    const host = mutate.scene.enter(s, 'self', 'HOST', { named: true, viaEffect: false }); // 黒
    mutate.scene.enter(s, 'self', 'RED', { named: true, viaEffect: false }); // 赤 decoy (色不一致)
    const a1 = B05117.abilities.find((a) => a.id === 'a1')!;
    const ctx = { source: { player: 'self', cardId: 'B05117', uid: 'ev#1', abilityId: 'a1', area: 'hand' }, bindings: {} } as unknown as EffectCtx;
    s.players.self.remove = ['B05117']; // fromSelf の元 (使用済イベント)
    runEffect(s, a1.effect as never, ctx);
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'セット先 host pick が surface').toBeTruthy();
    expect(pick!.candidates.map((c) => c.cardId).sort(), '候補 = 黒 HOST のみ (赤 RED 除外)').toEqual(['HOST']);
    const hostUid = pick!.candidates.find((c) => c.cardId === 'HOST')!.uid;
    applyPickAndContinuation(s, pick!, hostUid, [hostUid]);
    runAllUntilEmpty(s);
    const hc = s.players.self.scene.find((c) => c.uid === host.uid)!;
    expect(hc.setCards.some((e) => e.cardId === 'B05117' && e.faceUp), 'B05117 が faceUp セット').toBe(true);
  });
});

// ============ a2 (rider) — 相手ターン中 host 離脱 → 現場0枚なら remove + 登場 ============
describe('B05117 a2 rider — 相手ターン中 host 離脱時', () => {
  it('条件成立 (自現場0枚): sceneRemove(either 候補=相手) → sceneEnter(remove の【カットイン】Lv6 のみ, 最大2)', () => {
    const s = base('opp'); // 【相手ターン中】
    const hostUid = placeHostWithSet(s, 'self'); // 自現場 host のみ
    mutate.scene.enter(s, 'opp', 'OPPC', { named: true, viaEffect: false });
    s.players.self.remove = ['CUT6', 'CUT6B', 'CUT7', 'NOCUT']; // enter 候補(2) + decoy(2)

    mutate.scene.removeToRemove(s, hostUid, 'effect'); // host 離脱 → leave:to-remove emit
    runAllUntilEmpty(s);

    // pick #1 = sceneRemove (キャラを1枚まで, either)。自現場0枚ゆえ候補=相手 OPPC
    const p1 = _drainPendingEffectPickSide();
    expect(p1, 'sceneRemove pick surface').toBeTruthy();
    expect(p1!.atomVerb, 'sceneRemove').toBe('sceneRemove');
    expect(p1!.candidates.map((c) => c.cardId).sort(), '候補 = 相手 OPPC のみ (自現場空)').toEqual(['OPPC']);
    expect(p1!.nMax, '「1枚まで」= max1').toBe(1);
    const oppcUid = p1!.candidates.find((c) => c.cardId === 'OPPC')!.uid;
    applyPickAndContinuation(s, p1!, oppcUid, [oppcUid]);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene.some((c) => c.cardId === 'OPPC'), 'OPPC がリムーブされた').toBe(false);
    expect(s.players.opp.remove, 'OPPC は相手リムーブへ').toContain('OPPC');

    // pick #2 = sceneEnter (自リムーブの【カットイン】Lv6以下, 2枚まで)
    const p2 = _drainPendingEffectPickSide();
    expect(p2, 'sceneEnter pick surface').toBeTruthy();
    expect(p2!.atomVerb, 'sceneEnter').toBe('sceneEnter');
    expect(p2!.candidates.map((c) => c.cardId).sort(), '候補 = CUT6/CUT6B のみ (CUT7 Lv超過・NOCUT 非カットイン 除外)').toEqual(['CUT6', 'CUT6B']);
    expect(p2!.nMax, '「2枚まで」= max2').toBe(2);
    const uids = p2!.candidates.map((c) => c.uid);
    applyPickAndContinuation(s, p2!, uids[0]!, uids);
    runAllUntilEmpty(s);
    expect(s.players.self.scene.map((c) => c.cardId).sort(), 'CUT6/CUT6B が自現場に登場').toEqual(['CUT6', 'CUT6B']);
    expect(s.players.self.remove.includes('CUT6'), 'CUT6 は remove を離れた').toBe(false);
    expect(s.players.self.remove.includes('CUT6B'), 'CUT6B は remove を離れた').toBe(false);
  });

  it('条件不成立 (自現場に別キャラが残る): rider 発火するも「現場0枚」不成立 → pick 出ず何もしない', () => {
    const s = base('opp');
    const hostUid = placeHostWithSet(s, 'self');
    mutate.scene.enter(s, 'self', 'EXTRA', { named: true, viaEffect: false }); // host 離脱後も自現場に1枚残る
    mutate.scene.enter(s, 'opp', 'OPPC', { named: true, viaEffect: false });
    s.players.self.remove = ['CUT6'];

    mutate.scene.removeToRemove(s, hostUid, 'effect');
    runAllUntilEmpty(s);

    expect(_drainPendingEffectPickSide(), 'conditional false → pick 出ない').toBeNull();
    expect(s.players.opp.scene.some((c) => c.cardId === 'OPPC'), 'OPPC 不変').toBe(true);
    expect(s.players.self.remove, 'CUT6 は登場せず remove に残る').toContain('CUT6');
  });

  it('自分ターン中の離脱: 【相手ターン中】不成立 → rider 発火しない', () => {
    const s = base('self'); // 自ターン
    const hostUid = placeHostWithSet(s, 'self');
    mutate.scene.enter(s, 'opp', 'OPPC', { named: true, viaEffect: false });
    s.players.self.remove = ['CUT6'];

    mutate.scene.removeToRemove(s, hostUid, 'effect');
    runAllUntilEmpty(s);

    expect(_drainPendingEffectPickSide(), 'turn:opp 不成立 → pick 出ない').toBeNull();
    expect(s.players.opp.scene.some((c) => c.cardId === 'OPPC'), 'OPPC 不変').toBe(true);
    expect(s.players.self.remove, 'CUT6 不変').toContain('CUT6');
  });

  it('裏向きセットでは付与されない (rules/16): rider 不発火', () => {
    const s = base('opp');
    const hostUid = placeHostWithSet(s, 'self', /* faceUp */ false);
    mutate.scene.enter(s, 'opp', 'OPPC', { named: true, viaEffect: false });
    s.players.self.remove = ['CUT6'];

    mutate.scene.removeToRemove(s, hostUid, 'effect');
    runAllUntilEmpty(s);

    expect(_drainPendingEffectPickSide(), 'faceDown set → 付与なし → pick 出ない').toBeNull();
    expect(s.players.self.remove, 'CUT6 不変').toContain('CUT6');
  });

  // owner='opp' 逆側 pin (BUG-174: player:'self'/side:'self' は owner 相対に解決される)
  it('相手所有 host (opp 現場): 自ターン中の opp host 離脱 → opp 現場0枚なら opp リムーブから opp 現場へ登場', () => {
    setHuman('opp'); // rider owner=opp を human 経路で駆動
    const s = base('self'); // opp から見て【相手ターン中】= self のターン
    const hostUid = placeHostWithSet(s, 'opp'); // opp 現場 host のみ
    s.players.opp.remove = ['CUT6']; // opp リムーブに適格1枚 (sceneRemove は両現場空ゆえ 0-pick skip)

    mutate.scene.removeToRemove(s, hostUid, 'effect');
    runAllUntilEmpty(s);

    // sceneRemove は候補0 (両現場空) で skip → 最初に surface する pick = sceneEnter (opp リムーブ)
    const p = _drainPendingEffectPickSide();
    expect(p, 'sceneEnter pick surface (owner=opp)').toBeTruthy();
    expect(p!.atomVerb, 'sceneEnter').toBe('sceneEnter');
    expect(p!.candidates.every((c) => c.player === 'opp'), '候補は opp リムーブ (owner 相対 side:self→opp)').toBe(true);
    expect(p!.candidates.map((c) => c.cardId), 'CUT6').toEqual(['CUT6']);
    const uid = p!.candidates[0]!.uid;
    applyPickAndContinuation(s, p!, uid, [uid]);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene.some((c) => c.cardId === 'CUT6'), 'CUT6 は opp 現場へ登場 (player:self→opp)').toBe(true);
  });
});

// ============ 構造 ============
describe('B05117 構造', () => {
  it('event / 黒 / Lv7 / names=[コンコン] / a1=charSetCard fromSelf / a2=on-set-host leave:to-remove rider', () => {
    expect(B05117.kind).toBe('event');
    expect(B05117.colors).toEqual(['黒']);
    expect(B05117.level).toBe(7);
    expect(B05117.names).toEqual(['コンコン']);
    const a1 = B05117.abilities.find((a) => a.id === 'a1')!;
    expect((a1.effect as { verb?: string }).verb).toBe('charSetCard');
    expect((a1.effect as { args: { fromSelf?: boolean } }).args.fromSelf).toBe(true);
    const a2 = B05117.abilities.find((a) => a.scope === 'on-set-host')!;
    expect(a2.type).toBe('triggered');
    expect(a2.trigger?.hook).toBe('leave:to-remove');
    expect(a2.trigger?.selfOnly).toBe(true);
    expect(a2.condition).toEqual({ kind: 'turn', player: 'opp' });
  });
});
