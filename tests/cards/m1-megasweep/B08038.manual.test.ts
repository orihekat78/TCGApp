// tests/cards/m1-megasweep/B08038.manual — 京極真 手書き probe (engine 実評価)
//
// 公式テキスト:
//   【自分ターン中】このキャラがコンタクトしたとき、自分のデッキのカードを上から2枚リムーブしてもよい。
//   この効果によって〚特徴［高校生］〛か〚［鈴木財閥］〛のキャラがリムーブされた場合、そのコンタクト中、
//   このキャラをAP＋1000する。
//
// novel句 (全て engine 実評価で踏む):
//   - trigger: contact:start selfOnly (このキャラがコンタクトしたとき = B08038 が攻撃側)
//   - condition: turn:self (【自分ターン中】)
//   - effect: optional (してもよい)
//   - mill n:2 gate:true bind:$milled (デッキ2枚未満は解決不可 = QA all-or-nothing gate)
//   - conditional boundAnyMatchesFilter($milled, trait[高校生,鈴木財閥], kind:character)
//   - charModifyAP uid:$self delta:1000 scope:contact
//
// QA (payload):
//   - 高校生/鈴木財閥 が2枚リムーブされても AP+2000 ではなく +1000 (boundAnyMatchesFilter は boolean)
//   - デッキ1枚では「上から2枚リムーブ」不能 → 以降解決不可 (gate:true)
// rules: 08-contact.md, 15-abilities-effects.md, 17-icons.md, 22-qa-action-contact.md, 26-qa-deck-refresh.md

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from 'immer';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { mutate } from '@/engine/mutate/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { createEmptyGameState } from '@/engine/state-factory';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import { applyOptionalAndContinuation } from '@/engine/effect/apply-pick';
import { _peekPendingEffectOptionalSide, _clearPendingEffectPickQueue, _clearPendingEffectOptionalSide } from '@/engine/effect/resolve-picks';
import { declare, advance, _resetActionContexts } from '@/engine/flow/action/state-machine';
import { B08038 } from '@/cards/ct-p08/B08038';
import type { CardDef, GameState, Player } from '@/engine/types';

