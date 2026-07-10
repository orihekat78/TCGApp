// tests/cards/night-wB2/B09112 — キッドVS安室 王妃の前髪 (case) engine additive probe (WB2)
//
// engine fix (2 点、combine):
//   1) resolve-picks.ts resolveDynArgs: `$declared.<key>.*` を pre-walk で literal 化保留 (未宣言時 defer)。
//      → declareName 実行前に maxN が sceneNameCount=0 で baked されるのを防ぐ。
//   2) picks.ts atomDeckRevealUntil: maxN が {dyn} object なら dispatch 時に resolveDeltaToNumber で解決。
//      → 「指定名キャラ1枚につきデッキ上から1枚見る」の N を現場の宣言名キャラ数に一致させる。
//
// 印字 a2: カード名を1つ指定し、自分の現場にいる指定名キャラ1枚につきデッキ上から1枚見る。その中から
//          指定名キャラを1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//
// production dispatch: activateDeclaredAbility('case:self','a2',{flipFaceUpEvidence,declaredName}) +
//   runAllUntilEmpty (immer produce)。AI 経路 = 先頭 match 自動取得 / human 経路 = pick surface (「1枚まで」skip)。
//   owner='opp' pin (BUG-174)。event._resetRegistry (handler 累積回避)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks, applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { makeChar } from '../../helpers/fixtures';
import { B09112 } from '@/cards/ct-p09/B09112';
import { B09112P } from '@/cards/ct-p09/B09112P';
import type { CardDef, GameState, Player, AbilityDef } from '@/engine/types';

type Side = Player;

function cdef(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 4, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over } as CardDef;
}

// 宣言名 'キッド' を名前に持つキャラ (現場計数 + deck match)
const KID1 = cdef('KID1', { names: ['キッド'] });
const KID2 = cdef('KID2', { names: ['キッド'] });
const KID3 = cdef('KID3', { names: ['キッド'] });
const KIDDECK = cdef('KIDDECK', { names: ['キッド'] });   // deck 内の match char
const KIDDEEP = cdef('KIDDEEP', { names: ['キッド'] });   // deck 深部 (window 外確認用)
const MOB = cdef('MOB', { names: ['モブ'] });             // 非一致 char (decoy)
const KIDEVENT = cdef('KIDEVENT', { names: ['キッド'], kind: 'event' }); // 名一致だが event (kind:character 除外)
const FIXTURES = [KID1, KID2, KID3, KIDDECK, KIDDEEP, MOB, KIDEVENT];

function setHuman(s: Side | null): void {
  (globalThis as { __humanPlayerSide?: Side | null }).__humanPlayerSide = s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  registerCardDef(B09112);
  registerCardDef(B09112P);
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
  setHuman(null);
});

const other = (p: Side): Side => (p === 'self' ? 'opp' : 'self');

interface BoardOpts {
  status?: '事件編' | '解決編';
  evidenceFaceDown?: number;
  sceneKidCount?: number;   // 現場の 'キッド' キャラ数
  extraScene?: { cardId: string; uid: string }[];
  deck?: string[];          // owner deck (top→bottom)
}
function board(owner: Side, opts: BoardOpts = {}): GameState {
  const { status = '解決編', evidenceFaceDown = 2, sceneKidCount = 2, extraScene = [], deck = [] } = opts;
  const s = createEmptyGameState();
  s.turn = { number: 5, player: owner, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  const p = s.players[owner];
  p.case = { cardId: 'B09112', status, requiredEvidence: owner === 'self' ? 7 : 6, colors: ['白', '黄'], declaredUseCount: {} } as GameState['players']['self']['case'];
  p.evidence = Array.from({ length: evidenceFaceDown }, (_v, i) => ({ cardId: `EV${i}`, faceUp: false, origin: { turn: 1, via: 'effect' as const } }));
  const kidUids = ['KID1', 'KID2', 'KID3'].slice(0, sceneKidCount).map((cid, i) => ({ cardId: cid, uid: `u-kid${i}` }));
  p.scene = [...kidUids, ...extraScene].map((c) => makeChar({ uid: c.uid, cardId: c.cardId, state: 'active' }));
  p.deck = [...deck];
  return s;
}

function activate(s0: GameState, owner: Side, declaredName: string): GameState {
  const uid = owner === 'self' ? 'case:self' : 'case:opp';
  return produce(s0, (d) => {
    activateDeclaredAbility(d, uid, 'a2', { flipFaceUpEvidence: { indices: [0, 1] }, declaredName });
    runAllUntilEmpty(d);
    drainAiEffectPicks(d);
    runAllUntilEmpty(d);
  });
}

// ============================================================
// shape
// ============================================================
describe('B09112 — shape', () => {
  it('case / colors / a1 discard / a2 declared sequence + flip cost', () => {
    expect(B09112.kind).toBe('case');
    expect(B09112.colors).toEqual(['白', '黄']);
    const a1 = B09112.abilities[0] as AbilityDef;
    expect(a1.trigger).toMatchObject({ hook: 'case:to-resolved', selfOnly: true });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'discard', args: { n: 1, player: 'self' } });
    const a2 = B09112.abilities[1] as AbilityDef;
    expect(a2.type).toBe('declared');
    expect(a2.condition).toMatchObject({ kind: 'caseStatus', status: '解決編' });
    expect(a2.cost).toMatchObject({ kind: 'flipFaceUpEvidence', n: { min: 2, max: 2 } });
    expect(a2.effect?.kind).toBe('sequence');
  });
  it('P parallel は base の全能力を継承 (cardId 同一)', () => {
    expect(B09112P.abilities).toBe(B09112.abilities);
    expect(B09112P.no).toBe('1051/B09112P');
  });
});

