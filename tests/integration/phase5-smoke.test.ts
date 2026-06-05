// tests/integration/phase5-smoke — Phase 5 Group F: registerAll + 簡単なゲーム進行
// spec: Phase 5 Task 5.7b
// rules: 02-deck-construction.md, 04-game-setup.md, 05-turn-phases.md
//
// 目的: registerAll で 47 枚を投入したあと、setup → startTurn → endTurn の
// 一連の flow が **無例外で完走** することを保証する。
// 個別カード効果の挙動は各 cards/*.test.ts でカバー済み。本テストは Hook wiring 起因の
// 例外 (e.g. listener が想定外の payload を読む / undefined deref) を検出するセーフティネット。

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import {
  registerAll,
  GENERATED_PARTNERS, GENERATED_SIMPLE_CARDS, GENERATED_COMPLEX_CUTINS, REUSE_CARDS,
} from '@/cards/index';
import { event } from '@/engine/event/index';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import type { GameState } from '@/engine/types';

// MVP 47 + generated (partners + simple cards + complex cut-ins)
const GEN = [...GENERATED_PARTNERS, ...GENERATED_SIMPLE_CARDS, ...GENERATED_COMPLEX_CUTINS, ...REUSE_CARDS].length;

/**
 * 40枚デッキを構築するヘルパー。
 *
 * 14 unique character IDs × 3 copies = 42 → slice(0, 40) で 40 枚。
 * 全 ID が 3 枚以下なので rules/02 を満たす。
 *
 * D08 のシンプル系キャラ (cutinFixedAP のみ等) を中心に選択し、
 * 副作用の少ないデッキで wiring 検証に集中させる。
 */
function buildD08Deck(): string[] {
  const ids = [
    'D08003', 'D08005', 'D08007', 'D08009', 'D08011', 'D08013',
    'D08015', 'D08017', 'D08018', 'D08019', 'D08020', 'D08021',
    'D08022', 'D08023',
  ];
  const deck: string[] = [];
  for (const id of ids) {
    deck.push(id, id, id);
  }
  return deck.slice(0, 40);
}

function buildD11Deck(): string[] {
  const ids = [
    'D11003', 'D11004', 'D11005', 'D11006', 'D11007', 'D11009',
    'D11010', 'D11011', 'D11013', 'D11014', 'D11015', 'D11016',
    'D11017', 'D11018',
  ];
  const deck: string[] = [];
  for (const id of ids) {
    deck.push(id, id, id);
  }
  return deck.slice(0, 40);
}

describe('Phase 5 smoke — registerAll + 簡単なゲーム進行', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    event._resetRegistry();
    _resetActionContexts();
    _resetUidCounter();
    registerAll();
  });

  it('registerAll → MVP 47 + generated 枚登録', () => {
    expect(engine.cards.all().length).toBe(47 + GEN);
  });

  it('setup.init → decideFirstPlayer → dealOpeningHand → reveal → startGame が無例外', () => {
    let s: GameState = createEmptyGameState();
    const selfDeck = buildD08Deck();
    const oppDeck = buildD11Deck();
    expect(selfDeck.length).toBe(40);
    expect(oppDeck.length).toBe(40);

    expect(() => {
      s = produce(s, draft => {
        engine.flow.setup.init(draft, {
          self: { partnerId: 'D08001', caseId: 'D08026', mainCards: selfDeck },
          opp: { partnerId: 'D11001', caseId: 'D11021', mainCards: oppDeck },
        });
        engine.flow.setup.decideFirstPlayer(draft, 'manual', 'self');
        engine.flow.setup.dealOpeningHand(draft, 'self');
        engine.flow.setup.dealOpeningHand(draft, 'opp');
        engine.flow.setup.reveal(draft);
        engine.flow.setup.startGame(draft);
      });
    }).not.toThrow();

    expect(s.turn.player).toBe('self');
    expect(s.turn.number).toBe(1);
    expect(s.players.self.hand).toHaveLength(5);
    expect(s.players.opp.hand).toHaveLength(5);
    expect(s.players.self.case.requiredEvidence).toBe(7);
    expect(s.players.opp.case.requiredEvidence).toBe(6);
  });

  it('startTurn (オートフェイズ) + endTurn (エンドフェイズ) が無例外', () => {
    let s: GameState = createEmptyGameState();
    const selfDeck = buildD08Deck();
    const oppDeck = buildD11Deck();

    s = produce(s, draft => {
      engine.flow.setup.init(draft, {
        self: { partnerId: 'D08001', caseId: 'D08026', mainCards: selfDeck },
        opp: { partnerId: 'D11001', caseId: 'D11021', mainCards: oppDeck },
      });
      engine.flow.setup.decideFirstPlayer(draft, 'manual', 'self');
      engine.flow.setup.dealOpeningHand(draft, 'self');
      engine.flow.setup.dealOpeningHand(draft, 'opp');
      engine.flow.setup.reveal(draft);
      engine.flow.setup.startGame(draft);
    });

    // 何も行動せず即終了
    expect(() => {
      s = produce(s, draft => {
        engine.flow.startTurn(draft, 'self');
        engine.flow.endTurn(draft, 'self');
      });
    }).not.toThrow();

    expect(s.turn.player).toBe('opp'); // endTurn でターン交代
    expect(s.turn.number).toBe(2);
  });

  it('case:to-resolved Hook が caseResolvedHandRemove を発火する (D08026)', () => {
    let s: GameState = createEmptyGameState();

    // 手札に2枚仕込み, 事件カードを 事件編 でセット
    s = produce(s, draft => {
      draft.players.self.hand = ['D08015', 'D08017'];
      draft.players.self.case = {
        cardId: 'D08026',
        status: '事件編',
        requiredEvidence: 7,
        colors: ['青'],
      };
    });

    // caseToResolved atom verb で 事件編→解決編
    // Hook 'case:to-resolved' が emit され、D08026.a1 (caseResolvedHandRemove) が
    // listener として pendingEffects に積む or 即時 mutate する。
    // ここでは "wiring 中に例外が出ないこと" のみを検証する。
    expect(() => {
      produce(s, draft => {
        engine.effect.runAtom(draft, 'caseToResolved', { player: 'self' }, {
          source: { player: 'self', area: 'case' },
          bindings: {},
        });
      });
    }).not.toThrow();
  });
});
