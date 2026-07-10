// tests/cards/night-wA2/B07063 — 鈴木園子: charGrantAbility で leave:to-remove observer を付与 (validate 解禁 + granted 走査)
// production 経路: declare (action:declare emit) → a1 grant → removeToRemove(cause:'contact-ap', byUid) (leave:to-remove emit) → granted observer draw
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { declare, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { B07063 } from '@/cards/ct-p07/B07063';
import type { CardDef, GameState } from '@/engine/types';

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['白'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const ATK7000 = mkChar('ATK7000', { ap: 7000 });
const ATK6000 = mkChar('ATK6000', { ap: 6000 });
const VICTIM = mkChar('VICTIM', { ap: 1000 });
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = v; };

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry(); _resetActionContexts();
  setHuman(null);
  for (const d of [B07063, ATK7000, ATK6000, VICTIM]) registerCardDef(d);
  registerTriggeredListener();
});

function base(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.deck.push('VICTIM', 'ATK6000', 'ATK7000'); // draw 用
  return s;
}

describe('B07063 a1 — AP7000+ アクション時に leave:to-remove observer を付与 (engine 解禁)', () => {
  it('shape: a1 grants leave:to-remove observer, a2 declared', () => {
    expect(B07063.abilities[0].effect?.kind).toBe('atom');
    const grantedHook = (B07063.abilities[0].effect as { args?: { ability?: { trigger?: { hook?: string } } } }).args?.ability?.trigger?.hook;
    expect(grantedHook).toBe('leave:to-remove');
    expect(B07063.abilities[1].type).toBe('declared');
  });

  it('AP7000 攻撃 → grant 付与 → コンタクトで相手キャラ除去 → 1枚引く', () => {
    const s = base();
    mutate.scene.enter(s, 'self', 'B07063', {}); // observer
    const atk = mutate.scene.enter(s, 'self', 'ATK7000', {});
    atk.isNamed = false; mutate.scene.setState(s, atk.uid, 'active');
    const vic = mutate.scene.enter(s, 'opp', 'VICTIM', {});
    mutate.scene.setState(s, vic.uid, 'sleep'); // アクション対象は sleep/stun のみ (rules/07)

    // production: アクション宣言 (action:declare emit) → a1 grant
    declare(s, atk.uid, { kind: 'char', uid: vic.uid });
    runAllUntilEmpty(s);
    const granted = s.players.self.scene.find(c => c.uid === atk.uid)?.turnEffects?.['grantedAbilities'];
    expect(Array.isArray(granted) && granted.length).toBeTruthy();

    // production: コンタクトで victim を除去 (byUid=atk, cause=contact-ap) → granted observer draw1
    const before = s.players.self.hand.length;
    mutate.scene.removeToRemove(s, vic.uid, 'contact-ap', atk.uid);
    runAllUntilEmpty(s);
    expect(s.players.self.hand.length).toBe(before + 1);
  });

  it('AP6000 攻撃 → grant されない (apMin:7000 gate)', () => {
    const s = base();
    mutate.scene.enter(s, 'self', 'B07063', {});
    const atk = mutate.scene.enter(s, 'self', 'ATK6000', {});
    atk.isNamed = false; mutate.scene.setState(s, atk.uid, 'active');
    const vic = mutate.scene.enter(s, 'opp', 'VICTIM', {});
    mutate.scene.setState(s, vic.uid, 'sleep');
    declare(s, atk.uid, { kind: 'char', uid: vic.uid });
    runAllUntilEmpty(s);
    const granted = s.players.self.scene.find(c => c.uid === atk.uid)?.turnEffects?.['grantedAbilities'];
    expect(Array.isArray(granted) && granted.length ? granted.length : 0).toBe(0);
  });

  it('cause=effect (非コンタクト) 除去では granted observer 不発 (cause gate)', () => {
    const s = base();
    mutate.scene.enter(s, 'self', 'B07063', {});
    const atk = mutate.scene.enter(s, 'self', 'ATK7000', {});
    atk.isNamed = false; mutate.scene.setState(s, atk.uid, 'active');
    const vic = mutate.scene.enter(s, 'opp', 'VICTIM', {});
    mutate.scene.setState(s, vic.uid, 'sleep');
    declare(s, atk.uid, { kind: 'char', uid: vic.uid });
    runAllUntilEmpty(s);
    const before = s.players.self.hand.length;
    mutate.scene.removeToRemove(s, vic.uid, 'effect', atk.uid); // 非コンタクト
    runAllUntilEmpty(s);
    expect(s.players.self.hand.length).toBe(before); // cause:'contact-ap' でないので draw なし
  });
});
