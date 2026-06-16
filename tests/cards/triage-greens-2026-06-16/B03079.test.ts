// gate5 RUNTIME behavior — B03079 レイチェル・浅香 (character, 赤, Lv5 AP5000 LP1, 特徴[ボディガード])
//
// 公式テキスト:
//   【相手ターン中】【現場リムーブ時】自分のデッキのカードを上から3枚見る。その中から【赤】のカードを
//     1枚まで公開して手札に加え、残りを好きな順番でデッキの下に移す。
//   【ヒラメキ】（証拠からリムーブされるときに発動する）キャラを1枚まで選び、スリープさせる。
//
// rules:
//   03-field-areas.md (状態 / 現場リムーブ),
//   10-action-event.md (【ヒラメキ】= 証拠が action[事件] でリムーブされるとき発動),
//   14-refresh.md / 26-qa-deck-refresh.md (reveal 中はデッキ扱い / 「1枚まで」=0枚可),
//   15-abilities-effects.md (効果発動後に発動キャラが現場を離れても効果は無効化されない / 「〜まで」=0枚可),
//   17-icons.md (【相手ターン中】/【現場リムーブ時】).
//
// 検証の核 (BUG-117/118 教訓: DSL に filter/condition を書いても engine が評価する保証はない — 実機で踏む):
//   a1 deckRevealUntil の filter:{color:'赤'} を engine が **実際に評価** しているか
//     (targetFilterToPredicate が color を honor、非赤は skip しデッキ下へ)。
//   a1 condition {kind:'turn', player:'opp'} を engine が **実際に評価** しているか
//     (自分ターン中の現場リムーブでは a1 は発火しない)。
//   a1 が leave:to-remove (selfOnly) で発火し、host が現場を離れた後も効果が解決するか (rules/15)。
//   a2 が evidence:remove-by-action (on-evidence) で **実発火** し pendingHirameki に surface するか。
//
// decoy / negative:
//   a1-D (color): 上3枚先頭に 青イベント・青キャラ decoy を置く。filter が無視されれば「最初のカード」=
//     青 decoy が拾われる (BUG-117/118 型バグ)。honor されれば skip し、奥の【赤】カードを拾う。
//   a1-N (0-match): 上3枚に【赤】不在 → 手札に何も加えない (conditional 不成立 / 「1枚まで」=0枚)。
//   a1-cond (turn:opp): 自分ターン中の現場リムーブでは a1 発火せず、手札に何も加えない。
//   a2-trigger: B03079 が証拠から action リムーブ → ヒラメキ pending が {cardId:'B03079', abilityId:'a2'} で立つ。
//   a2-shape: a2.effect は shipped byte-identical exemplar D05007 a2 と完全一致 (sceneSetState $pick carrier)。
//     carrier の RUNTIME (human/AI/decline/stun の sceneSetState uid:'$pick'+target 解決と状態適用) は
//     同一形を駆動する B02019 gate5 (triage-greens-2026-06-15/B02019.test.ts) で human+AI 両経路実証済。
//     ヒラメキの実効果適用は UI hiramekiResolve→resolveEffectPicks 経由のため (akamajutsu/D11009 と同様)、
//     純 engine テストでは「実発火 (pending)」+「shipped exemplar との構造完全一致」で挙動同値を担保する。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetPendingHirameki, _drainPendingHirameki } from '@/engine/listeners/hirameki';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../../helpers/fixtures';
import { B03079 } from '@/cards/ct-p03/B03079';
import { D05007 } from '@/cards/ct-d05/D05007';
import type { CardDef, GameState } from '@/engine/types';

// ---- synthetic decoy defs (prefix DEC_B03079_ で id 衝突回避) ----
function ev(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'event', names: [id], colors,
    level: 1, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}
function ch(id: string, colors: string[]): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors,
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [],
  };
}

const RED_EVENT = 'DEC_B03079_RED_EVENT';   // 赤イベント = a1 の唯一の有効候補 (色一致 / kind 不問)
const BLUE_EVENT = 'DEC_B03079_BLUE_EVENT'; // 青イベント = color decoy (赤でない)
const BLUE_CHAR = 'DEC_B03079_BLUE_CHAR';   // 青キャラ = color decoy (赤でない)
const FILLER = 'DEC_B03079_FILLER';         // top3 外 filler (refresh 回避)

