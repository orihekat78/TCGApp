/**
 * Import-free terminal publication hook. Store commits notify it only after a
 * terminal state is durable; interaction cleanup registers the live handler.
 */
type TerminalPublicationListener = () => void;

let listener: TerminalPublicationListener | null = null;

export function registerTerminalInteractionPublication(next: TerminalPublicationListener): () => void {
  listener = next;
  return () => {
    if (listener === next) listener = null;
  };
}

/** Post-commit only. A cleanup failure must not roll back a terminal commit. */
export function notifyTerminalInteractionPublication(): void {
  try {
    listener?.();
  } catch {
    // Terminal GameState is authoritative even when a UI-only cleanup fails.
  }
}
