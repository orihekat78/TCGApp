// B03066 赤井秀一 (ct-p03) — ENGINE0 wave 専用 test。
// a1 = partnerColorKeyword(赤, 突撃[事件]) [共通クラス、B08007 同型] — 構造 + runtime hasKeyword gate。
// a2 = 【登場時】optional[ evidenceGain opp, sceneRemove lv7以下 1まで either ] [B01069+B07080 twin]
//      — 実 flow (handUseCard → enter → applyOptionalAndContinuation する/しない) + decoy。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry, register as registerCardDef } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest, applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { _peekPendingEffectOptionalSide, _clearPendingEffectOptionalSide, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { char as readChar } from '@/engine/read/char';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { B03066 } from '@/cards/ct-p03/B03066';
import { B03066P } from '@/cards/ct-p03/B03066P';
import { sceneChar as baseScene } from '../../helpers/fixtures';

const FB = { type: 'card-back' as const, cardId: 'D08017' };
const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter => baseScene(cardId, uid, { state });
function def(id: string, colors: string[], level: number): CardDef {
  return { id, no: 'NO', kind: 'character', names: [id], colors, level, ap: 4000, lp: 1, traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s; };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetCardDefRegistry();
  registerCardDef(B03066);
  registerCardDef(B03066P);
  registerCardDef(def('REDP', ['赤'], 9));
  registerCardDef(def('GREENP', ['緑'], 9));
  registerCardDef(def('TGT7', ['黒'], 7));   // sceneRemove 対象 (lv7≤)
  registerCardDef(def('DECOY8', ['黒'], 8));  // decoy (lv8 = levelMax:7 で除外)
  registerCardDef(def('D08017', ['赤'], 4));  // 汎用 (deck/file filler)
  registerTriggeredListener();
  _clearPendingEffectOptionalSide();
  _clearPendingEffectPickQueue();
  setHuman(null);
});

describe('B03066 構造 (authoring 1対1)', () => {
  it('meta + abilities', () => {
    expect(B03066.no).toBe('0320/B03066');
    expect(B03066.traits).toEqual(['FBI', '赤井家']);
    expect(B03066.level).toBe(8);
    expect(B03066P.no).toBe('0320/B03066P');
    const a1 = B03066.abilities[0];
    expect(a1.type).toBe('continuous');
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '赤' });
    const a2 = B03066.abilities[1];
    expect(a2.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    const steps = ((a2.effect as { effect: { steps: Array<{ verb: string; args: Record<string, unknown> }> } }).effect).steps;
    expect(steps[0]).toMatchObject({ verb: 'evidenceGain', args: { player: 'opp', n: 1 } });
    expect(steps[1]).toMatchObject({ verb: 'sceneRemove', args: { player: 'self', max: 1, side: 'either', filter: { levelMax: 7 } } });
  });
});

describe('B03066 a1 — partnerColorKeyword(赤, 突撃[事件]) runtime gate', () => {
  it('【パートナー赤】成立 → 突撃[事件] を持つ', () => {
    const s = createEmptyGameState();
    s.players.self.partner.cardId = 'REDP';
    s.players.self.scene = [sc('B03066', 'akai')];
    expect(readChar.hasKeyword(s, 'akai', '突撃[事件]')).toBe(true);
  });
  it('【パートナー赤】不成立 (緑) → 突撃[事件] を持たない (持っていない扱い)', () => {
    const s = createEmptyGameState();
    s.players.self.partner.cardId = 'GREENP';
    s.players.self.scene = [sc('B03066', 'akai')];
    expect(readChar.hasKeyword(s, 'akai', '突撃[事件]')).toBe(false);
  });
});

describe('B03066 a2 — 【登場時】optional[evidenceGain opp, sceneRemove lv7以下]', () => {
  const base = (): GameState => {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B03066'];
    s.players.self.case.colors = ['赤'];
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB, FB]; // lv8 hand-use 用に FILE 8
    s.players.self.deck = ['D08017', 'D08017'];
    s.players.opp.deck = ['D08017', 'D08017']; // evidenceGain opp 用
    s.players.opp.scene = [sc('TGT7', 'tgt'), sc('DECOY8', 'decoy')]; // lv7 対象 + lv8 decoy
    return s;
  };

  it('する → 相手に証拠+1 + lv7以下キャラ(tgt)をリムーブ (lv8 decoy は残る)', () => {
    setHuman('self');
    const s = produce(base(), (d) => {
      handUseCard(d, 'self', 'B03066'); runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true);
      _drainAllEffectPicksForTest(d);
    });
    expect(s.players.opp.evidence.length, '相手証拠+1').toBe(1);
    expect(s.players.opp.scene.some((c) => c.cardId === 'TGT7'), 'lv7 tgt removed').toBe(false);
    expect(s.players.opp.scene.some((c) => c.cardId === 'DECOY8'), 'lv8 decoy 残存').toBe(true);
  });

  it('しない → 相手証拠 0 + 誰もリムーブされない', () => {
    setHuman('self');
    const s = produce(base(), (d) => {
      handUseCard(d, 'self', 'B03066'); runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      applyOptionalAndContinuation(d, p!, false);
    });
    expect(s.players.opp.evidence.length, 'しない: 相手証拠 0').toBe(0);
    expect(s.players.opp.scene.length, 'しない: 誰もリムーブされない').toBe(2);
  });
});
