// MR能力② (rules/18:25-33): 自分の現場に MR が登場する場合、(現場 or パートナーエリアの)既存 MR を
// リムーブする。同名不問。cause='effect' (能力によるリムーブ)。switch との順序は self-correcting
// switchEnter で fullness 再計算 (未解決 #4 暫定解)。engine/mr-partner-area-core (2026-06-23)。
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { scene } from '@/engine/mutate/scene';
import { register, _resetRegistry } from '@/engine/read/def';
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

describe('MR能力② — 現場に MR 登場 → 既存 MR リムーブ (rules/18)', () => {
  beforeEach(() => {
    _resetRegistry();
    register(mkDef('MR_A', { rarity: 'MR' }));
    register(mkDef('MR_B', { rarity: 'MR' }));
    register(mkDef('NMR', { rarity: 'R' }));
  });

  it('MR 登場で現場の既存 MR (別名) をリムーブ', () => {
    const old = makeChar({ cardId: 'MR_A', uid: 'MR_A#1' });
    const s = makeState([old]);
    s.turn.player = 'self';
    const r = produce(s, d => { scene.enter(d, 'self', 'MR_B', {}); });
    const ids = r.players.self.scene.map(c => c.cardId);
    expect(ids).toContain('MR_B');
    expect(ids).not.toContain('MR_A');
    expect(r.players.self.remove).toContain('MR_A'); // cause='effect' で remove へ
  });

  it('同名 MR でも既存 MR をリムーブ (同名不問)', () => {
    const old = makeChar({ cardId: 'MR_A', uid: 'MR_A#1' });
    const s = makeState([old]);
    s.turn.player = 'self';
    const r = produce(s, d => { scene.enter(d, 'self', 'MR_A', {}); });
    expect(r.players.self.scene).toHaveLength(1);
    expect(r.players.self.remove).toContain('MR_A');
  });

  it('MR 登場で partnerAreaMR slot の既存 MR をリムーブ (rules/18② PA 常駐 MR)', () => {
    const s = makeState([]);
    s.turn.player = 'self';
    s.players.self.partnerAreaMR = makeChar({ cardId: 'MR_A', uid: 'partnerMR:self' });
    const r = produce(s, d => { scene.enter(d, 'self', 'MR_B', {}); });
    expect(r.players.self.partnerAreaMR == null).toBe(true);
    expect(r.players.self.remove).toContain('MR_A');
    expect(r.players.self.scene.map(c => c.cardId)).toContain('MR_B');
  });

  it('非 MR 登場は既存 MR をリムーブしない (decoy)', () => {
    const old = makeChar({ cardId: 'MR_A', uid: 'MR_A#1' });
    const s = makeState([old]);
    s.turn.player = 'self';
    const r = produce(s, d => { scene.enter(d, 'self', 'NMR', {}); });
    expect(r.players.self.scene.map(c => c.cardId).sort()).toEqual(['MR_A', 'NMR']);
    expect(r.players.self.remove).not.toContain('MR_A');
  });

  it('MR②除去は PA へ redirect しない (相手ターン中の MR 登場でも remove へ。noMrRedirect, 未解決#2)', () => {
    // opp の現場に既存 MR、self ターン中に opp が MR を登場 (CPU-vs-CPU の cross-turn enter)
    const old = makeChar({ cardId: 'MR_A', uid: 'MR_A#1' });
    const s = makeState([], [old]);
    s.turn.player = 'self'; // opp から見て相手ターン
    const r = produce(s, d => { scene.enter(d, 'opp', 'MR_B', {}); });
    expect(r.players.opp.partnerAreaMR == null).toBe(true); // PA へ行かない
    expect(r.players.opp.remove).toContain('MR_A');
  });

  describe('switchEnter self-correction (未解決 #4 暫定: MR② が slot を空けたら switch 抑制)', () => {
    it('現場満杯 + 現場に既存 MR → MR②で空き → victim (非MR) は除去せず生存', () => {
      const sceneChars = [
        makeChar({ cardId: 'MR_A', uid: 'MR_A#1' }),
        makeChar({ cardId: 'NMR', uid: 'V1' }),
        makeChar({ cardId: 'NMR', uid: 'V2' }),
        makeChar({ cardId: 'NMR', uid: 'V3' }),
        makeChar({ cardId: 'NMR', uid: 'V4' }),
      ];
      const s = makeState(sceneChars);
      s.turn.player = 'self';
      const r = produce(s, d => { scene.switchEnter(d, 'self', 'MR_B', 'V1', {}); });
      const uids = r.players.self.scene.map(c => c.uid);
      expect(r.players.self.scene).toHaveLength(5);
      expect(uids).toContain('V1'); // victim 生存 (MR② が空きを作った)
      expect(r.players.self.scene.map(c => c.cardId)).toContain('MR_B');
      expect(r.players.self.scene.find(c => c.cardId === 'MR_A')).toBeUndefined();
      expect(r.players.self.remove).toContain('MR_A');
      expect(r.players.self.remove).not.toContain('NMR'); // victim はリムーブされない
    });

    it('現場満杯 + 既存 MR 無し → 通常 switch (victim 除去)', () => {
      const sceneChars = Array.from({ length: 5 }, (_, i) =>
        makeChar({ cardId: 'NMR', uid: `V${i}` }));
      const s = makeState(sceneChars);
      s.turn.player = 'self';
      const r = produce(s, d => { scene.switchEnter(d, 'self', 'MR_B', 'V0', {}); });
      expect(r.players.self.scene).toHaveLength(5);
      expect(r.players.self.scene.find(c => c.uid === 'V0')).toBeUndefined(); // victim 除去
      expect(r.players.self.scene.map(c => c.cardId)).toContain('MR_B');
      expect(r.players.self.remove).toContain('NMR');
    });

    it('現場満杯(全NMR) + PA-slot のみ MR → freedSceneSlot=false → victim は除去される', () => {
      const sceneChars = Array.from({ length: 5 }, (_, i) =>
        makeChar({ cardId: 'NMR', uid: `V${i}` }));
      const s = makeState(sceneChars);
      s.turn.player = 'self';
      s.players.self.partnerAreaMR = makeChar({ cardId: 'MR_A', uid: 'partnerMR:self' });
      const r = produce(s, d => { scene.switchEnter(d, 'self', 'MR_B', 'V0', {}); });
      expect(r.players.self.partnerAreaMR == null).toBe(true); // PA-slot MR は MR②除去
      expect(r.players.self.scene.find(c => c.uid === 'V0')).toBeUndefined(); // 現場は満杯のまま → victim 除去
      expect(r.players.self.scene).toHaveLength(5);
      expect(r.players.self.scene.map(c => c.cardId)).toContain('MR_B');
      expect(r.players.self.remove).toContain('MR_A'); // slot MR → remove
      expect(r.players.self.remove).toContain('NMR'); // victim → remove
    });
  });
});
