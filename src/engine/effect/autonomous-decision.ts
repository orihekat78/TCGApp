export type RpsHand = 'rock' | 'paper' | 'scissors';

const RPS_HANDS: readonly RpsHand[] = ['rock', 'paper', 'scissors'];

/** Pick either non-tie hand with equal probability. */
export function chooseAutonomousRpsHand(
  aiHand: RpsHand,
  random: () => number = Math.random,
): RpsHand {
  const choices = RPS_HANDS.filter(hand => hand !== aiHand);
  return choices[random() < 0.5 ? 0 : 1]!;
}

/** Match the resolver fallback: choose the last eligible opaque occurrence. */
export function chooseAutonomousSetCardInstance(
  entries: ReadonlyArray<{ instanceId: string }>,
): string | null {
  return entries.at(-1)?.instanceId ?? null;
}

/** Match the resolver fallback: replace the first eligible scene character. */
export function chooseAutonomousReplacementTarget(
  candidates: ReadonlyArray<{ uid: string }>,
): string | null {
  return candidates[0]?.uid ?? null;
}

export function autonomousDeckReorder(cardIds: readonly string[]): string[] {
  return [...cardIds];
}

export function autonomousDeckPlacement(cardIds: readonly string[]): {
  top: string[];
  bottom: string[];
} {
  return { top: [...cardIds], bottom: [] };
}