// ============================================================
// gate — 解決編 + 裏向き証拠2
// ============================================================
describe('B09112 a2 gate', () => {
  it('解決編 → 宣言可 / 事件編 → 不可', () => {
    expect(canDeclaredAbility(board('self'), 'case:self', 'a2')).toBe(true);
    expect(canDeclaredAbility(board('self', { status: '事件編' }), 'case:self', 'a2')).toBe(false);
  });
});

// ============================================================
// 核心: maxN = 現場の指定名キャラ数 (engine fix 実測)
// ============================================================
describe('B09112 a2 — maxN が現場の指定名キャラ数に解決される', () => {
  it('現場キッド2体 → デッキ上2枚を見る → 一致 char を手札 / 3枚目 (window外) は不動', () => {
    // deck top→bottom: [MOB, KIDDECK, KIDDEEP]。maxN=2 → 上2枚 [MOB,KIDDECK] を見る。
    const s0 = board('self', { sceneKidCount: 2, deck: ['MOB', 'KIDDECK', 'KIDDEEP'] });
    const st = activate(s0, 'self', 'キッド');

    expect(st.players.self.hand, '一致 char KIDDECK を手札へ (maxN>0 = fix 有効)').toContain('KIDDECK');
    expect(st.players.self.hand, 'window 外 KIDDEEP は手札に来ない').not.toContain('KIDDEEP');
    // KIDDEEP は index2 = window(2枚)外 → 不動でデッキ先頭に残る (maxN=2 の証左、maxN=3 なら公開されてしまう)
    expect(st.players.self.deck[0], 'KIDDEEP は公開されず先頭に残存 (=maxN は 2 で頭打ち)').toBe('KIDDEEP');
    expect(st.players.self.deck, 'MOB は残りとしてデッキ下へ').toContain('MOB');
    expect(st.players.self.deck, 'KIDDECK は手札へ移動しデッキから消える').not.toContain('KIDDECK');
    // cost: 証拠2つ表向き
    expect(st.players.self.evidence.filter((e) => e.faceUp).length).toBe(2);
  });

  it('現場キッド1体 → デッキ上1枚のみ (maxN は 1、2枚目は見ない)', () => {
    const s0 = board('self', { sceneKidCount: 1, deck: ['KIDDECK', 'KIDDEEP'] });
    const st = activate(s0, 'self', 'キッド');

    expect(st.players.self.hand, '上1枚 KIDDECK が一致 → 手札').toContain('KIDDECK');
    expect(st.players.self.deck, 'KIDDEEP は 2枚目 = window(1枚)外 → デッキに残る').toContain('KIDDEEP');
    expect(st.players.self.deck.length, 'デッキ 1枚残 (KIDDEEP のみ)').toBe(1);
  });

  it('現場に指定名キャラ0 → maxN=0 → 1枚も見ない (手札不変)', () => {
    // 現場は MOB のみ (キッド 0)。deck に KIDDECK があっても見ない。
    const s0 = board('self', { sceneKidCount: 0, extraScene: [{ cardId: 'MOB', uid: 'u-mob' }], deck: ['KIDDECK'] });
    const before = s0.players.self.hand.length;
    const st = activate(s0, 'self', 'キッド');
    expect(st.players.self.hand.length, '0枚見る → 手札増えない').toBe(before);
    expect(st.players.self.deck, 'KIDDECK はデッキに残る').toContain('KIDDECK');
  });
});

