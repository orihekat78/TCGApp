// Phase 7 Task 7.13: LogPanel
// 下端折りたたみログパネル。閉時は .log-btn のみ表示、開時はエントリ一覧。
// 開閉操作は Phase 8 (本コンポーネントは open prop を受け取って静的レンダ)。
//
// 視覚: design-mockups/01-board-mockup.html 1236-1241 (button のみ),
//       CSS 145-163 行 (.log-btn)
// 注: mock は下端パネル未実装 → ui-overall.md の「閉時 32px / 展開時 200px」
//     仕様を実装。閉時の見た目のみ mock の .log-btn を流用。

import type { JSX, MouseEvent } from 'react';
import type { LogEntry } from '@/engine/types/game-state.js';
import { cardIdToDisplayName } from '@/ui/services/uidNames.js';
import './LogPanel.css';

/**
 * user_request 20260522_01 #3 BUG-060: log entry の target が cardId (Dxxxxx)
 * の場合、表示名 (例: '蘭の一撃') に解決する。target が cardId pattern にマッチ
 * しなければ素通し。
 */
function formatTarget(target: string | undefined): string | undefined {
  if (!target) return undefined;
  // CT-D08 / CT-D11 の cardId pattern: D08xxx / D11xxx (3 桁 numeric suffix)
  if (/^D\d{2}\d{3}/.test(target)) {
    const name = cardIdToDisplayName(target);
    // cardIdToDisplayName が未登録時 cardId をそのまま返すなら "[name (id)]" 形式
    return name === target ? target : `${name} (${target})`;
  }
  return target;
}

export type LogPanelProps = {
  entries: LogEntry[];
  open: boolean;
  /** 表示する最新エントリ件数 (デフォルト 30) */
  maxEntries?: number;
  /** Round 2: ログを閉じる callback (panel 内 close button から呼ぶ)。
   *  Round 3b: backdrop (root container) click でも呼ばれるようになった (HandZone と同じパターン)。 */
  onClose?: () => void;
};

// Round 2: ACTION_LABEL を engine 側 log entry に合わせて拡張。
// engine.mutate.log.append が push する action 文字列をすべてカバーする。
const ACTION_LABEL: Record<string, string> = {
  reasoning: '推理',
  action: 'アクション',
  actionAgainstChar: 'アクション(キャラ)',
  actionAgainstCase: 'アクション(事件)',
  guard: 'ガード',
  contact: 'コンタクト',
  assist: 'アシスト',
  solveCase: '事件解決 ★',
  handUse: '手札の使用',
  handUseCard: '手札の使用',
  nextHint: 'ネクストヒント',
  refresh: 'リフレッシュ',
  'contact:detail': 'コンタクト',
  endTurn: 'ターン終了',
  partnerAbility: 'パートナー能力',
  declaredAbility: '宣言能力',
  'setup.init': 'ゲーム準備',
  'setup.startGame': 'ゲーム開始',
  'setup.reveal': '事件・パートナー公開',
  'setup.decideFirstPlayer': '先攻決定',
  'setup.dealOpeningHand': '初期手札配布',
  'setup.mulligan': '手札引き直し',
  'auto-phase': 'オートフェイズ',
  'contact-cutin': 'カットイン',
  'contact-disguise': '変装',
  'contact-pass': 'パス',
  'contact-judge': '判定',
  // BUG-072: effect 経由 atom の log を日本語化
  'effect:draw': '効果: ドロー',
  'effect:discard': '効果: 手札リムーブ',
  'effect:discard:awaiting-pick': '効果: 手札選択待ち',
  // BUG-073: 全 effect atom の日本語化 (水平展開)
  'effect:mill': '効果: デッキ上リムーブ',
  'effect:fileAdd': '効果: FILE 追加',
  'effect:filePopToHand': '効果: FILE → 手札',
  'effect:evidenceGain': '効果: 証拠獲得',
  'effect:evidenceLose': '効果: 証拠喪失',
  'effect:evidenceFlip': '効果: 証拠裏返し',
  'effect:evidenceToHand': '効果: 証拠 → 手札',
  'effect:handAddFromRemove': '効果: リムーブ → 手札',
  'effect:sceneEnter': '効果: 現場登場',
  'effect:sceneSwitch': '効果: スイッチ',
  'effect:sceneRemove': '効果: 現場リムーブ',
  'effect:sceneSetState': '効果: 状態変更',
  'effect:sceneDisguise': '効果: 変装',
  'effect:charModifyAP': '効果: AP 修正',
  'effect:charModifyLP': '効果: LP 修正',
  'effect:charOverrideAP': '効果: AP 上書き',
  'effect:charOverrideLP': '効果: LP 上書き',
  'effect:charGrantKeyword': '効果: キーワード付与',
  'effect:charRevokeKeyword': '効果: キーワード剥奪',
  'effect:charDisableOriginal': '効果: 元能力無効化',
  'effect:charSetTurnEffect': '効果: ターン効果設定',
  'effect:charSetCard': '効果: カードセット',
  'effect:charStackCard': '効果: カードを下に重ね',
  'effect:partnerAssist': '効果: パートナーアシスト',
  'effect:partnerSetState': '効果: パートナー状態変更',
  'effect:partnerSolveCase': '効果: パートナー事件解決',
  'effect:caseToResolved': '効果: 解決編に移行',
  'effect:deckRevealUntil': '効果: デッキ公開 (条件まで)',
  'effect:deckToBottomBound': '効果: デッキ下へ移動',
  'effect:deckShuffle': '効果: デッキシャッフル',
  souza: '捜査',
  // BUG-074: pick 待ち atom の awaiting-pick log
  'effect:evidenceToHand:awaiting-pick': '効果: 証拠 → 手札 (選択待ち)',
  'effect:handAddFromRemove:awaiting-pick': '効果: リムーブ → 手札 (選択待ち)',
};

