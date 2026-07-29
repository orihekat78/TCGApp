// BUG-195: eventRemoveByAP の単一 choice が sceneRemove pick を二重生成する回帰。
// rules: 15-abilities-effects.md, 19-special-rules.md
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { registerAll } from '@/cards';
import { D01015 } from '@/cards/ct-d01/D01015';
import { D02015 } from '@/cards/ct-d02/D02015';
import { D03015 } from '@/cards/ct-d03/D03015';
import { D04015 } from '@/cards/ct-d04/D04015';
import { D05015 } from '@/cards/ct-d05/D05015';
import { D07022 } from '@/cards/ct-d07/D07022';
import { D08025 } from '@/cards/ct-d08/D08025';
import { B05067 } from '@/cards/ct-p05/B05067';
import { B05069 } from '@/cards/ct-p05/B05069';
import { engine } from '@/engine';
import { event } from '@/engine/event';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { _resetTriggeredRegistered, registerTriggeredListener } from '@/engine/listeners/triggered';
import { createEmptyGameState } from '@/engine/state-factory';
import type { CardDef, GameState } from '@/engine/types';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { selectInteractionLocked } from '@/ui/state/interactionLock';
import { useGameStateStore } from '@/ui/state/store';
import { sceneChar } from '../helpers/fixtures';
import { dispatchCurrentDecision } from '../helpers/dispatch-current-decision';

const AP8000 = 'BUG195_AP8000';
const AP9000 = 'BUG195_AP9000';
const FBI = 'BUG195_FBI';

function testChar(id: string, ap: number): CardDef {
  return {
    id, no: `BUG195/${id}`, kind: 'character', names: [id], colors: ['青'],
    level: 1, ap, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '',
    abilities: [], ruleRefs: [],
  };
}

function fixture(opts: { partnerGreen?: boolean; with8000?: boolean; with9000?: boolean } = {}): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
  s.players.self.partner.cardId = opts.partnerGreen === false ? 'D01001' : 'D02001';
  s.players.self.case.cardId = 'D02016';
  s.players.self.case.colors = ['緑'];
  s.players.self.hand = ['D02015'];
  s.players.self.file = Array.from({ length: 5 }, () => ({ type: 'card-back' as const, cardId: 'D02002' }));
  if (opts.with8000 !== false) s.players.opp.scene.push(sceneChar(AP8000, 'ap8000'));
  if (opts.with9000) s.players.opp.scene.push(sceneChar(AP9000, 'ap9000'));
  return s;
}

beforeEach(() => {
  engine.cards._resetRegistry();
  event._resetRegistry();
  _resetTriggeredRegistered();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = 'self';
  registerAll();
  engine.cards.register(testChar(AP8000, 8000));
  engine.cards.register(testChar(AP9000, 9000));
  engine.cards.register({ ...testChar(FBI, 3000), traits: ['FBI'] });
  registerTriggeredListener();
  useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
});

afterEach(() => {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  useGameStateStore.setState({ gameState: null, pendingEffectPick: null });
});

describe('BUG-195 eventRemoveByAP', () => {
  it('D02015: 対象解決後に同一pickを再生成せず、interaction lockを解除する', () => {
    useGameStateStore.getState().setGameState(fixture({ with9000: true }));
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: 'D02015' })).toEqual({ ok: true });
    const pending = useGameStateStore.getState().pendingEffectPick;
    expect(pending?.atomVerb).toBe('sceneRemove');
    expect(pending?.candidates.map(c => c.uid)).toEqual(['ap8000']);

    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'ap8000' })).toEqual({ ok: true });
    const store = useGameStateStore.getState();
    expect(store.gameState?.players.opp.scene.map(c => c.uid)).toEqual(['ap9000']);
    expect(store.gameState?.players.opp.remove).toContain(AP8000);
    expect(store.pendingEffectPick).toBeNull();
    expect(store.gameState?.pendingEffects.some(e => e.state === 'pending' || e.state === 'resolving')).toBe(false);
    expect(selectInteractionLocked(store)).toBe(false);
  });

  it('D02015: 0枚選択でもpendingとlockを残さない', () => {
    useGameStateStore.getState().setGameState(fixture());
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: 'D02015' }).ok).toBe(true);
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: null })).toEqual({ ok: true });
    const store = useGameStateStore.getState();
    expect(store.gameState?.players.opp.scene.map(c => c.uid)).toEqual(['ap8000']);
    expect(store.pendingEffectPick).toBeNull();
    expect(selectInteractionLocked(store)).toBe(false);
  });

  it('D02015: AP9000のみなら候補なし、partner不一致なら能力不発', () => {
    useGameStateStore.getState().setGameState(fixture({ with8000: false, with9000: true }));
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: 'D02015' }).ok).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
    expect(selectInteractionLocked(useGameStateStore.getState())).toBe(false);

    useGameStateStore.getState().setGameState(fixture({ partnerGreen: false }));
    useGameStateStore.getState().setPendingEffectPick(null);
    expect(dispatchEngineAction({ type: 'handUseCard', player: 'self', cardId: 'D02015' }).ok).toBe(true);
    expect(useGameStateStore.getState().pendingEffectPick).toBeNull();
  });

  it('共有7カード: choiceを持たず、AP8000以下を1枚まで選ぶ同一atom', () => {
    for (const card of [D01015, D02015, D03015, D04015, D05015, D07022, D08025]) {
      expect(card.abilities[0]?.effect, card.id).toMatchObject({
        kind: 'atom',
        verb: 'sceneRemove',
        args: { player: 'self', side: 'either', max: 1, cause: 'effect', filter: { apMax: 8000 } },
      });
    }
  });

  it.each([
    ['B05067 a2', B05067.id, 'a2'],
    ['B05069 a1', B05069.id, 'a1'],
  ] as const)('%s: 対象解決後に同一sceneRemove pickを残さない', (_label, cardId, abilityId) => {
    const s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.partner.cardId = 'D04001';
    s.players.self.scene = [sceneChar(cardId, 'source')];
    if (cardId === 'B05069') {
      s.players.self.scene.push(sceneChar(FBI, 'fbi-1'), sceneChar(FBI, 'fbi-2'));
    }
    s.players.opp.scene = [sceneChar(AP8000, 'target')];
    useGameStateStore.getState().setGameState(s);

    expect(dispatchEngineAction({ type: 'declaredAbility', uid: 'source', abilId: abilityId })).toEqual({ ok: true });
    expect(useGameStateStore.getState().pendingEffectPick?.candidates.map(c => c.uid)).toContain('target');
    expect(dispatchCurrentDecision({ type: 'effectPickResolve', pickedUid: 'target' })).toEqual({ ok: true });
    const store = useGameStateStore.getState();
    expect(store.gameState?.players.opp.scene).toHaveLength(0);
    expect(store.pendingEffectPick).toBeNull();
    expect(selectInteractionLocked(store)).toBe(false);
  });
});
