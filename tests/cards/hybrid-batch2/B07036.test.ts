// hybrid-batch2 probe — B07036 中森青子 (character, 白 L6)
// 公式テキスト:
//   【解決編】【登場時】自分の現場にいる【白】のキャラを1枚スリープさせ、手札を1枚リムーブしてもよい。
//   そうした場合、レベル7以下のキャラを1枚まで選び、リムーブする。この効果によって〚カード名［黒羽快斗］〛
//   をスリープさせた場合、カードを1枚引く。
// DSL: triggered enter(selfOnly) + condition caseStatus解決編
//      → optional{chain[ sceneSetState{sleep, side:self, filter:{color:白}, n:1, bind:$slept},
//                        discard 1,
//                        sequence[ sceneRemove{max:1, side:either, cause:effect, filter:{levelMax:7}},
//                                  conditional{if boundMatchesFilter($slept, cardName:黒羽快斗) → draw 1} ] ]}
//
// production 経路: enter hook emit = src/engine/effect/atom-handlers/scene.ts:76/230/266 (登場キャラ source)。
//   selfOnly は selfOnlyMatches (source.uid===card.uid, triggered.ts:223)。payload shape 丸写しで emit。
// caseStatus 解決編 = d.players.self.case.status='解決編' (B06006 probe と同型)。
// human 経路: setGameState(mid) → surfacePendingSideChannels → optionalResolve(run) → effectPickResolve 連鎖
//   (engine-mega-w3 B09004 exemplar と同型)。
// ⚠ 注記: B07036 自身が【白】L6 のため、sleep 候補には常に自分自身 (aoko) が含まれる。
//   → 「自分の現場に【白】キャラが居ない」= sleep 候補 0 は本カード単体では発生し得ない (report 参照)。
//   test5 は a1 を **非白 carrier** に載せた合成 def で「chain 第1 step unpayable → chain no-op」engine 挙動を pin。
// rules: 01/03/15/17/19

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { dispatchEngineAction, surfacePendingSideChannels } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';
import type { AbilityDef, CardDef, GameState, SceneCharacter } from '@/engine/types';
import { B07036 } from '@/cards/ct-p07/B07036';

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (s: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = s; };

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['白'], level: 5, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});

// 合成 def
const KAITO = mkChar('KAITO', { names: ['黒羽快斗'], colors: ['白'], level: 5 }); // 白・黒羽快斗 (draw トリガ)
const WOTHER = mkChar('WOTHER', { names: ['白井探偵'], colors: ['白'], level: 5 }); // 白・非黒羽快斗
const TGT = mkChar('TGT', { colors: ['黒'], level: 5 });   // opp 現場: level7以下 → sceneRemove 候補
const DECOY = mkChar('DECOY', { colors: ['黒'], level: 8 }); // opp 現場: level8 → levelMax:7 除外 decoy
const OTHER = mkChar('OTHER', { colors: ['黒'], level: 3 }); // 能力なし別キャラ (selfOnly 検証)
const HANDCARD = mkChar('HANDCARD');
const MOB = mkChar('MOB');

// test5 用: a1 と同一 effect を **非白** キャラに載せた carrier (自身が sleep 候補にならない → 候補 0 を作れる)
const a1Effect = (B07036.abilities[0] as AbilityDef).effect;
const NONWHITE_CARRIER = mkChar('NONWHITE_CARRIER', {
  colors: ['黒'], level: 5,
  abilities: [{
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'enter', selfOnly: true },
    condition: { kind: 'caseStatus', status: '解決編' },
    effect: a1Effect,
    description: '(test carrier: B07036 a1 effect on 黒 char)', ruleRefs: [],
  } as AbilityDef],
});

const DEFS = [B07036, KAITO, WOTHER, TGT, DECOY, OTHER, HANDCARD, MOB, NONWHITE_CARRIER];

