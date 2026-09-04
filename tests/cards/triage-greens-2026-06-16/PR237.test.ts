// gate5 RUNTIME behavior — PR237 犯人 (character, 黒, Lv3 AP0 LP0, 特徴[犯人])
//
// 公式テキスト:
//   effect (a1)  【パートナー黒】【自分ターン中】このキャラがキャラとコンタクトしたとき、そのキャラをリムーブする。
//   hirameki (a2)【ヒラメキ】自分のデッキのカードを上から5枚リムーブする。（発動させないことを選択できる）
//
// rules:
//   07-action-flow.md  (アクション宣言 → ガード判定 → コンタクト発生),
//   08-contact.md      (コンタクト = 攻撃キャラ vs 対象キャラ / ガード時は ガードキャラ が「そのキャラ」),
//   10-action-event.md (【ヒラメキ】= 証拠が action[事件] でリムーブされるとき発動 / 発動は任意),
//   14-refresh.md / 26-qa-deck-refresh.md (mill でデッキ枯渇時の挙動),
//   17-icons.md        (【パートナー黒】/【自分ターン中】= 条件アイコン未達なら能力非所持扱い),
//   22-qa-action-contact.md (「コンタクトしたとき」効果 = contact:start = コンタクト発生後・行動順確認前).
//
// 検証の核 (BUG-117/118 教訓 + certify notes:「contact:start+bUid+sceneRemove の triple は
//   実カードで未テスト」, confidence med — DSL に書いても engine が評価する保証はないので実機flowで踏む):
//   a1 を「実 action 状態機械」(declare → passGuard → advance → advance で contact:start emit) で駆動し、
//     - trigger {hook:'contact:start', selfOnly:true} が **攻撃者が PR237 のときのみ** 発火するか
//       (source.uid===PR237.uid のときのみ。別キャラが攻撃したときは非発火 = selfOnly 実評価)。
//     - effect sceneRemove {uid:'$trigger.bUid'} が **コンタクト相手 (= bUid) だけ** をリムーブするか
//       (= 「そのキャラ」。攻撃者自身 aUid / 第三者 bystander は残る = $trigger.bUid が runtime ctx の
//        triggerPayload から正しく解決される end-to-end 検証。これが certify で唯一 untested だった path)。
//     - ガードされた場合は bUid = guardUid → **ガードキャラ** が「そのキャラ」としてリムーブされるか (rules/08)。
//     - condition and[partnerColor黒, turn:self] を engine が **実評価** するか
//       (パートナー非黒 / 相手ターン中 の contact では a1 非発火 = コンタクト相手が生き残る)。
//   a2 (ヒラメキ mill self 5) を 証拠 action[事件] リムーブで実発火させ、fire でデッキ上5枚が remove へ、
//     skip で no-op (「発動させないことを選択できる」rules/10) になるか。
//
// CRITICAL HONESTY: 公式テキストが命じる挙動をアサートする。a1 の「そのキャラ」は rules/08 上
//   コンタクト中のキャラ (非ガード=対象キャラ / ガード時=ガードキャラ) を指す。engine の bUid は
//   ax.guardUid ?? target.uid なのでこの語義と一致する。

import { describe, it, expect, beforeEach } from 'vitest';
import { produce } from '@/engine/produce';
import { createMainGameState as createEmptyGameState } from '../../helpers/main-game-state';
import { engine } from '@/engine';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import {
  registerHiramekiListener,
  _drainPendingHirameki,
  _resetPendingHirameki,
  _resetHiramekiRegistered,
} from '@/engine/listeners/hirameki';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { runAllUntilEmpty } from '@/engine/resolve/stack';
import {
  declare,
  passGuard,
  tryGuard,
  advance,
  _resetActionContexts,
} from '@/engine/flow/action/state-machine';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { _clearPendingEffectPickQueue } from '@/engine/effect/resolve-picks';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useGameStateStore } from '@/ui/state/store';
import { registerAll } from '@/cards/index';
import { makeChar } from '../../helpers/fixtures';
import { PR237 } from '@/cards/pr-01/PR237';
import type { CardDef, GameState, ActionContext } from '@/engine/types';
import { dispatchCurrentDecision } from '../../helpers/dispatch-current-decision';
import { openCaseHirameki } from '../../helpers/open-case-hirameki';

