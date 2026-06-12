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

import { useEffect, useState, type JSX } from 'react';
import type { GameState } from '@/engine/types/game-state.js';
import { SceneArea, type ResolvedCardMeta } from './SceneArea.js';
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
import { HandZone, type HandCardMeta } from './HandZone.js';
import { TopBar } from './TopBar.js';
import { ActionsPanel, type ActionItemId } from './ActionsPanel.js';
import { ConfirmModal } from './ConfirmModal.js';
import {
  runEndTurnFlow,
  runReasoningFlow,
  enumReasoningCandidates,
  enumDeclaredAbilitySources,
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
import { useStageScale } from '../hooks/useStageScale.js';
import { useContactModalStore } from '../hooks/useContactModalStore.js';
import { useHiramekiFlowDriver } from '../hooks/useHiramekiFlowDriver.js';
import { useMisreadFlowDriver } from '../hooks/useMisreadFlowDriver.js';
import { MisreadPickerModal, type MisreadCandidateView } from './MisreadPickerModal.js';
import { GuardPickerModal } from './GuardPickerModal.js';
import { CutInDisguisePickerModal } from './CutInDisguisePickerModal.js';
import { HiramekiPickerModal } from './HiramekiPickerModal.js';
import { useNextHintPickerStore, useNextHintPicker } from '@/ui/hooks/useNextHintPicker.js';
import { SceneSwitchPickerModal } from './SceneSwitchPickerModal.js';
import { useSceneSwitchPickerStore } from '../hooks/useSceneSwitchPickerStore.js';
import { ChoicePickerModal } from './ChoicePickerModal.js';
import { useChoicePicker, useChoicePickerStore } from '../hooks/useChoicePicker.js';
import { useEvidenceFlipPickerStore, useEvidenceFlipPicker } from '../hooks/useEvidenceFlipPicker.js';
import { dispatchEngineAction } from '../hooks/useEngineDispatch.js';
import { useGameStateStore } from '../state/store.js';
import { def as readDef } from '@/engine/read/def.js';
import { char as readChar } from '@/engine/read/char.js';
// D08021 driver 2026-05-26: distinctNames 制約 (rules/19) を multi-pick UI で
// 適用するため、name component 計算 helper を import。
import { allCardNameComponentsForDef } from '@/engine/target/card-def-registry.js';
import './Playmat.css';

// engine の `players[side].case.colors` (日本語色名) を CaseInfo.color (英名) に変換
const JP_COLOR_TO_EN: Record<string, CaseColor> = {
  '青': 'blue', '黄': 'yellow', '赤': 'red', '緑': 'green', '紫': 'purple',
};

export type PlaymatProps = {
  gameState: GameState | null;
  resolveCard: (cardId: string) => ResolvedCardMeta;
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
  /** User vision (拡張 4): scene キャラ pick mode (sceneRemove 等の effect 対象選択) */
  pickCharUids?: ReadonlySet<string>;
  onPickChar?: (uid: string) => void;
  /**
   * 2026-05-30 user_request: ネクストヒントのピッカー表示中、FILE 表示枚数を -1 して
   * 「step1 で引いた後」の実効枚数を見せる (self のみ true)。
   */
  nextHintDrawPreview?: boolean;
};

function PlayerMat({
  side, state, resolveCard, resolveCase,
  candidateUids, onUnitClick, isPartnerCandidate, onPartnerClick,
  isCaseCandidate, onCaseClick, onAreaClick, onExpand,
  pickCharUids, onPickChar, nextHintDrawPreview = false,
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
        {/* Round 3: 事件編/解決編 を 事件↔証拠 余白に独立表示 (事件カード上の case-stamp は削除済)
            caseInfo null (ゲーム未開始時) は空 placeholder 表示 */}
        <div className={`case-edition-tag${caseInfo?.status === '解決編' ? ' resolved' : ''}`} aria-label={`事件状態: ${caseInfo?.status ?? '未開始'}`}>
          {caseInfo?.status ?? '未開始'}
        </div>
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
          pickCharUids={pickCharUids}
          onPickChar={onPickChar}
          resolveKeywords={(uid) => (state ? readChar.keywords(state, uid) : [])}
          resolveCharStats={(uid) => (state ? { ap: readChar.ap(state, uid), lp: readChar.lp(state, uid) } : undefined)}
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
            isCandidate={isPartnerCandidate}
            onClick={onPartnerClick}
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

export function Playmat({ gameState, resolveCard, resolveCase, resolveHandCard }: PlaymatProps): JSX.Element {
  // Phase 8.7b: opp ターンを自動進行 (HeuristicPolicy + flow.endTurn で self へ戻す)
  useOppTurnDriver();
  // Round 4l (B5 観戦モード): spectatorMode=true なら self ターンも AI 自動進行
  useSpectatorTurnDriver();
  // Phase 8 完全クローズ Commit 2: contact フロー (declare→ガード→コンタクト→AP判定) 駆動。
  useContactFlowDriver();
  // Phase 8 完全クローズ Commit 3a: ヒラメキ判定駆動 (opp owner なら AI 自動 / self owner はモーダル待ち)。
  useHiramekiFlowDriver();
  // Phase 5 advance UI: Misread driver (reasoningPlayer='self' なら AI 自動解決、'opp' なら modal 待ち)
  useMisreadFlowDriver();
  // Phase 8.5: 手札は default で collapsed (小さいストリップ)、クリックで expanded (実寸 + ×)
  const [handExpanded, setHandExpanded] = useState(false);
  // Round 4l (BUG-001): カード拡大 modal の state
  const expandModal = useCardExpandModal();
  // Phase 8.5: log パネル開閉。ActionsPanel に LOG ボタンを集約、開時は overlay 表示。
  const [logOpen, setLogOpen] = useState(false);
  // Round 2: FILE/証拠/リムーブ クリック → 内容モーダル表示の state。
  const [areaModal, setAreaModal] = useState<{ kind: CardListKind; side: 'self' | 'opp' } | null>(null);
  const handleAreaClick = (kind: CardListKind, side: 'self' | 'opp'): void => {
    setAreaModal({ kind, side });
  };
  const closeAreaModal = (): void => setAreaModal(null);

  // User vision (CardListModal を pick UI として流用 + HandZone も同様):
  // pendingEffectPick.atomVerb に応じて、対応する既存 UI (CardListModal / HandZone 拡大) を
  // 自動 open する。EffectPickerModal は area pick 中は無効化。
  //
  // verb → UI mapping:
  //   evidenceToHand → CardListModal kind='evidence' を auto-open
  //   handAddFromRemove → CardListModal kind='remove' を auto-open
  //   discard → HandZone を auto-expand (pick mode)
  const pendingPickForArea = useGameStateStore((s) => s.pendingEffectPick);
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
    cutInStore.candidates.some((c) => c.kind === 'cutin') &&
    !cutInHasDisguise;
  const cutinPickableIds = isCutinPick
    ? new Set(cutInStore!.candidates.filter((c) => c.kind === 'cutin').map((c) => c.cardId))
    : undefined;
  const cutinBannerText = cutInStore
    ? `カットインするカードを選択（パス可）— ${cutInStore.actorLabel}${cutInStore.actorName ? `（${cutInStore.actorName}）` : ''}`
    : undefined;
  const handleCutinPick = (uid: string): void => {
    const cur = useContactModalStore.getState().cutInDisguise;
    if (!cur) return;
    const cardId = uid.split('#')[0]!;
    useContactModalStore.getState()._setCutInDisguise(null);
    dispatchEngineAction({ type: 'actionContact', actionId: cur.actionId, player: cur.player, choice: { kind: 'cutin', cardId } });
    dispatchEngineAction({ type: 'actionAdvance', actionId: cur.actionId });
  };
  const handleCutinPass = (): void => {
    const cur = useContactModalStore.getState().cutInDisguise;
    if (!cur) return;
    useContactModalStore.getState()._setCutInDisguise(null);
    dispatchEngineAction({ type: 'actionContact', actionId: cur.actionId, player: cur.player, choice: { kind: 'pass' } });
    dispatchEngineAction({ type: 'actionAdvance', actionId: cur.actionId });
  };
  const pickAreaKind: CardListKind | null = (() => {
    if (!pendingPickForArea || pendingPickForArea.player !== 'self') return null;
    if (pendingPickForArea.atomVerb === 'evidenceToHand') return 'evidence';
    if (pendingPickForArea.atomVerb === 'handAddFromRemove') return 'remove';
    // D11014 a2 driver 2026-05-26: sceneEnter (D08024/D11014 reanimate) は area: remove
    // CardListModal pick mode で D08013 evidenceToHand と同 UI を流用
    if (pendingPickForArea.atomVerb === 'sceneEnter') {
      const args = pendingPickForArea.atomArgs as { target?: { query?: { area?: string } } } | undefined;
      const area = args?.target?.query?.area;
      if (area === 'remove') return 'remove';
      if (area === 'evidence') return 'evidence';
      if (area === 'file') return 'file';
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
  useEffect(() => {
    if (pickAreaKind === null) return;
    // すでに対応 area modal が開いていれば noop
    if (areaModal && areaModal.kind === pickAreaKind && areaModal.side === 'self') return;
    setAreaModal({ kind: pickAreaKind, side: 'self' });
  }, [pickAreaKind, areaModal]);
  // pick 解決 (pending クリア) で modal 自動 close (ユーザーが × でも閉じれる)
  useEffect(() => {
    if (pickAreaKind !== null) return;
    // area pick が無くなり、area modal が pick 用に開いていた場合は閉じる
    if (areaModal && areaModal.side === 'self' && (areaModal.kind === 'evidence' || areaModal.kind === 'remove')) {
      // pendingEffectPick が消えた → pick 完了 or skip
      // (手動で開いた閲覧モーダルも閉じてしまうが、pick 関連の自然な挙動として許容)
      setAreaModal(null);
    }
  }, [pickAreaKind]);
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
  // User vision (拡張 4): sceneRemove 等の scene キャラ pick mode 検出
  // pendingEffectPick.atomVerb が scene 系で、candidates が scene キャラ uid を含むなら active
  // D11014 a1 driver 2026-05-26: charModifyAP も scene pick (D08003 sceneRemove と同 UI 流用 — 黄色 highlight + click)
  const isScenePick =
    pendingPickForArea?.player === 'self' &&
    (pendingPickForArea.atomVerb === 'sceneRemove' || pendingPickForArea.atomVerb === 'charModifyAP');
  const scenePickUidsSelf = new Set<string>();
  const scenePickUidsOpp = new Set<string>();
  if (isScenePick && pendingPickForArea) {
    for (const c of pendingPickForArea.candidates) {
      if (c.player === 'self') scenePickUidsSelf.add(c.uid);
      else scenePickUidsOpp.add(c.uid);
    }
  }
  const handleScenePick = isScenePick ? (uid: string): void => {
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: uid });
  } : undefined;

  // switch-on-effect-enter (rules/20 §スイッチ): リムーブ等からの効果登場 (sceneEnter) で現場が満杯
  // (5枚) のとき、reanimate 対象を選んだ後に SceneSwitchPickerModal で退場キャラを収集してから resolve。
  //   - 退場キャラ選択 → switchRemoveUid 付きで resolve → engine が switchEnter で登場。
  //   - cancel (辞退) → pickedUid:null で resolve → reanimate しない (rules: 0枚選択=合法な辞退)。
  // 満杯でない sceneEnter / 他 area pick は従来通り即 resolve。
  const resolveSceneEnterPick = async (uid: string): Promise<void> => {
    const st = useGameStateStore.getState();
    const pend = st.pendingEffectPick;
    const gs = st.gameState;
    if (pend && pend.atomVerb === 'sceneEnter' && gs && gs.players[pend.player].scene.length >= 5) {
      const reanimateCardId = pend.candidates.find((c) => c.uid === uid)?.cardId ?? '';
      const sceneChars = gs.players[pend.player].scene.map((c) => ({
        uid: c.uid,
        cardId: c.cardId,
        name: readDef.card(c.cardId)?.names?.[0] ?? c.cardId,
        state: c.state,
        isNamed: c.isNamed,
      }));
      const newCardName = readDef.card(reanimateCardId)?.names?.[0] ?? reanimateCardId;
      const removeUid = await new Promise<string | null>((resolve) => {
        useSceneSwitchPickerStore.getState()._open({ cardId: reanimateCardId, newCardName, candidates: sceneChars, resolve });
      });
      if (removeUid === null) {
        dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });
        return;
      }
      dispatchEngineAction({ type: 'effectPickResolve', pickedUid: uid, switchRemoveUid: removeUid });
      return;
    }
    dispatchEngineAction({ type: 'effectPickResolve', pickedUid: uid });
  };

  // Phase 8.6: target picker state を subscribe して候補ハイライト + click ハンドラを派生
  const pickerPhase = useTargetPickerStore((s) => s.phase);
  const { pick: pickTarget, confirm: confirmTarget, cancel: cancelTarget } = useTargetPicker();
  // クリック 1 回で pick + confirm を同時に行う (最終確認は useConfirmation 側のモーダル)
  const pickAndConfirm = (uid: string): void => {
    pickTarget(uid);
    confirmTarget();
  };
  const candidateUidsSelf = new Set<string>();
  const candidateUidsOpp = new Set<string>();
  let isSelfPartnerCandidate = false;
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
  const handCards: HandCardMeta[] = resolveHandCard
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
  // Cleanup #6: viewport に合わせて stage を縮小 (1920×1080 fixed → fit)
  const stageScale = useStageScale();
  return (
    <div
      className="scaler"
      id="scaler"
      style={{
        transform: `scale(${stageScale})`,
        // 縮小後のサイズに合わせて container を縮める (scrollbar 防止)
        width: stageScale < 1 ? `${1920 * stageScale}px` : undefined,
        height: stageScale < 1 ? `${1080 * stageScale}px` : undefined,
      }}
      data-stage-scale={stageScale}
    >
      <div className="stage">
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
          effectStackCount={gameState?.pendingEffects.length ?? 0}
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
            candidateUids={candidateUidsOpp}
            onUnitClick={(uid) => pickAndConfirm(uid)}
            isCaseCandidate={isOppCaseCandidate}
            onCaseClick={() => pickAndConfirm(ACTION_CASE_TARGET_OPP)}
            onAreaClick={handleAreaClick}
            onExpand={expandModal.open}
            pickCharUids={scenePickUidsOpp}
            onPickChar={handleScenePick}
          />

          {/* KEEP OUT divider removed — Phase 7.5 layout pivot per user feedback */}

          <PlayerMat
            side="self"
            state={gameState}
            resolveCard={resolveCard}
            resolveCase={resolveCase}
            candidateUids={candidateUidsSelf}
            onUnitClick={(uid) => pickAndConfirm(uid)}
            isPartnerCandidate={isSelfPartnerCandidate}
            onPartnerClick={() => pickAndConfirm('partner:self')}
            // 2026-05-30: 宣言能力 source として自分の事件が候補のとき黄色強調 + クリックで選択
            isCaseCandidate={isSelfCaseCandidate}
            onCaseClick={() => pickAndConfirm('case:self')}
            onAreaClick={handleAreaClick}
            onExpand={expandModal.open}
            pickCharUids={scenePickUidsSelf}
            onPickChar={handleScenePick}
            // 2026-05-30: ネクストヒント中は FILE 表示を引いた後の枚数 (-1) にして誤解を防ぐ
            nextHintDrawPreview={isNextHintPick}
          />
        </div>

        {/* HandZone (Task 7.11) — Phase 8.6: onCardClick → runHandUseFlow
            Round 2: collapsed/expanded 両方で disabled 状態を可視化 + tooltip で理由表示。
            ユーザ指摘「コスト 8 のカードが出てる」(FILE 不足で使えないのに見た目が同じ) を解消。 */}
        <HandZone
          cards={isNextHintPick ? handCardsForZone : handCards}
          expanded={handExpanded}
          onExpand={() => setHandExpanded(true)}
          onCollapse={() => setHandExpanded(false)}
          onCardClick={(cardId) => {
            void runHandUseFlow({ player: 'self', cardId });
          }}
          onCardExpand={expandModal.open}
          canUse={(c) =>
            gameState !== null && (
              engineFlow.canHandUseCard(gameState, 'self', c.cardId) ||
              engineFlow.canHandUseCardSwitch(gameState, 'self', c.cardId)
            )
          }
          disabledReason={(c) =>
            gameState !== null
              ? getHandUseDisabledReason(gameState, 'self', c.cardId) ?? '使用不可'
              : '未開始'
          }
          pickMode={isDiscardPick || isNextHintPick || isCutinPick}
          // cutin / ネクストヒント / discard を HandZone pick mode で流用 (黄色枠 pickableCardIds)。
          // cutin: 候補 cardId を黄色枠化、click で cutin / skip で パス。
          pickableCardIds={isCutinPick ? cutinPickableIds : isNextHintPick ? nextHintPickableIds : undefined}
          pickHideBanner={isNextHintPick}
          pickBannerText={
            isCutinPick
              ? cutinBannerText
              : isNextHintPick
              ? `使うカードを選択（黄枠 / レベル${nextHintPick!.postPopCount}以下）`
              : undefined
          }
          pickSkipLabel={isCutinPick ? 'パス' : isNextHintPick ? '使用しない' : undefined}
          onPickCancel={isNextHintPick ? () => useNextHintPicker().acceptCancel() : undefined}
          pickCancelLabel={isNextHintPick ? 'キャンセル' : undefined}
          onPickCard={
            isCutinPick
              ? handleCutinPick
              : isNextHintPick
              ? (uid) => useNextHintPicker().acceptUse(uid.split('#')[0]!)
              : isDiscardPick
              ? (uid) => { dispatchEngineAction({ type: 'effectPickResolve', pickedUid: uid }); }
              : undefined
          }
          pickCanSkip={
            isCutinPick ? true : isNextHintPick ? true : isDiscardPick && (pendingPickForArea?.nMin ?? 1) === 0
          }
          onPickSkip={
            isCutinPick
              ? handleCutinPass
              : isNextHintPick
              ? () => useNextHintPicker().acceptSkip()
              : isDiscardPick
              ? () => { dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null }); }
              : undefined
          }
        />

        {/* ActionsPanel (Phase 8.5 で endTurn 配線開始、他は 8.6+) */}
        <ActionsPanel
          handCount={handCards.length}
          handUseRemaining={
            // 2026-05-28: NH したターンは通常「手札の使用」不可 (rules/05、engine gate と一致)。
            // handUseUsed (1ターン1回) に加え nextHintUsed でも 0 にして button を disable。
            (gameState?.turnState.self.handUseUsed || gameState?.turnState.self.nextHintUsed) ? 0 : 1
          }
          handUseUsed={gameState?.turnState.self.handUseUsed ?? false}
          nextHintFileCount={gameState?.players.self.file.length ?? 0}
          nextHintUsed={gameState?.turnState.self.nextHintUsed ?? false}
          canNextHint={gameState ? engineFlow.canStartNextHint(gameState, 'self') : false}
          partnerActive={gameState?.players.self.partner.state === 'active'}
          declaredTargetCount={
            gameState ? enumDeclaredAbilitySources(gameState, 'self').length : 0
          }
          reasoningTotalLP={
            gameState ? enumReasoningCandidates(gameState, 'self').length : 0
          }
          canAssist={gameState ? canAssistForUi(gameState, 'self') : false}
          canSolveCase={gameState ? canSolveCaseForUi(gameState, 'self') : false}
          actionMode={
            pickerPhase.phase !== 'idle' &&
            typeof pickerPhase.purpose === 'string' &&
            pickerPhase.purpose.startsWith('action:')
              ? 'selecting-target'
              : 'idle'
          }
          currentPhase={gameState?.turn.phase ?? 'main'}
          canEndTurn={
            (gameState?.turn.player === 'self') &&
            (gameState?.turn.phase === 'main')
          }
          onEndTurn={() => { void runEndTurnFlow({ player: 'self' }); }}
          onActionItemClick={(id: ActionItemId) => {
            // Round 2: picker stack 整理 — 別 ACTIONS item を選んだら現在の picker は
            // キャンセル (ガイドラベル + outline glow 消す)。flow 内で再度 start() するなら
            // そこで再開始される (useTargetPicker.start は "既に picking 中" の自動 cancel
            // ルートを持つので二重 cancel しても安全)。
            cancelTarget();
            if (id === 'reasoning') {
              void runReasoningFlow({ player: 'self' });
              return;
            }
            if (id === 'next-hint') {
              void runNextHintFlow({ player: 'self' });
              return;
            }
            if (id === 'assist') {
              void runAssistFlow({ player: 'self' });
              return;
            }
            if (id === 'solve-case') {
              void runSolveCaseFlow({ player: 'self' });
              return;
            }
            if (id === 'hand-use') {
              // 手札を展開するだけ。個別カード選択は HandZone.onCardClick → runHandUseFlow。
              setHandExpanded(true);
              return;
            }
            if (id === 'action') {
              void runActionFlow({ player: 'self' });
              return;
            }
            if (id === 'partner-ability') {
              void runPartnerAbilityFlow({ player: 'self' });
              return;
            }
            if (id === 'declared-ability') {
              void runDeclaredAbilityFlow({ player: 'self' });
              return;
            }
            // 残作業はなし — 全 ActionsPanel item が配線済 (Phase 8.6〜8.8b 完了)
            // eslint-disable-next-line no-console
            console.warn(`[Playmat] unknown action item: ${id}`);
          }}
          narratorMessage={narratorMessage}
          logEntryCount={gameState?.log.length ?? 0}
          logOpen={logOpen}
          onLogToggle={() => setLogOpen((v) => !v)}
        />

        {/* ConfirmModal — useConfirmation の state を全画面オーバーレイで描画 */}
        <PlaymatConfirmModal />

        {/* Phase 8 完全クローズ Commit 2: コンタクトフロー用モーダル */}
        <PlaymatGuardPickerModal />
        <PlaymatCutInDisguisePickerModal />

        {/* Phase 8 完全クローズ Commit 3a: ヒラメキモーダル */}
        <PlaymatHiramekiPickerModal />

        {/* 2026-05-28: ネクストヒント step2 picker は HandZone pick mode に統合 (別 modal 廃止) */}

        {/* Phase 5 advance UI: ミスリードモーダル (相手推理時、自分の現場 misread 持ち候補から複数選択) */}
        <PlaymatMisreadPickerModal />

        {/* Phase 5 advance: SceneSwitch UI (rules/20 §スイッチ) */}
        <PlaymatSceneSwitchPickerModal />

        {/* BUG-108: 複数 option choice effect (D11012 a1 LP＋1/AP＋2000) の択一 modal */}
        <PlaymatChoicePickerModal />

        {/* BUG-085: 宣言能力コスト〚裏向きの証拠を表向きにする〛の証拠選択 picker
            (証拠エリア拡大表示 CardListModal を pick mode で流用) */}
        <PlaymatEvidenceFlipPickerModal />

        {/* Phase 8.5: narrator-msg と log-btn は ActionsPanel に集約。
            LogPanel は open=true のときのみオーバーレイで描画。 */}
        <LogPanel
          entries={gameState?.log ?? []}
          open={logOpen}
          onClose={() => setLogOpen(false)}
          gameState={gameState}
        />

        {/* Round 2: FILE/証拠/リムーブ クリック → 内容確認モーダル
            証拠 / FILE は engine 上裏向きなので faceDownCount で枚数のみ表示。
            リムーブは表向きなので cards (cardId[]) で実カード表示。 */}
        {areaModal && gameState && (() => {
          const player = gameState.players[areaModal.side];
          // Round 3: FILE 内アシスト中パートナーのみ表向き表示 (ユーザ指示)
          //   - file の中身を 「assisted-partner cards (表向き)」 と 「card-back count (裏向き)」 に分割
          //   - リムーブは全カード表向き / 証拠 は全カード裏向き
          let cards: string[] = [];
          let faceDownCount = 0;
          // BUG-085: 証拠は faceUp が混在し得る。表向きは公開表示する。
          let faceUpEvidence: { index: number; cardId: string }[] | undefined;
          if (areaModal.kind === 'remove') {
            cards = player.remove as string[];
          } else if (areaModal.kind === 'file') {
            const partnerInFile: string[] = [];
            let backCount = 0;
            for (const f of player.file) {
              if (f.type === 'assisted-partner') {
                partnerInFile.push(f.cardId);
              } else {
                backCount += 1;
              }
            }
            cards = partnerInFile;
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
            pendingPickForArea?.player === 'self' &&
            areaModal.side === 'self' &&
            ((pendingPickForArea.atomVerb === 'evidenceToHand' && areaModal.kind === 'evidence') ||
              (pendingPickForArea.atomVerb === 'handAddFromRemove' && areaModal.kind === 'remove') ||
              // D11014 a2 / D08024 driver 2026-05-26: sceneEnter は target.query.area で
              // pickAreaKind が決まる (remove / evidence / file)。area kind を一致確認。
              (pendingPickForArea.atomVerb === 'sceneEnter' && areaModal.kind === pickAreaKind) ||
              // D08021 driver 2026-05-26: charStackCard multi-pick (0-5 枚) も同パターン
              (pendingPickForArea.atomVerb === 'charStackCard' && areaModal.kind === pickAreaKind));
          return (
            <CardListModal
              kind={areaModal.kind}
              side={areaModal.side}
              cards={cards}
              faceDownCount={faceDownCount}
              faceUpEvidence={faceUpEvidence}
              onClose={closeAreaModal}
              onExpand={(cardId) => expandModal.open(cardId)}
              pickCands={isPickModeForThisArea ? pendingPickForArea!.candidates : undefined}
              pickBannerText={
                isPickModeForThisArea && pendingPickForArea?.atomVerb === 'sceneEnter'
                  ? 'リムーブから1枚選んで現場に登場させてください'
                  : isPickModeForThisArea && pendingPickForArea?.atomVerb === 'charStackCard'
                  ? `リムーブから${pendingPickForArea.nMax}枚まで選んでこのキャラの下に重ねてください`
                  : undefined
              }
              onPick={isPickModeForThisArea ? (uid) => { void resolveSceneEnterPick(uid); } : undefined}
              pickCanSkip={isPickModeForThisArea && (pendingPickForArea?.nMin ?? 1) === 0}
              onPickSkip={isPickModeForThisArea ? () => {
                dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });
              } : undefined}
              pickNMin={isPickModeForThisArea ? pendingPickForArea?.nMin : undefined}
              pickNMax={isPickModeForThisArea ? pendingPickForArea?.nMax : undefined}
              onPickMulti={isPickModeForThisArea ? (uids) => {
                // Phase 2c union 化: 0 枚選択は skip 形態 (pickedUid:null 単独) で dispatch
                // (旧実装でも pickedUid null 時は pickedUids が無視され skip 経路だった — 挙動同一)
                const first = uids[0];
                if (first === undefined) {
                  dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null });
                } else {
                  dispatchEngineAction({ type: 'effectPickResolve', pickedUid: first, pickedUids: uids });
                }
              } : undefined}
              pickDistinctNames={isPickModeForThisArea ? (pendingPickForArea as { distinctNames?: boolean } | undefined)?.distinctNames : undefined}
              pickComponents={isPickModeForThisArea && (pendingPickForArea as { distinctNames?: boolean } | undefined)?.distinctNames
                ? Object.fromEntries(
                    (pendingPickForArea?.candidates ?? []).map((c) => {
                      const d = readDef.card(c.cardId);
                      return [c.uid, d ? allCardNameComponentsForDef(d) : [c.cardId]];
                    })
                  )
                : undefined}
            />
          );
        })()}
        {/* Round 4l (BUG-001): カード拡大表示 modal */}
        <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
        {/* User vision (拡張 5 chain): SceneArea pick mode で skip 可能 (max:N) の場合
            scene キャラを click せず「リムーブしない」できるよう overlay ボタン表示 */}
        {isScenePick && (pendingPickForArea?.nMin ?? 1) === 0 && (
          <div className="scene-pick-skip-overlay" role="status">
            <span className="scene-pick-skip-banner">
              {pendingPickForArea?.atomVerb === 'charModifyAP'
                ? '現場キャラを 1 枚選んで効果を適用してください'
                : '現場キャラを 1 枚選んでリムーブ してください'}
            </span>
            <button
              type="button"
              className="scene-pick-skip-btn"
              onClick={() => dispatchEngineAction({ type: 'effectPickResolve', pickedUid: null })}
              data-testid="scene-pick-skip"
            >
              リムーブしない
            </button>
          </div>
        )}
      </div>
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
  if (!pending || pending.player !== 'self') {
    return (
      <HiramekiPickerModal
        open={false}
        cardName=""
        abilityText=""
        onFire={() => {}}
        onSkip={() => {}}
      />
    );
  }
  const def = readDef.card(pending.cardId);
  const cardName = def?.names?.[0] ?? pending.cardId;
  const ability = def?.abilities.find(
    (a: unknown) => a !== null && typeof a === 'object' && (a as { id?: string }).id === pending.abilityId,
  ) as { description?: string } | undefined;
  const abilityText = ability?.description ?? 'ヒラメキ能力';
  return (
    <HiramekiPickerModal
      open={true}
      cardName={cardName}
      abilityText={abilityText}
      onFire={() => dispatchEngineAction({ type: 'hiramekiResolve', choice: 'fire' })}
      onSkip={() => dispatchEngineAction({ type: 'hiramekiResolve', choice: 'skip' })}
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
  if (!pending || pending.reasoningPlayer !== 'opp' || !gameState) {
    return (
      <MisreadPickerModal
        open={false}
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
  const reasoningLp = pending.reasoningUid.startsWith('partner:')
    ? (reasoningDef?.lp ?? 0)
    : readChar.lp(gameState, pending.reasoningUid);
  // candidates を MisreadCandidateView 形式に展開
  const candidateViews: MisreadCandidateView[] = pending.candidates.map((c) => {
    const sceneChar = gameState.players.self.scene.find((sc) => sc.uid === c.uid);
    const cardName = sceneChar
      ? (readDef.card(sceneChar.cardId)?.names?.[0] ?? sceneChar.cardId)
      : c.uid;
    return { uid: c.uid, cardName, x: c.x };
  });
  return (
    <MisreadPickerModal
      open={true}
      reasoningName={reasoningName}
      reasoningLp={reasoningLp}
      candidates={candidateViews}
      onConfirm={(picks) => {
        dispatchEngineAction({ type: 'misreadResolve', picks });
      }}
      onSkip={() => {
        dispatchEngineAction({ type: 'misreadResolve', picks: [] });
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
  return (
    <CutInDisguisePickerModal
      open={true}
      actorLabel={current.actorLabel}
      actorName={current.actorName}
      candidates={current.candidates}
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
 * Phase 5 advance: SceneSwitchPickerModal ラッパ (rules/20 §スイッチ)。
 * useSceneSwitchPickerStore.current を subscribe し、scene 5 埋まり時のキャラ手札
 * 使用で開く。pick / cancel で Promise resolver を呼んで runHandUseFlow を進める。
 *
 * 重要: React 19 fiber static flag invariant 違反を避けるため、early return せず
 *       常時同一 JSX (open={!!current} 切替) で返す (CaseArea L65 と同ポリシー)。
 */
function PlaymatSceneSwitchPickerModal(): JSX.Element {
  const current = useSceneSwitchPickerStore((s) => s.current);
  const handlePick = (uid: string): void => {
    const c = useSceneSwitchPickerStore.getState().current;
    if (!c) return;
    useSceneSwitchPickerStore.getState()._close();
    c.resolve(uid);
  };
  const handleCancel = (): void => {
    const c = useSceneSwitchPickerStore.getState().current;
    if (!c) return;
    useSceneSwitchPickerStore.getState()._close();
    c.resolve(null);
  };
  return (
    <SceneSwitchPickerModal
      open={!!current}
      sceneChars={current?.candidates ?? []}
      newCardName={current?.newCardName ?? ''}
      onPick={handlePick}
      onCancel={handleCancel}
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
    <CardListModal
      kind="evidence"
      side={current.side}
      cards={[]}
      faceDownCount={evidenceLen}
      faceUpEvidence={faceUpEvidence}
      onClose={() => useEvidenceFlipPicker().cancel()}
      pickCands={pickCands}
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
