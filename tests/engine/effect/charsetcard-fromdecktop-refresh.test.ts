// tests/engine/effect/charsetcard-fromdecktop-refresh — unit B (session64)
// charSetCard{fromDeckTop} の deck0 時 refresh-on-empty (rules/14, 26 + BUG-142 同族の latent bug)。
// 旧: deck0 → silent no-op (rules/14「セットはリフレッシュ後に残り解決」違反)。
// 新: deck0 → refresh (remove→deck shuffle) → set。remove も 0 なら敗北 (rules/14 deck-out)。
// host-absent 早期 return (BUG-153) は維持 = refresh より前に host 存在を確認。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

function ch(id: string): CardDef {
  return { id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'], level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const HOST = 'HOST', FILLER = 'FILLER', OTHER = 'OTHER';

const selfTurn = (): GameState => {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
};
const ctxFor = (cardId: string, uid: string): EffectCtx =>
  ({ source: { cardId, uid, abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as never);
const setFromDeckTop = (uid: string) =>
  ({ kind: 'atom', verb: 'charSetCard', args: { uid, fromDeckTop: true, faceUp: false, player: 'self' } } as never);

describe('charSetCard{fromDeckTop} refresh-on-empty (unit B, rules/14)', () => {
  beforeEach(() => {
    _resetUidCounter();
    resetDefRegistry();
    [HOST, FILLER, OTHER].forEach((id) => registerCardDef(ch(id)));
  });

  it('deck非空 → 従来通り上端1枚を裏向きセット (回帰0)', () => {
    let s = selfTurn();
    s.players.self.scene = [sceneChar(HOST, 'h#1')];
    s.players.self.deck = [FILLER, OTHER];
    s = produce(s, (d) => { runEffect(d, setFromDeckTop('h#1'), ctxFor(HOST, 'h#1')); });
    const host = s.players.self.scene.find((c) => c.uid === 'h#1')!;
    expect(host.setCards.length).toBe(1);
    expect(host.setCards[0]).toMatchObject({ cardId: FILLER, faceUp: false });
    expect(s.players.self.deck).toEqual([OTHER]);
    expect(s.gameResult).toBeUndefined();
  });

  it('deck空 + remove非空 → refresh (remove→deck shuffle) 後に1枚セット + 相手evidence+1 + 痕跡発見', () => {
    let s = selfTurn();
    s.players.self.scene = [sceneChar(HOST, 'h#1')];
    s.players.self.deck = [];
    s.players.self.remove = [FILLER, OTHER];
    s = produce(s, (d) => { runEffect(d, setFromDeckTop('h#1'), ctxFor(HOST, 'h#1')); });
    const host = s.players.self.scene.find((c) => c.uid === 'h#1')!;
    expect(host.setCards.length, 'refresh 後に1枚セット').toBe(1);
    expect(s.players.self.remove.length, 'remove 全て deck へ (1枚は set 消費)').toBe(0);
    expect(s.players.self.deck.length, 'refresh 2枚 - set 1枚 = 1').toBe(1);
    expect(s.players.opp.evidence.length, 'refresh penalty: 相手 evidence +1 (rules/14)').toBe(1);
    expect(s.scratchTrace.opp, '相手 痕跡 発見済 (rules/13,14)').toBe('発見済');
    expect(s.gameResult, '敗北なし (remove>0)').toBeUndefined();
  });

  it('deck空 + remove空 → refresh 失敗 → 敗北 (gameResult deck-out, 相手勝利) + セットなし', () => {
    let s = selfTurn();
    s.players.self.scene = [sceneChar(HOST, 'h#1')];
    s.players.self.deck = [];
    s.players.self.remove = [];
    s = produce(s, (d) => { runEffect(d, setFromDeckTop('h#1'), ctxFor(HOST, 'h#1')); });
    expect(s.gameResult?.winner, 'self が deck-out 敗北 → opp 勝利').toBe('opp');
    expect(s.gameResult?.reason).toBe('deck-out');
    expect(s.players.self.scene.find((c) => c.uid === 'h#1')!.setCards.length, 'set 不発').toBe(0);
  });

  // player:'opp' deck-source (B02020/B03032 系: 相手デッキ上端をセット)。refresh は opp デッキに対し走り、
  // refresh penalty (evidence+1) は refresh したプレイヤーの相手 = self に入る (rules/14)。
  it('player:opp: opp deck空 + opp remove非空 → opp refresh + set + self(相手の相手) evidence+1', () => {
    let s = selfTurn();
    s.players.opp.scene = [sceneChar(HOST, 'oh#1')];
    s.players.opp.deck = [];
    s.players.opp.remove = [FILLER, OTHER];
    const atom = { kind: 'atom', verb: 'charSetCard', args: { uid: 'oh#1', fromDeckTop: true, faceUp: false, player: 'opp' } } as never;
    s = produce(s, (d) => { runEffect(d, atom, ctxFor(HOST, 'oh#1')); });
    const host = s.players.opp.scene.find((c) => c.uid === 'oh#1')!;
    expect(host.setCards.length, 'opp refresh 後に1枚セット').toBe(1);
    expect(s.players.opp.remove.length, 'opp remove は deck へ').toBe(0);
    expect(s.players.self.evidence.length, 'opp の refresh penalty → self evidence +1').toBe(1);
    expect(s.gameResult).toBeUndefined();
  });

  it('player:opp: opp deck空 + opp remove空 → opp deck-out → self 勝利', () => {
    let s = selfTurn();
    s.players.opp.scene = [sceneChar(HOST, 'oh#1')];
    s.players.opp.deck = [];
    s.players.opp.remove = [];
    const atom = { kind: 'atom', verb: 'charSetCard', args: { uid: 'oh#1', fromDeckTop: true, faceUp: false, player: 'opp' } } as never;
    s = produce(s, (d) => { runEffect(d, atom, ctxFor(HOST, 'oh#1')); });
    expect(s.gameResult?.winner, 'opp が deck-out → self 勝利').toBe('self');
    expect(s.gameResult?.reason).toBe('deck-out');
    expect(s.players.opp.scene.find((c) => c.uid === 'oh#1')!.setCards.length).toBe(0);
  });

  it('host-absent → deck/remove 不消費・敗北判定なし (BUG-153 不変、refresh は host 確認後)', () => {
    let s = selfTurn();
    s.players.self.scene = [];
    s.players.self.deck = [];
    s.players.self.remove = [FILLER];
    s = produce(s, (d) => { runEffect(d, setFromDeckTop('ghost#1'), ctxFor(HOST, 'ghost#1')); });
    expect(s.players.self.deck, 'host不在ゆえ refresh しない').toEqual([]);
    expect(s.players.self.remove, 'remove 不変').toEqual([FILLER]);
    expect(s.gameResult, 'host不在で早期 return → 敗北判定もしない').toBeUndefined();
  });
});
