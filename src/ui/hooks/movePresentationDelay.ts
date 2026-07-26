import type { Move } from '@/ai/move-enumerator.js';

const IMPORTANT_MOVES: ReadonlySet<Move['kind']> = new Set([
  'handUseCard',
  'handUseCardSwitch',
  'declaredAbility',
  'partnerAbility',
  'actionAgainstChar',
  'actionAgainstCase',
  'assist',
  'solveCase',
]);

/** 直前の手を見せる時間。routine 手と0ms yield、重要手だけ設定値。 */
export function movePresentationDelay(
  previousMove: Move['kind'] | null,
  configuredMs: number,
): number {
  if (previousMove === null || !IMPORTANT_MOVES.has(previousMove)) return 0;
  return Math.max(0, configuredMs);
}

