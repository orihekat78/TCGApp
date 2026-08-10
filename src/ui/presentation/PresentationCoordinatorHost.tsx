import {
  useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore,
  type CSSProperties, type JSX,
} from 'react';
import type { CausalEventKind, CausalOutcome, PublicCausalRef } from '@/engine/types';
import type { PresentationItem } from './PresentationQueue';
import { getPresentationQueue, skipCommittedPresentationSuffix } from './coordinator';
import { usePresentationStore } from './store';
import { useGameStateStore } from '@/ui/state/store';
import { usePlaymatViewportLayout } from '@/ui/hooks/useStageScale';
import './PresentationCoordinatorHost.css';

export type PresentationSpeed = 'slow' | 'standard' | 'fast';

type Props = {
  speed: PresentationSpeed;
  suppressed?: boolean;
  onTerminalDrained?: () => void;
};

const PHASE_DURATION_MS: Record<PresentationSpeed, readonly [number, number, number, number]> = {
  slow: [174, 261, 522, 232],
  standard: [120, 180, 360, 160],
  fast: [84, 126, 252, 112],
};
const TERMINAL_DRAIN_MS = 3_000;

type PresentationPhase = 'cause' | 'target' | 'result' | 'settle';

type AnchorBox = {
  kind: 'source' | 'target';
  left: number;
  top: number;
  width: number;
  height: number;
};

const KIND_LABEL: Record<CausalEventKind, string> = {
  'case-status-change': '事件カードが解決編へ移行',
  use: 'カードを使用',
  declare: '能力を宣言',
  select: '対象を選択',
  draw: 'カードを引く',
  discard: 'カードを捨てる',
  'zone-move': 'カードを移動',
  enter: 'カードが登場',
  sleep: 'スリープ',
  stun: 'スタン',
  activate: 'アクティブにする',
  'face-change': 'カードの向きを変更',
  'value-change': '数値が変化',
  evidence: '証拠が変化',
  'case-resolve': '事件を解決',
  negate: '効果を無効化',
  fizzle: '効果が不発',
  cancel: '処理をキャンセル',
  'game-result': '勝敗が確定',
  summary: '処理を要約',
};

