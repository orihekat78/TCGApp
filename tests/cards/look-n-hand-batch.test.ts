// Task A batch#2 wave1 — look-N → 手札 クラスタ (engine変更0)
//
// 検証対象 (6 rep / 11 枚): B04024/B05057/B06088/B05060 (pure look-N→hand),
//   B03007/PR061/PR065 (look-N→hand→discard + ヒラメキdraw), PR180/PR186 (enterSleep + look-N→hand→discard),
//   PR084/PR090 (【相手ターン中】【現場リムーブ時】 look-1→hand + 【カットイン】AP+1000)。
//
// すべて settled パターンの再録: deckRevealUntil + handAddFromDeck + deckToBottomBound (B01013/D01013 同型),
//   ヒラメキdraw (B01011 a2), inherent enterSleep (B01011.entersSleep), cutin AP+ (D01010 a2), leave:to-remove hook (D01012)。
// 本 test は (1) 代表 2 経路 (enter→look→hand / leave-hook→look→hand) の実 flow と
//   (2) 全 11 枚の descriptor 構造 (maxN / filter / discard chain / hirameki / enterSleep / cutin) を担保する。
// deckRevealUntil 等の verb 経路自体は既存 deck-look-N batch (B01013/D01013) test で担保済。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import type { AbilityDef, CardDef, GameState } from '@/engine/types';
import { B04024 } from '@/cards/ct-p04/B04024';
import { B05057 } from '@/cards/ct-p05/B05057';
import { B06088 } from '@/cards/ct-p06/B06088';
import { B05060 } from '@/cards/ct-p05/B05060';
import { B03007 } from '@/cards/ct-p03/B03007';
import { PR061 } from '@/cards/pr-01/PR061';
import { PR180 } from '@/cards/pr-01/PR180';
import { PR084 } from '@/cards/pr-01/PR084';
import { sceneChar } from '../helpers/fixtures';

const FB = { type: 'card-back' as const, cardId: 'D08017' };


const lookStep = (ab: AbilityDef) => (ab.effect as { steps: Array<{ verb?: string; args?: Record<string, unknown> }> }).steps;

