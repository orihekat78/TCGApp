// gate5 RUNTIME behavior — B07023 光本兵我 (character, 緑, Lv2 AP1000 LP1, 特徴[アイドル])
//
// 公式テキスト:
//   自分のターン終了時、このキャラを現場からリムーブしてもよい。そうした場合、
//   〚カード名［服部平次］〛か〚［毛利小五郎］〛のキャラを1枚まで選び、アクティブにする。
//
// rules:
//   03-field-areas.md (状態 active/sleep/stun, スタン→active は代わりに sleep),
//   05-turn-phases.md (エンドフェイズ = phase:end:start, ① 能力発動),
//   15-abilities-effects.md (「〜してもよい」=しない選択可 / 「〜まで」=0枚可),
//   17-icons.md (「〜を持つ」印字判定),
//   19-special-rules.md (カード名 split-name 判定 → allCardNameComponentsForDef),
//   24-qa-naming-stun.md (スタン特殊挙動).
//
// 検証の核 (BUG-117/118 教訓: DSL に filter を書いても engine が評価する保証はない):
//   a1 は optional{chain:[ sceneRemove{$self}, sceneSetState{active, filterAny:[{cardName:服部平次},{cardName:毛利小五郎}], side:either, max:1} ]}。
//   (1) optional ラッパ — AI は既定で skip (resolve-picks.ts:807)。human が「する」を選ぶと
//       chain が再 walk され、host が自己リムーブ → sceneSetState pick が surface する。
//   (2) sceneSetState pick の filterAny:[{cardName:'服部平次'},{cardName:'毛利小五郎'}] を engine が
//       **実際に評価** しているか。candidates.ts matchesFilters (L238-241 filterAny=.some OR) +
//       matchOneFilter (L257-264 filter.cardName → allCardNameComponentsForDef, rules/19 split-name)。
//       → 服部平次 or 毛利小五郎 のみ候補。他のカード名キャラは候補に入らず active 化されない。
//   (3) side:'either' (「キャラ」area-unspecified = どちらの現場, rules/15) を engine が honor するか。
//       buildShortFormPick (atom-pick-spec.ts:78 `side = a.side ?? sideDefault`) → 'either' 採用。
//       → 相手現場の 服部平次/毛利小五郎 も候補になる。
//
// decoy / negative (filter が実評価されている証明):
//   D-cardName: 自現場に「カード名違い」キャラ (DEC_B07023_WRONGNAME, names:['工藤新一']) を sleep で置く。
//       filter が無視されるなら候補に混入し誤って active 化されうる。honor されるなら候補外 → sleep のまま。
//   D-side:    相手現場に 毛利小五郎 (DEC_B07023_MOURI_OPP) を sleep で置く。side:'either' が honor
//       されるなら候補に入る (text どおり)。
//   N-decline: human が optional に「しない」(false) → host は自己リムーブされず現場に残り、誰も active 化しない。
//   N-aiskip:  AI 経路 (human=null) → optional 既定 skip → host 残存・誰も active 化しない。
//   N-condition: 相手ターン終了 (turn:opp) → condition turn:self 不成立 → a1 不発 (optional すら surface しない)。
//   N-0pick:   human「する」だが pick を 0枚 decline → host は自己リムーブ済 (chain 前段は適用) だが
//              誰も active 化しない (「〜まで」=0枚可, rules/15)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { endTurn } from '@/engine/flow/turn';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  applyOptionalAndContinuation,
  applyPickAndContinuation,
  applyPickSkipAndContinuation,
  _drainAllEffectPicksForTest,
} from '@/engine/effect/apply-pick';
import {
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
  _peekPendingEffectOptionalSide,
} from '@/engine/effect/resolve-picks';
import type { PendingEffectPickSide } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B07023 } from '@/cards/ct-p07/B07023';
import type { CardDef, GameState, SceneCharacter } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic decoy defs (prefix DEC_B07023_ で id 衝突回避) ----
function ch(id: string, name: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [name], colors: ['緑'],
    level: 2, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

// 有効候補: カード名 服部平次 / 毛利小五郎 のキャラ (filterAny の各 OR に対応)。
const HATTORI = 'DEC_B07023_HATTORI';        // names:['服部平次'] → 候補
const MOURI = 'DEC_B07023_MOURI';            // names:['毛利小五郎'] → 候補
const MOURI_OPP = 'DEC_B07023_MOURI_OPP';    // names:['毛利小五郎'] (相手現場) → side:'either' で候補
// decoy: カード名違い (どちらの OR にも該当しない) → 候補外。
const WRONGNAME = 'DEC_B07023_WRONGNAME';    // names:['工藤新一'] → 候補外

function registerDecoys(): void {
  registerCardDef(ch(HATTORI, '服部平次'));
  registerCardDef(ch(MOURI, '毛利小五郎'));
  registerCardDef(ch(MOURI_OPP, '毛利小五郎'));
  registerCardDef(ch(WRONGNAME, '工藤新一'));
}

const sceneState = (s: GameState, uid: string) =>
  [...s.players.self.scene, ...s.players.opp.scene].find((c) => c.uid === uid)?.state;
const inSelfScene = (s: GameState, uid: string) => s.players.self.scene.some((c) => c.uid === uid);

// B07023 を現場に置いた sleep host (on-scene triggered ability の host)。
function host(uid = 'host'): SceneCharacter {
  return sceneChar('B07023', uid, { state: 'sleep' });
}

describe('B07023 光本兵我 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    _clearPendingEffectOptionalSide();
    g.__pendingEffectPickQueue = [];
    setHuman(null);
  });

  // ===== a1 POSITIVE + DECOY: 「する」→ host 自己リムーブ + 服部平次/毛利小五郎 のみ候補 (cardName filterAny 実評価) =====
  it('a1 する + DECOY: ターン終了「する」で host を自己リムーブし、服部平次/毛利小五郎 を active 化 / カード名違いは候補外', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      host('host'),                                                  // B07023 自身 (sleep) → 自己リムーブ対象
      sceneChar(HATTORI, 'hattori', { state: 'sleep' }),             // 服部平次 (sleep) → 有効候補
      sceneChar(MOURI, 'mouri', { state: 'sleep' }),                 // 毛利小五郎 (sleep) → 有効候補
      sceneChar(WRONGNAME, 'wrong', { state: 'sleep' }),             // 工藤新一 (sleep) → 候補外 (cardName違い)
    ];

    // optional 「する」を実行
    let p;
    s = produce(s, (d) => {
      endTurn(d, 'self');           // phase:end:start emit → a1 (turn:self) → optional surface
      runAllUntilEmpty(d);
    });
    p = _peekPendingEffectOptionalSide();
    expect(p, 'optional がプレイヤーに surface する (してもよい)').not.toBeNull();
    expect(p!.player, 'optional の所有者は self').toBe('self');

    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, p!, true); // 「する」→ chain 再 walk: host 自己リムーブ + sceneSetState pick surface
    });

    // host は自己リムーブ済 (chain step1 sceneRemove $self)
    expect(inSelfScene(s, 'host'), 'host (B07023自身) は自己リムーブされ現場から消える').toBe(false);
    expect(s.players.self.remove.includes('B07023'), 'B07023 はリムーブエリアへ').toBe(true);

    // sceneSetState pick が surface。候補は 服部平次/毛利小五郎 のみ (cardName filterAny 実評価)。
    const pending = pickQueue().find((q) => q.atomVerb === 'sceneSetState');
    expect(pending, 'sceneSetState pick が surface').toBeTruthy();
    expect(pending!.nMin, '「〜まで」=0枚可').toBe(0);
    expect(pending!.nMax, 'max:1').toBe(1);
    const candUids = pending!.candidates.map((c) => c.uid).sort();
    // DECOY 主張: 候補は hattori/mouri のみ。wrong (工藤新一) は cardName filterAny に該当せず候補外。
    expect(candUids, '候補は 服部平次(hattori)/毛利小五郎(mouri) のみ — カード名違い wrong は候補外').toEqual(['hattori', 'mouri']);
    expect(pending!.candidates.some((c) => c.uid === 'wrong'), 'decoy(工藤新一) は候補に入らない').toBe(false);

    // 服部平次 (hattori) を選んで active 化
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, 'hattori');
    });
    expect(sceneState(s, 'hattori'), '服部平次 (hattori) が active 化').toBe('active');
    // DECOY 主張: 選ばれなかった候補 mouri は sleep のまま、候補外 wrong も sleep のまま
    expect(sceneState(s, 'mouri'), '選ばなかった 毛利小五郎 は sleep のまま (1枚まで)').toBe('sleep');
    expect(sceneState(s, 'wrong'), 'decoy(工藤新一) は候補外 → active 化されず sleep のまま').toBe('sleep');
  });

  // ===== side:'either' proof: 相手現場の 毛利小五郎 も候補 (「キャラ」= どちらの現場, rules/15) =====
  it('a1 side:either: 相手現場の 毛利小五郎 も候補に入る (「キャラ」area未指定=どちらの現場)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [host('host')];
    s.players.opp.scene = [
      sceneChar(MOURI_OPP, 'mouriOpp', { state: 'sleep' }),         // 相手現場の 毛利小五郎 → side:either で候補
      sceneChar(WRONGNAME, 'wrongOpp', { state: 'sleep' }),         // 相手現場の 工藤新一 → 候補外
    ];

    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d);
    });
    const p = _peekPendingEffectOptionalSide();
    expect(p, 'optional surface').not.toBeNull();

    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, p!, true);
    });
    const pending = pickQueue().find((q) => q.atomVerb === 'sceneSetState');
    expect(pending, 'sceneSetState pick surface').toBeTruthy();
    // side:'either' 実評価: 相手現場の 毛利小五郎 が候補に入り、相手現場の工藤新一(decoy)は入らない
    expect(pending!.candidates.map((c) => c.uid), '相手現場の 毛利小五郎 のみ候補 (side:either + cardName filterAny)').toEqual(['mouriOpp']);

    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, 'mouriOpp');
    });
    expect(sceneState(s, 'mouriOpp'), '相手現場の 毛利小五郎 が active 化').toBe('active');
    expect(sceneState(s, 'wrongOpp'), 'decoy(相手現場 工藤新一) は候補外 → sleep のまま').toBe('sleep');
  });

  // ===== N-decline: 「しない」(optional false) → host 残存・誰も active 化しない (してもよい) =====
  it('a1 NEGATIVE しない: optional false で host は自己リムーブされず、誰も active 化しない (「してもよい」)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      host('host'),
      sceneChar(HATTORI, 'hattori', { state: 'sleep' }),
    ];

    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d);
    });
    const p = _peekPendingEffectOptionalSide();
    expect(p, 'optional surface').not.toBeNull();

    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, p!, false); // 「しない」
    });
    // host は現場に残り、リムーブされない
    expect(inSelfScene(s, 'host'), 'しない: host は現場に残る (自己リムーブされない)').toBe(true);
    expect(s.players.self.remove.includes('B07023'), 'しない: B07023 はリムーブされない').toBe(false);
    // 服部平次 は active 化されない (chain 後段は走らない)
    expect(sceneState(s, 'hattori'), 'しない: 服部平次 は active 化されず sleep のまま').toBe('sleep');
    // pick も surface しない
    expect(pickQueue().some((q) => q.atomVerb === 'sceneSetState'), 'しない: sceneSetState pick は surface しない').toBe(false);
  });

  // ===== N-aiskip: AI 経路 (human=null) → optional 既定 skip → host 残存・誰も active 化しない =====
  it('a1 NEGATIVE AI skip: AI 経路では optional は既定 skip → host 残存・誰も active 化しない', () => {
    setHuman(null); // AI 経路
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      host('host'),
      sceneChar(HATTORI, 'hattori', { state: 'sleep' }),
    ];

    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    expect(inSelfScene(s, 'host'), 'AI: optional skip → host は現場に残る').toBe(true);
    expect(s.players.self.remove.includes('B07023'), 'AI: B07023 はリムーブされない').toBe(false);
    expect(sceneState(s, 'hattori'), 'AI: 服部平次 は active 化されず sleep のまま').toBe('sleep');
    expect(_peekPendingEffectOptionalSide(), 'AI: optional は surface しない').toBeNull();
  });

  // ===== N-condition: 相手ターン終了 (turn:opp) → a1 不発 (condition turn:self) =====
  it('a1 condition: 相手ターン終了 (turn:opp) では a1 不発 → optional すら surface しない', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      host('host'),
      sceneChar(HATTORI, 'hattori', { state: 'sleep' }),
    ];

    s = produce(s, (d) => {
      endTurn(d, 'opp'); // 相手ターン終了 → condition turn:self 不成立
      runAllUntilEmpty(d);
    });
    expect(_peekPendingEffectOptionalSide(), '相手ターン終了: optional は surface しない (a1 不発)').toBeNull();
    expect(inSelfScene(s, 'host'), '相手ターン終了: host はそのまま残る').toBe(true);
    expect(sceneState(s, 'hattori'), '相手ターン終了: 服部平次 は sleep のまま').toBe('sleep');
  });

  // ===== N-0pick: 「する」だが pick を 0枚 decline → host は自己リムーブ済だが誰も active 化しない (「〜まで」=0枚可) =====
  it('a1 0pick: 「する」で host を自己リムーブした後、pick を 0枚 decline すると 服部平次 は active 化しない (「〜まで」=0枚可)', () => {
    setHuman('self');
    let s = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [
      host('host'),
      sceneChar(HATTORI, 'hattori', { state: 'sleep' }),
    ];

    s = produce(s, (d) => {
      endTurn(d, 'self');
      runAllUntilEmpty(d);
    });
    const p = _peekPendingEffectOptionalSide();
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, p!, true);
    });
    // host は自己リムーブ済 (chain 前段は適用)
    expect(inSelfScene(s, 'host'), '「する」: host は自己リムーブ済').toBe(false);
    const pending = pickQueue().find((q) => q.atomVerb === 'sceneSetState');
    expect(pending, 'sceneSetState pick surface').toBeTruthy();
    expect(pending!.nMin, '0枚可 (decline channel)').toBe(0);

    // 0枚 decline
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending!);
    });
    expect(sceneState(s, 'hattori'), '0枚 decline: 服部平次 は active 化されず sleep のまま').toBe('sleep');
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=phase:end:start(turn:self) optional{chain[sceneRemove $self, sceneSetState active filterAny cardName 服部平次/毛利小五郎 side either max1]}', () => {
    const [a1] = B07023.abilities;
    expect(a1.trigger).toMatchObject({ hook: 'phase:end:start' });
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect((a1.effect as { kind: string }).kind, 'optional ラッパ (してもよい)').toBe('optional');
    const chain = (a1.effect as { effect: { kind: string; steps: Array<{ verb?: string; args?: Record<string, unknown> }> } }).effect;
    expect(chain.kind, 'そうした場合 = chain').toBe('chain');
    expect(chain.steps[0]).toMatchObject({ verb: 'sceneRemove', args: { uid: '$self', cause: 'effect' } });
    expect(chain.steps[1]).toMatchObject({
      verb: 'sceneSetState',
      args: {
        player: 'self', max: 1, side: 'either', state: 'active',
        filterAny: [{ cardName: '服部平次' }, { cardName: '毛利小五郎' }],
      },
    });
  });
});
