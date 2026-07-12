// tests/cards/m1-megasweep/PR263.manual — 怪盗キッド (character / 白 / 怪盗 / Lv7 / AP6000 / LP1)
//  手書き probe (engine 実評価で全 novel 句を踏む)
//
// 公式テキスト (payloads/PR263.json fullTexts):
//   a1 【自分ターン中】自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカード1枚につき、
//      このキャラをAP＋1000する。
//   a2 【自分ターン中】【登場時】自分のパートナーエリアにある〚特徴［ビッグジュエル］〛のカードを
//      1枚リムーブしてもよい。そうした場合、レベル7以下のスリープ状態かスタン状態のキャラを1枚まで選び、
//      リムーブする。
//   a3 【自分ターン中】【変装時】(a2 と同一 effect、trigger=disguise:into)
//   a4 【変装】【FILE7】(icon-disguise、condition fileAtLeast:7)
//
// novel 句 → engine 実評価:
//   a1 (continuous, on-scene): condition turn:self / apDelta dyn
//      '$self.partnerAreaTraitCount.ビッグジュエル * 1000' (owner PA の[ビッグジュエル]枚数 ×1000)。
//      char.ap で実効 AP を読み、on/off (自ターンのみ) + 非 jewel PA decoy が非計上 を pin。
//   a2/a3 (triggered optional{chain[partnerAreaRemove n:1(ビッグジュエル), sceneRemove max:1 side:either
//      state[sleep,stun] filter levelMax:7]}): 「〜してもよい」optional / 「そうした場合」= partnerAreaRemove
//      n:1 の exact-N gate が満たなければ後段 sceneRemove を発火しない / sceneRemove「1枚まで」= nMin0 (0可) /
//      side:either = 両陣候補 / state+levelMax = active・Lv8+ を候補から除外。
//
// production dispatch:
//   a2 = event.emit('enter', selfOnly) → runAllUntilEmpty → optional surface → applyOptionalAndContinuation
//        → pick loop (partnerAreaRemove jewel → sceneRemove char)。BUG-171 の triggered 実 emit 経路。
//   a3 = event.emit('disguise:into', source={player,uid}) 同経路 (flow/contact.disguise の emit と同 payload)。
//   BUG-174 owner='opp' pin: opp 所有 PR263 が opp ターンに opp PA jewel を消費し self 側キャラを除去 →
//        self.remove へ (反転しない)。
//
// rules: 03-field-areas.md (§スタン特殊挙動), 09-cutin-disguise.md (§変装は登場でない), 15-abilities-effects.md
//        (「〜まで」=0可 / 「そうした場合」), 17-icons.md (【自分ターン中】条件未達=能力を持たない扱い),
//        23-qa-disguise-cutin.md, 24-qa-naming-stun.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  _peekPendingEffectOptionalSide,
  _drainPendingEffectPickSide,
  _clearPendingEffectOptionalSide,
  _clearPendingEffectPickQueue,
} from '@/engine/effect/resolve-picks';
import {
  applyOptionalAndContinuation,
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
} from '@/engine/effect/apply-pick';
import { char as readChar } from '@/engine/read/char';
import { sceneChar } from '../../helpers/fixtures';
import { PR263 } from '@/cards/pr-01/PR263';
import type { CardDef, GameState, Player } from '@/engine/types';

// --- fixtures ---
const JEWEL = 'DEC_PR263_JEWEL';   // PA 常駐 [ビッグジュエル] (partnerAreaRemove / a1 計数対象)
const PAOTHER = 'DEC_PR263_PAOTH'; // PA decoy (非 jewel — a1 非計上 / partnerAreaRemove 対象外)
const VICTIM = 'DEC_PR263_VICTIM'; // sceneRemove 対象 (Lv5, sleep/stun)
const DEC_ACT = 'DEC_PR263_ACT';   // decoy: active → state[sleep,stun] filter 外
const DEC_HI = 'DEC_PR263_HI';     // decoy: Lv9 sleep → levelMax:7 filter 外

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}
const setHuman = (s: Player | null) => { (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = s; };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  setHuman(null);
  registerCardDef(PR263);
  registerCardDef(ch(JEWEL, { names: ['ビッグジュエル'], traits: ['ビッグジュエル'] }));
  registerCardDef(ch(PAOTHER, { names: ['非宝石'], traits: ['探偵'] }));
  registerCardDef(ch(VICTIM, { names: ['被害者'], level: 5 }));
  registerCardDef(ch(DEC_ACT, { names: ['アクティブ'], level: 5 }));
  registerCardDef(ch(DEC_HI, { names: ['高Lv'], level: 9 }));
  registerTriggeredListener();
});

