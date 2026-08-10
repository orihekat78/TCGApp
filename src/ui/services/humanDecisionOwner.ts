type Player = 'self' | 'opp';

/**
 * UI decision ownership must follow the active human session, not the board
 * coordinate named `self`. Standalone component fixtures historically omit
 * the global and therefore retain the regular-player `self` fallback.
 */
export function getHumanDecisionSide(spectatorMode: boolean): Player | null {
  if (spectatorMode) return null;
  const root = globalThis as { __humanPlayerSide?: Player | null };
  if (!Object.prototype.hasOwnProperty.call(root, '__humanPlayerSide')) return 'self';
  return root.__humanPlayerSide ?? null;
}

export function isHumanDecisionOwner(player: Player, spectatorMode: boolean): boolean {
  return getHumanDecisionSide(spectatorMode) === player;
}
