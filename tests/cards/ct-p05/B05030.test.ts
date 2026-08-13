// tests/cards/ct-p05/B05030 遠山銀司郎
// session64: 主眼 a2「【自分ターン中】セットされているカード1枚につき AP+1000」を
// $self.setCardCount dyn で解禁 (engine additive)。D08005 (faceUpEvidence) と同型の継続修飾。

import { describe, it, expect, beforeEach } from 'vitest';
import { engine } from '@/engine';
import { createEmptyGameState } from '@/engine/state-factory';
import { produce } from '@/engine/produce';
import { char as charRead } from '@/engine/read/char';
import { candidates } from '@/engine/target/candidates';
import { projectReplayStateForViewer } from '@/ui/services/replayViewerProjection';
import { B05030 } from '@/cards/ct-p05/B05030';
import { FILE_CARD_BACK_PLACEHOLDER, type CardDef, type GameState } from '@/engine/types';

const SET_CHARACTER: CardDef = {
  id: 'B05030-SET-CHARACTER', no: 'TEST/B05030-SET-CHARACTER', kind: 'character', names: ['set character'], colors: [], traits: [], level: 1, ap: 1000, lp: 1, keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const SET_EVENT: CardDef = {
  id: 'B05030-SET-EVENT', no: 'TEST/B05030-SET-EVENT', kind: 'event', names: ['set event'], colors: [], traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};

describe('B05030 遠山銀司郎 (突撃[キャラ] + 登場時set + 自分ターン中 set数×AP)', () => {
  it('shape: id, kind, level=6, ap=5000, lp=1, traits警察+大阪府警, 突撃[キャラ]', () => {
    expect(B05030.id).toBe('B05030');
    expect(B05030.kind).toBe('character');
    expect(B05030.names).toEqual(['遠山銀司郎']);
    expect(B05030.colors).toEqual(['緑']);
    expect(B05030.level).toBe(6);
    expect(B05030.ap).toBe(5000);
    expect(B05030.lp).toBe(1);
    expect(B05030.traits).toEqual(['警察', '大阪府警']);
    expect(B05030.keywords).toEqual(['突撃[キャラ]']);
    // a1 登場時set + a2 継続 set数×AP の2能力
    expect(B05030.abilities.length).toBe(2);
  });

  it('a1: 【登場時】charSetCard fromDeckTop (既存出荷分)', () => {
    const a1 = B05030.abilities[0];
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toEqual({ hook: 'enter', selfOnly: true });
    const eff = a1.effect as { kind: string; verb: string; args: { fromDeckTop: boolean } };
    expect(eff.verb).toBe('charSetCard');
    expect(eff.args.fromDeckTop).toBe(true);
  });

  it('a2: continuous (自分ターン中 × apDelta dyn = setCardCount * 1000)', () => {
    const a2 = B05030.abilities[1];
    expect(a2.id).toBe('a2');
    expect(a2.type).toBe('continuous');
    expect(a2.condition).toEqual({ kind: 'turn', player: 'self' });
    expect(a2.continuousModifier?.apDelta).toEqual({ dyn: '$self.setCardCount * 1000' });
  });
});

// a2 が実機で動作する数値オラクル。engine.read.char.ap が continuousModifier.apDelta (dyn) を
// read 時に走査・合算 ($self.setCardCount = このキャラの setCards 枚数)。
describe('B05030 a2 behavioral — engine.read.char.ap が set 枚数でスケール (rules/24 常時有効型)', () => {
  beforeEach(() => {
    engine.cards._resetRegistry();
    engine.cards.register(B05030);
    engine.cards.register(SET_CHARACTER);
    engine.cards.register(SET_EVENT);
  });

  function makeState(opts: {
    setCards: number;
    stacked?: number;
    turnPlayer: 'self' | 'opp';
    side?: 'self' | 'opp';
  }): GameState {
    const side = opts.side ?? 'self';
    return produce(createEmptyGameState(), (d) => {
      d.turn.player = opts.turnPlayer;
      d.players[side].scene.push({
        cardId: 'B05030',
        uid: 'B05030#0',
        state: 'active',
        isNamed: false,
        enterOrder: 1,
        enterOrderThisTurn: 1,
        setCards: Array.from({ length: opts.setCards }, (_, i) => ({ cardId: `set${i}`, faceUp: false })),
        stackedCards: opts.stacked ?? 0,
        keywordOverrides: { granted: [], disabledOriginal: false },
        apOverride: null,
        lpOverride: null,
        turnEffects: { contactImmune: false, removeOnTurnEnd: false },
        declaredUseCount: {},
      });
    });
  }

  it('自分ターン中・セット2枚 → AP = base5000 + 2*1000 = 7000', () => {
    const s = makeState({ setCards: 2, turnPlayer: 'self' });
    expect(charRead.ap(s, 'B05030#0')).toBe(7000);
  });

  it('セット0枚 → AP = 5000', () => {
    const s = makeState({ setCards: 0, turnPlayer: 'self' });
    expect(charRead.ap(s, 'B05030#0')).toBe(5000);
  });

  it('re-reads the continuous AP after this same character receives a set card', () => {
    let s = makeState({ setCards: 0, turnPlayer: 'self' });
    expect(charRead.ap(s, 'B05030#0')).toBe(5000);
    s = produce(s, (draft) => {
      draft.players.self.scene[0]!.setCards.push({ cardId: SET_CHARACTER.id, faceUp: false });
    });
    expect(charRead.ap(s, 'B05030#0')).toBe(6000);
  });

  it('相手ターン中 → condition {turn:self} false で加算なし (AP = 5000)', () => {
    const s = makeState({ setCards: 3, turnPlayer: 'opp' });
    expect(charRead.ap(s, 'B05030#0')).toBe(5000);
  });

  it('stackedCards は数えない (set1 + stacked3 → AP = 6000)', () => {
    const s = makeState({ setCards: 1, stacked: 3, turnPlayer: 'self' });
    expect(charRead.ap(s, 'B05030#0')).toBe(6000);
  });

  // turn:self は owner 基準 (cond/eval.ts: state.turn.player === resolvePlayer('self', ctx=owner))。
  // 相手 scene 上の B05030 は「相手ターン中」= owner(相手)のターン中なので条件成立 → スケールする
  // (D08005 a1 opp-side 8000 テストと同流儀)。
  it('相手scene上 (owner=opp) + 相手ターン中 → turn:self は owner基準で true、セット2枚で AP = 7000', () => {
    const s = makeState({ setCards: 2, turnPlayer: 'opp', side: 'opp' });
    expect(charRead.ap(s, 'B05030#0')).toBe(7000);
  });

  function resolveA1WithTopCard(cardId: string, state = makeState({ setCards: 0, turnPlayer: 'self' })): GameState {
    let s = produce(state, (draft) => {
      draft.players.self.deck = [cardId];
    });

    s = produce(s, (draft) => {
      engine.effect.run(draft, B05030.abilities[0]!.effect!, {
        source: { cardId: 'B05030', uid: 'B05030#0', abilityId: 'a1', player: 'self', area: 'scene' },
        bindings: {},
      });
    });
    return s;
  }

  function sceneCandidates(s: GameState, kind: 'character' | 'event') {
    return candidates(s, {
      kind: 'pick',
      chooser: 'owner',
      n: { min: 0, max: 2 },
      query: { area: 'scene', side: 'self', filter: { kind } },
    }, {
      source: { cardId: 'B05030', uid: 'B05030#0', abilityId: 'a1', player: 'self', area: 'scene' },
      bindings: {},
    });
  }

  it.each([
    ['character', SET_CHARACTER.id],
    ['event', SET_EVENT.id],
  ])('Q&A: a1が裏向きでセットした%sは、現場キャラでもイベントでもなく表面を公開しない', (_kind, setCardId) => {
    const before = makeState({ setCards: 0, turnPlayer: 'self' });
    const sceneCharacterCountBefore = sceneCandidates(before, 'character').length;
    const s = resolveA1WithTopCard(setCardId, before);

    expect(s.players.self.scene[0]!.setCards).toMatchObject([{ cardId: setCardId, faceUp: false }]);
    const sceneCharacters = sceneCandidates(s, 'character');
    expect(sceneCharacters).toHaveLength(sceneCharacterCountBefore);
    expect(sceneCharacters).toEqual([
      { kind: 'char', uid: 'B05030#0', cardId: 'B05030', player: 'self' },
    ]);
    expect(sceneCandidates(s, 'event')).toEqual([]);

    const publicState = projectReplayStateForViewer(s, 'solo-self');
    expect(publicState.players.self.scene[0]!.setCards).toEqual([{
      cardId: FILE_CARD_BACK_PLACEHOLDER,
      faceUp: false,
      instanceId: 'hidden-set:0',
    }]);
    expect(JSON.stringify(publicState)).not.toContain(setCardId);
  });

  it('Q&A: set card remains on its host scene character and is removed when that host leaves', () => {
    let s = resolveA1WithTopCard(SET_CHARACTER.id);
    expect(s.players.self.scene[0]!.setCards).toMatchObject([{ cardId: SET_CHARACTER.id, faceUp: false }]);

    s = produce(s, (draft) => {
      engine.mutate.scene.removeToRemove(draft, 'B05030#0', 'effect');
    });

    expect(s.players.self.scene).toEqual([]);
    expect(s.players.self.remove).toEqual(expect.arrayContaining([SET_CHARACTER.id, 'B05030']));
  });
});
