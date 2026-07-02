// wave-deck-mill-gated-chain (2026-06-23) — engine拡張 mill gate flag + 出荷4枚(+P4) の文言=処理検証
//   B01044 怪盗キッド / B03094 萩原千速 / B05061 終極(event) / B06016 鬼丸猛
//
// engine拡張 (additive 1 file): atomMill に gate:true 分岐を追加。
//   「自分のデッキを上からN枚リムーブする」が実行不能 (deck<N) のとき何もリムーブせず chainStepNoApply を立て、
//   chain (「そうした場合」) を break = 後続 (consequence) を skip する。公式Q&A all-or-nothing gate
//   (B01044/B03094/B05061/B06016: 「N枚リムーブが実行できない場合、それ以降の効果は解決できない」)。
//   gate 未指定/false は従来挙動 (可能な限りリムーブ+refresh、B09064/B09104) を完全保持 = 回帰ゼロ。
//
// 非 deck カード (MVP外) は playwright 不可 → engine path を decoy 込みで直接踏む (BUG-117/118 教訓を engine 層で):
//   ① runAtom mill gate=true: deck≥N → N枚 mill + chainStepNoApply 立たず / deck<N → 0枚 + chainStepNoApply=true / deck==N 境界
//   ② legacy 回帰: gate 無し mill は従来「可能な限り mill + refresh」(chainStepNoApply 立たない) — B09104 shape の decoy
//   ③ chain break witness: chain[mill(gate), draw] で deck≥N→draw 実行 / deck<N→draw skip (consequence decoy = 「そうした場合」)
//   ④ optional wrapper: optionalRun=true で実行 / 未指定で skip
//   ⑤ per-card 実行: 各カードの実 DSL を optionalRun=true で run → 固有 N で gate 動作 (deck 変化) を witness
//   ⑥ B03094 a2 golden full: deck≥2 → mill2 + apMod_action=1000 / deck<2 → mill無 + AP不変 (gate+consequence 両 deterministic)
//   ⑦ DSL 構造断言 (faithfulness): gate:true / n / consequence atom+args / partnerColor condition / scope:action / sleepSelf cost / optional|chain shape
//   ⑧ parallel 同一性 (id/no/rarity/imageUrl のみ差、abilities 継承)
//
// rules: 07-action-flow / 13-keywords / 14-refresh / 15-abilities-effects / 17-icons / 21-declared-ability-cost / 22-qa-action-contact / 26-qa-deck-refresh

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { run } from '@/engine/effect/resolver';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { makeCtx, sceneChar } from '../helpers/fixtures';
import { B01044 } from '@/cards/ct-p01/B01044';
import { B01044P } from '@/cards/ct-p01/B01044P';
import { B03094 } from '@/cards/ct-p03/B03094';
import { B03094P } from '@/cards/ct-p03/B03094P';
import { B05061 } from '@/cards/ct-p05/B05061';
import { B05061P } from '@/cards/ct-p05/B05061P';
import { B06016 } from '@/cards/ct-p06/B06016';
import { B06016P } from '@/cards/ct-p06/B06016P';
import { PR276 } from '@/cards/pr-01/PR276';
import { D02004 } from '@/cards/ct-d02/D02004';
import type { GameState, EffectCtx, Effect } from '@/engine/types';

function deckOf(n: number, prefix = 'D'): string[] {
  return Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);
}

function base(turnPlayer: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  // mill された札は .remove へ送られるので、deck が 0 になった場合でも refresh は milled 札を pool に使える
  // (リムーブ0枚敗北は起きない)。
  return s;
}

const ctxSelf = (over: Partial<EffectCtx['source']> = {}) =>
  makeCtx({ source: { player: 'self', uid: 'src#1', cardId: 'B01044', area: 'scene', ...over }, dyn: {} });

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  resetDefRegistry();
  registerAll();
  registerTriggeredListener();
  _clearPendingEffectPickQueue();
});

