import { useLayoutEffect, useRef, type RefObject } from 'react';
import {
  canRestoreModalFocus,
  isTopmostMatchModalRoot,
  registerMatchModalRoot,
  withMatchMenuTrigger,
} from '@/ui/hooks/useMatchModalLayer';

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
  initialFocusSelector,
  fallbackFocusSelector,
  onEscape,
}: {
  active: boolean;
  initialFocusSelector?: string;
  fallbackFocusSelector?: string;
  onEscape?: () => void;
}): RefObject<HTMLDivElement | null> {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  onEscapeRef.current = onEscape;

  useLayoutEffect(() => {
    if (!active) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    registerMatchModalRoot(dialog);
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusable = (): HTMLElement[] => {
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      return withMatchMenuTrigger(dialog, controls);
    };
    const initialFocus = initialFocusSelector
      ? dialog.querySelector<HTMLElement>(initialFocusSelector)
      : null;
    (initialFocus ?? focusable()[0] ?? dialog).focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (!isTopmostMatchModalRoot(dialog)) return;
      // A nested modal (for example card detail) owns an already-handled key.
      if (event.defaultPrevented) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
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
      event.preventDefault();
      event.stopImmediatePropagation();
      const nextIndex = event.shiftKey
        ? (activeIndex <= 0 ? controls.length - 1 : activeIndex - 1)
        : (activeIndex === -1 || activeIndex === controls.length - 1 ? 0 : activeIndex + 1);
      controls[nextIndex]?.focus();
    };

    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown, { capture: true });
      const returnFocus = returnFocusRef.current;
      returnFocusRef.current = null;
      if (canRestoreModalFocus(returnFocus)) {
        returnFocus.focus();
        return;
      }
      const fallbackFocus = fallbackFocusSelector
        ? document.querySelector<HTMLElement>(fallbackFocusSelector)
        : null;
      if (fallbackFocus?.isConnected
        && !fallbackFocus.matches('[hidden], [inert], [aria-hidden="true"]')
        && fallbackFocus.closest('[hidden], [inert], [aria-hidden="true"]') === null) {
        fallbackFocus.focus();
      }
    };
  }, [active, fallbackFocusSelector, initialFocusSelector]);

  return dialogRef;
}
