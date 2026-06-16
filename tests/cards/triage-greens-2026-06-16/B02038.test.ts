// gate5 RUNTIME behavior — B02038 怪盗キッド (character, 白/L7 AP6000 LP1, 特徴[怪盗], SR)
//
// 公式テキスト:
//   【変装時】カードを1枚引く。このコンタクト中、このキャラをAP＋1000する。
//   【登場時】自分のリムーブエリアにあるレベル4以下の【白】のキャラを1枚まで選び、
//             スリープ状態で登場させる。
//   【変装】【事件白】【FILE6】（コンタクト中のキャラと入れ替わって手札から出る。
//             入れ替わったキャラはデッキの下に移す）
//
// rules:
//   03-field-areas.md (状態 / スリープ登場),
//   09-cutin-disguise.md (変装 = コンタクト中のキャラと入替 / 変装は「登場」ではない →【登場時】不発火),
//   15-abilities-effects.md (「〜まで」=0枚可 / 「〜する」=必須),
//   17-icons.md (【変装時】/【登場時】/【事件(色)】/【FILE(X)】= 条件アイコン),
//   20-color-and-switch.md (効果による登場 = 色制限なし),
//   23-qa-disguise-cutin.md (変装の引継ぎ / 変装時効果はコンタクト中に解決).
//
// 実 engine flow で駆動 (verb を直接呼ばない):
//   a1 (【変装時】 disguise:into):
//     flow.contact.disguise(state, ax, 'self', 'B02038') で、コンタクト中の atk キャラを
//     B02038 へ変装入替 → emit('disguise:into',{uid:atk},{player:'self',uid:atk}) →
//     triggered listener が a1 (hook:'disguise:into', selfOnly) を発火し sequence を解決:
//       step0 draw{self,1}  → デッキ先頭が手札へ
//       step1 charModifyAP{uid:'$self', delta:1000, scope:'contact'}
//             → $self = ctx.source.uid = 変装した atk uid (= B02038) → AP+1000 (apMod_contact)
//     (B03129 a2 が同型 disguise:into→draw、B02045 a1 が disguise:into→charModifyAP を実証済。
//      readChar.ap は apMod_contact を合算する: read/char.ts:99 modContact。)
//   a2 (【登場時】 enter):
//     handUseCard('B02038') で手札→現場登場 → emit 'enter'(uid=B02038) →
//     a2 (hook:'enter', selfOnly) → atom sceneEnter{from:'remove', max:1, enterSleep:true,
//       filter:{color:'白', levelMax:4, kind:'character'}} の remote pick を
//     runAllUntilEmpty + drainAiEffectPicks(AI auto-take) で解決。
//     (B02077 a1 / D05006 a1 が同型 sceneEnter from:'remove' enterSleep を実証済。)
//   a3 (【変装】 icon-disguise gate):
//     canDisguise(state, ax, 'self', 'B02038') が a3.condition = and[caseColor:白, fileAtLeast:6]
//     を評価する (disguise-hook-batch.test.ts D06012 と同型ハーネス)。
//
// 検証する filter / 条件 (BUG-117/118 lesson — DSL に書いても engine が評価する保証はない):
//   (a1)   変装入替で B02038 が atk uid を引継ぎ、draw 1枚 + 自身 AP+1000(contact) が実反映。
//          $self が「変装した本キャラ」を指す (相手キャラや別キャラではない) ことを AP で実証。
//   (a2-A) sceneEnter.filter {color:'白', levelMax:4, kind:'character'} を engine が **実評価** するか。
//          remove に有効候補(白/L4/char) + 3 decoy を仕込み、有効のみがスリープ登場・decoy は remove 残留。
//          DECOY: 色違い(赤L4char) / levelMax超(白L5char) / kind違い(白L4event)。
//   (a2-N1)「1枚まで」(rules/15) = 0枚可。remove に有効候補が無い → 何も登場しない (例外なし)。
//   (a2-N2) selfOnly: 別キャラの enter では a2 は発火しない (B02038 自身の enter のみで remove pick)。
//   (a3-A) canDisguise が 事件白+FILE6 で true / 事件赤 で false / FILE5 で false (条件アイコン実評価)。
//
// concern: 無し (全 assertion は公式テキストの mandate を grounded engine 挙動で確認)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { canDisguise, disguise } from '@/engine/flow/contact';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { char as readChar } from '@/engine/read/char';
import { sceneChar } from '../../helpers/fixtures';
import { B02038 } from '@/cards/ct-p02/B02038';
import type { CardDef, GameState, ActionContext } from '@/engine/types';

const FB = { type: 'card-back' as const, cardId: 'D08017' };

// ---- synthetic decoy defs (prefix DEC_B02038_ で id 衝突回避。abilities:[] で再帰トリガー無し) ----
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['白'],
    level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...over,
  };
}

