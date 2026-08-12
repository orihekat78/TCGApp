import { useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import { dispatchEngineAction } from '@/ui/hooks/useEngineDispatch';
import { useMatchModalLayer } from '@/ui/hooks/useMatchModalLayer';
import { getRegisteredHumanDecisionSide } from '@/ui/services/humanDecisionOwner';
import { currentMatchSessionToken } from '@/ui/services/matchSession';
import type { MatchSessionToken } from '@/ui/services/matchSessionId';
import { useGameStateStore } from '@/ui/state/store';

export function MatchMenu({ replayActive }: { replayActive: boolean }): JSX.Element | null {
  const gameState = useGameStateStore((state) => state.gameState);
  const spectatorMode = useGameStateStore((state) => state.spectatorMode);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState(false);
  const tokenRef = useRef<MatchSessionToken | null>(null);
  const submittingRef = useRef(false);
  const succeededRef = useRef(false);
  const dialogRef = useMatchModalLayer({
    active: open,
    initialFocusSelector: confirming
      ? '[data-testid="match-menu-confirm-cancel"]'
      : '[data-testid="match-menu-close"]',
    onEscape: () => closeMenu(),
    shouldRestoreFocus: () => !succeededRef.current,
  });

  const eligible = gameState !== null
    && gameState.gameResult === undefined
    && currentMatchSessionToken() !== null
    && getRegisteredHumanDecisionSide(spectatorMode) === 'self'
    && !replayActive;

  function closeMenu(): void {
    if (submittingRef.current) return;
    setOpen(false);
    setConfirming(false);
    setFailure(false);
    tokenRef.current = null;
  }

  function openMenu(): void {
    const token = currentMatchSessionToken();
    if (!eligible || token === null) return;
    tokenRef.current = token;
    submittingRef.current = false;
    succeededRef.current = false;
    setFailure(false);
    setConfirming(false);
    setOpen(true);
  }

  function surrender(): void {
    const sessionToken = tokenRef.current;
    if (submittingRef.current || sessionToken === null) return;
    submittingRef.current = true;
    const result = dispatchEngineAction({ type: 'concede', player: 'self', sessionToken });
    if (!result.ok) {
      submittingRef.current = false;
      setFailure(true);
      return;
    }
    succeededRef.current = true;
    setOpen(false);
  }

  if (!eligible) return null;

  const dialog = open ? (
    <div
      ref={dialogRef}
      className="match-menu-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="match-menu-title"
      data-match-menu-dialog="true"
      data-testid="match-menu-dialog"
      tabIndex={-1}
    >
      <section className="match-menu-panel">
        <h2 id="match-menu-title">{confirming ? '投了しますか？' : '対戦メニュー'}</h2>
        {confirming ? (
          <>
            <p>この対戦を終了し、相手の勝利として結果を記録します。</p>
            {failure && <p className="match-menu-alert" role="alert">投了できませんでした。対戦状態を確認してください。</p>}
            <div className="match-menu-actions">
              <button type="button" data-testid="match-menu-confirm-cancel" onClick={() => { setConfirming(false); setFailure(false); }}>
                戻る
              </button>
              <button type="button" className="match-menu-danger" data-testid="match-menu-confirm-submit" onClick={surrender}>
                投了する
              </button>
            </div>
          </>
        ) : (
          <div className="match-menu-actions match-menu-actions--stacked">
            <button type="button" className="match-menu-danger" data-testid="match-menu-surrender" onClick={() => setConfirming(true)}>
              投了する
            </button>
            <button type="button" data-testid="match-menu-close" onClick={closeMenu}>閉じる</button>
          </div>
        )}
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        className="match-menu-trigger"
        data-match-menu-trigger="true"
        data-testid="match-menu-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={openMenu}
      >
        メニュー
      </button>
      {dialog && typeof document !== 'undefined' ? createPortal(dialog, document.body) : dialog}
    </>
  );
}
