// engine拡張 wave — removedCharMatches.removedFilter (離場キャラ自身の属性で gate する observer)
// spec: .claude/specs/engine-removed-char-filter-design.md
//
// cluster15 removedCharMatches は side/cause/by (除去キャラの所属側 / 除去原因 / 除去者) しか gate できず、
// 「自分の現場にいる【赤】のキャラがリムーブされたとき」「レベル6以上の〚警察〛がリムーブされたとき」のように
// **離場キャラ自身の色/特徴/レベル/状態** で絞る observer (B01075/B01089/B03092/B05059/B07096) は表現不能だった。
// 本 wave は payload に離場キャラ snapshot (removedChar) を additive 付与し、removedFilter?: TargetFilter で判定する。
//
// 検証: color / trait+level / **effective-level via snapshot** / state / side gate / self-leave 経路、全て decoy 同梱 1対1。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { registerAll } from '@/cards/index';
import { B01075 } from '@/cards/ct-p01/B01075';
import { B01089 } from '@/cards/ct-p01/B01089';
import type { GameState, CardDef, AbilityDef, TargetFilter } from '@/engine/types';

// observer (= source.uid) の leave:to-remove triggered effect が queue されたか
function observerFired(after: GameState, observerUid: string): boolean {
  return after.pendingEffects.some(
    (pe) => pe.triggeredBy?.hook === 'leave:to-remove' && pe.source?.uid === observerUid,
  );
}
function defOf(o: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: o.id, no: o.id, kind: 'character', names: o.names ?? [o.id], colors: o.colors ?? ['赤'],
    level: o.level ?? 1, ap: o.ap ?? 1000, lp: o.lp ?? 1000, traits: o.traits ?? [],
    rarity: 'C', imageUrl: '', abilities: o.abilities ?? [], ruleRefs: [], ...o,
  };
}
// removedFilter / removedState を持つ observer ability を作る
function obsAbility(
  removedFilter: TargetFilter,
  side: 'self' | 'opp' = 'self',
  removedState?: ('active' | 'sleep' | 'stun')[],
): AbilityDef {
  return {
    id: 'a1', type: 'triggered', scope: 'on-scene',
    trigger: { hook: 'leave:to-remove' },
    condition: { kind: 'removedCharMatches', side, removedFilter, removedState },
    effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } },
    description: '離場キャラ filter observer',
    ruleRefs: [],
  };
}
function reset() {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
}

// ---- W1: color filter (B01075/B01089 shape) ----
describe('removedFilter — color (自分の現場の【赤】がリムーブされたとき)', () => {
  beforeEach(() => {
    reset();
    registerCardDef(defOf({ id: 'OBS', colors: ['赤'], abilities: [obsAbility({ color: '赤' })] }));
    registerCardDef(defOf({ id: 'RED', colors: ['赤'] }));
    registerCardDef(defOf({ id: 'YEL', colors: ['黄'] }));
    registerTriggeredListener();
  });
  it('自分の【赤】キャラが除去 → 発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'RED', {});
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(true);
  });
  it('自分の【黄】キャラが除去 (色 decoy) → 非発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'YEL', {});
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(false);
  });
});

// ---- W2: trait + level (B03092: レベル6以上の〚警察〛) ----
describe('removedFilter — trait + levelMin (レベル6以上の〚警察〛がリムーブされたとき)', () => {
  beforeEach(() => {
    reset();
    registerCardDef(defOf({ id: 'OBS', abilities: [obsAbility({ trait: '警察', levelMin: 6 })] }));
    registerCardDef(defOf({ id: 'POL6', level: 6, traits: ['警察'] }));
    registerCardDef(defOf({ id: 'POL5', level: 5, traits: ['警察'] }));
    registerCardDef(defOf({ id: 'DET6', level: 6, traits: ['探偵'] }));
    registerTriggeredListener();
  });
  it('Lv6 警察 除去 → 発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'POL6', {});
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(true);
  });
  it('Lv5 警察 除去 (level decoy) → 非発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'POL5', {});
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(false);
  });
  it('Lv6 探偵 除去 (trait decoy) → 非発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'DET6', {});
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(false);
  });
});

// ---- W3: effective-level via snapshot (rules/19 — 修正後レベルで判定) ----
describe('removedFilter — effective level via snapshot (buff/debuff 後のレベルで判定)', () => {
  beforeEach(() => {
    reset();
    registerCardDef(defOf({ id: 'OBS', abilities: [obsAbility({ trait: '警察', levelMin: 6 })] }));
    registerCardDef(defOf({ id: 'POL5', level: 5, traits: ['警察'] }));
    registerCardDef(defOf({ id: 'POL6', level: 6, traits: ['警察'] }));
    registerTriggeredListener();
  });
  it('base Lv5 警察 を +1 buff → 除去 → effective Lv6 ゆえ発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'POL5', {});
      mutate.char.modifyLevel(d, v.uid, 1, 'permanent');
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(true);
  });
  it('base Lv6 警察 を -1 debuff → 除去 → effective Lv5 ゆえ非発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'POL6', {});
      mutate.char.modifyLevel(d, v.uid, -1, 'permanent');
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(false);
  });
});

