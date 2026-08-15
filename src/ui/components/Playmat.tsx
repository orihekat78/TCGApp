// Phase 7 Task 7.3: Playmat レイアウト (1920×1080 / 最低 1280×720)
// rules: 03-field-areas.md (8 エリア構成)
// 視覚: design-mockups/01-board-mockup.html .stage / .play-area / .mat
//
// 構造:
//   .scaler > .stage[1920×1080] > .bg + .topbar + .play-area + .hand-zone + .log-btn
//   .play-area > .opp-hand-strip + .mat.opp + .keep-out + .mat.self
//   .mat > .case-col + .scene-col + .partner-col + .deck-col + .remove-col + .file-row
//
// Phase 7 では SceneArea のみ実体接続。他 zone (Partner/Case/Deck/Remove/File,
// TopBar, HandZone, LogPanel) は Task 7.5-7.13 で実装するため placeholder。
// 操作系 (クリック・DnD) は Phase 8。

import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react';
import type { GameState } from '@/engine/types/game-state.js';
import type { ReplayViewerMode } from '@/ai/replay/state-frame.js';
import { SceneArea, type ResolvedCardMeta } from './SceneArea.js';
import { isSceneDirectPick } from '@/ui/services/scenePick.js';
import { PartnerArea } from './PartnerArea.js';
import { DeckArea } from './DeckArea.js';
import { RemoveArea } from './RemoveArea.js';
import { LogPanel } from './LogPanel.js';
import { CardListModal, type CardListKind } from './CardListModal.js';
import { CardExpandModal } from './CardExpandModal.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { CaseArea, type CaseInfo, type CaseColor } from './CaseArea.js';
import { FileArea } from './FileArea.js';
import { EvidenceArea } from './EvidenceArea.js';
import { HandZone, type HandCardMeta, type HandZoneProps } from './HandZone.js';
import { CardArt } from './CardArt.js';
import { TopBar } from './TopBar.js';
import { EffectStackPanel } from './EffectStackPanel.js';
import { pendingOwnerOrderGroup } from '@/engine/resolve/stack.js';
import { cardIdFromOccurrenceUid, cardOccurrenceUid } from '@/engine/target/card-occurrence.js';
import { ActionsPanel, type ActionItemId, type ActionsPanelProps } from './ActionsPanel.js';
import { ConfirmModal } from './ConfirmModal.js';
import {
  runEndTurnFlow,
  runReasoningFlow,
  enumReasoningCandidates,
  enumPartnerAbilityIds,
  enumDeclaredAbilitySources,
  useCanEndTurnForUi,
  runNextHintFlow,
  runAssistFlow,
  runSolveCaseFlow,
  runHandUseFlow,
  runActionFlow,
  runPartnerAbilityFlow,
  runDeclaredAbilityFlow,
  canAssistForUi,
  canSolveCaseForUi,
  ACTION_CASE_TARGET_OPP,
} from '../hooks/useActionsPanelFlow.js';
import * as engineFlow from '@/engine/flow/index.js';
import { getHandUseDisabledReason } from '@/ui/services/handUseReason.js';
import { useConfirmation, useConfirmationStore } from '../hooks/useConfirmation.js';
import { useTargetPicker, useTargetPickerStore } from '../hooks/useTargetPicker.js';
import { useOppTurnDriver } from '../hooks/useOppTurnDriver.js';
import { useSpectatorTurnDriver } from '../hooks/useSpectatorTurnDriver.js';
import { useContactFlowDriver } from '../hooks/useContactFlowDriver.js';
import { usePlaymatViewportLayout } from '../hooks/useStageScale.js';
import { useFlipAnimation } from '../hooks/useFlipAnimation.js';
import { useContactModalStore } from '../hooks/useContactModalStore.js';
import { useHiramekiFlowDriver } from '../hooks/useHiramekiFlowDriver.js';
import { useMisreadFlowDriver } from '../hooks/useMisreadFlowDriver.js';
import { MisreadPickerModal, type MisreadCandidateView } from './MisreadPickerModal.js';
import { GuardPickerModal } from './GuardPickerModal.js';
import { CutInDisguisePickerModal } from './CutInDisguisePickerModal.js';
import { HiramekiPickerModal } from './HiramekiPickerModal.js';
import { useNextHintPickerStore, useNextHintPicker } from '@/ui/hooks/useNextHintPicker.js';
import { useSceneSwitchPickerStore } from '../hooks/useSceneSwitchPickerStore.js';
import { currentInteractionEpoch, isCurrentLiveInteraction } from '../services/terminalInteractionGate.js';
import { ChoicePickerModal } from './ChoicePickerModal.js';
import { SelectableCardTile } from './SelectableCardTile.js';
import { useChoicePicker, useChoicePickerStore } from '../hooks/useChoicePicker.js';
import { useModalFocusTrap } from '../hooks/useModalFocusTrap.js';
import { DeclareCardNameModal } from './DeclareCardNameModal.js';
import { useDeclareNamePicker, useDeclareNamePickerStore } from '../hooks/useDeclareNamePicker.js';
import { useEvidenceFlipPickerStore, useEvidenceFlipPicker } from '../hooks/useEvidenceFlipPicker.js';
import { useHandCostPickerStore, useHandCostPicker } from '../hooks/useHandCostPicker.js';
import { useStackedCardCostPickerStore, useStackedCardCostPicker } from '../hooks/useStackedCardCostPicker.js';
import { dispatchEngineAction } from '../hooks/useEngineDispatch.js';
import { bindPendingDecision } from '../hooks/useEngineDispatch/types.js';
import { useGameStateStore } from '../state/store.js';
import { selectInteractionLocked, selectSwitchVictimBlocked } from '../state/interactionLock.js';
import { getHumanDecisionSide } from '@/ui/services/humanDecisionOwner.js';
import { def as readDef } from '@/engine/read/def.js';
import { char as readChar } from '@/engine/read/char.js';
import { sceneCap } from '@/engine/read/scene-cap.js'; // engine E3 P11 (2026-07-02): 現場登場上限 (既定5、case override 可)
// D08021 driver 2026-05-26: distinctNames 制約 (rules/19) を multi-pick UI で
// 適用するため、name component 計算 helper を import。
import { allCardNameComponentsForDef } from '@/engine/target/card-def-registry.js';
import './Playmat.css';

// engine の `players[side].case.colors` (日本語色名) を CaseInfo.color (英名) に変換
const JP_COLOR_TO_EN: Record<string, CaseColor> = {
  '青': 'blue', '黄': 'yellow', '赤': 'red', '緑': 'green', '紫': 'purple',
  '黒': 'black', '白': 'white',
};

export type PlaymatProps = {
  gameState: GameState | null;
  resolveCard: (cardId: string) => ResolvedCardMeta;
  replayReadOnly?: boolean;
  replayViewer?: ReplayViewerMode;
  /**
   * 事件 cardId → 表示用メタ解決 (任意)。
   * 指定なしの場合は cardId をタイトルにフォールバックする placeholder ロジック。
   */
  resolveCase?: (cardId: string) => { title: string; color: CaseColor; level: number; orientation?: 'portrait' | 'landscape' };
  /**
   * 手札 cardId → HandCardMeta 解決 (任意)。
   * 指定なしの場合は HandZone は空表示。
   */
  resolveHandCard?: (cardId: string) => HandCardMeta;
};

type CandidateProps = {
  candidateUids?: ReadonlySet<string>;
  onUnitClick?: (uid: string) => void;
  isPartnerCandidate?: boolean;
  onPartnerClick?: () => void;
  /** M3 PA batch (rules/18): PA 常駐 MR が宣言能力 source 候補 (uid 'partnerMR:self') */
  isPartnerMRCandidate?: boolean;
  onPartnerMRClick?: () => void;
};

type PlayerMatProps = CandidateProps & {
  side: 'self' | 'opp';
  state: GameState | null;
  resolveCard: (cardId: string) => ResolvedCardMeta;
  resolveCase?: (cardId: string) => { title: string; color: CaseColor; level: number; orientation?: 'portrait' | 'landscape' };
  /** Round 2: FILE/証拠/リムーブ エリアクリックで内容モーダルを開く callback */
  onAreaClick?: (kind: 'file' | 'evidence' | 'remove', side: 'self' | 'opp') => void;
  /** Round 4l (BUG-001): カード単体クリックで拡大 modal を開く callback */
  onExpand?: (cardId: string) => void;
  onSetInspect?: (side: 'self' | 'opp', uid: string) => void;
  /** User vision (拡張 4): scene キャラ pick mode (sceneRemove 等の effect 対象選択) */
  pickCharUids?: ReadonlySet<string>;
  onPickChar?: (uid: string) => void;
  autoFocusPickUid?: string;
  /**
   * 2026-05-30 user_request: ネクストヒントのピッカー表示中、FILE 表示枚数を -1 して
   * 「step1 で引いた後」の実効枚数を見せる (self のみ true)。
   */
  nextHintDrawPreview?: boolean;
  /** Task2: アクティブカード (効果解決中/CPU 操作中) の uid + 行動ラベル → SceneArea ぴこんポップ */
  activeCardUid?: string | null;
  activeCardLabel?: string | null;
};

// UI picker Direct Manipulation 化: switch 中の opp 現場 pick prop に渡す不変の空集合。
const EMPTY_UID_SET: ReadonlySet<string> = new Set<string>();

function ReplayHandStrip({
  cards,
  count,
  revealCards,
}: {
  cards: HandCardMeta[];
  count: number;
  revealCards: boolean;
}): JSX.Element {
  return (
    <div
      className="hand-zone hand-zone--collapsed replay-hand-strip"
      aria-label={`自分の手札 ${count}枚${revealCards ? '' : '（非公開）'}`}
      data-testid="replay-hand-strip"
    >
      <div className="hand-mini-strip">
        {revealCards
          ? cards.map((card, index) => (
              <div
                key={`${card.cardId}:${index}`}
                className={`hand-mini-card replay-hand-card color-${card.color} ${card.type === 'イベント' ? 'is-event' : 'is-character'}`}
                aria-label={card.name}
              >
                <span className="hand-mini-cost" aria-hidden="true">{card.cost}</span>
                <span className="hand-mini-type-badge" aria-hidden="true">
                  {card.type === 'イベント' ? 'EV' : 'CH'}
                </span>
                <span className="hand-mini-art" aria-hidden="true">
                  <CardArt cardId={card.cardId} alt="" />
                </span>
                <span className="hand-mini-name">{card.name}</span>
              </div>
            ))
          : Array.from({ length: count }, (_, index) => (
              <div key={index} className="replay-hand-card-back" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                  <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            ))}
      </div>
      <span className="replay-hand-count">{count}枚</span>
    </div>
  );
}

// scene 直接 pick の skip-overlay banner を verb 別に生成 (画面処理=カードテキスト文言、設計 v2)。
// 新規5verb は全て nMin=0 のため overlay が常時表示される → 「リムーブ」固定文言だと語義不一致になる。
function sceneVerbBanner(verb: string | undefined): string {
  switch (verb) {
    case 'sceneRemove':      return '現場のキャラを1枚選んでリムーブしてください';
    case 'charModifyAP':     return '現場のキャラを1枚選んで効果を適用してください';
    case 'sceneSetState':    return '現場のキャラを1枚選んで状態を変更してください';
    case 'charGrantKeyword': return '現場のキャラを1枚選んで能力を付与してください';
    case 'charSetCard':      return '現場のキャラを1枚選んでカードをセットしてください';
    case 'charSetTurnEffect':return '現場のキャラを1枚選んで効果を付与してください';
    case 'sceneToHand':      return '現場のキャラを1枚選んで手札に戻してください';
    default:                 return '現場のキャラを1枚選んでください';
  }
}

