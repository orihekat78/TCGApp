// Phase 7 Task 7.13: LogPanel
// 下端折りたたみログパネル。閉時は .log-btn のみ表示、開時はエントリ一覧。
// 開閉操作は Phase 8 (本コンポーネントは open prop を受け取って静的レンダ)。
//
// 視覚: design-mockups/01-board-mockup.html 1236-1241 (button のみ),
//       CSS 145-163 行 (.log-btn)
// 注: mock は下端パネル未実装 → ui-overall.md の「閉時 32px / 展開時 200px」
//     仕様を実装。閉時の見た目のみ mock の .log-btn を流用。

import type { JSX } from 'react';
import type { LogEntry } from '@/engine/types/game-state.js';
import './LogPanel.css';

export type LogPanelProps = {
  entries: LogEntry[];
  open: boolean;
  /** 表示する最新エントリ件数 (デフォルト 30) */
  maxEntries?: number;
  /** Round 2: ログを閉じる callback (panel 内 close button から呼ぶ)。
   *  旧実装は LOG button toggle のみで、log entries が close button を覆って閉じれない
   *  バグがあった (ユーザ指摘)。panel 内に独立 close ボタンを追加して解消。 */
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

  return (
    <div className="log-panel open" aria-expanded={true}>
      {/* Round 2: panel 内 header + 閉じるボタンを追加。
          旧実装は ActionsPanel 内の LOG ボタンのみで toggle していたが、log entries
          が overlay として close button を覆って click 不能になっていた。
          panel 自身に独立 close button を持たせて確実に閉じれる構造に。 */}
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
              {e.target !== undefined && <span className="log-target">→ {e.target}</span>}
              {e.result !== undefined && <span className="log-result">: {e.result}</span>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
