// tests/cards/night-wC/B06042 — ここで会うたが百年目: charGrantAbility declared 解禁 (Wave C Task 1)
// engine gaps 検証: ① spec.type:'declared' honor (char.ts) / ② findDeclaredAbility grantedAbilities 走査
//   / ③ grantedId 独立化 (同一 host 複数付与で【ターン1】独立) / ④ validate trigger 免除 / UI+AI enum 合流。
// production 経路: event-use (effect:declared kind:'event-use') → a1 grant → useDeclaredAbility → bindPick(opp) → startContact。
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _resetActionContexts } from '@/engine/flow/action/state-machine';
import { canDeclaredAbility, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { char as readChar } from '@/engine/read/char';
import { enumerateMoves } from '@/ai/move-enumerator';
import { validateCards } from '@/engine/effect/validate';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { B06042 } from '@/cards/ct-p06/B06042';
import type { CardDef, GameState } from '@/engine/types';

const GRANTED_ID = 'b06042_granted_contact';
const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const HERO = mkChar('HERO', { ap: 5000 });
const VICTIM = mkChar('VICTIM', { ap: 1000 });
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = v; };

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry(); _resetActionContexts();
  _clearPendingEffectPickQueue();
  setHuman(null);
  for (const d of [B06042, HERO, VICTIM]) registerCardDef(d);
  registerTriggeredListener();
});

// headless: runAllUntilEmpty で await した Pattern B pick を AI heuristic で drain し remainder を進める。
function settle(s: GameState): void {
  const policy = new HeuristicPolicy();
  for (let i = 0; i < 8; i++) {
    runAllUntilEmpty(s);
    const q = (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue;
    if (!q || q.length === 0) break;
    drainAiEffectPicks(s, policy);
  }
  runAllUntilEmpty(s);
}

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck.push('VICTIM'); // hirameki draw 用
  return s;
}

// 自分の event 使用を発火 (handUseCard と同一 payload を emit)。
function fireEventUse(s: GameState, player: 'self' | 'opp' = 'self'): void {
  s.players[player].hand.push('B06042'); // on-hand scope collectCardsInPlay (emit 時のみ在手)
  event.emit(s, 'effect:declared', { kind: 'event-use', cardId: 'B06042', player }, { player, cardId: 'B06042' });
  // production: イベントは使用で手札→リムーブ (再 emit で重複発火しないよう emit 直後に除去)。
  s.players[player].hand.splice(s.players[player].hand.lastIndexOf('B06042'), 1);
  settle(s);
}
const grantedOf = (s: GameState, uid: string, side: 'self' | 'opp') =>
  (s.players[side].scene.find((c) => c.uid === uid)?.turnEffects?.['grantedAbilities'] as Array<{ id?: string; type?: string }> | undefined) ?? [];

describe('B06042 — validate / shape', () => {
  it('gap④: declared 付与を含む B06042 が validateCards を通る (trigger 免除)', () => {
    const r = validateCards([B06042]);
    expect(r.ok).toBe(true);
  });
  it('shape: a1 が charGrantAbility{ability.type:declared, effect startContact} を与える', () => {
    const step = (B06042.abilities[0].effect as { steps?: Array<{ verb?: string; args?: { ability?: { type?: string; effect?: { steps?: Array<{ verb?: string }> } } } }> }).steps ?? [];
    const grant = step.find((x) => x.verb === 'charGrantAbility');
    expect(grant?.args?.ability?.type).toBe('declared');
    const gSteps = grant?.args?.ability?.effect?.steps ?? [];
    expect(gSteps.some((x) => x.verb === 'bindPick')).toBe(true);
    expect(gSteps.some((x) => x.verb === 'startContact')).toBe(true);
  });
});