describe('Task A wave1 — look-N→hand cluster', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    resetCardDefRegistry();
    registerAll();
    registerTriggeredListener();
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  });

  // ---------- 実 flow 1: 【登場時】 look-2 → 特徴[警察] を手札 (B04024) ----------
  it('B04024: 通常プレイ登場で デッキ上2枚から特徴[警察]キャラ(B06088)を手札、非該当(B05057)はデッキ下', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.hand = ['B04024'];
    s.players.self.case.colors = ['緑']; // B04024=緑 (色制限 rules/20)
    s.players.self.file = [FB, FB, FB, FB, FB, FB, FB]; // FILE7 ≥ level4
    // deck top2: B05057(鈴木財閥=非該当) / B06088(警察+警視庁=該当)
    s.players.self.deck = ['B05057', 'B06088', FB.cardId];

    s = produce(s, (d) => {
      handUseCard(d, 'self', 'B04024');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.scene.find((c) => c.cardId === 'B04024'), 'B04024 が現場に登場').toBeTruthy();
    expect(s.players.self.hand, '特徴[警察]の B06088 を手札に加える').toContain('B06088');
    expect(s.players.self.deck, 'B06088 はデッキから抜けた').not.toContain('B06088');
    expect(s.players.self.deck, '非該当 B05057 はデッキに残る (下へ)').toContain('B05057');
  });

  // ---------- 実 flow 2: 【相手ターン中】【現場リムーブ時】 look-1 → 手札 (PR084) ----------
  it('PR084: 相手ターン中の現場リムーブで デッキ上1枚から特徴[毛利探偵事務所]キャラ(B01011)を手札', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 6, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false }; // 【相手ターン中】
    s.players.self.scene = [sceneChar('PR084', 'eri#1')];
    s.players.self.deck = ['B01011', FB.cardId]; // B01011=毛利探偵事務所 (該当)

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'eri#1', 'effect'); // 現場リムーブ → leave:to-remove
      runAllUntilEmpty(d);
    });

    expect(s.players.self.hand, '毛利探偵事務所の B01011 を手札に加える').toContain('B01011');
    expect(s.players.self.deck, 'B01011 はデッキから抜けた').not.toContain('B01011');
  });

  it('PR084: 自分ターンでは発火しない (【相手ターン中】gate)', () => {
    let s: GameState = createEmptyGameState();
    s.turn = { number: 6, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene = [sceneChar('PR084', 'eri#1')];
    s.players.self.deck = ['B01011', FB.cardId];

    s = produce(s, (d) => {
      mutate.scene.removeToRemove(d, 'eri#1', 'effect');
      runAllUntilEmpty(d);
    });

    expect(s.players.self.hand, '自分ターンでは手札に加えない').not.toContain('B01011');
    expect(s.players.self.deck, 'B01011 はデッキに残る').toContain('B01011');
  });

  // ---------- descriptor 構造 (11 枚) ----------
  it('pure look-N→hand: maxN / filter が text と一致 (B04024/B05057/B06088/B05060)', () => {
    const reveal = (c: CardDef) => lookStep(c.abilities[0] as AbilityDef)[0].args as Record<string, unknown>;
    expect(reveal(B04024)).toMatchObject({ maxN: 2, filter: { trait: '警察', kind: 'character' } });
    expect(reveal(B05057)).toMatchObject({ maxN: 2, filter: { trait: '鈴木財閥', kind: 'character' } });
    expect(reveal(B06088)).toMatchObject({ maxN: 3, filter: { trait: '警視庁', kind: 'character' } });
    expect(reveal(B05060)).toMatchObject({ maxN: 2, filter: { trait: ['怪盗', 'マジシャン'], kind: 'character' } });
    // pure look (no discard) → conditional.then は単一 handAddFromDeck
    const cond = lookStep(B04024.abilities[0] as AbilityDef)[1] as { then: { verb: string } };
    expect(cond.then.verb).toBe('handAddFromDeck');
  });

  it('discard chain: 手札に加えた場合 discard 1 (B03007 event / PR061 trait-OR) + ヒラメキdraw', () => {
    for (const c of [B03007, PR061]) {
      const steps = lookStep(c.abilities[0] as AbilityDef);
      const then = (steps[1] as { then: { kind: string; steps: Array<{ verb: string }> } }).then;
      expect(then.kind, `${c.id}: discard chain`).toBe('sequence');
      expect(then.steps.map((x) => x.verb)).toEqual(['handAddFromDeck', 'discard']);
      // a2 = 【ヒラメキ】draw
      const a2 = c.abilities[1] as AbilityDef;
      expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
      expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } });
    }
    expect((lookStep(B03007.abilities[0] as AbilityDef)[0].args as { filter: unknown }).filter).toMatchObject({ kind: 'event' });
    expect((lookStep(PR061.abilities[0] as AbilityDef)[0].args as { filter: unknown }).filter).toMatchObject({ trait: ['警察', '怪盗'], kind: 'character' });
  });

  it('PR180: inherent enterSleep + sparse a2 look-3 FBI discard chain', () => {
    expect(PR180.entersSleep).toBe(true);
    expect(PR180.abilities.map(ability => ability.id)).toEqual(['a2']);
    const [a2] = PR180.abilities as AbilityDef[];
    expect(a2.trigger).toMatchObject({ hook: 'enter', selfOnly: true });
    expect((lookStep(a2)[0].args as { maxN: number; filter: unknown }).maxN).toBe(3);
    expect((lookStep(a2)[0].args as { filter: unknown }).filter).toMatchObject({ trait: 'FBI', kind: 'character' });
  });

  it('PR084: a1 leave:to-remove + turn:opp 条件, a2 cutin AP+1000', () => {
    const [a1, a2] = PR084.abilities as AbilityDef[];
    expect(a1.trigger).toMatchObject({ hook: 'leave:to-remove', selfOnly: true });
    expect(a1.condition).toEqual({ kind: 'turn', player: 'opp' });
    expect((lookStep(a1)[0].args as { maxN: number }).maxN).toBe(1);
    expect(a2.scope).toBe('on-hand');
    expect(a2.trigger).toMatchObject({ hook: 'effect:declared', optional: true, selfOnly: true });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'charModifyAP', args: { uid: '$contact.byUid', delta: 1000, scope: 'contact' } });
  });
});
