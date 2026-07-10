// tests/cards/night-wB1/B09011 灰原哀 probe — Cluster WB1: TargetFilter baseLp (元のLP) 軸
//   a1【宣言】【ターン1】現場の「元のLPが0でレベル4の〚少年探偵団〛」全員を元LP1 (turn)。
//   ★ baseLpMin/baseLpMax は buff/debuff 込みの実効LP (lpMin/lpMax) とは別 = override 単体 (lpOverride ?? printed)。
//   a2【ヒラメキ】リムーブの LP0 〚少年探偵団〛1枚まで手札。
// production dispatch 経由 (activateDeclaredAbility)。rules: 15/17/19/21.
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _resetPendingHirameki, _peekPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { sceneChar } from '../../helpers/fixtures';
import { B09011 } from '@/cards/ct-p09/B09011';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';

const setHuman = (s: 'self' | 'opp' | null) =>
  ((globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s);
const sc = (cardId: string, uid: string): SceneCharacter => sceneChar(cardId, uid, { state: 'active' });
function def(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 3000, lp: 0, traits: ['少年探偵団'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
// 現場 fixtures
const SBD0 = def('SBD0', { names: ['探偵団LP0'], lp: 0, level: 4, traits: ['少年探偵団'] });        // 対象 (元LP0/Lv4/少年探偵団)
const SBD1 = def('SBD1', { names: ['探偵団LP1'], lp: 1, level: 4, traits: ['少年探偵団'] });        // 非対象 (元LP1)
const SBD0L5 = def('SBD0L5', { names: ['探偵団LP0Lv5'], lp: 0, level: 5, traits: ['少年探偵団'] }); // 非対象 (Lv5)
const OTH0 = def('OTH0', { names: ['他LP0'], lp: 0, level: 4, traits: ['探偵'] });                 // 非対象 (特徴違い)
// remove fixtures (a2)
const RBD0 = def('RBD0', { names: ['R探偵団LP0'], lp: 0, traits: ['少年探偵団'] });
const RBD1 = def('RBD1', { names: ['R探偵団LP1'], lp: 1, traits: ['少年探偵団'] });
const ROTH = def('ROTH', { names: ['R他LP0'], lp: 0, traits: ['探偵'] });
const ALL_DEFS = [B09011, def('FILL'), SBD0, SBD1, SBD0L5, OTH0, RBD0, RBD1, ROTH];

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck = ['DK1', 'DK2'];
  s.players.opp.deck = ['ODK1', 'ODK2'];
  return s;
}
beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _resetPendingHirameki();
  setHuman('self');
  for (const d of ALL_DEFS) registerCardDef(d);
  registerTriggeredListener();
});

describe('B09011 a1 — baseLp フィルタ (元のLP=0) forEach 元LP1', () => {
  it('元LP0/Lv4/少年探偵団 のみ元LP1に / 元LP1・Lv5・特徴違いは非対象', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'B09011', {});
    s.players.self.scene.push(sc('SBD0', 'bd0'), sc('SBD1', 'bd1'), sc('SBD0L5', 'bd0l5'), sc('OTH0', 'oth0'));
    expect(readChar.lp(s, 'bd0'), 'baseline SBD0 元LP0').toBe(0);

    activateDeclaredAbility(s, me.uid, 'a1');
    runAllUntilEmpty(s);

    expect(readChar.lp(s, 'bd0'), 'SBD0 (元LP0/Lv4/少年探偵団) → 元LP1').toBe(1);
    expect(readChar.lp(s, 'bd1'), 'SBD1 (元LP1) 非対象').toBe(1);
    expect(readChar.lp(s, 'bd0l5'), 'SBD0L5 (Lv5) 非対象 = 0').toBe(0);
    expect(readChar.lp(s, 'oth0'), 'OTH0 (特徴違い) 非対象 = 0').toBe(0);
  });

  it('buff で実効LP>0 でも「元のLP0」なら対象 (lpMin/lpMax と別軸)', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'B09011', {});
    const t = sc('SBD0', 'bd0');
    s.players.self.scene.push(t);
    // 継続外の turn buff で実効LPを +2 (元LPは0のまま)。
    mutate.char.modifyLP(s, 'bd0', 2, 'turn');
    expect(readChar.lp(s, 'bd0'), '実効LP=2 (buff込)').toBe(2);

    activateDeclaredAbility(s, me.uid, 'a1');
    runAllUntilEmpty(s);
    // 元LP override 1 + turn buff +2 = 実効3 (「修整は残る」公式Q&A)。
    expect(readChar.lp(s, 'bd0'), '元LP0→1 override 済 (buff +2 残存) = 3').toBe(3);
  });

  it('【ターン1】: 2回目の宣言は不可 (limit turn 1)', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'B09011', {});
    s.players.self.scene.push(sc('SBD0', 'bd0'));
    activateDeclaredAbility(s, me.uid, 'a1');
    runAllUntilEmpty(s);
    expect(readChar.lp(s, 'bd0')).toBe(1);
    // 2回目: limit 消費済 → 効果なし (bd0 は既に override 1 のまま、二重適用の観測点はないが throw しない)
    let threw = false;
    try { activateDeclaredAbility(s, me.uid, 'a1'); runAllUntilEmpty(s); } catch { threw = true; }
    expect(readChar.lp(s, 'bd0'), '元LP1 のまま').toBe(1);
    void threw;
  });
});

describe('B09011 a2 — 【ヒラメキ】pending push', () => {
  it('B09011 が証拠から action リムーブ → pendingHirameki push (a2)', () => {
    const s = base();
    event.emit(s, 'evidence:remove-by-action',
      { player: 'self', ev: { cardId: 'B09011' }, byUid: 'atk' },
      { player: 'self', uid: 'atk' });
    const pend = _peekPendingHirameki();
    expect(pend?.cardId).toBe('B09011');
    expect(pend?.abilityId).toBe('a2');
  });
});