function base(turnPlayer: Player = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
}

// pick captured for assertion
type PickSnap = { candidates: { uid: string; cardId: string; player: Player }[]; nMin: number; nMax: number; player: Player };

/**
 * a2/a3 の optional{chain} を production 経路で駆動する。
 * @param removeCharPick  sceneRemove pick で選ぶ char uid、'skip' で 0枚辞退、null なら pick 不発を期待
 * @returns              観測した sceneRemove pick (無ければ null)
 */
function driveEnterChain(d: GameState, run: boolean, removeCharPick: string | 'skip' | null): PickSnap | null {
  runAllUntilEmpty(d);
  const opt = _peekPendingEffectOptionalSide();
  expect(opt, 'optional (「してもよい」) surface').not.toBeNull();
  applyOptionalAndContinuation(d, opt!, run);
  runAllUntilEmpty(d);
  let sceneRemove: PickSnap | null = null;
  for (let i = 0; i < 8; i++) {
    const pk = _drainPendingEffectPickSide();
    if (!pk) break;
    if (pk.atomVerb === 'sceneRemove') {
      sceneRemove = {
        candidates: pk.candidates.map((c) => ({ uid: c.uid, cardId: c.cardId, player: c.player })),
        nMin: pk.nMin, nMax: pk.nMax, player: pk.player,
      };
      if (removeCharPick === 'skip') applyPickSkipAndContinuation(d, pk, false);
      else if (removeCharPick) applyPickAndContinuation(d, pk, removeCharPick);
      else applyPickSkipAndContinuation(d, pk, false);
    } else {
      // partnerAreaRemove (jewel) — 単一 jewel 候補を消費
      applyPickAndContinuation(d, pk, pk.candidates[0]!.uid);
    }
    runAllUntilEmpty(d);
  }
  return sceneRemove;
}

// ============================================================
// shape
// ============================================================
describe('PR263 怪盗キッド — shape', () => {
  it('白/Lv7/AP6000/LP1/怪盗 + a1 continuous / a2 enter / a3 disguise:into / a4 icon-disguise', () => {
    expect(PR263.id).toBe('PR263');
    expect(PR263.colors).toEqual(['白']);
    expect(PR263.level).toBe(7);
    expect(PR263.ap).toBe(6000);
    expect(PR263.lp).toBe(1);
    expect(PR263.traits).toEqual(['怪盗']);
    const [a1, a2, a3, a4] = PR263.abilities;
    expect(a1).toMatchObject({ type: 'continuous', scope: 'on-scene', condition: { kind: 'turn', player: 'self' } });
    expect(a1.continuousModifier).toMatchObject({ apDelta: { dyn: '$self.partnerAreaTraitCount.ビッグジュエル * 1000' } });
    expect(a2).toMatchObject({ type: 'triggered', trigger: { hook: 'enter', selfOnly: true }, condition: { kind: 'turn', player: 'self' } });
    expect(a2.effect).toMatchObject({ kind: 'optional' });
    expect(a3).toMatchObject({ type: 'triggered', trigger: { hook: 'disguise:into', selfOnly: true } });
    expect(a4).toMatchObject({ type: 'icon-disguise', condition: { kind: 'fileAtLeast', n: 7 } });
  });
});

