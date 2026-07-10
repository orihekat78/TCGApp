// tests/cards/night-w0/B05052 — 工藤優作 (夜間 W0 cost-choice #2 + removeSetCard anyFace probe)
//   a1: 【絆工藤有希子】【自分ターン中】AP+3000 + 突撃 (continuous)。
//   a2: 【絆工藤新一】【宣言】【ターン1】cost choice (hand / set-card anyFace) → remove から Lv3以下 0-1 登場。
//   検証点: bond 成立/不成立 / anyFace (表向きセットで支払可 — 従来 facedown 限定との差分) /
//           costChoice branch / levelMax+kind filter decoy / 【ターン1】 / owner=opp pin。
// production dispatch 経由。rules: 13 (絆/突撃) / 15 / 16 / 17 / 19 (下限) / 21
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _drainPendingEffectPickSide, _clearPendingEffectPickQueue } from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { canDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { canPay } from '@/engine/cost/evaluate';
import { char as charRead } from '@/engine/read/char';
import { B05052 } from '@/cards/ct-p05/B05052';
import type { CardDef, EffectCtx, GameState } from '@/engine/types';

function mkChar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
const EV: CardDef = { id: 'EV1', no: 'EV1', kind: 'event', names: ['イベント'], colors: ['白'], level: 2, ap: 0, lp: 0, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
const FIXTURES: CardDef[] = [
  B05052, EV,
  mkChar('YUKIKO', { names: ['工藤有希子'] }),
  mkChar('SHINICHI', { names: ['工藤新一'] }),
  mkChar('LV3', { level: 3 }), mkChar('LV4', { level: 4 }),
  mkChar('H1'), mkChar('SETA', { level: 5 }), // SETA は cost 支払後 remove に落ちる → Lv5 で filter 決定的に除外

];

type G = { __humanPlayerSide?: 'self' | 'opp' | null };
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as G).__humanPlayerSide = v; };

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  resetDefRegistry();
  _resetTriggeredRegistered();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  for (const d of FIXTURES) registerCardDef(d);
  registerTriggeredListener();
  setHuman('self');
});

describe('B05052 a1 — 絆工藤有希子 + 自ターン: AP+3000 + 突撃', () => {
  it('絆成立 (自ターン) → AP 6000 + 突撃 / 有希子不在 → 素 AP・突撃なし / 相手ターン → 失効', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'B05052', {});
    expect(charRead.ap(s, me.uid), '絆不成立 → 素 AP').toBe(3000);
    expect(charRead.keywords(s, me.uid), '突撃なし').not.toContain('突撃');
    mutate.scene.enter(s, 'self', 'YUKIKO', {});
    expect(charRead.ap(s, me.uid), '絆成立 → AP+3000').toBe(6000);
    expect(charRead.keywords(s, me.uid), '突撃付与').toContain('突撃');
    s.turn.player = 'opp';
    expect(charRead.ap(s, me.uid), '相手ターン → 失効 (常時有効型 rules/24)').toBe(3000);
  });
});

