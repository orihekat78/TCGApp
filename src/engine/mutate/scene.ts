// engine.mutate.scene — 現場操作プリミティブ
// rules: 03-field-areas.md, 09-cutin-disguise.md, 16-card-set.md, 20-color-and-switch.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState, SceneCharacter, RemoveResult } from '@/engine/types';
import { event } from '../event/index.js';

type Player = 'self' | 'opp';
type CharState = 'active' | 'sleep' | 'stun';
type RemoveCause = 'contact-ap' | 'effect' | 'switch' | 'cost' | 'misplay-overflow';

export interface EnterOpts {
  active?: boolean;   // false で sleep 状態で登場 (デフォルト: true)
  named?: boolean;    // 名乗り状態 (デフォルト: false)
  viaEffect?: boolean; // 効果による登場 (デフォルト: false)
}

/** 現場を問わず uid でキャラを探す */
function findChar(s: GameState, uid: string): { char: SceneCharacter; player: Player } | null {
  for (const p of ['self', 'opp'] as const) {
    const c = s.players[p].scene.find(c => c.uid === uid);
    if (c) return { char: c, player: p };
  }
  return null;
}

/** UID 生成カウンタ管理 (GameState に直接持たない — state 外のモジュールローカル) */
let _uidCounter = 0;
function generateUid(cardId: string): string {
  return `${cardId}#${++_uidCounter}`;
}

/** UID カウンタのリセット (テスト用) */
export function _resetUidCounter(): void {
  _uidCounter = 0;
}

/**
 * キャラを現場に登場させる (rules/03, 20)
 * 5枚超過は例外 throw
 */
function enter(s: GameState, p: Player, cardId: string, opts: EnterOpts): SceneCharacter {
  if (s.players[p].scene.length >= 5) {
    throw new Error(`scene full: cannot enter ${cardId} for ${p} (scene has ${s.players[p].scene.length} chars)`);
  }

  const currentCount = s.players[p].scene.length;
  // rules/17 §【疾風 N】用: ターン境界でリセットされる「このターンの登場番目」を increment
  const prevTurnEnter = s.turnState[p].enterCountThisTurn ?? 0;
  s.turnState[p].enterCountThisTurn = prevTurnEnter + 1;
  const char: SceneCharacter = {
    cardId,
    uid: generateUid(cardId),
    state: opts.active === false ? 'sleep' : 'active',
    isNamed: opts.named ?? false,
    enterOrder: currentCount + 1,
    enterOrderThisTurn: prevTurnEnter + 1,
    setCards: [],
    stackedCards: 0,
    keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null,
    lpOverride: null,
    turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  };

  s.players[p].scene.push(char);
  return char;
}

/**
 * スイッチ登場: 既存キャラを cause='switch' でリムーブして新キャラ登場 (rules/20)
 */
function switchEnter(
  s: GameState,
  p: Player,
  cardId: string,
  removeUid: string,
  opts: EnterOpts,
): SceneCharacter {
  // 既存キャラをリムーブ (スイッチは通常の 5枚制限をバイパスするため先に除去)
  removeToRemove(s, removeUid, 'switch');
  // 新キャラ登場
  return enter(s, p, cardId, opts);
}

/**
 * キャラをリムーブエリアへ移動 (rules/03, 16)
 * setCards → リムーブ、stackedCards → back-card でリムーブ
 */
function removeToRemove(s: GameState, uid: string, cause: RemoveCause): RemoveResult {
  const found = findChar(s, uid);
  if (!found) {
    return {
      removed: { uid, cardId: '' },
      setCardsRemoved: [],
      stackedCardsRemoved: 0,
      triggeredHooks: [],
    };
  }

  const { char, player } = found;
  // rules/17 §【現場リムーブ時】 emit 用に離場カードの識別子を splice 前に捕捉
  const leavingUid = char.uid;
  const leavingCardId = char.cardId;

  // setCards のカードをリムーブエリアへ (rules/16 セット解除: リムーブ時表向きに)
  const setCardsRemoved: string[] = char.setCards.map(e => e.cardId);
  s.players[player].remove.push(...setCardsRemoved);

  // stackedCards 分も back-card としてリムーブ
  const stackedCardsRemoved = char.stackedCards;
  for (let i = 0; i < stackedCardsRemoved; i++) {
    s.players[player].remove.push('back-card');
  }

  // キャラ本体をリムーブエリアへ
  const idx = s.players[player].scene.findIndex(c => c.uid === uid);
  if (idx !== -1) {
    s.players[player].scene.splice(idx, 1);
  }
  s.players[player].remove.push(char.cardId);

  // rules/17 §【現場リムーブ時】(リムーブ方法は問わない) → leave:to-remove Hook 発火。
  // rules/30: 現場6枚超過の修正処置 (misplay-overflow) はリムーブ発動能力 不発動 → 除外。
  // 既存カードは未購読のため additive (回帰0)。listener: src/engine/listeners/triggered.ts
  if (cause !== 'misplay-overflow') {
    event.emit(
      s,
      'leave:to-remove',
      { uid: leavingUid, cause },
      { player, uid: leavingUid, cardId: leavingCardId },
    );
  }

  return {
    removed: { uid: char.uid, cardId: char.cardId },
    setCardsRemoved,
    stackedCardsRemoved,
    triggeredHooks: [],
  };
}

