// hand-to-evidence — 新 verb handToEvidence (手札→裏向き証拠) と evidence-swap chain の挙動テスト。
// engine変更: AtomVerb に handToEvidence 追加 (純 additive)。atom-handlers / ATOM_PICK_SPEC / validate /
//   cjs whitelist の 4 点同期。evidenceToHand (既存・evidence→hand) と対で「証拠⇔手札」swap を構成。
//
// 検証 (非MVP = smoke では踏めない → 実 engine 駆動の専用テスト):
//   §1 handToEvidence: 手札の指定 1 枚を evidence へ移す。faceUp 既定 false (裏向き)、push=証拠1番上 (末尾)。
//   §2 faceUp:true override が効く。
//   §3 手札に無い cardId → no-op (証拠/手札 unchanged)。
//   §4 ★swap★ evidenceToHand(既存) → handToEvidence(新) で net 証拠数不変・手札数不変、
//      入替わった手札カードが evidence top に裏向きで載る (公式Q&A B06029「裏向きで得る証拠は1番上」)。
//   §5 ★chain break★ B06029 a1 を 0 証拠で実 engine 駆動 → step1(evidenceToHand max:1) が no-candidate で
//      chain break → step2(handToEvidence) skip。手札も証拠も unchanged = 「そうした場合」semantics の 1対1 証跡。
//   §6 出荷カード構造 — B06029/B06029P 登録 + a1 chain[evidenceToHand,handToEvidence] / a2 ヒラメキ sleep。
// rules: 01-victory-conditions.md (§証拠), 06-card-types.md (§証拠化), 15-abilities-effects.md (§そうした場合)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, def } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B06029 } from '@/cards/ct-p06/B06029';
import { B06029P } from '@/cards/ct-p06/B06029P';
import type { EffectCtx, EvidenceCard, GameState } from '@/engine/types';

const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'effect' } });
const ctx = (): EffectCtx => ({ source: { player: 'self', area: 'scene', cardId: 'B06029', abilityId: 'a1' }, bindings: {} } as unknown as EffectCtx);

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerAll();
  registerTriggeredListener();
});

describe('handToEvidence verb — runAtom 直接駆動 (§1-3)', () => {
  it('§1 手札1枚を裏向きで証拠へ (faceUp既定false, push=証拠top=末尾, 手札から除去)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = ['HX', 'HY'];
      d.players.self.evidence = [ev('E_OLD')]; // 既存証拠 (top 判定用)
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'handToEvidence', { player: 'self', target: ['HX'] }, ctx());
    });
    expect(after.players.self.hand).toEqual(['HY']);          // HX 除去
    expect(after.players.self.evidence).toHaveLength(2);
    const top = after.players.self.evidence[after.players.self.evidence.length - 1]!;
    expect(top.cardId).toBe('HX');                            // 1番上 (末尾)
    expect(top.faceUp).toBe(false);                           // 裏向き
  });

  it('§2 faceUp:true override', () => {
    const s0 = produce(createEmptyGameState(), (d) => { d.players.self.hand = ['HX']; });
    const after = produce(s0, (d) => {
      runAtom(d, 'handToEvidence', { player: 'self', target: ['HX'], faceUp: true }, ctx());
    });
    expect(after.players.self.evidence[after.players.self.evidence.length - 1]!.faceUp).toBe(true);
  });

  it('§3 手札に無い cardId → no-op (手札/証拠 unchanged)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = ['HX'];
      d.players.self.evidence = [ev('E_OLD')];
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'handToEvidence', { player: 'self', target: ['NOPE'] }, ctx());
    });
    expect(after.players.self.hand).toEqual(['HX']);
    expect(after.players.self.evidence).toHaveLength(1);
  });
});

