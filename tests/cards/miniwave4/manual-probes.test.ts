// tests/cards/miniwave4/manual-probes — hand 内 continuous level (mini-wave #4) consumer 実カード probe
//   B01009 工藤新一 (lvlOverrideInHand:4 + 宣言 selfToDeckBottom→LP0以下青アクティブ) /
//   B09095 ベルモット (lvlDeltaInHand:-2 + 登場時 痕跡未発見 mill opp 2)。
//   production 経路: canHandUseCard / runNextHint (gate) + activateDeclaredAbility + runAllUntilEmpty (宣言) +
//   event.emit('enter', production payload) (登場時)。engine / src/cards は変更しない (probe のみ)。
// rules: 03 (スタン特殊) / 12 (レベル≤FILE) / 14 (mill→refresh) / 15 (「まで」=0可・either) / 17 / 19 (下限なし) / 21 (コスト)
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { canHandUseCard, effectiveHandLevel } from '@/engine/flow/main/hand-use-card';
import { runNextHint } from '@/engine/flow/main/next-hint';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import {
  _drainPendingEffectPickSide,
  _clearPendingEffectPickQueue,
} from '@/engine/effect/pending-state';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { B01009 } from '@/cards/ct-p01/B01009';
import { B01009P } from '@/cards/ct-p01/B01009P';
import { B09095 } from '@/cards/ct-p09/B09095';
import { B09095P } from '@/cards/ct-p09/B09095P';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

function charDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 1000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
const FILLER = charDef('FILLER');
const BLUE_LP0 = charDef('BLUE_LP0', { lp: 0 });
const BLUE_LP0B = charDef('BLUE_LP0B', { lp: 0 });
const BLUE_LP1 = charDef('BLUE_LP1', { lp: 1 });
const RED_LP0 = charDef('RED_LP0', { lp: 0, colors: ['赤'] });
const PBLUE: CardDef = { id: 'PBLUE', no: 'PBLUE', kind: 'partner', names: ['P青'], colors: ['青'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const PRED: CardDef = { id: 'PRED', no: 'PRED', kind: 'partner', names: ['P赤'], colors: ['赤'], level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const FIXTURES = [FILLER, BLUE_LP0, BLUE_LP0B, BLUE_LP1, RED_LP0, PBLUE, PRED, B01009, B01009P, B09095, B09095P];

function setHuman(s: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = s;
}
function fileBack(n: number): { type: 'card-back'; cardId: string }[] {
  return Array.from({ length: n }, () => ({ type: 'card-back' as const, cardId: 'FILLER' }));
}
function base(partnerId = 'PBLUE'): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.partner = { cardId: partnerId, state: 'active', location: 'partner-area' } as never;
  s.players.self.case = { cardId: 'cs', status: '事件編', requiredEvidence: 7, colors: ['青'], declaredUseCount: {} } as never;
  s.players.opp.case = { cardId: 'co', status: '事件編', requiredEvidence: 6, colors: ['青'], declaredUseCount: {} } as never;
  return s;
}
function enterN(s: GameState, p: 'self' | 'opp', n: number): void {
  for (let i = 0; i < n; i++) mutate.scene.enter(s, p, 'FILLER', {});
}

beforeEach(() => {
  event._resetRegistry(); // handler 累積防止 (miniwave3 manual-probes 慣行)
  resetDefRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectPickQueue();
  for (const d of FIXTURES) { registerCardDef(d); }
  registerTriggeredListener();
  setHuman('self');
});

describe('B01009 a1 — 【パートナー青】両現場合計6枚以上で手札内レベル4 (lvlOverrideInHand)', () => {
  it('条件成立 (P青 + 3+3): FILE4 で手札使用可 (レベル4≤4)', () => {
    const s = base('PBLUE');
    enterN(s, 'self', 3); enterN(s, 'opp', 3);
    s.players.self.hand = ['B01009'];
    s.players.self.file = fileBack(4) as never;
    expect(effectiveHandLevel(s, 'self', 'B01009')).toBe(4);
    expect(canHandUseCard(s, 'self', 'B01009')).toBe(true);
  });
  it('現場合計5枚 (3+2) → 条件不成立: FILE4 では不可 (レベル6>4)、FILE6 で可', () => {
    const s = base('PBLUE');
    enterN(s, 'self', 3); enterN(s, 'opp', 2);
    s.players.self.hand = ['B01009'];
    s.players.self.file = fileBack(4) as never;
    expect(effectiveHandLevel(s, 'self', 'B01009')).toBe(6);
    expect(canHandUseCard(s, 'self', 'B01009')).toBe(false);
    s.players.self.file = fileBack(6) as never;
    expect(canHandUseCard(s, 'self', 'B01009')).toBe(true);
  });
  it('【パートナー青】不成立 (P赤): 6枚いても レベル6 のまま (rules/17 持っていない扱い)', () => {
    const s = base('PRED');
    enterN(s, 'self', 3); enterN(s, 'opp', 3);
    expect(effectiveHandLevel(s, 'self', 'B01009')).toBe(6);
  });
  it('ネクストヒント step2 も同 gate: 条件成立 + FILE5 (pop後4) で使用成立', () => {
    const s0 = base('PBLUE');
    enterN(s0, 'self', 3); enterN(s0, 'opp', 3);
    s0.players.self.hand = ['B01009'];
    s0.players.self.file = fileBack(5) as never;
    // mutate.file.popTop が Immer current() を呼ぶため produce draft 内で実行 (miniwave2/3 慣行)
    const s = produce(s0, (d) => { runNextHint(d as GameState, 'self', 'B01009'); });
    expect(s.players.self.scene.some(c => c.cardId === 'B01009')).toBe(true);
    // QA: 手札から使用した時点でレベル6 (現場では元レベル) — def.level は不変
    expect(B01009.level).toBe(6);
  });
});

describe('B01009 a2 — 【宣言】〚デッキの下に移す〛: LP0以下の【青】を1枚まで選びアクティブ', () => {
  function setup(): { s: GameState; selfUid: string; t0: string; t1: string } {
    const s = base('PBLUE');
    const me = mutate.scene.enter(s, 'self', 'B01009', {});
    const t0 = mutate.scene.enter(s, 'self', 'BLUE_LP0', {});   // 自陣 LP0 青 (スリープに)
    const t1 = mutate.scene.enter(s, 'opp', 'BLUE_LP0B', {});   // 敵陣 LP0 青 (スタンに) — side:'either'
    const d1 = mutate.scene.enter(s, 'self', 'BLUE_LP1', {});   // decoy: LP1 青
    const d2 = mutate.scene.enter(s, 'opp', 'RED_LP0', {});     // decoy: LP0 赤
    mutate.scene.setState(s, t0.uid, 'sleep');
    mutate.scene.setState(s, t1.uid, 'stun');
    mutate.scene.setState(s, d1.uid, 'sleep');
    mutate.scene.setState(s, d2.uid, 'sleep');
    return { s, selfUid: me.uid, t0: t0.uid, t1: t1.uid };
  }
  it('コスト: 自身がデッキの下へ / pick 候補は 両現場の LP0 青のみ (LP1青・赤 は除外) / スリープ→アクティブ', () => {
    const { s, selfUid, t0 } = setup();
    activateDeclaredAbility(s, selfUid, 'a2');
    runAllUntilEmpty(s);
    // コスト: 現場から消え、デッキ最下部 = B01009 (rules/21 対象省略 = 自身)
    expect(s.players.self.scene.some(c => c.uid === selfUid)).toBe(false);
    expect(s.players.self.deck[s.players.self.deck.length - 1]).toBe('B01009');
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'pick が surface する').toBeTruthy();
    const cands = (pick!.candidates as Array<{ cardId: string; uid: string }>);
    const ids = cands.map(c => c.cardId).sort();
    expect(ids, '候補 = 両現場の LP0 青のみ (decoy 除外)').toEqual(['BLUE_LP0', 'BLUE_LP0B']);
    applyPickAndContinuation(s, pick!, t0, [t0]);
    runAllUntilEmpty(s);
    expect(s.players.self.scene.find(c => c.uid === t0)?.state).toBe('active');
  });
  it('スタン状態を選んだ場合はスリープになる (rules/03 スタン特殊挙動、公式QA)', () => {
    const { s, selfUid, t1 } = setup();
    activateDeclaredAbility(s, selfUid, 'a2');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    applyPickAndContinuation(s, pick!, t1, [t1]);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene.find(c => c.uid === t1)?.state, 'スタン→アクティブ化はスリープ').toBe('sleep');
  });
  it('効果で LP1 以上になっている元LP0 キャラは選べない (公式QA — 有効LP 判定)', () => {
    const { s, selfUid, t0 } = setup();
    // t0 (LP0 青) に LP+1 (ターン中) を付与 → 有効 LP1 → 候補から外れる
    const ctx = { source: { player: 'self', cardId: 'X' }, bindings: {} } as unknown as EffectCtx;
    runAtom(s, 'charModifyLP', { uid: t0, delta: 1, scope: 'turn' }, ctx);
    activateDeclaredAbility(s, selfUid, 'a2');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    const ids = (pick!.candidates as Array<{ cardId: string }>).map(c => c.cardId);
    expect(ids, 'LP+1 された BLUE_LP0 は除外').toEqual(['BLUE_LP0B']);
    applyPickSkipAndContinuation(s, pick!, false);
    runAllUntilEmpty(s);
  });
  it('「1枚まで」= 0枚 skip 可 (rules/15)。コストは支払済のまま', () => {
    const { s, selfUid, t0 } = setup();
    activateDeclaredAbility(s, selfUid, 'a2');
    runAllUntilEmpty(s);
    const pick = _drainPendingEffectPickSide();
    applyPickSkipAndContinuation(s, pick!, false);
    runAllUntilEmpty(s);
    expect(s.players.self.deck[s.players.self.deck.length - 1], 'skip してもコストは戻らない').toBe('B01009');
    expect(s.players.self.scene.find(c => c.uid === t0)?.state, '状態不変').toBe('sleep');
  });
});

