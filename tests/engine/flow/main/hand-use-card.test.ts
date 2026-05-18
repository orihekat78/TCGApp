// Phase 4 Task 4.3 — flow.main.handUseCard
// rules: 05-turn-phases.md, 12-next-hint.md, 20-color-and-switch.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { canHandUseCard, canHandUseCardSwitch, handUseCard } from '@/engine/flow/main/hand-use-card';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import type { CardDef, GameState } from '@/engine/types';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: opts.kind ?? 'event',
    names: opts.names ?? [id],
    colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    traits: opts.traits ?? [],
    rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '',
    abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

function makeState(opts: { caseColors?: string[]; fileCount?: number; hand?: string[] } = {}): GameState {
  const initial = createEmptyGameState();
  return produce(initial, draft => {
    draft.players.self.case.colors = opts.caseColors ?? ['赤'];
    draft.players.self.case.cardId = 'CASE-SELF';
    // FILE 枚数
    for (let i = 0; i < (opts.fileCount ?? 5); i++) {
      draft.players.self.file.push({ type: 'card-back' });
    }
    draft.players.self.hand = opts.hand ?? [];
  });
}

describe('engine.flow.main.handUseCard', () => {
  beforeEach(() => {
    event._resetRegistry();
    resetDefRegistry();
  });

  it('手札にあり / flags ok / 色一致 / レベル ≤ FILE → 使用可', () => {
    registerCardDef(makeCard('EV1', { colors: ['赤'], level: 1 }));
    const s = makeState({ caseColors: ['赤'], fileCount: 3, hand: ['EV1'] });
    expect(canHandUseCard(s, 'self', 'EV1')).toBe(true);
  });

  it('手札にない → false', () => {
    registerCardDef(makeCard('EV1'));
    const s = makeState({ hand: [] });
    expect(canHandUseCard(s, 'self', 'EV1')).toBe(false);
  });

  it('handUseUsed=true → false', () => {
    registerCardDef(makeCard('EV1', { colors: ['赤'], level: 1 }));
    const s = produce(makeState({ caseColors: ['赤'], hand: ['EV1'] }), draft => {
      draft.turnState.self.handUseUsed = true;
    });
    expect(canHandUseCard(s, 'self', 'EV1')).toBe(false);
  });

  it('nextHintUsed=true (同ターン) → false (rules/05)', () => {
    registerCardDef(makeCard('EV1', { colors: ['赤'], level: 1 }));
    const s = produce(makeState({ caseColors: ['赤'], hand: ['EV1'] }), draft => {
      draft.turnState.self.nextHintUsed = true;
    });
    expect(canHandUseCard(s, 'self', 'EV1')).toBe(false);
  });

  it('色不一致 → false (rules/20)', () => {
    registerCardDef(makeCard('EV1', { colors: ['青'], level: 1 }));
    const s = makeState({ caseColors: ['赤'], hand: ['EV1'] });
    expect(canHandUseCard(s, 'self', 'EV1')).toBe(false);
  });

  it('レベル > FILE → false (rules/12)', () => {
    registerCardDef(makeCard('EV1', { colors: ['赤'], level: 5 }));
    const s = makeState({ caseColors: ['赤'], fileCount: 3, hand: ['EV1'] });
    expect(canHandUseCard(s, 'self', 'EV1')).toBe(false);
  });

  it('handUseCard 実行で handUseUsed=true になる', () => {
    registerCardDef(makeCard('EV1', { colors: ['赤'], level: 1 }));
    const s = makeState({ caseColors: ['赤'], hand: ['EV1'] });
    const after = produce(s, draft => {
      handUseCard(draft, 'self', 'EV1');
    });
    expect(after.turnState.self.handUseUsed).toBe(true);
  });

  it('handUseCard 実行で effect:declared が emit される', () => {
    registerCardDef(makeCard('EV1', { colors: ['赤'], level: 1 }));
    let fired = false;
    event.on('effect:declared', (_s, payload) => {
      const p = payload as { kind?: string } | undefined;
      // Round 4b: kind は 'event-use' / 'character-use' に分離 (eventRemoveByAP matcher 整合)
      if (p && (p.kind === 'event-use' || p.kind === 'character-use')) fired = true;
    });
    const s = makeState({ caseColors: ['赤'], hand: ['EV1'] });
    produce(s, draft => {
      handUseCard(draft, 'self', 'EV1');
    });
    expect(fired).toBe(true);
  });

  it('canHandUseCard=false 状態で handUseCard を呼ぶと throw', () => {
    const s = makeState({ hand: [] });
    expect(() =>
      produce(s, draft => {
        handUseCard(draft, 'self', 'NONEXISTENT');
      }),
    ).toThrow(/not allowed/);
  });

  // CardDef 未登録なら寛容に true を返す (Phase 5 で TSV 登録時に強制される設計)
  it('CardDef 未登録カードは色・レベル制限なし扱い (Phase 4 寛容モード)', () => {
    const s = makeState({ caseColors: ['赤'], fileCount: 0, hand: ['UNREG'] });
    expect(canHandUseCard(s, 'self', 'UNREG')).toBe(true);
  });

  // ---- rules/20 §スイッチ (Phase 5 advance) ----

  function fillScene(state: GameState, count: number): GameState {
    return produce(state, draft => {
      for (let i = 0; i < count; i++) {
        draft.players.self.scene.push({
          cardId: `SC${i}`,
          uid: `self-uid-${i}`,
          state: 'active',
          isNamed: false,
          enterOrder: i,
          setCards: [],
          stackedCards: 0,
          keywordOverrides: { granted: [], disabledOriginal: false },
          apOverride: null,
          lpOverride: null,
          turnEffects: { contactImmune: false, removeOnTurnEnd: false },
          declaredUseCount: {},
        });
      }
    });
  }

  it('canHandUseCardSwitch: scene < 5 で false (通常 handUseCard 経路)', () => {
    registerCardDef(makeCard('CH1', { kind: 'character', colors: ['赤'], level: 1 }));
    const s = fillScene(makeState({ caseColors: ['赤'], hand: ['CH1'] }), 4);
    expect(canHandUseCardSwitch(s, 'self', 'CH1')).toBe(false);
    expect(canHandUseCard(s, 'self', 'CH1')).toBe(true);
  });

  it('canHandUseCardSwitch: scene = 5 + character → true、通常 canHandUseCard は false', () => {
    registerCardDef(makeCard('CH1', { kind: 'character', colors: ['赤'], level: 1 }));
    const s = fillScene(makeState({ caseColors: ['赤'], hand: ['CH1'] }), 5);
    expect(canHandUseCardSwitch(s, 'self', 'CH1')).toBe(true);
    expect(canHandUseCard(s, 'self', 'CH1')).toBe(false);
  });

  it('canHandUseCardSwitch: イベントカードは scene 5 でも false (キャラ限定)', () => {
    registerCardDef(makeCard('EV1', { kind: 'event', colors: ['赤'], level: 1 }));
    const s = fillScene(makeState({ caseColors: ['赤'], hand: ['EV1'] }), 5);
    expect(canHandUseCardSwitch(s, 'self', 'EV1')).toBe(false);
  });

  it('canHandUseCardSwitch: handUseUsed=true なら false (通常経路と共通ゲート)', () => {
    registerCardDef(makeCard('CH1', { kind: 'character', colors: ['赤'], level: 1 }));
    const base = fillScene(makeState({ caseColors: ['赤'], hand: ['CH1'] }), 5);
    const s = produce(base, draft => {
      draft.turnState.self.handUseUsed = true;
    });
    expect(canHandUseCardSwitch(s, 'self', 'CH1')).toBe(false);
  });

  it('handUseCard with switchRemoveUid: 既存キャラリムーブ + 新キャラ登場、scene=5 維持', () => {
    registerCardDef(makeCard('CH1', { kind: 'character', colors: ['赤'], level: 1 }));
    const base = fillScene(makeState({ caseColors: ['赤'], hand: ['CH1'] }), 5);
    const targetUid = base.players.self.scene[2].uid;
    const after = produce(base, draft => {
      handUseCard(draft, 'self', 'CH1', undefined, targetUid);
    });
    expect(after.players.self.scene.length).toBe(5);
    expect(after.players.self.scene.find(c => c.uid === targetUid)).toBeUndefined();
    // 新キャラは末尾に追加 (新規 uid + isNamed=true、rules/05 同ターン登場)
    const newChar = after.players.self.scene.find(c => c.cardId === 'CH1');
    expect(newChar).toBeDefined();
    expect(newChar?.isNamed).toBe(true);
    // 手札から消費
    expect(after.players.self.hand.includes('CH1')).toBe(false);
    // フラグも立つ
    expect(after.turnState.self.handUseUsed).toBe(true);
  });

  it('handUseCard with switchRemoveUid: scene<5 で呼ぶと throw (switch 不可)', () => {
    registerCardDef(makeCard('CH1', { kind: 'character', colors: ['赤'], level: 1 }));
    const base = fillScene(makeState({ caseColors: ['赤'], hand: ['CH1'] }), 4);
    expect(() =>
      produce(base, draft => {
        handUseCard(draft, 'self', 'CH1', undefined, base.players.self.scene[0].uid);
      }),
    ).toThrow(/switch not allowed/);
  });

  it('handUseCard switch: enter hook が viaEffect=false で emit される', () => {
    registerCardDef(makeCard('CH1', { kind: 'character', colors: ['赤'], level: 1 }));
    let emitted: { uid: string; viaEffect: boolean } | null = null;
    event.on('enter', (_s, payload) => {
      const p = payload as { uid: string; viaEffect: boolean } | undefined;
      if (p) emitted = { uid: p.uid, viaEffect: p.viaEffect };
    });
    const base = fillScene(makeState({ caseColors: ['赤'], hand: ['CH1'] }), 5);
    produce(base, draft => {
      handUseCard(draft, 'self', 'CH1', undefined, base.players.self.scene[0].uid);
    });
    expect(emitted).not.toBeNull();
    expect(emitted!.viaEffect).toBe(false);
  });

  // void unused
  void mutate;
});
