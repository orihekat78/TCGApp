let terminalInteractionGate = false;
let interactionEpoch = 0;

export function blockTerminalInteractions(): void {
  terminalInteractionGate = true;
  interactionEpoch += 1;
}

export function reopenMatchInteractions(): void {
  terminalInteractionGate = false;
  interactionEpoch += 1;
}

export function areTerminalInteractionsBlocked(): boolean {
  return terminalInteractionGate;
}

/** Capture before awaiting a live prompt; old continuations cannot cross reset. */
export function currentInteractionEpoch(): number {
  return interactionEpoch;
}

export function isCurrentLiveInteraction(epoch: number): boolean {
  return !terminalInteractionGate && interactionEpoch === epoch;
}