describe('B09095 a1 — 【事件赤＆黒】【解決編】【自分ターン中】痕跡発見済で手札内レベル-2 (lvlDeltaInHand)', () => {
  function vermouthBase(): GameState {
    const s = base('PBLUE');
    s.players.self.case = { cardId: 'cs', status: '解決編', requiredEvidence: 7, colors: ['赤', '黒'], declaredUseCount: {} } as never;
    s.scratchTrace = { self: '発見済', opp: '未発見' } as never;
    s.players.self.hand = ['B09095'];
    s.players.self.file = fileBack(5) as never;
    return s;
  }
  it('全条件成立: レベル5 → FILE5 で使用可', () => {
    const s = vermouthBase();
    expect(effectiveHandLevel(s, 'self', 'B09095')).toBe(5);
    expect(canHandUseCard(s, 'self', 'B09095')).toBe(true);
  });
  it('痕跡未発見 → レベル7 → FILE5 で不可 / FILE7 なら可 (色は事件が黒を持つので通る)', () => {
    const s = vermouthBase();
    s.scratchTrace = { self: '未発見', opp: '未発見' } as never;
    expect(effectiveHandLevel(s, 'self', 'B09095')).toBe(7);
    expect(canHandUseCard(s, 'self', 'B09095')).toBe(false);
    s.players.self.file = fileBack(7) as never;
    expect(canHandUseCard(s, 'self', 'B09095')).toBe(true);
  });
  it('事件編 (解決編でない) → レベル7 (rules/17 持っていない扱い)', () => {
    const s = vermouthBase();
    s.players.self.case = { ...s.players.self.case, status: '事件編' } as never;
    expect(effectiveHandLevel(s, 'self', 'B09095')).toBe(7);
  });
  it('事件が赤のみ (黒&赤 の and 不成立) → レベル7', () => {
    const s = vermouthBase();
    // 色制限 gate と切り分けるため effectiveHandLevel を直接確認 (rules/17 【事件赤&黒】= 両方必要)
    s.players.self.case = { ...s.players.self.case, colors: ['赤'] } as never;
    expect(effectiveHandLevel(s, 'self', 'B09095')).toBe(7);
  });
  it('相手ターン中 → レベル7 (【自分ターン中】不成立)', () => {
    const s = vermouthBase();
    s.turn = { ...s.turn, player: 'opp' } as GameState['turn'];
    expect(effectiveHandLevel(s, 'self', 'B09095')).toBe(7);
  });
});

