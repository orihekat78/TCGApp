// engine.read.scene — 現場セレクタ (純粋関数)
// rules: 03-field-areas.md, 13-keywords.md (名乗り状態)

import type { GameState, SceneCharacter } from '@/engine/types';

function all(s: GameState, p: 'self' | 'opp'): SceneCharacter[] {
  return s.players[p].scene;
}

function count(s: GameState, p: 'self' | 'opp'): number {
  return s.players[p].scene.length;
}

function byUid(s: GameState, uid: string): SceneCharacter | null {
  for (const side of ['self', 'opp'] as const) {
    const found = s.players[side].scene.find(c => c.uid === uid);
    if (found) return found;
  }
  return null;
}

function byCardId(s: GameState, p: 'self' | 'opp', cardId: string): SceneCharacter[] {
  return s.players[p].scene.filter(c => c.cardId === cardId);
}

function activeOnes(s: GameState, p: 'self' | 'opp'): SceneCharacter[] {
  return s.players[p].scene.filter(c => c.state === 'active');
}

// スリープまたはスタン状態 (アクション対象候補 rules: 07-action-flow.md)
function sleepOrStun(s: GameState, p: 'self' | 'opp'): SceneCharacter[] {
  return s.players[p].scene.filter(c => c.state === 'sleep' || c.state === 'stun');
}

// 名乗り状態のキャラ (rules: 03-field-areas.md, 13-keywords.md)
function named(s: GameState, p: 'self' | 'opp'): SceneCharacter[] {
  return s.players[p].scene.filter(c => c.isNamed);
}

// 非名乗り状態のキャラ
function nonNamed(s: GameState, p: 'self' | 'opp'): SceneCharacter[] {
  return s.players[p].scene.filter(c => !c.isNamed);
}

// enterOrder を返す (uidが存在しない場合 -1)
function enterOrderOf(s: GameState, uid: string): number {
  const char = byUid(s, uid);
  return char ? char.enterOrder : -1;
}

export const scene = {
  all,
  count,
  byUid,
  byCardId,
  activeOnes,
  sleepOrStun,
  named,
  nonNamed,
  enterOrderOf,
};
