// tests/cards/night-wA1/B07049 — フィリップ王子 probe (engine A1 wave: handAddFromRemove area union)
//   【宣言】〚デッキの下に移す〛：自分のリムーブエリアかパートナーエリアにある〚特徴[ビッグジュエル]〛の
//   カードを1枚まで選び、手札に加える。
// production dispatch 経由 (activateDeclaredAbility + runAllUntilEmpty)。
// rules: 03 (PA), 15 (「まで」=0可), 21 (コスト)
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { event } from '@/engine/event/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation, drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { B07049 } from '@/cards/ct-p07/B07049';
import type { CardDef, GameState } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const JEWEL = ['ビッグジュエル'];
const FIXTURES: CardDef[] = [
  B07049,
  ch('JEWEL_R', { traits: JEWEL }), ch('JEWEL_PA', { traits: JEWEL }),
  ch('DECOY_R', { traits: ['探偵'] }), ch('DECOY_PA', { traits: ['探偵'] }),
  ch('DK1'),
];
type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = v; };

beforeEach(() => {
  event._resetRegistry();
  resetDefRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
  setHuman('self');
});

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

describe('B07049 a1 — handAddFromRemove area union (remove ∪ partner-area)', () => {
  it('候補 = 両 zone の〚ビッグジュエル〛のみ (decoy 除外)。PA の1枚を pick → 手札へ + partnerAreaCards から除去', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'B07049', {});
    s.players.self.remove = ['JEWEL_R', 'DECOY_R'];
    s.players.self.partnerAreaCards = ['JEWEL_PA', 'DECOY_PA'];
    s.players.self.deck = ['DK1'];
    activateDeclaredAbility(s, me.uid, 'a1');
    runAllUntilEmpty(s);
    // コスト: 自身をデッキの下へ
    expect(s.players.self.scene.find(c => c.uid === me.uid), 'コスト selfToDeckBottom で現場離脱').toBeUndefined();
    expect(s.players.self.deck[s.players.self.deck.length - 1], '自身がデッキ下').toBe('B07049');
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'union pick surface').toBeTruthy();
    expect(pick!.nMin, '「1枚まで」= 0').toBe(0);
    expect(pick!.nMax).toBe(1);
    const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
    expect(cands.map(c => c.cardId).sort(), '候補 = 両 zone の jewel のみ (decoy 除外)').toEqual(['JEWEL_PA', 'JEWEL_R'].sort());
    const paUid = cands.find(c => c.cardId === 'JEWEL_PA')!.uid;
    applyPickAndContinuation(s, pick!, paUid, [paUid]);
    runAllUntilEmpty(s);
    expect(s.players.self.hand, 'JEWEL_PA が手札へ').toContain('JEWEL_PA');
    expect(s.players.self.partnerAreaCards, 'PA から除去 (decoy 残る)').toEqual(['DECOY_PA']);
    expect(s.players.self.remove, 'remove は不変').toEqual(['JEWEL_R', 'DECOY_R']);
  });

  it('remove 側の jewel を pick → 手札へ + remove から除去 (PA 不変)', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'B07049', {});
    s.players.self.remove = ['JEWEL_R', 'DECOY_R'];
    s.players.self.partnerAreaCards = ['JEWEL_PA', 'DECOY_PA'];
    s.players.self.deck = ['DK1'];
    activateDeclaredAbility(s, me.uid, 'a1');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    const rUid = (pick!.candidates as Array<{ uid: string; cardId: string }>).find(c => c.cardId === 'JEWEL_R')!.uid;
    applyPickAndContinuation(s, pick!, rUid, [rUid]);
    runAllUntilEmpty(s);
    expect(s.players.self.hand, 'JEWEL_R が手札へ').toContain('JEWEL_R');
    expect(s.players.self.remove, 'remove から除去 (decoy 残る)').toEqual(['DECOY_R']);
    expect(s.players.self.partnerAreaCards, 'PA 不変').toEqual(['JEWEL_PA', 'DECOY_PA']);
  });

  it('0枚選択 (skip) → 手札に加えず両 zone 不変 (rules/15「まで」)', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'B07049', {});
    s.players.self.remove = ['JEWEL_R'];
    s.players.self.partnerAreaCards = ['JEWEL_PA'];
    s.players.self.deck = ['DK1'];
    activateDeclaredAbility(s, me.uid, 'a1');
    runAllUntilEmpty(s);
    // skip (0枚) = pending を drop して applyPickAndContinuation を呼ばない (useEngineDispatch picked===null 同挙動)
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'pick は surface する').toBeTruthy();
    runAllUntilEmpty(s);
    expect(s.players.self.hand, '手札に加わらない').toEqual([]);
    expect(s.players.self.remove).toEqual(['JEWEL_R']);
    expect(s.players.self.partnerAreaCards).toEqual(['JEWEL_PA']);
  });

  it('owner=opp (相手が使用) → side:self は opp 相対 zone を対象 (AI 経路)', () => {
    setHuman(null);
    const s = base();
    const me = mutate.scene.enter(s, 'opp', 'B07049', {});
    s.players.opp.remove = ['JEWEL_R', 'DECOY_R'];
    s.players.opp.partnerAreaCards = ['JEWEL_PA'];
    s.players.opp.deck = ['DK1'];
    activateDeclaredAbility(s, me.uid, 'a1');
    runAllUntilEmpty(s);
    drainAiEffectPicks(s);
    runAllUntilEmpty(s);
    // AI は候補から1枚 (jewel) を手札へ。self 側 zone は非対象 (owner-relative)。
    const oppHand = s.players.opp.hand;
    expect(oppHand.length, 'opp 手札に1枚加わる').toBe(1);
    expect(JEWEL.includes(FIXTURES.find(f => f.id === oppHand[0])!.traits[0]!), '加わったのは jewel').toBe(true);
    expect(s.players.self.hand, 'self 側は非対象').toEqual([]);
  });
});
