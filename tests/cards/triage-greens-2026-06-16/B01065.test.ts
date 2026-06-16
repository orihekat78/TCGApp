// gate5 RUNTIME behavior — B01065 沖矢昴 (character, 赤, Lv5 AP5000 LP1, 特徴[大学院生])
//
// 公式テキスト:
//   (a1) 【相手ターン中】【現場リムーブ時】相手に証拠を1つ与えてもよい。そうした場合、
//        レベル5以下のキャラを1枚まで選び、リムーブする。
//   (a2) 【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// rules:
//   03-field-areas.md (状態 / 現場リムーブ / レベルに下限なし),
//   10-action-event.md (【ヒラメキ】= 証拠が action[事件] でリムーブされるとき発動 / 任意発動),
//   14-refresh.md (証拠を得る = デッキから / デッキ0は呼出元管理),
//   15-abilities-effects.md (「〜してもよい」=しない選択可 / 「〜まで」=0枚可 / 効果発動後に発動キャラが
//                            現場を離れても効果は無効化されない),
//   17-icons.md (【相手ターン中】/【現場リムーブ時】).
//
// 検証の核 (BUG-117/118 教訓: DSL に filter/condition を書いても engine が評価する保証はない — 実機で踏む):
//   a1 = optional{sequence[ evidenceGain{opp,n:1}, sceneRemove{self,max:1,side:either,filter:{levelMax:5}} ]}。
//   (1) optional ラッパ (「相手に証拠を1つ与えてもよい」) — AI は既定 skip / human が「する」を選ぶと
//       sequence が再 walk され evidenceGain (相手 +1 証拠) → sceneRemove pick が surface する。
//   (2) condition {kind:'turn', player:'opp'} = 【相手ターン中】を engine が **実際に評価** しているか。
//       自分ターン中の現場リムーブでは a1 は発火しない (optional すら surface しない)。
//   (3) a1 が leave:to-remove(selfOnly) で発火し、host(B01065自身) が現場を離れた後も効果が解決するか
//       (rules/15 効果発動後の現場離脱でも無効化しない / handleLeaveToRemoveSelf virtual location)。
//   (4) sceneRemove pick の filter:{levelMax:5} と side:'either' を engine が **実評価** しているか
//       (BUG-117/118 型バグ検出: filter 無視ならレベル6+ decoy / 自陣でない side が候補に混入する)。
//   a2 = 【ヒラメキ】sceneSetState{$pick, sleep, scene/either, 0..1} — B03079 a2 と byte-identical。
//   (5) a2 が evidence:remove-by-action(on-evidence) で **実発火** し pendingHirameki に surface するか
//       + shipped exemplar B03079 a2 と完全一致 (carrier RUNTIME は B03079/B02019 gate5 で実証済)。
//
// 「そうした場合」(chain dependency) について:
//   テキストは「相手に証拠を1つ与えてもよい。そうした場合、…リムーブする」。DSL は optional{sequence} で表現。
//   evidenceGain は非 pick の必須 atom (n:1 で常に成功) なので、optional opt-in 時に必ず証拠を与え、
//   その上で sceneRemove が走る。opt-out なら両方走らない。よって optional{sequence} は
//   optional{chain} と RUNTIME 等価 (BUG-111 trap 不在 — 両 clause が optional 内、trailing step 無し)。
//   本テストは「opt-in → 証拠+1 が実際に入り、かつ sceneRemove pick が surface」を実機で確認 (推測しない)。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetPendingHirameki, _drainPendingHirameki } from '@/engine/listeners/hirameki';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
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
import { B01065 } from '@/cards/ct-p01/B01065';
import { B03079 } from '@/cards/ct-p03/B03079';
import type { CardDef, GameState } from '@/engine/types';