describe('B09095 a2 — 【登場時】痕跡未発見なら相手デッキ上2枚リムーブ', () => {
  function emitEnter(s: GameState): void {
    const c = mutate.scene.enter(s, 'self', 'B09095', { named: true, viaEffect: false });
    event.emit(
      s, 'enter',
      { uid: c.uid, viaEffect: false, enterOrder: c.enterOrder, enterOrderThisTurn: c.enterOrderThisTurn },
      { player: 'self', cardId: 'B09095', uid: c.uid },
    );
    runAllUntilEmpty(s);
  }
  it('痕跡未発見: 相手デッキ上2枚がリムーブへ', () => {
    const s = base('PBLUE');
    s.players.opp.deck = ['d1', 'd2', 'd3'];
    s.scratchTrace = { self: '未発見', opp: '未発見' } as never;
    emitEnter(s);
    expect(s.players.opp.deck).toEqual(['d3']); // deck top = index 0 (mutate.deck.removeFromTop)
    expect(s.players.opp.remove).toEqual(['d1', 'd2']);
  });
  it('相手デッキ1枚: 可能な限り (1枚) リムーブ → リフレッシュ (rules/14/26、残り分は追いリムーブしない)', () => {
    const s = base('PBLUE');
    s.players.opp.deck = ['d1'];
    s.players.opp.remove = ['r1'];
    s.scratchTrace = { self: '未発見', opp: '未発見' } as never;
    const evBefore = s.players.self.evidence.length;
    emitEnter(s);
    // d1 リムーブ → デッキ0 → リフレッシュ: remove (r1+d1) をシャッフルしてデッキへ。残り1枚分は追いリムーブなし
    expect(s.players.opp.deck.length).toBe(2);
    expect(s.players.opp.remove.length).toBe(0);
    // rules/14: リフレッシュしたら相手 (=self) が証拠1獲得
    expect(s.players.self.evidence.length).toBe(evBefore + 1);
  });
  it('痕跡発見済: 何も起きない (conditional else 無し)', () => {
    const s = base('PBLUE');
    s.players.opp.deck = ['d1', 'd2', 'd3'];
    s.scratchTrace = { self: '発見済', opp: '未発見' } as never;
    emitEnter(s);
    expect(s.players.opp.deck.length).toBe(3);
    expect(s.players.opp.remove.length).toBe(0);
  });
});

describe('P variants — spread 同一性 (rules/02 同ID)', () => {
  it('B01009P/B09095P は id/no/imageUrl/rarity のみ差分', () => {
    for (const [b, p] of [[B01009, B01009P], [B09095, B09095P]] as const) {
      expect(p.abilities).toBe(b.abilities);
      expect(p.level).toBe(b.level);
      expect(p.colors).toEqual(b.colors);
      expect(p.rarity).toBe('RP');
    }
  });
});
