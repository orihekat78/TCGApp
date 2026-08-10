import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/** Owns keyboard focus for one mounted modal without interfering with a nested modal. */
export function useModalFocusTrap({
  active,
  onEscape,
}: {
  active: boolean;
  onEscape?: () => void;
}): RefObject<HTMLDivElement | null> {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useEffect(() => {
    if (!active) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusable = (): HTMLElement[] => Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
    );
    (focusable()[0] ?? dialog).focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      // A nested modal (for example card detail) owns an already-handled key.
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onEscapeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      if (controls.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const activeIndex = controls.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey) {
        if (activeIndex <= 0) {
          event.preventDefault();
          controls.at(-1)?.focus();
        }
        return;
      }
      if (activeIndex === -1 || activeIndex === controls.length - 1) {
        event.preventDefault();
        controls[0]?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      const returnFocus = returnFocusRef.current;
      returnFocusRef.current = null;
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, [active]);

  return dialogRef;
}
