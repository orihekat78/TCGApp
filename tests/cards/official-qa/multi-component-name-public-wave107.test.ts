// qa: card:B09052:45a28272794215b6465b92629940788c48e8cb3de486869a26a5a34e1a4f6a73
// qa: card:B09052:52e25d1fb9d3623390ecb00ccb1047978985d54514cf0287453e6c0e3105c82a
// Rules: 09-cutin-disguise, 19-special-rules, 22-qa-action-contact.

import { beforeEach, describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { B09052 } from '@/cards/ct-p09/B09052';
import { B09052P } from '@/cards/ct-p09/B09052P';
import { event } from '@/engine/event';
import { cutIn } from '@/engine/flow/contact';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { mutate } from '@/engine/mutate';
import { char as readChar } from '@/engine/read/char';
import { _resetRegistry, register } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve';
import { createEmptyGameState } from '@/engine/state-factory';
import type { ActionContext, CardDef, GameState } from '@/engine/types';

const COMBINED_NAME = '江戸川コナン&工藤新一';
const COMBINED = fixture('W107-COMBINED', [COMBINED_NAME, '江戸川コナン', '工藤新一']);
const COMPONENT_ONLY = fixture('W107-COMPONENT', ['江戸川コナン']);
const OPPONENT = fixture('W107-OPPONENT', ['対戦相手'], {
  abilities: [{
    id: 'observe-cutin',
    type: 'triggered',
    scope: 'on-scene',
    trigger: { hook: 'cutin:used' },
    effect: { kind: 'atom', verb: 'noop', args: {} },
    description: 'cut-in observer dyn isolation fixture',
    ruleRefs: [],
  }],
});

function fixture(id: string, names: string[], options: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names, colors: ['青'], level: 3, ap: 3000, lp: 1,
    traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
    ...options,
  } as CardDef;
}

function setup(card: CardDef): { state: GameState; action: ActionContext; sourceUid: string } {
  const state = createEmptyGameState();
  state.turn = { number: 5, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  const sourceUid = mutate.scene.enter(state, 'self', COMBINED.id, {}).uid;
  mutate.scene.enter(state, 'self', COMPONENT_ONLY.id, {});
  const targetUid = mutate.scene.enter(state, 'opp', OPPONENT.id, {}).uid;
  state.players.self.hand = [card.id];
  const action: ActionContext = {
    id: `wave107-${card.id}`,
    byUid: sourceUid,
    byPlayer: 'self',
    target: { kind: 'char', uid: targetUid },
    phase: 'action-1',
    cutInUsed: {},
    startedAt: { turn: 5, nano: 0 },
    apSnapshot: { aUid: sourceUid, aAP: 3000, bUid: targetUid, bAP: 3000 },
    contactImmune: false,
  };
  return { state, action, sourceUid };
}

type CutInWithDeclaredName = (
  state: GameState,
  action: ActionContext,
  player: 'self' | 'opp',
  cardId: string,
  abilityId?: string,
  declaredName?: string,
) => void;

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  _resetRegistry();
  for (const card of [B09052, B09052P, COMBINED, COMPONENT_ONLY, OPPONENT]) register(card);
  registerTriggeredListener();
});

describe('official QA Wave107: a combined card name is one exact declared name', () => {
  it.each([B09052, B09052P])('$id cut-in counts the combined name but not its component-only decoy', card => {
    const { state, action, sourceUid } = setup(card);
    const before = readChar.ap(state, sourceUid);
    const after = produce(state, draft => {
      (cutIn as CutInWithDeclaredName)(draft, action, 'self', card.id, 'a2', COMBINED_NAME);
      runAllUntilEmpty(draft);
    });

    // Card-bound physical rows: B09052/P.
    expect(readChar.ap(after, sourceUid)).toBe(before + 1000);
    const observer = after.pendingEffects.find(entry => entry.source.cardId === OPPONENT.id);
    expect(observer).toBeDefined();
    expect(observer?.dyn?.declaredName).toBeUndefined();
  });

  it.each([B09052, B09052P])('$id rejects an unregistered cut-in name before consuming the card', card => {
    const { state, action } = setup(card);
    const before = JSON.stringify(state);

    expect(() => produce(state, draft => {
      (cutIn as CutInWithDeclaredName)(draft, action, 'self', card.id, 'a2', '存在しないカード名');
    })).toThrow(/declared name|registered/i);
    expect(JSON.stringify(state)).toBe(before);
  });
});
