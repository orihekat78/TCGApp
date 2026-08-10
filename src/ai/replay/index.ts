// ai.replay — Phase 9-G.1 barrel
// spec: .claude/specs/phase-9-g-replay.md

export {
  recordMatch,
  type ReplayLog,
  type LegacyReplayLog,
  type ReplayLogV1,
  type ReplayLogV2,
  type ReplayMove,
} from './recorder.js';
export { ScriptedPolicy, replayLog } from './player.js';
export {
  captureNondeterminism,
  replayNondeterminism,
  type ReplayNondeterminism,
} from './nondeterminism.js';
export {
  applyReplayPatches,
  assertReplayLogV3,
  buildReplayLogV3,
  canonicalReplayJson,
  replayStateAt,
  replayStates,
  replayStepCount,
  type ReplayFrameV1,
  type ReplayLogV3,
  type ReplayPatchV1,
  type ReplayViewerMode,
} from './state-frame.js';
