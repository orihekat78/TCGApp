// engine.read.char — キャラ単位派生情報セレクタ (純粋関数)
// rules: 03-field-areas.md (状態), 11-reasoning.md (LP≤0), 13-keywords.md, 19-special-rules.md

import type { GameState, CardId, SetCardEntry } from '@/engine/types';
import { scene } from './scene.js';
import { def } from './def.js';

// AP: apOverride が null でなければそれを使用、あれば CardDef base を取得
// turnEffects の AP 修正は charModifyAP verb で apOverride に吸収される設計のため
// ここでは apOverride || (CardDef.ap ?? 0) とする
// rules: 19-special-rules.md (下限なし)
function ap(s: GameState, uid: string): number {
  const char = scene.byUid(s, uid);
  if (!char) return 0;
  if (char.apOverride !== null) return char.apOverride;
  const d = def.card(char.cardId);
  return d?.ap ?? 0;
}

// LP: 同様に lpOverride 優先
// rules: 19-special-rules.md (下限なし), 11-reasoning.md (LP≤0 で証拠0枚)
function lp(s: GameState, uid: string): number {
  const char = scene.byUid(s, uid);
  if (!char) return 0;
  if (char.lpOverride !== null) return char.lpOverride;
  const d = def.card(char.cardId);
  return d?.lp ?? 0;
}

function level(s: GameState, uid: string): number {
  const char = scene.byUid(s, uid);
  if (!char) return 0;
  const d = def.card(char.cardId);
  return d?.level ?? 0;
}

function colors(s: GameState, uid: string): string[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  const d = def.card(char.cardId);
  return d?.colors ?? [];
}

// 複数名カード対応 (rules: 19-special-rules.md — &, 『』, () で分割名を持つ)
function names(s: GameState, uid: string): string[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  const d = def.card(char.cardId);
  return d?.names ?? [];
}

function traits(s: GameState, uid: string): string[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  const d = def.card(char.cardId);
  return d?.traits ?? [];
}

// keywords: granted + 元能力 (disabledOriginal の場合は元抜き)
// rules: 19-special-rules.md (元の能力を無効にする), 18-mr.md (MR能力は無効にならない)
function keywords(s: GameState, uid: string): string[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  const granted = char.keywordOverrides.granted;
  if (char.keywordOverrides.disabledOriginal) {
    // 元の CardDef キーワードは除外、granted のみ
    return [...granted];
  }
  // CardDef にキーワードがあれば取得 (Phase 5 で abilities から展開)
  // Phase 5 実装前は空配列をベースに granted を追加
  const d = def.card(char.cardId);
  const base: string[] = (d as { keywords?: string[] } | undefined)?.keywords ?? [];
  // granted を追加 (重複除去)
  return [...new Set([...base, ...granted])];
}

function hasKeyword(s: GameState, uid: string, kw: string): boolean {
  return keywords(s, uid).includes(kw);
}

function state(s: GameState, uid: string): 'active' | 'sleep' | 'stun' {
  const char = scene.byUid(s, uid);
  return char?.state ?? 'sleep';
}

function isNamed(s: GameState, uid: string): boolean {
  const char = scene.byUid(s, uid);
  return char?.isNamed ?? false;
}

// setCards: 互換性のため CardId[] を返す (cardId のみ)
// 詳細情報が必要な場合は setCardsDetailed を使用 (rules: 16-card-set.md)
function setCards(s: GameState, uid: string): CardId[] {
  const char = scene.byUid(s, uid);
  return (char?.setCards ?? []).map(e => e.cardId);
}

// setCardsDetailed: {cardId, faceUp}[] を返す (rules: 16-card-set.md 裏向き情報付き)
function setCardsDetailed(s: GameState, uid: string): SetCardEntry[] {
  const char = scene.byUid(s, uid);
  return char?.setCards ?? [];
}

function stackedCount(s: GameState, uid: string): number {
  const char = scene.byUid(s, uid);
  return char?.stackedCards ?? 0;
}

// turnEffect: SceneCharacter.turnEffects から任意のキーを取得
function turnEffect(s: GameState, uid: string, key: string): unknown {
  const char = scene.byUid(s, uid);
  if (!char) return undefined;
  return char.turnEffects[key];
}

// 宣言能力の使用回数 (rules: 15-abilities-effects.md 【ターン①】)
function declaredUseCount(s: GameState, uid: string, abilityId: string): number {
  const char = scene.byUid(s, uid);
  return char?.declaredUseCount[abilityId] ?? 0;
}

export const char = {
  ap,
  lp,
  level,
  colors,
  names,
  traits,
  keywords,
  hasKeyword,
  state,
  isNamed,
  setCards,
  setCardsDetailed,
  stackedCount,
  turnEffect,
  declaredUseCount,
};
