// PA-MR (partnerAreaMR) reader spine (rules/18:35-39, 21:10): パートナーエリア常駐 MR の
// byUid 解決 / continuous aura・keyword / 宣言能力【ターン①】 / オートフェイズ活性 / triggered 走査。
// engine/mr-partner-area-core (2026-06-23).
import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { produce as immerProduce } from 'immer';
import { createEmptyGameState } from '@/engine/state-factory';
import { char as readChar } from '@/engine/read/char';
import { scene as readScene } from '@/engine/read/scene';
import { flag } from '@/engine/mutate/flag';
import { runAutoPhase } from '@/engine/flow/auto-phase';
import { canDeclaredAbility, findCardOnBoard, useDeclaredAbility } from '@/engine/flow/main/declared-ability';
import { register, _resetRegistry } from '@/engine/read/def';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import type { CardDef, GameState } from '@/engine/types';
import { makeChar } from '../../helpers/fixtures';

function mkDef(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `0/${id}`, kind: 'character', names: [id], colors: ['青'],
    traits: [], rarity: 'R', imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

beforeEach(() => {
  _resetRegistry();
});

describe('PA-MR reader spine (rules/18)', () => {
  describe('read.scene.byUid + read.char.* — sentinel 解決', () => {
    it('byUid が partnerMR sentinel を slot char へ解決 + read.char.ap/state も解決', () => {
      register(mkDef('MR1', { rarity: 'MR', ap: 2000, lp: 1500 }));
      const s = createEmptyGameState();
      s.players.self.partnerAreaMR = makeChar({ cardId: 'MR1', uid: 'partnerMR:self', state: 'sleep' });
      expect(readScene.byUid(s, 'partnerMR:self')?.cardId).toBe('MR1');
      expect(readChar.ap(s, 'partnerMR:self')).toBe(2000);
      expect(readChar.lp(s, 'partnerMR:self')).toBe(1500);
      expect(readChar.state(s, 'partnerMR:self')).toBe('sleep');
    });
  });

  describe('continuous aura (B08062 型: PA でも有効)', () => {
    it('scope on-partner-area の apDeltaAura が現場キャラを buff', () => {
      register(mkDef('AURA_MR', { rarity: 'MR', abilities: [{
        id: 'a1', type: 'continuous', scope: 'on-partner-area',
        continuousModifier: { apDeltaAura: 1000 }, description: '',
      }] }));
      register(mkDef('TGT', { rarity: 'R', ap: 500 }));
      const s = createEmptyGameState();
      s.players.self.partnerAreaMR = makeChar({ cardId: 'AURA_MR', uid: 'partnerMR:self' });
      s.players.self.scene = [makeChar({ cardId: 'TGT', uid: 'TGT#1' })];
      expect(readChar.ap(s, 'TGT#1')).toBe(1500);
    });

    it('scope on-scene の aura は PA からは適用されない (decoy: PA scope gate)', () => {
      register(mkDef('AURA_MR2', { rarity: 'MR', abilities: [{
        id: 'a1', type: 'continuous', scope: 'on-scene',
        continuousModifier: { apDeltaAura: 1000 }, description: '',
      }] }));
      register(mkDef('TGT', { rarity: 'R', ap: 500 }));
      const s = createEmptyGameState();
      s.players.self.partnerAreaMR = makeChar({ cardId: 'AURA_MR2', uid: 'partnerMR:self' });
      s.players.self.scene = [makeChar({ cardId: 'TGT', uid: 'TGT#1' })];
      expect(readChar.ap(s, 'TGT#1')).toBe(500);
    });
  });

  describe('continuous self-keyword', () => {
    it('scope on-partner-area の grantKeywords を PA-MR 自身が持つ', () => {
      register(mkDef('KW_MR', { rarity: 'MR', abilities: [{
        id: 'a1', type: 'continuous', scope: 'on-partner-area',
        continuousModifier: { grantKeywords: () => ['突撃'] }, description: '',
      }] }));
      const s = createEmptyGameState();
      s.players.self.partnerAreaMR = makeChar({ cardId: 'KW_MR', uid: 'partnerMR:self' });
      expect(readChar.keywords(s, 'partnerMR:self')).toContain('突撃');
    });

    it('scope on-scene の grantKeywords は PA では無効 (decoy)', () => {
      register(mkDef('KW_MR2', { rarity: 'MR', abilities: [{
        id: 'a1', type: 'continuous', scope: 'on-scene',
        continuousModifier: { grantKeywords: () => ['突撃'] }, description: '',
      }] }));
      const s = createEmptyGameState();
      s.players.self.partnerAreaMR = makeChar({ cardId: 'KW_MR2', uid: 'partnerMR:self' });
      expect(readChar.keywords(s, 'partnerMR:self')).not.toContain('突撃');
    });
  });

  describe('宣言能力 (rules/21:10 PA でも使用可) + 【ターン①】', () => {
    it('findCardOnBoard/canDeclaredAbility 解決 + slot.declaredUseCount で【ターン①】enforce + reset', () => {
      register(mkDef('DEC_MR', { rarity: 'MR', abilities: [{
        id: 'd1', type: 'declared', scope: 'on-partner-area', limit: { kind: 'turn', n: 1 },
        effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '',
      }] }));
      const s0 = createEmptyGameState();
      s0.players.self.partnerAreaMR = makeChar({ cardId: 'DEC_MR', uid: 'partnerMR:self' });

      expect(findCardOnBoard(s0, 'partnerMR:self')?.area).toBe('partner-area');
      expect(canDeclaredAbility(s0, 'partnerMR:self', 'd1')).toBe(true);

      const s1 = produce(s0, d => { flag.incrDeclaredUseCount(d, 'partnerMR:self', 'd1'); });
      expect(s1.players.self.partnerAreaMR?.declaredUseCount['d1']).toBe(1);
      expect(canDeclaredAbility(s1, 'partnerMR:self', 'd1')).toBe(false); // 【ターン①】超過

      const s2 = produce(s1, d => { flag.resetTurnFlags(d, 'self'); });
      expect(s2.players.self.partnerAreaMR?.declaredUseCount['d1'] ?? 0).toBe(0);
      expect(canDeclaredAbility(s2, 'partnerMR:self', 'd1')).toBe(true);
    });

    it('PA-MR の scope on-scene 宣言能力は PA から使えない (rules/18:38 scope gate, decoy)', () => {
      register(mkDef('DEC_MR2', { rarity: 'MR', abilities: [{
        id: 'd1', type: 'declared', scope: 'on-scene',
        effect: { kind: 'atom', verb: 'draw', args: { player: 'self', n: 1 } }, description: '',
      }] }));
      const s = createEmptyGameState();
      s.players.self.partnerAreaMR = makeChar({ cardId: 'DEC_MR2', uid: 'partnerMR:self' });
      expect(canDeclaredAbility(s, 'partnerMR:self', 'd1')).toBe(false);
    });
  });

  // 公式Q&A 反映 (2026-06-24, commmune post/1690545 + rules/05①): PA-MR は auto-phase で活性化されない。
  // 活性化対象は「パートナー + 現場キャラ」のみ、かつ事務局裁定で PA-MR の状態は変更不可 (sticky)。
  describe('オートフェイズ: PA-MR は活性化されず snapshot 状態を保持 (rules/05① + 公式Q&A)', () => {
    function deckState(): GameState {
      const s = createEmptyGameState();
      s.players.self.partner = { cardId: 'P', state: 'active', location: 'partner-area' };
      s.players.self.deck = ['d1', 'd2', 'd3', 'd4', 'd5'];
      return s;
    }
    for (const st of ['sleep', 'stun', 'active'] as const) {
      it(`${st} PA-MR は ${st} のまま (auto-phase は触れない)`, () => {
        register(mkDef('PA_MR', { rarity: 'MR' }));
        const s = deckState();
        s.players.self.partnerAreaMR = makeChar({ cardId: 'PA_MR', uid: 'partnerMR:self', state: st });
        const r = produce(s, d => { runAutoPhase(d, 'self'); });
        expect(r.players.self.partnerAreaMR?.state).toBe(st);
      });
    }
    it('現場キャラは従来どおり活性化される (回帰確認: PA-MR 不活性化が現場活性を壊さない)', () => {
      register(mkDef('SC', { rarity: 'R' }));
      const s = deckState();
      s.players.self.scene = [makeChar({ cardId: 'SC', uid: 'SC#1', state: 'sleep' })];
      const r = produce(s, d => { runAutoPhase(d, 'self'); });
      expect(r.players.self.scene[0].state).toBe('active');
    });
  });

  describe('collectCardsInPlay (triggered 走査)', () => {
    it('PA-MR の triggered ability (scope on-partner-area) が hook で発火', () => {
      const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };
      register(mkDef('TRIG_MR', { rarity: 'MR', abilities: [{
        id: 'a1', type: 'triggered', scope: 'on-partner-area',
        trigger: { hook: 'phase:end:start' }, effect, description: '',
      }] }));
      event._resetRegistry();
      _resetTriggeredRegistered();
      registerTriggeredListener();
      const s = createEmptyGameState();
      s.players.self.partnerAreaMR = makeChar({ cardId: 'TRIG_MR', uid: 'partnerMR:self' });
      const r = immerProduce(s, d => {
        event.emit(d, 'phase:end:start', { player: 'self' }, { player: 'self', cardId: 'TRIG_MR', uid: 'partnerMR:self' });
      });
      expect(r.pendingEffects.length).toBeGreaterThanOrEqual(1);
    });

    it('PA-MR の triggered が scope on-scene なら PA では gate-out される (decoy)', () => {
      const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };
      register(mkDef('TRIG_MR2', { rarity: 'MR', abilities: [{
        id: 'a1', type: 'triggered', scope: 'on-scene',
        trigger: { hook: 'phase:end:start' }, effect, description: '',
      }] }));
      event._resetRegistry();
      _resetTriggeredRegistered();
      registerTriggeredListener();
      const s = createEmptyGameState();
      s.players.self.partnerAreaMR = makeChar({ cardId: 'TRIG_MR2', uid: 'partnerMR:self' });
      const r = immerProduce(s, d => {
        event.emit(d, 'phase:end:start', { player: 'self' }, { player: 'self', cardId: 'TRIG_MR2', uid: 'partnerMR:self' });
      });
      expect(r.pendingEffects.length).toBe(0); // scopeAllowsArea: on-scene は partner-area を弾く
    });
    it('suppresses printed PA-MR triggered and declared abilities after original disable', () => {
      const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };
      register(mkDef('SUPPRESSED_MR', { rarity: 'MR', abilities: [
        { id: 't1', type: 'triggered', scope: 'on-partner-area', trigger: { hook: 'phase:end:start' }, effect, description: '' },
        { id: 'd1', type: 'declared', scope: 'on-partner-area', effect, description: '' },
      ] }));
      event._resetRegistry();
      _resetTriggeredRegistered();
      registerTriggeredListener();
      const s = createEmptyGameState();
      s.players.self.partnerAreaMR = makeChar({
        cardId: 'SUPPRESSED_MR', uid: 'partnerMR:self',
        keywordOverrides: { granted: [], disabledOriginal: true },
      });
      const triggered = immerProduce(s, d => {
        event.emit(d, 'phase:end:start', { player: 'self' }, { player: 'self', cardId: 'SUPPRESSED_MR', uid: 'partnerMR:self' });
      });
      expect(triggered.pendingEffects).toHaveLength(0);
      expect(canDeclaredAbility(s, 'partnerMR:self', 'd1')).toBe(false);
      const declared = produce(s, d => useDeclaredAbility(d, 'partnerMR:self', 'd1'));
      expect(declared.players.self.partnerAreaMR?.declaredUseCount['d1']).toBeUndefined();
      expect(declared.pendingEffects).toHaveLength(0);
    });

    it('keeps externally granted PA-MR triggered and declared abilities after original disable', () => {
      const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };
      register(mkDef('GRANTED_MR', { rarity: 'MR' }));
      event._resetRegistry();
      _resetTriggeredRegistered();
      registerTriggeredListener();
      const s = createEmptyGameState();
      s.players.self.partnerAreaMR = makeChar({
        cardId: 'GRANTED_MR', uid: 'partnerMR:self',
        keywordOverrides: { granted: [], disabledOriginal: true },
        turnEffects: {
          grantedAbilities: [
            { id: 'external-t1', type: 'triggered', scope: 'on-partner-area', trigger: { hook: 'phase:end:start' }, effect, description: '' },
            { id: 'external-d1', type: 'declared', scope: 'on-partner-area', effect, description: '' },
          ],
        },
      });
      const triggered = immerProduce(s, d => {
        event.emit(d, 'phase:end:start', { player: 'self' }, { player: 'self', cardId: 'GRANTED_MR', uid: 'partnerMR:self' });
      });
      expect(triggered.pendingEffects).toHaveLength(1);
      expect(canDeclaredAbility(s, 'partnerMR:self', 'external-d1')).toBe(true);
      const declared = produce(s, d => useDeclaredAbility(d, 'partnerMR:self', 'external-d1'));
      expect(readChar.declaredUseCount(declared, 'partnerMR:self', 'external-d1', {
        abilityOrigin: 'granted', abilityIndex: 1,
      })).toBe(1);
      expect(declared.players.self.partnerAreaMR?.declaredUseCount['external-d1']).toBeUndefined();
      expect(declared.pendingEffects).toHaveLength(1);
    });

    it('keeps turn-limit authority after restoring a PA-MR with its legacy physical uid', () => {
      const effect = { kind: 'atom' as const, verb: 'draw', args: { player: 'self', n: 1 } };
      register(mkDef('LEGACY_UID_MR', { rarity: 'MR', abilities: [{
        id: 'printed-d1', type: 'declared', scope: 'on-partner-area',
        limit: { kind: 'turn', n: 1 }, effect, description: '',
      }] }));
      event._resetRegistry();
      _resetTriggeredRegistered();
      registerTriggeredListener();
      const state = createEmptyGameState();
      state.players.self.partnerAreaMR = makeChar({
        cardId: 'LEGACY_UID_MR', uid: 'legacy-physical-mr',
        turnEffects: { grantedAbilities: [{
          id: 'granted-t1', type: 'triggered', scope: 'on-partner-area',
          trigger: { hook: 'phase:end:start' }, limit: { kind: 'turn', n: 1 },
          effect, description: '',
        }] },
      });
      const restored = JSON.parse(JSON.stringify(state)) as GameState;

      const declared = produce(restored, draft => {
        useDeclaredAbility(draft, 'partnerMR:self', 'printed-d1');
      });
      expect(readChar.declaredUseCount(declared, 'partnerMR:self', 'printed-d1', {
        abilityOrigin: 'printed', abilityIndex: 0,
      })).toBe(1);
      expect(canDeclaredAbility(declared, 'partnerMR:self', 'printed-d1')).toBe(false);

      const triggered = immerProduce(restored, draft => {
        event.emit(draft, 'phase:end:start', { player: 'self' });
        event.emit(draft, 'phase:end:start', { player: 'self' });
      });
      expect(triggered.pendingEffects).toHaveLength(1);
      expect(readChar.declaredUseCount(triggered, 'partnerMR:self', 'granted-t1', {
        abilityOrigin: 'granted', abilityIndex: 0,
      })).toBe(1);
    });
  });
});