function base(status: '事件編' | '解決編' = '解決編'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.case.status = status;
  s.players.self.deck = ['MOB', 'MOB', 'MOB', 'MOB'];
  s.players.opp.deck = ['MOB', 'MOB'];
  return s;
}

// 登場キャラ source で enter hook を emit (scene.ts:230 の payload shape 丸写し)。
function emitEnter(d: GameState, uid: string, cardId: string, player: 'self' | 'opp' = 'self') {
  event.emit(
    d,
    'enter',
    { uid, viaEffect: true, enterOrder: 1, enterOrderThisTurn: 1, sourceCardId: undefined },
    { player, uid, cardId },
  );
  runAllUntilEmpty(d);
}

function resetStore() {
  const st = useGameStateStore.getState();
  st.setPendingEffectOptional?.(null as never);
  st.setPendingEffectPick?.(null as never);
}

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  _clearPendingEffectPickQueue();
  const og = globalThis as { __pendingEffectOptionalSide?: unknown; __pendingEffectOptionalResume?: unknown; __pendingEffectOptionalBindings?: unknown };
  og.__pendingEffectOptionalSide = null; og.__pendingEffectOptionalResume = null; og.__pendingEffectOptionalBindings = null;
  resetStore();
  setHuman(null);
  for (const d of DEFS) registerCardDef(d);
  registerTriggeredListener();
});

// ---- helpers: pending pick accessor ----
const pick = () => useGameStateStore.getState().pendingEffectPick;
const opt = () => useGameStateStore.getState().pendingEffectOptional;