// a2 remove 側候補/decoy
const R_HIT = 'DEC_B02038_REMOVE_HIT';     // 白 L4 character = 唯一の有効 sceneEnter 候補
const R_COLOR = 'DEC_B02038_REMOVE_COLOR'; // 赤 L4 character → color:白 違反で非対象
const R_LV5 = 'DEC_B02038_REMOVE_LV5';     // 白 L5 character → levelMax:4 超で非対象
const R_EVENT = 'DEC_B02038_REMOVE_EVENT'; // 白 L4 event → kind:character 違反で非対象
// a2-N2 別キャラ (selfOnly 反証用) — enter しても B02038 の a2 は発火しない
const OTHER_CHAR = 'DEC_B02038_OTHER';     // 白 L4 character (能力なし)

function registerDecoys(): void {
  registerCardDef(ch(R_HIT, { colors: ['白'], level: 4 }));
  registerCardDef(ch(R_COLOR, { colors: ['赤'], level: 4 }));
  registerCardDef(ch(R_LV5, { colors: ['白'], level: 5 }));
  registerCardDef(ch(R_EVENT, { kind: 'event', colors: ['白'], level: 4 }));
  registerCardDef(ch(OTHER_CHAR, { colors: ['白'], level: 4 }));
}

const inScene = (s: GameState, id: string) => s.players.self.scene.some((c) => c.cardId === id);
const inRemove = (s: GameState, id: string) => s.players.self.remove.includes(id);

// ---- a1 用: self atk(uid='atk') が opp dft(uid='dft') に action 中の ActionContext ----
function makeAx(): ActionContext {
  return {
    id: 'ax', byUid: 'atk', byPlayer: 'self', target: { kind: 'char', uid: 'dft' },
    phase: 'action-1', cutInUsed: {}, startedAt: { turn: 0, nano: 0 },
    apSnapshot: { aUid: 'atk', aAP: 4000, bUid: 'dft', bAP: 1000 }, contactImmune: false,
  };
}

// ---- a2 用: handUseCard で B02038 を登場させられる base (白事件 + FILE7 ≥ level7) ----
function a2Base(build: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  s.turn = { number: 8, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.hand = ['B02038'];
  s.players.self.case.colors = ['白']; // rules/20: handUseCard 自体は事件の色制限を受ける (B02038=白)
  s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ level7 → 手札使用可
  build(s);
  s = produce(s, (d) => {
    handUseCard(d, 'self', 'B02038');
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    }
  });
  return s;
}

