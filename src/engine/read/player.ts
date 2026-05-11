// engine.read.player — プレイヤー情報セレクタ (純粋関数)
// rules: 03-field-areas.md, 12-next-hint.md, 13-keywords.md, 17-icons.md FILE(X)

import type {
  GameState,
  PartnerOnBoard,
  CaseInfo,
  CardId,
  EvidenceCard,
  FileCard,
} from '@/engine/types';

function partner(s: GameState, p: 'self' | 'opp'): PartnerOnBoard {
  return s.players[p].partner;
}

function caseInfo(s: GameState, p: 'self' | 'opp'): CaseInfo {
  return s.players[p].case;
}

function requiredEvidence(s: GameState, p: 'self' | 'opp'): number {
  return s.players[p].case.requiredEvidence;
}

function hand(s: GameState, p: 'self' | 'opp'): CardId[] {
  return s.players[p].hand;
}

function handCount(s: GameState, p: 'self' | 'opp'): number {
  return s.players[p].hand.length;
}

function deck(s: GameState, p: 'self' | 'opp'): CardId[] {
  return s.players[p].deck;
}

function deckCount(s: GameState, p: 'self' | 'opp'): number {
  return s.players[p].deck.length;
}

function evidence(s: GameState, p: 'self' | 'opp'): EvidenceCard[] {
  return s.players[p].evidence;
}

function evidenceCount(s: GameState, p: 'self' | 'opp'): number {
  return s.players[p].evidence.length;
}

function remove(s: GameState, p: 'self' | 'opp'): CardId[] {
  return s.players[p].remove;
}

function removeCount(s: GameState, p: 'self' | 'opp'): number {
  return s.players[p].remove.length;
}

function file(s: GameState, p: 'self' | 'opp'): FileCard[] {
  return s.players[p].file;
}

// FILE枚数: アシスト中のパートナーも含む (rules: 17-icons.md 【FILE(X)】)
function fileCount(s: GameState, p: 'self' | 'opp'): number {
  return s.players[p].file.length;
}

// 痕跡: 相手のリフレッシュ発生状態 (rules: 13-keywords.md, 26-qa-deck-refresh.md)
function scratchTrace(s: GameState, p: 'self' | 'opp'): '未発見' | '発見済' {
  return s.scratchTrace[p];
}

export const player = {
  partner,
  case: caseInfo,
  requiredEvidence,
  hand,
  handCount,
  deck,
  deckCount,
  evidence,
  evidenceCount,
  remove,
  removeCount,
  file,
  fileCount,
  scratchTrace,
};
