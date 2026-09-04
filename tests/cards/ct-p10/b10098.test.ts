import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { B10098 } from '@/cards/ct-p10/B10098';
import { B10098P } from '@/cards/ct-p10/B10098P';
import { registerAll } from '@/cards';
import { REUSE_CARDS } from '@/cards/_reuse';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue, _drainPendingEffectPickSide } from '@/engine/effect/pending-state';
import { event } from '@/engine/event';
import { advance, declare, passGuard, tryGuard, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetRegistry, register } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createMainGameState as createEmptyGameState } from '../../helpers/main-game-state';
import { sceneChar } from '../../helpers/fixtures';
import type { CardDef, GameState } from '@/engine/types';

const OPPONENT = 'B10098_TEST_OPPONENT';
const OWN_TARGET = 'B10098_TEST_OWN_TARGET';
const OWN_CONTACT = 'B10098_TEST_OWN_CONTACT';

const CONTACT_CARD: CardDef = {
  id: OWN_CONTACT,
  no: OWN_CONTACT,
  kind: 'character',
  names: ['B10098 contact participant'],
  colors: [],
  level: 8,
  ap: 5000,
  lp: 1,
  traits: [],
  keywords: [],
  rarity: 'C',
  imageUrl: '',
  abilities: [],
  ruleRefs: [],
};

const TARGET_CARD: CardDef = { ...CONTACT_CARD, id: OWN_TARGET, no: OWN_TARGET, level: 1 };
const OPPONENT_CARD: CardDef = { ...CONTACT_CARD, id: OPPONENT, no: OPPONENT };

function state(): GameState {
  const s = createEmptyGameState();
  s.players.self.scene = [sceneChar('B10098', 'source'), sceneChar(OWN_TARGET, 'own-target', { state: 'sleep' })];
  s.players.opp.scene = [sceneChar(OPPONENT, 'opp-attacker'), sceneChar(OPPONENT, 'opp-target', { state: 'sleep' })];
  return s;
}

function startContact(s: GameState, path: 'attacker' | 'target' | 'guard'): void {
  if (path === 'attacker') {
    s.turn.player = 'self';
    const action = declare(s, 'source', { kind: 'char', uid: 'opp-target' });
    passGuard(s, action);
    advance(s, action);
    advance(s, action);
    return;
  }
  s.turn.player = 'opp';
  if (path === 'target') {
    s.players.self.scene.find(char => char.uid === 'source')!.state = 'sleep';
    const action = declare(s, 'opp-attacker', { kind: 'char', uid: 'source' });
    passGuard(s, action);
    advance(s, action);
    advance(s, action);
    return;
  }
  const action = declare(s, 'opp-attacker', { kind: 'char', uid: 'own-target' });
  tryGuard(s, action, 'source');
  advance(s, action);
  advance(s, action);
}

/** Advance from the post-contact-start action window through contact cleanup. */
function finishContact(s: GameState, action: ReturnType<typeof declare>): void {
  advance(s, action); // action-1 -> action-2
  advance(s, action); // action-2 -> judge
  advance(s, action); // judge -> contact-end
  advance(s, action); // contact-end -> action-end (clears contact scope)
}

function partnerAreaState(sourceUid: string): GameState {
  const s = createEmptyGameState();
  s.players.self.partnerAreaMR = sceneChar('B10098', sourceUid);
  s.players.self.scene = [
    sceneChar(OWN_CONTACT, 'own-contact'),
    sceneChar(OWN_TARGET, 'own-target', { state: 'sleep' }),
  ];
  s.players.opp.scene = [
    sceneChar(OPPONENT, 'opp-attacker'),
    sceneChar(OPPONENT, 'opp-target', { state: 'sleep' }),
  ];
  return s;
}

function startPartnerAreaContact(s: GameState, path: 'attacker' | 'target' | 'guard') {
  if (path === 'attacker') {
    s.turn.player = 'self';
    const action = declare(s, 'own-contact', { kind: 'char', uid: 'opp-target' });
    passGuard(s, action);
    advance(s, action);
    advance(s, action);
    return action;
  }
  s.turn.player = 'opp';
  if (path === 'target') {
    s.players.self.scene.find(char => char.uid === 'own-contact')!.state = 'sleep';
    const action = declare(s, 'opp-attacker', { kind: 'char', uid: 'own-contact' });
    passGuard(s, action);
    advance(s, action);
    advance(s, action);
    return action;
  }
  const action = declare(s, 'opp-attacker', { kind: 'char', uid: 'own-target' });
  tryGuard(s, action, 'own-contact');
  advance(s, action);
  advance(s, action);
  return action;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetActionContexts();
  _clearPendingEffectPickQueue();
  _resetRegistry();
  registerAll();
  [CONTACT_CARD, TARGET_CARD, OPPONENT_CARD].forEach(register);
  registerTriggeredListener();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
});