// ============================================================
// a1 — 【自分ターン中】continuous AP+1000 × PA[ビッグジュエル]
// ============================================================
describe('PR263 a1 — partnerAreaTraitCount apDelta (turn:self gate + 非jewel decoy)', () => {
  it('C1 自ターン: PA jewel 2枚 → AP 6000+2000=8000 / PAOTHER(非jewel)は非計上', () => {
    const s = base('self');
    s.players.self.scene = [sceneChar('PR263', 'kid', { state: 'active' })];
    s.players.self.partnerAreaCards = [JEWEL, JEWEL, PAOTHER];
    expect(readChar.ap(s, 'kid'), 'jewel 2枚ぶん +2000 (PAOTHER 非計上)').toBe(8000);
  });

  it('C2 自ターン: PA jewel 0枚 → AP 6000 (base のまま)', () => {
    const s = base('self');
    s.players.self.scene = [sceneChar('PR263', 'kid', { state: 'active' })];
    s.players.self.partnerAreaCards = [PAOTHER];
    expect(readChar.ap(s, 'kid')).toBe(6000);
  });

  it('C3 off-variant: 相手ターン中は condition turn:self 不成立 → jewel 3枚でも +0 (base 6000)', () => {
    const s = base('opp'); // 相手ターン
    s.players.self.scene = [sceneChar('PR263', 'kid', { state: 'active' })];
    s.players.self.partnerAreaCards = [JEWEL, JEWEL, JEWEL];
    expect(readChar.ap(s, 'kid'), '相手ターンでは AP ボーナスなし').toBe(6000);
  });

  it('C4 owner=opp: opp ターンに opp 所有 PR263 は opp PA jewel を計数 (turn:self=owner ターン)', () => {
    const s = base('opp');
    s.players.opp.scene = [sceneChar('PR263', 'okid', { state: 'active' })];
    s.players.opp.partnerAreaCards = [JEWEL];
    expect(readChar.ap(s, 'okid'), 'owner(opp) ターン + opp PA jewel 1 → +1000').toBe(7000);
  });
});

