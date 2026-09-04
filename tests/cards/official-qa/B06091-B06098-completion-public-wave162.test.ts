// qa: card:B06091:100adbbed925b66fdcb792ff3aa4a483640f287338264fc5c064d46af6177788
// qa: card:D11016:100adbbed925b66fdcb792ff3aa4a483640f287338264fc5c064d46af6177788
// qa: card:B06092:b190d782f194602ebcc5f5fd6d94ccd7e5927e1acc2a87517b2038e4bbfcec6c
// qa: card:B06093:fd663a129833b5aca7792e25753f35394f7af3f2f622b2954c7aaf38224ce727
// qa: card:B06095:125282ef42997636595e79840f9671009a309cc99d36b0f0da406e3de9b044e4
// qa: card:B06098:78b84cb792d3783cc2b18d867f6652c605ce2650a2a6e5732aafea92c999e37f
// qa: card:B06098:85038b630222e1a06910714245cc1b0963194173e2ed898fd0916ce95e7d3845

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { D11016 } from '@/cards/ct-d11/D11016';
import { B06091 } from '@/cards/ct-p06/B06091';
import { B06092 } from '@/cards/ct-p06/B06092';
import { B06093 } from '@/cards/ct-p06/B06093';
import { B06095 } from '@/cards/ct-p06/B06095';
import { B06095P } from '@/cards/ct-p06/B06095P';
import { B06098 } from '@/cards/ct-p06/B06098';
import { B06098P } from '@/cards/ct-p06/B06098P';
import { resetPendingRuntimeState } from '@/engine/effect/runtime-state';
import { event } from '@/engine/event';
import * as flow from '@/engine/flow';
import { _resetTargetExpanders } from '@/engine/flow/action/target-expander';
import { _resetPendingHirameki } from '@/engine/listeners/hirameki';
import {
  _resetMisreadRegistered,
  _resetPendingMisread,
  registerMisreadListener,
} from '@/engine/listeners/misread';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { read } from '@/engine/read';
import { _resetRegistry, register } from '@/engine/read/def';
import { createEmptyGameState } from '@/engine/state-factory';
import { effectiveTraitNames } from '@/engine/target/candidates';
import type { CardDef, Candidate, EvidenceCard, GameState, Player } from '@/engine/types';
import { bindPendingDecision, dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { resetPresentationQueue } from '@/ui/presentation/coordinator';
import { beginMatchSession, endMatchSession } from '@/ui/services/matchSession';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../../helpers/fixtures';

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  const kind = over.kind ?? 'character';
  return {
    id, no: `test/${id}`, kind, names: [id], colors: ['黄'], level: 1,
    ap: kind === 'character' ? 1000 : undefined,
    lp: kind === 'character' ? 1 : undefined,
    traits: [], keywords: [], rarity: 'T', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const ATTACKER = fixture('W162_ATTACKER', { ap: 5000 });
const GUARD = fixture('W162_GUARD', { ap: 1000 });
const DECOY = fixture('W162_DECOY', { ap: 1000 });
const EVIDENCE = fixture('W162_EVIDENCE', { kind: 'event' });
const NON_POIROT = fixture('W162_NON_POIROT', { ap: 3000, traits: ['探偵'] });
const CONTACT_TARGET = fixture('W162_CONTACT_TARGET', { ap: 2000 });
const DRAW = fixture('W162_DRAW', { kind: 'event' });
const REASONER = fixture('W162_REASONER', { lp: 5 });
const ALL_AREA_CHAR = fixture('W162_ALL_AREA_CHAR');
const ALL_AREA_OTHER = fixture('W162_ALL_AREA_OTHER');
const YELLOW_PARTNER = fixture('W162_YELLOW_PARTNER', {
  kind: 'partner', level: undefined, ap: undefined, lp: 1,
});
const ORGANIZATION = fixture('W162_ORGANIZATION', { traits: ['黒ずくめの組織'], colors: ['黒'] });
const NON_ORGANIZATION = fixture('W162_NON_ORGANIZATION', { traits: ['探偵'], colors: ['黒'] });
const DECK_A = fixture('W162_DECK_A', { kind: 'event', colors: ['黒'] });
const DECK_B = fixture('W162_DECK_B', { kind: 'event', colors: ['黒'] });
const DECK_C = fixture('W162_DECK_C', { kind: 'event', colors: ['黒'] });
const FIXTURES = [
  ATTACKER, GUARD, DECOY, EVIDENCE, NON_POIROT, CONTACT_TARGET, DRAW, REASONER,
  ALL_AREA_CHAR, ALL_AREA_OTHER, YELLOW_PARTNER, ORGANIZATION, NON_ORGANIZATION,
  DECK_A, DECK_B, DECK_C,
];
const GUARDED_SOURCE_CARDS = [
  { card: B06091, label: 'B06091' },
  { card: D11016, label: 'D11016' },
] as const;

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

function current(): GameState {
  const state = useGameStateStore.getState().gameState;
  if (!state) throw new Error('missing Wave162 state');
  return state;
}

function install(state: GameState, human: Player, label: string): void {
  resetPendingRuntimeState();
  useGameStateStore.getState().resetMatchSessionState();
  endMatchSession();
  beginMatchSession(human);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = human;
  resetPresentationQueue(`qa-wave162-${label}`);
  expect(useGameStateStore.getState().setGameState(state)).toBe(true);
}

function evidence(cardId: string, faceUp = false): EvidenceCard {
  return { cardId, faceUp, origin: { turn: 1, via: 'reasoning' } };
}

function ownerOf(uid: string): Player {
  return current().players.self.scene.some(character => character.uid === uid) ? 'self' : 'opp';
}

function reachContactWindow(owner: Player): string {
  expect(dispatchEngineAction({
    type: 'actionDeclareChar', byUid: 'contact-actor', targetUid: 'contact-target',
  })).toEqual({ ok: true });
  const actionId = useGameStateStore.getState().activeActionId!;
  expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: null })).toEqual({ ok: true });
  for (let step = 0; step < 12; step += 1) {
    const action = flow.action._getContext(current(), actionId);
    if (!action) throw new Error('Wave162 contact ended before owner action window');
    if (action.phase === 'action-1' || action.phase === 'action-2' || action.phase === 'action-1-redo') {
      const uid = action.phase === 'action-2' ? action.secondUid : action.firstUid;
      const player = ownerOf(uid!);
      if (player === owner && uid === 'contact-actor') return actionId;
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player, choice: { kind: 'pass' },
      })).toEqual({ ok: true });
      expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
      continue;
    }
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  throw new Error('Wave162 owner contact window not reached');
}

beforeEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  event._resetRegistry();
  _resetRegistry();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  _resetTriggeredRegistered();
  _resetPendingHirameki();
  _resetPendingMisread();
  _resetMisreadRegistered();
  _resetUidCounter();
  registerAll();
  FIXTURES.forEach(register);
  registerTriggeredListener();
  registerMisreadListener();
});

afterEach(() => {
  resetPendingRuntimeState();
  endMatchSession();
  flow.action._resetActionContexts();
  _resetTargetExpanders();
  useGameStateStore.getState().setGameState(null);
  (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide = null;
});

describe.each(GUARDED_SOURCE_CARDS)(
  'official QA Wave162: $label guarded selected-action semantics',
  ({ card, label }) => {
    it.each(['self', 'opp'] as const)(
      'owner=%s reactivates and buffs the other character guarding an action that selected the source',
      owner => {
        const attacker = other(owner);
        const state = createEmptyGameState();
        state.turn = { number: 162, player: attacker, phase: 'main', isFirstPlayerFirstTurn: false };
        state.players[owner].scene = [
          sceneChar(card.id, 'shinobu', { state: 'sleep' }),
          sceneChar(GUARD.id, 'guard'),
        ];
        state.players[attacker].scene = [sceneChar(ATTACKER.id, 'attacker')];
        install(state, attacker, `${label}-${owner}-selected-source`);

        expect(dispatchEngineAction({
          type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'shinobu',
        })).toEqual({ ok: true });
        const actionId = useGameStateStore.getState().activeActionId!;
        expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'guard' }))
          .toEqual({ ok: true });

        expect(current().players[owner].scene.find(character => character.uid === 'guard'), `${label} B06091/D11016 card-bound guard result`)
          .toMatchObject({ state: 'active' });
        expect(read.char.ap(current(), 'guard')).toBe(3000);
        expect(current().players[owner].scene.find(character => character.uid === 'shinobu')?.state).toBe('sleep');
      },
    );

    it.each(['character', 'case'] as const)(
      'does not fire when the source itself guards an action that selected another %s',
      targetKind => {
        const state = createEmptyGameState();
        state.turn = { number: 162, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false };
        state.players.self.scene = [sceneChar(card.id, 'shinobu')];
        state.players.opp.scene = [sceneChar(ATTACKER.id, 'attacker')];
        if (targetKind === 'character') {
          state.players.self.scene.push(sceneChar(DECOY.id, 'decoy', { state: 'sleep' }));
        } else {
          state.players.self.evidence = [{
            cardId: EVIDENCE.id, faceUp: false, origin: { turn: 1, via: 'reasoning' },
          }];
        }
        install(state, 'opp', `${label}-self-guard-${targetKind}`);

        const declared = targetKind === 'character'
          ? dispatchEngineAction({ type: 'actionDeclareChar', byUid: 'attacker', targetUid: 'decoy' })
          : dispatchEngineAction({ type: 'actionDeclareCase', byUid: 'attacker', targetPlayer: 'self' });
        expect(declared).toEqual({ ok: true });
        const actionId = useGameStateStore.getState().activeActionId!;
        expect(dispatchEngineAction({ type: 'actionGuard', actionId, guarderUid: 'shinobu' }))
          .toEqual({ ok: true });

        expect(current().players.self.scene.find(character => character.uid === 'shinobu'), `${label} B06091/D11016 must not observe its own guard`)
          .toMatchObject({ state: 'sleep' });
        expect(read.char.ap(current(), 'shinobu')).toBe(3000);
      },
    );
  },
);

