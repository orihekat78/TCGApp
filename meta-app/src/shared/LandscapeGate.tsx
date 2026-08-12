import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useLandscapeExperience,
  type LandscapeStatus,
} from '../hooks/useLandscapeExperience';

interface LandscapeGateProps {
  children: ReactNode;
}

const LandscapeGateStatusContext = createContext<LandscapeStatus>('landscape');

/** Returns the route-level orientation gate status for body-portaled UI. */
export function useLandscapeGateStatus(): LandscapeStatus {
  return useContext(LandscapeGateStatusContext);
}

export function LandscapeGate({ children }: LandscapeGateProps) {
  const { status, requestLandscape, requestResult } = useLandscapeExperience();
  const [hasMountedInLandscape, setHasMountedInLandscape] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const actionRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const wasBlockedRef = useRef(true);
  const isBlocked = status !== 'landscape';
  const shouldRenderContent = hasMountedInLandscape || status === 'landscape';

  useEffect(() => {
    if (status === 'landscape') setHasMountedInLandscape(true);
  }, [status]);

  useLayoutEffect(() => {
    if (isBlocked) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && contentRef.current?.contains(active)) {
        previousFocusRef.current = active;
      }
      actionRef.current?.focus();
    } else if (wasBlockedRef.current) {
      const priorFocus = previousFocusRef.current;
      if (priorFocus?.isConnected) {
        priorFocus.focus({ preventScroll: true });
        if (document.activeElement !== priorFocus) {
          contentRef.current?.focus({ preventScroll: true });
        }
      } else {
        contentRef.current?.focus({ preventScroll: true });
      }
    }
    wasBlockedRef.current = isBlocked;
  }, [hasMountedInLandscape, isBlocked]);

  useLayoutEffect(() => {
    if (!isBlocked) return undefined;
    const content = contentRef.current;
    if (!content) return undefined;
    const suspended = new Map<HTMLElement, {
      ariaHidden: string | null;
      ariaModal: string | null;
      inert: boolean;
    }>();
    const suspendModalRoots = (): void => {
      for (const dialog of content.querySelectorAll<HTMLElement>(
        '[data-match-modal-registered="true"][role="dialog"][aria-modal]',
      )) {
        if (!suspended.has(dialog)) {
          suspended.set(dialog, {
            ariaHidden: dialog.getAttribute('aria-hidden'),
            ariaModal: dialog.getAttribute('aria-modal'),
            inert: dialog.hasAttribute('inert'),
          });
        }
        if (dialog.getAttribute('aria-modal') !== 'false') dialog.setAttribute('aria-modal', 'false');
        if (dialog.getAttribute('aria-hidden') !== 'true') dialog.setAttribute('aria-hidden', 'true');
        if (!dialog.hasAttribute('inert')) dialog.setAttribute('inert', '');
      }
    };
    suspendModalRoots();
    const observer = new MutationObserver(suspendModalRoots);
    observer.observe(content, {
      attributes: true,
      attributeFilter: ['data-match-modal-registered', 'aria-modal'],
      childList: true,
      subtree: true,
    });
    return () => {
      observer.disconnect();
      for (const [dialog, saved] of suspended) {
        if (!dialog.isConnected) continue;
        if (saved.ariaHidden === null) dialog.removeAttribute('aria-hidden');
        else dialog.setAttribute('aria-hidden', saved.ariaHidden);
        if (saved.ariaModal === null) dialog.removeAttribute('aria-modal');
        else dialog.setAttribute('aria-modal', saved.ariaModal);
        if (!saved.inert) dialog.removeAttribute('inert');
      }
    };
  }, [isBlocked, shouldRenderContent]);

  const recoveryCopy = requestResult === 'denied'
    ? '全画面表示を開始できませんでした。自動回転を有効にして、端末を横向きにしてください。'
    : requestResult === 'rotate'
      ? 'このブラウザでは横画面への切り替えを完了できませんでした。自動回転を有効にして、端末を横向きにしてください。'
      : 'このアプリは横画面で利用できます。端末を横向きにしてください。';

  return (
    <LandscapeGateStatusContext.Provider value={status}>
      {shouldRenderContent ? (
        <div
          ref={contentRef}
          data-testid="landscape-gate-content"
          data-modal-portal-host="true"
          aria-hidden={isBlocked || undefined}
          hidden={isBlocked}
          inert={isBlocked}
          tabIndex={-1}
        >
          {children}
        </div>
      ) : null}
      {isBlocked ? (
        <section
          className="landscape-gate"
          role="dialog"
          aria-modal="true"
          aria-labelledby="landscape-gate-title"
          onKeyDown={(event) => {
            if (event.key !== 'Tab') return;
            event.preventDefault();
            actionRef.current?.focus();
          }}
        >
          <div className="landscape-gate__panel">
            <p className="landscape-gate__eyebrow">DETECTIVE CONAN TCG</p>
            <h1 id="landscape-gate-title">横画面でゲームを開始</h1>
            <p className="landscape-gate__copy" role="status">{recoveryCopy}</p>
            <button
              ref={actionRef}
              className="landscape-gate__cta"
              data-testid="landscape-gate-cta"
              type="button"
              onClick={() => { void requestLandscape(); }}
            >
              横画面で開始
            </button>
          </div>
        </section>
      ) : null}
    </LandscapeGateStatusContext.Provider>
  );
}
