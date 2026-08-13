// evidence-self→hand — 【ヒラメキ】「このカードを手札に加える」族。engine変更: atom-handlers.ts
//   handAddFromRemove に fromSelf フラグ 1 つ追加 (純 additive、新 verb なし、args:unknown ゆえ型/whitelist 同期不要)。
//   fromSelf=true で pick をスキップし ctx.source.cardId (=リムーブされた証拠カード自身。triggered.ts
//   handleEvidenceRemovedHook が source.cardId=ev.cardId/player=所有者で起動、action-case.ts removeTop が
//   ev.cardId を所有者 remove 末尾に push 済) を lastIndexOf で remove から取り手札へ。fromTop と同型の deterministic-self 経路。
//
// 出荷 = PR085/PR091 (沖矢昴、赤L4、cardId 0481 の絵柄違い2刷)。B06033/B06033P は別 engine 限界
//   (sequence[chain[pausing-pick], enter] の continuation-nest 上書き) で DEFER (DEFERRED-INDEX 参照)。
//
// 検証 (非MVP = smoke では踏めない → 実 engine 駆動の専用テスト):
//   §1 ★self★ remove=[OTHER, PR085], source=PR085 → PR085 のみ手札へ (別 cardId は残る)。
//   §2 ★lastIndexOf★ remove=[PR085(旧), DEC, PR085(直近)], source=PR085 → 末尾 (直近 push 分) を取る。
//   §3 ★境界:不在★ source が remove に無い → no-op (手札/remove unchanged)。
//   §4 ★e2e★ action[事件] removeOpponentEvidenceTop → removeTop が PR085 を remove へ + emit →
//      listener が pendingHirameki{cardId:PR085} set → drain → a2 resolve → PR085 が remove→手札 (実 flow 一気通貫)。
//   §5 PR085 a1: 登場時キャラ pick → ターン終了まで〚ブレット〛付与。guard.ts が読む read.char.hasKeyword で honor。
//   §6 PR091 = PR085 の spread (絵柄違い別 cardNum、abilities 同一参照)。
//   §7 出荷カード構造 (PR085/PR091 registered + a1/a2 構造)。
// rules: 03-field-areas.md, 07-action-flow.md (§ブレット/guard), 10-action-event.md (§ヒラメキ),
//        13-keywords.md, 14-refresh.md, 15-abilities-effects.md, 17-icons.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetDefRegistry, register as registerCardDef, def } from '@/engine/read/def';
import { registerAll } from '@/cards/index';
import { runAtom } from '@/engine/effect/atom-handlers';
import { run as runEffect } from '@/engine/effect/resolver';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _drainAllEffectPicksForTest } from '@/engine/effect/apply-pick';
import { resolveEffectPicks, _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { createEmptyGameState } from '@/engine/state-factory';
import { mutate } from '@/engine/mutate';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingHirameki } from '@/engine/listeners/hirameki';
import { removeOpponentEvidenceTop, resolveHiramekiDecision } from '@/engine/flow/action-case';
import { cardOccurrenceWitness } from '@/engine/target/card-occurrence';
import { read } from '@/engine/read/index';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { sceneChar } from '../helpers/fixtures';
import { PR085 } from '@/cards/pr-01/PR085';
import { PR091 } from '@/cards/pr-01/PR091';
import type { ActionContext, CardDef, EffectCtx, EvidenceCard, GameState } from '@/engine/types';

const ev = (cardId: string, faceUp = false): EvidenceCard => ({ cardId, faceUp, origin: { turn: 1, via: 'effect' } });
// hirameki ctx: source = リムーブされた証拠カード (area:'evidence', cardId, player=所有者)
const hctx = (state: GameState, cardId: string, player: 'self' | 'opp' = 'self', index = state.players[player].remove.length - 1): EffectCtx =>
  ({
    source: { player, area: 'remove', cardId, abilityId: 'a2', uid: `card:${player}:remove:${cardId}#${index}` },
    bindings: {
      occurrence: [{
        kind: 'card', uid: `card:${player}:remove:${cardId}#${index}`, player, cardId, area: 'remove', index,
        occurrenceWitness: cardOccurrenceWitness(state, player, 'remove'),
      }],
    },
  } as unknown as EffectCtx);
const ch = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'], level: 4, ap: 3000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  resetDefRegistry();
  registerAll();
  registerCardDef(ch('TGT', { colors: ['赤'], level: 4, ap: 4000 })); // grant 対象キャラ
  registerCardDef(ch('OTHER', {}));
  registerTriggeredListener();
  _drainPendingHirameki(); // 前テストの side-channel 残りを除去
});