function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

export function LogPanel({ entries, open, maxEntries = 30, onClose }: LogPanelProps): JSX.Element | null {
  // Phase 8.5: 閉時は何もレンダリングしない (LOG ボタンは ActionsPanel が持つ)
  if (!open) return null;

  // engine の log は append 順 (古→新)。逆順にして上が新しい表示にする。
  const sorted = entries.slice(-maxEntries).reverse();

  // Round 3b: backdrop click 閉。
  //   - `.log-panel-backdrop` 透明レイヤ (z=199) で panel の外側 click を捕捉。
  //   - panel 自体 (z=200) には `e.target === e.currentTarget` フィルタも残す
  //     (header/list 内側の余白 click にも対応するため)。HandZone と同じ pattern。
  const handleBackdropClick = (e: MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget && onClose) onClose();
  };

  return (
    <>
      {onClose && (
        <div
          className="log-panel-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <div
        className="log-panel open"
        role="dialog"
        aria-label="ゲームログ"
        aria-expanded={true}
        onClick={handleBackdropClick}
      >
      {/* Round 2: panel 内 header + 閉じるボタン (close button)。
          Round 3b: HandZone パターン統一に伴い backdrop click でも閉じれるように。 */}
      <div className="log-panel-header">
        <span className="log-panel-title">ログ</span>
        {onClose && (
          <button
            type="button"
            className="log-panel-close"
            aria-label="ログを閉じる"
            onClick={onClose}
          >
            ×
          </button>
        )}
      </div>
      <div className="log-list" role="log" aria-live="polite">
        {sorted.length === 0 ? (
          <div className="log-empty">ログなし</div>
        ) : (
          sorted.map((e, i) => (
            <div
              key={`${e.ts}-${i}`}
              className={`log-entry side-${e.player}`}
            >
              <span className="log-time">{formatTime(e.ts)}</span>
              <span className="log-turn">T{e.turn}</span>
              <span className="log-player">{e.player === 'self' ? '自' : '相'}</span>
              <span className="log-action">{ACTION_LABEL[e.action] ?? e.action}</span>
              {e.target !== undefined && <span className="log-target">→ {formatTarget(e.target)}</span>}
              {e.result !== undefined && <span className="log-result">: {e.result}</span>}
            </div>
          ))
        )}
      </div>
      </div>
    </>
  );
}
