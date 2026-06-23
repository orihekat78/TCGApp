// wave bug153-setcard-host-check (2026-06-23) — engine additive 修正 + B05035 解禁
//
// BUG-153: charSetCard{fromDeckTop} は deck.shift() → setCard の順だったため、host (uid) が現場不在の
//   とき setCard が no-op になり、shift した上端カードが deck/remove/setCards のどこにも残らず消失していた。
//   修正: shift より前に readScene.byUid(scUid) で host 存在を確認、不在なら shift せず return
//   (= 公式Q&A『離場時はデッキ上に戻す』。host 存在時は従来と完全同挙動ゆえ回帰0)。
//
// B05035 遠山和葉:【登場時】デッキ上端1枚を公開→[服部平次]/[遠山和葉]なら手札に加えてもよい→
//   加えなければ裏向きでこのキャラにセット。host-absent 挙動が公式Q&A で明示されるため BUG-153 修正後に解禁。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { run as runEffect } from '@/engine/effect/resolver';
import { read } from '@/engine/read/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { registerAll } from '@/cards/index';
import { sceneChar } from '../helpers/fixtures';
import { B05035 } from '@/cards/ct-p05/B05035';
import type { CardDef, GameState, EffectCtx } from '@/engine/types';

// ---- synthetic decoy defs ----
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 4, ap: 4000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

const HATTORI = 'DEC_HATTORI';   // names[服部平次] → cardName filter match
const KAZUHA = 'DEC_KAZUHA';     // names[遠山和葉] → cardName filter match (2つ目の有効名)
const OTHER = 'DEC_OTHER';       // names[工藤新一] → name decoy (非該当)
const FILLER = 'DEC_FILLER';     // deck filler

function registerDecoys(): void {
  registerCardDef(ch(HATTORI, { names: ['服部平次'], colors: ['緑'], level: 5 }));
  registerCardDef(ch(KAZUHA, { names: ['遠山和葉'], colors: ['緑'], level: 5 }));
  registerCardDef(ch(OTHER, { names: ['工藤新一'], colors: ['青'], level: 5 }));
  registerCardDef(ch(FILLER, { names: ['フィラー'], colors: ['緑'], level: 1 }));
}

const selfTurn = (): GameState => {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
};

const ctxFor = (cardId: string, uid: string): EffectCtx =>
  ({ source: { cardId, uid, abilityId: 'a1', player: 'self', area: 'scene' }, bindings: {} } as never);

// charSetCard{fromDeckTop} 単体 atom (BUG-153 engine 検証用)
const setFromDeckTop = (uid: string) => ({
  kind: 'atom', verb: 'charSetCard',
  args: { uid, fromDeckTop: true, faceUp: false, player: 'self' },
} as never);

