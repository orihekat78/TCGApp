// gate5 RUNTIME behavior — B02041 怪盗キッド (character, 白, Lv6 AP5000 LP1, 特徴[怪盗])
//
// 公式テキスト:
//   【パートナー白】【登場時】【変装時】キャラを1枚まで選び、スリープさせる。
//   【変装】【事件白】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。入れ替わったキャラはデッキの下に移す）
//
// rules:
//   03-field-areas.md (状態 active/sleep/stun / スタン特殊挙動 — sleep を受けてもスタンのまま),
//   09-cutin-disguise.md (【変装】= コンタクト中のキャラと入替 / 変装は「登場」ではない →
//     enter hook 不発火・disguise:into のみ発火 / 【変装時】能力は発動),
//   15-abilities-effects.md (「〜枚まで」= 0枚 decline 可 / 効果発動キャラ自身も選べる /
//     条件アイコン未達なら能力を持たない扱い → 発動しない),
//   17-icons.md (【パートナー白】= 自分の partner が白 / 【事件白】【FILE6】= 変装ゲート条件 /
//     条件アイコン未達 = 能力を持たない扱い),
//   23-qa-disguise-cutin.md (変装の引継ぎ・【変装時】効果).
//
// 検証の核 (BUG-117/118 教訓: DSL に condition/filter を書いても engine が評価する保証はない — 実機で踏む):
//   a1 (【登場時】= triggered enter selfOnly) の【パートナー白】= condition{partnerColor:白} を engine が
//     **実際に評価** しているか — 白パートナーなら sleep pick が surface、非白なら **発火しない**。
//   a2 (【変装時】= triggered disguise:into selfOnly) も同一【パートナー白】条件で gate されるか —
//     変装入替 (disguise()) 自体は成立しても、partner が非白なら sleep pick は **発火しない**
//     (= 変装ゲート【事件白】【FILE6】とは別軸の condition を engine が独立評価している証拠)。
//   sceneSetState 短縮形 pick が「キャラを1枚まで選び、スリープさせる」を text 通り駆動するか —
//     候補 = 両側 (side:'either') の現場キャラ全て (filter 無し)、nMin:0 (「1枚まで」)、
//     選んだキャラが sleep になる / 自身(怪盗キッド)も候補。
//   a3 (【変装】icon-disguise) の【事件白】&【FILE6】を canDisguise が **実評価** しているか。
//
// decoy / negative (この card は対象 filter が無いため、検証軸は side / condition / 0-pick / stun):
//   a1-cand   : 自陣キャラ + 敵陣キャラ を盤面に置き、pick 候補に **両側** が含まれる (side:'either' 実評価)。
//               filter 無し ⇒ kind:character の現場キャラのみが候補 (partner/event は area:scene 外で不候補)。
//   a1-apply  : 候補から **敵キャラ** を pick → sleep になる (side:'either' で相手キャラも対象に取れる)。
//   a1-cond-N : partner が **赤** (非白) → a1 不発火、sleep pick が surface しない (partnerColor gate)。
//   a1-0pick  : 「1枚まで」(rules/15) human decline → 誰も sleep にならない (全 active 維持)。
//               ⚠ この effect は単発 atom (trailing/連鎖 step 無し) なので decline = 完全な no-op が正 (BUG-111 trap 無し)。
//   a1-stun   : スタン状態のキャラを pick → sleep を受けても **スタンのまま** (rules/03/24 スタン特殊挙動)。
//   a2-fire   : disguise:into (白partner) で sleep pick が **実発火** (sceneSetState surface)。
//   a2-cond-N : disguise:into (非白partner) → 変装入替は成立 (cardId→B02041) するが sleep pick は **不発火**。
//   a3-gate   : canDisguise が【事件白】&【FILE6】met=可 / FILE5=不可 / 事件赤=不可 で切替わる。
//
// 注: a1/a2 の sleep 効果適用は UI pick (sceneSetState $pick) を applyPick* で解決する。ヒラメキ系の
//     hiramekiResolve 経路は本 card に無い (B02041 は【ヒラメキ】を持たない)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { canDisguise, disguise } from '@/engine/flow/contact';
import { applyPickAndContinuation, applyPickSkipAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../../helpers/fixtures';
import { B02041 } from '@/cards/ct-p02/B02041';
import type { CardDef, GameState, ActionContext } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- 合成 def 群 (id prefix DEC_B02041_ で衝突回避。abilities:[] = 登場/変装しても再帰トリガー無し) ----
const WHITE_PARTNER = 'DEC_B02041_WHITE_PARTNER'; // 白パートナー → 【パートナー白】成立
const RED_PARTNER = 'DEC_B02041_RED_PARTNER';     // 赤パートナー (非白) → 【パートナー白】不成立
const SELF_CHAR = 'DEC_B02041_SELF_CHAR';         // 自陣キャラ (side:self 候補)
const OPP_CHAR = 'DEC_B02041_OPP_CHAR';           // 敵陣キャラ (side:opp 候補 — side:'either' で取れる)

function partnerDef(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'partner', names: [id], colors,
    level: 0, ap: 0, lp: 3, traits: [], keywords: [], rarity: 'P',
    imageUrl: '', abilities: [], ruleRefs: [],
  } as unknown as CardDef;
}
function ch(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors,
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}
function registerDecoys(): void {
  registerCardDef(partnerDef(WHITE_PARTNER, ['白']));
  registerCardDef(partnerDef(RED_PARTNER, ['赤']));
  registerCardDef(ch(SELF_CHAR, ['緑']));
  registerCardDef(ch(OPP_CHAR, ['青']));
}