// ============================================================
// a2 — 【登場時】optional{ jewel 1枚リムーブ → Lv7以下 sleep/stun を1枚まで除去 }
// ============================================================
describe('PR263 a2 — 【登場時】partnerAreaRemove → sceneRemove(side either / state sleep,stun / levelMax7)', () => {
  it('E1 happy + decoy: jewel 1枚消費 → sceneRemove 候補は Lv5 sleep のみ (active/Lv9 除外) → 除去', () => {
    setHuman('self');
    let s = base('self');
    s.players.self.scene = [sceneChar('PR263', 'kid', { state: 'active' })];
    s.players.self.partnerAreaCards = [JEWEL, PAOTHER];
    s.players.opp.scene = [
      sceneChar(VICTIM, 'v', { state: 'sleep' }),
      sceneChar(DEC_ACT, 'da', { state: 'active' }), // decoy: active
      sceneChar(DEC_HI, 'dh', { state: 'sleep' }),   // decoy: Lv9
    ];
    let pick: PickSnap | null = null;
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'kid', viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'PR263', uid: 'kid' });
      pick = driveEnterChain(d, true, 'v');
    });
    expect(pick, 'sceneRemove pick surface').not.toBeNull();
    expect(pick!.nMin, '「1枚まで」→ nMin 0').toBe(0);
    expect(pick!.nMax).toBe(1);
    const candIds = pick!.candidates.map((c) => c.cardId);
    expect(candIds, 'Lv5 sleep は候補').toContain(VICTIM);
    expect(candIds, 'active は候補外 (state[sleep,stun])').not.toContain(DEC_ACT);
    expect(candIds, 'Lv9 は候補外 (levelMax:7)').not.toContain(DEC_HI);
    // 結果: jewel 1枚除去 / VICTIM 除去 / PAOTHER・decoy 残存
    expect(s.players.self.partnerAreaCards, 'jewel 1枚のみ除去 (PAOTHER 残る)').toEqual([PAOTHER]);
    expect(s.players.self.remove, 'jewel は所有者 remove へ').toContain(JEWEL);
    expect(s.players.opp.scene.some((c) => c.uid === 'v'), 'VICTIM 除去').toBe(false);
    expect(s.players.opp.remove, 'VICTIM は所有者(opp) remove へ').toContain(VICTIM);
    expect(s.players.opp.scene.some((c) => c.uid === 'da'), 'active decoy 残存').toBe(true);
    expect(s.players.opp.scene.some((c) => c.uid === 'dh'), 'Lv9 decoy 残存').toBe(true);
  });

  it('E2 「そうした場合」gate: PA に jewel 無し → partnerAreaRemove n:1 gate → sceneRemove 不発 (VICTIM 残存)', () => {
    setHuman('self');
    let s = base('self');
    s.players.self.scene = [sceneChar('PR263', 'kid', { state: 'active' })];
    s.players.self.partnerAreaCards = [PAOTHER]; // jewel 0枚
    s.players.opp.scene = [sceneChar(VICTIM, 'v', { state: 'sleep' })];
    let pick: PickSnap | null = null;
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'kid', viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'PR263', uid: 'kid' });
      pick = driveEnterChain(d, true, 'v'); // run=true でも jewel 無しで後段 gate
    });
    expect(pick, 'jewel 不足 → sceneRemove pick は surface しない').toBeNull();
    expect(s.players.self.partnerAreaCards, 'PAOTHER は非 jewel で残る').toEqual([PAOTHER]);
    expect(s.players.opp.scene.some((c) => c.uid === 'v'), 'VICTIM は除去されない').toBe(true);
    expect(s.players.opp.remove, 'opp.remove 空').toEqual([]);
  });

  it('E3 「1枚まで」=0選択: sceneRemove を skip → jewel は消費済 / char 除去なし', () => {
    setHuman('self');
    let s = base('self');
    s.players.self.scene = [sceneChar('PR263', 'kid', { state: 'active' })];
    s.players.self.partnerAreaCards = [JEWEL];
    s.players.opp.scene = [sceneChar(VICTIM, 'v', { state: 'sleep' })];
    let pick: PickSnap | null = null;
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'kid', viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'PR263', uid: 'kid' });
      pick = driveEnterChain(d, true, 'skip');
    });
    expect(pick, 'sceneRemove pick surface (0可)').not.toBeNull();
    expect(s.players.self.partnerAreaCards, 'jewel は消費済 (先段は実行)').toEqual([]);
    expect(s.players.self.remove, 'jewel remove へ').toContain(JEWEL);
    expect(s.players.opp.scene.some((c) => c.uid === 'v'), '0枚辞退 → VICTIM 残存').toBe(true);
    expect(s.players.opp.remove).toEqual([]);
  });

  it('E4 off-variant: 相手ターン中は condition turn:self 不成立 → a2 発火せず (optional も出ない)', () => {
    setHuman('self');
    let s = base('opp'); // 相手ターン
    s.players.self.scene = [sceneChar('PR263', 'kid', { state: 'active' })];
    s.players.self.partnerAreaCards = [JEWEL];
    s.players.opp.scene = [sceneChar(VICTIM, 'v', { state: 'sleep' })];
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'kid', viaEffect: false, enterOrder: 0 }, { player: 'self', cardId: 'PR263', uid: 'kid' });
      runAllUntilEmpty(d);
    });
    expect(_peekPendingEffectOptionalSide(), '相手ターン → optional 不出').toBeNull();
    expect(s.players.self.partnerAreaCards, 'jewel 未消費').toEqual([JEWEL]);
    expect(s.players.opp.scene.some((c) => c.uid === 'v'), 'VICTIM 残存').toBe(true);
  });
});

