// Phase 4 Group C Task 4.8 — target expander (G29) + mustBeTargeted (G28)
// spec: .claude/specs/engine-api-flow-control.md
// rules: 07-action-flow.md, cards-analysis/D11005 (挑発), cards-analysis/D11007 (level≥7 active 拡張)

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import {
  candidates,
  mustTargetCandidates,
  registerTargetExpander,
  _resetTargetExpanders,
  _hasExpander,
} from '@/engine/flow/action/target-expander';
import { declare, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { canActionAgainstChar } from '@/engine/flow/main/action';
import { event } from '@/engine/event/index';
import { mutate } from '@/engine/mutate/index';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import type { CardDef, GameState } from '@/engine/types';

function makeCard(id: string, opts: Partial<CardDef> = {}): CardDef {
  return {
    id,
    no: id,
    kind: opts.kind ?? 'character',
    names: opts.names ?? [id],
    colors: opts.colors ?? ['赤'],
    level: opts.level ?? 1,
    ap: opts.ap ?? 1000,
    lp: opts.lp ?? 1000,
    traits: opts.traits ?? [],
    rarity: opts.rarity ?? 'C',
    imageUrl: opts.imageUrl ?? '',
    abilities: opts.abilities ?? [],
    ruleRefs: opts.ruleRefs ?? [],
    ...opts,
  };
}

/**
 * makeBoard — self に attacker active を 1 体、opp に N 体配置する単純な盤面。
 */
function makeBoard(opts: {
  oppChars?: Array<{
    id: string;
    state?: 'active' | 'sleep' | 'stun';
    level?: number;
    mustBeTargeted?: boolean;
  }>;
} = {}): { s: GameState; selfUid: string; oppUids: string[] } {
  _resetUidCounter();
  resetDefRegistry();
  _resetTargetExpanders();
  _resetActionContexts();
  registerCardDef(makeCard('Atk', { ap: 2000 }));
  for (const o of opts.oppChars ?? []) {
    registerCardDef(makeCard(o.id, { level: o.level ?? 1 }));
  }
  const initial = createEmptyGameState();
  let selfUid = '';
  const oppUids: string[] = [];
  const s = produce(initial, draft => {
    const a = mutate.scene.enter(draft, 'self', 'Atk', {});
    selfUid = a.uid;
    for (const o of opts.oppChars ?? []) {
      const c = mutate.scene.enter(draft, 'opp', o.id, {});
      oppUids.push(c.uid);
      if (o.state === 'sleep') mutate.scene.setState(draft, c.uid, 'sleep');
      else if (o.state === 'stun') mutate.scene.setState(draft, c.uid, 'stun');
      // active はデフォルト
      if (o.mustBeTargeted) {
        mutate.char.setTurnEffect(draft, c.uid, 'mustBeTargeted', true);
      }
    }
  });
  return { s, selfUid, oppUids };
}

describe('engine.flow.action.target-expander', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTargetExpanders();
    _resetActionContexts();
    _resetUidCounter();
    resetDefRegistry();
  });

  describe('candidates (G29)', () => {
    it('base 候補: opp の sleep / stun のみ (active は含まない)', () => {
      const { s, selfUid, oppUids } = makeBoard({
        oppChars: [
          { id: 'O1', state: 'sleep' },
          { id: 'O2', state: 'active' },
          { id: 'O3', state: 'stun' },
        ],
      });
      const cs = candidates(s, selfUid);
      const uids = cs.map(c => c.uid).sort();
      expect(uids).toEqual([oppUids[0], oppUids[2]].sort());
    });

    it('expander が追加候補を足せる (level≥7 active を許可)', () => {
      const { s, selfUid, oppUids } = makeBoard({
        oppChars: [
          { id: 'O1', state: 'sleep' },
          { id: 'OBig', state: 'active', level: 8 },
        ],
      });
      registerTargetExpander(selfUid, (state, _byUid) => {
        const out: { uid: string; cardId: string; player: 'self' | 'opp' }[] = [];
        for (const c of state.players.opp.scene) {
          if (c.state === 'active' && readChar.level(state, c.uid) >= 7) {
            out.push({ uid: c.uid, cardId: c.cardId, player: 'opp' });
          }
        }
        return out;
      });
      const cs = candidates(s, selfUid);
      const uids = cs.map(c => c.uid).sort();
      expect(uids).toEqual([oppUids[0], oppUids[1]].sort());
    });

    it('expander が base と同じ uid を返しても dedup される', () => {
      const { s, selfUid, oppUids } = makeBoard({
        oppChars: [{ id: 'O1', state: 'sleep' }],
      });
      registerTargetExpander('xxx', (_state, _byUid) => {
        return [{ uid: oppUids[0], cardId: 'O1', player: 'opp' as const }];
      });
      const cs = candidates(s, selfUid);
      expect(cs.length).toBe(1);
      expect(cs[0].uid).toBe(oppUids[0]);
    });

    it('registerTargetExpander の Unsubscribe で削除できる', () => {
      const unsub = registerTargetExpander('abc', () => []);
      expect(_hasExpander('abc')).toBe(true);
      unsub();
      expect(_hasExpander('abc')).toBe(false);
    });

    it('_resetTargetExpanders ですべて削除される', () => {
      registerTargetExpander('a', () => []);
      registerTargetExpander('b', () => []);
      _resetTargetExpanders();
      expect(_hasExpander('a')).toBe(false);
      expect(_hasExpander('b')).toBe(false);
    });
  });

  describe('mustTargetCandidates (G28)', () => {
    it('誰も mustBeTargeted を持たなければ空配列', () => {
      const { s, selfUid } = makeBoard({
        oppChars: [
          { id: 'O1', state: 'sleep' },
          { id: 'O2', state: 'active' },
        ],
      });
      expect(mustTargetCandidates(s, selfUid)).toEqual([]);
    });

    it('mustBeTargeted=true のキャラを返す', () => {
      const { s, selfUid, oppUids } = makeBoard({
        oppChars: [
          { id: 'O1', state: 'sleep' },
          { id: 'O2', state: 'active', mustBeTargeted: true },
        ],
      });
      const list = mustTargetCandidates(s, selfUid);
      expect(list.length).toBe(1);
      expect(list[0].uid).toBe(oppUids[1]);
    });
  });

  describe('declare integration', () => {
    it('mustTarget が存在しないときは通常通り declare 可能', () => {
      const { s, selfUid, oppUids } = makeBoard({
        oppChars: [{ id: 'O1', state: 'sleep' }],
      });
      expect(() =>
        produce(s, draft => {
          declare(draft, selfUid, { kind: 'char', uid: oppUids[0] });
        }),
      ).not.toThrow();
    });

    it('mustTarget リスト外のキャラを指定すると throw', () => {
      const { s, selfUid, oppUids } = makeBoard({
        oppChars: [
          { id: 'O1', state: 'sleep' },
          { id: 'O2', state: 'sleep', mustBeTargeted: true },
        ],
      });
      expect(() =>
        produce(s, draft => {
          declare(draft, selfUid, { kind: 'char', uid: oppUids[0] });
        }),
      ).toThrow(/must target/);
    });

    it('mustTarget リスト内のキャラなら declare 可能', () => {
      const { s, selfUid, oppUids } = makeBoard({
        oppChars: [
          { id: 'O1', state: 'sleep' },
          { id: 'O2', state: 'sleep', mustBeTargeted: true },
        ],
      });
      expect(() =>
        produce(s, draft => {
          declare(draft, selfUid, { kind: 'char', uid: oppUids[1] });
        }),
      ).not.toThrow();
    });

    it('mustBeTargeted は case-target アクションを阻害しない', () => {
      // opp scene に mustBeTargeted のキャラがいても、事件アクションは制約を受けない
      const { s, selfUid } = makeBoard({
        oppChars: [{ id: 'O1', state: 'sleep', mustBeTargeted: true }],
      });
      // opp に証拠を 1 枚積む (事件アクション条件)
      const s2 = produce(s, draft => {
        draft.players.opp.evidence.push({
          cardId: 'ev-0',
          faceUp: false,
          origin: { turn: 0, via: 'opening' },
        });
      });
      expect(() =>
        produce(s2, draft => {
          declare(draft, selfUid, { kind: 'case', player: 'opp' });
        }),
      ).not.toThrow();
    });
  });

  describe('canActionAgainstChar integration', () => {
    it('通常: sleep の opp は canActionAgainstChar=true', () => {
      const { s, selfUid, oppUids } = makeBoard({
        oppChars: [{ id: 'O1', state: 'sleep' }],
      });
      expect(canActionAgainstChar(s, selfUid, oppUids[0])).toBe(true);
    });

    it('通常: active の opp は canActionAgainstChar=false', () => {
      const { s, selfUid, oppUids } = makeBoard({
        oppChars: [{ id: 'O1', state: 'active' }],
      });
      expect(canActionAgainstChar(s, selfUid, oppUids[0])).toBe(false);
    });

    it('expander が level≥7 active を許可 → canActionAgainstChar=true', () => {
      const { s, selfUid, oppUids } = makeBoard({
        oppChars: [{ id: 'OBig', state: 'active', level: 8 }],
      });
      registerTargetExpander(selfUid, (state, _byUid) => {
        const out: { uid: string; cardId: string; player: 'self' | 'opp' }[] = [];
        for (const c of state.players.opp.scene) {
          if (c.state === 'active' && readChar.level(state, c.uid) >= 7) {
            out.push({ uid: c.uid, cardId: c.cardId, player: 'opp' });
          }
        }
        return out;
      });
      expect(canActionAgainstChar(s, selfUid, oppUids[0])).toBe(true);
    });
  });
});