// ============================================================
// filter — 名一致でも kind:character 以外 / 非一致名は取らない
// ============================================================
describe('B09112 a2 — filter (指定名キャラのみ手札)', () => {
  it('window 内に名一致 event / 非一致 char があっても、一致 char のみ手札', () => {
    // 現場キッド3体 → maxN=3。deck top→bottom: [MOB(非一致char), KIDEVENT(名一致だが event), KIDDECK(一致char)]。
    const s0 = board('self', { sceneKidCount: 3, deck: ['MOB', 'KIDEVENT', 'KIDDECK'] });
    const st = activate(s0, 'self', 'キッド');

    expect(st.players.self.hand, '一致 char KIDDECK のみ手札').toContain('KIDDECK');
    expect(st.players.self.hand, '名一致でも event の KIDEVENT は手札に来ない (kind:character)').not.toContain('KIDEVENT');
    expect(st.players.self.hand, '非一致 char MOB は手札に来ない').not.toContain('MOB');
    // 残り (MOB, KIDEVENT) はデッキ下へ
    expect(st.players.self.deck).toEqual(expect.arrayContaining(['MOB', 'KIDEVENT']));
  });
});

// ============================================================
// human 経路 — 「1枚まで」= skip 可 (rules/15) + owner=opp pin
// ============================================================
describe('B09112 a2 — human pick (1枚まで) / owner=opp', () => {
  it('human owner: 一致 char が pick surface → skip で 0枚 (手札不変・残りはデッキ下)', () => {
    setHuman('self');
    const s0 = board('self', { sceneKidCount: 2, deck: ['MOB', 'KIDDECK', 'KIDDEEP'] });
    let st = produce(s0, (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1] }, declaredName: 'キッド' });
      runAllUntilEmpty(d);
    });
    const pick = _drainPendingEffectPickSide();
    expect(pick?.atomVerb, 'deckRevealUntil pick が surface').toBe('deckRevealUntil');
    expect(pick!.candidates.map((c) => c.cardId), '一致 char KIDDECK が候補').toContain('KIDDECK');
    st = produce(st, (d) => {
      applyPickSkipAndContinuation(d, pick!, false);
      runAllUntilEmpty(d);
    });
    setHuman(null);
    expect(st.players.self.hand, 'skip → 手札に加えない').not.toContain('KIDDECK');
    expect(st.players.self.deck, 'skip 時 全 reveal がデッキ下 (KIDDECK 含む)').toContain('KIDDECK');
  });

  it('human owner: pick で 1枚取得 → 手札へ', () => {
    setHuman('self');
    const s0 = board('self', { sceneKidCount: 2, deck: ['MOB', 'KIDDECK', 'KIDDEEP'] });
    let st = produce(s0, (d) => {
      activateDeclaredAbility(d, 'case:self', 'a2', { flipFaceUpEvidence: { indices: [0, 1] }, declaredName: 'キッド' });
      runAllUntilEmpty(d);
    });
    const pick = _drainPendingEffectPickSide();
    const kidCand = pick!.candidates.find((c) => c.cardId === 'KIDDECK')!;
    st = produce(st, (d) => {
      applyPickAndContinuation(d, pick!, kidCand.uid);
      runAllUntilEmpty(d);
    });
    setHuman(null);
    expect(st.players.self.hand, 'pick 取得 → 手札').toContain('KIDDECK');
  });

  it('owner=opp pin: opp 所有でも opp 現場計数 / opp デッキから opp 手札へ', () => {
    const s0 = board('opp', { sceneKidCount: 2, deck: ['MOB', 'KIDDECK', 'KIDDEEP'] });
    const st = activate(s0, 'opp', 'キッド');
    expect(st.players.opp.hand, 'owner=opp: opp 手札へ').toContain('KIDDECK');
    expect(st.players.opp.deck[0], 'opp: KIDDEEP window外で残存').toBe('KIDDEEP');
    expect(st.players.self.hand.length, 'self は不変').toBe(0);
  });
});