// ============================================================
// a3 — 【変装時】(disguise:into) 同 effect + BUG-174 owner=opp pin
// ============================================================
describe('PR263 a3 — 【変装時】disguise:into で同 chain / owner=opp pin', () => {
  it('D1 disguise:into: jewel 消費 → Lv7以下 sleep 除去 (a3 hook 配線)', () => {
    setHuman('self');
    let s = base('self');
    s.players.self.scene = [sceneChar('PR263', 'kid', { state: 'active' })];
    s.players.self.partnerAreaCards = [JEWEL, PAOTHER];
    s.players.opp.scene = [sceneChar(VICTIM, 'v', { state: 'stun' })]; // スタン状態も対象 (state[sleep,stun])
    let pick: PickSnap | null = null;
    s = produce(s, (d) => {
      event.emit(d, 'disguise:into', { uid: 'kid', fromCardId: DEC_ACT, newCardId: 'PR263', player: 'self' }, { player: 'self', uid: 'kid' });
      pick = driveEnterChain(d, true, 'v');
    });
    expect(pick, 'disguise:into 経由で sceneRemove surface').not.toBeNull();
    expect(pick!.candidates.map((c) => c.cardId), 'stun も候補').toContain(VICTIM);
    expect(s.players.self.partnerAreaCards, 'jewel 1枚消費').toEqual([PAOTHER]);
    expect(s.players.opp.remove, 'VICTIM 除去').toContain(VICTIM);
  });

  // ⚠ ENGINE_GAP (2026-07-10 発見): opp 所有 PR263 の a2/a3 partnerAreaRemove 短縮形は opp PA を読めず gate する。
  //   根因: atom-handlers/core.ts:242 `buildShortFormPick(defaultArea, a, paP, paP)` — 第4引数 sideDefault は
  //   相対 side ('self'|'opp'|'either') を期待するが、絶対 player paP ('opp') を渡している。a.side 未指定ゆえ
  //   query.side='opp' となり、sidesForQuery(side='opp', owner='opp') → oppSide('opp')='self' で SELF PA を列挙。
  //   opp PA の jewel が候補 0 → exact-N gate (chainStepNoApply) → 後段 sceneRemove も不発 (jewel 未消費)。
  //   self 所有では paP='self' で恒等一致するため露見しない (BUG-079 と同型の絶対/相対混同、pick 候補側に残存)。
  //   共通 primitive のため exemplar B07037 の opp 所有時も同様に壊れる (engine-wave-a1 test は self のみ検証)。
  //   ※ a1 (continuous) の owner=opp 非反転は C4 が別途 GREEN で pin 済 (dyn は ctx.source.player 直参照ゆえ健全)。
  //   本 scenario は正しい期待値 (opp PA 消費 + self 側キャラを self.remove へ) を assert し、意図的に fail させて
  //   engine bug を可視化する。カード本体/engine は編集禁止のため未修正。
  it('D2 owner=opp pin (BUG-174) — ENGINE_GAP: opp 所有 PR263 の partnerAreaRemove 短縮形が opp PA を読めず gate', () => {
    setHuman('opp');
    let s = base('opp'); // opp ターン (condition turn:self = owner ターンで成立)
    s.players.opp.scene = [sceneChar('PR263', 'okid', { state: 'active' })];
    s.players.opp.partnerAreaCards = [JEWEL];
    s.players.self.scene = [sceneChar(VICTIM, 'v', { state: 'sleep' })]; // 除去される self 側キャラ
    let pick: PickSnap | null = null;
    s = produce(s, (d) => {
      event.emit(d, 'enter', { uid: 'okid', viaEffect: false, enterOrder: 0 }, { player: 'opp', cardId: 'PR263', uid: 'okid' });
      pick = driveEnterChain(d, true, 'v');
    });
    expect(pick, 'sceneRemove surface').not.toBeNull();
    expect(pick!.player, 'chooser = owner(opp)').toBe('opp');
    expect(pick!.candidates.map((c) => c.cardId), 'side:either → 相手陣(self)キャラも候補').toContain(VICTIM);
    expect(s.players.opp.partnerAreaCards, 'opp PA jewel 消費').toEqual([]);
    expect(s.players.opp.remove, 'jewel は opp remove へ').toContain(JEWEL);
    expect(s.players.self.scene.some((c) => c.uid === 'v'), 'self VICTIM 除去').toBe(false);
    expect(s.players.self.remove, 'VICTIM は所有者(self) remove へ (反転しない)').toContain(VICTIM);
    expect(s.players.opp.remove.includes(VICTIM), 'VICTIM は opp remove には入らない').toBe(false);
  });
});
