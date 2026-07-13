// rules: 03-field-areas.md, 09-cutin-disguise.md, 13-keywords.md, 19-special-rules.md, 23-qa-disguise-cutin.md
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { char } from '@/engine/mutate/char';
import type { GameState, SceneCharacter } from '@/engine/types';
import { makeChar } from '../../helpers/fixtures';


function makeState(c: SceneCharacter): GameState {
  const s = createEmptyGameState();
  return {
    ...s,
    players: {
      ...s.players,
      self: { ...s.players.self, scene: [c] },
    },
  };
}

describe('engine.mutate.char', () => {
  describe('modifyAP', () => {
    it('scope=permanent: apBase modifier に積む (apOverride は null のまま変わらない)', () => {
      const c = makeChar({ apOverride: null });
      const s = makeState(c);
      // permanent は apOverride を直接変更する (base 修正相当)
      const result = produce(s, draft => {
        char.modifyAP(draft, 'uid-1', 1000, 'permanent');
      });
      // turnEffects.apMod.permanent に積む OR apOverride を変更
      // 設計: permanent は turnEffects['apMod_permanent'] に差分を積む
      const ch = result.players.self.scene[0];
      // 確認方法: turnEffects の apMod_permanent か、apOverride の変化
      const modPerm = ch.turnEffects['apMod_permanent'] as number | undefined;
      expect(modPerm).toBe(1000);
    });

    it('scope=turn: turnEffects.apMod_turn に積む', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.modifyAP(draft, 'uid-1', 500, 'turn');
      });
      const ch = result.players.self.scene[0];
      expect(ch.turnEffects['apMod_turn']).toBe(500);
    });

    it('scope=contact: turnEffects.apMod_contact に積む', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.modifyAP(draft, 'uid-1', -2000, 'contact');
      });
      const ch = result.players.self.scene[0];
      expect(ch.turnEffects['apMod_contact']).toBe(-2000);
    });

    it('複数回の累積: same scope は加算される', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.modifyAP(draft, 'uid-1', 1000, 'turn');
        char.modifyAP(draft, 'uid-1', 500, 'turn');
      });
      const ch = result.players.self.scene[0];
      expect(ch.turnEffects['apMod_turn']).toBe(1500);
    });

    it('AP がマイナスになっても OK (rules/19 下限なし)', () => {
      const c = makeChar({ apOverride: null });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.modifyAP(draft, 'uid-1', -99999, 'permanent');
      });
      const ch = result.players.self.scene[0];
      expect(ch.turnEffects['apMod_permanent']).toBe(-99999);
    });
  });

  describe('modifyLP', () => {
    it('scope=permanent: turnEffects.lpMod_permanent に積む', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.modifyLP(draft, 'uid-1', -1, 'permanent');
      });
      expect(result.players.self.scene[0].turnEffects['lpMod_permanent']).toBe(-1);
    });

    it('scope=turn: turnEffects.lpMod_turn に積む', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.modifyLP(draft, 'uid-1', 2, 'turn');
      });
      expect(result.players.self.scene[0].turnEffects['lpMod_turn']).toBe(2);
    });
  });

  describe('setOverrideAP', () => {
    it('apOverride を設定する', () => {
      const c = makeChar({ apOverride: null });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setOverrideAP(draft, 'uid-1', 5000);
      });
      expect(result.players.self.scene[0].apOverride).toBe(5000);
    });

    it('null で解除できる', () => {
      const c = makeChar({ apOverride: 3000 });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setOverrideAP(draft, 'uid-1', null);
      });
      expect(result.players.self.scene[0].apOverride).toBeNull();
    });
  });

  describe('setOverrideLP', () => {
    it('lpOverride を設定する', () => {
      const c = makeChar({ lpOverride: null });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setOverrideLP(draft, 'uid-1', -1);
      });
      expect(result.players.self.scene[0].lpOverride).toBe(-1);
    });
  });

  describe('grantKeyword', () => {
    it('scope=permanent でキーワードを付与する', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.grantKeyword(draft, 'uid-1', '迅速', 'permanent');
      });
      expect(result.players.self.scene[0].keywordOverrides.granted).toContain('迅速');
    });

    it('scope=turn で turnEffects.grantedKeywords に積む', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.grantKeyword(draft, 'uid-1', '突撃', 'turn');
      });
      const kws = result.players.self.scene[0].turnEffects['grantedKeywords'] as string[];
      expect(kws).toContain('突撃');
    });

    it('同じキーワードを2回 granted しても重複しない (permanent)', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.grantKeyword(draft, 'uid-1', '迅速', 'permanent');
        char.grantKeyword(draft, 'uid-1', '迅速', 'permanent');
      });
      const granted = result.players.self.scene[0].keywordOverrides.granted;
      expect(granted.filter(k => k === '迅速')).toHaveLength(1);
    });
  });

  describe('revokeKeyword', () => {
    it('granted からキーワードを取り除く', () => {
      const c = makeChar({
        keywordOverrides: { granted: ['迅速', 'ブレット'], disabledOriginal: false },
      });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.revokeKeyword(draft, 'uid-1', '迅速');
      });
      const granted = result.players.self.scene[0].keywordOverrides.granted;
      expect(granted).not.toContain('迅速');
      expect(granted).toContain('ブレット');
    });
  });

  describe('disableOriginalAbilities', () => {
    it('disabledOriginal を true にする (rules/19)', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.disableOriginalAbilities(draft, 'uid-1');
      });
      expect(result.players.self.scene[0].keywordOverrides.disabledOriginal).toBe(true);
    });
  });

  describe('setTurnEffect', () => {
    it('turnEffects に任意のキー/値を設定', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setTurnEffect(draft, 'uid-1', 'contactImmune', true);
      });
      expect(result.players.self.scene[0].turnEffects['contactImmune']).toBe(true);
    });

    it('removeOnTurnEnd を設定', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setTurnEffect(draft, 'uid-1', 'removeOnTurnEnd', true);
      });
      expect(result.players.self.scene[0].turnEffects['removeOnTurnEnd']).toBe(true);
    });
  });

  describe('clearTurnEffects', () => {
    it('scope=turn で turn 系エフェクトをクリア', () => {
      const c = makeChar({
        turnEffects: {
          contactImmune: false,
          removeOnTurnEnd: false,
          apMod_turn: 1000,
          lpMod_turn: 2,
          grantedKeywords: ['突撃'],
        },
      });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.clearTurnEffects(draft, 'uid-1', 'turn');
      });
      const te = result.players.self.scene[0].turnEffects;
      expect(te['apMod_turn']).toBeUndefined();
      expect(te['lpMod_turn']).toBeUndefined();
      expect(te['grantedKeywords']).toBeUndefined();
      // contactImmune と removeOnTurnEnd は維持
      expect(te['contactImmune']).toBe(false);
    });

    // BUG-143: rules/08 §6 — カットインによる効果 (apMod_contact 等) はコンタクト終了時に切れる。
    // contact-scope のみ清掃し、turn-scope 修正は残すこと。
    it('scope=contact で _contact 系のみクリア、turn 系は維持 (rules/08 §6 BUG-143)', () => {
      const c = makeChar({
        turnEffects: {
          contactImmune: false,
          removeOnTurnEnd: false,
          apMod_contact: 2000,
          lpMod_contact: 1,
          lvlMod_contact: -1,
          apMod_turn: 500,
        },
      });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.clearTurnEffects(draft, 'uid-1', 'contact');
      });
      const te = result.players.self.scene[0].turnEffects;
      expect(te['apMod_contact']).toBeUndefined();
      expect(te['lpMod_contact']).toBeUndefined();
      expect(te['lvlMod_contact']).toBeUndefined();
      // contact-scope 清掃は turn-scope 修正を消さない
      expect(te['apMod_turn']).toBe(500);
    });
  });

  describe('setCard', () => {
    it('setCards にカードを追加する (faceUp 付き)', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setCard(draft, 'uid-1', 'EV001', true);
      });
      expect(result.players.self.scene[0].setCards).toEqual([
        { cardId: 'EV001', faceUp: true, instanceId: 'set:1' },
      ]);
    });

    it('裏向きセット (faceUp=false)', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setCard(draft, 'uid-1', 'EV002', false);
      });
      expect(result.players.self.scene[0].setCards).toEqual([
        { cardId: 'EV002', faceUp: false, instanceId: 'set:1' },
      ]);
    });

    it('複数枚セット可能', () => {
      const c = makeChar();
      const s = makeState(c);
      const result = produce(s, draft => {
        char.setCard(draft, 'uid-1', 'EV001', true);
        char.setCard(draft, 'uid-1', 'EV002', false);
      });
      expect(result.players.self.scene[0].setCards).toHaveLength(2);
    });
  });

  describe('stackCard', () => {
    it('allocates a new occurrence ID after a middle stack entry was removed', () => {
      const c = makeChar({
        stackedCards: [
          { cardId: 'A', instanceId: 'stack:uid-1:0' },
          { cardId: 'C', instanceId: 'stack:uid-1:2' },
        ],
      });
      const result = produce(makeState(c), draft => {
        char.stackCard(draft, 'uid-1', 1, ['D']);
      });
      const entries = result.players.self.scene[0].stackedCards;
      expect(Array.isArray(entries) && new Set(entries.map(entry => entry.instanceId)).size).toBe(3);
    });

    it('stackedCards に count を加算', () => {
      const c = makeChar({ stackedCards: 2 });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.stackCard(draft, 'uid-1', 3);
      });
      expect(Array.isArray(result.players.self.scene[0].stackedCards) ? result.players.self.scene[0].stackedCards.length : result.players.self.scene[0].stackedCards).toBe(5);
    });
  });

  describe('transferStackedCards', () => {
    it('moves the exact selected identity to another host without recreating it', () => {
      const source = makeChar({
        uid: 'source',
        stackedCards: [
          { cardId: 'A', instanceId: 'stack:source:a' },
          { cardId: 'B', instanceId: 'stack:source:b' },
        ],
      });
      const target = makeChar({
        uid: 'target',
        stackedCards: [{ cardId: 'C', instanceId: 'stack:target:c' }],
      });
      const result = produce(makeState(source), draft => {
        draft.players.self.scene.push(target);
        char.transferStackedCards(draft, 'source', 'target', 1, ['stack:source:b']);
      });
      expect(result.players.self.scene[0].stackedCards).toEqual([
        { cardId: 'A', instanceId: 'stack:source:a' },
      ]);
      expect(result.players.self.scene[1].stackedCards).toEqual([
        { cardId: 'C', instanceId: 'stack:target:c' },
        { cardId: 'B', instanceId: 'stack:source:b' },
      ]);
    });

    it('fails closed for a stale selected occurrence', () => {
      const source = makeChar({
        uid: 'source',
        stackedCards: [{ cardId: 'A', instanceId: 'stack:source:a' }],
      });
      const target = makeChar({ uid: 'target', stackedCards: 0 });
      const result = produce(makeState(source), draft => {
        draft.players.self.scene.push(target);
        expect(char.transferStackedCards(draft, 'source', 'target', 1, ['stale'])).toEqual([]);
      });
      expect(result.players.self.scene[0].stackedCards).toEqual([
        { cardId: 'A', instanceId: 'stack:source:a' },
      ]);
      expect(result.players.self.scene[1].stackedCards).toBe(0);
    });

    it('does not transfer a stack across player ownership', () => {
      const source = makeChar({
        uid: 'source',
        stackedCards: [{ cardId: 'A', instanceId: 'stack:source:a' }],
      });
      const target = makeChar({ uid: 'target', stackedCards: 0 });
      const result = produce(makeState(source), draft => {
        draft.players.opp.scene.push(target);
        expect(char.transferStackedCards(draft, 'source', 'target', 1, ['stack:source:a'])).toEqual([]);
      });
      expect(result.players.self.scene[0].stackedCards).toHaveLength(1);
      expect(result.players.opp.scene[0].stackedCards).toBe(0);
    });

    it('does not mutate either host when target already has a selected occurrence ID', () => {
      const source = makeChar({
        uid: 'source',
        stackedCards: [{ cardId: 'A', instanceId: 'shared' }],
      });
      const target = makeChar({
        uid: 'target',
        stackedCards: [{ cardId: 'B', instanceId: 'shared' }],
      });
      const result = produce(makeState(source), draft => {
        draft.players.self.scene.push(target);
        expect(char.transferStackedCards(draft, 'source', 'target', 1)).toEqual([]);
      });
      expect(result.players.self.scene[0].stackedCards).toHaveLength(1);
      expect(result.players.self.scene[1].stackedCards).toHaveLength(1);
    });
  });

  it('exposes stable identity candidates for explicit and legacy stacks', () => {
    const explicit = produce(makeState(makeChar({ stackedCards: [{ cardId: 'A', instanceId: 'stack:host:a' }] })), (draft) => {
      expect(char.stackedCardEntries(draft, 'uid-1')).toEqual([{ cardId: 'A', instanceId: 'stack:host:a' }]);
    });
    expect(explicit.players.self.scene).toHaveLength(1);
    const legacy = produce(makeState(makeChar({ stackedCards: 2 })), (draft) => {
      expect(char.stackedCardEntries(draft, 'uid-1')).toEqual([
        { cardId: 'back-card', instanceId: 'legacy:uid-1:0' },
        { cardId: 'back-card', instanceId: 'legacy:uid-1:1' },
      ]);
    });
    expect(legacy.players.self.scene).toHaveLength(1);
  });

  it('validates zero, duplicate, and stale stacked identity selections fail-closed', () => {
    const state = makeState(makeChar({ stackedCards: [
      { cardId: 'A', instanceId: 'stack:host:a' },
      { cardId: 'B', instanceId: 'stack:host:b' },
    ] }));
    expect(char.selectStackedCardEntries(state, 'uid-1', [], 0, 2)).toEqual([]);
    expect(char.selectStackedCardEntries(state, 'uid-1', ['stack:host:a'], 0, 2)).toEqual([{ cardId: 'A', instanceId: 'stack:host:a' }]);
    expect(char.selectStackedCardEntries(state, 'uid-1', ['stack:host:a', 'stack:host:a'], 0, 2)).toBeNull();
    expect(char.selectStackedCardEntries(state, 'uid-1', ['stale'], 0, 2)).toBeNull();
  });

  describe('removeAllSetAndStacked', () => {
    it('setCards を全部リムーブに移動し、stackedCards をクリア', () => {
      const c = makeChar({
        setCards: [
          { cardId: 'SET001', faceUp: true },
          { cardId: 'SET002', faceUp: false },
        ],
        stackedCards: 2,
      });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.removeAllSetAndStacked(draft, 'uid-1');
      });
      expect(result.players.self.scene[0].setCards).toHaveLength(0);
      expect(result.players.self.scene[0].stackedCards).toBe(0);
      expect(result.players.self.remove).toContain('SET001');
      expect(result.players.self.remove).toContain('SET002');
      // 2枚分の back-card
      const backCards = result.players.self.remove.filter(id => id === 'back-card');
      expect(backCards).toHaveLength(2);
    });
  });

  describe('disguiseInto', () => {
    it('cardId のみを新カードに変更する (rules/09)', () => {
      const c = makeChar({
        uid: 'uid-1',
        cardId: 'OLD001',
        state: 'sleep',
        turnEffects: {
          contactImmune: true,
          removeOnTurnEnd: true,
          apMod_turn: 500,
        },
        isNamed: true,
        enterOrder: 3,
      });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.disguiseInto(draft, 'uid-1', 'NEW001');
      });
      const ch = result.players.self.scene[0];
      // cardId が変わる
      expect(ch.cardId).toBe('NEW001');
      // state は引き継ぐ (rules/23)
      expect(ch.state).toBe('sleep');
      // turnEffects は引き継ぐ
      expect(ch.turnEffects['contactImmune']).toBe(true);
      expect(ch.turnEffects['removeOnTurnEnd']).toBe(true);
      expect(ch.turnEffects['apMod_turn']).toBe(500);
      // enterOrder は保持
      expect(ch.enterOrder).toBe(3);
      // isNamed は保持
      expect(ch.isNamed).toBe(true);
    });

    it('元カードの名前・色は新カードのものに変わる (uid は保持)', () => {
      const c = makeChar({ uid: 'uid-1', cardId: 'OLD001' });
      const s = makeState(c);
      const result = produce(s, draft => {
        char.disguiseInto(draft, 'uid-1', 'NEW001');
      });
      expect(result.players.self.scene[0].uid).toBe('uid-1');
      expect(result.players.self.scene[0].cardId).toBe('NEW001');
    });
  });
});