// filter 一致キャラ (deck に積む — 印字 trait で boundAnyMatchesFilter が評価)
function ch(id: string, traits: string[], ap = 3000, kind: 'character' | 'event' = 'character'): CardDef {
  return { id, no: id, kind, names: [id], colors: ['赤'], level: 3, ap, lp: 1, traits, rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}
const KOKO = ch('KOKO', ['高校生']);       // trait[高校生] 一致
const SUZUKI = ch('SUZUKI', ['鈴木財閥']); // trait[鈴木財閥] 一致
const DECOY = ch('DECOY', ['警察']);       // filter 外 (非一致 character)
const DEF = ch('DEF', []);                  // action 対象 (opp scene, sleep)
const ATK = ch('ATK', [], 3000);            // selfOnly off-variant 用の別攻撃者

const HUMAN = globalThis as { __humanPlayerSide?: Player | null };

beforeEach(() => {
  event._resetRegistry(); _resetTriggeredRegistered(); _resetUidCounter(); resetDefRegistry();
  _clearPendingEffectPickQueue(); _clearPendingEffectOptionalSide(); _resetActionContexts();
  registerCardDef(B08038);
  registerCardDef(KOKO); registerCardDef(SUZUKI); registerCardDef(DECOY); registerCardDef(DEF); registerCardDef(ATK);
  registerTriggeredListener();
  HUMAN.__humanPlayerSide = null;
});

// deck 上から N 枚を milled 対象にするため deck[0..] を明示 (removeFromTop = splice(0,n))
function board(owner: Player, deck: string[]): {
  s: GameState; kyo: string; def: string; atk: string;
} {
  const foe: Player = owner === 'self' ? 'opp' : 'self';
  let kyo = '', def = '', atk = '';
  const s = produce(createEmptyGameState(), (d) => {
    d.turn = { number: 3, player: owner, phase: 'main', isFirstPlayerFirstTurn: false };
    kyo = mutate.scene.enter(d, owner, 'B08038', {}).uid;
    atk = mutate.scene.enter(d, owner, 'ATK', {}).uid;
    def = mutate.scene.enter(d, foe, 'DEF', { active: false }).uid; // action 対象は sleep
    d.players[owner].deck = [...deck];
  });
  return { s, kyo, def, atk };
}

// real contact:start driver (declare → advance で contact-pending 通過)
function driveContact(d: GameState, atkUid: string, dftUid: string): void {
  const ax = declare(d, atkUid, { kind: 'char', uid: dftUid });
  for (let i = 0; i < 6 && ax.phase !== 'judge' && ax.phase !== 'contact'; i++) advance(d, ax);
}

describe('B08038 京極真 — shape', () => {
  it('id/no/色/lv/ap/特徴 + a1 contact:start selfOnly / turn:self / optional-chain', () => {
    expect(B08038.id).toBe('B08038');
    expect(B08038.no).toBe('0877/B08038');
    expect(B08038.colors).toEqual(['白']);
    expect(B08038.ap).toBe(5000);
    expect(B08038.traits).toEqual(['高校生', '空手家']);
    const a1 = B08038.abilities[0];
    expect(a1.trigger?.hook).toBe('contact:start');
    expect(a1.trigger?.selfOnly).toBe(true);
    expect(a1.condition).toMatchObject({ kind: 'turn', player: 'self' });
    expect(a1.effect?.kind).toBe('optional');
  });
});

describe('B08038 京極真 — behavioral (engine 実評価)', () => {
  it('S1 happy: 高校生+鈴木財閥 を milled → opt-in → AP+1000 (2枚一致でも +1000, QA)', () => {
    HUMAN.__humanPlayerSide = 'self';
    const { s, kyo, def } = board('self', ['KOKO', 'SUZUKI', 'DECOY', 'DECOY']);
    const after = produce(s, (d) => {
      driveContact(d, kyo, def);
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, '京極 optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true); // 「する」
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, kyo)).toBe(6000);      // 5000 + 1000(contact)、+2000 ではない
    expect(after.players.self.deck.length).toBe(2);          // 2枚 milled
    expect(after.players.self.remove).toEqual(expect.arrayContaining(['KOKO', 'SUZUKI']));
  });

  it('S2 decoy: milled top-2 は非一致 (一致カードは deck 3枚目=非milled) → mill 実行も AP 据置', () => {
    HUMAN.__humanPlayerSide = 'self';
    // KOKO は deck[2] に居るが milled 対象は deck[0],deck[1]=DECOY,DECOY のみ
    const { s, kyo, def } = board('self', ['DECOY', 'DECOY', 'KOKO', 'SUZUKI']);
    const after = produce(s, (d) => {
      driveContact(d, kyo, def);
      runAllUntilEmpty(d);
      applyOptionalAndContinuation(d, _peekPendingEffectOptionalSide()!, true);
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, kyo)).toBe(5000);      // milled が非一致 → boost 無し
    expect(after.players.self.deck.length).toBe(2);          // mill 自体は実行 (DECOY×2 除去)
    expect(after.players.self.remove).toEqual(['DECOY', 'DECOY']);
  });

  it('S3 gate: デッキ1枚 + opt-in → mill 不能 (gate-skip) → 以降解決不可, AP 据置 (QA)', () => {
    HUMAN.__humanPlayerSide = 'self';
    const { s, kyo, def } = board('self', ['KOKO']); // 1枚のみ (2枚未満)
    const after = produce(s, (d) => {
      driveContact(d, kyo, def);
      runAllUntilEmpty(d);
      applyOptionalAndContinuation(d, _peekPendingEffectOptionalSide()!, true);
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, kyo)).toBe(5000);      // gate:true → chain break
    expect(after.players.self.deck.length).toBe(1);          // 1枚 mill されない (all-or-nothing)
    expect(after.players.self.remove).toEqual([]);
  });

  it('S4 optional-decline: opt-out (してもよい を辞退) → mill せず AP 据置', () => {
    HUMAN.__humanPlayerSide = 'self';
    const { s, kyo, def } = board('self', ['KOKO', 'SUZUKI', 'DECOY']);
    const after = produce(s, (d) => {
      driveContact(d, kyo, def);
      runAllUntilEmpty(d);
      applyOptionalAndContinuation(d, _peekPendingEffectOptionalSide()!, false); // 「しない」
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, kyo)).toBe(5000);
    expect(after.players.self.deck.length).toBe(3);          // mill されず不変
  });

  it('S5 off-variant selfOnly: 別キャラ(ATK)がコンタクト → 京極 発火せず, optional surface 無し', () => {
    HUMAN.__humanPlayerSide = 'self';
    const { s, kyo, def, atk } = board('self', ['KOKO', 'SUZUKI', 'DECOY']);
    const after = produce(s, (d) => {
      driveContact(d, atk, def); // 京極 ではなく別キャラ ATK が攻撃 → selfOnly 不成立
      runAllUntilEmpty(d);
      expect(_peekPendingEffectOptionalSide(), 'selfOnly=攻撃者のみ → 京極 non-participant で不発').toBeNull();
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, kyo)).toBe(5000);      // 京極 AP 据置
    expect(after.players.self.deck.length).toBe(3);          // mill されず
  });

  it('S6 owner=opp (BUG-174): opp の京極が opp ターンにコンタクト → opp 京極 AP+1000', () => {
    HUMAN.__humanPlayerSide = 'opp';
    const { s, kyo, def } = board('opp', ['KOKO', 'DECOY', 'DECOY']);
    const after = produce(s, (d) => {
      driveContact(d, kyo, def);
      runAllUntilEmpty(d);
      const p = _peekPendingEffectOptionalSide();
      expect(p, 'opp 側でも optional surface').not.toBeNull();
      applyOptionalAndContinuation(d, p!, true);
      runAllUntilEmpty(d);
    });
    expect(engine.read.char.ap(after, kyo)).toBe(6000);      // owner 反転しても +1000
    expect(after.players.opp.deck.length).toBe(1);
  });
});
