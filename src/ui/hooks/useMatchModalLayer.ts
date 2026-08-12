import { useEffect, useRef, type RefObject } from 'react';

export const MATCH_MODAL_REGISTERED_ATTRIBUTE = 'data-match-modal-registered';

const FOCUSABLE_SELECTOR = [
  'button:not(:disabled)',
  '[href]',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

type SavedDialogState = {
  ariaHidden: string | null;
  ariaModal: string | null;
  inert: boolean;
};

function modalRoots(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(
    `[${MATCH_MODAL_REGISTERED_ATTRIBUTE}="true"][role="dialog"][aria-modal]`,
  ));
}

/** Explicitly enrolls one live-MATCH modal root in top-layer arbitration. */
export function registerMatchModalRoot(dialog: HTMLElement): void {
  dialog.setAttribute(MATCH_MODAL_REGISTERED_ATTRIBUTE, 'true');
}

function canRestoreFocus(target: HTMLElement | null): target is HTMLElement {
  if (!target?.isConnected) return false;
  if (target.matches(':disabled, [aria-disabled="true"], [inert]')) return false;
  return target.closest('[inert], [aria-hidden="true"]') === null;
}

/** Adds the persistent MATCH menu trigger to an active dialog's keyboard scope. */
export function withMatchMenuTrigger<T extends HTMLElement>(
  dialog: HTMLElement,
  controls: T[],
): Array<T | HTMLElement> {
  const trigger = document.querySelector<HTMLElement>(
    '[data-match-menu-trigger="true"]:not(:disabled)',
  );
  return trigger && !dialog.contains(trigger) ? [...controls, trigger] : controls;
}

/** Coordinates the MATCH menu above every independently-owned live dialog. */
export function useMatchModalLayer({
  active,
  initialFocusSelector,
  onEscape,
  shouldRestoreFocus = () => true,
}: {
  active: boolean;
  initialFocusSelector?: string;
  onEscape: () => void;
  shouldRestoreFocus?: () => boolean;
}): RefObject<HTMLDivElement | null> {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onEscapeRef = useRef(onEscape);
  const shouldRestoreFocusRef = useRef(shouldRestoreFocus);
  onEscapeRef.current = onEscape;
  shouldRestoreFocusRef.current = shouldRestoreFocus;

  useEffect(() => {
    if (!active) return undefined;
    const menu = dialogRef.current;
    if (!menu) return undefined;
    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const suspended = new Map<HTMLElement, SavedDialogState>();

    const suspendUnderlying = (): void => {
      for (const dialog of modalRoots()) {
        if (dialog === menu || dialog.hasAttribute('data-match-menu-dialog')) continue;
        if (!suspended.has(dialog)) {
          suspended.set(dialog, {
            ariaHidden: dialog.getAttribute('aria-hidden'),
            ariaModal: dialog.getAttribute('aria-modal'),
            inert: dialog.hasAttribute('inert'),
          });
        }
        dialog.setAttribute('aria-modal', 'false');
        dialog.setAttribute('aria-hidden', 'true');
        dialog.setAttribute('inert', '');
      }
    };
    suspendUnderlying();
    const observer = new MutationObserver(suspendUnderlying);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: [MATCH_MODAL_REGISTERED_ATTRIBUTE, 'aria-modal'],
      childList: true,
      subtree: true,
    });

    const focusable = (): HTMLElement[] => Array.from(menu.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    const initial = initialFocusSelector
      ? menu.querySelector<HTMLElement>(initialFocusSelector)
      : null;
    (initial ?? focusable()[0] ?? menu).focus();

    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onEscapeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      if (controls.length === 0) {
        event.preventDefault();
        menu.focus();
        return;
      }
      const activeIndex = controls.indexOf(document.activeElement as HTMLElement);
      if (event.shiftKey && activeIndex <= 0) {
        event.preventDefault();
        controls.at(-1)?.focus();
      } else if (!event.shiftKey && (activeIndex === -1 || activeIndex === controls.length - 1)) {
        event.preventDefault();
        controls[0]?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      for (const [dialog, saved] of suspended) {
        if (!dialog.isConnected) continue;
        if (saved.ariaHidden === null) dialog.removeAttribute('aria-hidden');
        else dialog.setAttribute('aria-hidden', saved.ariaHidden);
        if (saved.ariaModal === null) dialog.removeAttribute('aria-modal');
        else dialog.setAttribute('aria-modal', saved.ariaModal);
        if (!saved.inert) dialog.removeAttribute('inert');
      }
      const returnFocus = returnFocusRef.current;
      returnFocusRef.current = null;
      if (shouldRestoreFocusRef.current() && canRestoreFocus(returnFocus)) returnFocus.focus();
    };
  }, [active, initialFocusSelector]);

  return dialogRef;
}