function registerDecoys(): void {
  registerCardDef(ev(RED_EVENT, ['赤']));
  registerCardDef(ev(BLUE_EVENT, ['青']));
  registerCardDef(ch(BLUE_CHAR, ['青']));
  registerCardDef(ch(FILLER, ['緑']));
}

const inHand = (s: GameState, id: string) => s.players.self.hand.includes(id);
const inDeck = (s: GameState, id: string) => s.players.self.deck.includes(id);

// B03079 を自分の現場に置いた base (a1 = on-scene leave:to-remove 発火用)
function sceneBase(turnPlayer: 'self' | 'opp', deck: string[]): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 6, player: turnPlayer, phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.scene = [sceneChar('B03079', 'rachel#1', { state: 'active' })];
  s.players.self.deck = deck;
  return s;
}

describe('B03079 レイチェル・浅香 — gate5 runtime behavior', () => {
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
    (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue = [];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ===== a1 + DECOY: 【相手ターン中】【現場リムーブ時】 deck-look3 — filter:{color:'赤'} 実評価 =====
  it('a1 + DECOY: 相手ターン中の現場リムーブで 上3枚中【赤】カード(RED_EVENT)を手札へ、青イベント・青キャラ decoy は skip しデッキ下 (color filter 実評価)', () => {
    // 上3枚: [青event(先頭), 青char, 赤event(=該当)]。filter 無視なら先頭の 青 decoy が拾われる。
    // color honor なら 青2枚を skip し 赤 を拾う。
    let s = sceneBase('opp', [BLUE_EVENT, BLUE_CHAR, RED_EVENT, FILLER, FILLER, FILLER]);

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'rachel#1', 'effect'); // 現場リムーブ → leave:to-remove (相手ターン中)
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy()); // AI: 唯一の赤候補 RED_EVENT を pick
    });

    expect(inHand(s, RED_EVENT), '【赤】カード RED_EVENT を手札へ').toBe(true);
    expect(inDeck(s, RED_EVENT), 'RED_EVENT はデッキから抜けた').toBe(false);
    // DECOY: 青イベント (色違い) は手札に入らず残り (デッキ下) へ
    expect(inHand(s, BLUE_EVENT), 'decoy(青イベント, 色違い)は手札に入らない').toBe(false);
    expect(inDeck(s, BLUE_EVENT), 'decoy(青イベント)はデッキに残る (下へ)').toBe(true);
    // DECOY: 青キャラ (色違い) も手札に入らない
    expect(inHand(s, BLUE_CHAR), 'decoy(青キャラ, 色違い)は手札に入らない').toBe(false);
    expect(inDeck(s, BLUE_CHAR), 'decoy(青キャラ)はデッキに残る (下へ)').toBe(true);
    // 手札に1枚 (赤) のみ移動 → デッキ枚数 6-1=5
    expect(s.players.self.deck.length, 'デッキ枚数 = 6 - 1(赤のみ手札へ)').toBe(5);
  });

  // ===== a1-N: 上3枚に【赤】不在 → 手札に何も加えず全reveal デッキ下 (conditional 不成立 / 0枚可) =====
  it('a1 NEGATIVE: 上3枚に【赤】不在 (青event + 青char + 青event) → 手札に何も加えない (filter unmet)', () => {
    let s = sceneBase('opp', [BLUE_EVENT, BLUE_CHAR, BLUE_EVENT, FILLER, FILLER]);

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'rachel#1', 'effect');
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(
      s.players.self.hand.filter((c) => c === BLUE_EVENT || c === BLUE_CHAR).length,
      '【赤】が無いので何も手札に加えない',
    ).toBe(0);
    expect(inDeck(s, BLUE_EVENT), 'decoy(青イベント)はデッキに残る').toBe(true);
    expect(inDeck(s, BLUE_CHAR), 'decoy(青キャラ)はデッキに残る').toBe(true);
    expect(s.players.self.deck.length, 'デッキ枚数不変 (手札に1枚も入らない)').toBe(5);
  });

  // ===== a1-cond: 自分ターン中の現場リムーブでは a1 発火しない (condition turn:opp) =====
  it('a1 condition NEGATIVE: 自分ターン中の現場リムーブでは a1 不発 → 上3枚に【赤】が居ても手札に加えない', () => {
    let s = sceneBase('self', [BLUE_EVENT, BLUE_CHAR, RED_EVENT, FILLER, FILLER, FILLER]);

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'rachel#1', 'effect'); // 自分ターン中 → condition turn:opp 不成立
      runAllUntilEmpty(d);
      drainAiEffectPicks(d, new HeuristicPolicy());
    });

    expect(inHand(s, RED_EVENT), '自分ターンでは a1 不発 → 赤カードも手札に入らない').toBe(false);
    expect(inDeck(s, RED_EVENT), '赤カードはデッキに残る').toBe(true);
    expect(s.players.self.deck.length, 'デッキ枚数不変 (a1 不発)').toBe(6);
  });

  // ===== a2 trigger: 【ヒラメキ】が evidence:remove-by-action で実発火し pending に surface =====
  it('a2 trigger: B03079 が証拠から action[事件] でリムーブされると ヒラメキ pending が {cardId:B03079, abilityId:a2} で立つ', () => {
    const s0 = createEmptyGameState();
    s0.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };

    produce(s0, (d) => {
      // 相手(opp=atk)が self の証拠 B03079 を action[事件] でリムーブ → self の【ヒラメキ】発火源
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'B03079' } }, { player: 'opp', uid: 'atk' });
    });

    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ pending が立つ (on-evidence trigger 実発火)').not.toBeNull();
    expect(pending?.cardId, 'pending.cardId = B03079').toBe('B03079');
    expect(pending?.abilityId, 'pending.abilityId = a2').toBe('a2');
    expect(pending?.player, 'pending.player = self (証拠を失った側)').toBe('self');
  });

  it('a2 trigger NEGATIVE: 証拠でない別カードの action リムーブでは B03079 のヒラメキは立たない', () => {
    const s0 = createEmptyGameState();
    s0.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };

    produce(s0, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: FILLER } }, { player: 'opp', uid: 'atk' });
    });

    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ無しカードのリムーブでは pending 立たない').toBeNull();
  });

  // ===== a2 shape: shipped byte-identical exemplar D05007 a2 と完全一致 (carrier runtime は B02019 で実証) =====
  it('a2 shape: effect が D05007 a2 (byte-identical exemplar) と完全一致 — sceneSetState $pick carrier (sleep, scene/either, 0..1)', () => {
    const a2 = B03079.abilities[1];
    const d05007a2 = D05007.abilities[1];
    expect(a2.trigger, 'trigger = evidence:remove-by-action optional').toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.scope, 'scope = on-evidence').toBe('on-evidence');
    // shipped exemplar との byte 一致 (trigger + effect)
    expect(a2.trigger, 'trigger が D05007 a2 と完全一致').toEqual(d05007a2.trigger);
    expect(a2.effect, 'effect が D05007 a2 と完全一致 (sceneSetState $pick sleep / scene,either / n{0,1})').toEqual(d05007a2.effect);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=leave:to-remove(selfOnly)+turn:opp+deckRevealUntil{maxN:3,color:赤,upTo}, a2=evidence:remove-by-action hirameki sleep', () => {
    const [a1, a2] = B03079.abilities;
    expect(a1.trigger, 'a1 leave:to-remove selfOnly').toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    expect(a1.condition, 'a1 condition turn:opp').toMatchObject({ kind: 'turn', player: 'opp' });
    const a1reveal = ((a1.effect as { steps: Array<{ args?: Record<string, unknown> }> }).steps[0].args) as Record<string, unknown>;
    expect(a1reveal, 'a1 deckRevealUntil maxN:3 chooseMatch:upTo filter{color:赤}').toMatchObject({
      maxN: 3, chooseMatch: 'upTo', filter: { color: '赤' },
    });
    expect(a2.trigger, 'a2 hirameki hook').toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect((a2.effect as { verb?: string }).verb, 'a2 sceneSetState').toBe('sceneSetState');
    expect((a2.effect as { args?: { state?: string } }).args?.state, 'a2 state=sleep').toBe('sleep');
  });
});