type G = {
  __pendingEffectPickQueue?: PendingEffectPickSide[];
  __humanPlayerSide?: 'self' | 'opp' | null;
};
const g = globalThis as G;
const pickQueue = (): PendingEffectPickSide[] => g.__pendingEffectPickQueue ?? [];
const setHuman = (s: 'self' | 'opp' | null) => { g.__humanPlayerSide = s; };

// ---- synthetic decoy defs (prefix DEC_B01065_ で id 衝突回避、abilities:[] で再帰トリガー無し) ----
function ch(id: string, level: number): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}

// a1 sceneRemove(levelMax:5) 候補/decoy:
const C_LV5 = 'DEC_B01065_CLV5';       // level5 char (自陣) → filter 合致 (有効候補)
const C_LV3 = 'DEC_B01065_CLV3';       // level3 char (相手陣) → side:either + levelMax:5 合致 (有効候補)
const C_LV6 = 'DEC_B01065_CLV6';       // level6 char → DECOY (levelMax:5 違反 → 候補外)
const C_LV9 = 'DEC_B01065_CLV9';       // level9 char (相手陣) → DECOY (levelMax:5 違反 → 候補外)

function registerDecoys(): void {
  registerCardDef(ch(C_LV5, 5));
  registerCardDef(ch(C_LV3, 3));
  registerCardDef(ch(C_LV6, 6));
  registerCardDef(ch(C_LV9, 9));
}

const HOST = 'host';
const sceneOf = (s: GameState, side: 'self' | 'opp', uid: string) =>
  s.players[side].scene.find((c) => c.uid === uid);
const inScene = (s: GameState, side: 'self' | 'opp', uid: string) =>
  s.players[side].scene.some((c) => c.uid === uid);

// B01065 を自分の現場に置いた base (a1 = on-scene leave:to-remove 発火用)。
// opp.deck を仕込む (evidenceGain{opp} はデッキから 1 枚引く)。
function a1Base(turnPlayer: 'self' | 'opp'): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 6, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.scene = [sceneChar('B01065', HOST, { state: 'active' })];
  s.players.opp.deck = ['oppD1', 'oppD2', 'oppD3'];
  s.players.self.deck = ['selfD1', 'selfD2'];
  return s;
}

