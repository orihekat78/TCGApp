// tests/cards/night-wB1/B09055 世良真純 probe — Cluster WB1: sceneEnter partner-area∪remove union source
//   a2【宣言】: このキャラをリムーブし、PAかリムーブの[赤井秀一&世良真純]1枚まで登場。
// production dispatch (activateDeclaredAbility = cost pay + effect)。rules: 03/15/18/21.
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { sceneChar } from '../../helpers/fixtures';
import { B09055 } from '@/cards/ct-p09/B09055';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) =>
  ((globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s);
const sc = (cardId: string, uid: string): SceneCharacter => sceneChar(cardId, uid, { state: 'active' });
function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const PARTNER_R = def('PARTNER_R', { colors: ['赤'] });
const AKAI = def('AKAI', { names: ['赤井秀一'] });                                       // cost fodder
const AKAISERA = def('AKAISERA', { names: ['赤井秀一&世良真純', '赤井秀一', '世良真純'] }); // 登場対象 (split-name rules/19)
const FB = { type: 'card-back' as const, cardId: 'FILL' };
const ALL_DEFS = [B09055, def('FILL'), PARTNER_R, AKAI, AKAISERA, def('DECOY_PA_ONLY', { names: ['囮'] })];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['DK1', 'DK2'];
  s.players.opp.deck = ['ODK1', 'ODK2'];
  s.players.self.partner.cardId = 'PARTNER_R';                 // 【パートナー赤】
  s.players.self.file = Array.from({ length: 8 }, () => ({ ...FB })); // 【FILE8】
  s.players.self.hand = ['AKAI'];
  s.players.self.scene = [sc('B09055', 'me')];
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

describe('B09055 a2 — union source (PA / remove) から登場', () => {
  it('PA のみに[赤井秀一&世良真純] → PA から splice して登場 / remove 不変', () => {
    const s = base();
    s.players.self.partnerAreaCards = ['AKAISERA'];
    s.players.self.remove = [];
    activateDeclaredAbility(s, 'me', 'a2');
    runAllUntilEmpty(s);
    // cost: 手札 赤井秀一 → remove
    expect(s.players.self.hand, '赤井秀一 が cost で除去').toEqual([]);
    expect(s.players.self.remove, '赤井秀一 が remove へ').toContain('AKAI');
    // 効果: 自身リムーブ → union pick
    expect(s.players.self.scene.some(c => c.uid === 'me'), '世良真純 は自身リムーブ済').toBe(false);
    const pick = _drainPendingEffectPickSide();
    expect(pick?.atomVerb, 'sceneEnter union pick surface').toBe('sceneEnter');
    const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
    expect(cands.map(c => c.cardId), '候補 = PA の AKAISERA のみ').toEqual(['AKAISERA']);
    applyPickAndContinuation(s, pick!, cands[0]!.uid, [cands[0]!.uid]);
    runAllUntilEmpty(s);
    expect(s.players.self.scene.map(c => c.cardId), 'AKAISERA が現場へ登場').toContain('AKAISERA');
    expect(s.players.self.partnerAreaCards, 'PA から splice 済').toEqual([]);
  });

  it('remove のみに[赤井秀一&世良真純] → remove から splice して登場 / PA 不変', () => {
    const s = base();
    s.players.self.partnerAreaCards = ['DECOY_PA_ONLY'];
    s.players.self.remove = ['AKAISERA'];
    activateDeclaredAbility(s, 'me', 'a2');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
    expect(cands.map(c => c.cardId), '候補 = remove の AKAISERA のみ (PA decoy 除外)').toEqual(['AKAISERA']);
    applyPickAndContinuation(s, pick!, cands[0]!.uid, [cands[0]!.uid]);
    runAllUntilEmpty(s);
    expect(s.players.self.scene.map(c => c.cardId), 'AKAISERA 登場').toContain('AKAISERA');
    expect(s.players.self.remove.filter(x => x === 'AKAISERA'), 'remove から splice 済 (AKAISERA 消える)').toEqual([]);
    expect(s.players.self.partnerAreaCards, 'PA decoy 不変').toEqual(['DECOY_PA_ONLY']);
  });

  it('0枚選択 (skip) → 登場せず両 zone 不変 (rules/15「まで」)', () => {
    const s = base();
    s.players.self.partnerAreaCards = ['AKAISERA'];
    s.players.self.remove = [];
    activateDeclaredAbility(s, 'me', 'a2');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'pick surface').toBeTruthy();
    // skip = pending drop (applyPickAndContinuation を呼ばない)
    runAllUntilEmpty(s);
    expect(s.players.self.scene.some(c => c.cardId === 'AKAISERA'), '登場しない').toBe(false);
    expect(s.players.self.partnerAreaCards, 'PA 不変').toEqual(['AKAISERA']);
  });
});
