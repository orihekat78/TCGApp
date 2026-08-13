// continuation-nest cluster — B06033/B06033P「わが味方となるべし!!」(緑 L6 event) の挙動テスト。
//
// a1 = sequence[ chain[evidenceToHand max:1, handToEvidence n:1], sceneEnter{緑 YAIBA lv≤6 from hand} ]。
// この構造は chain 内 pick (evidenceToHand) が pause したとき、従来 1:1 continuation を親 sequence が
// 上書きし handToEvidence を脱落させていた (BUG-111 family continuation-nest)。2026-06-22 の continuation
// nest 修正 (outer 連結) で解禁。本テストは B06033 固有 composition を実 engine 経路で 1対1 検証する
// (非MVP のため smoke では踏めない = 専用 decoy 必須、card-addition-checklist §7)。
//
// 検証:
//   §1 swap+enter (nest 非decline) — 証拠在: evidenceToHand→handToEvidence(chain step2 不脱落) + sceneEnter
//      (sequence remainder 不脱落) が **すべて** 実行される。
//   §2 公式Q&A — 証拠から手札に加えたカードが緑 YAIBA lv≤6 なら登場候補になる (swap を先に解決→post-swap
//      手札から sceneEnter 候補)。証拠に居た GY が登場する = swap→enter 順 + nest 正しさ。
//   §3/§4 sceneEnter filter 1対1 + nest-decline — 証拠0 で swap が no-op (chain break) でも sceneEnter
//      (outer) は実行される。filter: §4a 緑YAIBA lv6 境界=登場 / §4b lv7 不登場 / §4c 赤 不登場(色) /
//      §4d 緑非YAIBA 不登場(特徴) / §4e 緑YAIBA event 不登場(種別)。
//   §5 【ヒラメキ】self→hand — remove=[OTHER, B06033], source=B06033 → B06033 のみ手札 (B05102/PR085 a2 同型)。
//   §6 構造 — B06033 + B06033P(P変種) / a1 (event-use + sequence[chain, sceneEnter]) / a2 hirameki fromSelf。
// rules: 01-victory-conditions.md, 06-card-types.md, 10-action-event.md, 14-refresh.md,
//        15-abilities-effects.md (§「そうした場合」/ §各 step 独立), 17-icons.md, 20-color-and-switch.md
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry, def } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { cardOccurrenceUid, cardOccurrenceWitness } from '@/engine/target/card-occurrence';
import { B06033 } from '@/cards/ct-p06/B06033';
import { B06033P } from '@/cards/ct-p06/B06033P';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'], level: 1, ap: 1000, lp: 1, traits: ['YAIBA'], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

// synthetic cards
const GY3 = 'GY3';   // 緑 YAIBA Lv3 char (登場可)
const GY6 = 'GY6';   // 緑 YAIBA Lv6 char (境界=登場可)
const GY7 = 'GY7';   // 緑 YAIBA Lv7 char (level cap で不登場)
const RY3 = 'RY3';   // 赤 YAIBA Lv3 char (色不一致 不登場)
const GN3 = 'GN3';   // 緑 非YAIBA Lv3 char (特徴不一致 不登場)
const GYEV = 'GYEV'; // 緑 YAIBA Lv3 event (種別不一致 不登場)
const JUNK = 'JUNK'; // 黒 Lv9 char (filter 全部外れ、handToEvidence 退避先)
const EVX = 'EVX';   // 黒 Lv9 char (証拠の swap 元、登場不可)

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerAll(); // B06033/B06033P 込み
  registerCardDef(ch(GY3, { colors: ['緑'], level: 3, traits: ['YAIBA'] }));
  registerCardDef(ch(GY6, { colors: ['緑'], level: 6, traits: ['YAIBA'] }));
  registerCardDef(ch(GY7, { colors: ['緑'], level: 7, traits: ['YAIBA'] }));
  registerCardDef(ch(RY3, { colors: ['赤'], level: 3, traits: ['YAIBA'] }));
  registerCardDef(ch(GN3, { colors: ['緑'], level: 3, traits: [] }));
  registerCardDef(ch(GYEV, { colors: ['緑'], level: 3, traits: ['YAIBA'], kind: 'event' }));
  registerCardDef(ch(JUNK, { colors: ['黒'], level: 9, traits: [] }));
  registerCardDef(ch(EVX, { colors: ['黒'], level: 9, traits: [] }));
  registerTriggeredListener();
});