afterEach(() => {
  delete (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide;
});

describe('B10098/P', () => {
  it('uses the atomic PA cost and admits only printed or condition-icon plain 突撃 targets', () => {
    const declared = B10098.abilities[0]!;
    expect(declared).toMatchObject({ scope: 'on-partner-area', cost: { kind: 'pay', items: [{ kind: 'sleepSelf' }, { kind: 'selfToPartnerArea' }] } });
    expect((declared.effect as { steps: Array<{ args: { filter: unknown } }> }).steps[0]!.args.filter).toMatchObject({
      kind: 'character', levelMax: 8, cardName: ['服部平次', '怪盗キッド'], keywordFromPrintOrConditionIcon: '突撃',
    });
  });

  it('uses own exact-1 contact participant for AP+2000 and keeps P text-equivalent', () => {
    const contact = B10098.abilities[1]!;
    expect(contact).toMatchObject({ scope: 'on-partner-area', trigger: { hook: 'contact:start', matcherCondition: { cs: [
      { payloadKey: 'aUid', side: 'self', filter: { kind: 'character', levelMin: 8 } },
      { payloadKey: 'bUid', side: 'self', filter: { kind: 'character', levelMin: 8 } },
    ] } } });
    expect(contact.effect).toMatchObject({ kind: 'atom', verb: 'charModifyAP', args: {
      delta: 2000, n: 1, side: 'self', inContact: true, scope: 'contact', filter: { kind: 'character', levelMin: 8 },
    } });
    expect(B10098P.abilities).toEqual(B10098.abilities);
  });

  it.each(['attacker', 'target', 'guard'] as const)('buffs exactly the own Lv8+ %s through the contact state machine', (path) => {
    const s = state();
    const before = readChar.ap(s, 'source');
    const opponentBefore = readChar.ap(s, 'opp-attacker');

    startContact(s, path);
    runAllUntilEmpty(s);
    const pending = _drainPendingEffectPickSide();

    expect(pending?.candidates.map(candidate => candidate.uid)).toEqual(['source']);
    applyPickAndContinuation(s, pending!, 'source');
    runAllUntilEmpty(s);

    expect(readChar.ap(s, 'source')).toBe(before + 2000);
    expect(readChar.ap(s, 'opp-attacker')).toBe(opponentBefore);
  });

  it.each([
    ['physical PA-MR UID', 'physical-pa-mr'],
    ['legacy PA-MR UID', 'partnerMR:self'],
  ] as const)('%s source buffs and cleans every own contact role', (_label, sourceUid) => {
    for (const path of ['attacker', 'target', 'guard'] as const) {
      const s = partnerAreaState(sourceUid);
      const before = readChar.ap(s, 'own-contact');
      const opponentBefore = readChar.ap(s, 'opp-attacker');
      const action = startPartnerAreaContact(s, path);

      runAllUntilEmpty(s);
      const pending = _drainPendingEffectPickSide();
      expect(pending?.source).toMatchObject({ cardId: 'B10098', abilityId: 'a2' });
      expect(pending?.candidates.map(candidate => candidate.uid)).toEqual(['own-contact']);
      applyPickAndContinuation(s, pending!, 'own-contact');
      runAllUntilEmpty(s);

      expect(readChar.ap(s, 'own-contact')).toBe(before + 2000);
      expect(readChar.ap(s, 'opp-attacker')).toBe(opponentBefore);

      finishContact(s, action);
      expect(readChar.ap(s, 'own-contact')).toBe(before);
      expect(s.players.self.scene.find(char => char.uid === 'own-contact')?.turnEffects.apMod_contact).toBeUndefined();
    }
  });

  it('registers each printing exactly once', () => {
    expect(REUSE_CARDS.filter(card => card.id === 'B10098' || card.id === 'B10098P')).toEqual([B10098, B10098P]);
  });
});