describe('handAddFromRemove fromSelf — runAtom 直接駆動 (§1-3)', () => {
  it('§1 self: source カードのみ remove→手札 (別 cardId は残る)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = [];
      d.players.self.remove = ['OTHER', 'PR085']; // 末尾 PR085 = 直近リムーブ
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'handAddFromRemove', { player: 'self', fromSelf: true }, hctx(s0, 'PR085'));
    });
    expect(after.players.self.hand).toEqual(['PR085']);          // source のみ手札へ
    expect(after.players.self.remove).toEqual(['OTHER']);        // 別 cardId は remove に残る
  });

  it('§2 同 cardId 複数 → lastIndexOf で末尾 (直近 push 分) を取る', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = [];
      d.players.self.remove = ['PR085', 'DEC', 'PR085']; // idx0=旧コピー / idx2=直近リムーブ
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'handAddFromRemove', { player: 'self', fromSelf: true }, hctx(s0, 'PR085'));
    });
    expect(after.players.self.hand).toEqual(['PR085']);          // 1枚だけ手札へ
    expect(after.players.self.remove).toEqual(['PR085', 'DEC']); // 末尾(idx2)が抜け、旧コピーは残る
  });

  it('§3 境界: source が remove に無い → no-op (手札/remove unchanged)', () => {
    const s0 = produce(createEmptyGameState(), (d) => {
      d.players.self.hand = ['HZ'];
      d.players.self.remove = ['X', 'Y'];
    });
    const after = produce(s0, (d) => {
      runAtom(d, 'handAddFromRemove', { player: 'self', fromSelf: true }, hctx(s0, 'PR085', 'self', 0));
    });
    expect(after.players.self.hand).toEqual(['HZ']);
    expect(after.players.self.remove).toEqual(['X', 'Y']);
  });
});

describe('e2e: action[事件] → removeTop → ヒラメキ resolve (§4)', () => {
  it('§4 PR085 が証拠から action[事件] でリムーブ → 【ヒラメキ】で remove→手札 (実 flow 一気通貫)', () => {
    let s = createEmptyGameState();
    s = produce(s, (d) => {
      d.turn = { number: 3, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.evidence = [ev('DECOY_EV'), ev('PR085')]; // PR085 が証拠 top (末尾)
      d.players.self.hand = [];
      d.players.self.remove = [];
    });
    // action[事件]: opp が self の事件を攻撃 → self 証拠 top (PR085) を removeTop + emit
    const ax = { id: 'act#1', byUid: 'opp:atk', byPlayer: 'opp', target: { kind: 'case', player: 'self' }, phase: 'resolve', startedAt: { turn: 3, nano: 0 } } as unknown as ActionContext;
    s = produce(s, (d) => {
      removeOpponentEvidenceTop(d, ax);
    });
    // removeTop が PR085 を self.remove へ移動済 + listener が pendingHirameki を set
    expect(s.players.self.remove).toContain('PR085');
    const pending = _drainPendingHirameki();
    expect(pending).not.toBeNull();
    expect(pending!.cardId).toBe('PR085');
    expect(pending!.player).toBe('self');
    expect(pending!.abilityId).toBe('a2');
    // ヒラメキ fire: a2 effect を resolve (実 flow の hiramekiResolve と同じ ctx.source)
    s = produce(s, (d) => {
      resolveHiramekiDecision(d, ax, pending!, 'fire', { humanChooser: false });
      runAllUntilEmpty(d);
    });
    expect(s.players.self.hand).toContain('PR085');              // PR085 が手札へ
    expect(s.players.self.remove).not.toContain('PR085');        // remove からは消えた
    expect(s.players.self.evidence.map((e) => e.cardId)).toEqual(['DECOY_EV']); // 下の証拠は残る
  });
});

// runEffect + AI auto-pick 駆動 helper: 実 flow (triggered.ts) と同じく resolveEffectPicks で $pick を
// surface/解決 (chooseAtomTarget=AI) してから runEffect → drain (charGrantKeyword/sceneEnter の $pick model)。
function runAbility(cardId: string, abilityId: string, setup: (s: GameState) => void): GameState {
  let s = createEmptyGameState();
  s = produce(s, (d) => { d.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false }; setup(d); });
  const ab = def.card(cardId)!.abilities.find((a) => a.id === abilityId)!;
  const ai = new HeuristicPolicy();
  const ctx = { source: { player: 'self', cardId, uid: 'src#1', abilityId, area: 'scene' }, bindings: {} } as unknown as EffectCtx;
  s = produce(s, (d) => {
    const walked = resolveEffectPicks(d, ab.effect as never, ctx, {
      chooseAtomTarget: ai.chooseAtomTarget?.bind(ai), byPlayer: 'self', humanChooser: false, source: { cardId, abilityId },
    });
    runEffect(d, walked as never, ctx);
    for (let i = 0; i < 6; i++) {
      runAllUntilEmpty(d);
      _drainAllEffectPicksForTest(d, ai);
      runAllUntilEmpty(d);
    }
  });
  return s;
}

