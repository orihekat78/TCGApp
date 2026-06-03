// tests/engine/effect/lensf-batch2a — Lens F batch2a (BUG-102 D11019 deck splice / BUG-103 D08021 AI multi-pick)
// D (BUG-103): CPU/AI 経路で charStackCard multi-pick (cardIds:'$pick.cardIds') が解決され、
//   stackedCards が増え、source area から splice される (複製しない)。
// H (BUG-102): D11019 deck reveal でマッチカードがデッキから除去され現場+デッキで複製しない。

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _setHumanPlayerSide, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import { registerAll } from '@/cards/index';
import type { GameState } from '@/engine/types';

describe('BUG-103: D08021 charStackCard multi-pick が AI 経路で解決される', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    event._resetRegistry();
    _resetTriggeredRegistered();
    registerAll();
    _setHumanPlayerSide('self'); // opp = CPU/AI
    registerTriggeredListener();
  });

  it('CPU の D08021 登場時、remove の [少年探偵団] 3枚を stack し remove から splice する', () => {
    let s: GameState = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      d.players.opp.remove.push('D08013', 'D08003', 'D08009'); // 異名 [少年探偵団] ×3
    });
    s = produce(s, (d) => {
      const ch = engine.mutate.scene.enter(d, 'opp', 'D08021', {});
      event.emit(d, 'enter', { uid: ch.uid, viaEffect: false, enterOrder: ch.enterOrder, enterOrderThisTurn: ch.enterOrderThisTurn }, { player: 'opp', uid: ch.uid });
    });
    s = produce(s, (d) => { runAllUntilEmpty(d); });
    const c = s.players.opp.scene.find((x) => x.cardId === 'D08021');
    expect(c?.stackedCards).toBe(3);     // 修正前は 0 (AI 経路で no-op)
    expect(s.players.opp.remove).toEqual([]); // splice 済 (複製しない)
  });

  it('remove が空 (候補0) なら 0 stack (min:0)', () => {
    let s: GameState = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp'; // opp.remove は空のまま
    });
    s = produce(s, (d) => {
      const ch = engine.mutate.scene.enter(d, 'opp', 'D08021', {});
      event.emit(d, 'enter', { uid: ch.uid, viaEffect: false, enterOrder: ch.enterOrder, enterOrderThisTurn: ch.enterOrderThisTurn }, { player: 'opp', uid: ch.uid });
    });
    s = produce(s, (d) => { runAllUntilEmpty(d); });
    const c = s.players.opp.scene.find((x) => x.cardId === 'D08021');
    expect(c?.stackedCards).toBe(0);
  });
});

describe('BUG-102: D11019 deck reveal でマッチカードがデッキから除去される (複製しない)', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    event._resetRegistry();
    _resetTriggeredRegistered();
    registerAll();
    _setHumanPlayerSide('self');
    registerTriggeredListener();
  });

  it('黄 lv4 以下キャラを公開→登場させると、そのカードがデッキから消え総枚数が保存される', () => {
    // self deck の先頭に黄 lv4 以下キャラ (D11013 = 萩原千速? 黄 lv2 1000) を仕込む
    let s: GameState = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      d.players.self.case = { cardId: 'D11021', status: '事件編', requiredEvidence: 7, colors: ['黄'], declaredUseCount: {} };
      // deck: 先頭にマッチ候補 D11013 (黄)、その後ダミー
      d.players.self.deck = ['D11013', 'D11018', 'D11017', 'D11010'];
    });
    const totalBefore = s.players.self.deck.length + s.players.self.scene.length;
    // D11019 a1 (deckRevealUntil→sceneEnter($matched)→deckToBottomBound→deckShuffle) を直接実行
    s = produce(s, (d) => {
      const a1 = engine.cards.get('D11019')!.abilities[0];
      engine.effect.run(d, a1.effect!, { source: { player: 'self', cardId: 'D11019', abilityId: 'a1', area: 'hand' }, bindings: {} });
      runAllUntilEmpty(d);
    });
    const matchedInScene = s.players.self.scene.some((c) => c.cardId === 'D11013');
    const matchedInDeck = s.players.self.deck.filter((c) => c === 'D11013').length;
    const totalAfter = s.players.self.deck.length + s.players.self.scene.length;
    expect(matchedInScene).toBe(true);   // 現場に登場
    expect(matchedInDeck).toBe(0);       // デッキには残らない (修正前は残って複製)
    expect(totalAfter).toBe(totalBefore); // 総枚数保存 (複製で +1 しない)
  });
});