function PlayerMat({
  side, state, resolveCard, resolveCase,
  candidateUids, onUnitClick, isPartnerCandidate, onPartnerClick,
  isPartnerMRCandidate, onPartnerMRClick,
  isCaseCandidate, onCaseClick, onAreaClick, onExpand, onSetInspect,
  pickCharUids, onPickChar, autoFocusPickUid, nextHintDrawPreview = false,
  activeCardUid, activeCardLabel,
}: PlayerMatProps & {
  isCaseCandidate?: boolean;
  onCaseClick?: () => void;
}): JSX.Element {
  const scene = state?.players[side].scene ?? [];
  const engineCase = state?.players[side].case;

  // engine の case → 表示用 CaseInfo に変換。resolveCase があれば title/color/level
  // を cards.json 由来で解決、なければ cardId / requiredEvidence で placeholder。
  const caseInfo: CaseInfo | null = engineCase
    ? (() => {
        const resolved = resolveCase ? resolveCase(engineCase.cardId) : null;
        return {
          cardId: engineCase.cardId,
          title: resolved?.title ?? engineCase.cardId,
          color: resolved?.color ?? JP_COLOR_TO_EN[engineCase.colors[0] ?? '青'] ?? 'blue',
          level: resolved?.level ?? engineCase.requiredEvidence,
          status: engineCase.status,
          requiredEvidence: engineCase.requiredEvidence,
          // Phase 9-D: undefined のままで CaseArea に渡し、画像実測 (useCardOrientation)
          // にフォールバックさせる。
          orientation: resolved?.orientation,
        };
      })()
    : null;
  const turnOrder = side === 'self' && (state?.players.self.case.requiredEvidence ?? 7) === 7
    ? 'first'
    : side === 'opp' && (state?.players.opp.case.requiredEvidence ?? 7) === 7
    ? 'first'
    : 'second';

  const evidenceCount = state?.players[side].evidence.length ?? 0;
  const requiredEvidence = engineCase?.requiredEvidence ?? 7;

  // レイアウト構造 (対称配置、エリア重なりなし):
  //   .mat (3-col grid)
  //     ├─ .left-col   : CaseArea (上) + EvidenceArea (下)  ← Phase 9-D で swap
  //     ├─ .center-col : SceneArea (上) + .below-scene (下: FileArea | PartnerArea)
  //     └─ .right-col  : DeckArea (上) + RemoveArea (下)
  //   opp は transform: rotate(180deg) で全体が上下逆転 (対称配置)
  return (
    <div className={`mat ${side}`} data-side={side}>
      <div className="left-col">
        <CaseArea
          caseInfo={caseInfo}
          turnOrder={turnOrder}
          side={side}
          isCandidate={isCaseCandidate}
          onClick={onCaseClick}
          onExpand={onExpand}
        />
        <EvidenceArea
          count={evidenceCount}
          requiredEvidence={requiredEvidence}
          side={side}
          onClick={onAreaClick ? () => onAreaClick('evidence', side) : undefined}
        />
      </div>
      <div className="center-col">
        <SceneArea
          characters={scene}
          side={side}
          resolveCard={resolveCard}
          candidateUids={candidateUids}
          onUnitClick={onUnitClick}
          onExpand={onExpand}
          onSetInspect={(character) => onSetInspect?.(side, character.uid)}
          pickCharUids={pickCharUids}
          onPickChar={onPickChar}
          autoFocusPickUid={autoFocusPickUid}
          resolveKeywords={(uid) => (state ? readChar.keywords(state, uid) : [])}
          resolveCharStats={(uid) => (state ? { ap: readChar.ap(state, uid), lp: readChar.lp(state, uid) } : undefined)}
          activeCardUid={activeCardUid}
          activeCardLabel={activeCardLabel}
        />
        <div className="below-scene">
          <FileArea
            cards={state?.players[side].file ?? []}
            side={side}
            resolveCard={resolveCard}
            onClick={onAreaClick ? () => onAreaClick('file', side) : undefined}
            pendingDrawn={nextHintDrawPreview ? 1 : 0}
          />
          <PartnerArea
            partner={state?.players[side].partner ?? null}
            side={side}
            resolveCard={resolveCard}
            paCards={state?.players[side].partnerAreaCards}
            partnerAreaMR={state?.players[side].partnerAreaMR ?? null}
            isCandidate={isPartnerCandidate}
            onClick={onPartnerClick}
            isMrCandidate={isPartnerMRCandidate}
            onMrClick={onPartnerMRClick}
            onExpand={onExpand}
          />
        </div>
      </div>
      <div className="right-col">
        <DeckArea count={state?.players[side].deck.length ?? 0} side={side} />
        <RemoveArea
          cards={state?.players[side].remove ?? []}
          side={side}
          resolveCard={resolveCard}
          onClick={onAreaClick ? () => onAreaClick('remove', side) : undefined}
        />
      </div>
    </div>
  );
}