const ev = (cardId: string) => ({ cardId, faceUp: false, origin: { turn: 0, via: 'init' as const } });

/** B06033 a1 効果を実 engine 経路で駆動し pick を AI 解決して drain しきる (ctx.source.area='hand')。 */
function runA1(mutateBoard: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  s = produce(s, (d) => {
    d.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    mutateBoard(d);
  });
  const a1 = def.card('B06033')!.abilities.find((a) => a.id === 'a1')!;
  s = produce(s, (d) => {
    const ctx = { source: { player: 'self', cardId: 'B06033', uid: 'ev#1', abilityId: 'a1', area: 'hand' }, bindings: {} } as unknown as EffectCtx;
    runEffect(d, a1.effect as never, ctx);
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    }
  });
  return s;
}

const inScene = (s: GameState, cardId: string) => s.players.self.scene.some((c) => c.cardId === cardId);
const inHand = (s: GameState, cardId: string) => s.players.self.hand.includes(cardId);
const inEvidence = (s: GameState, cardId: string) => s.players.self.evidence.some((e) => e.cardId === cardId);

describe('B06033 §1 — swap+enter (nest 非decline): chain step2 + sequence remainder が両方発火', () => {
  it('証拠在 → evidenceToHand→handToEvidence(裏向き証拠) + sceneEnter(緑YAIBA) すべて実行', () => {
    const s = runA1((d) => {
      d.players.self.evidence = [ev(EVX)];      // swap 元 (登場不可 junk)
      d.players.self.hand = [JUNK, GY3];        // hand[0]=JUNK→証拠退避 / GY3=登場対象
      d.players.self.deck = [];
    });
    // chain step2 (handToEvidence) が脱落していない: hand[0]=JUNK が裏向きで証拠化
    expect(inEvidence(s, JUNK), 'handToEvidence: JUNK が証拠へ (chain step2 不脱落)').toBe(true);
    const j = s.players.self.evidence.find((e) => e.cardId === JUNK);
    expect(j?.faceUp, '裏向きで証拠として得る').toBe(false);
    expect(inEvidence(s, EVX), 'evidenceToHand: EVX は証拠から抜けた').toBe(false);
    // sequence remainder (sceneEnter) が脱落していない: GY3 登場
    expect(inScene(s, GY3), 'sceneEnter: GY3 登場 (sequence remainder 不脱落)').toBe(true);
    expect(inHand(s, GY3), '登場した GY3 は手札に無い').toBe(false);
  });
});

describe('B06033 §2 — 公式Q&A: 証拠から手札に加えたカードを登場できる (swap→enter 順)', () => {
  it('証拠の GY3 が swap で手札へ→sceneEnter 候補になり登場する', () => {
    const s = runA1((d) => {
      d.players.self.evidence = [ev(GY3)];  // 証拠に緑YAIBA lv3 (swap で手札へ→登場候補)
      d.players.self.hand = [JUNK];         // handToEvidence 退避先 (登場不可)
      d.players.self.deck = [];
    });
    // swap: GY3 証拠→手札、JUNK 手札→証拠。その後 sceneEnter は post-swap 手札 [GY3] から登場。
    expect(inScene(s, GY3), '証拠から来た GY3 が登場 (swap を先に解決した証跡)').toBe(true);
    expect(inEvidence(s, JUNK), 'JUNK が裏向き証拠へ').toBe(true);
  });
});