/**
 * 変装で元キャラをデッキの下へ移動 (rules/09)
 * リムーブではないため「現場リムーブ時」効果は発動しない (rules/23)
 */
function toDeckBottom(s: GameState, uid: string): void {
  const found = findChar(s, uid);
  if (!found) return;

  const { char, player } = found;
  const idx = s.players[player].scene.findIndex(c => c.uid === uid);
  if (idx !== -1) {
    s.players[player].scene.splice(idx, 1);
  }
  // デッキの下へ
  s.players[player].deck.push(char.cardId);
}

/**
 * 現場から所有者のデッキへ移す (Task D E2, 2026-06-12)
 * rules/16: 現場を離れるとき set/stacked はリムーブ (toHand と同一処理)。
 * rules/09・23: デッキ移動はリムーブではないため leave:to-remove は emit しない。
 * - 変装専用の toDeckBottom (rules/16 処理なし・set/stacked は新キャラへ引継ぎ) とは別物。
 * - 所有者のデッキ (char の所属プレイヤー) に入る。effect 発動側ではない点に注意。
 */
function toDeck(s: GameState, uid: string, pos: 'bottom' | 'top' = 'bottom'): void {
  const found = findChar(s, uid);
  if (!found) return;

  const { char, player } = found;
  // rules/16 setCards / stackedCards は離場時にリムーブされる
  if (char.setCards.length > 0) {
    s.players[player].remove.push(...char.setCards.map(e => e.cardId));
  }
  for (let i = 0; i < char.stackedCards; i++) {
    s.players[player].remove.push('back-card');
  }

  const idx = s.players[player].scene.findIndex(c => c.uid === uid);
  if (idx !== -1) {
    s.players[player].scene.splice(idx, 1);
  }
  if (pos === 'top') {
    s.players[player].deck.unshift(char.cardId);
  } else {
    s.players[player].deck.push(char.cardId);
  }
}

/**
 * 現場から所有者の手札へ戻す (rules/16: 現場を離れるとき set/stacked はリムーブ)
 * engine-extension #4 (2026-06-05): char→hand bounce verb の primitive.
 * - リムーブではないため leave:to-remove は emit しない (rules/17 と整合)
 * - 所有者の手札 (char の所属プレイヤー) に cardId を push。effect 発動側ではない点に注意。
 */
function toHand(s: GameState, uid: string): void {
  const found = findChar(s, uid);
  if (!found) return;

  const { char, player } = found;
  // rules/16 setCards / stackedCards は離場時にリムーブされる
  if (char.setCards.length > 0) {
    s.players[player].remove.push(...char.setCards.map(e => e.cardId));
  }
  for (let i = 0; i < char.stackedCards; i++) {
    s.players[player].remove.push('back-card');
  }

  const idx = s.players[player].scene.findIndex(c => c.uid === uid);
  if (idx !== -1) {
    s.players[player].scene.splice(idx, 1);
  }
  // キャラ本体は所有者の手札へ
  s.players[player].hand.push(char.cardId);
}

/**
 * キャラの状態を直接設定 (rules/03)
 * ⚠ active を渡したとき、現在 stun なら sleep に変換 (スタン特殊挙動)
 * ⚠ stun 状態で sleep/stun を渡してもスタンのまま
 */
function setState(s: GameState, uid: string, st: CharState): void {
  const found = findChar(s, uid);
  if (!found) return;

  const { char } = found;

  // スタン状態の特殊挙動 (rules/03)
  if (char.state === 'stun') {
    if (st === 'active') {
      // スタン状態でアクティブにする効果を受けた → スリープになる
      char.state = 'sleep';
    }
    // sleep/stun を渡してもスタンのまま (何もしない)
    return;
  }

  char.state = st;
}

/**
 * tryActivate: setState('active') と同等だが意味として明示
 * スタン状態では sleep に変換 (rules/03)
 */
function tryActivate(s: GameState, uid: string): void {
  setState(s, uid, 'active');
}

/** 名乗り状態を解除する (ターン跨ぎで自動呼出し) */
function clearNamed(s: GameState, uid: string): void {
  const found = findChar(s, uid);
  if (!found) return;
  found.char.isNamed = false;
}

export const scene = {
  enter,
  switchEnter,
  removeToRemove,
  toHand,
  toDeck,
  toDeckBottom,
  setState,
  tryActivate,
  clearNamed,
};