// ---- W4: state filter (B05059: スリープ状態の〚探偵〛) ----
describe('removedFilter — state (スリープ状態の〚探偵〛がリムーブされたとき)', () => {
  beforeEach(() => {
    reset();
    registerCardDef(defOf({ id: 'OBS', traits: ['探偵'], abilities: [obsAbility({ trait: '探偵' }, 'self', ['sleep'])] }));
    registerCardDef(defOf({ id: 'DET', traits: ['探偵'] }));
    registerCardDef(defOf({ id: 'POL', traits: ['警察'] }));
    registerTriggeredListener();
  });
  it('スリープ状態の探偵 除去 → 発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'DET', {});
      mutate.scene.setState(d, v.uid, 'sleep');
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(true);
  });
  it('アクティブ状態の探偵 除去 (state decoy) → 非発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'DET', {}); // active
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(false);
  });
  it('スリープ状態の警察 除去 (trait decoy) → 非発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'POL', {});
      mutate.scene.setState(d, v.uid, 'sleep');
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(false);
  });
});

// ---- W5: side gate (B07096: 相手の現場のレベル4以下) ----
describe('removedFilter — side:opp + levelMax (相手のレベル4以下がリムーブされたとき)', () => {
  beforeEach(() => {
    reset();
    registerCardDef(defOf({ id: 'OBS', colors: ['黒'], abilities: [obsAbility({ levelMax: 4 }, 'opp')] }));
    registerCardDef(defOf({ id: 'LV4', level: 4 }));
    registerCardDef(defOf({ id: 'LV5', level: 5 }));
    registerTriggeredListener();
  });
  it('相手の Lv4 キャラ除去 → 発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'LV4', {});
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(true);
  });
  it('自分の Lv4 キャラ除去 (side decoy) → 非発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'LV4', {});
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(false);
  });
  it('相手の Lv5 キャラ除去 (level decoy) → 非発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      obs = mutate.scene.enter(d, 'self', 'OBS', {}).uid;
      const v = mutate.scene.enter(d, 'opp', 'LV5', {});
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(false);
  });
});

// ---- W6: self-leave 経路も removedChar snapshot を運ぶ (「このキャラか…」自己包含) ----
describe('removedFilter — self-leave path (observer 自身がリムーブ、handleLeaveToRemoveSelf 経路)', () => {
  beforeEach(() => {
    reset();
    registerCardDef(defOf({ id: 'OBS', colors: ['赤'], abilities: [obsAbility({ color: '赤' })] }));
    registerTriggeredListener();
  });
  it('observer 自身 (赤) が除去 → removedFilter{color:赤} に self-snapshot が一致 → 発火', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      const o = mutate.scene.enter(d, 'self', 'OBS', {}); obs = o.uid;
      mutate.scene.removeToRemove(d, o.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(true);
  });
});