describe('official QA Wave162: B06092 Cut-In remains unconditional', () => {
  it.each(['self', 'opp'] as const)(
    'owner=%s may Cut-In a non-Poirot character for AP only',
    owner => {
      const opponent = other(owner);
      const state = createEmptyGameState();
      state.turn = { number: 162, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
      state.players[owner].scene = [sceneChar(NON_POIROT.id, 'contact-actor')];
      state.players[opponent].scene = [sceneChar(CONTACT_TARGET.id, 'contact-target', { state: 'sleep' })];
      state.players[owner].hand = [B06092.id];
      state.players[owner].deck = [DRAW.id];
      install(state, owner, `${owner}-B06092-non-poirot`);

      const actionId = reachContactWindow(owner);
      expect(dispatchEngineAction({
        type: 'actionContact', actionId, player: owner,
        choice: { kind: 'cutin', cardId: B06092.id },
      })).toEqual({ ok: true });

      expect(read.char.ap(current(), 'contact-actor'), 'B06092 unconditional AP branch').toBe(4000);
      expect(current().players[owner].hand).toEqual([]);
      expect(current().players[owner].remove).toContain(B06092.id);
      expect(current().players[owner].deck).toEqual([DRAW.id]);
    },
  );
});

describe('official QA Wave162: B06093 combines multiple Misread 2 bearers', () => {
  it.each(['self', 'opp'] as const)('owner=%s may commit both physical occurrences', owner => {
    const reasoner = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 162, player: reasoner, phase: 'main', isFirstPlayerFirstTurn: false };
    state.players[owner].scene = [
      sceneChar(B06093.id, 'misread-a'),
      sceneChar(B06093.id, 'misread-b'),
    ];
    state.players[reasoner].scene = [sceneChar(REASONER.id, 'reasoner')];
    state.players[reasoner].deck = Array.from({ length: 8 }, () => DECK_A.id);
    install(state, owner, `${owner}-B06093-multiple`);

    expect(dispatchEngineAction({ type: 'reasoning', uid: 'reasoner' })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingMisread;
    expect(pending?.candidates, 'B06093 card-bound multiple candidates').toEqual([
      { uid: 'misread-a', x: 2 }, { uid: 'misread-b', x: 2 },
    ]);
    expect(dispatchEngineAction(bindPendingDecision(pending!, {
      type: 'misreadResolve', picks: pending!.candidates,
    }))).toEqual({ ok: true });

    expect(current().players[owner].scene.map(character => character.state)).toEqual(['sleep', 'sleep']);
    expect(current().players[reasoner].evidence).toHaveLength(1);
    expect(useGameStateStore.getState().pendingMisread).toBeNull();
  });
});

function allAreaCardCandidate(
  area: 'hand' | 'deck' | 'remove' | 'partner-area' | 'case',
  player: Player,
  cardId = ALL_AREA_CHAR.id,
): Candidate {
  return { kind: 'card', cardId, area, player, index: 0 };
}

describe('official QA Wave162: B06095/P grants a trait across all defined areas', () => {
  it.each([B06095, B06095P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))('$card.id owner=$owner', ({ card, owner }) => {
    const opponent = other(owner);
    const state = createEmptyGameState();
    state.turn = { number: 162, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    const player = state.players[owner];
    player.case.cardId = card.id;
    player.case.status = '解決編';
    player.case.colors = ['黄'];
    player.partner.cardId = YELLOW_PARTNER.id;
    player.scene = [sceneChar(ALL_AREA_CHAR.id, 'all-area-scene')];
    player.partnerAreaCards = [ALL_AREA_CHAR.id];
    player.hand = [ALL_AREA_CHAR.id];
    player.deck = [ALL_AREA_CHAR.id];
    player.remove = [ALL_AREA_CHAR.id];
    player.evidence = [evidence(ALL_AREA_CHAR.id), evidence(ALL_AREA_OTHER.id)];
    player.file = [{ type: 'card-back', cardId: ALL_AREA_CHAR.id, faceUp: true }];
    state.players[opponent].hand = [ALL_AREA_CHAR.id];
    install(state, owner, `${card.id}-${owner}-all-areas`);

    expect(dispatchEngineAction({
      type: 'declaredAbility', uid: `case:${owner}`, abilId: 'a2',
      abilityOrigin: 'printed', abilityIndex: 1,
      costParams: { flipFaceUpEvidence: { indices: [0, 1] } },
    })).toEqual({ ok: true });

    const after = current();
    const scene = after.players[owner].scene[0]!;
    expect(effectiveTraitNames(after, ALL_AREA_CHAR.id, scene, {
      kind: 'char', uid: scene.uid, cardId: ALL_AREA_CHAR.id, player: owner,
    }), 'B06095/B06095P scene character').toContain('喫茶ポアロ');
    for (const area of ['hand', 'deck', 'remove', 'partner-area'] as const) {
      expect(effectiveTraitNames(after, ALL_AREA_CHAR.id, null, allAreaCardCandidate(area, owner)), area)
        .toContain('喫茶ポアロ');
    }
    expect(effectiveTraitNames(after, ALL_AREA_CHAR.id, null, {
      kind: 'evidence', player: owner, index: 0,
    })).toContain('喫茶ポアロ');
    expect(effectiveTraitNames(after, ALL_AREA_CHAR.id, null, {
      kind: 'file', player: owner, index: 0,
    })).toContain('喫茶ポアロ');
    expect(effectiveTraitNames(after, card.id, null, allAreaCardCandidate('case', owner, card.id)))
      .not.toContain('喫茶ポアロ');
    expect(effectiveTraitNames(after, YELLOW_PARTNER.id, null, {
      kind: 'partner', player: owner,
    })).not.toContain('喫茶ポアロ');
    expect(effectiveTraitNames(after, ALL_AREA_CHAR.id, null, allAreaCardCandidate('hand', opponent)))
      .not.toContain('喫茶ポアロ');
  });
});

function b06098State(
  card: CardDef,
  owner: Player,
  area: 'scene' | 'partner-area',
  organizationCount: number,
  includeNonOrganization = false,
): GameState {
  const state = createEmptyGameState();
  state.turn = { number: 162, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
  const player = state.players[owner];
  if (area === 'scene') player.scene.push(sceneChar(card.id, 'vermouth-shelly'));
  else player.partnerAreaMR = sceneChar(card.id, `partnerMR:${owner}`, { isNamed: false });
  for (let index = 0; index < organizationCount; index += 1) {
    player.scene.push(sceneChar(ORGANIZATION.id, `organization-${index}`));
  }
  if (includeNonOrganization) player.scene.push(sceneChar(NON_ORGANIZATION.id, 'non-organization'));
  player.deck = [DECK_A.id, DECK_B.id, DECK_C.id];
  return state;
}

function declareB06098(uid: string, abilityId: 'a1' | 'a2', abilityIndex: number) {
  return dispatchEngineAction({
    type: 'declaredAbility', uid, abilId: abilityId,
    abilityOrigin: 'printed', abilityIndex,
  });
}

describe('official QA Wave162: B06098/P source-count conditions', () => {
  it.each([B06098, B06098P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner counts its scene occurrence for the first declaration',
    ({ card, owner }) => {
      install(b06098State(card, owner, 'scene', 1), owner, `${card.id}-${owner}-a1-counts-self`);
      expect(declareB06098('vermouth-shelly', 'a1', 0), 'B06098/B06098P scene self-count')
        .toEqual({ ok: true });

      install(b06098State(card, owner, 'scene', 0, true), owner, `${card.id}-${owner}-a1-alone`);
      const before = current();
      expect(declareB06098('vermouth-shelly', 'a1', 0)).toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(before);
    },
  );

  it.each([B06098, B06098P].flatMap(card => (
    ['self', 'opp'] as const
  ).map(owner => ({ card, owner }))))(
    '$card.id owner=$owner counts itself for a2 on scene but not in partner area',
    ({ card, owner }) => {
      install(b06098State(card, owner, 'scene', 1), owner, `${card.id}-${owner}-a2-scene`);
      expect(declareB06098('vermouth-shelly', 'a2', 1), 'B06098/B06098P a2 scene self-count')
        .toEqual({ ok: true });

      install(b06098State(card, owner, 'partner-area', 1), owner, `${card.id}-${owner}-a2-pa-one`);
      const before = current();
      expect(declareB06098(`partnerMR:${owner}`, 'a2', 1)).toEqual({ ok: false, reason: 'not-allowed' });
      expect(current()).toBe(before);

      install(b06098State(card, owner, 'partner-area', 2), owner, `${card.id}-${owner}-a2-pa-two`);
      expect(declareB06098(`partnerMR:${owner}`, 'a2', 1)).toEqual({ ok: true });
    },
  );
});