describe('B01065 沖矢昴 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    _resetPendingHirameki();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    _clearPendingEffectPickQueue();
    _clearPendingEffectOptionalSide();
    g.__pendingEffectPickQueue = [];
    setHuman(null);
  });

  // ===== a1 POSITIVE + DECOY: 相手ターン中の現場リムーブ「する」→ 相手 +1 証拠 + levelMax:5/side:either 実評価 =====
  it('a1 する + DECOY: 相手ターン中の現場リムーブで「する」→ 相手に証拠+1、sceneRemove 候補は レベル5以下のみ (level6/level9 decoy は候補外、side:either で両陣)', () => {
    setHuman('self'); // optional をプレイヤーに surface させ、pick 候補集合を decoy 検証
    let s = a1Base('opp');
    // 自陣: host(B01065) + level5(有効) + level6(decoy)。相手陣: level3(有効/side:either) + level9(decoy)。
    s.players.self.scene.push(
      sceneChar(C_LV5, 'cLv5', { state: 'active' }),
      sceneChar(C_LV6, 'cLv6', { state: 'active' }),
    );
    s.players.opp.scene = [
      sceneChar(C_LV3, 'cLv3', { state: 'active' }),
      sceneChar(C_LV9, 'cLv9', { state: 'active' }),
    ];
    const oppEvBefore = s.players.opp.evidence.length;
    const oppDeckBefore = s.players.opp.deck.length;

    // 現場リムーブ (host 自身が leave:to-remove) → a1 (相手ターン中) → optional surface
    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, HOST, 'effect');
      runAllUntilEmpty(d);
    });
    const opt = _peekPendingEffectOptionalSide();
    expect(opt, '相手ターン中の現場リムーブで optional surface (してもよい)').not.toBeNull();
    expect(opt!.player, 'optional の所有者は self (host の owner)').toBe('self');

    // 「する」(opt-in) → sequence 再 walk: evidenceGain{opp,n:1} 実行 + sceneRemove pick surface
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt!, true);
    });

    // (1) evidenceGain: 相手 (opp) に証拠が 1 枚増え、opp デッキが 1 枚減る (rules/14 デッキから)
    expect(s.players.opp.evidence.length, 'opt-in: 相手 (opp) に証拠 +1').toBe(oppEvBefore + 1);
    expect(s.players.opp.deck.length, 'opt-in: 相手証拠は opp デッキから (デッキ -1)').toBe(oppDeckBefore - 1);

    // (2) sceneRemove pick が surface。「1枚まで」= 0枚可。
    const pending = pickQueue().find((q) => q.atomVerb === 'sceneRemove');
    expect(pending, 'sceneRemove pick が surface (= a1 後段発火)').toBeTruthy();
    expect(pending!.nMin, '「1枚まで」= 0枚可 (decline channel)').toBe(0);
    expect(pending!.nMax, 'max:1').toBe(1);

    // (3) DECOY 主張: 候補は レベル5以下 (cLv5 自陣 + cLv3 相手陣) のみ。level6/level9 は候補外。
    const candUids = pending!.candidates.map((c) => c.uid).sort();
    expect(candUids, '候補は level5(cLv5) + level3(cLv3, side:either) のみ').toEqual(['cLv3', 'cLv5']);
    expect(pending!.candidates.some((c) => c.uid === 'cLv6'), 'DECOY level6 は候補外 (levelMax:5 違反)').toBe(false);
    expect(pending!.candidates.some((c) => c.uid === 'cLv9'), 'DECOY level9 は候補外 (levelMax:5 違反)').toBe(false);
    // side:either 実評価: 自陣 (cLv5) と相手陣 (cLv3) の両方が候補に含まれる
    expect(pending!.candidates.find((c) => c.uid === 'cLv5')?.player, 'cLv5 は self 陣 (side:either)').toBe('self');
    expect(pending!.candidates.find((c) => c.uid === 'cLv3')?.player, 'cLv3 は opp 陣 (side:either)').toBe('opp');

    // 相手陣の level3 (cLv3) を選んでリムーブ
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending!, 'cLv3');
    });
    expect(inScene(s, 'opp', 'cLv3'), '選択した相手 level3 は現場からリムーブされる').toBe(false);
    expect(s.players.opp.remove.includes(C_LV3), 'cLv3 は (所有者=opp の) リムーブエリアへ').toBe(true);
    // DECOY/未選択は現場に残る
    expect(inScene(s, 'self', 'cLv5'), '未選択 level5 (自陣) は現場に残る (1枚まで)').toBe(true);
    expect(inScene(s, 'self', 'cLv6'), 'DECOY level6 は候補外 → 現場に残る').toBe(true);
    expect(inScene(s, 'opp', 'cLv9'), 'DECOY level9 は候補外 → 現場に残る').toBe(true);
  });

  // ===== a1 自陣候補選択: levelMax:5 合致の自陣 level5 を選んでリムーブできる =====
  it('a1: 自陣 level5 (cLv5) を pick → 現場からリムーブされ、自分のリムーブエリアへ', () => {
    setHuman('self');
    let s = a1Base('opp');
    s.players.self.scene.push(sceneChar(C_LV5, 'cLv5', { state: 'active' }));

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, HOST, 'effect');
      runAllUntilEmpty(d);
    });
    const opt = _peekPendingEffectOptionalSide();
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt!, true);
    });
    const pending = pickQueue().find((q) => q.atomVerb === 'sceneRemove')!;
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickAndContinuation(d, pending, 'cLv5');
    });
    expect(inScene(s, 'self', 'cLv5'), '自陣 level5 はリムーブされる').toBe(false);
    expect(s.players.self.remove.includes(C_LV5), 'cLv5 は自分のリムーブエリアへ').toBe(true);
  });

  // ===== a1 NEGATIVE (turn:self): 自分ターン中の現場リムーブでは a1 非発火 (condition turn:opp gate) =====
  it('a1 condition NEGATIVE: 自分ターン中の現場リムーブでは a1 不発 → optional surface せず・相手証拠も増えない', () => {
    setHuman('self');
    let s = a1Base('self'); // 自分ターン → 【相手ターン中】不成立
    s.players.self.scene.push(sceneChar(C_LV5, 'cLv5', { state: 'active' }));
    const oppEvBefore = s.players.opp.evidence.length;
    const oppDeckBefore = s.players.opp.deck.length;

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, HOST, 'effect'); // 自分ターン中 → condition turn:opp 不成立
      runAllUntilEmpty(d);
    });
    expect(_peekPendingEffectOptionalSide(), '自分ターン → a1 不発 → optional surface しない').toBeNull();
    expect(pickQueue().some((q) => q.atomVerb === 'sceneRemove'), '自分ターン → sceneRemove pick も surface しない').toBe(false);
    // host 自身は現場リムーブで remove へ移るが、a1 非発火なので相手証拠は増えず、他キャラも残る
    expect(s.players.opp.evidence.length, '自分ターン: 相手証拠 増えない (evidenceGain 不発)').toBe(oppEvBefore);
    expect(s.players.opp.deck.length, '自分ターン: 相手デッキ 不変').toBe(oppDeckBefore);
    expect(inScene(s, 'self', 'cLv5'), '自分ターン: level5 は現場に残る').toBe(true);
  });

  // ===== a1 NEGATIVE (しない / opt-out): 「与えない」を選ぶと両 clause とも走らない (してもよい) =====
  it('a1 NEGATIVE しない: optional opt-out で 相手証拠 +0・sceneRemove pick も surface しない (「相手に証拠を与えてもよい」)', () => {
    setHuman('self');
    let s = a1Base('opp');
    s.players.self.scene.push(sceneChar(C_LV5, 'cLv5', { state: 'active' }));
    const oppEvBefore = s.players.opp.evidence.length;
    const oppDeckBefore = s.players.opp.deck.length;

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, HOST, 'effect');
      runAllUntilEmpty(d);
    });
    const opt = _peekPendingEffectOptionalSide();
    expect(opt, 'optional surface').not.toBeNull();
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt!, false); // 「与えない」
    });
    // opt-out → evidenceGain も sceneRemove も走らない (両 clause が optional 内)
    expect(s.players.opp.evidence.length, 'opt-out: 相手証拠 増えない').toBe(oppEvBefore);
    expect(s.players.opp.deck.length, 'opt-out: 相手デッキ 不変').toBe(oppDeckBefore);
    expect(pickQueue().some((q) => q.atomVerb === 'sceneRemove'), 'opt-out: sceneRemove pick surface しない').toBe(false);
    expect(inScene(s, 'self', 'cLv5'), 'opt-out: level5 は現場に残る').toBe(true);
  });

  // ===== a1 NEGATIVE (AI skip): AI 経路 (human=null) → optional 既定 skip → 何も起きない =====
  it('a1 NEGATIVE AI skip: AI 経路では optional 既定 skip → 相手証拠 +0・誰もリムーブされない', () => {
    setHuman(null); // AI 経路
    let s = a1Base('opp');
    s.players.self.scene.push(sceneChar(C_LV5, 'cLv5', { state: 'active' }));
    const oppEvBefore = s.players.opp.evidence.length;

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, HOST, 'effect');
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
    });
    expect(_peekPendingEffectOptionalSide(), 'AI: optional surface しない').toBeNull();
    expect(s.players.opp.evidence.length, 'AI skip: 相手証拠 増えない').toBe(oppEvBefore);
    expect(inScene(s, 'self', 'cLv5'), 'AI skip: level5 は現場に残る').toBe(true);
  });

  // ===== a1 0-pick: 「する」(証拠は与える) だが sceneRemove を 0枚 decline → 証拠 +1 は確定、誰もリムーブされない =====
  it('a1 0-pick: 「する」で相手に証拠+1 した後、sceneRemove を 0枚 decline すると 証拠+1 は残り 誰もリムーブされない (「1枚まで」=0枚可)', () => {
    setHuman('self');
    let s = a1Base('opp');
    s.players.self.scene.push(sceneChar(C_LV5, 'cLv5', { state: 'active' }));
    const oppEvBefore = s.players.opp.evidence.length;

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, HOST, 'effect');
      runAllUntilEmpty(d);
    });
    const opt = _peekPendingEffectOptionalSide();
    s = produce(s, (d) => {
      applyOptionalAndContinuation(d, opt!, true);
    });
    // 証拠は opt-in で必須付与済み (evidenceGain は「そうした場合」の前提を作る必須 atom)
    expect(s.players.opp.evidence.length, 'opt-in: 相手証拠 +1 (sceneRemove decline 前に確定)').toBe(oppEvBefore + 1);
    const pending = pickQueue().find((q) => q.atomVerb === 'sceneRemove')!;
    expect(pending.nMin, '0枚可 (decline channel)').toBe(0);

    // 0枚 decline (「レベル5以下のキャラを1枚まで選び」= 0枚選べる)
    g.__pendingEffectPickQueue = [];
    s = produce(s, (d) => {
      applyPickSkipAndContinuation(d, pending);
    });
    // 証拠 +1 は decline 後も残る / 誰もリムーブされない
    expect(s.players.opp.evidence.length, '0-pick: 相手証拠 +1 は残る').toBe(oppEvBefore + 1);
    expect(inScene(s, 'self', 'cLv5'), '0-pick: level5 は現場に残る (リムーブされない)').toBe(true);
    expect(s.players.self.remove.includes(C_LV5), '0-pick: level5 はリムーブエリアに無い').toBe(false);
  });

  // ===== a1 host 自己離脱後も解決: host は leave:to-remove 自身、効果は host 不在でも解決 (rules/15) =====
  it('a1: host(B01065自身) は現場リムーブされて不在だが、a1 効果 (証拠付与+リムーブ) は解決される (rules/15 発動後の現場離脱で無効化しない)', () => {
    setHuman('self');
    let s = a1Base('opp');
    s.players.self.scene.push(sceneChar(C_LV5, 'cLv5', { state: 'active' }));

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, HOST, 'effect');
      runAllUntilEmpty(d);
    });
    // host は既に現場から消えている (leave:to-remove のトリガー本体)
    expect(inScene(s, 'self', HOST), 'host (B01065) は現場リムーブ済 (不在)').toBe(false);
    expect(s.players.self.remove.includes('B01065'), 'B01065 はリムーブエリアへ').toBe(true);
    // それでも optional は surface する (発動後の host 離脱で効果は無効化されない)
    expect(_peekPendingEffectOptionalSide(), 'host 不在でも a1 optional は surface する').not.toBeNull();
  });

  // ===== a2 trigger: 【ヒラメキ】が evidence:remove-by-action で実発火し pending に surface =====
  it('a2 trigger: B01065 が証拠から action[事件] でリムーブされると ヒラメキ pending が {cardId:B01065, abilityId:a2} で立つ', () => {
    const s0 = createEmptyGameState();
    s0.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };

    produce(s0, (d) => {
      // 相手(opp=atk)が self の証拠 B01065 を action[事件] でリムーブ → self の【ヒラメキ】発火源
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B01065' } }, { player: 'opp', uid: 'atk' });
    });

    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ pending が立つ (on-evidence trigger 実発火)').not.toBeNull();
    expect(pending?.cardId, 'pending.cardId = B01065').toBe('B01065');
    expect(pending?.abilityId, 'pending.abilityId = a2').toBe('a2');
    expect(pending?.player, 'pending.player = self (証拠を失った側)').toBe('self');
  });

  it('a2 trigger NEGATIVE: ヒラメキを持たない別カードの action リムーブでは B01065 のヒラメキは立たない', () => {
    const s0 = createEmptyGameState();
    s0.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };

    produce(s0, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: C_LV5 } }, { player: 'opp', uid: 'atk' });
    });

    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ無しカードのリムーブでは pending 立たない').toBeNull();
  });

  // ===== a2 shape: shipped byte-identical exemplar B03079 a2 と完全一致 =====
  // (carrier RUNTIME = sceneSetState $pick sleep の human/AI/decline は B03079/B02019 gate5 で実証済。
  //  ヒラメキの実効果適用は UI hiramekiResolve→resolveEffectPicks 経由のため、純 engine テストでは
  //  「実発火 (pending)」+「shipped exemplar との構造完全一致」で挙動同値を担保する。)
  it('a2 shape: effect が B03079 a2 (byte-identical exemplar) と完全一致 — sceneSetState $pick (sleep, scene/either, 0..1, chooser:self)', () => {
    const a2 = B01065.abilities[1];
    const b03079a2 = B03079.abilities[1];
    expect(a2.scope, 'scope = on-evidence').toBe('on-evidence');
    expect(a2.trigger, 'trigger が B03079 a2 と完全一致 (evidence:remove-by-action optional)').toEqual(b03079a2.trigger);
    expect(a2.effect, 'effect が B03079 a2 と完全一致 (sceneSetState $pick sleep / scene,either / n{0,1} / chooser:self)').toEqual(b03079a2.effect);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=leave:to-remove(selfOnly)+turn:opp optional{sequence[evidenceGain opp n:1, sceneRemove self max:1 side:either levelMax:5]}, a2=ヒラメキ sleep', () => {
    const [a1, a2] = B01065.abilities;
    // a1
    expect(a1.type, 'a1 triggered').toBe('triggered');
    expect(a1.scope, 'a1 scope on-scene').toBe('on-scene');
    expect(a1.trigger, 'a1 leave:to-remove selfOnly').toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    expect(a1.condition, 'a1 condition turn:opp (【相手ターン中】)').toMatchObject({ kind: 'turn', player: 'opp' });
    expect((a1.effect as { kind: string }).kind, 'a1 optional ラッパ (相手に証拠を与えてもよい)').toBe('optional');
    const seq = (a1.effect as { effect: { kind: string; steps: Array<{ verb?: string; args?: Record<string, unknown> }> } }).effect;
    expect(seq.kind, '内部 sequence').toBe('sequence');
    expect(seq.steps[0], 'step0 = evidenceGain opp n:1').toMatchObject({ verb: 'evidenceGain', args: { player: 'opp', n: 1 } });
    expect(seq.steps[1], 'step1 = sceneRemove self max:1 side:either levelMax:5').toMatchObject({
      verb: 'sceneRemove',
      args: { player: 'self', max: 1, side: 'either', cause: 'effect', filter: { levelMax: 5 } },
    });
    // evidenceGain は max ではなく n:1 (max だと pick 不在で 0 証拠になる — certify CRITICAL note)
    expect((seq.steps[0].args as Record<string, unknown>).n, 'evidenceGain は n:1 (max ではない)').toBe(1);
    expect((seq.steps[0].args as Record<string, unknown>).max, 'evidenceGain に max は無い').toBeUndefined();
    // a2
    expect(a2.type, 'a2 triggered').toBe('triggered');
    expect(a2.trigger, 'a2 hirameki hook (任意発動)').toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect((a2.effect as { verb?: string }).verb, 'a2 sceneSetState').toBe('sceneSetState');
    expect((a2.effect as { args?: { state?: string } }).args?.state, 'a2 state=sleep').toBe('sleep');
  });
});