describe('evidence⇔hand swap — evidenceToHand(既存)→handToEvidence(新) (§4)', () => {
  it('§4 net 証拠数不変・手札数不変、入替手札が証拠top裏向き', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = ['HX'];
      d.players.self.evidence = [ev('E_OLD', true)]; // 既存1枚 (表向き decoy)
    });
    const after = produce(s0, (d) => {
      // step1: 証拠 E_OLD を手札へ (evidenceToHand 既存 verb, 明示 target)
      runAtom(d, 'evidenceToHand', { player: 'self', target: ['E_OLD'] }, ctx());
      // step2: 手札 HX を裏向き証拠へ (handToEvidence 新 verb)
      runAtom(d, 'handToEvidence', { player: 'self', target: ['HX'] }, ctx());
    });
    expect(after.players.self.evidence).toHaveLength(1);              // net 不変 (1→0→1)
    expect([...after.players.self.hand].sort()).toEqual(['E_OLD']);   // HX 出て E_OLD 入った (net 不変)
    const top = after.players.self.evidence[0]!;
    expect(top.cardId).toBe('HX');                                   // 入替手札が証拠 top
    expect(top.faceUp).toBe(false);                                  // 裏向き
  });
});

/** B06029 a1 chain を実 engine 経路で駆動し pick を AI 解決して drain しきる。 */
function runA1(setup: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  setup(s);
  const ab = def.card('B06029')!.abilities.find((a) => a.id === 'a1')!;
  s = produce(s, (d) => {
    const c = { source: { player: 'self', cardId: 'B06029', uid: 'src#1', abilityId: 'a1', area: 'scene' }, bindings: {} } as unknown as EffectCtx;
    runEffect(d, ab.effect as never, c);
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, new HeuristicPolicy());
      runAllUntilEmpty(d);
    }
  });
  return s;
}

describe('B06029 a1 chain break — 0 証拠で step2 skip (§5 そうした場合 semantics)', () => {
  it('§5 証拠0枚 → evidenceToHand no-candidate → handToEvidence skip (手札/証拠 unchanged)', () => {
    const after = runA1((s) => {
      s.players.self.hand = ['HX', 'HY'];
      s.players.self.evidence = []; // 0 証拠 → step1 no-op
    });
    expect([...after.players.self.hand].sort()).toEqual(['HX', 'HY']); // step2 走らず手札不変
    expect(after.players.self.evidence).toHaveLength(0);          // 証拠も不変
  });
});

describe('出荷カード構造 (§6)', () => {
  it('§6a B06029 ヘビ男: shape + a1 chain[evidenceToHand,handToEvidence] + a2 ヒラメキ sleep', () => {
    expect(B06029.id).toBe('B06029');
    expect(B06029.kind).toBe('character');
    expect(B06029.names).toEqual(['ヘビ男']);
    expect(B06029.colors).toEqual(['緑']);
    expect(B06029.traits).toEqual(['YAIBA']);
    expect(B06029.level).toBe(3);
    expect(B06029.ap).toBe(3000);
    expect(B06029.lp).toBe(1);
    const a1 = B06029.abilities[0];
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    expect(a1.effect).toEqual({
      kind: 'chain',
      steps: [
        { kind: 'atom', verb: 'evidenceToHand', args: { player: 'self', max: 1 } },
        { kind: 'atom', verb: 'handToEvidence', args: { player: 'self', n: 1 } },
      ],
    });
    const a2 = B06029.abilities[1];
    expect(a2.trigger).toEqual({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toEqual({ kind: 'atom', verb: 'sceneSetState', args: { player: 'self', state: 'sleep', max: 1, side: 'either' } });
  });

  it('§6b B06029P: base spread (abilities 共有, img/rarity 差)', () => {
    expect(B06029P.id).toBe('B06029P');
    expect(B06029P.no).toBe('0652/B06029P');
    expect(B06029P.rarity).toBe('CP');
    expect(B06029P.imageUrl).toBe('1755684931904393.jpg');
    expect(B06029P.abilities).toBe(B06029.abilities); // spread = 同一参照
  });
});
