// tests/cards/night-wA2/B03041 — 直球勝負: 攻撃側 forceGuard token (mustGuardCandidates が honor) + on-set-host contact AP
import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate/index';
import { event } from '@/engine/event/index';
import { read } from '@/engine/read/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { declare, tryGuard, passGuard, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { mustGuardCandidates } from '@/engine/flow/guard';
import { B03041 } from '@/cards/ct-p03/B03041';
import type { CardDef, GameState } from '@/engine/types';

const mkChar = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const HOST = mkChar('HOST', { colors: ['緑'], ap: 5000 });
const TGT = mkChar('TGT', { ap: 1000 });
const GUARD = mkChar('GUARD', { ap: 2000 });
const setHuman = (v: 'self' | 'opp' | null) => { (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = v; };

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry(); _resetActionContexts();
  setHuman(null);
  for (const d of [B03041, HOST, TGT, GUARD]) registerCardDef(d);
  registerTriggeredListener();
});

describe('B03041 — 攻撃側 forceGuard token', () => {
  it('shape: a2 = on-set-host continuous grantKeywords text:forceGuard / a3 = contact:start AP+2000', () => {
    expect(B03041.abilities[0].effect?.kind).toBe('atom'); // charSetCard fromSelf
    expect(B03041.abilities[1].type).toBe('continuous');
    expect(B03041.abilities[1].scope).toBe('on-set-host');
    expect((B03041.abilities[1].continuousModifier as { grantKeywords?: () => string[] }).grantKeywords?.()).toEqual(['text:forceGuard']);
    expect(B03041.abilities[2].trigger?.hook).toBe('contact:start');
  });

  it('host に B03041 を faceUp セット → hasTextAbility forceGuard true (on-set-host grantKeywords 経由)', () => {
    const s = createEmptyGameState();
    const host = mutate.scene.enter(s, 'self', 'HOST', {});
    mutate.char.setCard(s, host.uid, 'B03041', true);
    expect(read.char.hasTextAbility(s, host.uid, 'forceGuard')).toBe(true);
  });

  it('攻撃側 host が forceGuard → 相手の legal 候補が全て義務化 → passGuard throw', () => {
    const s = createEmptyGameState();
    s.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    const host = mutate.scene.enter(s, 'self', 'HOST', {}); host.isNamed = false; mutate.scene.setState(s, host.uid, 'active');
    mutate.char.setCard(s, host.uid, 'B03041', true);
    const tgt = mutate.scene.enter(s, 'opp', 'TGT', {}); mutate.scene.setState(s, tgt.uid, 'sleep');
    const g = mutate.scene.enter(s, 'opp', 'GUARD', {}); mutate.scene.setState(s, g.uid, 'active');
    // 攻撃側 forceGuard → 防御 GUARD が義務化
    expect(mustGuardCandidates(s, host.uid, tgt.uid).map(c => c.uid)).toContain(g.uid);
    const ax = declare(s, host.uid, { kind: 'char', uid: tgt.uid });
    expect(() => passGuard(s, ax)).toThrow(/mustGuard/);
    expect(() => tryGuard(s, ax, g.uid)).not.toThrow();
  });

  it('forceGuard 無し (素の host) → passGuard は従来どおり成立 (byte 等価)', () => {
    const s = createEmptyGameState();
    s.turn = { number: 4, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    const host = mutate.scene.enter(s, 'self', 'HOST', {}); host.isNamed = false; mutate.scene.setState(s, host.uid, 'active');
    const tgt = mutate.scene.enter(s, 'opp', 'TGT', {}); mutate.scene.setState(s, tgt.uid, 'sleep');
    mutate.scene.enter(s, 'opp', 'GUARD', {});
    const ax = declare(s, host.uid, { kind: 'char', uid: tgt.uid });
    expect(() => passGuard(s, ax)).not.toThrow();
  });

  it('owner=opp pin: opp host の forceGuard → self が義務化', () => {
    const s = createEmptyGameState();
    s.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
    const host = mutate.scene.enter(s, 'opp', 'HOST', {}); host.isNamed = false; mutate.scene.setState(s, host.uid, 'active');
    mutate.char.setCard(s, host.uid, 'B03041', true);
    const tgt = mutate.scene.enter(s, 'self', 'TGT', {}); mutate.scene.setState(s, tgt.uid, 'sleep');
    const g = mutate.scene.enter(s, 'self', 'GUARD', {}); mutate.scene.setState(s, g.uid, 'active');
    expect(mustGuardCandidates(s, host.uid, tgt.uid).map(c => c.uid)).toContain(g.uid);
  });
});
