import { beforeEach, describe, expect, it } from 'vitest';
import { B10015 } from '@/cards/ct-p10/B10015';
import { REUSE_CARDS } from '@/cards';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { run as runEffect } from '@/engine/effect/resolver';
import { event } from '@/engine/event';
import { canAction } from '@/engine/flow/main/action';
import { _drainPendingHirameki, _resetPendingHirameki } from '@/engine/listeners/hirameki';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { char as charRead } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { createEmptyGameState } from '@/engine/state-factory';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

function char(id: string, over: Partial<CardDef> = {}): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['青'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over };
}

const ERI = char('B10015_ERI', { names: ['妃英理'], traits: ['弁護士'] });
const OFFICE_A = char('B10015_A', { names: ['毛利蘭'], traits: ['毛利探偵事務所'] });
const OFFICE_B = char('B10015_B', { names: ['江戸川コナン'], traits: ['毛利探偵事務所'] });
const HAND_ERI = char('B10015_HAND_ERI', { names: ['妃英理'] });

function state(): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 2, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  return s;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetPendingHirameki();
  _clearPendingEffectPickQueue();
  _resetRegistry();
  [B10015, ERI, OFFICE_A, OFFICE_B, HAND_ERI].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

describe('CT-P10 B10015 毛利小五郎', () => {
  it('registers exactly its sole official printing with matching metadata', () => {
    const registered = REUSE_CARDS.filter(card => card.id === B10015.id);

    expect(registered).toEqual([B10015]);
  });

  it('gives only own-scene Eri the office trait and gains rapid from four distinct office names', () => {
    const s = state();
    s.players.self.scene.push(sceneChar(B10015.id, 'kogoro'), sceneChar(ERI.id, 'eri'), sceneChar(OFFICE_A.id, 'a'), sceneChar(OFFICE_B.id, 'b'));
    s.players.opp.scene.push(sceneChar(ERI.id, 'opp-eri'));

    expect(charRead.traits(s, 'eri')).toContain('毛利探偵事務所');
    expect(charRead.traits(s, 'opp-eri')).not.toContain('毛利探偵事務所');
    expect(charRead.keywords(s, 'kogoro')).toContain('迅速');
  });

  it('does not gain rapid from duplicate names or fewer than four effective office characters', () => {
    const s = state();
    s.players.self.scene.push(sceneChar(B10015.id, 'kogoro'), sceneChar(ERI.id, 'eri'), sceneChar(OFFICE_A.id, 'a1'), sceneChar(OFFICE_A.id, 'a2'));

    expect(charRead.keywords(s, 'kogoro')).not.toContain('迅速');
  });

  it('permits a named B10015 to begin action while rapid is active, then removes rapid for future permission checks', () => {
    const s = state();
    s.players.self.scene.push(sceneChar(B10015.id, 'kogoro', { isNamed: true }), sceneChar(ERI.id, 'eri'), sceneChar(OFFICE_A.id, 'a'), sceneChar(OFFICE_B.id, 'b'));
    expect(canAction(s, 'kogoro')).toBe(true);

    s.players.self.scene.splice(3, 1);
    expect(charRead.keywords(s, 'kogoro')).not.toContain('迅速');
    expect(canAction(s, 'kogoro')).toBe(false);
  });

  it('offers only a remove-area Eri for Hirameki and adds the selected card to hand', () => {
    const s = state();
    s.players.self.evidence = [{ cardId: B10015.id, faceUp: false, origin: { turn: 1, via: 'reasoning' } }];
    s.players.self.remove = [HAND_ERI.id, OFFICE_A.id];
    event.emit(s, 'evidence:remove-by-action', { player: 'self', ev: { cardId: B10015.id }, byUid: 'attacker' }, { player: 'opp', uid: 'attacker' });
    expect(_drainPendingHirameki()).toMatchObject({ player: 'self', cardId: B10015.id, abilityId: 'a3' });

    runEffect(s, B10015.abilities[2]!.effect!, { source: { cardId: B10015.id, abilityId: 'a3', player: 'self', area: 'evidence' }, bindings: {} });
    const pick = _drainPendingEffectPickSide()!;
    expect(pick.candidates.map(candidate => candidate.cardId)).toEqual([HAND_ERI.id]);
    applyPickAndContinuation(s, pick, pick.candidates[0]!.uid);
    expect(s.players.self.hand).toEqual([HAND_ERI.id]);
  });

  it('matches the sole printed metadata and has no B10015P TSV printing', () => {
    expect(B10015).toMatchObject({ id: 'B10015', no: '1077/B10015', names: ['毛利小五郎'], colors: ['青'], level: 6, ap: 5000, lp: 1, traits: ['探偵', '毛利探偵事務所'], rarity: 'C', imageUrl: '1783904094980534.jpg' });
  });
});
