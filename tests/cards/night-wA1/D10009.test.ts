// tests/cards/night-wA1/D10009 — 工藤新一 probe (engine A1 wave: charStackCard scene-source 方向)
//   a0 自ターン終了時 現場に〚毛利蘭〛不在 → 自身リムーブ / a1【パートナー青】【登場時】AP8000以下1枚デッキ下 /
//   a2【事件シャッフルロマンス】【宣言】【ターン1】〚毛利蘭〛1枚を this の下に重ねる → 重ねた場合 突撃[キャラ]。
// production dispatch 経由 (event.emit enter / activateDeclaredAbility + runAllUntilEmpty)。
// rules: 05 (turn-end) / 13 (突撃[キャラ]) / 15 (「まで」=0可) / 16 (重ねる = 情報喪失) / 17 (事件特徴/パートナー色)
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { char as charRead } from '@/engine/read/char';
import { D10009 } from '@/cards/ct-d10/D10009';
import type { CardDef, GameState } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['青'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const PBLUE: CardDef = { id: 'PBLUE', no: 'PBLUE', kind: 'partner', names: ['P青'], colors: ['青'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const PRED: CardDef = { id: 'PRED', no: 'PRED', kind: 'partner', names: ['P赤'], colors: ['赤'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const CASE_SR: CardDef = { id: 'CASE_SR', no: 'CASE_SR', kind: 'case', names: ['事件'], colors: ['青'], traits: [], caseTraits: ['シャッフルロマンス'], caseLevel: 7, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const CASE_PLAIN: CardDef = { id: 'CASE_PLAIN', no: 'CASE_PLAIN', kind: 'case', names: ['事件'], colors: ['青'], traits: [], caseTraits: [], caseLevel: 7, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const FIXTURES: CardDef[] = [
  D10009, PBLUE, PRED, CASE_SR, CASE_PLAIN,
  ch('RAN', { names: ['毛利蘭'] }), ch('DECOY', { names: ['デコイ'] }),
  ch('AP7', { ap: 7000 }), ch('AP9', { ap: 9000 }),
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

function base(caseId = 'CASE_SR', partnerId = 'PBLUE'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.partner = { cardId: partnerId, state: 'active', location: 'partner-area' } as never;
  s.players.self.case = { cardId: caseId, status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} } as GameState['players']['self']['case'];
  return s;
}

describe('D10009 a2 — charStackCard scene-source (毛利蘭 を this の下へ重ねる)', () => {
  it('〚毛利蘭〛を pick → host stacked+1 + 毛利蘭 現場離脱 + 突撃[キャラ] 付与 (decoy/self 非候補)', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'D10009', {});
    const ran = mutate.scene.enter(s, 'self', 'RAN', {});
    mutate.scene.enter(s, 'self', 'DECOY', {});
    expect(canDeclaredAbility(s, me.uid, 'a2'), '【事件シャッフルロマンス】成立で宣言可').toBe(true);
    activateDeclaredAbility(s, me.uid, 'a2');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'scene-source pick surface').toBeTruthy();
    expect(pick!.nMin, '「1枚まで」').toBe(0);
    expect(pick!.nMax).toBe(1);
    const cands = pick!.candidates as Array<{ uid: string; cardId: string }>;
    expect(cands.map(c => c.cardId), '候補 = 毛利蘭 のみ (host自身/decoy 除外)').toEqual(['RAN']);
    applyPickAndContinuation(s, pick!, ran.uid, [ran.uid]);
    runAllUntilEmpty(s);
    const host = s.players.self.scene.find(c => c.uid === me.uid)!;
    expect(Array.isArray(host.stackedCards) ? host.stackedCards.length : host.stackedCards, 'host stacked +1').toBe(1);
    expect(s.players.self.scene.find(c => c.uid === ran.uid), '毛利蘭 現場離脱').toBeUndefined();
    expect(charRead.keywords(s, me.uid), '重ねた → 突撃[キャラ] 付与 (turn)').toContain('突撃[キャラ]');
  });

  it('0枚選択 (skip) → 重ねず 突撃[キャラ] 付与なし (「重ねた場合」gate)', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'D10009', {});
    mutate.scene.enter(s, 'self', 'RAN', {});
    activateDeclaredAbility(s, me.uid, 'a2');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'pick surface').toBeTruthy();
    runAllUntilEmpty(s); // skip = 適用しない
    const host = s.players.self.scene.find(c => c.uid === me.uid)!;
    expect(host.stackedCards, '重なっていない').toBe(0);
    expect(charRead.keywords(s, me.uid), '突撃[キャラ] 付与なし').not.toContain('突撃[キャラ]');
  });

  it('【事件シャッフルロマンス】不成立 (特徴なし事件) → 宣言不可 (rules/17)', () => {
    const s = base('CASE_PLAIN');
    const me = mutate.scene.enter(s, 'self', 'D10009', {});
    mutate.scene.enter(s, 'self', 'RAN', {});
    expect(canDeclaredAbility(s, me.uid, 'a2')).toBe(false);
  });

  it('重ねられた〚毛利蘭〛の setCards はリムーブへ (rules/16)', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'D10009', {});
    const ran = mutate.scene.enter(s, 'self', 'RAN', {});
    mutate.char.setCard(s, ran.uid, 'DECOY', false); // 毛利蘭 に1枚セット
    activateDeclaredAbility(s, me.uid, 'a2');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    applyPickAndContinuation(s, pick!, ran.uid, [ran.uid]);
    runAllUntilEmpty(s);
    expect(s.players.self.remove, 'セットカードはリムーブへ').toContain('DECOY');
  });
});

