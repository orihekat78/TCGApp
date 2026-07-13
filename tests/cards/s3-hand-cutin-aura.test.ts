// S3 hand-zone cutin aura — B06020 / B07003(+P) production probes.
// rules: 08-contact.md, 09-cutin-disguise.md, 17-icons.md, 19-special-rules.md,
//        21-declared-ability-cost.md, 22-qa-action-contact.md
import { beforeEach, describe, expect, it } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { mutate } from '@/engine/mutate/index';
import { canCutIn, cutIn } from '@/engine/flow/contact';
import { activateDeclaredAbility } from '@/engine/flow/main/ability-activate';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { drainAiEffectPicks } from '@/engine/effect/apply-pick';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { HeuristicPolicy } from '@/ai/policies/heuristic';
import { char as readChar } from '@/engine/read/char';
import { B06020 } from '@/cards/ct-p06/B06020';
import { B07003 } from '@/cards/ct-p07/B07003';
import { B07003P } from '@/cards/ct-p07/B07003P';
import type { ActionContext, CardDef, GameState } from '@/engine/types';

const ch = (id: string, over: Partial<CardDef> = {}): CardDef => ({
  id, no: id, kind: 'character', names: [id], colors: ['緑'], level: 3, ap: 3000, lp: 1,
  traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...over,
});
const GREEN_YAIBA = ch('GREEN_YAIBA', { traits: ['YAIBA'] });
const GREEN_OTHER = ch('GREEN_OTHER');
const BLUE_CARD = ch('BLUE_CARD', { colors: ['青'] });
const RED_CARD = ch('RED_CARD', { colors: ['赤'] });
const ATTACKER = ch('ATTACKER', { ap: 3000 });
const DEFENDER = ch('DEFENDER', { ap: 2000 });
const CONAN = ch('CONAN', { names: ['江戸川コナン'], colors: ['青'], level: 8 });
const CONAN_PAIR = ch('CONAN_PAIR', { names: ['江戸川コナン', '工藤新一'], colors: ['青'], level: 9 });
const REMOVE_DECOY = ch('REMOVE_DECOY', { names: ['毛利蘭'], colors: ['青'] });
const BLUE_PARTNER: CardDef = {
  id: 'BLUE_PARTNER', no: 'BLUE_PARTNER', kind: 'partner', names: ['BLUE_PARTNER'], colors: ['青'],
  lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [],
};
const FILLER = ch('FILLER');

function base(turn: 'self' | 'opp' = 'self'): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 3, player: turn, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  return s;
}

function ax(attackerUid: string, defenderUid: string): ActionContext {
  return {
    id: 'ax-aura', byUid: attackerUid, byPlayer: 'self', target: { kind: 'char', uid: defenderUid },
    phase: 'action-1', cutInUsed: {}, startedAt: { turn: 3, nano: 0 },
    apSnapshot: { aUid: attackerUid, aAP: 3000, bUid: defenderUid, bAP: 2000 }, contactImmune: false,
  };
}

function settle(s: GameState): void {
  const policy = new HeuristicPolicy();
  for (let i = 0; i < 12; i++) {
    runAllUntilEmpty(s);
    const q = (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue;
    if (!q?.length) break;
    drainAiEffectPicks(s, policy);
  }
  runAllUntilEmpty(s);
}

function emitEnter(s: GameState, cardId: string): string {
  const c = mutate.scene.enter(s, 'self', cardId, {});
  event.emit(
    s,
    'enter',
    { uid: c.uid, player: 'self', enterOrder: c.enterOrder, enterOrderThisTurn: c.enterOrderThisTurn },
    { player: 'self', cardId, uid: c.uid },
  );
  return c.uid;
}

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
  for (const d of [
    B06020, B07003, B07003P, GREEN_YAIBA, GREEN_OTHER, BLUE_CARD, RED_CARD,
    ATTACKER, DEFENDER, CONAN, CONAN_PAIR, REMOVE_DECOY, BLUE_PARTNER, FILLER,
  ]) registerCardDef(d);
  registerTriggeredListener();
});