// ---- 合成 def (id prefix DEC_PR237_ で衝突回避 / abilities:[] で再帰トリガ回避) ----
function pchar(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['赤'],
    level: 5, ap: 5000, lp: 1, traits: [], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}

const PARTNER_BLACK = 'DEC_PR237_PARTNER_BLACK'; // パートナー黒 → 【パートナー黒】成立
const PARTNER_RED = 'DEC_PR237_PARTNER_RED';     // パートナー非黒 → 【パートナー黒】不成立 (negative)
const ATTACKER2 = 'DEC_PR237_ATTACKER2';         // PR237 以外の自分キャラ (selfOnly negative 用)
const DEFENDER = 'DEC_PR237_DEFENDER';           // コンタクト相手 (= bUid。リムーブ対象)
const BYSTANDER_OPP = 'DEC_PR237_BYSTANDER_OPP'; // 相手の別キャラ (コンタクト外 → 残るべき)
const BYSTANDER_SELF = 'DEC_PR237_BYSTANDER_SELF'; // 自分の別キャラ (コンタクト外 → 残るべき)
const GUARD = 'DEC_PR237_GUARD';                 // ガードキャラ (ガード時の bUid)
const MILLFILL = 'DEC_PR237_MILLFILL';           // deck filler (refresh 回避)

function registerDecoys(): void {
  registerCardDef(pchar(PARTNER_BLACK, { kind: 'partner', colors: ['黒'], ap: 0, lp: 5 } as Partial<CardDef>));
  registerCardDef(pchar(PARTNER_RED, { kind: 'partner', colors: ['赤'], ap: 0, lp: 5 } as Partial<CardDef>));
  registerCardDef(pchar(ATTACKER2, { colors: ['黒'], ap: 5000 }));
  registerCardDef(pchar(DEFENDER, { colors: ['赤'], ap: 1000 }));
  registerCardDef(pchar(BYSTANDER_OPP, { colors: ['赤'], ap: 1000 }));
  registerCardDef(pchar(BYSTANDER_SELF, { colors: ['赤'], ap: 1000 }));
  registerCardDef(pchar(GUARD, { colors: ['赤'], ap: 1000 }));
  registerCardDef(pchar(MILLFILL, { colors: ['赤'] }));
}

const sceneUids = (s: GameState, side: 'self' | 'opp') => s.players[side].scene.map((c) => c.uid);
const onScene = (s: GameState, side: 'self' | 'opp', uid: string) => sceneUids(s, side).includes(uid);

// ---- a1 base: PR237 を self.scene に / DEFENDER(+bystander) を opp.scene に。partner 色 + turn を可変 ----
function a1Base(opts: {
  turn: 'self' | 'opp';
  partner: 'black' | 'red';
  withGuard?: boolean;
  attackerIsPR237?: boolean; // false なら ATTACKER2 が攻撃者 (selfOnly negative)
}): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 4, player: opts.turn, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.partner = {
    cardId: opts.partner === 'black' ? PARTNER_BLACK : PARTNER_RED,
    state: 'active',
    location: 'partner-area',
  };
  // 自分の現場: PR237 (攻撃者) + ATTACKER2 (selfOnly negative 用の別攻撃者) + 自分 bystander
  s.players.self.scene = [
    makeChar({ cardId: 'PR237', uid: 'hanin#1', state: 'active', isNamed: false }),
    makeChar({ cardId: ATTACKER2, uid: 'atk2#1', state: 'active', isNamed: false }),
    makeChar({ cardId: BYSTANDER_SELF, uid: 'sbys#1', state: 'active', isNamed: false }),
  ];
  // 相手の現場: DEFENDER (sleep = action 対象適格) + opp bystander (sleep)
  s.players.opp.scene = [
    makeChar({ cardId: DEFENDER, uid: 'def#1', state: 'sleep', isNamed: false }),
    makeChar({ cardId: BYSTANDER_OPP, uid: 'obys#1', state: 'sleep', isNamed: false }),
  ];
  if (opts.withGuard) {
    // ガードは防御側 (opp) の active キャラ
    s.players.opp.scene.push(makeChar({ cardId: GUARD, uid: 'grd#1', state: 'active', isNamed: false }));
  }
  s.players.self.deck = Array(8).fill('d');
  s.players.opp.deck = Array(8).fill('e');
  return s;
}