// ---- Block B: 実出荷カード (B01075/B01089/B03092・P/B05059・P) integration ----
// 全 a1 = 【相手ターン中】ゆえ turn.player='opp' で駆動。decoy 1対1 + turn-gate decoy 同梱。
describe('実出荷カード — removedFilter observer (相手ターン中駆動)', () => {
  beforeEach(() => {
    reset();
    registerAll();
    // synthetic victims (registerAll に上書き追加、ability 無し)
    registerCardDef(defOf({ id: 'RED', colors: ['赤'] }));
    registerCardDef(defOf({ id: 'YEL', colors: ['黄'] }));
    registerCardDef(defOf({ id: 'POL6', level: 6, traits: ['警察'] }));
    registerCardDef(defOf({ id: 'POL5', level: 5, traits: ['警察'] }));
    registerCardDef(defOf({ id: 'DET', traits: ['探偵'] }));
    registerTriggeredListener();
  });
  function runOppTurn(observerId: string, setup: (d: GameState, obsUid: string) => void): { fired: boolean } {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'opp';
      obs = mutate.scene.enter(d, 'self', observerId, {}).uid;
      setup(d, obs);
    });
    return { fired: observerFired(a, obs) };
  }

  it('B01075 宮野明美: 自分の【赤】除去で発火 / 【黄】decoy 非発火', () => {
    expect(runOppTurn('B01075', (d) => { const v = mutate.scene.enter(d, 'self', 'RED', {}); mutate.scene.removeToRemove(d, v.uid, 'effect'); }).fired).toBe(true);
    expect(runOppTurn('B01075', (d) => { const v = mutate.scene.enter(d, 'self', 'YEL', {}); mutate.scene.removeToRemove(d, v.uid, 'effect'); }).fired).toBe(false);
  });
  it('B01075: 自分ターン中は 【相手ターン中】gate で非発火 (turn decoy)', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      obs = mutate.scene.enter(d, 'self', 'B01075', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'RED', {});
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(false);
  });
  it('B01075: 相手の【赤】除去では side:self gate で非発火 (opp-side decoy)', () => {
    expect(runOppTurn('B01075', (d) => { const v = mutate.scene.enter(d, 'opp', 'RED', {}); mutate.scene.removeToRemove(d, v.uid, 'effect'); }).fired).toBe(false);
  });
  it('B01089 佐藤美和子: 自分の【黄】除去で発火 / 【赤】decoy 非発火', () => {
    expect(runOppTurn('B01089', (d) => { const v = mutate.scene.enter(d, 'self', 'YEL', {}); mutate.scene.removeToRemove(d, v.uid, 'effect'); }).fired).toBe(true);
    expect(runOppTurn('B01089', (d) => { const v = mutate.scene.enter(d, 'self', 'RED', {}); mutate.scene.removeToRemove(d, v.uid, 'effect'); }).fired).toBe(false);
  });
  it('B01089: 自分ターン中は 【相手ターン中】gate で非発火 (turn decoy)', () => {
    let obs = '';
    const a = produce(createEmptyGameState(), (d) => {
      d.turn.player = 'self';
      obs = mutate.scene.enter(d, 'self', 'B01089', {}).uid;
      const v = mutate.scene.enter(d, 'self', 'YEL', {});
      mutate.scene.removeToRemove(d, v.uid, 'effect');
    });
    expect(observerFired(a, obs)).toBe(false);
  });
  it('B03092 高木渉: Lv6警察除去で発火 / Lv5警察 decoy 非発火', () => {
    expect(runOppTurn('B03092', (d) => { const v = mutate.scene.enter(d, 'self', 'POL6', {}); mutate.scene.removeToRemove(d, v.uid, 'effect'); }).fired).toBe(true);
    expect(runOppTurn('B03092', (d) => { const v = mutate.scene.enter(d, 'self', 'POL5', {}); mutate.scene.removeToRemove(d, v.uid, 'effect'); }).fired).toBe(false);
  });
  it('B03092P: Lv6警察除去で発火 (P=base 等価)', () => {
    expect(runOppTurn('B03092P', (d) => { const v = mutate.scene.enter(d, 'self', 'POL6', {}); mutate.scene.removeToRemove(d, v.uid, 'effect'); }).fired).toBe(true);
  });
  it('B05059 白馬探: スリープ探偵除去で発火 / アクティブ探偵 decoy 非発火', () => {
    expect(runOppTurn('B05059', (d) => { const v = mutate.scene.enter(d, 'self', 'DET', {}); mutate.scene.setState(d, v.uid, 'sleep'); mutate.scene.removeToRemove(d, v.uid, 'effect'); }).fired).toBe(true);
    expect(runOppTurn('B05059', (d) => { const v = mutate.scene.enter(d, 'self', 'DET', {}); mutate.scene.removeToRemove(d, v.uid, 'effect'); }).fired).toBe(false);
  });
  it('B05059P: スリープ探偵除去で発火 (P=base 等価)', () => {
    expect(runOppTurn('B05059P', (d) => { const v = mutate.scene.enter(d, 'self', 'DET', {}); mutate.scene.setState(d, v.uid, 'sleep'); mutate.scene.removeToRemove(d, v.uid, 'effect'); }).fired).toBe(true);
  });
});

// ---- Block C: 印字された【ヒラメキ】a2 の存在検証 (review BLOCKER 回帰 — col12 hirameki 漏れ防止) ----
// B01075/B01089 は a1(removedFilter observer) に加え【ヒラメキ】(evidence:remove-by-action) を印字で持つ。
// 当初実装は a1 のみで a2 を欠落 (敵対 review BLOCKER) → 本ブロックで a2 構造を pin。
describe('印字【ヒラメキ】a2 (evidence:remove-by-action) — col12 hirameki 漏れ回帰防止', () => {
  it('B01075 a2: 【ヒラメキ】カードを1枚引く (evidence:remove-by-action optional)', () => {
    const a2 = B01075.abilities[1] as AbilityDef;
    expect(B01075.abilities.length).toBe(2);
    expect(a2.type).toBe('triggered');
    expect(a2.scope).toBe('on-evidence');
    expect(a2.trigger?.hook).toBe('evidence:remove-by-action');
    expect(a2.trigger?.optional).toBe(true);
    expect(JSON.stringify(a2.effect)).toContain('"verb":"draw"');
  });
  it('B01089 a2: 【ヒラメキ】キャラを1枚まで選びスリープ (evidence:remove-by-action optional)', () => {
    const a2 = B01089.abilities[1] as AbilityDef;
    expect(B01089.abilities.length).toBe(2);
    expect(a2.type).toBe('triggered');
    expect(a2.scope).toBe('on-evidence');
    expect(a2.trigger?.hook).toBe('evidence:remove-by-action');
    expect(a2.trigger?.optional).toBe(true);
    expect(JSON.stringify(a2.effect)).toContain('"state":"sleep"');
  });
});