// ============================================================
// ① runAtom mill gate=true — 新 capability の核
// ============================================================
describe('① runAtom mill gate=true', () => {
  it('deck≥N: N枚 mill + chainStepNoApply 立たない (gate 通過)', () => {
    const s = base();
    s.players.self.deck = deckOf(10);
    const ctx = ctxSelf();
    const r = produce(s, d => { runAtom(d, 'mill', { player: 'self', n: 7, gate: true }, ctx); });
    expect(r.players.self.deck.length, '7枚 mill → 残3').toBe(3);
    expect(ctx.dyn?.chainStepNoApply, 'gate 通過なので chain break しない').toBeFalsy();
  });

  it('deck<N: 0枚 (deck 不変) + chainStepNoApply=true (gate 阻止)', () => {
    const s = base();
    s.players.self.deck = deckOf(6); // 6 < 7
    const ctx = ctxSelf();
    const r = produce(s, d => { runAtom(d, 'mill', { player: 'self', n: 7, gate: true }, ctx); });
    expect(r.players.self.deck.length, 'mill されず deck 不変').toBe(6);
    expect(ctx.dyn?.chainStepNoApply, 'gate 阻止 = chain break 信号').toBe(true);
  });

  it('deck==N 境界: ちょうど N 枚なら gate 通過し N 枚 mill (deck=0→refresh)', () => {
    const s = base();
    s.players.self.deck = deckOf(7); // == 7
    const ctx = ctxSelf();
    const r = produce(s, d => { runAtom(d, 'mill', { player: 'self', n: 7, gate: true }, ctx); });
    expect(ctx.dyn?.chainStepNoApply, 'deck==N は gate 通過 (deck<N が false)').toBeFalsy();
    // 7枚 mill → deck 0 → refresh (mill した7枚が .remove → 再シャッフルで deck へ) + 相手 evidence +1 (rules/14)
    expect(r.players.opp.evidence.length, 'deck 枯渇 → refresh = mill が起きた証跡 (gate 通過)').toBe(1);
  });
});

// ============================================================
// ② legacy 回帰: gate 無し mill は従来挙動を完全保持 (回帰ゼロ証跡)
// ============================================================
describe('② legacy mill (gate 無し) 回帰', () => {
  it('gate 無し + deck<N: 可能な限り mill + refresh、chainStepNoApply 立たない (B09104 shape)', () => {
    const s = base();
    s.players.self.deck = deckOf(6);
    const ctx = ctxSelf();
    const r = produce(s, d => { runAtom(d, 'mill', { player: 'self', n: 7 }, ctx); }); // gate 指定なし
    // 従来: 6枚すべて mill → deck 0 → refresh (mill した6枚が .remove → 再シャッフル)。chain break しない。
    expect(r.players.opp.evidence.length, 'gate無=可能な限り mill→refresh (deck 枯渇)').toBe(1);
    expect(ctx.dyn?.chainStepNoApply, 'gate 無は chain break 信号を立てない').toBeFalsy();
  });

  it('gate:false 明示でも従来挙動 (deck≥N で N 枚 mill、chainStepNoApply 無)', () => {
    const s = base();
    s.players.opp.deck = deckOf(10);
    const ctx = ctxSelf();
    const r = produce(s, d => { runAtom(d, 'mill', { player: 'opp', n: 4, gate: false }, ctx); });
    expect(r.players.opp.deck.length, 'gate:false は従来通り N 枚 mill').toBe(6);
    expect(ctx.dyn?.chainStepNoApply).toBeFalsy();
  });

  it('gate 無し + deck≥N: 従来通り N 枚 mill', () => {
    const s = base();
    s.players.self.deck = deckOf(10);
    const ctx = ctxSelf();
    const r = produce(s, d => { runAtom(d, 'mill', { player: 'self', n: 4 }, ctx); });
    expect(r.players.self.deck.length).toBe(6);
    expect(ctx.dyn?.chainStepNoApply).toBeFalsy();
  });
});