const FB = { type: 'card-back' as const, cardId: 'D08017' };

// self 側 attacker(uid='atk') が opp char(uid='dft') に action → contact 中の ax を構築 (disguise driver)
function makeAx(): ActionContext {
  return {
    id: 'ax', byUid: 'atk', byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
    phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
    apSnapshot: { aUid: 'atk', aAP: 4000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
  };
}

// 「手札の使用」で B02041 を登場させられる base (enter hook 経路)。
// 白事件 (rules/20 色制限) + FILE6 (rules/12 level6 使用可)。partner/scene は呼出側が組む。
function enterBase(partnerId: string): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.partner = { cardId: partnerId, state: 'active', location: 'partner-area' };
  s.players.self.case = { cardId: '', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
  s.players.self.file = Array.from({ length: 6 }, () => ({ ...FB })); // FILE6 ≥ level6
  s.players.self.hand = ['B02041'];
  s.players.self.deck = ['d1'];
  return s;
}

const sceneStateOf = (s: GameState, side: 'self' | 'opp', uid: string) =>
  s.players[side].scene.find((c) => c.uid === uid)?.state;

describe('B02041 怪盗キッド — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    _clearPendingEffectPickQueue();
    g.__pendingEffectPickQueue = [];
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    setHuman(null);
  });

  // ===== a1-cand: 【登場時】(白partner) で sleep pick が surface — 候補は両側の現場キャラ (side:'either' 実評価) =====
  it('a1 + 候補集合: 白partner で 登場時 sleep pick が surface — 候補に自陣・敵陣キャラ両方 + 自身 (side:either 実評価 / filter無し)', () => {
    setHuman('self'); // pending pick を覗いて候補集合を検証
    let s = enterBase(WHITE_PARTNER);
    s.players.self.scene = [sceneChar(SELF_CHAR, 'self1', { state: 'active' })];
    s.players.opp.scene = [sceneChar(OPP_CHAR, 'opp1', { state: 'active' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02041'); // 手札の使用 → enter hook
      runAllUntilEmpty(d);
    });

    const pending = pickQueue()[0];
    expect(pending?.atomVerb, 'sceneSetState pick が surface (= a1 発火)').toBe('sceneSetState');
    expect(pending?.nMin, '「1枚まで」= 0枚可 (decline channel)').toBe(0);
    const cands = pending!.candidates;
    const byUid = (uid: string) => cands.find((c) => c.uid === uid);
    // side:'either' を engine が実評価 → 自陣・敵陣 両方が候補
    expect(byUid('self1'), '自陣キャラ self1 が候補 (side:either)').toMatchObject({ player: 'self' });
    expect(byUid('opp1'), '敵陣キャラ opp1 も候補 (side:either)').toMatchObject({ player: 'opp' });
    // rules/15: 効果発動キャラ自身も選べる → 登場した怪盗キッド自身も候補
    expect(cands.some((c) => c.cardId === 'B02041'), '効果発動キャラ自身(怪盗キッド)も候補 (rules/15)').toBe(true);
    // 候補は現場キャラのみ (area:scene) — partner は area:scene 外なので含まれない
    expect(cands.some((c) => c.cardId === WHITE_PARTNER), 'partner は候補に含まれない (area:scene 外)').toBe(false);
  });

  // ===== a1-apply: 候補から敵キャラを pick → sleep になる (side:'either' で相手も対象) =====
  it('a1: 敵陣キャラを pick → sleep になる / 自陣キャラは active のまま (選んだ1枚のみ sleep)', () => {
    setHuman('self');
    let s = enterBase(WHITE_PARTNER);
    s.players.self.scene = [sceneChar(SELF_CHAR, 'self1', { state: 'active' })];
    s.players.opp.scene = [sceneChar(OPP_CHAR, 'opp1', { state: 'active' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02041');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    const pickOpp = pending.candidates.find((c) => c.uid === 'opp1')!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, pickOpp.uid);
    });

    expect(sceneStateOf(s, 'opp', 'opp1'), '選んだ敵キャラ opp1 は sleep').toBe('sleep');
    expect(sceneStateOf(s, 'self', 'self1'), '選ばなかった自陣 self1 は active のまま').toBe('active');
    // 怪盗キッド自身 (B02041) は登場直後 active (sleep されていない)
    expect(s.players.self.scene.find((c) => c.cardId === 'B02041')?.state, '怪盗キッド自身は active で登場').toBe('active');
  });

  // ===== a1-cond-N: 【パートナー白】未達 (赤partner) → a1 不発火 (sleep pick が surface しない) =====
  it('a1 condition NEGATIVE: partner が赤 (非白) → 登場時 sleep pick が surface しない (partnerColor gate 実評価)', () => {
    setHuman('self');
    let s = enterBase(RED_PARTNER);
    s.players.self.scene = [sceneChar(SELF_CHAR, 'self1', { state: 'active' })];
    s.players.opp.scene = [sceneChar(OPP_CHAR, 'opp1', { state: 'active' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02041');
      runAllUntilEmpty(d);
    });

    expect(pickQueue().length, '非白partner → a1 非発火 (partnerColor condition gate)').toBe(0);
    // 盤面のキャラは誰も sleep にならない
    expect(sceneStateOf(s, 'self', 'self1'), '自陣 self1 は active 維持').toBe('active');
    expect(sceneStateOf(s, 'opp', 'opp1'), '敵陣 opp1 は active 維持').toBe('active');
    // 怪盗キッド自身は登場済 (enter は通るが a1 effect は条件で gate)
    expect(s.players.self.scene.some((c) => c.cardId === 'B02041'), 'B02041 自体は現場に登場している').toBe(true);
  });

  // ===== a1-0pick: 「1枚まで」(rules/15) human decline → 誰も sleep にならない (単発 atom = 完全 no-op) =====
  it('a1 NEGATIVE (0-pick): decline で誰も sleep にならない (「1枚まで」= 0枚可 / trailing step 無し = clean no-op)', () => {
    setHuman('self');
    let s = enterBase(WHITE_PARTNER);
    s.players.self.scene = [sceneChar(SELF_CHAR, 'self1', { state: 'active' })];
    s.players.opp.scene = [sceneChar(OPP_CHAR, 'opp1', { state: 'active' })];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02041');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    expect(pending.atomVerb, 'pick surface (decline 前)').toBe('sceneSetState');
    expect(pending.nMin, '0枚 decline 可 (1枚まで)').toBe(0);
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending); // 0-pick decline
    });

    // 単発 atom (連鎖/「そうした場合」trailing 無し) → decline = 完全な no-op (BUG-111 trap 無し)
    expect(sceneStateOf(s, 'self', 'self1'), 'decline → 自陣 active 維持').toBe('active');
    expect(sceneStateOf(s, 'opp', 'opp1'), 'decline → 敵陣 active 維持').toBe('active');
  });

  // ===== a1-stun: スタン状態のキャラを pick → sleep を受けても スタンのまま (rules/03/24) =====
  it('a1 + スタン特殊挙動: スタン状態のキャラを pick → sleep を受けても スタンのまま (rules/03/24)', () => {
    setHuman('self');
    let s = enterBase(WHITE_PARTNER);
    s.players.opp.scene = [sceneChar(OPP_CHAR, 'opp1', { state: 'stun' })]; // スタン状態の敵

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B02041');
      runAllUntilEmpty(d);
    });
    const pending = pickQueue()[0]!;
    const pickOpp = pending.candidates.find((c) => c.uid === 'opp1')!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, pickOpp.uid);
    });

    // rules/03/24: スタン状態が「スリープさせる」効果を受けても スタンのまま
    expect(sceneStateOf(s, 'opp', 'opp1'), 'スタンのキャラに sleep を適用 → スタン維持 (sleep にならない)').toBe('stun');
  });

  // ===== a2-fire: 【変装時】(白partner) で disguise:into → sleep pick が実発火 =====
  it('a2 + 【変装時】(白partner): 変装入替 (cardId→B02041) 後に sleep pick が実発火 (disguise:into 経路)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.partner = { cardId: WHITE_PARTNER, state: 'active', location: 'partner-area' };
    s.players.self.scene = [sceneChar('Atk0', 'atk', { state: 'active' })];
    s.players.opp.scene = [sceneChar(OPP_CHAR, 'dft', { state: 'active' })];
    s.players.self.hand = ['B02041'];
    s.players.self.case = { cardId: '', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
    s.players.self.file = Array.from({ length: 6 }, () => ({ ...FB })); // FILE6 + 事件白 で変装可

    expect(canDisguise(s, makeAx(), 'self', 'B02041'), '事件白+FILE6 → 変装可').toBe(true);
    s = produce(s, (d) => {
      disguise(d, makeAx(), 'self', 'B02041'); // 変装 → disguise:into emit (uid 維持)
      runAllUntilEmpty(d);
    });

    // 変装は「登場」ではない (rules/09) → enter hook は発火せず disguise:into のみ。a2 が発火し pick surface。
    expect(s.players.self.scene.find((c) => c.uid === 'atk')?.cardId, '変装で cardId が B02041 に差替').toBe('B02041');
    const pending = pickQueue()[0];
    expect(pending?.atomVerb, '【変装時】sleep pick が surface (a2 発火)').toBe('sceneSetState');
    expect(pending?.nMin, '「1枚まで」= 0枚可').toBe(0);
    // 入替後のキャラ(B02041, uid=atk)も自身候補 / 敵 dft も候補 (side:either)
    expect(pending!.candidates.some((c) => c.uid === 'dft'), '敵キャラ dft が候補 (side:either)').toBe(true);
  });

  // ===== a2-cond-N: 【変装時】(非白partner) → 変装入替は成立するが sleep pick は不発火 =====
  it('a2 condition NEGATIVE: 非白partner → 変装入替 (cardId→B02041) は成立するが sleep pick は不発火 (partnerColor は変装ゲートと別軸)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    s.players.self.partner = { cardId: RED_PARTNER, state: 'active', location: 'partner-area' }; // 赤partner
    s.players.self.scene = [sceneChar('Atk0', 'atk', { state: 'active' })];
    s.players.opp.scene = [sceneChar(OPP_CHAR, 'dft', { state: 'active' })];
    s.players.self.hand = ['B02041'];
    s.players.self.case = { cardId: '', status: '事件編', requiredEvidence: 7, colors: ['白'], declaredUseCount: {} };
    s.players.self.file = Array.from({ length: 6 }, () => ({ ...FB }));

    // 変装ゲートは【事件白】【FILE6】(caseColor/file) のみ — partner 色は無関係なので可
    expect(canDisguise(s, makeAx(), 'self', 'B02041'), '変装ゲートは partner 色に依らず可 (事件白+FILE6)').toBe(true);
    s = produce(s, (d) => {
      disguise(d, makeAx(), 'self', 'B02041');
      runAllUntilEmpty(d);
    });

    // 変装入替自体は成立 (cardId が B02041 に)
    expect(s.players.self.scene.find((c) => c.uid === 'atk')?.cardId, '変装入替は成立 (cardId→B02041)').toBe('B02041');
    // しかし【パートナー白】未達 → a2 sleep pick は発火しない
    expect(pickQueue().length, '非白partner → a2 sleep pick 不発火 (partnerColor gate を変装ゲートと独立に評価)').toBe(0);
    expect(sceneStateOf(s, 'opp', 'dft'), '敵キャラ dft は active 維持 (sleep されない)').toBe('active');
  });

  // ===== a3-gate: 【変装】canDisguise が【事件白】&【FILE6】を実評価 =====
  it('a3 変装ゲート: canDisguise が【事件白】&【FILE6】met=可 / FILE5=不可 / 事件赤=不可 で切替わる', () => {
    const base = createEmptyGameState();
    base.players.self.scene = [sceneChar('Atk0', 'atk')];
    base.players.opp.scene = [sceneChar('Def0', 'dft')];
    base.players.self.hand = ['B02041'];
    const ax = makeAx();

    // 事件白 + FILE6 → 可
    const ok = produce(base, (d) => {
      d.players.self.case.colors = ['白'];
      d.players.self.file = Array.from({ length: 6 }, () => ({ ...FB }));
    });
    expect(canDisguise(ok, ax, 'self', 'B02041'), '事件白+FILE6 → 変装可').toBe(true);

    // FILE5 (6未満) → 不可 (fileAtLeast:6 実評価)
    const lowFile = produce(ok, (d) => { d.players.self.file = Array.from({ length: 5 }, () => ({ ...FB })); });
    expect(canDisguise(lowFile, ax, 'self', 'B02041'), 'FILE5 (6未満) → 変装不可').toBe(false);

    // 事件赤 (白でない) → 不可 (caseColor:白 実評価)
    const wrongColor = produce(ok, (d) => { d.players.self.case.colors = ['赤']; });
    expect(canDisguise(wrongColor, ax, 'self', 'B02041'), '事件白でない → 変装不可').toBe(false);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=enter(selfOnly)+partnerColor白+sceneSetState sleep / a2=disguise:into(selfOnly)+partnerColor白+同effect / a3=icon-disguise caseColor白&fileAtLeast6', () => {
    const [a1, a2, a3] = B02041.abilities;
    // a1: 【登場時】
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-scene');
    expect(a1.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a1.condition).toMatchObject({ kind: 'partnerColor', color: '白' });
    expect(a1.effect).toMatchObject({
      kind: 'atom', verb: 'sceneSetState',
      args: { player: 'self', max: 1, side: 'either', state: 'sleep' },
    });
    // a2: 【変装時】— a1 と同一効果、hook のみ disguise:into
    expect(a2.type).toBe('triggered');
    expect(a2.scope).toBe('on-scene');
    expect(a2.trigger).toMatchObject({ hook: 'disguise:into', selfOnly: true });
    expect(a2.condition).toMatchObject({ kind: 'partnerColor', color: '白' });
    expect(a2.effect).toEqual(a1.effect); // a1 と byte-identical な同一効果
    // a3: 【変装】icon-disguise + 【事件白】&【FILE6】
    expect(a3.type).toBe('icon-disguise');
    expect(a3.condition).toMatchObject({
      kind: 'and',
      cs: [
        { kind: 'caseColor', color: '白' },
        { kind: 'fileAtLeast', n: 6 },
      ],
    });
  });
});
