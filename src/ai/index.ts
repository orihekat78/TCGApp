// ai namespace barrel — Phase 6 Group A
// spec: .claude/research/plans/2026-05-11-mvp-implementation/phase-6-ai.md

export { enumerateMoves, canAssist, canSolveCase } from './move-enumerator.js';
export type { Move } from './move-enumerator.js';
export { applyMove, playTurn } from './policy.js';
export type { AIPolicy, PlayTurnResult } from './policy.js';
export { RandomPolicy } from './policies/index.js';
export type { RandomPolicyOptions } from './policies/index.js';