export function Playmat({
  gameState,
  resolveCard,
  resolveCase,
  resolveHandCard,
  replayReadOnly = false,
  replayViewer,
}: PlaymatProps): JSX.Element {
  // Phase 8.7b: opp ターンを自動進行 (HeuristicPolicy + flow.endTurn で self へ戻す)
  useOppTurnDriver(!replayReadOnly);
  // Round 4l (B5 観戦モード): spectatorMode=true なら self ターンも AI 自動進行
  useSpectatorTurnDriver(!replayReadOnly);
  // Phase 8 完全クローズ Commit 2: contact フロー (declare→ガード→コンタクト→AP判定) 駆動。
  useContactFlowDriver(!replayReadOnly);
  // Phase 8 完全クローズ Commit 3a: ヒラメキ判定駆動 (opp owner なら AI 自動 / self owner はモーダル待ち)。
  useHiramekiFlowDriver(!replayReadOnly);
  // Phase 5 advance UI: Misread driver (reasoningPlayer='self' なら AI 自動解決、'opp' なら modal 待ち)
  useMisreadFlowDriver(!replayReadOnly);
  // Phase 8.5: 手札は default で collapsed (小さいストリップ)、クリックで expanded (実寸 + ×)
  const [handExpanded, setHandExpanded] = useState(false);
  // Round 4l (BUG-001): カード拡大 modal の state
  const expandModal = useCardExpandModal();
  const closeExpandModal = expandModal.close;
  // Phase 8.5: log パネル開閉。ActionsPanel に LOG ボタンを集約、開時は overlay 表示。
  const [logOpen, setLogOpen] = useState(false);
  // UI picker Direct Manipulation 化 (設計 v2 flicker gate): sceneEnter overflow の switch victim を
  // 現場直接クリックで収集する間 true。area CardListModal を閉じ・auto-open を抑止して
  // 盤面をクリック可能にする。dispatch と同 tick で false に戻し trailing 再表示 flicker を消す。
  const [switchSessionActive, setSwitchSessionActive] = useState(false);
  // Round 2: FILE/証拠/リムーブ クリック → 内容モーダル表示の state。
  const [areaModal, setAreaModal] = useState<{
    kind: CardListKind;
    side: 'self' | 'opp';
    origin: 'browse' | 'pick';
    hostUid?: string;
  } | null>(null);
  const terminal = gameState?.gameResult !== undefined;
  const terminalRef = useRef(terminal);
  terminalRef.current = terminal;
  // Result is a hard UI boundary: local browse/detail/log overlays must not
  // retain a focus trap after the live interaction stores are settled.
  useEffect(() => {
    if (!terminal) return;
    setHandExpanded(false);
    setLogOpen(false);
    setSwitchSessionActive(false);
    setAreaModal(null);
    closeExpandModal();
  }, [terminal, closeExpandModal]);
  const handleAreaClick = (kind: CardListKind, side: 'self' | 'opp'): void => {
    if (terminalRef.current) return;
    setAreaModal({ kind, side, origin: 'browse' });
  };
  const closeAreaModal = (): void => setAreaModal(null);
  const inspectSetCards = (side: 'self' | 'opp', hostUid: string): void => {
    if (terminalRef.current) return;
    setAreaModal({ kind: 'set', side, origin: 'browse', hostUid });
  };
  const openCardExpand = (cardId: string): void => {
    if (!terminalRef.current) expandModal.open(cardId);
  };
  const openHand = (): void => {
    if (!terminalRef.current) setHandExpanded(true);
  };

  // User vision (CardListModal を pick UI として流用 + HandZone も同様):
  // pendingEffectPick.atomVerb に応じて、対応する既存 UI (CardListModal / HandZone 拡大) を
  // 自動 open する。EffectPickerModal は area pick 中は無効化。
  //
  // verb → UI mapping:
  //   evidenceToHand → CardListModal kind='evidence' を auto-open
  //   handAddFromRemove → CardListModal kind='remove' を auto-open
  //   discard → HandZone を auto-expand (pick mode)
  const pendingPickForArea = useGameStateStore((s) => s.pendingEffectPick);
  const pendingDeckReveal = useGameStateStore((s) => s.pendingDeckReveal);
  const pendingDeckReorder = useGameStateStore((s) => s.pendingDeckReorder);
  const pickerPhase = useTargetPickerStore((s) => s.phase);
  const { pick: pickTarget, confirm: confirmTarget, cancel: cancelTarget } = useTargetPicker();
  useEffect(() => {
    if (replayReadOnly || pickerPhase.phase === 'idle') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelTarget();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [replayReadOnly, pickerPhase.phase, cancelTarget]);
  // 効果解決中ロック (rules/05 割り込み禁止): 効果スタック非空 or 人間の未解決 decision 待ち中は
  // ActionsPanel の全メインアクションを塞ぐ。decision modal / 盤面 pick はロック対象外。
  const storeInteractionLocked = useGameStateStore(selectInteractionLocked);
  const interactionLocked = replayReadOnly || storeInteractionLocked;
  const canEndTurn = useCanEndTurnForUi('self');
  // Task2/4: アクティブカード (該当カードをその場でぴこんポップ。中央全画面ポップは不採用)。
  // - CPU 手番中は useOppTurnDriver が store.activeCardUid を 1 手ごとに set (登場/推理/アクション等)。
  // - 人間ターンの効果解決中は pendingEffects (resolving 優先) の source.uid を採用。
  // CPU の store 信号を優先し、無ければ効果スタック由来にフォールバック。
  const storeActiveCardUid = useGameStateStore((s) => s.activeCardUid);
  const storeActiveCardLabel = useGameStateStore((s) => s.activeCardLabel);
  // 効果解決中のカードを採用。resolving 優先、無ければ未解決 (pending) の先頭。
  // ⚠ resolved / cancelled の entry は採用しない — pendingEffects は resolved entry を prune せず
  // 蓄積し続けるため、`?? pendingEffects[0]` だと古い解決済み entry を拾って「効果解決」ポップが
  // 毎ターン幻のように出続けるバグになる (CPU per-move 可視化で顕在化)。
  const activeEffectEntry =
    (gameState?.pendingEffects ?? []).find((e) => e.state === 'resolving') ??
    (gameState?.pendingEffects ?? []).find((e) => e.state === 'pending');
  const effectCardUid = activeEffectEntry?.source.uid ?? null;
  const activeCardUid = storeActiveCardUid ?? effectCardUid;
  const activeCardLabel = storeActiveCardUid ? storeActiveCardLabel : effectCardUid ? '効果解決' : null;
  const isDiscardPick =
    pendingPickForArea?.player === 'self' && pendingPickForArea.atomVerb === 'discard';
  // 2026-05-28: ネクストヒント step2 pick。useNextHintPicker store に current が
  // set されている間、HandZone を expand + pick mode (FILE-top + 使用可能手札を黄色枠)。
  const nextHintPick = useNextHintPickerStore((s) => s.current);
  const isNextHintPick = nextHintPick !== null;

  // カットイン選択 (User 要望): useContactModalStore.cutInDisguise を HandZone pick mode (黄色枠) で扱う。
  // self + cutin候補あり + 変装候補なし のときのみ hand-pick。変装候補あり (MVP 不発) は旧 modal。
  const cutInStore = useContactModalStore((s) => s.cutInDisguise);
  const cutInHasDisguise = (cutInStore?.candidates ?? []).some((c) => c.kind === 'disguise');
  const isCutinPick =
    cutInStore !== null &&
    cutInStore.player === 'self' &&
    !cutInHasDisguise;
  const cutinPickableIds = isCutinPick
    ? new Set(cutInStore!.candidates.filter((c) => c.kind === 'cutin').map((c) => c.cardId))
    : undefined;
  const cutinCount = cutInStore?.candidates.filter((c) => c.kind === 'cutin').length ?? 0;
  const cutinBannerText = cutInStore
    ? `カットイン可能 ${cutinCount}枚（パス可）— ${cutInStore.actorLabel}${cutInStore.actorName ? `（${cutInStore.actorName}）` : ''}`
    : undefined;
  const handleCutinPick = (uid: string): void => {
    const cur = useContactModalStore.getState().cutInDisguise;
    if (!cur) return;
    const cardId = cardIdFromOccurrenceUid(uid);
    if (!cardId) return;
    useContactModalStore.getState()._setCutInDisguise(null);
    setHandExpanded(false);
    dispatchEngineAction({ type: 'actionContact', actionId: cur.actionId, player: cur.player, choice: { kind: 'cutin', cardId } });
    dispatchEngineAction({ type: 'actionAdvance', actionId: cur.actionId });
  };
  const handleCutinPass = (): void => {
    const cur = useContactModalStore.getState().cutInDisguise;
    if (!cur) return;
    useContactModalStore.getState()._setCutInDisguise(null);
    setHandExpanded(false);
    dispatchEngineAction({ type: 'actionContact', actionId: cur.actionId, player: cur.player, choice: { kind: 'pass' } });
    dispatchEngineAction({ type: 'actionAdvance', actionId: cur.actionId });
  };
  const pickAreaKind: CardListKind | null = (() => {
    if (!pendingPickForArea || pendingPickForArea.player !== 'self') return null;
    if (pendingPickForArea.atomVerb === 'deckRevealUntil') return 'deck';
    if (pendingPickForArea.atomVerb === 'evidenceToHand') return 'evidence';
    if (pendingPickForArea.atomVerb === 'handAddFromRemove') {
      const areas = [...new Set(pendingPickForArea.candidates
        .filter((candidate) => candidate.kind === 'card' && candidate.area !== undefined)
        .map((candidate) => candidate.area))];
      if (areas.length > 1) return 'selection';
      if (areas[0] === 'partner-area') return 'partner-area';
      return 'remove';
    }
    // engine wave A1 (G39 継続): partnerAreaRemove — PA 一般カード枠から pick (B07037 n:2 multi)。
    // charStackCard と同型の area multi-pick を CardListModal kind='partner-area' で流用。
    if (pendingPickForArea.atomVerb === 'partnerAreaRemove') return 'partner-area';
    // D11014 a2 driver 2026-05-26: sceneEnter (D08024/D11014 reanimate) は area: remove
    // CardListModal pick mode で D08013 evidenceToHand と同 UI を流用
    if (pendingPickForArea.atomVerb === 'sceneEnter') {
      const args = pendingPickForArea.atomArgs as { target?: { query?: { area?: string } } } | undefined;
      const area = args?.target?.query?.area;
      if (area === 'remove') return 'remove';
      if (area === 'evidence') return 'evidence';
      if (area === 'file') return 'file';
      // S2 B01022 (2026-07-10): deck-window pick — deckRevealUntil で公開した window から登場対象を選ぶ。
      // cards ソースは pending.candidates (window+filter 通過分) のみ。gameState.deck 直読みは禁止
      // (window 外の非公開カードが見えるため)。
      if (area === 'deck') return 'deck';
    }
    // D08021 driver 2026-05-26: charStackCard (multi-pick 0-5 から下に重ねる) も
    // target.query.area で area kind が決まる (typically remove)。
    if (pendingPickForArea.atomVerb === 'charStackCard') {
      const args = pendingPickForArea.atomArgs as { target?: { query?: { area?: string } } } | undefined;
      const area = args?.target?.query?.area;
      if (area === 'remove') return 'remove';
      if (area === 'evidence') return 'evidence';
      if (area === 'file') return 'file';
    }
    return null;
  })();
  // A public-area declared source needs a modal, but that modal must retain all
  // legal source identities (including board-only sources) in the same choice.
  const declaredSourcePick: Array<{ uid: string; cardId: string; player: 'self' | 'opp'; areaLabel: string }> = (() => {
    if (pickerPhase.phase !== 'picking' || pickerPhase.purpose !== 'declared-ability:source' || !gameState) return [];
    return pickerPhase.candidates.flatMap((uid) => {
      for (const player of ['self', 'opp'] as const) {
        const sceneCard = gameState.players[player].scene.find((card) => card.uid === uid);
        if (sceneCard) return [{ uid, cardId: sceneCard.cardId, player, areaLabel: 'Scene' }];
      }
      if (uid === 'case:self' || uid === 'case:opp') {
        const player = uid === 'case:self' ? 'self' : 'opp';
        const cardId = gameState.players[player].case.cardId;
        return cardId ? [{ uid, cardId, player, areaLabel: 'Case' }] : [];
      }
      const handMatch = /^hand:(self|opp):(\d+)$/.exec(uid);
      if (handMatch) {
        const [, side, indexText] = handMatch;
        const player = side as 'self' | 'opp';
        const index = Number(indexText);
        const cardId = gameState.players[player].hand[index];
        return cardId
          ? [{ uid, cardId, player, areaLabel: `Hand ${index + 1}` }]
          : [];
      }
      const legacyHandMatch = /^hand:(self|opp):(.+)$/.exec(uid);
      if (legacyHandMatch) {
        const [, side, cardId] = legacyHandMatch;
        const player = side as 'self' | 'opp';
        const index = gameState.players[player].hand.indexOf(cardId);
        return index >= 0 ? [{ uid, cardId, player, areaLabel: `Hand ${index + 1}` }] : [];
      }
      for (const player of ['self', 'opp'] as const) {
        const mr = gameState.players[player].partnerAreaMR;
        if (mr && (uid === mr.uid || uid === `partnerMR:${player}`)) {
          return [{ uid, cardId: mr.cardId, player, areaLabel: 'Partner area (MR)' }];
        }
      }
      const match = /^(evidence|file):(self|opp):(\d+)$/.exec(uid);
      if (!match) return [];
      const [, area, side, indexText] = match;
      const player = side as 'self' | 'opp';
      const index = Number(indexText);
      if (area === 'evidence') {
        const entry = gameState.players[player].evidence[index];
        return entry?.faceUp ? [{ uid, cardId: entry.cardId, player, areaLabel: 'Evidence' }] : [];
      }
      const entry = gameState.players[player].file[index];
      return entry?.type === 'card-back' && entry.faceUp === true ? [{ uid, cardId: entry.cardId, player, areaLabel: 'FILE' }] : [];
    });
  })();
  const declaredSourceNeedsModal = declaredSourcePick.some((candidate) => candidate.areaLabel === 'Evidence' || candidate.areaLabel === 'FILE');
  const pickModalKind: CardListKind | null = pickAreaKind ?? (declaredSourceNeedsModal ? 'selection' : null);
  const pickModalSide: 'self' | 'opp' = (() => {
    if (pickAreaKind !== 'partner-area') return 'self';
    const players = [...new Set((pendingPickForArea?.candidates ?? []).map((candidate) => candidate.player))];
    return players.length === 1 ? players[0]! : 'self';
  })();
  useEffect(() => {
    if (pickModalKind === null) return;
    // switch victim 収集中 (sceneEnter overflow) は area modal を再 open しない (盤面を直接クリックさせる、設計 v2)
    if (switchSessionActive) return;
    // すでに対応 area modal が開いていれば noop
    if (areaModal && areaModal.kind === pickModalKind && areaModal.side === pickModalSide && areaModal.origin === 'pick') return;
    setAreaModal({ kind: pickModalKind, side: pickModalSide, origin: 'pick' });
  }, [pickModalKind, pickModalSide, areaModal, switchSessionActive]);
  // pick 解決 (pending クリア) で modal 自動 close (ユーザーが × でも閉じれる)
  useEffect(() => {
    if (pickModalKind !== null) return;
    // area pick が無くなり、area modal が pick 用に開いていた場合は閉じる
    if (areaModal?.origin === 'pick') {
      // pendingEffectPick が消えた → pick 完了 or skip。browse origin は維持する。
      setAreaModal(null);
    }
  }, [pickModalKind, areaModal]);
  // BUG-085 review (Finding 2): 証拠 flip picker が開いたら、手動で開いていた証拠
  // 閲覧 areaModal を閉じて backdrop の二重表示を防ぐ。
  const flipPickerActive = useEvidenceFlipPickerStore((s) => s.current !== null);
  useEffect(() => {
    if (flipPickerActive && areaModal && areaModal.kind === 'evidence') {
      setAreaModal(null);
    }
  }, [flipPickerActive, areaModal]);
  // discard pick 中は HandZone を自動 expand (User vision: 手札拡大表示から選択)
  useEffect(() => {
    if (isDiscardPick) setHandExpanded(true);
  }, [isDiscardPick]);
  // 2026-05-28: ネクストヒント step2 pick 中も HandZone を自動 expand
  useEffect(() => {
    if (isNextHintPick) setHandExpanded(true);
  }, [isNextHintPick]);
  // カットイン判断中も HandZone を自動 expand (手札拡大から選択)
  useEffect(() => {
    if (isCutinPick) setHandExpanded(true);
  }, [isCutinPick]);
  const isHandSceneEnterPick = (() => {
    if (pendingPickForArea?.player !== 'self' || pendingPickForArea.atomVerb !== 'sceneEnter') return false;
    const args = pendingPickForArea.atomArgs as { target?: { query?: { area?: string } } };
    return args.target?.query?.area === 'hand';
  })();
  useEffect(() => {
    if (isHandSceneEnterPick) setHandExpanded(true);
  }, [isHandSceneEnterPick]);
  // UI picker Direct Manipulation 化 (設計 v2): scene-char を 1 枚選ぶ pick は現場カード直接クリックで処理。
  // verb 白名簿 (旧: sceneRemove/charModifyAP) ではなく候補ベース述語 isSceneDirectPick を
  // EffectPickerModal と **共有** し、sceneSetState/charGrantKeyword/charSetCard/charSetTurnEffect/sceneToHand
  // + 将来 verb を自動被覆 (n.max>1 や非scene混在は false → EffectPickerModal フォールバック)。
  const isScenePick = isSceneDirectPick(pendingPickForArea, gameState);
  // W2b (P50/r27): mustBeSelectedByOppEvent forced 集合 — forced が居る pick では
  // forced 以外を click 不可化し (「必ず選ぶ」)、skip (選ばない) も封じる。
  const scenePickForced = (pendingPickForArea?.forcedUids ?? []).filter(
    (u) => pendingPickForArea?.candidates.some((c) => c.uid === u),
  );
  // 直接クリックの任意 effect pick は TargetPicker を経由しないため、Escape も画面上の
  // 「選ばない」と同じ effectPickResolve(null) に接続する。必須選択と forced 選択は取消不可。
  useEffect(() => {
    if (replayReadOnly || !isScenePick || !pendingPickForArea || pendingPickForArea.nMin !== 0 || scenePickForced.length > 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dispatchEngineAction(bindPendingDecision(
        pendingPickForArea,
        { type: 'effectPickResolve', pickedUid: null },
      ));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [replayReadOnly, isScenePick, pendingPickForArea, scenePickForced.length]);
  const scenePickUidsSelf = new Set<string>();
  const scenePickUidsOpp = new Set<string>();
  if (isScenePick && pendingPickForArea) {
    for (const c of pendingPickForArea.candidates) {
      if (scenePickForced.length > 0 && !scenePickForced.includes(c.uid)) continue;
      if (c.player === 'self') scenePickUidsSelf.add(c.uid);
      else scenePickUidsOpp.add(c.uid);
    }
  }
  const handleScenePick = isScenePick ? (uid: string): void => {
    if (!pendingPickForArea) return;
    dispatchEngineAction(bindPendingDecision(
      pendingPickForArea,
      { type: 'effectPickResolve', pickedUid: uid },
    ));
  } : undefined;
  // rules/20 §スイッチ: switch victim (常に self 現場) も現場直接クリックで収集 (旧 SceneSwitchPickerModal 廃止)。
  // useSceneSwitchPickerStore.current が active な間、self 現場の候補を effect-pickable 化し
  // click で resolve+close。辞退 (キャンセル) = resolve(null)。effect-pick とは構造的に排他
  // (switch 中は pending=null or sceneEnter で isScenePick=false)。
  const switchPicker = useSceneSwitchPickerStore((s) => s.current);
  const switchActive = switchPicker !== null;
  const switchVictimBlocked = useGameStateStore(selectSwitchVictimBlocked);
  const switchVictimUidsSelf = new Set<string>(switchPicker?.candidates.map((c) => c.uid) ?? []);
  const handleSwitchVictim = (uid: string): void => {
    if (selectSwitchVictimBlocked(useGameStateStore.getState())) return;
    const c = useSceneSwitchPickerStore.getState().current;
    if (!c) return;
    useSceneSwitchPickerStore.getState()._close();
    c.resolve(uid);
  };
  const handleSwitchCancel = (): void => {
    if (selectSwitchVictimBlocked(useGameStateStore.getState())) return;
    const c = useSceneSwitchPickerStore.getState().current;
    if (!c) return;
    useSceneSwitchPickerStore.getState()._close();
    c.resolve(null);
  };
  useEffect(() => {
    if (replayReadOnly || !switchActive) return;
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      if (selectSwitchVictimBlocked(useGameStateStore.getState())) return;
      event.preventDefault();
      const current = useSceneSwitchPickerStore.getState().current;
      if (!current) return;
      useSceneSwitchPickerStore.getState()._close();
      current.resolve(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [replayReadOnly, switchActive]);
  // MUX (設計 v2): self/opp 現場の pick prop は switch 中なら switch victim を優先 (victim は常に self)。
  const switchPickEnabled = switchActive && !switchVictimBlocked;
  const selfScenePickUids = switchPickEnabled ? switchVictimUidsSelf : switchActive ? EMPTY_UID_SET : scenePickUidsSelf;
  const oppScenePickUids = switchActive ? EMPTY_UID_SET : scenePickUidsOpp;
  const selfOnPickChar = switchPickEnabled ? handleSwitchVictim : switchActive ? undefined : handleScenePick;
  const oppOnPickChar = switchActive ? undefined : handleScenePick;

  // switch-on-effect-enter (rules/20 §スイッチ): リムーブ等からの効果登場 (sceneEnter) で現場が満杯
  // (5枚) のとき、reanimate 対象を選んだ後に SceneSwitchPickerModal で退場キャラを収集してから resolve。
  //   - 退場キャラ選択 → switchRemoveUid 付きで resolve → engine が switchEnter で登場。
  //   - cancel (辞退) → pickedUid:null で resolve → reanimate しない (rules: 0枚選択=合法な辞退)。
  // 満杯でない sceneEnter / 他 area pick は従来通り即 resolve。
  const resolveSceneEnterPick = async (uid: string): Promise<void> => {
    const st = useGameStateStore.getState();
    const pend = pendingPickForArea;
    const gs = st.gameState;
    if (!pend) return;
    const currentPending = st.pendingEffectPick;
    const isCurrent = pend.decisionId === undefined
      ? currentPending === pend
      : currentPending?.decisionId === pend.decisionId;
    if (!isCurrent) return;
    if (pend && pend.atomVerb === 'sceneEnter' && gs && gs.players[pend.player].scene.length >= sceneCap(gs, pend.player)) {
      const reanimateCardId = pend.candidates.find((c) => c.uid === uid)?.cardId ?? '';
      const sceneChars = gs.players[pend.player].scene.map((c) => ({
        uid: c.uid,
        cardId: c.cardId,
        name: readDef.card(c.cardId)?.names?.[0] ?? c.cardId,
        state: c.state,
        isNamed: c.isNamed,
      }));
      const newCardName = readDef.card(reanimateCardId)?.names?.[0] ?? reanimateCardId;
      // area modal を閉じ・auto-open を抑止して self 現場を直接クリックさせる (設計 v2 flicker gate)
      setAreaModal(null);
      setSwitchSessionActive(true);
      const interactionEpoch = currentInteractionEpoch();
      const removeUid = await new Promise<string | null>((resolve) => {
        useSceneSwitchPickerStore.getState()._open({ cardId: reanimateCardId, newCardName, candidates: sceneChars, resolve });
      });
      if (!isCurrentLiveInteraction(interactionEpoch)) {
        setSwitchSessionActive(false);
        return;
      }
      if (removeUid === null) {
        setSwitchSessionActive(false);
        dispatchEngineAction(bindPendingDecision(pend, { type: 'effectPickResolve', pickedUid: null }));
        return;
      }
      setSwitchSessionActive(false);
      dispatchEngineAction(bindPendingDecision(
        pend,
        { type: 'effectPickResolve', pickedUid: uid, switchRemoveUid: removeUid },
      ));
      return;
    }
    dispatchEngineAction(bindPendingDecision(pend, { type: 'effectPickResolve', pickedUid: uid }));
  };

  // Phase 8.6: target picker state を subscribe して候補ハイライト + click ハンドラを派生
  // クリック 1 回で pick + confirm を同時に行う (最終確認は useConfirmation 側のモーダル)
  const pickAndConfirm = (uid: string): void => {
    pickTarget(uid);
    confirmTarget();
  };
  const candidateUidsSelf = new Set<string>();
  const candidateUidsOpp = new Set<string>();
  let isSelfPartnerCandidate = false;
  let isSelfPartnerMRCandidate = false;
  let selfPartnerMRCandidateUid: string | null = null;
  let isOppCaseCandidate = false;
  // 2026-05-30 user_request: 事件カードの宣言能力 source ('case:self') を盤面で黄色強調する。
  let isSelfCaseCandidate = false;
  if (pickerPhase.phase !== 'idle') {
    // purpose に応じて自陣/相手陣どちらに候補を振るか分岐。
    // - 'action:source' / 'reasoning' / その他 → self 側候補
    // - 'action:target' → opp 側候補 (+ case)
    const isTargetingOpp = pickerPhase.purpose === 'action:target';
    for (const uid of pickerPhase.candidates) {
      if (uid === ACTION_CASE_TARGET_OPP) {
        isOppCaseCandidate = true;
        continue;
      }
      // 宣言能力 source: 自分の事件カード
      if (uid === 'case:self') {
        isSelfCaseCandidate = true;
        continue;
      }
      if (uid === 'partner:self') {
        isSelfPartnerCandidate = true;
        continue;
      }
      if (uid === 'partner:opp') continue;
      // M3 PA batch (rules/18): PA 常駐 MR の宣言能力 source
      const selfMr = gameState?.players.self.partnerAreaMR;
      if (selfMr && (uid === selfMr.uid || uid === 'partnerMR:self')) {
        isSelfPartnerMRCandidate = true;
        selfPartnerMRCandidateUid = uid;
        continue;
      }
      const oppMr = gameState?.players.opp.partnerAreaMR;
      if (oppMr && (uid === oppMr.uid || uid === 'partnerMR:opp')) continue;
      if (isTargetingOpp) candidateUidsOpp.add(uid);
      else candidateUidsSelf.add(uid);
    }
  }

  // narrator: opp ターン中 / picker phase 中 で動的に切替 (Phase 8.7b)
  const narratorMessage =
    gameState?.turn.player === 'opp'
      ? '相手のターン処理中…'
      : pickerPhase.phase === 'picking'
        ? `${labelForPurpose(pickerPhase.purpose)} の対象を選択してください。`
        : pickerPhase.phase === 'confirming'
          ? '確認モーダルで実行/キャンセルを選んでください。'
          : '⑥ アクション を選択すると、攻撃元キャラ指定 → 相手のスリープ/スタン状態キャラに対しアクション対象を選べます。';
  const replayMayRevealSelfHand = replayReadOnly && replayViewer === 'solo-self';
  const handCards: HandCardMeta[] = resolveHandCard && (!replayReadOnly || replayMayRevealSelfHand)
    ? (gameState?.players.self.hand ?? []).map(resolveHandCard)
    : [];
  // 2026-05-28: ネクストヒント step2 pick 用の表示カード群。
  // 手札 + FILE 最上部 (これから引くカード) を末尾に合成し、HandZone pick mode で
  // 使用可能カード (nextHintPick.candidates) のみ黄色枠化する。
  const nextHintPickableIds = isNextHintPick
    ? new Set(nextHintPick!.candidates.map((c) => c.cardId))
    : undefined;
  const handCardsForZone: HandCardMeta[] =
    isNextHintPick && resolveHandCard
      ? [...handCards, resolveHandCard(nextHintPick!.fileTopCardId)]
      : handCards;
  const handPickMode = isDiscardPick || isNextHintPick || isCutinPick || isHandSceneEnterPick;
  const handPickableCardIds = isCutinPick
    ? cutinPickableIds
    : isNextHintPick
      ? nextHintPickableIds
      : undefined;
  const handPickableCardUids = isDiscardPick || isHandSceneEnterPick
    ? new Set(pendingPickForArea?.candidates.map((candidate) => candidate.uid))
    : undefined;
  const handCanUse: NonNullable<HandZoneProps['canUse']> = (card) =>
    !interactionLocked && gameState !== null && (
      engineFlow.canHandUseCard(gameState, 'self', card.cardId) ||
      engineFlow.canHandUseCardSwitch(gameState, 'self', card.cardId)
    );
  const handDisabledReason: NonNullable<HandZoneProps['disabledReason']> = (card) =>
    gameState !== null
      ? getHandUseDisabledReason(gameState, 'self', card.cardId) ?? '使用不可'
      : '未開始';
  const handleHandUse = (cardId: string): void => {
    if (terminalRef.current || interactionLocked) return;
    void runHandUseFlow({ player: 'self', cardId });
  };
  const handleHandPickCard: HandZoneProps['onPickCard'] = isCutinPick
    ? handleCutinPick
    : isHandSceneEnterPick
      ? (uid) => { void resolveSceneEnterPick(uid); }
      : isNextHintPick
        ? (uid) => {
            const cardId = cardIdFromOccurrenceUid(uid);
            if (cardId) useNextHintPicker().acceptUse(cardId);
          }
        : isDiscardPick
          ? (uid) => {
              if (pendingPickForArea) {
                dispatchEngineAction(bindPendingDecision(
                  pendingPickForArea,
                  { type: 'effectPickResolve', pickedUid: uid },
                ));
              }
            }
          : undefined;
  const handPickCanSkip = isCutinPick
    ? true
    : isHandSceneEnterPick
      ? (pendingPickForArea?.nMin ?? 1) === 0
      : isNextHintPick
        ? true
        : isDiscardPick && (pendingPickForArea?.nMin ?? 1) === 0;
  const handleHandPickSkip: HandZoneProps['onPickSkip'] = isCutinPick
    ? handleCutinPass
    : isHandSceneEnterPick || isDiscardPick
      ? () => {
          if (pendingPickForArea) {
            dispatchEngineAction(bindPendingDecision(
              pendingPickForArea,
              { type: 'effectPickResolve', pickedUid: null },
            ));
          }
        }
      : isNextHintPick
        ? () => useNextHintPicker().acceptSkip()
        : undefined;
  const handleHandPickMulti: HandZoneProps['onPickMulti'] = isDiscardPick
    ? (uids) => {
        if (!pendingPickForArea) return;
        const first = uids[0];
        dispatchEngineAction(bindPendingDecision(
          pendingPickForArea,
          first === undefined
            ? { type: 'effectPickResolve', pickedUid: null }
            : { type: 'effectPickResolve', pickedUid: first, pickedUids: uids },
        ));
      }
    : undefined;

  const handleEndTurn = (): void => {
    if (terminalRef.current || replayReadOnly) return;
    void runEndTurnFlow({ player: 'self' });
  };
  const handleActionItemClick = (id: ActionItemId): void => {
    if (terminalRef.current || interactionLocked || pickerPhase.phase !== 'idle') return;
    cancelTarget();
    if (id === 'reasoning') void runReasoningFlow({ player: 'self' });
    else if (id === 'next-hint') void runNextHintFlow({ player: 'self' });
    else if (id === 'assist') void runAssistFlow({ player: 'self' });
    else if (id === 'solve-case') void runSolveCaseFlow({ player: 'self' });
    else if (id === 'hand-use') setHandExpanded(true);
    else if (id === 'action') void runActionFlow({ player: 'self' });
    else if (id === 'partner-ability') void runPartnerAbilityFlow({ player: 'self' });
    else if (id === 'declared-ability') void runDeclaredAbilityFlow({ player: 'self' });
    else console.warn(`[Playmat] unknown action item: ${id}`);
  };
  const actionPanelProps: ActionsPanelProps = {
    handCount: handCards.length,
    handUseRemaining:
      gameState?.turnState.self.handUseUsed || gameState?.turnState.self.nextHintUsed ? 0 : 1,
    handUseUsed: gameState?.turnState.self.handUseUsed ?? false,
    nextHintFileCount: gameState?.players.self.file.length ?? 0,
    nextHintUsed: gameState?.turnState.self.nextHintUsed ?? false,
    canNextHint: gameState ? engineFlow.canStartNextHint(gameState, 'self') : false,
    partnerActive: gameState?.players.self.partner.state === 'active',
    partnerAbilityCount: gameState ? enumPartnerAbilityIds(gameState, 'self').length : 0,
    declaredTargetCount: gameState ? enumDeclaredAbilitySources(gameState, 'self').length : 0,
    reasoningTotalLP: gameState ? enumReasoningCandidates(gameState, 'self').length : 0,
    canAssist: gameState ? canAssistForUi(gameState, 'self') : false,
    canSolveCase: gameState ? canSolveCaseForUi(gameState, 'self') : false,
    interactionLocked: interactionLocked || pickerPhase.phase !== 'idle',
    actionMode:
      pickerPhase.phase !== 'idle' &&
      typeof pickerPhase.purpose === 'string' &&
      pickerPhase.purpose.startsWith('action:')
        ? 'selecting-target'
        : 'idle',
    currentPhase: gameState?.turn.phase ?? 'main',
    canEndTurn: !replayReadOnly && canEndTurn,
    onEndTurn: handleEndTurn,
    onActionItemClick: handleActionItemClick,
    narratorMessage,
    logEntryCount: gameState?.log.length ?? 0,
    logOpen,
    onLogToggle: () => { if (!terminalRef.current) setLogOpen((value) => !value); },
  };
  // Desktop は現行 zoom を維持。短い横画面でも 1920×1080 の同じ盤面 DOM を
  // reflow せず等比縮小し、既存の操作・対象選択をそのまま使う。
  const scalerRef = useRef<HTMLDivElement>(null);
  const viewportLayout = usePlaymatViewportLayout({ containerRef: scalerRef });
  // Task5 FLIP: 現場カードの reflow (追加/除去/スイッチ/ゴースト消滅) を移動トゥイーンする。
  // board-content 配下の [data-flip-id] の構造変化を MutationObserver で監視し位置差分をスライド。
  const boardRef = useRef<HTMLDivElement>(null);
  useFlipAnimation(boardRef);
  const boardStyle = viewportLayout.containedLandscape
    ? {
        position: 'absolute' as const,
        width: `${viewportLayout.logicalWidth}px`,
        height: `${viewportLayout.logicalHeight}px`,
        left: `${viewportLayout.left}px`,
        top: `${viewportLayout.top}px`,
        transform: `scale(${viewportLayout.scale})`,
        transformOrigin: 'top left',
        zoom: 1,
      }
    : { zoom: viewportLayout.scale };
  const scalerStyle = {
    '--playmat-inverse-scale': 1 / viewportLayout.scale,
    '--playmat-control-overlap': `${16 / viewportLayout.scale}px`,
  } as CSSProperties;
  const effectOrderEntries = gameState ? pendingOwnerOrderGroup(gameState, 'self') : [];
  return (
    <div
      className="scaler"
      id="scaler"
      ref={scalerRef}
      style={scalerStyle}
      data-stage-scale={viewportLayout.scale}
      data-playmat-layout="desktop"
      data-playmat-fit={viewportLayout.containedLandscape ? 'contained-landscape' : 'fluid-desktop'}
      data-playmat-logical-width={viewportLayout.logicalWidth}
      data-playmat-logical-height={viewportLayout.logicalHeight}
    >
      <div className="stage">
        {/* BUG-150: board-content を zoom + width=100/scale% で stage 全面に充填し、
            内部のカード/chrome を比率維持スケール (旧 .scaler transform:scale を撤去)。
            以降の modal/overlay は board-content の外 (=.stage 直下) に置き非 zoom で viewport 基準。 */}
        <div
          className="board-content"
          ref={boardRef}
          style={boardStyle}
        >
          <div className="bg" />
        <div className="vignette" />

        {/* TopBar (Task 7.12) — Round 2 修正: firstPlayer を engine state から動的判定し
            「先攻/後攻」ラベル + プレイヤー視点の N ターン目 を正しく表示。
            先攻判定は rules/01 の必要証拠数で行う (先攻=7枚 / 後攻=6枚)。 */}
        <TopBar
          turn={{
            number: gameState?.turn.number ?? 1,
            player: gameState?.turn.player ?? 'self',
          }}
          firstPlayer={
            // gameState null 時は default 'self' を返す (setup modal 表示時の placeholder)。
            // ゲーム開始後は engine の requiredEvidence で判定 (先攻=7 / 後攻=6 rules/01)。
            gameState === null
              ? 'self'
              : gameState.players.self.case.requiredEvidence === 7
                ? 'self'
                : 'opp'
          }
          scratchTrace={gameState?.scratchTrace ?? { self: '未発見', opp: '未発見' }}
          effectStackCount={
            (gameState?.pendingEffects ?? []).filter(
              (e) => e.state === 'pending' || e.state === 'resolving',
            ).length
          }
        />
        <div className="play-area">
          {/* Opponent hand strip (top of opp mat, count + mini card-backs) */}
          <div className="opp-hand-strip" aria-label="相手手札">
            <span className="opp-hand-label">相手の手札</span>
            <div className="mini-cards">
              {Array.from({ length: gameState?.players.opp.hand.length ?? 0 }).map((_, i) => (
                // Phase 9-E: 裏面デザインを統一 (FileArea/EvidenceArea 系の虫眼鏡 SVG)
                <div key={i} className="mini-card-back" aria-hidden="true">
                  <svg className="mini-card-back-icon" viewBox="0 0 24 24" width="14" height="14">
                    <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
                    <line x1="14.5" y1="14.5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
              ))}
            </div>
            <span className="opp-hand-count">{gameState?.players.opp.hand.length ?? 0} 枚</span>
          </div>

          <PlayerMat
            side="opp"
            state={gameState}
            resolveCard={resolveCard}
            resolveCase={resolveCase}
            candidateUids={replayReadOnly ? EMPTY_UID_SET : candidateUidsOpp}
            onUnitClick={replayReadOnly ? undefined : (uid) => pickAndConfirm(uid)}
            isCaseCandidate={replayReadOnly ? false : isOppCaseCandidate}
            onCaseClick={replayReadOnly ? undefined : () => pickAndConfirm(ACTION_CASE_TARGET_OPP)}
            onAreaClick={replayReadOnly || terminal ? undefined : handleAreaClick}
            onExpand={replayReadOnly || terminal ? undefined : openCardExpand}
            onSetInspect={replayReadOnly || terminal ? undefined : inspectSetCards}
            pickCharUids={replayReadOnly ? EMPTY_UID_SET : oppScenePickUids}
            onPickChar={replayReadOnly ? undefined : oppOnPickChar}
            activeCardUid={activeCardUid}
            activeCardLabel={activeCardLabel}
          />

          {/* KEEP OUT divider removed — Phase 7.5 layout pivot per user feedback */}

          <PlayerMat
            side="self"
            state={gameState}
            resolveCard={resolveCard}
            resolveCase={resolveCase}
            candidateUids={replayReadOnly ? EMPTY_UID_SET : candidateUidsSelf}
            onUnitClick={replayReadOnly ? undefined : (uid) => pickAndConfirm(uid)}
            isPartnerCandidate={replayReadOnly ? false : isSelfPartnerCandidate}
            onPartnerClick={replayReadOnly ? undefined : () => pickAndConfirm('partner:self')}
            // M3 PA batch (rules/18): PA 常駐 MR が宣言能力 source 候補のとき黄色強調 + クリック選択
            isPartnerMRCandidate={replayReadOnly ? false : isSelfPartnerMRCandidate}
            onPartnerMRClick={replayReadOnly ? undefined : () => pickAndConfirm(selfPartnerMRCandidateUid ?? 'partnerMR:self')}
            // 2026-05-30: 宣言能力 source として自分の事件が候補のとき黄色強調 + クリックで選択
            isCaseCandidate={replayReadOnly ? false : isSelfCaseCandidate}
            onCaseClick={replayReadOnly ? undefined : () => pickAndConfirm('case:self')}
            onAreaClick={replayReadOnly || terminal ? undefined : handleAreaClick}
            onExpand={replayReadOnly || terminal ? undefined : openCardExpand}
            onSetInspect={replayReadOnly || terminal ? undefined : inspectSetCards}
            pickCharUids={replayReadOnly ? EMPTY_UID_SET : selfScenePickUids}
            onPickChar={replayReadOnly ? undefined : selfOnPickChar}
            autoFocusPickUid={replayReadOnly ? undefined : switchPicker?.candidates[0]?.uid}
            // 2026-05-30: ネクストヒント中は FILE 表示を引いた後の枚数 (-1) にして誤解を防ぐ
            nextHintDrawPreview={replayReadOnly ? false : isNextHintPick}
            activeCardUid={activeCardUid}
            activeCardLabel={activeCardLabel}
          />
        </div>

        {/* HandZone (Task 7.11) — Phase 8.6: onCardClick → runHandUseFlow
            Round 2: collapsed/expanded 両方で disabled 状態を可視化 + tooltip で理由表示。
            ユーザ指摘「コスト 8 のカードが出てる」(FILE 不足で使えないのに見た目が同じ) を解消。 */}
        {replayReadOnly ? (
          <ReplayHandStrip
            cards={handCards}
            count={gameState?.players.self.hand.length ?? 0}
            revealCards={replayMayRevealSelfHand}
          />
        ) : <HandZone
          cards={isNextHintPick ? handCardsForZone : handCards}
          expanded={handExpanded}
          onExpand={terminal ? undefined : openHand}
          onCollapse={isDiscardPick || isNextHintPick || isCutinPick || isHandSceneEnterPick ? undefined : () => setHandExpanded(false)}
          onCardClick={replayReadOnly ? undefined : handleHandUse}
          onCardExpand={terminal ? undefined : openCardExpand}
          canUse={handCanUse}
          disabledReason={handDisabledReason}
          pickMode={handPickMode}
          // cutin / ネクストヒント / discard を HandZone pick mode で流用 (黄色枠 pickableCardIds)。
          // cutin: 候補 cardId を黄色枠化、click で cutin / skip で パス。
          pickableCardIds={handPickableCardIds}
          pickPlayer="self"
          pickableCardUids={handPickableCardUids}
          pickHideBanner={isNextHintPick}
          pickBannerText={
            isCutinPick
              ? cutinBannerText
              : isHandSceneEnterPick
              ? pendingPickForArea?.candidates.length === 0
                ? '登場できる対象はありません（「登場しない」を選択）'
                : '手札から条件を満たすキャラを1枚まで登場させてください'
              : isNextHintPick
              ? `使うカードを選択（黄枠 / レベル${nextHintPick!.postPopCount}以下）`
              : undefined
          }
          pickSkipLabel={isCutinPick ? 'パス' : isHandSceneEnterPick ? '登場しない' : isNextHintPick ? '使用しない' : undefined}
          onPickCancel={isNextHintPick ? () => useNextHintPicker().acceptCancel() : undefined}
          pickCancelLabel={isNextHintPick ? 'キャンセル' : undefined}
          onPickCard={handleHandPickCard}
          pickCanSkip={handPickCanSkip}
          onPickSkip={handleHandPickSkip}
          // BUG-165 UI 側 (wave-10 2026-07-02): nMax>1 の discard pick (B04005/B07002
          // 「手札を2枚リムーブする」) は multi-select で収集し pickedUids を dispatch。
          // 旧実装は単発 pickedUid 即 dispatch → engine 側 (旧 collapse) と合わせ 1枚しか
          // リムーブされなかった。nMax<=1 は onPickCard 経路 byte 不変 (HandZone 側で gate)。
          pickNMin={isDiscardPick ? pendingPickForArea?.nMin : undefined}
          pickNMax={isDiscardPick ? pendingPickForArea?.nMax : undefined}
          onPickMulti={handleHandPickMulti}
        />}

        {/* ActionsPanel (Phase 8.5 で endTurn 配線開始、他は 8.6+) */}
        {!replayReadOnly && <ActionsPanel {...actionPanelProps} />}
        </div>
        {/* /board-content (BUG-150): 以降の modal/overlay は非 zoom で viewport 基準を保つ */}

        {/* ConfirmModal — useConfirmation の state を全画面オーバーレイで描画 */}
        {!replayReadOnly && !terminal && (
          <>
            <PlaymatConfirmModal />

        {/* Phase 8 完全クローズ Commit 2: コンタクトフロー用モーダル */}
            <PlaymatGuardPickerModal />
            <PlaymatCutInDisguisePickerModal />

        {/* Phase 8 完全クローズ Commit 3a: ヒラメキモーダル */}
            <PlaymatHiramekiPickerModal />

        {/* 2026-05-28: ネクストヒント step2 picker は HandZone pick mode に統合 (別 modal 廃止) */}

        {/* Phase 5 advance UI: ミスリードモーダル (相手推理時、自分の現場 misread 持ち候補から複数選択) */}
            <PlaymatMisreadPickerModal />

        {/* rules/20 §スイッチ: switch victim 選択は現場直接クリック (selfScenePickUids/handleSwitchVictim) +
            下部の switch-victim overlay に統合 (旧 SceneSwitchPickerModal は撤去) */}

        {/* BUG-108: 複数 option choice effect (D11012 a1 LP＋1/AP＋2000) の択一 modal */}
            <PlaymatChoicePickerModal />

        {/* CARD PHASE step12 batch2: declareName atom (「カード名を1つ指定し」B09108/B09003/PR105) の
            宣言名入力 modal (runDeclaredAbilityFlow 3.8 が ask() した間だけ open) */}
            <PlaymatDeclareNameModal />

        {/* BUG-085: 宣言能力コスト〚裏向きの証拠を表向きにする〛の証拠選択 picker
            (証拠エリア拡大表示 CardListModal を pick mode で流用) */}
            <PlaymatEvidenceFlipPickerModal />
            <PlaymatHandCostPickerModal />
            <PlaymatStackedCardCostPickerModal />

        {/* Phase 8.5: narrator-msg と log-btn は ActionsPanel に集約。
            LogPanel は open=true のときのみオーバーレイで描画。 */}
            <LogPanel
              entries={gameState?.log ?? []}
              open={logOpen}
              onClose={() => setLogOpen(false)}
              gameState={gameState}
              onCardExpand={openCardExpand}
            />
          </>
        )}

        {/* Round 2: FILE/証拠/リムーブ クリック → 内容確認モーダル
            証拠 / FILE は engine 上裏向きなので faceDownCount で枚数のみ表示。
            リムーブは表向きなので cards (cardId[]) で実カード表示。 */}
        {!replayReadOnly && !terminal && areaModal && gameState && pendingDeckReorder === null && (() => {
          const player = gameState.players[areaModal.side];
          // Round 3: FILE 内アシスト中パートナーのみ表向き表示 (ユーザ指示)
          //   - file の中身を 「assisted-partner cards (表向き)」 と 「card-back count (裏向き)」 に分割
          //   - リムーブは全カード表向き / 証拠 は全カード裏向き
          let cards: string[] = [];
          let faceDownCount = 0;
          // BUG-085: 証拠は faceUp が混在し得る。表向きは公開表示する。
          let faceUpEvidence: { index: number; cardId: string; faceState?: '表向き' | '裏向き' }[] | undefined;
          if (areaModal.kind === 'set') {
            const host = player.scene.find((character) => character.uid === areaModal.hostUid);
            const setCards = host?.setCards ?? [];
            faceDownCount = setCards.length;
            faceUpEvidence = setCards
              .map((entry, index) => (entry.faceUp
                ? { index, cardId: entry.cardId, faceState: '表向き' as const }
                : null))
              .filter((entry): entry is { index: number; cardId: string; faceState: '表向き' } => entry !== null);
          } else if (areaModal.kind === 'selection') {
            cards = declaredSourcePick.length > 0
              ? declaredSourcePick.map((candidate) => candidate.cardId)
              : (pendingPickForArea?.candidates ?? []).map((candidate) => candidate.cardId) as string[];
          } else if (areaModal.kind === 'remove') {
            cards = player.remove as string[];
          } else if (areaModal.kind === 'partner-area') {
            // engine wave A1 (G39): PA 一般カード枠 (全カード表向き、リムーブ同様)
            cards = (player.partnerAreaCards ?? []) as string[];
          } else if (areaModal.kind === 'deck') {
            // deckRevealUntil は候補だけでなく、公開 window 全体を同じ一覧で表示する。
            // 後続 sceneEnter(area=deck) は従来どおり candidates が window そのもの。
            cards = pendingPickForArea?.atomVerb === 'deckRevealUntil'
              ? [...(pendingDeckReveal?.revealed ?? [])]
              : (pendingPickForArea?.candidates ?? []).map((c) => c.cardId) as string[];
          } else if (areaModal.kind === 'file') {
            const publicFileCards: string[] = [];
            let backCount = 0;
            for (const f of player.file) {
              if (f.type === 'assisted-partner' || (f.type === 'card-back' && f.faceUp === true)) {
                publicFileCards.push(f.cardId);
              } else {
                backCount += 1;
              }
            }
            cards = publicFileCards;
            faceDownCount = backCount;
          } else {
            // evidence: faceDownCount は全証拠枚数 (cell idx = 証拠配列 index で整合)。
            // faceUp の証拠は公開カードとして描画する (faceUpEvidence)。
            faceDownCount = player.evidence?.length ?? 0;
            faceUpEvidence = (player.evidence ?? [])
              .map((e, index) => (e.faceUp ? { index, cardId: e.cardId } : null))
              .filter((e): e is { index: number; cardId: string } => e !== null);
          }
          // User vision: pending pick が当該 area なら pick mode で開く
          const isPickModeForThisArea =
            (declaredSourcePick.length > 0 && areaModal.kind === 'selection' && areaModal.origin === 'pick') ||
            (pendingPickForArea?.player === 'self' &&
            ((pendingPickForArea.atomVerb === 'evidenceToHand' && areaModal.kind === 'evidence') ||
              (pendingPickForArea.atomVerb === 'handAddFromRemove' && areaModal.kind === pickAreaKind) ||
              (pendingPickForArea.atomVerb === 'deckRevealUntil' && areaModal.kind === 'deck') ||
              // D11014 a2 / D08024 driver 2026-05-26: sceneEnter は target.query.area で
              // pickAreaKind が決まる (remove / evidence / file)。area kind を一致確認。
              (pendingPickForArea.atomVerb === 'sceneEnter' && areaModal.kind === pickAreaKind) ||
              // D08021 driver 2026-05-26: charStackCard multi-pick (0-5 枚) も同パターン
              (pendingPickForArea.atomVerb === 'charStackCard' && areaModal.kind === pickAreaKind) ||
              // engine wave A1 (G39): partnerAreaRemove multi-pick も同パターン (kind='partner-area')
              (pendingPickForArea.atomVerb === 'partnerAreaRemove' && areaModal.kind === 'partner-area')));
          return (
            <CardListModal
              kind={areaModal.kind}
              side={areaModal.side}
              cards={cards}
              faceDownCount={faceDownCount}
              faceUpEvidence={faceUpEvidence}
              onClose={() => {
                if (areaModal.kind === 'selection' && areaModal.origin === 'pick' &&
                  pickerPhase.phase !== 'idle' && pickerPhase.purpose === 'declared-ability:source' &&
                  declaredSourcePick.length > 0) {
                  cancelTarget();
                  return;
                }
                closeAreaModal();
              }}
              onExpand={openCardExpand}
              pickCands={isPickModeForThisArea
                ? (declaredSourcePick.length > 0 ? declaredSourcePick : pendingPickForArea!.candidates)
                : undefined}
              pickCandidateUids={
                isPickModeForThisArea && areaModal.kind === 'selection'
                  ? (declaredSourcePick.length > 0
                      ? declaredSourcePick.map((candidate) => candidate.uid)
                      : pendingPickForArea!.candidates.map((candidate) => candidate.uid))
                  : undefined
              }
              pickSessionKey={isPickModeForThisArea ? (declaredSourcePick.length > 0 ? pickerPhase : pendingPickForArea) : undefined}
              pickBannerText={
                isPickModeForThisArea && pendingPickForArea?.atomVerb === 'deckRevealUntil'
                  ? pendingPickForArea.candidates.length === 0
                    ? '公開した3枚に対象カードはありません（「選ばない」を選択）'
                    : '公開されたカードをすべて確認し、黄色枠の対象を1枚まで選んでください'
                  : isPickModeForThisArea && pendingPickForArea?.atomVerb === 'sceneEnter'
                  ? (areaModal.kind === 'deck'
                      // S2 B01022: deck-window 用文言 (公開カードから登場。「〜まで」= 0枚可 rules/15)
                      ? `公開されたカードから${(pendingPickForArea.nMax ?? 1) > 1 ? `${pendingPickForArea.nMax}枚まで` : '1枚'}選んで現場に登場させてください`
                      : (pendingPickForArea.nMax ?? 1) > 1
                      ? `リムーブから${pendingPickForArea.nMax}枚まで選んで現場に登場させてください`
                      : 'リムーブから1枚選んで現場に登場させてください')
                  : isPickModeForThisArea && pendingPickForArea?.atomVerb === 'charStackCard'
                  ? `リムーブから${pendingPickForArea.nMax}枚まで選んでこのキャラの下に重ねてください`
                  : isPickModeForThisArea && pendingPickForArea?.atomVerb === 'partnerAreaRemove'
                  ? `パートナーエリアから${pendingPickForArea.nMax}枚選んでリムーブしてください`
                  : undefined
              }
              onPick={isPickModeForThisArea ? (uid) => {
                if (declaredSourcePick.some((candidate) => candidate.uid === uid)) {
                  pickAndConfirm(uid);
                  return;
                }
                void resolveSceneEnterPick(uid);
              } : undefined}
              pickCanSkip={isPickModeForThisArea && (pendingPickForArea?.nMin ?? 1) === 0 && scenePickForced.length === 0}
              pickForcedUids={isPickModeForThisArea ? pendingPickForArea?.forcedUids : undefined}
              onPickSkip={isPickModeForThisArea ? () => {
                if (pendingPickForArea) {
                  dispatchEngineAction(bindPendingDecision(
                    pendingPickForArea,
                    { type: 'effectPickResolve', pickedUid: null },
                  ));
                }
              } : undefined}
              pickNMin={isPickModeForThisArea ? pendingPickForArea?.nMin : undefined}
              pickNMax={isPickModeForThisArea ? pendingPickForArea?.nMax : undefined}
              onPickMulti={isPickModeForThisArea ? async (uids) => {
                const pendE = pendingPickForArea;
                if (!pendE) return;
                const stE = useGameStateStore.getState();
                const currentPending = stE.pendingEffectPick;
                const isCurrent = pendE.decisionId === undefined
                  ? currentPending === pendE
                  : currentPending?.decisionId === pendE.decisionId;
                if (!isCurrent) return;
                // Phase 2c union 化: 0 枚選択は skip 形態 (pickedUid:null 単独) で dispatch
                // (旧実装でも pickedUid null 時は pickedUids が無視され skip 経路だった — 挙動同一)
                const first = uids[0];
                if (first === undefined) {
                  dispatchEngineAction(bindPendingDecision(
                    pendE,
                    { type: 'effectPickResolve', pickedUid: null },
                  ));
                  return;
                }
                // cluster14: multi-card sceneEnter (B09010「2枚まで登場」) が現場満杯を超える場合、
                //   overflow 枚数 (= 登場枚数 − room) ぶん退場キャラを SceneSwitchPickerModal で収集する (rules/20 スイッチ)。
                //   charStackCard 等 他 multi-pick verb は従来通り即 dispatch (sceneEnter 以外は分岐しない)。
                const gsE = stE.gameState;
                if (pendE.atomVerb === 'sceneEnter' && gsE) {
                  const room = sceneCap(gsE, pendE.player) - gsE.players[pendE.player].scene.length; // engine E3 P11: 現場登場上限 (case override 可)

                  const overflow = Math.max(0, uids.length - room);
                  if (overflow > 0) {
                    // area modal を閉じ・auto-open を抑止して self 現場を直接クリックさせる (設計 v2 flicker gate)
                    setAreaModal(null);
                    setSwitchSessionActive(true);
                    const interactionEpoch = currentInteractionEpoch();
                    const victims: string[] = [];
                    for (let i = 0; i < overflow; i++) {
                      const sceneChars = gsE.players[pendE.player].scene
                        .filter((c) => !victims.includes(c.uid))
                        .map((c) => ({ uid: c.uid, cardId: c.cardId, name: readDef.card(c.cardId)?.names?.[0] ?? c.cardId, state: c.state, isNamed: c.isNamed }));
                      const v = await new Promise<string | null>((resolve) => {
                        useSceneSwitchPickerStore.getState()._open({
                          cardId: '', newCardName: `登場${uids.length}枚 — 退場 ${i + 1}/${overflow}`, candidates: sceneChars, resolve,
                        });
                      });
                      if (!isCurrentLiveInteraction(interactionEpoch)) {
                        setSwitchSessionActive(false);
                        return;
                      }
                      if (v === null) {
                        // cancel = 全辞退。B09010 は skipResolvesAtom により後続 FILE上1リムーブは解決される。
                        setSwitchSessionActive(false);
                        dispatchEngineAction(bindPendingDecision(
                          pendE,
                          { type: 'effectPickResolve', pickedUid: null },
                        ));
                        return;
                      }
                      victims.push(v);
                    }
                    setSwitchSessionActive(false);
                    dispatchEngineAction(bindPendingDecision(
                      pendE,
                      { type: 'effectPickResolve', pickedUid: first, pickedUids: uids, switchRemoveUids: victims },
                    ));
                    return;
                  }
                }
                dispatchEngineAction(bindPendingDecision(
                  pendE,
                  { type: 'effectPickResolve', pickedUid: first, pickedUids: uids },
                ));
              } : undefined}
              pickDistinctNames={isPickModeForThisArea ? (pendingPickForArea as { distinctNames?: boolean } | undefined)?.distinctNames : undefined}
              pickComponents={isPickModeForThisArea && (pendingPickForArea as { distinctNames?: boolean } | undefined)?.distinctNames
                ? Object.fromEntries(
                    (pendingPickForArea?.candidates ?? []).map((c) => {
                      const d = readDef.card(c.cardId);
                      return [c.uid, d ? allCardNameComponentsForDef(d, c.kind === 'card' ? c.area : undefined) : [c.cardId]];
                    })
                  )
                : undefined}
              pickDistinctLevel={isPickModeForThisArea ? (pendingPickForArea as { distinctLevel?: boolean } | undefined)?.distinctLevel : undefined}
              pickLevels={isPickModeForThisArea && (pendingPickForArea as { distinctLevel?: boolean } | undefined)?.distinctLevel
                ? Object.fromEntries(
                    (pendingPickForArea?.candidates ?? []).map((c) => {
                      const d = readDef.card(c.cardId);
                      return [c.uid, d?.level];
                    })
                  )
                : undefined}
              pickDistinctColors={isPickModeForThisArea ? (pendingPickForArea as { distinctColors?: boolean } | undefined)?.distinctColors : undefined}
              pickColors={isPickModeForThisArea && (pendingPickForArea as { distinctColors?: boolean } | undefined)?.distinctColors
                ? Object.fromEntries((pendingPickForArea?.candidates ?? []).map((c) => [c.uid, readDef.card(c.cardId)?.colors ?? []]))
                : undefined}
            />
          );
        })()}
        {/* Round 4l (BUG-001): カード拡大表示 modal */}
        {!replayReadOnly && !terminal && <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />}
        {/* User vision (拡張 5 chain): SceneArea pick mode で skip 可能 (max:N) の場合
            scene キャラを click せず「リムーブしない」できるよう overlay ボタン表示 */}
        {!replayReadOnly && isScenePick && (
          <div className="scene-pick-skip-overlay" role="status">
            {/* banner は verb 別 (画面処理=カードテキスト文言、設計 v2)。新規5verb は全て nMin=0 → 常時表示 */}
            <span className="scene-pick-skip-banner">
              {sceneVerbBanner(pendingPickForArea?.atomVerb)}
            </span>
            {(pendingPickForArea?.nMin ?? 1) === 0 && scenePickForced.length === 0 && (
              <button
                type="button"
                className="scene-pick-skip-btn"
                onClick={() => {
                  if (pendingPickForArea) {
                    dispatchEngineAction(bindPendingDecision(
                      pendingPickForArea,
                      { type: 'effectPickResolve', pickedUid: null },
                    ));
                  }
                }}
                data-testid="scene-pick-skip"
              >
                選ばない
              </button>
            )}
          </div>
        )}
        {/* rules/20 §スイッチ: switch victim 選択 overlay (self 現場直接クリック + 辞退キャンセル、設計 v2 Part C) */}
        {!replayReadOnly && switchActive && (
          <div className="scene-pick-skip-overlay" role="status" data-testid="switch-victim-overlay">
            <span className="scene-pick-skip-banner">
              {`${switchPicker?.newCardName ?? ''} — 退場キャラを現場から選んでください`}
            </span>
            <button
              type="button"
              className="scene-pick-skip-btn switch-victim-cancel"
              onClick={handleSwitchCancel}
              disabled={switchVictimBlocked}
              data-testid="switch-victim-cancel"
            >
              キャンセル
            </button>
          </div>
        )}
      </div>
      {!replayReadOnly && (
        <EffectStackPanel
          entries={effectOrderEntries}
          open={effectOrderEntries.length >= 2}
          reorderPlayer="self"
          onReorder={(entryId, order) => { dispatchEngineAction({ type: 'setEffectOrder', entryId, order, player: 'self' }); }}
          onConfirmOrder={(entryIds) => { dispatchEngineAction({ type: 'resolveEffectOrder', entryIds, player: 'self' }); }}
        />
      )}
    </div>
  );
}

/**
 * Playmat 内部の ConfirmModal ラッパ。
 * useConfirmation store を subscribe して controlled な ConfirmModal に渡す。
 * ConfirmModal 本体は presentation のみ (SSR/test 容易性のため)。
 */
function PlaymatConfirmModal(): JSX.Element | null {
  const current = useConfirmationStore((s) => s.current);
  const { accept, reject } = useConfirmation();
  return <ConfirmModal current={current} onAccept={accept} onReject={reject} />;
}

/**
 * Phase 8 完全クローズ Commit 2: GuardPickerModal ラッパ。
 * useContactModalStore.guardPicker を subscribe し、選択でガード dispatch。
 */
function PlaymatGuardPickerModal(): JSX.Element | null {
  const current = useContactModalStore((s) => s.guardPicker);
  if (!current) return <GuardPickerModal open={false} candidates={[]} onPick={() => {}} onSkip={() => {}} />;
  const close = () => useContactModalStore.getState()._setGuardPicker(null);
  return (
    <GuardPickerModal
      open={true}
      candidates={current.candidates}
      attackerName={current.attackerName}
      mustGuard={current.mustGuard}
      onPick={(uid) => {
        close();
        dispatchEngineAction({ type: 'actionGuard', actionId: current.actionId, guarderUid: uid });
      }}
      onSkip={() => {
        close();
        dispatchEngineAction({ type: 'actionGuard', actionId: current.actionId, guarderUid: null });
      }}
    />
  );
}

/**
 * Phase 8 完全クローズ Commit 3a: HiramekiPickerModal ラッパ。
 * useGameStateStore.pendingHirameki を subscribe し、self owner のとき open。
 * fire/skip で hiramekiResolve dispatch + クリア。
 */
function PlaymatHiramekiPickerModal(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingHirameki);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  const switchPicker = useSceneSwitchPickerStore((s) => s.current);
  const humanPlayer = getHumanDecisionSide(spectatorMode);
  if (!pending || pending.player !== humanPlayer) {
    return (
      <HiramekiPickerModal
        open={false}
        cardId={undefined}
        cardName=""
        abilityText=""
        onFire={() => {}}
        onSkip={() => {}}
      />
    );
  }
  const fire = async (): Promise<void> => {
    const store = useGameStateStore.getState();
    const currentPending = store.pendingHirameki;
    const state = store.gameState;
    const isCurrent = pending.decisionId === undefined
      ? currentPending === pending
      : currentPending?.decisionId === pending.decisionId;
    if (!state || !currentPending || !isCurrent) return;

    const requirement = engineFlow.actionCase.readHiramekiSceneSwitchRequirement(state, currentPending);
    if (!requirement) {
      dispatchEngineAction(bindPendingDecision(
        currentPending,
        { type: 'hiramekiResolve', choice: 'fire' },
      ));
      return;
    }

    const interactionEpoch = currentInteractionEpoch();
    const removeUid = await new Promise<string | null>((resolve) => {
      useSceneSwitchPickerStore.getState()._open({
        cardId: requirement.cardId,
        newCardName: readDef.card(requirement.cardId)?.names?.[0] ?? requirement.cardId,
        candidates: requirement.candidates.map(card => ({
          uid: card.uid,
          cardId: card.cardId,
          name: readDef.card(card.cardId)?.names?.[0] ?? card.cardId,
          state: card.state,
          isNamed: card.isNamed,
        })),
        resolve,
      });
    });
    if (!isCurrentLiveInteraction(interactionEpoch) || removeUid === null) return;

    const latestPending = useGameStateStore.getState().pendingHirameki;
    const isStillCurrent = currentPending.decisionId === undefined
      ? latestPending === currentPending
      : latestPending?.decisionId === currentPending.decisionId;
    if (!latestPending || !isStillCurrent) return;
    dispatchEngineAction(bindPendingDecision(
      latestPending,
      { type: 'hiramekiResolve', choice: 'fire', switchRemoveUid: removeUid },
    ));
  };
  const def = readDef.card(pending.cardId);
  const cardName = def?.names?.[0] ?? pending.cardId;
  const ability = def?.abilities.find(
    (a: unknown) => a !== null && typeof a === 'object' && (a as { id?: string }).id === pending.abilityId,
  ) as { description?: string } | undefined;
  const abilityText = ability?.description ?? 'ヒラメキ能力';
  return (
    <HiramekiPickerModal
      open={switchPicker === null}
      cardId={pending.cardId}
      cardName={cardName}
      abilityText={abilityText}
      onFire={() => { void fire(); }}
      onSkip={() => dispatchEngineAction(bindPendingDecision(
        pending,
        { type: 'hiramekiResolve', choice: 'skip' },
      ))}
    />
  );
}

/**
 * Phase 5 advance UI: MisreadPickerModal ラッパ。
 * useGameStateStore.pendingMisread を subscribe し、reasoningPlayer==='opp' (相手推理 / 自分 defender) のとき open。
 * confirm/skip で misreadResolve dispatch + クリア。
 * - reasoningPlayer==='self' (自分推理 / AI defender) は useMisreadFlowDriver が自動解決するため open しない。
 */
function PlaymatMisreadPickerModal(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingMisread);
  const gameState = useGameStateStore((s) => s.gameState);
  const spectatorMode = useGameStateStore((s) => s.spectatorMode);
  const humanPlayer = getHumanDecisionSide(spectatorMode);
  if (!pending || pending.player !== humanPlayer || !gameState) {
    return (
      <MisreadPickerModal
        open={false}
        decisionKey=""
        reasoningName=""
        reasoningLp={0}
        candidates={[]}
        onConfirm={() => {}}
        onSkip={() => {}}
      />
    );
  }
  // 推理側 (= 相手 = 'opp') の表示名と LP
  const reasoningCardId = pending.reasoningUid.startsWith('partner:')
    ? gameState.players[pending.reasoningPlayer].partner.cardId
    : gameState.players[pending.reasoningPlayer].scene.find((c) => c.uid === pending.reasoningUid)?.cardId;
  const reasoningDef = reasoningCardId ? readDef.card(reasoningCardId) : null;
  const reasoningName = reasoningDef?.names?.[0] ?? '相手キャラ';
  const reasoningLp = readChar.lp(gameState, pending.reasoningUid);
  // candidates を MisreadCandidateView 形式に展開
  const candidateViews: MisreadCandidateView[] = pending.candidates.map((c) => {
    const sceneChar = gameState.players[pending.player].scene.find((sc) => sc.uid === c.uid);
    const cardName = sceneChar
      ? (readDef.card(sceneChar.cardId)?.names?.[0] ?? sceneChar.cardId)
      : c.uid;
    return { uid: c.uid, cardId: sceneChar?.cardId, cardName, x: c.x };
  });
  return (
    <MisreadPickerModal
      open={true}
      decisionKey={`${pending.decisionId ?? 'legacy'}:${pending.player}:${pending.reasoningPlayer}:${pending.reasoningUid}:${pending.candidates.map((c) => `${c.uid}/${c.x}`).join(',')}`}
      reasoningName={reasoningName}
      reasoningLp={reasoningLp}
      candidates={candidateViews}
      onConfirm={(picks) => {
        dispatchEngineAction(bindPendingDecision(pending, { type: 'misreadResolve', picks }));
      }}
      onSkip={() => {
        dispatchEngineAction(bindPendingDecision(pending, { type: 'misreadResolve', picks: [] }));
      }}
    />
  );
}

/**
 * Phase 8 完全クローズ Commit 2: CutInDisguisePickerModal ラッパ。
 * useContactModalStore.cutInDisguise を subscribe し、選択で actionContact + actionAdvance dispatch。
 */
function PlaymatCutInDisguisePickerModal(): JSX.Element | null {
  const current = useContactModalStore((s) => s.cutInDisguise);
  const gameState = useGameStateStore((s) => s.gameState);
  // 変装候補があるときだけ modal を出す。cutin のみ (MVP は常にこちら) は Playmat の
  // HandZone pick mode (黄色枠) で処理するため modal は閉じたまま。
  const hasDisguise = (current?.candidates ?? []).some((c) => c.kind === 'disguise');
  if (!current || !hasDisguise) {
    return (
      <CutInDisguisePickerModal
        open={false}
        actorLabel="1番目"
        candidates={[]}
        onPickCutIn={() => {}}
        onPickDisguise={() => {}}
        onPass={() => {}}
      />
    );
  }
  const close = () => useContactModalStore.getState()._setCutInDisguise(null);
  const dispatchAdvance = () =>
    dispatchEngineAction({ type: 'actionAdvance', actionId: current.actionId });
  const handCards = (gameState?.players[current.player].hand ?? []).map((cardId, index) => ({
    uid: cardOccurrenceUid(current.player, 'hand', cardId, index),
    cardId,
    name: readDef.card(cardId)?.names?.[0] ?? cardId,
  }));
  return (
    <CutInDisguisePickerModal
      open={true}
      actorLabel={current.actorLabel}
      actorName={current.actorName}
      candidates={current.candidates}
      handCards={handCards}
      onPickCutIn={(cardId) => {
        close();
        dispatchEngineAction({
          type: 'actionContact',
          actionId: current.actionId,
          player: current.player,
          choice: { kind: 'cutin', cardId },
        });
        dispatchAdvance();
      }}
      onPickDisguise={(cardId) => {
        close();
        dispatchEngineAction({
          type: 'actionContact',
          actionId: current.actionId,
          player: current.player,
          choice: { kind: 'disguise', cardId },
        });
        dispatchAdvance();
      }}
      onPass={() => {
        close();
        dispatchEngineAction({
          type: 'actionContact',
          actionId: current.actionId,
          player: current.player,
          choice: { kind: 'pass' },
        });
        dispatchAdvance();
      }}
    />
  );
}

/**
 * BUG-108: ChoicePickerModal ラッパ。useChoicePickerStore.current を subscribe し、
 * runDeclaredAbilityFlow が ask() した間だけ複数 option の択一モーダルを開く。
 * option クリック → choose(index) で Promise resolve → ctx.dyn.choiceIndex に積まれる。
 */
function PlaymatChoicePickerModal(): JSX.Element {
  const current = useChoicePickerStore((s) => s.current);
  const picker = useChoicePicker();
  return (
    <ChoicePickerModal
      open={!!current}
      sourceName={current?.sourceName ?? ''}
      options={current?.options ?? []}
      onPick={(index) => picker.choose(index)}
      onCancel={() => picker.cancel()}
    />
  );
}

/**
 * CARD PHASE step12 batch2 (2026-07-04): DeclareCardNameModal ラッパ。
 * useDeclareNamePickerStore.current を subscribe し、runDeclaredAbilityFlow (3.8) が ask() した
 * 間だけ宣言名入力モーダルを開く。確定名 → costParams.declaredName → ctx.dyn.declaredName →
 * atomDeclareName (engine W6 step1 配線)。
 * - 「してもよい」句 (optional) のみ skip (指定しない) を表示 — skip = declaredName 未供給 =
 *   engine 空文字 fallback の decline 経路。
 * - 必須句 (「〜する」) では skip 無し。取り消しは confirm 済フローの中断になるため
 *   modal 上では提供しない (× 相当なし、DeclareCardNameModal は確定/任意 skip のみ)。
 */
function PlaymatDeclareNameModal(): JSX.Element | null {
  const current = useDeclareNamePickerStore((s) => s.current);
  const picker = useDeclareNamePicker();
  if (!current) return null;
  return (
    <DeclareCardNameModal
      open
      prompt={current.prompt}
      candidateNames={current.candidateNames}
      {...(current.domain ? { domain: current.domain } : {})}
      onConfirm={(name) => picker.declare(name)}
      onCancel={() => picker.cancel()}
      {...(current.optional ? { onSkip: () => picker.skip() } : {})}
    />
  );
}

/**
 * BUG-085: 宣言能力コスト〚裏向きの証拠を1つ以上表向きにする〛の証拠選択モーダル。
 * useEvidenceFlipPickerStore.current を subscribe し、runDeclaredAbilityFlow が
 * ask() した間だけ、証拠エリアの拡大表示 (CardListModal) を pick mode で開く。
 *
 * - 全証拠を裏向きセルとして表示し、候補 (裏向きのみ) の cell を click 可能化。
 * - nMax=1 (D08005): single-pick (1 クリックで確定) / nMax=Infinity (D08026/D11021):
 *   multi-select (toggle → 「完了」ボタンで確定)。
 * - × / 背景クリック → cancel (能力使用を取り消し、state 不変)。
 *
 * faceDownCount は「全証拠枚数」を渡す必要がある (cell index = evidence 配列 index で
 * 候補 uid `evidence:<side>:<idx>` と整合させるため)。表向き証拠が混在する場合、その
 * cell は候補に含まれず click 不可で表示される。
 */
function PlaymatEvidenceFlipPickerModal(): JSX.Element | null {
  const expandModal = useCardExpandModal();
  const current = useEvidenceFlipPickerStore((s) => s.current);
  const evidence = useGameStateStore((s) =>
    s.gameState && current ? s.gameState.players[current.side].evidence : null,
  );
  if (!current) return null;
  const evidenceLen = evidence?.length ?? 0;
  // BUG-085: 既に表向きの証拠は公開表示 (picker 中も非公開のまま隠さない)。候補は裏向きのみ。
  const faceUpEvidence = (evidence ?? [])
    .map((e, index) => (e.faceUp ? { index, cardId: e.cardId } : null))
    .filter((e): e is { index: number; cardId: string } => e !== null);

  const parseIdx = (uid: string): number | null => {
    const m = uid.match(/^evidence:(?:self|opp):(\d+)$/);
    return m ? parseInt(m[1]!, 10) : null;
  };
  const pickCands = current.candidates.map((c) => ({
    uid: `evidence:${current.side}:${c.index}`,
    cardId: c.cardId,
    player: current.side,
  }));
  const rangeLabel = Number.isFinite(current.nMax)
    ? current.nMin === current.nMax
      ? `${current.nMin} 枚`
      : `${current.nMin}〜${current.nMax} 枚`
    : `${current.nMin} 枚以上`;

  return (
    <>
    <CardListModal
      kind="evidence"
      side={current.side}
      cards={[]}
      faceDownCount={evidenceLen}
      faceUpEvidence={faceUpEvidence}
      onClose={() => useEvidenceFlipPicker().cancel()}
      onExpand={expandModal.open}
      pickCands={pickCands}
      pickSessionKey={current}
      pickBannerText={`${current.sourceName}: 表向きにする裏向き証拠を選んでください（${rangeLabel}）`}
      onPick={(uid) => {
        const i = parseIdx(uid);
        if (i !== null) useEvidenceFlipPicker().confirm([i]);
      }}
      pickNMin={current.nMin}
      pickNMax={current.nMax}
      onPickMulti={(uids) => {
        const idxs = uids.map(parseIdx).filter((i): i is number => i !== null);
        useEvidenceFlipPicker().confirm(idxs);
      }}
    />
    <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </>
  );
}

function PlaymatHandCostPickerModal(): JSX.Element | null {
  const expandModal = useCardExpandModal();
  const current = useHandCostPickerStore((s) => s.current);
  if (!current) return null;
  const pickCands = current.candidates.map((candidate) => ({
    uid: `hand:${current.side}:${candidate.index}`,
    cardId: candidate.cardId,
    player: current.side,
  }));
  const parseIndex = (uid: string): number | null => {
    const match = new RegExp(`^hand:${current.side}:(\\d+)$`).exec(uid);
    return match ? Number(match[1]) : null;
  };
  return (
    <>
      <CardListModal
        kind="selection"
        side={current.side}
        cards={current.candidates.map((candidate) => candidate.cardId)}
        onClose={() => useHandCostPicker().cancel()}
        onExpand={expandModal.open}
        pickCands={pickCands}
        pickSessionKey={current}
        pickBannerText={`${current.sourceName}: リムーブする手札を${current.n}枚選んでください`}
        onPick={(uid) => {
          const index = parseIndex(uid);
          if (index !== null) useHandCostPicker().confirm([index]);
        }}
        pickNMin={current.n}
        pickNMax={current.n}
        onPickMulti={(uids) => {
          const indices = uids.map(parseIndex).filter((index): index is number => index !== null);
          useHandCostPicker().confirm(indices);
        }}
      />
      <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </>
  );
}

function PlaymatStackedCardCostPickerModal(): JSX.Element | null {
  const current = useStackedCardCostPickerStore((s) => s.current);
  if (!current) return null;
  const sessionKey = current.candidates.map((candidate) => candidate.instanceId).join('\u0000');
  return <PlaymatStackedCardCostPickerDialog key={sessionKey} request={current} />;
}

function PlaymatStackedCardCostPickerDialog({
  request,
}: {
  request: NonNullable<ReturnType<typeof useStackedCardCostPicker>['current']>;
}): JSX.Element {
  const [selected, setSelected] = useState<string[]>([]);
  const dialogRef = useModalFocusTrap({
    active: true,
    onEscape: () => useStackedCardCostPicker().cancel(),
  });
  const canConfirm = selected.length >= request.nMin && selected.length <= request.nMax;

  const select = (instanceId: string): void => {
    setSelected((previous) => previous.includes(instanceId)
      ? previous.filter((id) => id !== instanceId)
      : request.nMax === 1
        ? [instanceId]
        : previous.length < request.nMax ? [...previous, instanceId] : previous);
  };

  return (
    <div
      ref={dialogRef}
      className="cp-overlay"
      role="dialog"
      data-match-modal-registered="true"
      aria-modal="true"
      aria-labelledby="stacked-card-cost-title"
      data-testid="stacked-card-cost-modal"
    >
      <div className="cp-modal">
        <div className="cp-header">
          <h2 id="stacked-card-cost-title">重ねたカード</h2>
          <p className="cp-sub">{`${request.sourceName}: 下のカードを${request.nMin}枚選んでください`}</p>
        </div>
        <div className="cp-body">
          <ul className="cp-list">
            {request.candidates.map((candidate) => (
              <li
                key={candidate.instanceId}
                className={`cp-choice-row${selected.includes(candidate.instanceId) ? ' cp-choice-row--selected' : ''}`}
              >
                <SelectableCardTile
                  cardId=""
                  instanceId={candidate.instanceId}
                  hidden
                  hiddenLabel={`${request.sourceName}の下のカード ${candidate.ordinal}`}
                  selectTestId={`card-list-pick-${candidate.instanceId}`}
                  selected={selected.includes(candidate.instanceId)}
                  onSelect={select}
                />
              </li>
            ))}
          </ul>
        </div>
        <div className="cp-actions">
          <button
            type="button"
            className="cp-btn cp-btn-cancel"
            data-testid="stacked-card-cost-cancel"
            onClick={() => useStackedCardCostPicker().cancel()}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="cp-btn"
            data-testid="card-list-pick-confirm"
            disabled={!canConfirm}
            onClick={() => useStackedCardCostPicker().confirm(selected)}
          >
            {`確定 (${selected.length})`}
          </button>
        </div>
      </div>
    </div>
  );
}

/** picker.purpose を表示用ラベルに変換 (Phase 8.6 reasoning 等)。 */
function labelForPurpose(purpose: string): string {
  switch (purpose) {
    case 'reasoning':       return '推理';
    case 'action':          return 'アクション';
    case 'action:source':   return 'アクション元キャラ';
    case 'action:target':   return 'アクション対象';
    case 'assist':          return 'アシスト';
    case 'solveCase':       return '事件解決';
    case 'partner-ability': return 'パートナー能力';
    case 'declared-ability:source':  return '宣言能力を使うカード';
    case 'declared-ability:ability': return '宣言能力';
    default:                return '対象';
  }
}
