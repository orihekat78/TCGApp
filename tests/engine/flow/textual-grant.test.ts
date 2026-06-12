// Task D E4 (2026-06-12): 非キーワードテキスト能力の付与 (textual ability token)
//
// 6 token のうち本 wave 実装分: actionTargetsActive / sleepGuard / contactImmune /
// removeOnTurnEnd / toDeckBottomOnTurnEnd (mustGuard / auraGrant は次 wave DEFER)。
// 付与チャネル: turnEffects flag (charSetTurnEffect) / 'text:' 擬似キーワード (印字常時条件型)。
// 統一 reader read.char.hasTextAbility が両チャネルを OR する。
//
// rules: 03 (スタン行動不可), 07 (ガード=アクティブ), 08 §6-7 (アクション中効果切れ),
//        13 (キーワード), 22 (コンタクトリムーブのみ), 05 (①能力発動→②効果切れ)
import { describe, it, expect } from 'vitest';
import { produce } from '@/engine/produce';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef } from '@/engine/read/def';
import { char as readChar } from '@/engine/read/char';
import { char as mutateChar } from '@/engine/mutate/char';
import { guard } from '@/engine/flow/guard';
import { candidates as actionCandidates } from '@/engine/flow/action/target-expander';
import { snapshotAP } from '@/engine/flow/action/state-machine';
import { endTurn } from '@/engine/flow/turn';
import type { GameState, SceneCharacter, CardDef, ActionContext } from '@/engine/types';
import { sceneChar as baseScene } from '../../helpers/fixtures';

function sceneChar(cardId: string, uid: string, st: 'active' | 'sleep' | 'stun' = 'active', te: Record<string, unknown> = {}): SceneCharacter {
  return baseScene(cardId, uid, { state: st, apOverride: 5000, turnEffects: { contactImmune: false, removeOnTurnEnd: false, ...te } });
}

function defOf(id: string, overrides: Partial<CardDef> = {}): CardDef {
  return {
    id, no: id, kind: 'character', names: [id], colors: ['青'], level: 4, ap: 5000, lp: 1,
    traits: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [], ...overrides,
  } as CardDef;
}

describe('read.char.hasTextAbility (Task D E4)', () => {
  it('turnEffects flag チャネル (素 / _oppTurn / _action suffix)', () => {
    registerCardDef(defOf('C1'));
    const s = createEmptyGameState();
    s.players.self.scene.push(sceneChar('C1', 'u1', 'active', { sleepGuard: true }));
    s.players.self.scene.push(sceneChar('C1', 'u2', 'active', { sleepGuard_oppTurn: true }));
    s.players.self.scene.push(sceneChar('C1', 'u3', 'active', { contactImmune_action: true }));
    s.players.self.scene.push(sceneChar('C1', 'u4'));
    expect(readChar.hasTextAbility(s, 'u1', 'sleepGuard')).toBe(true);
    expect(readChar.hasTextAbility(s, 'u2', 'sleepGuard')).toBe(true);
    expect(readChar.hasTextAbility(s, 'u3', 'contactImmune')).toBe(true);
    expect(readChar.hasTextAbility(s, 'u4', 'sleepGuard')).toBe(false);
  });

  it("'text:' 擬似キーワードチャネル (B09028 印字常時条件型の載せ先)", () => {
    registerCardDef(defOf('C2'));
    const s = createEmptyGameState();
    const c = sceneChar('C2', 'u5');
    c.keywordOverrides.granted.push('text:sleepGuard');
    s.players.self.scene.push(c);
    expect(readChar.hasTextAbility(s, 'u5', 'sleepGuard')).toBe(true);
  });
});

describe('sleepGuard — guard.candidates (Task D E4)', () => {
  it('スリープ状態でも sleepGuard 持ちはガード候補に入る (B09054/B09028)。スタンは不可 (rules/03)', () => {
    registerCardDef(defOf('ATK'));
    registerCardDef(defOf('DEF'));
    const s = createEmptyGameState();
    s.players.self.scene.push(sceneChar('ATK', 'atk'));
    s.players.opp.scene.push(sceneChar('DEF', 'g-active', 'active'));
    s.players.opp.scene.push(sceneChar('DEF', 'g-sleep-flag', 'sleep', { sleepGuard: true }));
    s.players.opp.scene.push(sceneChar('DEF', 'g-sleep-plain', 'sleep'));
    s.players.opp.scene.push(sceneChar('DEF', 'g-stun-flag', 'stun', { sleepGuard: true }));
    const uids = guard.candidates(s, 'atk').map(c => c.uid);
    expect(uids).toContain('g-active');
    expect(uids, 'sleepGuard 持ちスリープはガード可').toContain('g-sleep-flag');
    expect(uids, '素のスリープは不可 (rules/07 回帰)').not.toContain('g-sleep-plain');
    expect(uids, 'スタンは flag があっても不可 (rules/03)').not.toContain('g-stun-flag');
  });
});

