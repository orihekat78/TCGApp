// Phase 4 Group C Task 4.9 — 1-turn integration round-trip
// spec: .claude/specs/engine-api-flow-control.md
// rules: 04-game-setup.md, 05-turn-phases.md, 07-action-flow.md, 08-contact.md, 11-reasoning.md
//
// 2 シナリオを単一ファイルで:
//   A. 推理ラウンドトリップ: setup → auto → enter active char → doReasoning →
//      証拠 +LP / char sleep / invariant 通過
//   B. アクションラウンドトリップ: setup → auto → enter active(self) + sleep(opp) →
//      declare → passGuard → advance phases → snapshotAP → judge → opp char removed →
//      advance to action-end / invariant 通過
//
// 両シナリオで Hook 発火順をスパイで記録 → 期待順序を検証する。
// 各シナリオ末で engine.invariant の各チェックを通す。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { setup, type DeckPair } from '@/engine/flow/setup';
import { runAutoPhase } from '@/engine/flow/auto-phase';
import { doReasoning } from '@/engine/flow/main/reasoning';
import {
  declare,
  passGuard,
  advance,
  snapshotAP,
  _resetActionContexts,
} from '@/engine/flow/action/state-machine';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { judge } from '@/engine/flow/contact';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { invariant } from '@/engine/invariant/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState, ActionContext, HookName } from '@/engine/types';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: opts.kind ?? 'character',
    names: opts.names ?? [id],
    colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    ap: opts.ap ?? 1000,
    lp: opts.lp ?? 1000,
    traits: opts.traits ?? [],
    rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '',
    abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

/**
 * 40 枚デッキを構築する (rules/02: 同ID ≤ 3 枚)。
 * 13セット × 3 枚 + 1 枚 = 40.
 */
function makeMainDeck(prefix: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < 13; i++) {
    out.push(`${prefix}-c${i}`);
    out.push(`${prefix}-c${i}`);
    out.push(`${prefix}-c${i}`);
  }
  out.push(`${prefix}-c14`);
  return out;
}

function makeDecks(): DeckPair {
  return {
    self: { partnerId: 'P-SELF', caseId: 'CASE-SELF', mainCards: makeMainDeck('s') },
    opp: { partnerId: 'P-OPP', caseId: 'CASE-OPP', mainCards: makeMainDeck('o') },
  };
}

/**
 * 全 invariant をチェック (両プレイヤー).
 * caseMonotonic / scratchTraceMonotonic は prev 比較なので
 * 「現状態 → 同状態」で呼んで「状態が悪い方向に進んでないか」を担保する。
 * stunSemantics は uid + 試行履歴が必要 — 整合チェックなしのプレースホルダなので呼ばない。
 */
function checkAllInvariants(s: GameState): void {
  invariant.sceneAtMost5(s, 'self');
  invariant.sceneAtMost5(s, 'opp');
  invariant.partnerExists(s, 'self');
  invariant.partnerExists(s, 'opp');
  invariant.caseExists(s, 'self');
  invariant.caseExists(s, 'opp');
  invariant.caseMonotonic(s, 'self', s.players.self.case.status);
  invariant.caseMonotonic(s, 'opp', s.players.opp.case.status);
  invariant.scratchTraceMonotonic(s, 'self', s.scratchTrace.self);
  invariant.scratchTraceMonotonic(s, 'opp', s.scratchTrace.opp);
}

/**
 * シナリオ共通の前処理:
 *   - パートナーと事件のカード定義を登録
 *   - 推理/アクション用の自陣キャラ AtkChar (LP=2, AP=1000) を登録
 *   - opp の防御キャラ DefChar (AP=1000) を登録
 *   - setup → mulligan(0) 両方 → reveal → startGame
 *   - 先攻 self の auto-phase 1 回 (FILE=1)
 */