describe('B06033 §3/§4 — sceneEnter filter 1対1 + nest-decline (証拠0で swap no-op でも sceneEnter 実行)', () => {
  // 証拠0 → evidenceToHand 0候補 → chain break で handToEvidence skip。sceneEnter は outer remainder として
  //   実行されるべき (nest-decline: chain head no-op でも外側 sequence step は走る)。
  const base = (handCard: string) => (d: GameState) => {
    d.players.self.evidence = [];     // swap no-op
    d.players.self.hand = [handCard];
    d.players.self.deck = [];
  };
  it('§4a 緑YAIBA Lv6 → 登場 (境界 lv6 OK) ＝ swap no-op でも sceneEnter 発火', () => {
    const s = runA1(base(GY6));
    expect(inScene(s, GY6), '緑YAIBA Lv6 登場 (nest-decline でも outer 実行)').toBe(true);
  });
  it('§4b 緑YAIBA Lv7 → 不登場 (level cap >6)', () => {
    const s = runA1(base(GY7));
    expect(inScene(s, GY7)).toBe(false);
    expect(inHand(s, GY7), '不登場で手札に残る').toBe(true);
  });
  it('§4c 赤YAIBA Lv3 → 不登場 (色不一致)', () => {
    const s = runA1(base(RY3));
    expect(inScene(s, RY3)).toBe(false);
    expect(inHand(s, RY3)).toBe(true);
  });
  it('§4d 緑非YAIBA Lv3 → 不登場 (特徴不一致)', () => {
    const s = runA1(base(GN3));
    expect(inScene(s, GN3)).toBe(false);
    expect(inHand(s, GN3)).toBe(true);
  });
  it('§4e 緑YAIBA event Lv3 → 不登場 (種別 character でない)', () => {
    const s = runA1(base(GYEV));
    expect(inScene(s, GYEV)).toBe(false);
    expect(inHand(s, GYEV)).toBe(true);
  });
});

describe('B06033 §5 — 【ヒラメキ】self→hand (B05102/PR085 a2 同型)', () => {
  it('証拠から action[事件] でリムーブされる B06033 自身のみ手札へ', () => {
    let s = createEmptyGameState();
    s = produce(s, (d) => {
      d.players.self.remove = ['OTHER', 'B06033']; // リムーブエリアに 2 枚 (うち source=B06033)
    });
    const a2 = def.card('B06033')!.abilities.find((a) => a.id === 'a2')!;
    s = produce(s, (d) => {
      const index = d.players.self.remove.lastIndexOf('B06033');
      const ctx = {
        source: { player: 'self', area: 'remove', cardId: 'B06033', abilityId: 'a2', uid: cardOccurrenceUid('self', 'remove', 'B06033', index) },
        bindings: {
          occurrence: [{
            kind: 'card', uid: cardOccurrenceUid('self', 'remove', 'B06033', index), cardId: 'B06033', player: 'self', area: 'remove', index,
            occurrenceWitness: cardOccurrenceWitness(d, 'self', 'remove'),
          }],
        },
      } as unknown as EffectCtx;
      runAtom(d, (a2.effect as { verb: string }).verb as never, (a2.effect as { args: unknown }).args, ctx);
      runAllUntilEmpty(d);
    });
    expect(inHand(s, 'B06033'), 'B06033 自身が手札へ (fromSelf)').toBe(true);
    expect(inHand(s, 'OTHER'), 'OTHER は手札へ移動しない (self のみ)').toBe(false);
  });
});

describe('B06033 §6 — 構造', () => {
  it('B06033/B06033P が登録され、a1=sequence[chain, sceneEnter] / a2=hirameki fromSelf', () => {
    expect(def.card('B06033')?.kind).toBe('event');
    expect(def.card('B06033P')?.kind).toBe('event');
    expect(B06033P.id).toBe('B06033P');
    expect(B06033P.rarity).toBe('CP');
    const a1 = B06033.abilities.find((a) => a.id === 'a1')!;
    expect(a1.effect.kind).toBe('sequence');
    const seq = a1.effect as { steps: { kind: string }[] };
    expect(seq.steps[0]!.kind, 'step0 = chain (swap)').toBe('chain');
    expect(seq.steps[1]!.kind, 'step1 = sceneEnter atom').toBe('atom');
    const a2 = B06033.abilities.find((a) => a.id === 'a2')!;
    expect((a2.effect as { verb: string }).verb).toBe('handAddFromRemove');
    expect((a2.effect as { args: { fromSelf?: boolean } }).args.fromSelf).toBe(true);
  });
});