describe('B05052 a2 — cost choice (hand / set-card anyFace) → remove から Lv3以下登場', () => {
  function setup(s: GameState) {
    const me = mutate.scene.enter(s, 'self', 'B05052', {});
    mutate.scene.enter(s, 'self', 'SHINICHI', {});
    s.players.self.remove = ['LV3', 'LV4', 'EV1'];
    return me.uid;
  }
  const mkCtx = (uid: string): EffectCtx =>
    ({ source: { cardId: 'B05052', uid, abilityId: 'a2', player: 'self', area: 'scene' }, bindings: {} }) as EffectCtx;

  it('costChoice=1 (set-card branch): 表向きセットカードでも支払可 (anyFace) → Lv3 のみ候補 → 登場', () => {
    const s = base();
    const me = setup(s);
    const host = s.players.self.scene.find((c) => c.uid === me)!;
    host.setCards = [{ cardId: 'SETA', faceUp: true }]; // 表向き — anyFace:true で支払可
    const cost = B05052.abilities[1]!.cost!;
    expect(canPay(s, cost, mkCtx(me)), '表向きセットのみでも choice 支払可 (anyFace)').toBe(true);
    activateDeclaredAbility(s, me, 'a2', { costChoice: 1 });
    runAllUntilEmpty(s);
    expect(host.setCards.length, '表向きセットが消費された').toBe(0);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'sceneEnter pick surface').toBeTruthy();
    expect(pick!.nMin, '「1枚まで」= 0 可').toBe(0);
    const cands = pick!.candidates as Array<{ cardId: string; uid: string }>;
    // 注: cost で除去した SETA も remove に落ちるが Lv5 で filter 除外 (levelMax:3 decoy を兼ねる)
    expect(cands.map((c) => c.cardId), '候補 = Lv3 のみ (Lv4/Lv5/イベント除外)').toEqual(['LV3']);
    const lv3 = cands[0]!;
    applyPickAndContinuation(s, pick!, lv3.uid, [lv3.uid]);
    runAllUntilEmpty(s);
    expect(s.players.self.scene.some((c) => c.cardId === 'LV3'), 'LV3 登場').toBe(true);
    expect(s.players.self.remove).not.toContain('LV3');
  });

  it('costChoice=0 (hand branch): 手札1枚リムーブ、セット不変 + 【ターン1】', () => {
    const s = base();
    const me = setup(s);
    const host = s.players.self.scene.find((c) => c.uid === me)!;
    host.setCards = [{ cardId: 'SETA', faceUp: false }];
    s.players.self.hand = ['H1'];
    activateDeclaredAbility(s, me, 'a2', { costChoice: 0 });
    runAllUntilEmpty(s);
    expect(s.players.self.hand.length, '手札消費').toBe(0);
    expect(host.setCards.length, 'セット不変').toBe(1);
    _drainPendingEffectPickSide(); // sceneEnter pick は未解決のまま破棄 (limit 検証には影響しない)
    expect(canDeclaredAbility(s, me, 'a2'), '【ターン1】消費済').toBe(false);
  });

  it('絆工藤新一 不成立 → 宣言不可 (condition bond)', () => {
    const s = base();
    const me = mutate.scene.enter(s, 'self', 'B05052', {});
    s.players.self.hand = ['H1'];
    s.players.self.remove = ['LV3'];
    expect(canDeclaredAbility(s, me.uid, 'a2'), '新一不在 → 宣言不可').toBe(false);
    mutate.scene.enter(s, 'self', 'SHINICHI', {});
    expect(canDeclaredAbility(s, me.uid, 'a2'), '新一登場 → 宣言可').toBe(true);
  });

  it('owner=opp pin (BUG-174): opp 所有 B05052 の a2 — opp 手札コスト + opp remove から登場', () => {
    const s = base();
    s.turn.player = 'opp';
    const me = mutate.scene.enter(s, 'opp', 'B05052', {});
    mutate.scene.enter(s, 'opp', 'SHINICHI', {});
    s.players.opp.hand = ['H1'];
    s.players.opp.remove = ['LV3'];
    setHuman('opp'); // BUG-174 pin: human 側 = opp で pick surface 座標を検証
    activateDeclaredAbility(s, me.uid, 'a2', { costChoice: 0 });
    runAllUntilEmpty(s);
    expect(s.players.opp.hand.length, 'opp 手札からコスト').toBe(0);
    const pick = _drainPendingEffectPickSide();
    expect(pick, 'sceneEnter pick surface (owner=opp 座標)').toBeTruthy();
    expect(pick!.player, 'pick 所有 = opp').toBe('opp');
    const lv3 = (pick!.candidates as Array<{ cardId: string; uid: string }>).find((c) => c.cardId === 'LV3')!;
    applyPickAndContinuation(s, pick!, lv3.uid, [lv3.uid]);
    runAllUntilEmpty(s);
    expect(s.players.opp.scene.some((c) => c.cardId === 'LV3'), 'opp remove から opp 現場へ登場').toBe(true);
    expect(s.players.self.scene.some((c) => c.cardId === 'LV3'), 'self 側に登場していない').toBe(false);
  });
});