describe('wave bug153 — charSetCard host-check 修正 + B05035 解禁', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetUidCounter();
    resetDefRegistry();
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ============================================================
  // BUG-153 engine: charSetCard{fromDeckTop} の host 存在チェック
  // ============================================================
  it('BUG-153 host-absent: host が現場不在なら deck 上端を消費しない (公開カードはデッキ上に残る)', () => {
    let s = selfTurn();
    s.players.self.scene = []; // host 不在
    s.players.self.deck = [FILLER, OTHER];
    s = produce(s, (d) => {
      runEffect(d, setFromDeckTop('ghost#1'), ctxFor('B05035', 'ghost#1'));
    });
    expect(s.players.self.deck, 'deck 上端は shift されず保持 (カード消失しない)').toEqual([FILLER, OTHER]);
    expect(s.players.self.remove, 'remove へも入らない').toEqual([]);
    // host 不在ゆえ setCards はどこにも生成されない (scene 空)
    expect(s.players.self.scene.length).toBe(0);
  });

  it('BUG-153 host-present (回帰0): host 存在時は従来通り deck 上端を裏向きセット', () => {
    let s = selfTurn();
    s.players.self.scene = [sceneChar('B05035', 'present#1')];
    s.players.self.deck = [FILLER, OTHER];
    s = produce(s, (d) => {
      runEffect(d, setFromDeckTop('present#1'), ctxFor('B05035', 'present#1'));
    });
    const host = s.players.self.scene.find((c) => c.uid === 'present#1')!;
    expect(host.setCards.length, 'host に 1 枚裏向きセット').toBe(1);
    expect(host.setCards[0], '上端 FILLER が裏向き(faceUp:false)でセット').toMatchObject({ cardId: FILLER, faceUp: false });
    expect(s.players.self.deck, '上端は deck から抜けた').toEqual([OTHER]);
  });

  it('BUG-153 empty-deck: host 存在 + deck 空なら何も起きない (従来 empty-deck guard)', () => {
    let s = selfTurn();
    s.players.self.scene = [sceneChar('B05035', 'present#1')];
    s.players.self.deck = [];
    s = produce(s, (d) => {
      runEffect(d, setFromDeckTop('present#1'), ctxFor('B05035', 'present#1'));
    });
    expect(s.players.self.scene.find((c) => c.uid === 'present#1')!.setCards.length).toBe(0);
  });

  // ============================================================
  // B05035 遠山和葉 — 【登場時】 reveal-1 → 任意手札追加 / 加えねば裏向きセット
  // ============================================================
  it('B05035: 上端が[服部平次] → AI は手札に加える / 裏向きセットしない', () => {
    let s = selfTurn();
    s.players.self.scene = [sceneChar('B05035', 'kazuha#1')];
    s.players.self.deck = [HATTORI, FILLER];
    s = produce(s, (d) => {
      runEffect(d, B05035.abilities[0].effect as never, ctxFor('B05035', 'kazuha#1'));
    });
    const host = s.players.self.scene.find((c) => c.uid === 'kazuha#1')!;
    expect(s.players.self.hand, '[服部平次] を手札に加える').toContain(HATTORI);
    expect(s.players.self.deck, 'HATTORI は deck から抜けた').not.toContain(HATTORI);
    expect(host.setCards.length, '手札に加えたので裏向きセットなし').toBe(0);
  });

  it('B05035: 上端が[遠山和葉] (2つ目の有効名) → 手札に加える', () => {
    let s = selfTurn();
    s.players.self.scene = [sceneChar('B05035', 'kazuha#1')];
    s.players.self.deck = [KAZUHA, FILLER];
    s = produce(s, (d) => {
      runEffect(d, B05035.abilities[0].effect as never, ctxFor('B05035', 'kazuha#1'));
    });
    const host = s.players.self.scene.find((c) => c.uid === 'kazuha#1')!;
    expect(s.players.self.hand, '[遠山和葉] も cardName filter にヒット').toContain(KAZUHA);
    expect(host.setCards.length).toBe(0);
  });

  it('B05035 decoy: 上端が[工藤新一] (非該当) → 手札に加えず、裏向きでこのキャラにセット', () => {
    let s = selfTurn();
    s.players.self.scene = [sceneChar('B05035', 'kazuha#1')];
    s.players.self.deck = [OTHER, FILLER];
    s = produce(s, (d) => {
      runEffect(d, B05035.abilities[0].effect as never, ctxFor('B05035', 'kazuha#1'));
    });
    const host = s.players.self.scene.find((c) => c.uid === 'kazuha#1')!;
    expect(s.players.self.hand, '非該当名は手札に加えない').not.toContain(OTHER);
    expect(host.setCards.length, '裏向きセット 1 枚').toBe(1);
    expect(host.setCards[0], 'OTHER が裏向き(faceUp:false)でセット').toMatchObject({ cardId: OTHER, faceUp: false });
    expect(s.players.self.deck, 'OTHER は deck 上端から抜けた').toEqual([FILLER]);
  });

  it('B05035 host-absent (Q&A): 登場キャラが解決前に現場を離れていたら公開カードはデッキ上に残る', () => {
    let s = selfTurn();
    s.players.self.scene = []; // 登場キャラ (host) が不在 = 解決前に離場した状況
    s.players.self.deck = [OTHER, FILLER];
    s = produce(s, (d) => {
      runEffect(d, B05035.abilities[0].effect as never, ctxFor('B05035', 'kazuha#1'));
    });
    expect(s.players.self.deck, '非該当の公開カードは set 不可 → デッキ上端に残す').toEqual([OTHER, FILLER]);
    expect(s.players.self.hand, '手札にも加わらない').not.toContain(OTHER);
    expect(s.players.self.remove, 'remove にも落ちない').toEqual([]);
  });

  it('B05035 descriptor: a1 enter sequence[deckRevealUntil cardName[服部平次,遠山和葉]/chooseMatch upTo, if matched handAdd, if revealed charSetCard fromDeckTop faceUp:false]', () => {
    expect(B05035.abilities.length).toBe(1);
    const a1 = B05035.abilities[0];
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    const steps = (a1.effect as { steps: unknown[] }).steps;
    expect(steps[0]).toMatchObject({ verb: 'deckRevealUntil', args: { player: 'self', maxN: 1, chooseMatch: 'upTo', filter: { cardName: ['服部平次', '遠山和葉'] }, bind: '$revealed', bindMatch: '$matched' } });
    expect(steps[1]).toMatchObject({ kind: 'conditional', if: { kind: 'bound', key: '$matched', presence: 'matched' }, then: { verb: 'handAddFromDeck', args: { cardId: '$matched.cardId' } } });
    expect(steps[2]).toMatchObject({ kind: 'conditional', if: { kind: 'bound', key: '$revealed', presence: 'matched' }, then: { verb: 'charSetCard', args: { uid: '$self', fromDeckTop: true, faceUp: false } } });
  });
});
