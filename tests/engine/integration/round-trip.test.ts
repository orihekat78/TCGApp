// 統合テスト: read + mutate ラウンドトリップ
// 空 state → enter キャラ → setState sleep → modifyAP +1000 → removeToRemove → 空に戻る
// 各段階で read.* で確認 + invariant 通過
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { engine } from '@/engine/index';
import type { GameState } from '@/engine/types';

describe('engine integration: round-trip', () => {
  let baseState: GameState;

  beforeEach(() => {
    baseState = createEmptyGameState();
    // パートナーと事件を設定 (partnerExists/caseExists 用)
    baseState.players.self.partner = { cardId: 'P001', state: 'active', location: 'partner-area' };
    baseState.players.self.case = { cardId: 'CASE001', status: '事件編', requiredEvidence: 7, colors: ['青'] };
    baseState.players.opp.partner = { cardId: 'P002', state: 'active', location: 'partner-area' };
    baseState.players.opp.case = { cardId: 'CASE002', status: '事件編', requiredEvidence: 6, colors: ['赤'] };
  });

  it('空 state: 現場が空であることを read で確認', () => {
    expect(baseState.players.self.scene).toHaveLength(0);
    // invariant: 5枚以下は通過
    expect(() => engine.invariant.sceneAtMost5(baseState, 'self')).not.toThrow();
    // invariant: partner/case 存在確認
    expect(() => engine.invariant.partnerExists(baseState, 'self')).not.toThrow();
    expect(() => engine.invariant.caseExists(baseState, 'self')).not.toThrow();
  });

  it('enter キャラ → read で確認 → invariant 通過', () => {
    const s1 = produce(baseState, draft => {
      engine.mutate.scene.enter(draft, 'self', 'C001', { active: true, named: true });
    });

    // read で確認
    expect(s1.players.self.scene).toHaveLength(1);
    expect(s1.players.self.scene[0].cardId).toBe('C001');
    expect(s1.players.self.scene[0].state).toBe('active');
    expect(s1.players.self.scene[0].isNamed).toBe(true);

    // invariant: 5枚以下
    expect(() => engine.invariant.sceneAtMost5(s1, 'self')).not.toThrow();
  });

  it('setState sleep → read で確認', () => {
    const s1 = produce(baseState, draft => {
      engine.mutate.scene.enter(draft, 'self', 'C001', {});
    });
    const uid = s1.players.self.scene[0].uid;

    const s2 = produce(s1, draft => {
      engine.mutate.scene.setState(draft, uid, 'sleep');
    });

    expect(s2.players.self.scene[0].state).toBe('sleep');
  });

  it('modifyAP +1000 → 読み取り確認', () => {
    const s1 = produce(baseState, draft => {
      engine.mutate.scene.enter(draft, 'self', 'C001', {});
    });
    const uid = s1.players.self.scene[0].uid;

    const s2 = produce(s1, draft => {
      engine.mutate.char.modifyAP(draft, uid, 1000, 'turn');
    });

    // turnEffects に apMod_turn が設定されている
    expect(s2.players.self.scene[0].turnEffects['apMod_turn']).toBe(1000);
  });

  it('removeToRemove → 現場が空に戻る', () => {
    const s1 = produce(baseState, draft => {
      engine.mutate.scene.enter(draft, 'self', 'C001', {});
    });
    const uid = s1.players.self.scene[0].uid;

    const s2 = produce(s1, draft => {
      engine.mutate.scene.removeToRemove(draft, uid, 'effect');
    });

    // 現場が空に戻った
    expect(s2.players.self.scene).toHaveLength(0);
    // リムーブエリアにカードが移動
    expect(s2.players.self.remove).toContain('C001');
    // invariant: 5枚以下 (0枚でも OK)
    expect(() => engine.invariant.sceneAtMost5(s2, 'self')).not.toThrow();
  });

  it('フルラウンドトリップ: 空→enter→state変更→AP修正→remove→空', () => {
    // 1. 空を確認
    expect(baseState.players.self.scene).toHaveLength(0);

    // 2. enter キャラ
    const s1 = produce(baseState, draft => {
      engine.mutate.scene.enter(draft, 'self', 'C001', { active: true });
    });
    expect(s1.players.self.scene).toHaveLength(1);
    engine.invariant.sceneAtMost5(s1, 'self');

    const uid = s1.players.self.scene[0].uid;

    // 3. setState sleep
    const s2 = produce(s1, draft => {
      engine.mutate.scene.setState(draft, uid, 'sleep');
    });
    expect(s2.players.self.scene[0].state).toBe('sleep');

    // 4. modifyAP +1000
    const s3 = produce(s2, draft => {
      engine.mutate.char.modifyAP(draft, uid, 1000, 'turn');
    });
    expect(s3.players.self.scene[0].turnEffects['apMod_turn']).toBe(1000);

    // 5. removeToRemove → 空に戻る
    const s4 = produce(s3, draft => {
      engine.mutate.scene.removeToRemove(draft, uid, 'effect');
    });
    expect(s4.players.self.scene).toHaveLength(0);
    expect(s4.players.self.remove).toContain('C001');
    engine.invariant.sceneAtMost5(s4, 'self');
  });

  it('事件解決フロー: アシスト→解決編移行→事件解決', () => {
    // デッキを十分に積む (FILE追加用)
    const stateWithDeck = produce(baseState, draft => {
      draft.players.self.deck = Array.from({ length: 10 }, (_, i) => `CARD${i}`);
    });

    // アシスト
    const s1 = produce(stateWithDeck, draft => {
      engine.mutate.partner.assist(draft, 'self');
    });
    expect(s1.players.self.partner.state).toBe('sleep');
    expect(s1.players.self.partner.location).toBe('file-area');
    expect(s1.turnState.self.assistedThisTurn).toBe(true);

    // 事件編→解決編 (invariant: caseMonotonic 事前確認)
    const prevStatus = s1.players.self.case.status;
    const s2 = produce(s1, draft => {
      engine.mutate.case.toResolved(draft, 'self');
    });
    // 移行後の単調性確認
    expect(() => engine.invariant.caseMonotonic(s2, 'self', prevStatus)).not.toThrow();
    expect(s2.players.self.case.status).toBe('解決編');

    // 事件解決は同ターンのアシスト後は不可 (rules/01 ⚠)
    // ここでは gameResult の設定のみ確認 (実際のバリデーションは Phase 3 以降)
    const s3 = produce(s2, draft => {
      // パートナーをアクティブに戻す (テスト用)
      draft.players.self.partner.state = 'active';
      draft.players.self.partner.location = 'partner-area';
    });
    const s4 = produce(s3, draft => {
      engine.mutate.partner.solveCase(draft, 'self');
    });
    expect(s4.gameResult).toEqual({ winner: 'self', reason: 'evidence' });
  });

  it('スタン→アクティブ試行 invariant 確認', () => {
    const s1 = produce(baseState, draft => {
      engine.mutate.scene.enter(draft, 'self', 'C001', {});
    });
    const uid = s1.players.self.scene[0].uid;

    // スタン状態に設定
    const s2 = produce(s1, draft => {
      draft.players.self.scene[0].state = 'stun';
    });

    const beforeState = s2.players.self.scene[0].state; // 'stun'

    // アクティブ化を試みる (スタン特殊挙動で sleep になる)
    const s3 = produce(s2, draft => {
      engine.mutate.scene.setState(draft, uid, 'active');
    });

    // invariant: スタン→アクティブ試行で sleep になったことを確認
    expect(() =>
      engine.invariant.stunSemantics(s3, uid, 'active', beforeState),
    ).not.toThrow();
    expect(s3.players.self.scene[0].state).toBe('sleep');
  });

  it('log append + clear のラウンドトリップ', () => {
    const s1 = produce(baseState, draft => {
      engine.mutate.log.append(draft, {
        ts: 1000,
        player: 'self',
        turn: 1,
        action: 'reasoning',
      });
    });
    expect(s1.log).toHaveLength(1);

    const s2 = produce(s1, draft => {
      engine.mutate.log.clear(draft);
    });
    expect(s2.log).toHaveLength(0);
  });

  it('evidence addFromDeck + removeTop のラウンドトリップ', () => {
    const stateWithDeck = produce(baseState, draft => {
      draft.players.self.deck = ['EV001', 'EV002', 'EV003'];
    });

    // 証拠を追加
    const s1 = produce(stateWithDeck, draft => {
      engine.mutate.evidence.addFromDeck(draft, 'self', 2, false, {
        turn: 1,
        via: 'reasoning',
      });
    });
    expect(s1.players.self.evidence).toHaveLength(2);
    expect(s1.players.self.deck).toHaveLength(1);

    // 最上部を削除
    const s2 = produce(s1, draft => {
      engine.mutate.evidence.removeTop(draft, 'self');
    });
    expect(s2.players.self.evidence).toHaveLength(1);
    expect(s2.players.self.remove).toContain('EV002');
  });

  it('scratchTrace 単調性: 未発見→発見済はOK、逆はinvariantで検出', () => {
    const s1 = produce(baseState, draft => {
      engine.mutate.scratchTrace.set(draft, 'opp', '発見済');
    });
    expect(s1.scratchTrace.opp).toBe('発見済');
    // 単調性 invariant: 未発見→発見済はOK
    expect(() =>
      engine.invariant.scratchTraceMonotonic(s1, 'opp', '未発見'),
    ).not.toThrow();

    // 逆方向はinvariantで検出
    const s2 = produce(s1, draft => {
      draft.scratchTrace.opp = '未発見';
    });
    expect(() =>
      engine.invariant.scratchTraceMonotonic(s2, 'opp', '発見済'),
    ).toThrow(/scratchTraceMonotonic/);
  });
});