// ---- contact:start まで駆動 (declare → passGuard → advance×2)。guardUid 指定時は tryGuard 経由 ----
function driveContactToStart(s: GameState, attackerUid: string, targetUid: string, guardUid?: string): GameState {
  return produce(s, (d) => {
    const ax: ActionContext = declare(d, attackerUid, { kind: 'char', uid: targetUid });
    if (guardUid) {
      tryGuard(d, ax, guardUid); // guard-window → leave-resolution (bUid = guardUid)
    } else {
      passGuard(d, ax); // guard-window → leave-resolution
    }
    advance(d, ax); // leave-resolution → contact-pending
    advance(d, ax); // contact-pending → action-1 (emit contact:start {aUid, bUid})
    runAllUntilEmpty(d); // queued triggered effect (sceneRemove $trigger.bUid) を解決
  });
}

// ---- a2 base: PR237 を self.evidence に / deck filler ----
function a2State(deckN = 8): GameState {
  _resetUidCounter();
  const s = createEmptyGameState();
  s.turn = { number: 4, player: 'opp', phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  s.players.self.evidence = [{ cardId: 'PR237', faceUp: false, origin: { turn: 1, via: 'action-case' } }];
  s.players.self.deck = Array(deckN).fill(MILLFILL);
  return s;
}

// ヒラメキ fire/skip ドライブ (B02025.test.ts emitHirameki と同一ハーネス)。
function finishCaseAction(actionId: string): void {
  for (let i = 0; i < 2 && useGameStateStore.getState().activeActionId === actionId; i++) {
    expect(dispatchEngineAction({ type: 'actionAdvance', actionId })).toEqual({ ok: true });
  }
  expect(useGameStateStore.getState().activeActionId).toBeNull();
}

function emitHirameki(s: GameState, choice: 'fire' | 'skip'): { actionId: string; state: GameState } {
  const { actionId, pending } = openCaseHirameki(s, 'PR237');
  expect(pending, 'ヒラメキ pending が side-channel に set される (a2 実発火)').not.toBeNull();
  expect(pending.cardId).toBe('PR237');
  expect(pending.abilityId).toBe('a2');
  expect(pending.player, 'pending.player = self (証拠を失った側)').toBe('self');
  const r = dispatchCurrentDecision({ type: 'hiramekiResolve', choice });
  expect(r.ok, `hiramekiResolve ${choice} ok`).toBe(true);
  expect(useGameStateStore.getState().pendingHirameki, 'pending クリア').toBeNull();
  return { actionId, state: useGameStateStore.getState().gameState! };
}

describe('PR237 犯人 — gate5 runtime behavior', () => {
  beforeEach(() => {
    event._resetRegistry();
    _resetTriggeredRegistered();
    _resetHiramekiRegistered();
    _resetActionContexts();
    _resetUidCounter();
    _resetPendingHirameki();
    resetDefRegistry();
    _clearPendingEffectPickQueue();
    (globalThis as { __pendingEffectPickQueue?: unknown[] }).__pendingEffectPickQueue = [];
    (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = null;
    registerAll();
    registerDecoys();
    registerTriggeredListener();
    registerHiramekiListener();
    useGameStateStore.setState({
      gameState: null, activeActionId: null, pendingHirameki: null, pendingMisread: null,
    });
  });

  // ===== a1 + DECOY: 【パートナー黒】【自分ターン中】PR237 が DEFENDER とコンタクト → DEFENDER だけリムーブ =====
  it('a1 + DECOY: PR237 が相手キャラ(DEFENDER)とコンタクトすると そのキャラ(=bUid)だけリムーブ — 攻撃者自身/第三者(opp,self)は残る', () => {
    const s0 = a1Base({ turn: 'self', partner: 'black' });
    const after = driveContactToStart(s0, 'hanin#1', 'def#1');

    // 「そのキャラ」= コンタクト相手 (bUid=def#1) がリムーブされた
    expect(onScene(after, 'opp', 'def#1'), 'コンタクト相手 DEFENDER がリムーブされた').toBe(false);
    expect(after.players.opp.remove.includes(DEFENDER), 'DEFENDER は remove エリアへ').toBe(true);
    // DECOY: 攻撃者自身 (aUid=hanin#1) は残る ($trigger.bUid が attacker を指していない証明)
    expect(onScene(after, 'self', 'hanin#1'), '攻撃者 PR237 自身は残る (bUid≠aUid)').toBe(true);
    // DECOY: コンタクト外の第三者 (opp / self) は残る (= bUid 単体解決の証明)
    expect(onScene(after, 'opp', 'obys#1'), '相手の別キャラ(コンタクト外)は残る').toBe(true);
    expect(onScene(after, 'self', 'sbys#1'), '自分の別キャラ(コンタクト外)は残る').toBe(true);
    expect(after.players.opp.scene.length, '相手の現場は DEFENDER のみ減って 2→1').toBe(1);
  });

  // ===== a1 ガード: ガードされた場合 bUid=guardUid → 「そのキャラ」= ガードキャラがリムーブ (rules/08) =====
  it('a1 (ガード時): コンタクトがガードされると bUid=ガードキャラ → ガードキャラがリムーブ / 元の対象(DEFENDER)は残る', () => {
    const s0 = a1Base({ turn: 'self', partner: 'black', withGuard: true });
    const after = driveContactToStart(s0, 'hanin#1', 'def#1', 'grd#1');

    // rules/08: ガード時のコンタクトは 攻撃キャラ vs ガードキャラ → 「そのキャラ」= ガードキャラ
    expect(onScene(after, 'opp', 'grd#1'), 'ガードキャラ(=bUid)がリムーブされた').toBe(false);
    expect(after.players.opp.remove.includes(GUARD), 'ガードキャラは remove エリアへ').toBe(true);
    // 元の指定対象 DEFENDER はコンタクトに参加していない → 残る
    expect(onScene(after, 'opp', 'def#1'), 'ガードされたので元の対象 DEFENDER は残る').toBe(true);
    expect(onScene(after, 'self', 'hanin#1'), '攻撃者 PR237 自身は残る').toBe(true);
  });

  // ===== BUG-330 admission: own actor cannot start contact during the opponent turn =====
  it('相手ターン中はPR237のアクション宣言を効果発火前に拒否する', () => {
    const s0 = a1Base({ turn: 'opp', partner: 'black' });
    const before = structuredClone(s0);
    expect(() => driveContactToStart(s0, 'hanin#1', 'def#1')).toThrow(/cannot action/);
    expect(s0).toEqual(before);
  });

  // ===== a1 condition NEGATIVE (partnerColor 非黒): 【パートナー黒】未達 → 非発火 =====
  it('a1 condition NEGATIVE (partner非黒): パートナーが赤のとき a1 非発火 → DEFENDER は残る', () => {
    const s0 = a1Base({ turn: 'self', partner: 'red' });
    const after = driveContactToStart(s0, 'hanin#1', 'def#1');

    expect(onScene(after, 'opp', 'def#1'), 'パートナー非黒 → 【パートナー黒】不成立 → DEFENDER 残る').toBe(true);
    expect(after.players.opp.remove.includes(DEFENDER), 'DEFENDER は remove に入らない').toBe(false);
  });

  // ===== a1 selfOnly NEGATIVE: PR237 以外のキャラが攻撃 → PR237 の a1 は非発火 =====
  it('a1 selfOnly NEGATIVE: 別の自分キャラ(ATTACKER2)が DEFENDER とコンタクト → PR237 の a1 非発火 → DEFENDER 残る', () => {
    const s0 = a1Base({ turn: 'self', partner: 'black' });
    // 攻撃者 = ATTACKER2 (PR237 ではない)。contact:start source.uid=atk2#1 ≠ PR237.uid → selfOnly 不一致
    const after = driveContactToStart(s0, 'atk2#1', 'def#1');

    expect(onScene(after, 'opp', 'def#1'), 'PR237 以外が攻撃 → PR237 a1 非発火 → DEFENDER 残る').toBe(true);
    expect(after.players.opp.remove.includes(DEFENDER), 'DEFENDER は remove に入らない').toBe(false);
    expect(onScene(after, 'self', 'hanin#1'), 'PR237 自身も健在').toBe(true);
  });

  // ===== a2 trigger: ヒラメキが evidence:remove-by-action で実発火し pending に surface =====
  it('a2 trigger: PR237 が証拠から action[事件] でリムーブされると ヒラメキ pending {cardId:PR237, abilityId:a2} が立つ', () => {
    const s0 = a2State();
    produce(s0, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: 'PR237' } }, { player: 'opp', uid: 'atk' });
    });
    const pending = _drainPendingHirameki();
    expect(pending, 'ヒラメキ pending が立つ').not.toBeNull();
    expect(pending?.cardId).toBe('PR237');
    expect(pending?.abilityId).toBe('a2');
    expect(pending?.player, 'pending.player = self (証拠を失った側)').toBe('self');
  });

  it('a2 trigger NEGATIVE: 別カードの証拠リムーブでは PR237 のヒラメキは立たない', () => {
    const s0 = a2State();
    produce(s0, (d) => {
      event.emit(d, 'evidence:remove-by-action', { player: 'self', ev: { cardId: MILLFILL } }, { player: 'opp', uid: 'atk' });
    });
    expect(_drainPendingHirameki(), '別カードのリムーブでは PR237 ヒラメキ非発火').toBeNull();
  });

  // ===== a2 fire: ヒラメキ発動 → デッキ上5枚を remove へ (mill self 5) =====
  it('a2 fire: ヒラメキ発動でデッキ上5枚がリムーブされる (deck 8→3 / remove +5)', () => {
    const s0 = a2State(8);
    const beforeDeck = s0.players.self.deck.length;
    const beforeRemove = s0.players.self.remove.length;
    const { actionId } = emitHirameki(s0, 'fire');
    finishCaseAction(actionId);
    const after = useGameStateStore.getState().gameState!;

    expect(after.players.self.deck.length, 'デッキ -5 (8→3)').toBe(beforeDeck - 5);
    expect(after.players.self.remove.length, 'action removed evidence + mill 5').toBe(beforeRemove + 6);
  });

  it('a2 short deck: refresh excludes the resolving PR237 Hirameki card', () => {
    const { actionId, state: interim } = emitHirameki(a2State(3), 'fire');

    expect(interim.refreshCount.self, 'empty short deck refreshes exactly once').toBe(1);
    expect(interim.players.self.deck, 'only the three milled fillers return to deck').toEqual([
      MILLFILL,
      MILLFILL,
      MILLFILL,
    ]);
    expect(interim.players.self.deck, 'the resolving Hirameki card is excluded from refresh').not.toContain('PR237');
    finishCaseAction(actionId);
    const after = useGameStateStore.getState().gameState!;
    expect(after.players.self.remove, 'PR237 enters remove only after its effect resolves').toEqual(['PR237']);
  });

  // ===== a2 skip: 「発動させないことを選択できる」(rules/10) → no-op =====
  it('a2 skip: ヒラメキを発動しない選択ではデッキ/リムーブ不変 (no-op)', () => {
    const s0 = a2State(8);
    const beforeDeck = s0.players.self.deck.length;
    const beforeRemove = s0.players.self.remove.length;
    const { actionId } = emitHirameki(s0, 'skip');
    finishCaseAction(actionId);
    const after = useGameStateStore.getState().gameState!;

    expect(after.players.self.deck.length, 'skip → デッキ不変').toBe(beforeDeck);
    expect(after.players.self.remove.length, 'skip → action removed evidence のみ追加').toBe(beforeRemove + 1);
  });

  // ===== descriptor 構造 sanity =====
  it('descriptor: a1=triggered(contact:start selfOnly)+and[partnerColor黒,turn:self] sceneRemove $trigger.bUid, a2=ヒラメキ mill self 5', () => {
    const [a1, a2] = PR237.abilities;
    // a1
    expect(a1.type).toBe('triggered');
    expect(a1.scope).toBe('on-scene');
    expect(a1.trigger).toMatchObject({ hook: 'contact:start', selfOnly: true });
    expect(a1.condition).toMatchObject({
      kind: 'and',
      cs: [{ kind: 'partnerColor', color: '黒' }, { kind: 'turn', player: 'self' }],
    });
    expect(a1.effect).toMatchObject({
      kind: 'atom', verb: 'sceneRemove', args: { uid: '$trigger.bUid', cause: 'effect' },
    });
    // a2 (ヒラメキ — 直接 mill。UI dispatch でなく engine 内 atom)
    expect(a2.type).toBe('triggered');
    expect(a2.scope).toBe('on-evidence');
    expect(a2.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a2.effect).toMatchObject({ kind: 'atom', verb: 'mill', args: { player: 'self', n: 5 } });
  });
});
