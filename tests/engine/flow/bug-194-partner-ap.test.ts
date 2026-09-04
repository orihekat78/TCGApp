// BUG-194: real partner is a contact actor and must share AP modifier/read/cleanup semantics.
// rules: 08-contact.md, 19-special-rules.md, 23-qa-disguise-cutin.md

import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAtom } from '@/engine/effect/atom-handlers';
import { char as readChar } from '@/engine/read/char';
import { mutate } from '@/engine/mutate';
import { advance, snapshotAP, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { judge } from '@/engine/flow/contact';
import { endTurn } from '@/engine/flow/turn';
import { register as registerCardDef, _resetRegistry as resetCardDefRegistry } from '@/engine/read/def';
import { event } from '@/engine/event';
import type { ActionContext, CardDef, GameState } from '@/engine/types';
import { makeCtx } from '../../helpers/fixtures';

function card(id: string, kind: CardDef['kind'], ap: number): CardDef {
  return {
    id,
    no: id,
    kind,
    names: [id],
    colors: ['緑'],
    level: 1,
    ap,
    lp: 1,
    traits: [],
    rarity: 'C',
    imageUrl: '',
    abilities: [],
    ruleRefs: [],
  };
}

function state(): GameState {
  registerCardDef(card('P-SELF', 'partner', 3000));
  registerCardDef(card('P-OPP', 'partner', 2000));
  const s = createEmptyGameState();
  s.players.self.partner = { cardId: 'P-SELF', state: 'active', location: 'partner-area' };
  s.players.opp.partner = { cardId: 'P-OPP', state: 'active', location: 'partner-area' };
  return s;
}

function context(phase: ActionContext['phase']): ActionContext {
  return {
    id: 'bug-194',
    byUid: 'partner:self',
    byPlayer: 'self',
    target: { kind: 'char', uid: 'partner:opp' },
    phase,
    cutInUsed: {},
    startedAt: { turn: 1, nano: 0 },
    contactImmune: false,
  };
}

describe('BUG-194 partner effective AP', () => {
  beforeEach(() => {
    event._resetRegistry();
    resetCardDefRegistry();
    _resetActionContexts();
  });

  it('charModifyAP stores negative contact modifiers on partner and the common AP reader applies them', () => {
    const out = produce(state(), (draft) => {
      runAtom(draft, 'charModifyAP', { uid: 'partner:self', delta: -4000, scope: 'contact' }, makeCtx());
    });

    expect(out.players.self.partner.turnEffects?.['apMod_contact']).toBe(-4000);
    expect(readChar.ap(out, 'partner:self')).toBe(-1000);
  });

  it('contact order and AP snapshot use the same modified partner AP', () => {
    const s = produce(state(), (draft) => {
      mutate.char.modifyAP(draft, 'partner:self', -2000, 'contact');
      mutate.char.modifyAP(draft, 'partner:opp', 2000, 'turn');
    });
    const ax = context('contact-pending');

    const out = produce(s, (draft) => {
      draft.actionContexts ??= {};
      draft.actionContexts[ax.id] = ax;
      advance(draft, draft.actionContexts[ax.id]);
      snapshotAP(draft, draft.actionContexts[ax.id]);
    });
    const liveAx = out.actionContexts![ax.id]!;

    expect(out.players.self.partner.turnEffects?.['apMod_contact']).toBe(-2000);
    expect(liveAx.firstUid).toBe('partner:self');
    expect(liveAx.apSnapshot).toEqual({
      aUid: 'partner:self',
      aAP: 1000,
      bUid: 'partner:opp',
      bAP: 4000,
    });
  });

  it('contact-end clears partner contact scope but preserves turn scope', () => {
    const s = produce(state(), (draft) => {
      mutate.char.modifyAP(draft, 'partner:self', 1000, 'contact');
      mutate.char.modifyAP(draft, 'partner:self', 500, 'turn');
    });
    const ax = context('contact-end');

    const out = produce(s, (draft) => {
      advance(draft, ax);
    });

    expect(out.players.self.partner.turnEffects?.['apMod_contact']).toBeUndefined();
    expect(out.players.self.partner.turnEffects?.['apMod_turn']).toBe(500);
  });

  it('legacy partner state without turnEffects remains readable', () => {
    const s = state();
    expect(readChar.ap(s, 'partner:self')).toBe(3000);
  });

  it('partner attacker AP modifiers change the snapshotted AP and judgment outcome, then expire by scope', () => {
    registerCardDef(card('DEFENDER', 'character', 3500));
    const baseline = state();
    const baselineDefender = mutate.scene.enter(baseline, 'opp', 'DEFENDER', {});
    const baselineAx = context('judge');
    baselineAx.target = { kind: 'char', uid: baselineDefender.uid };

    snapshotAP(baseline, baselineAx);
    const baselineResult = judge(baseline, baselineAx);

    expect(baselineAx.apSnapshot?.aAP).toBe(3000);
    expect(baselineResult.defenderRemoved).toBe(false);

    const boosted = state();
    const boostedDefender = mutate.scene.enter(boosted, 'opp', 'DEFENDER', {});
    const boostedAx = context('judge');
    boostedAx.target = { kind: 'char', uid: boostedDefender.uid };
    mutate.char.modifyAP(boosted, 'partner:self', 500, 'contact');
    mutate.char.modifyAP(boosted, 'partner:self', 500, 'turn');

    snapshotAP(boosted, boostedAx);
    const boostedResult = judge(boosted, boostedAx);

    expect(boostedAx.apSnapshot?.aAP).toBe(4000);
    expect(boostedResult.defenderRemoved).toBe(true);
    expect(boosted.players.opp.scene.some(c => c.uid === boostedDefender.uid)).toBe(false);

    advance(boosted, boostedAx); // judge -> contact-end
    advance(boosted, boostedAx); // contact-end -> action-end, clears contact scope
    expect(readChar.ap(boosted, 'partner:self')).toBe(3500);
    expect(boosted.players.self.partner.turnEffects?.['apMod_contact']).toBeUndefined();

    endTurn(boosted, 'self');
    expect(readChar.ap(boosted, 'partner:self')).toBe(3000);
    expect(boosted.players.self.partner.turnEffects?.['apMod_turn']).toBeUndefined();
  });

  it('partner defender AP modifiers change the snapshotted AP and judgment outcome, then contact cleanup removes them', () => {
    registerCardDef(card('ATTACKER', 'character', 3500));
    const baseline = state();
    const baselineAttacker = mutate.scene.enter(baseline, 'self', 'ATTACKER', {});
    const baselineAx = context('judge');
    baselineAx.byUid = baselineAttacker.uid;

    snapshotAP(baseline, baselineAx);
    const baselineResult = judge(baseline, baselineAx);

    expect(baselineAx.apSnapshot?.bAP).toBe(2000);
    expect(baselineResult.defenderRemoved).toBe(true);

    const boosted = state();
    const boostedAttacker = mutate.scene.enter(boosted, 'self', 'ATTACKER', {});
    const boostedAx = context('judge');
    boostedAx.byUid = boostedAttacker.uid;
    mutate.char.modifyAP(boosted, 'partner:opp', 2000, 'contact');

    snapshotAP(boosted, boostedAx);
    const boostedResult = judge(boosted, boostedAx);

    expect(boostedAx.apSnapshot?.bAP).toBe(4000);
    expect(boostedResult.defenderRemoved).toBe(false);

    advance(boosted, boostedAx);
    advance(boosted, boostedAx);
    expect(readChar.ap(boosted, 'partner:opp')).toBe(2000);
    expect(boosted.players.opp.partner.turnEffects?.['apMod_contact']).toBeUndefined();
  });
});
