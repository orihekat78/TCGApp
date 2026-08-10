// tests/cards/night-wC/hirameki-optional — ヒラメキ top-level optional の humanChooser 解禁 (Wave C Task 2)
// fix: useEngineDispatch.hiramekiResolve が human 所有時 humanChooser:true を渡し、effect 内 top-level
//   optional (「手札を1枚リムーブしてもよい。そうした場合〜」) を pendingEffectOptional として surface する。
//   従来は humanChooser 不在で optional が AI-skip collapse → 再生/スタン効果が無音 no-op (BUG-145 同族)。
// production 経路 (B05015 harness 準拠): emit 'evidence:remove-by-action' → pendingHirameki →
//   dispatch hiramekiResolve(fire) → pendingEffectOptional surface → optionalResolve(run) → chain (discard→revive/stun)。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { registerHiramekiListener, _drainPendingHirameki, _resetPendingHirameki, _resetHiramekiRegistered } from '@/engine/listeners/hirameki';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { validateCards } from '@/engine/effect/validate';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve';
import { _clearPendingEffectOptionalSide, _drainPendingEffectOptionalSide, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { applyOptionalAndContinuation, applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { B06032 } from '@/cards/ct-p06/B06032';
import { B09081 } from '@/cards/ct-p09/B09081';
import { B08006 } from '@/cards/ct-p08/B08006';
import type { GameState, CardDef, SceneCharacter } from '@/engine/types';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { openCaseHirameki } from '../../helpers/open-case-hirameki';

type Player = 'self' | 'opp';
const setHuman = (v: Player | null) => { (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = v; };
const chDef = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const sc = (cardId: string, uid: string, state: 'active' | 'sleep' | 'stun' = 'active'): SceneCharacter =>
  ({
    cardId, uid, state, isNamed: false, enterOrder: 0, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  } as SceneCharacter);

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetHiramekiRegistered(); _resetPendingHirameki();
  resetDefRegistry(); _resetUidCounter(); _clearPendingEffectPickQueue(); _clearPendingEffectOptionalSide();
  registerCardDef(B06032); registerCardDef(B09081); registerCardDef(B08006);
  registerCardDef(chDef('YAIBA5', { names: ['武蔵'], level: 5, traits: ['YAIBA'] }));   // 対象 (Lv5 YAIBA)
  registerCardDef(chDef('YAIBA6', { names: ['小次郎'], level: 6, traits: ['YAIBA'] }));  // levelMax5 除外 (level decoy)
  registerCardDef(chDef('NONYAIBA', { names: ['歩美'], level: 3, traits: [] }));         // trait 不一致 除外
  registerCardDef(chDef('ROKUE', { names: ['知苑禄江'], level: 4 }));                     // B09081 a1 対象
  registerCardDef(chDef('OTHERNAME', { names: ['別人'], level: 4 }));                     // cardName 不一致 除外
  registerCardDef(chDef('HAND1', { names: ['捨て札'] }));
  registerCardDef(chDef('HAND_ROKUE', { names: ['知苑禄江'], level: 4 }));
  registerCardDef(chDef('ATK', { names: ['攻撃者'], ap: 5000 }));
  registerTriggeredListener(); registerHiramekiListener();
  useGameStateStore.setState({ gameState: null, activeActionId: null, pendingHirameki: null, pendingMisread: null, pendingEffectPick: null, pendingEffectOptional: null });
});

// evidence:remove-by-action を emit → pendingHirameki を store に載せ hiramekiResolve(fire) を dispatch。
function fireHirameki(s: GameState, ownerCardId: string, actorUid = 'atk'): void {
  const { pending } = openCaseHirameki(s, ownerCardId, { actorUid });
  expect(pending, 'ヒラメキ optional hook 検出').not.toBeNull();
  const r = dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' });
  expect(r.ok, 'hiramekiResolve fire ok').toBe(true);
}
const store = () => useGameStateStore.getState();

describe('B09081 a1 enter trigger', () => {
  it('enters the same Chien Rokue card that its own cost just discarded', () => {
    setHuman('self');
    const state = createEmptyGameState();
    state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    state.players.self.scene = [sc('B09081', 'b09081')];
    state.players.self.hand = ['HAND_ROKUE'];
    state.players.self.remove = ['OTHERNAME'];

    event.emit(
      state,
      'enter',
      { uid: 'b09081', viaEffect: false, enterOrder: 1, enterOrderThisTurn: 1 },
      { player: 'self', uid: 'b09081', cardId: 'B09081' },
    );
    runAllUntilEmpty(state);

    const optional = _drainPendingEffectOptionalSide();
    expect(optional?.source).toMatchObject({ cardId: 'B09081', abilityId: 'a1' });
    applyOptionalAndContinuation(state, optional!, true);

    let pick = _drainPendingEffectPickSide()!;
    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual(['HAND_ROKUE']);
    applyPickAndContinuation(state, pick, pick.candidates[0].uid);

    pick = _drainPendingEffectPickSide()!;
    expect(pick.candidates.map(candidate => candidate.cardId), 'the just-discarded Chien Rokue is eligible').toEqual(['HAND_ROKUE']);
    applyPickAndContinuation(state, pick, pick.candidates[0].uid);

    expect(state.players.self.scene.find(char => char.cardId === 'HAND_ROKUE')?.state, 'the discarded Chien Rokue enters active').toBe('active');
    expect(state.players.self.remove, 'the same occurrence leaves remove').not.toContain('HAND_ROKUE');
    expect(state.players.self.remove, 'different-name character remains in remove').toContain('OTHERNAME');
  });
});

describe('validate / shape', () => {
  it('B06032 / B09081 が validateCards を通る', () => {
    expect(validateCards([B06032]).ok).toBe(true);
    expect(validateCards([B09081]).ok).toBe(true);
  });
  it('B06032 ヒラメキ effect が top-level optional (chain[discard, sceneEnter])', () => {
    expect((B06032.abilities[0].effect as { kind?: string }).kind).toBe('optional');
  });
});

describe('B06032 ヒラメキ (human) — 手札1リムーブ→[YAIBA]Lv5をスリープ登場 (humanChooser 解禁)', () => {
  function boardResolved(): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    mutate.case.toResolved(s, 'self'); // 【解決編】condition
    s.players.self.evidence = [{ cardId: 'B06032', faceUp: false, origin: { turn: 1, via: 'reasoning' } }] as GameState['players']['self']['evidence'];
    s.players.self.remove = ['YAIBA5', 'YAIBA6', 'NONYAIBA'];
    s.players.self.hand = ['HAND1'];
    s.players.self.deck = ['D1', 'D2'];
    s.players.opp.scene = [sc('ATK', 'atk')];
    return s;
  }

  it('fix: fire → top-level optional が pendingEffectOptional に surface する', () => {
    setHuman('self');
    fireHirameki(boardResolved(), 'B06032');
    expect(store().pendingEffectOptional, '「手札を1枚リムーブしてもよい」が human に surface (旧: AI-skip collapse)').not.toBeNull();
  });

  it('run:true → discard→sceneEnter pick で Lv5[YAIBA]のみ登場 (スリープ)、decoy は remove 残存', () => {
    setHuman('self');
    fireHirameki(boardResolved(), 'B06032');
    expect(dispatchCurrentDecision({ type: 'optionalResolve', run: true }).ok).toBe(true);
    // discard pick (HAND1) を解決
    let pick = store().pendingEffectPick!;
    expect(pick, 'discard pick surface').not.toBeNull();
    expect(pick.candidates.map((c) => c.cardId)).toEqual(['HAND1']);
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pick.candidates[0].uid }).ok).toBe(true);
    // sceneEnter pick (Lv5 YAIBA のみ) を解決
    pick = store().pendingEffectPick!;
    expect(pick, 'sceneEnter pick surface').not.toBeNull();
    expect(pick.candidates.map((c) => c.cardId), 'filter 実評価: Lv5 YAIBA のみ').toEqual(['YAIBA5']);
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pick.candidates[0].uid }).ok).toBe(true);
    const after = store().gameState!;
    const revived = after.players.self.scene.find((c) => c.cardId === 'YAIBA5');
    expect(revived, 'YAIBA5 が登場').toBeTruthy();
    expect(revived!.state, 'スリープ状態で登場').toBe('sleep');
    expect(after.players.self.remove).not.toContain('YAIBA5');
    expect(after.players.self.remove, 'Lv6 YAIBA は残存').toContain('YAIBA6');
    expect(after.players.self.remove, '非YAIBA は残存').toContain('NONYAIBA');
    expect(after.players.self.hand, 'HAND1 は discard 済').not.toContain('HAND1');
  });

  it('run:false (decline) → discard なし・登場なし (「してもよい」= 0 選択)', () => {
    setHuman('self');
    fireHirameki(boardResolved(), 'B06032');
    expect(dispatchCurrentDecision({ type: 'optionalResolve', run: false }).ok).toBe(true);
    expect(store().pendingEffectPick, 'pick は surface しない').toBeNull();
    const after = store().gameState!;
    expect(after.players.self.scene.some((c) => c.cardId === 'YAIBA5'), '登場なし').toBe(false);
    expect(after.players.self.hand, 'HAND1 は手札に残存').toContain('HAND1');
    expect([...after.players.self.remove].sort()).toEqual(['B06032', 'NONYAIBA', 'YAIBA5', 'YAIBA6']);
  });

  it('【解決編】未達では ヒラメキ発動せず (condition gate)', () => {
    setHuman('self');
    const s = boardResolved();
    s.players.self.case.status = '事件編'; // 解決編 でない
    event.emit(s, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B06032' } }, { player: 'opp', uid: 'atk' });
    expect(_drainPendingHirameki(), '事件編では本文が無効なpendingHirameki').toMatchObject({ effectValid: false });
  });
});