describe('B06042 a1 grant (self owner)', () => {
  it('gap①: event 使用で自現場キャラに declared ability が付与される (type:declared honor)', () => {
    const s = base();
    const hero = mutate.scene.enter(s, 'self', 'HERO', {});
    mutate.scene.setState(s, hero.uid, 'active');
    fireEventUse(s, 'self');
    const granted = grantedOf(s, hero.uid, 'self');
    expect(granted.length).toBe(1);
    expect(granted[0].id).toBe(GRANTED_ID);
    expect(granted[0].type).toBe('declared'); // gap①: 'triggered' 固定でない
    // AP+1000 も同 pick で適用済 (5000→6000)
    expect(readChar.ap(s, hero.uid)).toBe(6000);
  });

  it('gap②: canDeclaredAbility が granted declared を解決し、UI/AI enum も拾う', () => {
    const s = base();
    const hero = mutate.scene.enter(s, 'self', 'HERO', {});
    mutate.scene.setState(s, hero.uid, 'active');
    fireEventUse(s, 'self');
    expect(canDeclaredAbility(s, hero.uid, GRANTED_ID)).toBe(true);
    // AI enumerator (move-enumerator) も granted declared を列挙 (BUG-084 UI/AI 対称)
    const moves = enumerateMoves(s, 'self');
    expect(moves.some((m) => m.kind === 'declaredAbility' && (m as { uid?: string; abilityId?: string }).uid === hero.uid && (m as { abilityId?: string }).abilityId === GRANTED_ID)).toBe(true);
  });

  it('gap②+startContact: 付与宣言能力使用で相手キャラとのコンタクトが発生 (attacker=host, target=opp pick)', () => {
    const s = base();
    const hero = mutate.scene.enter(s, 'self', 'HERO', {});
    mutate.scene.setState(s, hero.uid, 'active');
    const vic = mutate.scene.enter(s, 'opp', 'VICTIM', {}); // アクティブ状態でも選べる (Q&A)
    mutate.scene.setState(s, vic.uid, 'active');
    fireEventUse(s, 'self');
    useDeclaredAbility(s, hero.uid, GRANTED_ID);
    settle(s);
    const sc = s.log.filter((l) => l.action === 'effect:startContact');
    expect(sc.length).toBe(1);
    expect(sc[0].target).toBe(vic.uid); // bindPick が opp VICTIM を選び startContact が消費
  });
});

describe('B06042 gap③ — 同一 host 複数付与で【ターン1】独立', () => {
  it('2回付与 → 2 declared (base + #1)、片方使用後も他方は使用可', () => {
    const s = base();
    const hero = mutate.scene.enter(s, 'self', 'HERO', {});
    mutate.scene.setState(s, hero.uid, 'active');
    fireEventUse(s, 'self');
    // 手札使用フラグをリセットして2回目の event 使用を再現 (公式Q&A: 同キャラ2回付与で2回使える)
    mutate.scene.enter(s, 'opp', 'VICTIM', {}); // 対象確保 (grant 自体には不要だが盤面整合)
    fireEventUse(s, 'self');
    const granted = grantedOf(s, hero.uid, 'self');
    expect(granted.length).toBe(2);
    const ids = granted.map((g) => g.id).sort();
    expect(ids).toEqual([GRANTED_ID, `${GRANTED_ID}#1`]);
    // 両方 canDeclaredAbility true
    expect(canDeclaredAbility(s, hero.uid, GRANTED_ID)).toBe(true);
    expect(canDeclaredAbility(s, hero.uid, `${GRANTED_ID}#1`)).toBe(true);
    // base を1回使用 → base は【ターン1】消化、#1 は独立して使用可
    useDeclaredAbility(s, hero.uid, GRANTED_ID);
    settle(s);
    expect(canDeclaredAbility(s, hero.uid, GRANTED_ID)).toBe(false);
    expect(canDeclaredAbility(s, hero.uid, `${GRANTED_ID}#1`)).toBe(true);
  });
});

describe('B06042 — owner=opp pin', () => {
  it('opp host の付与宣言能力: side:opp が self 現場の victim を選び startContact', () => {
    const s = base();
    const hero = mutate.scene.enter(s, 'opp', 'HERO', {});
    mutate.scene.setState(s, hero.uid, 'active');
    const vic = mutate.scene.enter(s, 'self', 'VICTIM', {});
    mutate.scene.setState(s, vic.uid, 'sleep');
    fireEventUse(s, 'opp'); // opp が event 使用 → opp HERO に付与
    const granted = grantedOf(s, hero.uid, 'opp');
    expect(granted.length).toBe(1);
    expect(granted[0].type).toBe('declared');
    expect(canDeclaredAbility(s, hero.uid, GRANTED_ID)).toBe(true);
    useDeclaredAbility(s, hero.uid, GRANTED_ID);
    settle(s);
    const sc = s.log.filter((l) => l.action === 'effect:startContact');
    expect(sc.length).toBe(1);
    expect(sc[0].target).toBe(vic.uid); // opp owner から見た side:'opp' = self 現場
  });
});