describe('D10009 a0 — 自ターン終了時 現場に〚毛利蘭〛不在 → 自身リムーブ', () => {
  it('毛利蘭 不在 (自ターン終了) → リムーブ', () => {
    setHuman(null);
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'D10009', {});
    event.emit(s, 'phase:end:start', {}, { player: 'self', cardId: 'D10009', uid: me.uid });
    runAllUntilEmpty(s);
    expect(s.players.self.scene.find(c => c.uid === me.uid), '毛利蘭 不在 → 自身リムーブ').toBeUndefined();
  });

  it('毛利蘭 が現場にいる → リムーブされない', () => {
    setHuman(null);
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'D10009', {});
    mutate.scene.enter(s, 'self', 'RAN', {});
    event.emit(s, 'phase:end:start', {}, { player: 'self', cardId: 'D10009', uid: me.uid });
    runAllUntilEmpty(s);
    expect(s.players.self.scene.find(c => c.uid === me.uid), '毛利蘭 在場 → 残留').toBeTruthy();
  });

  it('毛利蘭 が下に重なっているだけ (現場不在) → リムーブされる (公式Q&A: 重なりは情報なし)', () => {
    setHuman(null);
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'D10009', {});
    const ran = mutate.scene.enter(s, 'self', 'RAN', {});
    // 毛利蘭 を host の下へ重ねる (a2 相当) → 現場から消える
    mutate.scene.toStack(s, ran.uid, me.uid);
    event.emit(s, 'phase:end:start', {}, { player: 'self', cardId: 'D10009', uid: me.uid });
    runAllUntilEmpty(s);
    expect(s.players.self.scene.find(c => c.uid === me.uid), '重なりは bond 非該当 → リムーブ').toBeUndefined();
  });
});

describe('D10009 a1 — 【パートナー青】【登場時】AP8000以下1枚デッキ下', () => {
  it('青パートナー: AP8000以下のみ候補 (AP9000 除外) → デッキ下', () => {
    const s = base('CASE_SR', 'PBLUE');
    mutate.scene.enter(s, 'self', 'AP7', {});
    mutate.scene.enter(s, 'self', 'AP9', {});
    const me = mutate.scene.enter(s, 'self', 'D10009', {});
    event.emit(s, 'enter', { uid: me.uid, viaEffect: false }, { player: 'self', cardId: 'D10009', uid: me.uid });
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'a1 pick surface').toBeTruthy();
    const cands = (pick!.candidates as Array<{ cardId: string }>).map(c => c.cardId);
    expect(cands, 'AP7000 は候補 / AP9000 除外').toContain('AP7');
    expect(cands, 'AP9000 除外').not.toContain('AP9');
  });

  it('赤パートナー: 【パートナー青】不成立 → 発動しない', () => {
    const s = base('CASE_SR', 'PRED');
    const me = mutate.scene.enter(s, 'self', 'D10009', {});
    event.emit(s, 'enter', { uid: me.uid, viaEffect: false }, { player: 'self', cardId: 'D10009', uid: me.uid });
    runAllUntilEmpty(s);
    expect(_drainPendingEffectPickSide(), 'pick 出ない').toBeNull();
  });
});