describe('B09081 a2 ヒラメキ (human) — 手札1リムーブ→アクション中のキャラをスタン', () => {
  function board(): GameState {
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.evidence = [{ cardId: 'B09081', faceUp: false, origin: { turn: 1, via: 'reasoning' } }] as GameState['players']['self']['evidence'];
    s.players.self.hand = ['HAND1'];
    s.players.self.deck = ['D1', 'D2'];
    s.players.opp.scene = [sc('ATK', 'atk')]; // アクション[事件] actor
    return s;
  }
  it('fire → optional surface → run:true で discard→$trigger.byUid をスタン', () => {
    setHuman('self');
    fireHirameki(board(), 'B09081', 'atk');
    expect(store().pendingEffectOptional, 'optional surface').not.toBeNull();
    expect(dispatchCurrentDecision({ type: 'optionalResolve', run: true }).ok).toBe(true);
    const pick = store().pendingEffectPick!;
    expect(pick.candidates.map((c) => c.cardId)).toEqual(['HAND1']); // discard pick
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: pick.candidates[0].uid }).ok).toBe(true);
    const after = store().gameState!;
    expect(after.players.opp.scene.find((c) => c.uid === 'atk')!.state, 'アクション中のキャラ(atk)がスタン').toBe('stun');
  });
  it('decline → スタンなし・手札残存', () => {
    setHuman('self');
    fireHirameki(board(), 'B09081', 'atk');
    expect(dispatchCurrentDecision({ type: 'optionalResolve', run: false }).ok).toBe(true);
    const after = store().gameState!;
    expect(after.players.opp.scene.find((c) => c.uid === 'atk')!.state).toBe('sleep');
    expect(after.players.self.hand).toContain('HAND1');
  });
});

