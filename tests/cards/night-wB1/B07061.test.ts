// tests/cards/night-wB1/B07061 日輪の後光の巻 probe — Cluster WB1: toPartnerArea pick-form (remove → PA)
//   a2【解決編】【宣言】〚裏向き証拠1つ表向き〛：リムーブの〚ビッグジュエル〛1枚まで選び PA へ移す。
// production dispatch (activateDeclaredAbility('case:self', ..., {flipFaceUpEvidence})). rules: 01/03/15/21.
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { B07061 } from '@/cards/ct-p07/B07061';
import type { CardDef, GameState, EvidenceCard } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) =>
  ((globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s);
function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'opening' } });
const JEWEL_EV = { ...def('JEWEL_EV', { names: ['宝石イベント'], traits: ['ビッグジュエル'] }), kind: 'event' as const };
const JEWEL_CH = def('JEWEL_CH', { names: ['宝石キャラ'], traits: ['ビッグジュエル'] });
const DECOY = def('DECOY', { names: ['囮'], traits: ['探偵'] });
const ALL_DEFS = [B07061, JEWEL_EV, JEWEL_CH, DECOY, def('FILL')];

function base(status = '解決編'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  const p = s.players.self;
  p.case.cardId = 'B07061';
  p.case.status = status as GameState['players']['self']['case']['status'];
  p.case.colors = ['白'];
  p.evidence = [ev('SE0'), ev('SE1')]; // 裏向き証拠 (cost 用)
  p.deck = ['DK1', 'DK2'];
  return s;
}
beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  setHuman('self');
  for (const d of ALL_DEFS) registerCardDef(d);
  registerTriggeredListener();
});

describe('B07061 a2 — toPartnerArea pick (remove の〚ビッグジュエル〛→ PA)', () => {
  it('cost 証拠1つ表向き → ビッグジュエルのみ候補 (decoy 除外) → pick → PA へ / remove から除去', () => {
    const after = produce(base(), (d) => {
      d.players.self.remove = ['JEWEL_EV', 'JEWEL_CH', 'DECOY'];
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0] } });
      runAllUntilEmpty(d);
      // cost: 証拠 index0 表向き
      expect(d.players.self.evidence[0]!.faceUp, 'cost: 証拠1つ表向き').toBe(true);
      const pick = _drainPendingEffectPickSide();
      expect(pick?.atomVerb, 'toPartnerArea pick surface').toBe('toPartnerArea');
      expect(pick!.nMin, '「1枚まで」= 0').toBe(0);
      expect(pick!.nMax).toBe(1);
      const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
      expect(cands.map(c => c.cardId).sort(), '候補 = ビッグジュエル 2枚のみ (decoy 除外)').toEqual(['JEWEL_CH', 'JEWEL_EV'].sort());
      const evUid = cands.find(c => c.cardId === 'JEWEL_EV')!.uid;
      applyPickAndContinuation(d, pick!, evUid, [evUid]);
      runAllUntilEmpty(d);
    });
    expect(after.players.self.partnerAreaCards, 'JEWEL_EV が PA へ').toEqual(['JEWEL_EV']);
    expect([...after.players.self.remove].sort(), 'JEWEL_EV は remove から除去 (残り = JEWEL_CH/DECOY)').toEqual(['DECOY', 'JEWEL_CH'].sort());
  });

  it('0枚選択 (skip) → PA 変化なし / remove 不変 (rules/15「まで」)', () => {
    const after = produce(base(), (d) => {
      d.players.self.remove = ['JEWEL_EV'];
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0] } });
      runAllUntilEmpty(d);
      const pick = _drainPendingEffectPickSide();
      expect(pick, 'pick surface').toBeTruthy();
      // skip = 未 apply
      runAllUntilEmpty(d);
    });
    expect(after.players.self.partnerAreaCards ?? [], 'PA 空のまま').toEqual([]);
    expect(after.players.self.remove, 'remove 不変').toEqual(['JEWEL_EV']);
  });

  it('構造: a1 = case:to-resolved selfOnly → discard n1 (D08026 a1 同型)', () => {
    // a1 の行動 (解決編→手札1枚リムーブ) は D08026 a1 と同一テキストの clone。
    // firing 経路 (mutate.case.toResolved) は D08026 で回帰済のため、ここでは配線構造を pin する。
    const a1 = B07061.abilities[0]!;
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'case:to-resolved', selfOnly: true });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'discard', args: { player: 'self', n: 1 } });
  });
});