describe('actionTargetsActive — action 対象拡張 (Task D E4)', () => {
  it('flag 持ちの攻撃キャラはアクティブな相手キャラも対象にできる (B07090/B08032/B08037)', () => {
    registerCardDef(defOf('ATK'));
    registerCardDef(defOf('TGT'));
    const s = createEmptyGameState();
    s.players.self.scene.push(sceneChar('ATK', 'atk', 'active', { actionTargetsActive: true }));
    s.players.self.scene.push(sceneChar('ATK', 'atk-plain', 'active'));
    s.players.opp.scene.push(sceneChar('TGT', 't-active', 'active'));
    s.players.opp.scene.push(sceneChar('TGT', 't-sleep', 'sleep'));
    const withFlag = actionCandidates(s, 'atk').map(c => c.uid);
    expect(withFlag, 'sleep は従来通り').toContain('t-sleep');
    expect(withFlag, 'active も対象に拡張').toContain('t-active');
    const without = actionCandidates(s, 'atk-plain').map(c => c.uid);
    expect(without, 'flag 無しは active 対象外 (回帰)').not.toContain('t-active');
    expect(without).toContain('t-sleep');
  });
});

describe('contactImmune — snapshotAP 配線 (Task D E4)', () => {
  it('防御側が contactImmune (_action) を持つとき ax.contactImmune が立つ (B09041 a2)', () => {
    registerCardDef(defOf('A'));
    registerCardDef(defOf('B'));
    const s = createEmptyGameState();
    s.players.self.scene.push(sceneChar('A', 'a-uid'));
    s.players.opp.scene.push(sceneChar('B', 'b-uid', 'sleep', { contactImmune_action: true }));
    const ax = {
      id: 1, byPlayer: 'self', byUid: 'a-uid',
      target: { kind: 'char', uid: 'b-uid' },
      phase: 'judge', contactImmune: false,
    } as unknown as ActionContext;
    produce(s, draft => {
      snapshotAP(draft, ax);
    });
    expect(ax.contactImmune, '防御側 turnEffects から snapshot').toBe(true);
  });

  it('防御側に flag が無ければ false のまま (回帰)', () => {
    registerCardDef(defOf('A'));
    registerCardDef(defOf('B'));
    const s = createEmptyGameState();
    s.players.self.scene.push(sceneChar('A', 'a-uid'));
    s.players.opp.scene.push(sceneChar('B', 'b-uid', 'sleep'));
    const ax = {
      id: 2, byPlayer: 'self', byUid: 'a-uid',
      target: { kind: 'char', uid: 'b-uid' },
      phase: 'judge', contactImmune: false,
    } as unknown as ActionContext;
    produce(s, draft => {
      snapshotAP(draft, ax);
    });
    expect(ax.contactImmune).toBe(false);
  });
});

describe('removeOnTurnEnd / toDeckBottomOnTurnEnd consume — endTurn (Task D E4)', () => {
  it('removeOnTurnEnd=true のキャラはターン終了時にリムーブされる (B09032「ターン終了時、このキャラをリムーブする」)', () => {
    registerCardDef(defOf('R1'));
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.scene.push(sceneChar('R1', 'r-uid', 'sleep', { removeOnTurnEnd: true }));
    s.players.self.scene.push(sceneChar('R1', 'stay-uid'));
    const after = produce(s, draft => {
      endTurn(draft, 'self');
    });
    expect(after.players.self.scene.map(c => c.uid), 'removeOnTurnEnd は現場から消える').toEqual(['stay-uid']);
    expect(after.players.self.remove, 'リムーブエリアへ').toContain('R1');
  });

  it('toDeckBottomOnTurnEnd=true はデッキの下へ (B07079/PR181「ターン終了時、現場からデッキの下に移す」)', () => {
    registerCardDef(defOf('D1'));
    let s = createEmptyGameState();
    s.turn = { number: 3, player: 'self', phase: 'main', isFirstPlayerFirstTurn: false };
    s.players.self.deck = ['X1'];
    s.players.self.scene.push(sceneChar('D1', 'd-uid', 'sleep', { toDeckBottomOnTurnEnd: true }));
    const after = produce(s, draft => {
      endTurn(draft, 'self');
    });
    expect(after.players.self.scene).toHaveLength(0);
    expect(after.players.self.deck, 'デッキ末尾へ').toEqual(['X1', 'D1']);
    expect(after.players.self.remove, 'リムーブには行かない').not.toContain('D1');
  });
});