describe('B08006 a2 ヒラメキ — アクション中のキャラをスタン', () => {
  it('実カードの public action 経路で actor をスタンし、次の active 化を sleep に置換する', () => {
    setHuman('self');
    const s = createEmptyGameState();
    s.turn = { number: 5, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    mutate.case.toResolved(s, 'self');
    s.players.self.evidence = [{ cardId: 'B08006', faceUp: false, origin: { turn: 1, via: 'reasoning' } }] as GameState['players']['self']['evidence'];
    s.players.self.deck = ['D1', 'D2'];
    s.players.opp.scene = [sc('ATK', 'atk')];

    const opened = openCaseHirameki(s, 'B08006', { actorUid: 'atk' });
    expect(opened.pending).toMatchObject({
      player: 'self',
      cardId: 'B08006',
      abilityId: 'a2',
      actorUid: 'atk',
      actionId: opened.actionId,
    });
    expect(opened.pending.causalCorrelationEventId, 'CASE 証拠除去との因果相関を持つ').toEqual(expect.any(String));
    expect(dispatchCurrentDecision({ type: 'hiramekiResolve', choice: 'fire' })).toEqual({ ok: true });
    const after = store().gameState!;
    expect(after.players.opp.scene.find(c => c.uid === 'atk')?.state, 'B08006 のヒラメキで action actor をスタン').toBe('stun');
    expect(after.log).toContainEqual(expect.objectContaining({
      schemaVersion: 1,
      actor: 'self',
      kind: 'stun',
      targets: [expect.objectContaining({
        kind: 'card',
        side: 'opp',
        zone: 'scene',
        cardNumber: 'ATK',
      })],
      outcome: { type: 'state', state: 'stun' },
    }));

    const activated = produce(after, (d) => { mutate.scene.tryActivate(d, 'atk'); });
    expect(activated.players.opp.scene.find(c => c.uid === 'atk')?.state, 'スタン中の active 化は sleep に置換').toBe('sleep');
  });
});