// ============================================================
// ③ chain break witness — consequence decoy で「そうした場合」semantics
// ============================================================
describe('③ chain[mill(gate), draw] — gate→chain break で consequence skip', () => {
  const chain = (n: number): Effect => ({
    kind: 'chain',
    steps: [
      { kind: 'atom', verb: 'mill', args: { player: 'self', n, gate: true } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, // decoy consequence (deck→hand)
    ],
  });

  it('deck≥N: mill 後に draw (consequence) が実行される', () => {
    const s = base();
    s.players.self.deck = deckOf(10);
    s.players.self.hand = [];
    const r = produce(s, d => { run(d, chain(7), ctxSelf()); });
    // mill7 (deck 10→3) → draw1 (deck 3→2, hand +1)
    expect(r.players.self.deck.length).toBe(2);
    expect(r.players.self.hand.length, 'gate 通過で draw 実行').toBe(1);
  });

  it('deck<N: mill 阻止 + draw (consequence) が skip される', () => {
    const s = base();
    s.players.self.deck = deckOf(6);
    s.players.self.hand = [];
    const r = produce(s, d => { run(d, chain(7), ctxSelf()); });
    expect(r.players.self.deck.length, 'mill されず deck 不変').toBe(6);
    expect(r.players.self.hand.length, 'gate 阻止で chain break → draw skip').toBe(0);
  });
});

// ============================================================
// ④ optional wrapper — optionalRun gating
// ============================================================
describe('④ optional{chain[mill(gate), draw]} — optionalRun gating', () => {
  const opt: Effect = {
    kind: 'optional',
    effect: { kind: 'chain', steps: [
      { kind: 'atom', verb: 'mill', args: { player: 'self', n: 3, gate: true } },
      { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    ] },
  };

  it('optionalRun=true: 実行 (mill+draw)', () => {
    const s = base(); s.players.self.deck = deckOf(10); s.players.self.hand = [];
    const ctx = makeCtx({ source: { player: 'self', uid: 's#1', cardId: 'X', area: 'scene' }, dyn: { optionalRun: true } });
    const r = produce(s, d => { run(d, opt, ctx); });
    expect(r.players.self.deck.length).toBe(6); // mill3→7, draw1→6
    expect(r.players.self.hand.length).toBe(1);
  });

  it('optionalRun 未指定: 全 skip (mill されない)', () => {
    const s = base(); s.players.self.deck = deckOf(10); s.players.self.hand = [];
    const ctx = makeCtx({ source: { player: 'self', uid: 's#1', cardId: 'X', area: 'scene' }, dyn: {} });
    const r = produce(s, d => { run(d, opt, ctx); });
    expect(r.players.self.deck.length, 'optional 辞退 → mill されない').toBe(10);
    expect(r.players.self.hand.length).toBe(0);
  });
});

// ============================================================
// ⑤ per-card 実行 — 各カードの実 DSL で固有 N の gate 動作を witness
// ============================================================
describe('⑤ per-card: 実 DSL で gate (deck 変化) を witness', () => {
  const runEff = (eff: Effect, s: GameState, src: Partial<EffectCtx['source']>) =>
    produce(s, d => { run(d, eff, makeCtx({ source: { player: 'self', uid: 'u#1', cardId: 'X', area: 'scene', ...src }, dyn: { optionalRun: true } })); });

  it('B01044 a1 (mill7): deck≥7 → mill / deck<7 → 不変', () => {
    const eff = B01044.abilities[0]!.effect;
    let s = base(); s.players.self.deck = deckOf(10); s.players.opp.scene = [sceneChar('B03094', 'o#1')];
    expect(runEff(eff, s, {}).players.self.deck.length, 'deck10 → mill7 → 3').toBe(3);
    s = base(); s.players.self.deck = deckOf(6); s.players.opp.scene = [sceneChar('B03094', 'o#1')];
    expect(runEff(eff, s, {}).players.self.deck.length, 'deck6 → gate 阻止 → 不変').toBe(6);
  });

  it('B05061 a1 (event, mill7, side:opp): deck≥7 → mill / deck<7 → 不変', () => {
    const eff = B05061.abilities[0]!.effect;
    let s = base(); s.players.self.deck = deckOf(10); s.players.opp.scene = [sceneChar('B03094', 'o#1')];
    expect(runEff(eff, s, { cardId: 'B05061', area: 'hand' }).players.self.deck.length).toBe(3);
    s = base(); s.players.self.deck = deckOf(6); s.players.opp.scene = [sceneChar('B03094', 'o#1')];
    expect(runEff(eff, s, { cardId: 'B05061', area: 'hand' }).players.self.deck.length).toBe(6);
  });

  it('B06016 a1 (mill3): deck≥3 → mill / deck<3 → 不変', () => {
    const eff = B06016.abilities[0]!.effect;
    let s = base(); s.players.self.deck = deckOf(10); s.players.self.scene = [sceneChar('C', 'c#1', { apOverride: 8000 })];
    expect(runEff(eff, s, { cardId: 'B06016' }).players.self.deck.length, 'deck10 → mill3 → 7').toBe(7);
    s = base(); s.players.self.deck = deckOf(2); s.players.self.scene = [sceneChar('C', 'c#1')];
    expect(runEff(eff, s, { cardId: 'B06016' }).players.self.deck.length, 'deck2 → gate 阻止 → 不変').toBe(2);
  });
});

// ============================================================
// ⑥ B03094 a2 golden full — gate + consequence 両 deterministic
// ============================================================
describe('⑥ B03094 a2: deck≥2 → mill2 + AP+1000(action) / deck<2 → 無', () => {
  const a2 = B03094.abilities[1]!; // a1=partnerColorKeyword, a2=mill→AP
  const run94 = (deckN: number) => {
    const s = base();
    s.players.self.deck = deckOf(deckN);
    s.players.self.scene = [sceneChar('B03094', 'k#1', { apOverride: null })];
    const ctx = makeCtx({ source: { player: 'self', uid: 'k#1', cardId: 'B03094', area: 'scene' }, dyn: { optionalRun: true } });
    return produce(s, d => { run(d, a2.effect, ctx); });
  };

  it('deck≥2: mill2 + このキャラ apMod_action=1000', () => {
    const r = run94(5);
    expect(r.players.self.deck.length, 'mill2 → 3').toBe(3);
    expect(r.players.self.scene[0]!.turnEffects['apMod_action'], 'AP+1000 action-scope').toBe(1000);
  });

  it('deck<2: mill 阻止 + AP 不変 (consequence skip)', () => {
    const r = run94(1);
    expect(r.players.self.deck.length, 'gate 阻止 → deck 不変').toBe(1);
    expect(r.players.self.scene[0]!.turnEffects['apMod_action'] ?? 0, 'AP 修飾なし').toBe(0);
  });
});

// ============================================================
// ⑦ DSL 構造断言 — faithfulness (文言⇔descriptor)
// ============================================================
describe('⑦ DSL 構造断言 (文言⇔descriptor)', () => {
  it('B01044 a1: partnerColor白 condition + enter selfOnly + optional{chain[mill7 gate, sceneToDeck either bottom]}', () => {
    const a = B01044.abilities[0]!;
    expect(a.condition).toEqual({ kind: 'partnerColor', color: '白' });
    expect(a.trigger).toEqual({ hook: 'enter', selfOnly: true });
    const opt = a.effect as Extract<Effect, { kind: 'optional' }>;
    expect(opt.kind).toBe('optional');
    const ch = opt.effect as Extract<Effect, { kind: 'chain' }>;
    expect(ch.steps[0]).toEqual({ kind: 'atom', verb: 'mill', args: { player: 'self', n: 7, gate: true } });
    expect(ch.steps[1]).toEqual({ kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'either', max: 1, pos: 'bottom' } });
  });

  it('B03094 a2: 無条件 + action:declare selfOnly + chain[mill2 gate, charModifyAP $self +1000 action]', () => {
    const a = B03094.abilities[1]!;
    expect(a.condition, 'a2 は【パートナー黄】の影響を受けない (Q&A)').toBeUndefined();
    expect(a.trigger).toEqual({ hook: 'action:declare', selfOnly: true });
    expect(a.limit, '【ターン1】無し').toBeUndefined();
    const ch = (a.effect as Extract<Effect, { kind: 'optional' }>).effect as Extract<Effect, { kind: 'chain' }>;
    expect(ch.steps[0]).toEqual({ kind: 'atom', verb: 'mill', args: { player: 'self', n: 2, gate: true } });
    expect(ch.steps[1]).toEqual({ kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'action' } });
  });

  it('B05061 a1: event-use trigger + partnerColor白 + chain[mill7 gate, sceneToDeck opp bottom]', () => {
    const a = B05061.abilities[0]!;
    expect(a.condition).toEqual({ kind: 'partnerColor', color: '白' });
    expect(a.trigger?.hook).toBe('effect:declared');
    const ch = (a.effect as Extract<Effect, { kind: 'optional' }>).effect as Extract<Effect, { kind: 'chain' }>;
    expect(ch.steps[0]).toEqual({ kind: 'atom', verb: 'mill', args: { player: 'self', n: 7, gate: true } });
    expect(ch.steps[1]).toEqual({ kind: 'atom', verb: 'sceneToDeck', args: { player: 'self', side: 'opp', max: 1, pos: 'bottom' } });
  });

  it('B06016 a1: partnerColor緑 + enter + chain[mill3 gate, sceneRemove apMax8000]; a2: declared turn1 sleepSelf + chain[evidenceToHand, handToEvidence]', () => {
    const a1 = B06016.abilities[0]!;
    expect(a1.condition).toEqual({ kind: 'partnerColor', color: '緑' });
    const ch1 = (a1.effect as Extract<Effect, { kind: 'optional' }>).effect as Extract<Effect, { kind: 'chain' }>;
    expect(ch1.steps[0]).toEqual({ kind: 'atom', verb: 'mill', args: { player: 'self', n: 3, gate: true } });
    expect(ch1.steps[1]).toMatchObject({ verb: 'sceneRemove', args: { filter: { apMax: 8000 }, side: 'either', max: 1 } });
    const a2 = B06016.abilities[1]!;
    expect(a2.type).toBe('declared');
    expect(a2.limit).toEqual({ kind: 'turn', n: 1 });
    expect(a2.cost).toEqual({ kind: 'sleepSelf' });
    const ch2 = a2.effect as Extract<Effect, { kind: 'chain' }>;
    expect(ch2.kind, 'a2 は bare chain (optional wrapper 無し、B06029 と同型)').toBe('chain');
    expect(ch2.steps[0]).toEqual({ kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', max: 1 } });
    expect(ch2.steps[1]).toEqual({ kind: 'atom', verb: 'handToEvidence', args: { player: 'self', n: 1 } });
  });
});

// ============================================================
// ⑧ parallel 同一性
// ============================================================
describe('⑧ parallel 同一性 (abilities 継承 / id・no・rarity・imageUrl のみ差)', () => {
  const pairs: [string, typeof B01044, typeof B01044P, string, string][] = [
    ['B01044', B01044, B01044P, '0036/B01044P', 'SRP'],
    ['B03094', B03094, B03094P, '0347/B03094P', 'CP'],
    ['B05061', B05061, B05061P, '0563/B05061P', 'CP'],
    ['B06016', B06016, B06016P, '0639/B06016P', 'SRCP'],
  ];
  for (const [baseId, b, p, pno, prarity] of pairs) {
    it(`${baseId}P は ${baseId} の abilities を共有`, () => {
      expect(p.abilities, 'abilities 参照を継承').toBe(b.abilities);
      expect(p.id).toBe(`${baseId}P`);
      expect(p.no).toBe(pno);
      expect(p.rarity).toBe(prarity);
      expect(p.imageUrl, 'imageUrl は base と異なる').not.toBe(b.imageUrl);
      expect(p.kind).toBe(b.kind);
    });
  }
});

// ============================================================
// ⑨ BUG-162 監査修正 — 「アクション終了時まで」= scope:'action' / 「そうした場合」= gated chain
//   compiler oracle の conflict 検出 (同文言 shipped が異 DSL) で判明した誤訳:
//   PR276 (萩原千速 promo) が同一カード B03094 と divergence: sequence(ungated)+scope:'turn' の 3 誤り。
//   水平展開で D02004 (服部平次) も同型 scope:'turn' bug を保持していた (PR276 が precedent に誤引用)。
// ============================================================
describe('⑨ BUG-162: PR276 ≡ B03094 a2 / D02004 scope:action', () => {
  it('PR276 a2 は B03094 a2 と構造完全一致 (optional{chain[mill2 gate, charModifyAP $self +1000 action]})', () => {
    const pr = PR276.abilities[1]!; // a1=partnerColorKeyword, a2=mill→AP
    const b94 = B03094.abilities[1]!;
    expect(pr.trigger).toEqual({ hook: 'action:declare', selfOnly: true });
    const ch = (pr.effect as Extract<Effect, { kind: 'optional' }>).effect as Extract<Effect, { kind: 'chain' }>;
    expect(ch.kind, '「そうした場合」= chain (旧 sequence は誤り)').toBe('chain');
    expect(ch.steps[0]).toEqual({ kind: 'atom', verb: 'mill', args: { player: 'self', n: 2, gate: true } });
    expect(ch.steps[1]).toEqual({ kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'action' } });
    // effect 意味論が B03094 と一致 (同一カード) — 描画順・args 完全同形
    expect(pr.effect).toEqual(b94.effect);
  });

  it('PR276 a2 挙動: deck≥2 → mill2 + apMod_action=1000 / deck<2 → 無 (gate)', () => {
    const runPR = (deckN: number) => {
      const s = base();
      s.players.self.deck = deckOf(deckN);
      s.players.self.scene = [sceneChar('PR276', 'p#1', { apOverride: null })];
      const ctx = makeCtx({ source: { player: 'self', uid: 'p#1', cardId: 'PR276', area: 'scene' }, dyn: { optionalRun: true } });
      return produce(s, d => { run(d, PR276.abilities[1]!.effect, ctx); });
    };
    const ok = runPR(5);
    expect(ok.players.self.deck.length, 'mill2 → 3').toBe(3);
    expect(ok.players.self.scene[0]!.turnEffects['apMod_action'], 'AP+1000 action-scope (turn ではない)').toBe(1000);
    expect(ok.players.self.scene[0]!.turnEffects['apMod_turn'] ?? 0, 'apMod_turn は積まれない').toBe(0);
    const no = runPR(1);
    expect(no.players.self.deck.length, 'gate 阻止 → deck 不変').toBe(1);
    expect(no.players.self.scene[0]!.turnEffects['apMod_action'] ?? 0, 'AP 修飾なし').toBe(0);
  });

  it('D02004 a1: forEach do の charModifyAP は scope:action (旧 turn は誤り)', () => {
    const a1 = D02004.abilities[0]!;
    const fe = a1.effect as Extract<Effect, { kind: 'forEach' }>;
    expect(fe.kind).toBe('forEach');
    expect(fe.do).toEqual({ kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'action' } });
  });

  it('D02004 a1 挙動: 相手 sleep/stun 2枚 → apMod_action=2000 (action-scope で集計)', () => {
    const s = base();
    s.players.self.scene = [sceneChar('D02004', 'd#1', { apOverride: null })];
    s.players.opp.scene = [sceneChar('X', 'o#1', { state: 'sleep' }), sceneChar('Y', 'o#2', { state: 'stun' }), sceneChar('Z', 'o#3', { state: 'active' })];
    const ctx = makeCtx({ source: { player: 'self', uid: 'd#1', cardId: 'D02004', area: 'scene' }, dyn: {} });
    const r = produce(s, d => { run(d, D02004.abilities[0]!.effect, ctx); });
    expect(r.players.self.scene[0]!.turnEffects['apMod_action'], 'sleep+stun 2枚 → +2000 (active は除外)').toBe(2000);
    expect(r.players.self.scene[0]!.turnEffects['apMod_turn'] ?? 0).toBe(0);
  });
});