function freshGame(): GameState {
  _resetUidCounter();
  resetDefRegistry();
  _resetActionContexts();
  _resetTargetExpanders();
  registerCardDef(makeCard('P-SELF', { kind: 'partner', lp: 2 }));
  registerCardDef(makeCard('P-OPP', { kind: 'partner', lp: 2 }));
  registerCardDef(makeCard('CASE-SELF', { kind: 'case' }));
  registerCardDef(makeCard('CASE-OPP', { kind: 'case' }));
  registerCardDef(makeCard('AtkChar', { ap: 1000, lp: 2 }));
  registerCardDef(makeCard('DefChar', { ap: 1000, lp: 1 }));

  return produce(createEmptyGameState(), draft => {
    setup.init(draft, makeDecks());
    setup.decideFirstPlayer(draft, 'manual', 'self');
    setup.dealOpeningHand(draft, 'self');
    setup.dealOpeningHand(draft, 'opp');
    setup.mulligan(draft, 'self', []);
    setup.mulligan(draft, 'opp', []);
    setup.reveal(draft);
    setup.startGame(draft);
    runAutoPhase(draft, 'self');
  });
}

describe('integration: 1-turn round-trip', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetActionContexts();
    _resetTargetExpanders();
    _resetUidCounter();
    resetDefRegistry();
  });

  describe('Scenario A: reasoning round-trip', () => {
    it('setup → auto → enter active char → doReasoning → evidence+LP / char sleep / invariants pass', () => {
      // Hook recorder
      const recorded: HookName[] = [];
      const hookNames: HookName[] = [
        'phase:auto:start',
        'phase:auto:before-draw',
        'phase:auto:after-draw',
        'phase:auto:after-file',
        'reasoning:declare',
        'reasoning:before-add',
        'reasoning:end',
      ];
      for (const h of hookNames) {
        event.on(h, () => {
          recorded.push(h);
        });
      }

      const base = freshGame();

      // 先攻 self / 初手 5 枚 + auto-phase で 1 ドロー = 6 / FILE=1
      expect(base.turn.player).toBe('self');
      expect(base.players.self.hand).toHaveLength(6);
      expect(base.players.self.file).toHaveLength(1);
      // base.players.self.deck: 40 - 5(opening) - 1(auto draw) - 1(file) = 33
      expect(base.players.self.deck).toHaveLength(33);

      // 推理用キャラを self.scene に直接入れる (Phase 4 範囲 — カード効果駆動の登場は Phase 5)
      let charUid = '';
      const s1 = produce(base, draft => {
        const c = mutate.scene.enter(draft, 'self', 'AtkChar', { active: true, named: false });
        charUid = c.uid;
      });
      expect(charUid).toBeTruthy();
      expect(s1.players.self.scene[0].state).toBe('active');

      const evidenceBefore = s1.players.self.evidence.length;
      const deckBefore = s1.players.self.deck.length;

      // 推理 (LP=2 → 2 枚の証拠)
      const s2 = produce(s1, draft => {
        doReasoning(draft, charUid);
      });

      // 結果検証
      expect(s2.players.self.evidence.length).toBe(evidenceBefore + 2);
      expect(s2.players.self.deck.length).toBe(deckBefore - 2);
      const charAfter = s2.players.self.scene.find(c => c.uid === charUid)!;
      expect(charAfter.state).toBe('sleep');

      // Hook 順序検証 (auto → enter → reasoning)
      // auto: start → before-draw → after-draw → after-file
      expect(recorded[0]).toBe('phase:auto:start');
      expect(recorded[1]).toBe('phase:auto:before-draw');
      expect(recorded[2]).toBe('phase:auto:after-draw');
      expect(recorded[3]).toBe('phase:auto:after-file');
      // reasoning: declare → before-add → end (この順)
      const dIdx = recorded.indexOf('reasoning:declare');
      const bIdx = recorded.indexOf('reasoning:before-add');
      const eIdx = recorded.indexOf('reasoning:end');
      expect(dIdx).toBeGreaterThanOrEqual(0);
      expect(bIdx).toBeGreaterThan(dIdx);
      expect(eIdx).toBeGreaterThan(bIdx);

      // 不変条件
      expect(() => checkAllInvariants(s2)).not.toThrow();
    });
  });

  describe('Scenario B: action round-trip with judge', () => {
    it('setup → auto → enter chars → declare → passGuard → advance → judge → opp removed / invariants pass', () => {
      // Hook recorder
      const recorded: HookName[] = [];
      const hookNames: HookName[] = [
        'phase:auto:start',
        'phase:auto:after-file',
        'action:declare',
        'action:guard-window',
        'action:unguarded',
        'contact:start',
        'contact:order-set',
        'contact:before-judge',
        'contact:judge',
        'contact:end',
        'action:end',
      ];
      for (const h of hookNames) {
        event.on(h, () => {
          recorded.push(h);
        });
      }

      const base = freshGame();

      // self に攻撃キャラ active, opp に防御キャラ sleep
      let atkUid = '';
      let defUid = '';
      const s1 = produce(base, draft => {
        const a = mutate.scene.enter(draft, 'self', 'AtkChar', { active: true, named: false });
        atkUid = a.uid;
        const d = mutate.scene.enter(draft, 'opp', 'DefChar', { active: false, named: false });
        defUid = d.uid;
        mutate.scene.setState(draft, d.uid, 'sleep');
      });
      expect(atkUid).toBeTruthy();
      expect(defUid).toBeTruthy();

      // アクション宣言 → guard-window へ
      let ax: ActionContext | undefined;
      const s2 = produce(s1, draft => {
        ax = declare(draft, atkUid, { kind: 'char', uid: defUid });
      });
      expect(ax?.phase).toBe('guard-window');
      // 攻撃側スリープ化
      expect(s2.players.self.scene.find(c => c.uid === atkUid)!.state).toBe('sleep');

      // ガードなし: passGuard で leave-resolution へ
      const s3 = produce(s2, draft => {
        passGuard(draft, ax!);
      });
      expect(ax?.phase).toBe('leave-resolution');

      // advance: leave-resolution → contact-pending
      const s4 = produce(s3, draft => {
        advance(draft, ax!);
      });
      expect(ax?.phase).toBe('contact-pending');

      // advance: contact-pending → action-1 (contact:start + contact:order-set emit)
      const s5 = produce(s4, draft => {
        advance(draft, ax!);
      });
      expect(ax?.phase).toBe('action-1');
      // 行動順: AP 同値 → 防御側(=opp) 先 (rules/08)
      expect(ax?.firstUid).toBe(defUid);
      expect(ax?.secondUid).toBe(atkUid);

      // action-1 → action-2 → judge
      const s6 = produce(s5, draft => {
        advance(draft, ax!);
        advance(draft, ax!);
      });
      expect(ax?.phase).toBe('judge');

      // snapshotAP + judge
      const s7 = produce(s6, draft => {
        snapshotAP(draft, ax!);
        const r = judge(draft, ax!);
        // AP 1000 vs 1000 → 同値も defender remove
        expect(r.defenderRemoved).toBe(true);
        expect(r.attackerRemoved).toBe(false);
      });
      // opp scene から defUid 消失
      expect(s7.players.opp.scene.find(c => c.uid === defUid)).toBeUndefined();
      // 攻撃側は残っている (rules/08)
      expect(s7.players.self.scene.find(c => c.uid === atkUid)).toBeDefined();

      // advance: judge → contact-end → action-end
      const s8 = produce(s7, draft => {
        advance(draft, ax!);
        advance(draft, ax!);
      });
      expect(ax?.phase).toBe('action-end');

      // Hook 順序検証
      const idxOf = (h: HookName) => recorded.indexOf(h);
      // setup auto-phase hooks
      expect(idxOf('phase:auto:start')).toBeGreaterThanOrEqual(0);
      expect(idxOf('phase:auto:after-file')).toBeGreaterThan(idxOf('phase:auto:start'));
      // action sequence
      expect(idxOf('action:declare')).toBeGreaterThan(0);
      expect(idxOf('action:guard-window')).toBeGreaterThan(idxOf('action:declare'));
      expect(idxOf('action:unguarded')).toBeGreaterThan(idxOf('action:guard-window'));
      expect(idxOf('contact:start')).toBeGreaterThan(idxOf('action:unguarded'));
      expect(idxOf('contact:order-set')).toBeGreaterThan(idxOf('contact:start'));
      expect(idxOf('contact:before-judge')).toBeGreaterThan(idxOf('contact:order-set'));
      expect(idxOf('contact:judge')).toBeGreaterThan(idxOf('contact:before-judge'));
      expect(idxOf('contact:end')).toBeGreaterThan(idxOf('contact:judge'));
      expect(idxOf('action:end')).toBeGreaterThan(idxOf('contact:end'));

      // 不変条件
      expect(() => checkAllInvariants(s8)).not.toThrow();
    });
  });
});
