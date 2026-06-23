// MR能力① (rules/18:14-23): 相手ターン中に現場を離れる MR キャラは partnerAreaMR slot へ移動する。
// engine/mr-partner-area-core (2026-06-23). decoy test (実 MR/非 MR を register して isMR gate を検証)。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { produce as immerProduce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { scene } from '@/engine/mutate/scene';
import { register, _resetRegistry } from '@/engine/read/def';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import type { GameState, SceneCharacter, CardDef } from '@/engine/types';
import { makeChar } from '../../helpers/fixtures';

function mkDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `0/${id}`, kind: 'character', names: [id], colors: ['青'],
    traits: [], rarity: 'R', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

function makeState(selfScene: SceneCharacter[] = [], oppScene: SceneCharacter[] = []): GameState {
  const s = createEmptyGameState();
  return {
    ...s,
    players: {
      self: { ...s.players.self, scene: selfScene },
      opp: { ...s.players.opp, scene: oppScene },
    },
  };
}

describe('MR能力① — 相手ターン中の現場離脱 → partnerAreaMR (rules/18)', () => {
  beforeEach(() => {
    _resetRegistry();
    register(mkDef('MR1', { rarity: 'MR', ap: 3000, lp: 1000 }));
    register(mkDef('MRP1', { rarity: 'MRP' })); // parallel printing も MR
    register(mkDef('NMR', { rarity: 'R' }));
  });

  it('相手ターン中に removeToRemove された MR は opp.partnerAreaMR へ移り remove に残らない (refresh 単一計上)', () => {
    const mr = makeChar({ cardId: 'MR1', uid: 'MR1#1', state: 'sleep' });
    const s = makeState([], [mr]);
    s.turn.player = 'self'; // opp から見て「相手ターン」
    const r = produce(s, d => { scene.removeToRemove(d, 'MR1#1', 'effect'); });
    expect(r.players.opp.partnerAreaMR?.cardId).toBe('MR1');
    expect(r.players.opp.scene).toHaveLength(0);
    expect(r.players.opp.remove).not.toContain('MR1');
  });

  it('MRP (parallel) も MR として redirect される', () => {
    const mr = makeChar({ cardId: 'MRP1', uid: 'MRP1#1' });
    const s = makeState([], [mr]);
    s.turn.player = 'self';
    const r = produce(s, d => { scene.removeToRemove(d, 'MRP1#1', 'effect'); });
    expect(r.players.opp.partnerAreaMR?.cardId).toBe('MRP1');
  });

  it('自分のターン中 (owner=turn.player) の離脱は redirect しない → remove へ', () => {
    const mr = makeChar({ cardId: 'MR1', uid: 'MR1#1' });
    const s = makeState([], [mr]);
    s.turn.player = 'opp'; // owner 自身のターン
    const r = produce(s, d => { scene.removeToRemove(d, 'MR1#1', 'effect'); });
    expect(r.players.opp.partnerAreaMR == null).toBe(true);
    expect(r.players.opp.remove).toContain('MR1');
  });

  it('非 MR キャラは相手ターンでも redirect しない (decoy)', () => {
    const c = makeChar({ cardId: 'NMR', uid: 'NMR#1' });
    const s = makeState([], [c]);
    s.turn.player = 'self';
    const r = produce(s, d => { scene.removeToRemove(d, 'NMR#1', 'effect'); });
    expect(r.players.opp.partnerAreaMR == null).toBe(true);
    expect(r.players.opp.remove).toContain('NMR');
  });

  it('全 leave verb (toDeck / toHand / toDeckBottom) で redirect する', () => {
    for (const verb of ['toDeck', 'toHand', 'toDeckBottom'] as const) {
      const mr = makeChar({ cardId: 'MR1', uid: 'MR1#9' });
      const s = makeState([], [mr]);
      s.turn.player = 'self';
      const r = produce(s, d => { (scene[verb] as (st: GameState, u: string) => void)(d, 'MR1#9'); });
      expect(r.players.opp.partnerAreaMR?.cardId, verb).toBe('MR1');
      expect(r.players.opp.deck, verb).not.toContain('MR1');
      expect(r.players.opp.hand, verb).not.toContain('MR1');
      expect(r.players.opp.scene, verb).toHaveLength(0);
    }
  });

  it('rules/16: set/重ねカードは現場離脱でリムーブ (PA へ同伴しない)', () => {
    const mr = makeChar({
      cardId: 'MR1', uid: 'MR1#1',
      setCards: [{ cardId: 'SET1', faceUp: true }], stackedCards: 1,
    });
    const s = makeState([], [mr]);
    s.turn.player = 'self';
    const r = produce(s, d => { scene.removeToRemove(d, 'MR1#1', 'effect'); });
    expect(r.players.opp.partnerAreaMR?.setCards).toEqual([]);
    expect(r.players.opp.partnerAreaMR?.stackedCards).toBe(0);
    expect(r.players.opp.remove).toContain('SET1');
  });

  it('state (stun/sleep) を snapshot 引き継ぎ + uid を partnerMR sentinel へ書換', () => {
    const mr = makeChar({ cardId: 'MR1', uid: 'MR1#1', state: 'stun' });
    const s = makeState([], [mr]);
    s.turn.player = 'self';
    const r = produce(s, d => { scene.removeToRemove(d, 'MR1#1', 'effect'); });
    expect(r.players.opp.partnerAreaMR?.state).toBe('stun');
    expect(r.players.opp.partnerAreaMR?.uid).toBe('partnerMR:opp');
  });

  it('名乗り状態は PA で解除される (placeMrInPA isNamed=false)', () => {
    const mr = makeChar({ cardId: 'MR1', uid: 'MR1#1', isNamed: true });
    const s = makeState([], [mr]);
    s.turn.player = 'self';
    const r = produce(s, d => { scene.removeToRemove(d, 'MR1#1', 'effect'); });
    expect(r.players.opp.partnerAreaMR?.isNamed).toBe(false);
  });

  // 未解決#1 暫定解の核心 (rules/18:22「リムーブによって発動する能力は MR のリムーブでも発動」):
  // leave:to-remove hook を redirect の **前** に emit するため、【現場リムーブ時】の発火と PA 移動が両立する。
  it('MR① redirect でも【現場リムーブ時】triggered は発火する (hook 発火 ∧ PA 移動 両立)', () => {
    const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'opp', n: 1 } };
    register(mkDef('MR_TRIG', { rarity: 'MR', abilities: [{
      id: 'a1', type: 'triggered', scope: 'on-scene',
      trigger: { hook: 'leave:to-remove', selfOnly: true }, effect, description: '',
    }] }));
    _resetTriggeredRegistered();
    registerTriggeredListener();
    const mr = makeChar({ cardId: 'MR_TRIG', uid: 'MR_TRIG#1' });
    const s = makeState([], [mr]);
    s.turn.player = 'self'; // opp の相手ターン
    const r = immerProduce(s, d => { scene.removeToRemove(d, 'MR_TRIG#1', 'effect'); });
    expect(r.players.opp.partnerAreaMR?.cardId).toBe('MR_TRIG'); // PA 移動
    expect(r.pendingEffects.length).toBeGreaterThanOrEqual(1); // 【現場リムーブ時】発火
    expect(r.players.opp.remove).not.toContain('MR_TRIG'); // refresh 単一計上
  });

  describe('全 leave verb で set/重ねカードを remove へ (rules/16、PA へ同伴しない)', () => {
    for (const verb of ['toDeck', 'toHand', 'toDeckBottom'] as const) {
      it(`${verb}: set/stack は remove へ、slot は空`, () => {
        const mr = makeChar({
          cardId: 'MR1', uid: 'MR1#1',
          setCards: [{ cardId: 'SET1', faceUp: true }], stackedCards: 1,
        });
        const s = makeState([], [mr]);
        s.turn.player = 'self';
        const r = produce(s, d => { (scene[verb] as (st: GameState, u: string) => void)(d, 'MR1#1'); });
        expect(r.players.opp.partnerAreaMR?.setCards, verb).toEqual([]);
        expect(r.players.opp.partnerAreaMR?.stackedCards, verb).toBe(0);
        expect(r.players.opp.remove, verb).toContain('SET1');
        expect(r.players.opp.remove.filter(c => c === 'back-card').length, verb).toBe(1);
      });
    }
  });
});