describe('B07036 中森青子 a1 — 【解決編】【登場時】 optional[白sleep + discard → lv7以下remove + 黒羽快斗draw]', () => {
  it('1) 事件編: enter しても発動しない (caseStatus 条件不成立、optional surface なし)', () => {
    setHuman('self');
    const s = produce(base('事件編'), (d) => {
      d.players.self.scene = [sceneChar('B07036', 'aoko'), sceneChar('KAITO', 'kaito')];
      emitEnter(d, 'aoko', 'B07036');
    });
    useGameStateStore.getState().setGameState(s);
    surfacePendingSideChannels();
    expect(opt() ?? null, '事件編 → optional 出さない').toBeNull();
    expect(s.players.self.scene.find(c => c.uid === 'kaito')!.state, 'kaito 未 sleep').toBe('active');
  });

  it('selfOnly: 別キャラの enter では B07036 a1 は発動しない', () => {
    setHuman('self');
    const s = produce(base('解決編'), (d) => {
      d.players.self.scene = [sceneChar('B07036', 'aoko'), sceneChar('OTHER', 'other')];
      emitEnter(d, 'other', 'OTHER'); // aoko でない uid で enter
    });
    useGameStateStore.getState().setGameState(s);
    surfacePendingSideChannels();
    expect(opt() ?? null, '別キャラ enter → aoko a1 不発').toBeNull();
  });

  it('2) take: 黒羽快斗(白)を sleep + discard1 → lv7以下 remove (owner=opp pin, lv8 decoy除外) → 黒羽快斗 sleep ⇒ draw1', () => {
    setHuman('self');
    const mid = produce(base('解決編'), (d) => {
      d.players.self.scene = [sceneChar('B07036', 'aoko'), sceneChar('KAITO', 'kaito')];
      d.players.opp.scene = [sceneChar('TGT', 'tgt'), sceneChar('DECOY', 'decoy')];
      d.players.self.hand = ['HANDCARD'];
      emitEnter(d, 'aoko', 'B07036');
    });
    const deckBefore = mid.players.self.deck.length;
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    expect(opt(), '解決編 + optional surface').not.toBeNull();

    // opt-in
    expect(dispatchEngineAction({ type: 'optionalResolve', run: true }).ok).toBe(true);

    // step1: sleep 白 pick (kaito=黒羽快斗 を選ぶ)
    const p1 = pick();
    expect(p1?.atomVerb, 'step1 = sceneSetState(sleep)').toBe('sceneSetState');
    expect(p1!.candidates.some(c => c.uid === 'kaito'), 'kaito が白候補').toBe(true);
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: 'kaito' }).ok).toBe(true);

    // step2: discard hand pick
    const p2 = pick();
    expect(p2?.atomVerb, 'step2 = discard').toBe('discard');
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: p2!.candidates[0]!.uid }).ok).toBe(true);

    // step3: sceneRemove lv7以下 pick (TGT を選ぶ / DECOY(lv8) は候補外)
    const p3 = pick();
    expect(p3?.atomVerb, 'step3 = sceneRemove').toBe('sceneRemove');
    expect(p3!.candidates.some(c => c.uid === 'tgt'), 'TGT(lv5) 候補').toBe(true);
    expect(p3!.candidates.some(c => c.uid === 'decoy'), 'DECOY(lv8) は levelMax:7 で除外').toBe(false);
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: 'tgt' }).ok).toBe(true);

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.find(c => c.uid === 'kaito')!.state, 'kaito sleep').toBe('sleep');
    // discard: HANDCARD が手札から消え remove pile へ (draw1 で MOB が入るため hand.length は 1 に戻る)
    expect(after.players.self.hand.includes('HANDCARD'), 'HANDCARD は discard 済').toBe(false);
    expect(after.players.self.remove.includes('HANDCARD'), 'HANDCARD は remove pile へ').toBe(true);
    expect(after.players.opp.scene.some(c => c.uid === 'tgt'), 'TGT opp現場から remove (owner-pin)').toBe(false);
    expect(after.players.opp.scene.some(c => c.uid === 'decoy'), 'DECOY 現場に残存').toBe(true);
    // 黒羽快斗 を sleep したので draw1 (deck -1、hand へ MOB 追加)
    expect(after.players.self.deck.length, '黒羽快斗 sleep ⇒ draw1 (deck -1)').toBe(deckBefore - 1);
    expect(after.players.self.hand, 'discard(-HANDCARD)+draw(+MOB) の net').toEqual(['MOB']);
  });

  it('3) take (非黒羽快斗を sleep): remove まで進むが draw しない', () => {
    setHuman('self');
    const mid = produce(base('解決編'), (d) => {
      d.players.self.scene = [sceneChar('B07036', 'aoko'), sceneChar('WOTHER', 'wother')];
      d.players.opp.scene = [sceneChar('TGT', 'tgt')];
      d.players.self.hand = ['HANDCARD'];
      emitEnter(d, 'aoko', 'B07036');
    });
    const deckBefore = mid.players.self.deck.length;
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    expect(dispatchEngineAction({ type: 'optionalResolve', run: true }).ok).toBe(true);

    // sleep: 白 wother (非黒羽快斗) を選ぶ
    const p1 = pick();
    expect(p1?.atomVerb).toBe('sceneSetState');
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: 'wother' }).ok).toBe(true);
    // discard
    const p2 = pick();
    expect(p2?.atomVerb).toBe('discard');
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: p2!.candidates[0]!.uid }).ok).toBe(true);
    // sceneRemove
    const p3 = pick();
    expect(p3?.atomVerb).toBe('sceneRemove');
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: 'tgt' }).ok).toBe(true);

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.find(c => c.uid === 'wother')!.state, 'wother sleep').toBe('sleep');
    expect(after.players.opp.scene.some(c => c.uid === 'tgt'), 'TGT remove').toBe(false);
    expect(after.players.self.deck.length, '黒羽快斗 でない ⇒ draw なし').toBe(deckBefore);
  });

  it('4) decline: optional skip → sleep も discard も remove も起きない', () => {
    setHuman('self');
    const mid = produce(base('解決編'), (d) => {
      d.players.self.scene = [sceneChar('B07036', 'aoko'), sceneChar('KAITO', 'kaito')];
      d.players.opp.scene = [sceneChar('TGT', 'tgt')];
      d.players.self.hand = ['HANDCARD'];
      emitEnter(d, 'aoko', 'B07036');
    });
    const deckBefore = mid.players.self.deck.length;
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    expect(opt(), 'surface').not.toBeNull();
    expect(dispatchEngineAction({ type: 'optionalResolve', run: false }).ok).toBe(true);
    expect(pick() ?? null, 'decline → pick 出ない').toBeNull();

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.scene.find(c => c.uid === 'kaito')!.state, 'kaito active のまま').toBe('active');
    expect(after.players.self.hand.length, '手札不変').toBe(1);
    expect(after.players.opp.scene.length, 'opp 現場不変').toBe(1);
    expect(after.players.self.deck.length, 'draw なし').toBe(deckBefore);
  });

  it('5) chain 第1 step (白 sleep) unpayable → chain no-op (discard も起きない) [非白 carrier で pin]', () => {
    setHuman('self');
    // 非白 carrier を登場。白キャラ 0 → sceneSetState{color:白} 候補 0 → chain break。
    const mid = produce(base('解決編'), (d) => {
      d.players.self.scene = [sceneChar('NONWHITE_CARRIER', 'nc'), sceneChar('OTHER', 'blk')]; // 白なし
      d.players.opp.scene = [sceneChar('TGT', 'tgt')];
      d.players.self.hand = ['HANDCARD'];
      emitEnter(d, 'nc', 'NONWHITE_CARRIER');
    });
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    expect(opt(), 'optional 自体は surface (yes/no は payability 非依存)').not.toBeNull();
    expect(dispatchEngineAction({ type: 'optionalResolve', run: true }).ok).toBe(true);

    // 第1 step 候補0 → pick surface せず chain no-op
    expect(pick() ?? null, '白候補0 → pick 出ない').toBeNull();
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.hand.length, 'chain break ⇒ discard 起きない (手札不変)').toBe(1);
    expect(after.players.opp.scene.some(c => c.uid === 'tgt'), 'remove も起きない').toBe(true);
  });

  it('6) sceneRemove「1枚まで」= 0枚 skip 可。黒羽快斗 sleep 済 ⇒ 0 remove でも draw する', () => {
    setHuman('self');
    const mid = produce(base('解決編'), (d) => {
      d.players.self.scene = [sceneChar('B07036', 'aoko'), sceneChar('KAITO', 'kaito')];
      d.players.opp.scene = [sceneChar('TGT', 'tgt')];
      d.players.self.hand = ['HANDCARD'];
      emitEnter(d, 'aoko', 'B07036');
    });
    const deckBefore = mid.players.self.deck.length;
    useGameStateStore.getState().setGameState(mid);
    surfacePendingSideChannels();
    expect(dispatchEngineAction({ type: 'optionalResolve', run: true }).ok).toBe(true);

    // sleep 黒羽快斗
    expect(pick()?.atomVerb).toBe('sceneSetState');
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: 'kaito' }).ok).toBe(true);
    // discard
    expect(pick()?.atomVerb).toBe('discard');
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: pick()!.candidates[0]!.uid }).ok).toBe(true);
    // sceneRemove → skip (0枚)
    const p3 = pick();
    expect(p3?.atomVerb, 'step3 = sceneRemove').toBe('sceneRemove');
    expect(p3!.nMin, 'sceneRemove min=0 (「1枚まで」)').toBe(0);
    expect(dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null }).ok).toBe(true);

    const after = useGameStateStore.getState().gameState!;
    expect(after.players.opp.scene.some(c => c.uid === 'tgt'), 'skip → TGT 残存 (0 remove)').toBe(true);
    expect(after.players.self.deck.length, '0 remove でも 黒羽快斗 sleep ⇒ draw1').toBe(deckBefore - 1);
  });
});