export function PresentationCoordinatorHost({
  speed,
  suppressed = false,
  onTerminalDrained,
}: Props): JSX.Element | null {
  const queue = getPresentationQueue();
  const viewportLayout = usePlaymatViewportLayout();
  const queueRevision = useSyncExternalStore(
    (listener) => queue.subscribe(listener),
    () => queue.revision(),
    () => queue.revision(),
  );
  const paused = usePresentationStore((state) => state.presentationPaused);
  const stepToken = usePresentationStore((state) => state.presentationStepToken);
  const skipToken = usePresentationStore((state) => state.presentationSkipToken);
  const setPaused = usePresentationStore((state) => state.setPresentationPaused);
  const setCompletionNotice = usePresentationStore((state) => state.setPresentationCompletionNotice);
  const presentationError = usePresentationStore((state) => state.presentationError);
  const terminalIdentity = useGameStateStore((state) => {
    const gameState = state.gameState;
    const result = gameState?.gameResult;
    if (!gameState || !result) return null;
    return `${gameState.causalLog?.sessionId ?? 'legacy'}:${result.winner}:${result.reason}`;
  });
  const pendingDeckRevealActive = useGameStateStore((state) => state.pendingDeckReveal !== null);
  const pendingPresentationHandRevealActive = useGameStateStore((state) => (
    state.pendingPublicHandReveal?.lifetime === 'presentation'
  ));
  const ownedTerminalIdentity = suppressed ? null : terminalIdentity;
  const [skipFeedback, setSkipFeedback] = useState<string | null>(null);
  const [phase, setPhase] = useState<PresentationPhase>('cause');
  const [anchorBoxes, setAnchorBoxes] = useState<AnchorBox[]>([]);
  const stepRef = useRef(stepToken);
  const skipRef = useRef(skipToken);
  const skipFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const runningIdentityRef = useRef<string | null>(null);
  const armedTerminalIdentityRef = useRef<string | null>(null);
  const drainedTerminalIdentityRef = useRef<string | null>(null);
  const onTerminalDrainedRef = useRef(onTerminalDrained);
  onTerminalDrainedRef.current = onTerminalDrained;
  const item = suppressed ? null : queue.current();
  const identity = itemIdentity(item);
  const reducedMotion = useMemo(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  ), []);
  const placement = 'playmat-strip';
  const stripWidth = Math.max(0, Math.min(720, viewportLayout.renderedWidth - 16));
  const stripStyle: CSSProperties = {
    left: viewportLayout.left + ((viewportLayout.renderedWidth - stripWidth) / 2),
    top: viewportLayout.top + 8,
    width: stripWidth,
    pointerEvents: 'none',
  };
  const order = sequenceView(item, queue.items());

  const clearSequenceTimers = useCallback((): void => {
    for (const timer of sequenceTimersRef.current) clearTimeout(timer);
    sequenceTimersRef.current = [];
  }, []);

  const clearTerminalPresentationSurfaces = useCallback((): void => {
    const gameStore = useGameStateStore.getState();
    gameStore.setPendingDeckReveal(null);
    if (gameStore.pendingPublicHandReveal?.lifetime === 'presentation') {
      gameStore.setPendingPublicHandReveal(null);
    }
  }, []);

  const signalTerminalDrained = useCallback((identityToSignal: string): void => {
    const gameStore = useGameStateStore.getState();
    const presentationSurfaceActive = gameStore.pendingDeckReveal !== null
      || gameStore.pendingPublicHandReveal?.lifetime === 'presentation';
    if (queue.outstandingCount() !== 0 || presentationSurfaceActive) return;
    if (drainedTerminalIdentityRef.current === identityToSignal) return;
    drainedTerminalIdentityRef.current = identityToSignal;
    onTerminalDrainedRef.current?.();
  }, [queue]);

  const startSequence = useCallback((runIdentity: string, epoch: number): void => {
    if (runningIdentityRef.current === runIdentity) return;
    clearSequenceTimers();
    runningIdentityRef.current = runIdentity;
    setPhase('cause');
    const [causeMs, targetMs, resultMs, settleMs] = PHASE_DURATION_MS[speed];
    sequenceTimersRef.current.push(
      setTimeout(() => setPhase('target'), causeMs),
      setTimeout(() => setPhase('result'), causeMs + targetMs),
      setTimeout(() => setPhase('settle'), causeMs + targetMs + resultMs),
      setTimeout(() => {
        runningIdentityRef.current = null;
        sequenceTimersRef.current = [];
        queue.completeCurrent(epoch);
      }, causeMs + targetMs + resultMs + settleMs),
    );
  }, [clearSequenceTimers, queue, speed]);

  useEffect(() => {
    const syncVisibility = () => queue.setHidden(document.visibilityState === 'hidden');
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, [queue]);

  useEffect(() => {
    if (ownedTerminalIdentity === null) {
      armedTerminalIdentityRef.current = null;
      drainedTerminalIdentityRef.current = null;
      return undefined;
    }
    const startedAt = Date.now();
    if (armedTerminalIdentityRef.current !== ownedTerminalIdentity) {
      armedTerminalIdentityRef.current = ownedTerminalIdentity;
      drainedTerminalIdentityRef.current = null;
      queue.beginTerminal(startedAt);
    }
    const timer = setTimeout(() => {
      const summary = queue.advanceTerminal(startedAt + TERMINAL_DRAIN_MS);
      if (summary) {
        setCompletionNotice({ kind: 'terminal', count: summary.count });
        queue.completeCurrent(queue.currentEpoch());
      }
      clearTerminalPresentationSurfaces();
      signalTerminalDrained(ownedTerminalIdentity);
    }, TERMINAL_DRAIN_MS);
    return () => clearTimeout(timer);
  }, [
    clearTerminalPresentationSurfaces,
    ownedTerminalIdentity,
    queue,
    setCompletionNotice,
    signalTerminalDrained,
  ]);

  useEffect(() => {
    if (stepRef.current === stepToken) return;
    stepRef.current = stepToken;
    const current = queue.current();
    const currentIdentity = itemIdentity(current);
    if (paused && current && currentIdentity) {
      startSequence(currentIdentity, queue.currentEpoch());
    }
  }, [paused, queue, startSequence, stepToken]);

  useEffect(() => {
    if (skipRef.current === skipToken) return;
    skipRef.current = skipToken;
    clearSequenceTimers();
    runningIdentityRef.current = null;
    const deferredCount = skipCommittedPresentationSuffix();
    const summary = queue.skip();
    const skippedCount = (summary?.count ?? 0) + deferredCount;
    if (skippedCount > 0) setCompletionNotice({ kind: 'skip', count: skippedCount });
    queue.completeCurrent(queue.currentEpoch());
    if (ownedTerminalIdentity !== null) clearTerminalPresentationSurfaces();
    if (ownedTerminalIdentity !== null) signalTerminalDrained(ownedTerminalIdentity);
    if (skippedCount === 0) return;
    if (skipFeedbackTimerRef.current !== null) clearTimeout(skipFeedbackTimerRef.current);
    setSkipFeedback(`${skippedCount}件の処理をスキップ`);
    skipFeedbackTimerRef.current = setTimeout(() => {
      skipFeedbackTimerRef.current = null;
      setSkipFeedback(null);
      const notice = usePresentationStore.getState().presentationCompletionNotice;
      if (notice?.kind === 'skip' && notice.count === skippedCount) {
        setCompletionNotice(null);
      }
    }, 1_200);
  }, [
    clearSequenceTimers,
    clearTerminalPresentationSurfaces,
    ownedTerminalIdentity,
    queue,
    setCompletionNotice,
    signalTerminalDrained,
    skipToken,
  ]);

  useEffect(() => {
    if (ownedTerminalIdentity === null) return;
    signalTerminalDrained(ownedTerminalIdentity);
  }, [
    ownedTerminalIdentity,
    pendingDeckRevealActive,
    pendingPresentationHandRevealActive,
    queueRevision,
    signalTerminalDrained,
  ]);

  useEffect(() => () => {
    clearSequenceTimers();
    runningIdentityRef.current = null;
    if (skipFeedbackTimerRef.current !== null) clearTimeout(skipFeedbackTimerRef.current);
  }, [clearSequenceTimers]);

  useEffect(() => {
    if (!identity || suppressed) {
      clearSequenceTimers();
      runningIdentityRef.current = null;
      return;
    }
    if (!paused) startSequence(identity, queue.currentEpoch());
  }, [clearSequenceTimers, identity, paused, queue, startSequence, suppressed]);

  useEffect(() => {
    if (!identity || suppressed) {
      setAnchorBoxes([]);
      return undefined;
    }
    const update = (): void => {
      const current = queue.current();
      setAnchorBoxes(current ? resolveAnchorBoxes(current) : []);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [identity, phase, queue, suppressed]);

  if (presentationError) {
    return (
      <div
        className="presentation-error"
        data-testid="presentation-error"
        data-presentation-placement={placement}
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        style={stripStyle}
      >
        処理表示を更新できませんでした。対戦状態は直前のままです。
      </div>
    );
  }

  if (!item) {
    return skipFeedback ? (
      <div
        className="presentation-skip-feedback"
        data-testid="presentation-skip-feedback"
        data-presentation-placement={placement}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={stripStyle}
      >
        {skipFeedback}
      </div>
    ) : null;
  }
  const view = itemView(item);
  return (
    <div
      className={`presentation-causal-host is-${view.variant}${reducedMotion ? ' is-reduced-motion' : ''}`}
      data-testid="presentation-causal-host"
      data-event-id={identity}
      data-variant={view.variant}
      data-phase={phase}
      data-presentation-placement={placement}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      style={stripStyle}
    >
      <PresentationAnchorLayer
        boxes={anchorBoxes}
        phase={phase}
        reducedMotion={reducedMotion}
        orderLabel={order.current}
      />
      <div className="presentation-causal-card">
        <div className="presentation-causal-copy">
          <div className="presentation-causal-heading">
            <span className="presentation-causal-order">[{order.current}/{order.total}]</span>
            <span className="presentation-causal-kicker">{view.kicker}</span>
            <span className="presentation-causal-title">{view.title}</span>
          </div>
          {(view.source || view.target || view.result) && (
            <div className="presentation-causal-chain">
              {view.source && <span className="presentation-causal-node">{view.source}</span>}
              {view.source && view.target && <span className="presentation-causal-arrow" aria-hidden="true">→</span>}
              {view.target && <span className="presentation-causal-node">{view.target}</span>}
              {(view.source || view.target) && view.result && (
                <span className="presentation-causal-arrow" aria-hidden="true">→</span>
              )}
              {view.result && <span className="presentation-causal-result">{view.result}</span>}
            </div>
          )}
        </div>
        <div className="presentation-causal-controls" style={{ pointerEvents: 'auto' }}>
          <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused}>
            {paused ? '再開' : '一時停止'}
          </button>
          <button type="button" onClick={() => usePresentationStore.getState().stepPresentation()} disabled={!paused}>
            1件送り
          </button>
          <button
            type="button"
            data-testid="presentation-skip"
            onClick={() => usePresentationStore.getState().skipPresentation()}
          >
            スキップ
          </button>
        </div>
      </div>
    </div>
  );
}

function itemIdentity(item: PresentationItem | null): string | null {
  if (!item) return null;
  if (item.type === 'event') return item.event.eventId;
  return `${item.type}:${item.sessionId}:${item.eventIds.join(',')}:${item.count}`;
}

function sequenceView(item: PresentationItem | null, queued: readonly PresentationItem[]): {
  current: string;
  total: string;
} {
  if (!item) return { current: '—', total: '—' };
  const [first, last] = itemSequenceRange(item);
  const total = queued.reduce((max, queuedItem) => Math.max(max, itemSequenceRange(queuedItem)[1]), last);
  return {
    current: first === last ? String(first) : `${first}–${last}`,
    total: String(total),
  };
}

function itemSequenceRange(item: PresentationItem): readonly [number, number] {
  if (item.type === 'event') return [item.event.sequence, item.event.sequence];
  return [item.firstSequence, item.lastSequence];
}

function itemRefs(item: PresentationItem): { source?: PublicCausalRef; targets: PublicCausalRef[] } {
  if (item.type === 'event') return { source: item.event.source, targets: item.event.targets };
  if (item.type === 'aggregate') return { source: item.source, targets: item.targets };
  return { targets: [] };
}

function resolveAnchorBoxes(item: PresentationItem): AnchorBox[] {
  if (typeof document === 'undefined') return [];
  const refs = itemRefs(item);
  const boxes: AnchorBox[] = [];
  const source = refs.source ? resolveAnchorRect(refs.source) : null;
  if (source) boxes.push(rectToAnchorBox(source, 'source'));
  for (const target of refs.targets) {
    const rect = resolveAnchorRect(target);
    if (rect) boxes.push(rectToAnchorBox(rect, 'target'));
  }
  return boxes;
}

function resolveAnchorRect(ref: PublicCausalRef): DOMRect | null {
  const root = document.querySelector<HTMLElement>('#scaler') ?? document.body;
  if (ref.cardNumber) {
    const card = Array.from(root.querySelectorAll<HTMLElement>('[data-card-id]')).find((candidate) => (
      candidate.dataset.cardId === ref.cardNumber
      && (!ref.side || candidate.closest(`.side-${ref.side}`) !== null)
    ));
    const cardRect = visibleRect(card);
    if (cardRect) return cardRect;
  }

  const side = ref.side ?? 'self';
  const zoneSelector = ref.zone ? zoneAnchorSelector(ref.zone, side) : null;
  const zoneRect = zoneSelector ? visibleRect(root.querySelector<HTMLElement>(zoneSelector)) : null;
  if (zoneRect) return zoneRect;
  if (ref.kind === 'player') return visibleRect(root.querySelector<HTMLElement>(`.mat.${side}`));
  return null;
}

function zoneAnchorSelector(zone: NonNullable<PublicCausalRef['zone']>, side: 'self' | 'opp'): string {
  const selectors: Record<NonNullable<PublicCausalRef['zone']>, string> = {
    deck: `.deck-area.side-${side}`,
    hand: side === 'self' ? '.hand-zone' : '.opp-hand-strip',
    scene: `.scene-area.side-${side}`,
    partner: `.partner-area.side-${side}`,
    case: `.case-area.side-${side}`,
    file: `.file-area.side-${side}`,
    evidence: `.evidence-area.side-${side}`,
    remove: `.remove-area.side-${side}`,
    'set-card': `.scene-area.side-${side}`,
  };
  return selectors[zone];
}

function visibleRect(element: HTMLElement | null | undefined): DOMRect | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function rectToAnchorBox(rect: DOMRect, kind: AnchorBox['kind']): AnchorBox {
  return {
    kind,
    left: Math.max(0, rect.left - 3),
    top: Math.max(0, rect.top - 3),
    width: rect.width + 6,
    height: rect.height + 6,
  };
}

function PresentationAnchorLayer({
  boxes,
  phase,
  reducedMotion,
  orderLabel,
}: {
  boxes: readonly AnchorBox[];
  phase: PresentationPhase;
  reducedMotion: boolean;
  orderLabel: string;
}): JSX.Element | null {
  if (boxes.length === 0) return null;
  const source = boxes.find((box) => box.kind === 'source');
  const targets = boxes.filter((box) => box.kind === 'target');
  const revealTargets = reducedMotion || phase !== 'cause';
  const revealConnector = !reducedMotion && phase !== 'cause' && source !== undefined && targets.length > 0;
  return (
    <div className="presentation-anchor-layer" aria-hidden="true">
      {revealConnector && (
        <svg className="presentation-anchor-connectors">
          {targets.map((target, index) => (
            <line
              key={`${target.left}:${target.top}:${index}`}
              x1={source.left + (source.width / 2)}
              y1={source.top + (source.height / 2)}
              x2={target.left + (target.width / 2)}
              y2={target.top + (target.height / 2)}
            />
          ))}
        </svg>
      )}
      {boxes.map((box, index) => {
        if (box.kind === 'target' && !revealTargets) return null;
        return (
          <div
            key={`${box.kind}:${box.left}:${box.top}:${index}`}
            className={`presentation-anchor-box is-${box.kind}${phase === 'result' || phase === 'settle' ? ' is-result' : ''}`}
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          >
            {box.kind === 'target' ? <span>{orderLabel}</span> : null}
          </div>
        );
      })}
    </div>
  );
}

function itemView(item: PresentationItem): {
  variant: 'standard' | 'contact' | 'refresh' | 'summary';
  kicker: string;
  title: string;
  source: string;
  target: string;
  result: string;
} {
  if (item.type === 'summary') {
    return {
      variant: 'summary',
      kicker: item.reason === 'hidden' ? '非表示中の処理' : '処理を要約',
      title: `${item.count}件の処理が完了`,
      source: '', target: '', result: '',
    };
  }
  if (item.type === 'aggregate') {
    return {
      variant: 'summary',
      kicker: '連続処理',
      title: KIND_LABEL[item.kind],
      source: item.source?.label ?? '',
      target: item.targets.map((target) => target.label).join('・'),
      result: `${item.count}件 · ${formatOutcome(item.outcome)}`,
    };
  }
  const event = item.event;
  const contact = event.tags?.includes('contact') === true;
  const refresh = event.tags?.includes('refresh') === true;
  return {
    variant: contact ? 'contact' : refresh ? 'refresh' : 'standard',
    kicker: event.actor === 'opp' ? 'CPUの処理' : 'プレイヤーの処理',
    title: contact
      ? event.outcome.type === 'state' && event.outcome.state === 'success' ? 'コンタクト成功' : 'コンタクト不成立'
      : refresh ? 'デッキをリフレッシュ' : KIND_LABEL[event.kind],
    source: event.source?.label ?? '',
    target: event.targets.map((target) => target.label).join('・'),
    result: formatOutcome(event.outcome),
  };
}

function formatOutcome(outcome: CausalOutcome): string {
  switch (outcome.type) {
    case 'case-status': return '事件編から解決編へ';
    case 'face-change': return `${outcome.count}枚を${outcome.to === 'face-up' ? '表向き' : '裏向き'}に変更`;
    case 'none': return '';
    case 'count': return `${outcome.amount}${unitLabel(outcome.unit)}`;
    case 'move': return `${outcome.from}から${outcome.to}へ${outcome.count}枚`;
    case 'state': return stateLabel(outcome.state);
    case 'summary': return `${outcome.count}件完了`;
  }
}

function unitLabel(unit: 'card' | 'evidence' | 'lp' | 'ap' | 'level'): string {
  if (unit === 'card') return '枚';
  if (unit === 'evidence') return '件';
  return unit.toUpperCase();
}

function stateLabel(state: 'success' | 'failed' | 'cancelled' | 'negated' | 'fizzled' | 'sleep' | 'stun' | 'active'): string {
  return ({
    success: '成功', failed: '失敗', cancelled: 'キャンセル', negated: '無効',
    fizzled: '不発', sleep: 'スリープ', stun: 'スタン', active: 'アクティブ',
  } as const)[state];
}