describe('B02038 怪盗キッド — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    _clearPendingEffectPickQueue();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null; // AI 経路 (自動 take)
  });

  // ===== a1: 【変装時】 1ドロー + このコンタクト中 AP+1000 (disguise:into, $self=変装した本キャラ) =====
  it('a1: 変装(disguise)で B02038 が atk と入替 → カードを1枚引く + このコンタクト中このキャラ AP+1000 (6000→7000)', () => {
    let s = createEmptyGameState();
    s.turn = { number: 8, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('Atk0', 'atk', { state: 'active' })]; // コンタクト中の自キャラ
    s.players.opp.scene = [sceneChar('Def0', 'dft', { state: 'sleep' })];   // 攻撃対象
    s.players.self.hand = ['B02038'];
    s.players.self.case.colors = ['白'];
    s.players.self.file = [FB, FB, FB, FB, FB, FB]; // FILE6 + 事件白 → a3 gate 達成
    s.players.self.deck = ['DRAW_TOP', 'd2', 'd3']; // 変装時 draw の先頭 (disguise が元 cardId を deck 末尾へ push)

    expect(canDisguise(s, makeAx(), 'self', 'B02038'), '事件白+FILE6 → 変装可 (a3 gate)').toBe(true);

    s = produce(s, (d) => {
      disguise(d, makeAx(), 'self', 'B02038');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    // 変装で uid 維持・cardId が B02038 に差替わる (rules/09)
    const disguised = s.players.self.scene.find((c) => c.uid === 'atk');
    expect(disguised?.cardId, '変装で atk uid の cardId が B02038 に').toBe('B02038');
    // step0: カードを1枚引く (mandatory「する」) → デッキ先頭 DRAW_TOP が手札へ
    expect(s.players.self.hand, '【変装時】1ドローで DRAW_TOP が手札に').toContain('DRAW_TOP');
    expect(s.players.self.hand, '変装に使った B02038 は手札から消費済').not.toContain('B02038');
    // step1: このコンタクト中、このキャラ AP+1000。$self = 変装した本キャラ (atk uid = B02038, base6000)
    expect(readChar.ap(s, 'atk'), '【変装時】このキャラ AP+1000 (base6000 + contact1000 = 7000)').toBe(7000);
    // 相手キャラ (dft=未登録 Def0, base AP 0) には modifier が乗らない
    // ($self が誤って相手/別キャラを指していない証明 — もし dft を指せば AP=1000 になる)
    expect(readChar.ap(s, 'dft'), '相手キャラ dft の AP は素のまま (base0, contact mod 無し)').toBe(0);
    const dftDef = s.players.opp.scene.find((c) => c.uid === 'dft');
    expect((dftDef?.turnEffects['apMod_contact'] as number | undefined) ?? 0, 'dft に contact AP mod 無し').toBe(0);
  });

  // ===== a2-A + DECOY: 【登場時】 remove の 白/L4/char のみスリープ登場、3 decoy は非対象 =====
  it('a2 + DECOY: handUseCard で B02038 登場 → remove の 白L4キャラ(R_HIT)をスリープ登場 / 色違い・Lv5・event decoy は登場しない', () => {
    const s = a2Base((st) => {
      // remove: 有効1 (R_HIT 白L4char) + decoy3 (色違い赤 / Lv5超 / event)
      st.players.self.remove = [R_HIT, R_COLOR, R_LV5, R_EVENT];
    });

    // 前提: B02038 自身が登場している (a2 の enter 発火源)
    expect(inScene(s, 'B02038'), 'B02038 が現場に登場').toBe(true);

    // (THEN) 有効候補 R_HIT がスリープ状態で登場、remove から抜ける (enterSleep:true)
    const entered = s.players.self.scene.find((c) => c.cardId === R_HIT);
    expect(entered, '白L4キャラ (R_HIT) が現場に登場').toBeTruthy();
    expect(entered?.state, 'スリープ状態で登場 (enterSleep)').toBe('sleep');
    expect(inRemove(s, R_HIT), 'R_HIT はリムーブから抜けた').toBe(false);

    // DECOY 主張 (color/levelMax/kind filter 実評価の証明):
    expect(inScene(s, R_COLOR), '赤L4 decoy は登場しない (color:白 違反)').toBe(false);
    expect(inRemove(s, R_COLOR), '赤L4 decoy はリムーブに残る').toBe(true);
    expect(inScene(s, R_LV5), '白L5 decoy は登場しない (levelMax:4 超)').toBe(false);
    expect(inRemove(s, R_LV5), '白L5 decoy はリムーブに残る').toBe(true);
    expect(inScene(s, R_EVENT), '白L4 event decoy は登場しない (kind:character 違反)').toBe(false);
    expect(inRemove(s, R_EVENT), 'event decoy はリムーブに残る').toBe(true);

    // 現場登場は B02038 + R_HIT のちょうど 2 体 (R_HIT は 1 枚のみ = max:1)
    expect(s.players.self.scene.length, '現場 = B02038 + R_HIT の 2 体').toBe(2);
  });

  // ===== a2-N1: 「1枚まで」(rules/15) = 0枚可。remove に有効候補無し → 何も登場しない =====
  it('a2 NEGATIVE (候補無): remove に 白/L4以下/char が無い (decoy のみ) → 何も登場しない (「〜まで」=0枚可)', () => {
    const s = a2Base((st) => {
      st.players.self.remove = [R_COLOR, R_LV5, R_EVENT]; // すべて非該当 → 候補 0
    });

    expect(inScene(s, 'B02038'), 'B02038 は登場している').toBe(true);
    expect(inScene(s, R_COLOR), '赤L4 は登場しない').toBe(false);
    expect(inScene(s, R_LV5), '白L5 は登場しない').toBe(false);
    expect(inScene(s, R_EVENT), '白L4 event は登場しない').toBe(false);
    expect(s.players.self.remove.length, 'remove の 3 decoy はすべて残る').toBe(3);
    // 現場は B02038 の 1 体のみ (候補0 で no-op)
    expect(s.players.self.scene.length, '現場 = B02038 の 1 体のみ').toBe(1);
  });

  // ===== a2-N2: selfOnly — 別キャラの enter では B02038 の a2 は発火しない =====
  it('a2 NEGATIVE (selfOnly): 別キャラ(OTHER_CHAR)が登場しても B02038 の a2 は発火せず remove から登場しない', () => {
    // B02038 を現場に既存 (active) で置き、別カードを handUseCard で登場させる。
    let s = createEmptyGameState();
    s.turn = { number: 8, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('B02038', 'kid#1', { state: 'active' })]; // 既存 B02038 (今回の enter 対象ではない)
    s.players.self.hand = [OTHER_CHAR];
    s.players.self.case.colors = ['白'];
    s.players.self.file = [FB, FB, FB, FB]; // FILE4 ≥ OTHER_CHAR(L4)
    s.players.self.remove = [R_HIT]; // 有効候補は居るが B02038 の a2 が発火しなければ登場しない

    s = produce(s, (d) => {
      handUseCard(d, 'self', OTHER_CHAR);
      for (let i = 0; i < 6; i++) {
        runAllUntilEmpty(d);
        drainAiEffectPicks(d, new HeuristicPolicy());
      }
    });

    expect(inScene(s, OTHER_CHAR), 'OTHER_CHAR は登場した').toBe(true);
    expect(inScene(s, R_HIT), 'selfOnly: 別キャラの enter では a2 不発 → R_HIT は登場しない').toBe(false);
    expect(inRemove(s, R_HIT), 'R_HIT はリムーブに残る (a2 未発火)').toBe(true);
    // 現場は 既存 B02038 + OTHER_CHAR の 2 体のみ
    expect(s.players.self.scene.length, '現場 = 既存 B02038 + OTHER_CHAR の 2 体').toBe(2);
  });

  // ===== a3: 【変装】ゲート 【事件白】【FILE6】 — 条件達/未達で canDisguise が切替わる =====
  it('a3: canDisguise — 事件白+FILE6 → true / 事件赤 → false / FILE5 → false (条件アイコン実評価)', () => {
    const base = createEmptyGameState();
    base.players.self.scene = [sceneChar('Atk0', 'atk', { state: 'active' })];
    base.players.opp.scene = [sceneChar('Def0', 'dft', { state: 'sleep' })];
    base.players.self.hand = ['B02038'];
    const ax = makeAx();

    // 事件白 + FILE6 → 可
    const ok = produce(base, (d) => {
      d.players.self.case.colors = ['白'];
      d.players.self.file = [FB, FB, FB, FB, FB, FB];
    });
    expect(canDisguise(ok, ax, 'self', 'B02038'), '事件白+FILE6 → 変装可').toBe(true);

    // 事件赤 (白でない) → 不可 (caseColor:白 未達)
    const wrongColor = produce(ok, (d) => { d.players.self.case.colors = ['赤']; });
    expect(canDisguise(wrongColor, ax, 'self', 'B02038'), '事件白でない → 不可').toBe(false);

    // FILE5 (6未満) → 不可 (fileAtLeast:6 未達)
    const lowFile = produce(ok, (d) => { d.players.self.file = [FB, FB, FB, FB, FB]; });
    expect(canDisguise(lowFile, ax, 'self', 'B02038'), 'FILE5 → 不可').toBe(false);
  });

  // ===== descriptor 構造 sanity (GOLD 同形 matchObject) =====
  it('descriptor: a1=disguise:into(selfOnly) sequence(draw->charModifyAP $self contact), a2=enter(selfOnly) sceneEnter from:remove 白/L4/char enterSleep, a3=icon-disguise and[caseColor白,fileAtLeast6]', () => {
    const [a1, a2, a3] = B02038.abilities;

    // a1: 【変装時】
    expect(a1.type, 'a1 triggered').toBe('triggered');
    expect(a1.scope, 'a1 on-scene').toBe('on-scene');
    expect(a1.trigger, 'a1 disguise:into selfOnly').toMatchObject({ hook: 'disguise:into', selfOnly: true });
    const a1eff = a1.effect as { kind: string; steps: Array<Record<string, unknown>> };
    expect(a1eff.kind, 'a1 sequence').toBe('sequence');
    expect(a1eff.steps, 'a1 = 2 step').toHaveLength(2);
    expect(a1eff.steps[0], 'a1 step0 draw self 1').toMatchObject({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
    expect(a1eff.steps[1], 'a1 step1 charModifyAP $self +1000 contact').toMatchObject({
      kind: 'atom', verb: 'charModifyAP', args: { uid: '$self', delta: 1000, scope: 'contact' },
    });

    // a2: 【登場時】
    expect(a2.type, 'a2 triggered').toBe('triggered');
    expect(a2.scope, 'a2 on-scene').toBe('on-scene');
    expect(a2.trigger, 'a2 enter selfOnly').toMatchObject({ hook: 'enter', selfOnly: true });
    expect(a2.effect, 'a2 sceneEnter from:remove max1 enterSleep filter{白,L4,char}').toMatchObject({
      kind: 'atom', verb: 'sceneEnter',
      args: { player: 'self', from: 'remove', max: 1, viaEffect: true, enterSleep: true, filter: { color: '白', levelMax: 4, kind: 'character' } },
    });

    // a3: 【変装】 gate
    expect(a3.type, 'a3 icon-disguise').toBe('icon-disguise');
    expect(a3.condition, 'a3 condition and[caseColor:白, fileAtLeast:6]').toMatchObject({
      kind: 'and', cs: [{ kind: 'caseColor', color: '白' }, { kind: 'fileAtLeast', n: 6 }],
    });
    // a3 自体は effect/cost を持たない (変装時効果は a1 側)
    expect((a3 as { effect?: unknown }).effect, 'a3 に effect なし').toBeUndefined();
  });
});