describe('PR085 a1 — 登場時〚ブレット〛付与 (§5)', () => {
  it('§5 pick したキャラに ターン終了まで〚ブレット〛 (guard.ts が読む hasKeyword で honor)', () => {
    const s = runAbility('PR085', 'a1', (d) => {
      d.players.self.scene = [sceneChar('TGT', 'tgt#1')]; // 唯一の現場キャラ → AI が pick
    });
    expect(read.char.hasKeyword(s, 'tgt#1', 'ブレット')).toBe(true); // granted (turn-scope) を honor
    // turn-scope 格納の確証 (guard.ts:47 がこの経路を読む)
    const tgt = s.players.self.scene.find((c) => c.uid === 'tgt#1')!;
    expect((tgt.turnEffects['grantedKeywords'] as string[] | undefined) ?? []).toContain('ブレット');
  });
});

describe('PR091 = PR085 spread (§6)', () => {
  it('§6 同一 abilities 参照 / id・no・imageUrl のみ差', () => {
    expect(PR091.id).toBe('PR091');
    expect(PR091.no).toBe('0481/PR091');
    expect(PR091.imageUrl).toBe('1737462993180564.jpg');
    expect(PR091.abilities).toBe(PR085.abilities); // spread = 同一参照
    expect(PR091.names).toEqual(['沖矢昴']);
    expect(PR091.rarity).toBe('PR');
  });
});

describe('出荷カード構造 (§7)', () => {
  it('§7a PR085 沖矢昴: shape + a1 enter→choice→charGrantKeyword{ブレット,turn} + a2 hirameki self→hand', () => {
    expect(PR085.id).toBe('PR085');
    expect(PR085.no).toBe('0481/PR085');
    expect(PR085.kind).toBe('character');
    expect(PR085.names).toEqual(['沖矢昴']);
    expect(PR085.colors).toEqual(['赤']);
    expect(PR085.traits).toEqual(['大学院生']);
    expect(PR085.level).toBe(4);
    expect(PR085.ap).toBe(4000);
    expect(PR085.lp).toBe(1);
    expect(PR085.rarity).toBe('PR');
    expect(PR085.imageUrl).toBe('1737462993152141.jpg');
    const a1 = PR085.abilities[0];
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    expect(a1.effect?.kind).toBe('choice');
    const opt = (a1.effect as { options: { verb?: string; args?: Record<string, unknown> }[] }).options[0];
    expect(opt.verb).toBe('charGrantKeyword');
    expect(opt.args!.kw).toBe('ブレット');
    expect(opt.args!.scope).toBe('turn');
    const a2 = PR085.abilities[1];
    expect(a2.trigger).toEqual({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toEqual({ kind: 'atom', verb: 'handAddFromRemove', args: { player: 'self', fromSelf: true } });
  });

  it('§7b def registry 登録済み (registerAll 経由)', () => {
    for (const id of ['PR085', 'PR091']) {
      expect(def.card(id)?.id, id).toBe(id);
    }
  });

  it('does not retarget an identical remove card after its pending occurrence shifts', () => {
    let s = createEmptyGameState();
    s = produce(s, (d) => {
      d.turn = { number: 3, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
      d.players.self.evidence = [ev('PR085')];
      d.players.self.remove = ['PR085'];
      d.players.self.hand = [];
    });
    const ax = { id: 'act#duplicate', byUid: 'opp:atk', byPlayer: 'opp', target: { kind: 'case', player: 'self' }, phase: 'resolve', startedAt: { turn: 3, nano: 0 } } as unknown as ActionContext;
    s = produce(s, (d) => { removeOpponentEvidenceTop(d, ax); });
    const pending = _drainPendingHirameki();
    expect(pending?.occurrence?.occurrenceWitness).toBe('occ:v1:self:remove:1');

    s = produce(s, (d) => {
      mutate.remove.removeFromHere(d, 'self', ['PR085']);
      resolveHiramekiDecision(d, ax, pending!, 'fire', { humanChooser: false });
      runAllUntilEmpty(d);
    });

    expect(s.players.self.hand).toEqual([]);
    expect(s.players.self.remove).toEqual(['PR085']);
  });
});