describe('clearTurnEffects scope 拡張 (Task D E4)', () => {
  it("'turn' は token / grantedAbilities / _action を清掃する (BUG-119 教訓)", () => {
    registerCardDef(defOf('C1'));
    const s = createEmptyGameState();
    s.players.self.scene.push(sceneChar('C1', 'u1', 'active', {
      actionTargetsActive: true, sleepGuard: true, contactImmune_action: true,
      wasGuardedThisTurn: true, grantedAbilities: [{ id: 'g1' }], contactImmune: true,
    }));
    const after = produce(s, draft => {
      mutateChar.clearTurnEffects(draft, 'u1', 'turn');
    });
    const te = after.players.self.scene[0]!.turnEffects;
    expect(te['actionTargetsActive']).toBeUndefined();
    expect(te['sleepGuard']).toBeUndefined();
    expect(te['contactImmune_action']).toBeUndefined();
    expect(te['wasGuardedThisTurn']).toBeUndefined();
    expect(te['grantedAbilities']).toBeUndefined();
    expect(te.contactImmune, '型付き flag は false にリセット').toBe(false);
  });

  it("'action' は _action suffix のみ清掃 (rules/08 §7 アクション中の効果が切れる)", () => {
    registerCardDef(defOf('C1'));
    const s = createEmptyGameState();
    s.players.self.scene.push(sceneChar('C1', 'u1', 'active', {
      contactImmune_action: true, sleepGuard: true,
    }));
    const after = produce(s, draft => {
      mutateChar.clearTurnEffects(draft, 'u1', 'action');
    });
    const te = after.players.self.scene[0]!.turnEffects;
    expect(te['contactImmune_action'], '_action は消える').toBeUndefined();
    expect(te['sleepGuard'], 'turn-scope token は残る').toBe(true);
  });

  it("'opp-turn' は _oppTurn suffix も清掃する (B09054)", () => {
    registerCardDef(defOf('C1'));
    const s = createEmptyGameState();
    s.players.self.scene.push(sceneChar('C1', 'u1', 'active', {
      sleepGuard_oppTurn: true, mustBeTargeted: true, sleepGuard: true,
    }));
    const after = produce(s, draft => {
      mutateChar.clearTurnEffects(draft, 'u1', 'opp-turn');
    });
    const te = after.players.self.scene[0]!.turnEffects;
    expect(te['sleepGuard_oppTurn']).toBeUndefined();
    expect(te['mustBeTargeted'], '既存 BUG-101 挙動維持').toBeUndefined();
    expect(te['sleepGuard'], 'turn-scope は残る').toBe(true);
  });
});

describe('sleepGuard 自己ガード除外 (Task D E4, B09028/B09054 Q&A)', () => {
  it('アクション対象キャラ自身は sleepGuard を持っていてもガード候補に入らない', () => {
    registerCardDef(defOf('ATK'));
    registerCardDef(defOf('DEF'));
    const s = createEmptyGameState();
    s.players.self.scene.push(sceneChar('ATK', 'atk'));
    s.players.opp.scene.push(sceneChar('DEF', 'tgt-sleep', 'sleep', { sleepGuard: true }));
    s.players.opp.scene.push(sceneChar('DEF', 'other-sleep', 'sleep', { sleepGuard: true }));
    const uids = guard.candidates(s, 'atk', 'tgt-sleep').map(c => c.uid);
    expect(uids, '対象自身は除外 (公式Q&A: 指定されたキャラ自身でガード不可)').not.toContain('tgt-sleep');
    expect(uids, '対象でない sleepGuard 持ちはガード可').toContain('other-sleep');
    expect(guard.canGuard(s, 'atk', 'tgt-sleep', 'tgt-sleep')).toBe(false);
    expect(guard.canGuard(s, 'atk', 'other-sleep', 'tgt-sleep')).toBe(true);
  });

  it('excludeUid 省略時は従来挙動 (回帰)', () => {
    registerCardDef(defOf('ATK'));
    registerCardDef(defOf('DEF'));
    const s = createEmptyGameState();
    s.players.self.scene.push(sceneChar('ATK', 'atk'));
    s.players.opp.scene.push(sceneChar('DEF', 'g1', 'active'));
    expect(guard.candidates(s, 'atk').map(c => c.uid)).toContain('g1');
  });
});
