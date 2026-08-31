// qa: card:B09026:3b40e4f1bfa97db36362fad681b7510cb4024f54c57fd8fed3c92833f80261a0
// qa: card:B09032:2dbdc98972f09762697ca53ba1cef0efe3e3089d3f2fc4fef8179b95d65e7beb
// qa: card:B09033:9c1b15e50492b9e1fbc78b0f0e1de0c61378d0a3d45a147b287f2bef1d27d49c
// qa: card:B09033:d8dc99d62acdd2911780a832435dc2622bed2718b781ae0cf508cc428ca6a5aa
// qa: card:B09033:ef2849caee7180cda9c275655743b8c0f8ccc524228510f100ce9dd045396741
// qa: card:B09036:4527c78eaad3bb72d4884ace8948f3b3b46c32efebd407cfdf869f7cea4c9274
// qa: card:B09036:f9fdd58e767090dd50e30d7a5f59197ea337006ee562ff64750770e47a9da32e
// qa: card:B09037:625c35bc13eccd561159206b7740e3c9cc1470b74e7aea147131087f6cd0a00d

import { beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { B09026 } from '@/cards/ct-p09/B09026';
import { B09032 } from '@/cards/ct-p09/B09032';
import { B09033 } from '@/cards/ct-p09/B09033';
import { B09036 } from '@/cards/ct-p09/B09036';
import { B09037 } from '@/cards/ct-p09/B09037';
import { evalDyn } from '@/engine/dyn/eval';
import { canDisguise, disguise } from '@/engine/flow/contact';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { endTurn } from '@/engine/flow/turn';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { read } from '@/engine/read';
import { _resetRegistry, def, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { ActionContext, CardDef, Player } from '@/engine/types';
import { runCardScenario } from '../../helpers/card-probe-harness';

function other(player: Player): Player {
  return player === 'self' ? 'opp' : 'self';
}

const YUKIKO: CardDef = {
  id: 'W190_YUKIKO', no: 'test/W190_YUKIKO', kind: 'character', names: ['工藤有希子'],
  colors: ['白'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T',
  imageUrl: '', abilities: [], ruleRefs: [],
};

function fixture(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `test/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 3, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'T', imageUrl: '',
    abilities: [], ruleRefs: [], ...over,
  } as CardDef;
}

const W190_TARGET = fixture('W190_TARGET', { level: 6 });
const W190_DEFENDER = fixture('W190_DEFENDER');
const W190_DISGUISE = fixture('W190_DISGUISE', {
  abilities: [{ id: 'disguise', type: 'icon-disguise', scope: 'on-hand' }],
});
const W190_TEEN_ENTER = fixture('W190_TEEN_ENTER', {
  traits: ['高校生'], level: 6,
  abilities: [{
    id: 'enter', type: 'triggered', scope: 'on-scene', trigger: { hook: 'enter', selfOnly: true },
    effect: { kind: 'atom', verb: 'charGrantKeyword', args: { uid: '$self', kw: '迅速', scope: 'turn' } },
  }],
});
const W190_TEEN_SWITCH = fixture('W190_TEEN_SWITCH', { traits: ['高校生'], level: 6 });
const W190_EVENT_DRIVER = fixture('W190_EVENT_DRIVER', {
  abilities: [{
    id: 'use-event', type: 'declared', scope: 'on-scene',
    effect: {
      kind: 'atom', verb: 'useEventFromHand',
      args: { player: 'self', max: 1, filter: { kind: 'event', cardName: '「ひょっとしたら…」' } },
    },
  }],
});
const W190_NAME = fixture('W190_NAME', { names: ['工藤優作'], level: 8 });
const W190_NAME_TWIN = fixture('W190_NAME_TWIN', { names: ['工藤優作'] });
const W190_FILLERS = Array.from({ length: 4 }, (_, index) => fixture(`W190_FILLER_${index}`));

beforeEach(() => {
  _resetRegistry();
  _resetTriggeredRegistered();
  registerAll();
  register(YUKIKO);
  registerTriggeredListener();
});

describe('official QA Wave190: public owner mirrors', () => {
  it.each(['self', 'opp'] as const)('owner=%s: a different 伊織無我 contact removal triggers the observer', owner => {
    const state = createEmptyGameState();
    const observer = mutate.scene.enter(state, owner, B09026.id, {});
    const attacker = mutate.scene.enter(state, owner, B09026.id, {});
    const victim = mutate.scene.enter(state, other(owner), B09037.id, {});

    mutate.scene.removeToRemove(state, victim.uid, 'contact-ap', attacker.uid);

    expect(state.pendingEffects, B09026.id).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: expect.objectContaining({ uid: observer.uid, cardId: B09026.id, abilityId: 'a2' }) }),
    ]));
  });

  it('grants B09037 event Assault on entry and retains it after the bond leaves', () => {
    const state = createEmptyGameState();
    state.turn = { number: 190, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    state.players.self.case.colors = ['白'];
    state.players.self.file = Array.from({ length: 7 }, () => ({ type: 'card-back' as const, cardId: B09026.id }));
    state.players.self.hand = [B09037.id];
    const bond = mutate.scene.enter(state, 'self', YUKIKO.id, {});

    handUseCard(state, 'self', B09037.id);
    runAllUntilEmpty(state);
    const source = state.players.self.scene.find(card => card.cardId === B09037.id)!;
    expect(read.char.keywords(state, source.uid), B09037.id).toContain('突撃[事件]');

    mutate.scene.removeToRemove(state, bond.uid, 'effect');
    expect(read.char.keywords(state, source.uid)).toContain('突撃[事件]');
  });

  it('B09032 grants both turn effects and disguise carries them to the replacement character', () => {
    const state = runCardScenario(B09032, [W190_TARGET, W190_DEFENDER, W190_DISGUISE], {
      name: 'B09032 disguise inheritance',
      setup: {
        selfScene: [{ cardId: B09032.id, uid: 'source' }, { cardId: W190_TARGET.id, uid: 'target' }],
        oppScene: [{ cardId: W190_DEFENDER.id, uid: 'defender' }],
      },
      drive: { kind: 'declared', uid: 'source', abilityId: 'a1' },
      script: [{ pickUid: 'target' }],
      expect: [{ kind: 'zone', cardId: B09032.id, zone: 'deck', side: 'self', present: true }],
    });
    state.players.self.hand = [W190_DISGUISE.id];
    const action: ActionContext = {
      id: 'wave190-disguise', byUid: 'target', byPlayer: 'self',
      target: { kind: 'char', uid: 'defender' }, phase: 'action-1', cutInUsed: {},
      startedAt: { turn: state.turn.number, nano: 0 },
      apSnapshot: { aUid: 'target', aAP: 1000, bUid: 'defender', bAP: 1000 },
      contactImmune: false,
    };

    expect(canDisguise(state, action, 'self', W190_DISGUISE.id)).toBe(true);
    disguise(state, action, 'self', W190_DISGUISE.id);
    runAllUntilEmpty(state);
    expect(state.players.self.scene.find(card => card.uid === 'target')?.cardId).toBe(W190_DISGUISE.id);
    expect(read.char.keywords(state, 'target')).toContain('突撃');
    expect(state.players.self.scene.find(card => card.uid === 'target')?.turnEffects.removeOnTurnEnd).toBe(true);

    endTurn(state, 'self');
    runAllUntilEmpty(state);
    expect(state.players.self.scene.some(card => card.uid === 'target'), B09032.id).toBe(false);
    expect(state.players.self.remove).toContain(W190_DISGUISE.id);
  });

  it('B09033 can enter with zero FILE and the entered character fires its enter trigger', () => {
    const state = runCardScenario(W190_EVENT_DRIVER, [B09033, W190_TEEN_ENTER], {
      name: 'B09033 zero FILE effect entry',
      setup: {
        selfScene: [{ cardId: W190_EVENT_DRIVER.id, uid: 'event-driver' }],
        hand: [B09033.id], deckTop: [W190_TEEN_ENTER.id], fileCount: 0,
      },
      drive: { kind: 'declared', uid: 'event-driver', abilityId: 'use-event' },
      script: [{ pickCardId: B09033.id }, { pickCardId: W190_TEEN_ENTER.id }, 'optional:decline'],
      expect: [{ kind: 'zone', cardId: W190_TEEN_ENTER.id, zone: 'scene', side: 'self', present: true }],
    });
    const entered = state.players.self.scene.find(card => card.cardId === W190_TEEN_ENTER.id)!;
    expect({
      fileCount: state.players.self.file.length,
      entered: state.players.self.scene.some(card => card.cardId === W190_TEEN_ENTER.id),
    }).toEqual({ fileCount: 0, entered: true });
    expect(state.players.self.file, B09033.id).toHaveLength(0);
    expect(read.char.keywords(state, entered.uid), B09033.id).toContain('迅速');
  });

  it('B09033 switches once per entry while the scene is full', () => {
    const state = runCardScenario(W190_EVENT_DRIVER, [B09033, W190_TEEN_ENTER, W190_TEEN_SWITCH, ...W190_FILLERS], {
      name: 'B09033 repeated full-scene switch',
      setup: {
        hand: [B09033.id], deckTop: [W190_TEEN_ENTER.id, W190_TEEN_SWITCH.id],
        fileCount: 1,
        selfScene: [
          { cardId: W190_EVENT_DRIVER.id, uid: 'event-driver' },
          ...W190_FILLERS.map((card, index) => ({ cardId: card.id, uid: `filler-${index}` })),
        ],
      },
      drive: { kind: 'declared', uid: 'event-driver', abilityId: 'use-event' },
      script: [
        { pickCardId: B09033.id },
        { pickCardId: W190_TEEN_ENTER.id, switchRemoveUid: 'filler-0', verifyPublic: true },
        'optional:take',
        { pickCardId: W190_TEEN_SWITCH.id, switchRemoveCardId: W190_TEEN_ENTER.id, verifyPublic: true },
        'optional:decline',
      ],
      expect: [],
    });
    expect({
      scene: state.players.self.scene.map(card => [card.cardId, card.uid]),
      remove: state.players.self.remove,
    }).toEqual({
      scene: expect.arrayContaining([[W190_TEEN_SWITCH.id, expect.any(String)]]),
      remove: expect.arrayContaining([W190_FILLERS[0]!.id, W190_TEEN_ENTER.id]),
    });
    expect(state.players.self.remove, B09033.id).toContain(W190_TEEN_ENTER.id);
  });

  it('B09036 production entry replaces its printed name and counts the renamed source itself', () => {
    const state = runCardScenario(B09036, [W190_NAME, W190_NAME_TWIN], {
      name: 'B09036 effective name replacement',
      setup: {
        selfScene: [{ cardId: B09036.id, uid: 'source' }, { cardId: W190_NAME_TWIN.id, uid: 'twin' }],
        hand: [W190_NAME.id],
      },
      drive: { kind: 'enter', cardId: B09036.id, uid: 'source' },
      script: ['optional:take', { pickCardId: W190_NAME.id }],
      expect: [{ kind: 'zone', cardId: W190_NAME.id, zone: 'hand', side: 'self', present: true }],
    });
    expect(read.char.names(state, 'source'), B09036.id).toEqual(['工藤優作']);
    expect(read.char.names(state, 'source')).not.toContain('怪盗キッド');
    expect(evalDyn(state, '$self.sameNameCount', {
      source: { player: 'self', uid: 'source', cardId: B09036.id }, bindings: {},
    }), B09036.id).toBe(2);
    expect(def.card(B09037.id)).toBe(B09037);
  });
});