describe('hand-zone cutin aura', () => {
  it('B06020: 自分ターン中だけ、自手札の緑YAIBAキャラへ AP+2000 cutin を付与して解決する', () => {
    const s = base('self');
    const atk = mutate.scene.enter(s, 'self', 'ATTACKER', {});
    const def = mutate.scene.enter(s, 'opp', 'DEFENDER', {});
    s.players.self.hand = ['B06020', 'GREEN_YAIBA', 'GREEN_OTHER'];
    const contact = ax(atk.uid, def.uid);

    expect(canCutIn(s, contact, 'self', 'GREEN_YAIBA')).toBe(true);
    expect(canCutIn(s, contact, 'self', 'GREEN_OTHER')).toBe(false);
    cutIn(s, contact, 'self', 'GREEN_YAIBA');
    settle(s);

    expect(readChar.ap(s, atk.uid)).toBe(5000);
    expect(s.players.self.hand).not.toContain('GREEN_YAIBA');
    expect(s.players.self.remove).toContain('GREEN_YAIBA');
  });

  it('B06020: 相手ターン・相手手札の付与元・付与元離脱では aura が無効', () => {
    const s = base('opp');
    const atk = mutate.scene.enter(s, 'self', 'ATTACKER', {});
    const def = mutate.scene.enter(s, 'opp', 'DEFENDER', {});
    s.players.self.hand = ['GREEN_YAIBA'];
    s.players.opp.hand = ['B06020'];
    const contact = ax(atk.uid, def.uid);
    expect(canCutIn(s, contact, 'self', 'GREEN_YAIBA')).toBe(false);

    s.turn.player = 'self';
    expect(canCutIn(s, contact, 'self', 'GREEN_YAIBA')).toBe(false);
    s.players.self.hand.push('B06020');
    expect(canCutIn(s, contact, 'self', 'GREEN_YAIBA')).toBe(true);
    s.players.self.hand.splice(s.players.self.hand.indexOf('B06020'), 1);
    expect(canCutIn(s, contact, 'self', 'GREEN_YAIBA')).toBe(false);
  });

  it('同じ対象カードが手札に2枚あっても、使用した1枚の cutin 効果だけを1回解決する', () => {
    const s = base('self');
    const atk = mutate.scene.enter(s, 'self', 'ATTACKER', {});
    const def = mutate.scene.enter(s, 'opp', 'DEFENDER', {});
    s.players.self.hand = ['B06020', 'GREEN_YAIBA', 'GREEN_YAIBA'];
    const contact = ax(atk.uid, def.uid);

    cutIn(s, contact, 'self', 'GREEN_YAIBA');
    settle(s);

    expect(readChar.ap(s, atk.uid)).toBe(5000);
    expect(s.players.self.hand.filter(id => id === 'GREEN_YAIBA')).toHaveLength(1);
  });

  it('B07003/P: 自手札の青カードへ AP+1000 cutin を付与し、色外 decoy は除外する', () => {
    for (const sourceId of ['B07003', 'B07003P']) {
      const s = base('opp');
      const atk = mutate.scene.enter(s, 'self', 'ATTACKER', {});
      const def = mutate.scene.enter(s, 'opp', 'DEFENDER', {});
      s.players.self.hand = [sourceId, 'BLUE_CARD', 'RED_CARD'];
      const contact = ax(atk.uid, def.uid);
      expect(canCutIn(s, contact, 'self', 'BLUE_CARD'), sourceId).toBe(true);
      expect(canCutIn(s, contact, 'self', 'RED_CARD'), sourceId).toBe(false);
      cutIn(s, contact, 'self', 'BLUE_CARD');
      settle(s);
      expect(readChar.ap(s, atk.uid), sourceId).toBe(4000);
    }
  });
});

describe('B06020 production declared ability', () => {
  it('sleepSelf + deck top 3 remove を払い、active 相手キャラとの効果コンタクトを開始する', () => {
    const s = base('self');
    const me = mutate.scene.enter(s, 'self', 'B06020', {});
    const target = mutate.scene.enter(s, 'opp', 'DEFENDER', {});
    s.players.self.deck = ['FILLER', 'FILLER', 'FILLER', 'FILLER'];

    activateDeclaredAbility(s, me.uid, 'a2');
    settle(s);

    expect(s.players.self.scene.find(c => c.uid === me.uid)?.state).toBe('sleep');
    expect(s.players.self.remove.filter(id => id === 'FILLER')).toHaveLength(3);
    expect(s.players.opp.scene.find(c => c.uid === target.uid)?.state).toBe('active');
    expect(s.log.some(l => l.action === 'effect:startContact' && l.target === target.uid)).toBe(true);
  });
});

describe('B07003 production enter ability', () => {
  it('青P登場時: scene 江戸川コナン→remove の分割名 江戸川コナン&工藤新一を選び、相手deck下へ移す', () => {
    const s = base('self');
    s.players.self.partner.cardId = 'BLUE_PARTNER';
    mutate.scene.enter(s, 'opp', 'CONAN', {});
    s.players.opp.remove = ['CONAN_PAIR', 'REMOVE_DECOY'];

    emitEnter(s, 'B07003');
    settle(s);

    expect(s.players.opp.scene.some(c => c.cardId === 'CONAN')).toBe(false);
    expect(s.players.opp.remove).not.toContain('CONAN_PAIR');
    expect(s.players.opp.remove).toContain('REMOVE_DECOY');
    expect(s.players.opp.deck).toEqual(expect.arrayContaining(['CONAN', 'CONAN_PAIR']));
  });

  it('scene のレベル8以下を選べない場合、remove 側だけを選ぶことはできない', () => {
    const s = base('self');
    s.players.self.partner.cardId = 'BLUE_PARTNER';
    s.players.opp.remove = ['CONAN_PAIR'];

    emitEnter(s, 'B07003');
    settle(s);

    expect(s.players.opp.remove).toContain('CONAN_PAIR');
    expect(s.players.opp.deck).not.toContain('CONAN_PAIR');
  });
});
