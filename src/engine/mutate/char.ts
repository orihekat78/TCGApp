// engine.mutate.char — キャラ修正プリミティブ
// rules: 03-field-areas.md (状態), 09-cutin-disguise.md (変装引継ぎ), 13-keywords.md, 19-special-rules.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState } from '@/engine/types';

type Player = 'self' | 'opp';
type ModScope = 'turn' | 'contact' | 'permanent';

/** uid でキャラを探す */
function findChar(s: GameState, uid: string) {
  for (const p of ['self', 'opp'] as const) {
    const c = s.players[p].scene.find(c => c.uid === uid);
    if (c) return { char: c, player: p as Player };
  }
  return null;
}

/**
 * AP 修正 (rules/19 下限なし)
 * - scope='permanent': turnEffects['apMod_permanent'] に積む
 * - scope='turn': turnEffects['apMod_turn'] に積む
 * - scope='contact': turnEffects['apMod_contact'] に積む
 */
function modifyAP(s: GameState, uid: string, delta: number, scope: ModScope): void {
  const found = findChar(s, uid);
  if (!found) return;
  const key = `apMod_${scope}`;
  const current = (found.char.turnEffects[key] as number | undefined) ?? 0;
  found.char.turnEffects[key] = current + delta;
}

/**
 * LP 修正 (rules/19 下限なし, 11 LP≤0で推理証拠0枚)
 * - scope='permanent': turnEffects['lpMod_permanent'] に積む
 * - scope='turn': turnEffects['lpMod_turn'] に積む
 * - scope='contact': turnEffects['lpMod_contact'] に積む
 */
function modifyLP(s: GameState, uid: string, delta: number, scope: ModScope): void {
  const found = findChar(s, uid);
  if (!found) return;
  const key = `lpMod_${scope}`;
  const current = (found.char.turnEffects[key] as number | undefined) ?? 0;
  found.char.turnEffects[key] = current + delta;
}

/** apOverride を直接設定 (rules/19 元のLP/APを0にする等) */
function setOverrideAP(s: GameState, uid: string, val: number | null): void {
  const found = findChar(s, uid);
  if (!found) return;
  found.char.apOverride = val;
}

/** lpOverride を直接設定 */
function setOverrideLP(s: GameState, uid: string, val: number | null): void {
  const found = findChar(s, uid);
  if (!found) return;
  found.char.lpOverride = val;
}

/**
 * キーワード付与 (rules/13)
 * - scope='permanent': keywordOverrides.granted に追加 (重複なし)
 * - scope='turn': turnEffects['grantedKeywords'] に追加
 */
function grantKeyword(s: GameState, uid: string, kw: string, scope: ModScope = 'permanent'): void {
  const found = findChar(s, uid);
  if (!found) return;

  if (scope === 'permanent') {
    const granted = found.char.keywordOverrides.granted;
    if (!granted.includes(kw)) {
      granted.push(kw);
    }
  } else {
    // turn/contact: turnEffects['grantedKeywords'] に積む
    const key = 'grantedKeywords';
    const current = (found.char.turnEffects[key] as string[] | undefined) ?? [];
    if (!current.includes(kw)) {
      current.push(kw);
    }
    found.char.turnEffects[key] = current;
  }
}

/** キーワードを取り除く (granted から削除) */
function revokeKeyword(s: GameState, uid: string, kw: string): void {
  const found = findChar(s, uid);
  if (!found) return;
  const granted = found.char.keywordOverrides.granted;
  const idx = granted.indexOf(kw);
  if (idx !== -1) {
    granted.splice(idx, 1);
  }
}

/** 元の能力を無効にする (rules/19) MR能力は無効にならない */
function disableOriginalAbilities(s: GameState, uid: string): void {
  const found = findChar(s, uid);
  if (!found) return;
  found.char.keywordOverrides.disabledOriginal = true;
}

/** turnEffects に任意のキー/値を設定 */
function setTurnEffect(s: GameState, uid: string, key: string, val: unknown): void {
  const found = findChar(s, uid);
  if (!found) return;
  found.char.turnEffects[key] = val;
}

/**
 * ターン終了時の turnEffects クリーンアップ
 * scope='turn': turn 系エフェクト (apMod_turn, lpMod_turn, apMod_contact, lpMod_contact, grantedKeywords) を削除
 */
function clearTurnEffects(s: GameState, uid: string, scope: 'turn' | 'opp-turn'): void {
  const found = findChar(s, uid);
  if (!found) return;
  const te = found.char.turnEffects;
  if (scope === 'turn') {
    delete te['apMod_turn'];
    delete te['lpMod_turn'];
    delete te['apMod_contact'];
    delete te['lpMod_contact'];
    delete te['grantedKeywords'];
  } else if (scope === 'opp-turn') {
    // BUG-101: D11005 挑発 (mustBeTargeted) は「相手のターン終了時まで」。
    // endTurn(p) が相手 (非p=設定者) scene を清掃する経路から呼ばれる。
    delete te['mustBeTargeted'];
  }
}

/**
 * キャラにカードをセット (rules/16 裏向きセット対応)
 * faceUp=false で裏向きセット (リムーブ時に表向きにしてリムーブエリアへ)
 */
function setCard(s: GameState, uid: string, cardId: string, faceUp: boolean): void {
  const found = findChar(s, uid);
  if (!found) return;
  found.char.setCards.push({ cardId, faceUp });
}

/** キャラの下に重ねる (stackedCards 加算) (rules/16) */
function stackCard(s: GameState, uid: string, count: number): void {
  const found = findChar(s, uid);
  if (!found) return;
  found.char.stackedCards += count;
}

/**
 * setCards と stackedCards のクリーンアップ (離場時)
 * setCards → リムーブエリアへ
 * stackedCards → 枚数分の back-card としてリムーブエリアへ
 */
function removeAllSetAndStacked(s: GameState, uid: string): void {
  const found = findChar(s, uid);
  if (!found) return;
  const { char, player } = found;

  // setCards をリムーブエリアへ
  for (const entry of char.setCards) {
    s.players[player].remove.push(entry.cardId);
  }
  char.setCards = [];

  // stackedCards 分の back-card をリムーブエリアへ
  for (let i = 0; i < char.stackedCards; i++) {
    s.players[player].remove.push('back-card');
  }
  char.stackedCards = 0;
}

/**
 * 変装: cardId のみを新カードに変更 (rules/09, 23)
 * 引継ぎテーブル:
 *   ✓ state (スリープ状態)
 *   ✓ turnEffects (contactImmune, removeOnTurnEnd, AP/LP修正, 持続効果)
 *   ✓ keywordOverrides (granted, disabledOriginal)
 *   ✓ setCards / stackedCards
 *   ✓ enterOrder / isNamed
 *   ✓ apOverride / lpOverride
 *   ✕ 元のカード名・色 (新カードのものに変わる = cardId 変更)
 * 元キャラのデッキ下移動は別途 scene.toDeckBottom で処理
 */
function disguiseInto(s: GameState, uid: string, newCardId: string): void {
  const found = findChar(s, uid);
  if (!found) return;
  // cardId だけ変更。その他すべて保持
  found.char.cardId = newCardId;
}

export const char = {
  modifyAP,
  modifyLP,
  setOverrideAP,
  setOverrideLP,
  grantKeyword,
  revokeKeyword,
  disableOriginalAbilities,
  setTurnEffect,
  clearTurnEffects,
  setCard,
  stackCard,
  removeAllSetAndStacked,
  disguiseInto,
};
