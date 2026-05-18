// Phase 7 Task 7.12: TopBar
// 画面最上部 1920×44px の chrome バー。3 カラム grid:
//   左 = チャプタータグ (先攻/後攻 N ターン目)
//   中央 = 痕跡 自/相 + 効果スタック件数
//   右 = ナレーター avatar + 名前 + ©
// 操作系 (avatar クリック等) は Phase 8。
// rules: 13-keywords.md §痕跡 / 15-abilities-effects.md §効果スタック
// 視覚: design-mockups/01-board-mockup.html 1212-1235, CSS 72-104 行
// 由来: Claude Design (Research Preview) — engine 型に接続して取込み

import type { JSX } from 'react';
import './TopBar.css';

// ------------------------------------------------------------------
// 型
// ------------------------------------------------------------------

export type ScratchState = '未発見' | '発見済';

export type TopBarProps = {
  turn: {
    number: number;
    player: 'self' | 'opp';
  };
  /**
   * 先攻プレイヤー ('self' | 'opp')。engine は `state.players[p].case.requiredEvidence === 7`
   * で先攻判定するので、呼出元はそれを評価して渡す。
   *
   * Round 2 修正: 旧実装は `PLAYER_LABEL: { self: '先攻', opp: '後攻' }` という静的 mapping
   * で `self/opp` (UI 視点の 2 値) と「先攻/後攻」(engine のランダム決定) を同一視していた。
   * `decideFirstPlayer('random')` で self が後攻になった回で実機誤表示 (例:「先攻 2ターン目」
   * → 正しくは「後攻 1ターン目」) が出ていたため、動的判定に移行する。
   */
  firstPlayer: 'self' | 'opp';
  scratchTrace: {
    self: ScratchState;
    opp: ScratchState;
  };
  effectStackCount: number;
  /** デフォルト "ナレーター" */
  narratorName?: string;
  /**
   * 著作権/権利者表記。実プロジェクトで確定値を渡してください。
   * デフォルトは仕様書の指定 (公式の権利者表記) を採用しています。
   */
  copyright?: string;
};

// ------------------------------------------------------------------
// 内部ヘルパ
// ------------------------------------------------------------------

/**
 * 先攻/後攻ラベルと「N ターン目」をプレイヤー視点で算出する。
 *
 * turn.number はゲーム全体の通し番号 (1=先攻のT1, 2=後攻のT1, 3=先攻のT2, ...)。
 * UI 上は各プレイヤーの視点での「N ターン目」を表示したいので変換が必要。
 *
 * @param turnNumber ゲーム全体のターン番号 (engine.state.turn.number、1-based)
 * @param turnPlayer 現在ターンのプレイヤー
 * @param firstPlayer 先攻プレイヤー
 * @returns { label: '先攻'|'後攻', playerTurnNumber: number }
 */
export function computeChapterTag(
  turnNumber: number,
  turnPlayer: 'self' | 'opp',
  firstPlayer: 'self' | 'opp',
): { label: '先攻' | '後攻'; playerTurnNumber: number } {
  const isFirstPlayer = turnPlayer === firstPlayer;
  const label: '先攻' | '後攻' = isFirstPlayer ? '先攻' : '後攻';
  // 先攻プレイヤーは奇数ターン (1,3,5,…) で打つ → 自分視点 = ceil(n/2)
  // 後攻プレイヤーは偶数ターン (2,4,6,…) で打つ → 自分視点 = n/2
  const playerTurnNumber = isFirstPlayer
    ? Math.ceil(turnNumber / 2)
    : Math.floor(turnNumber / 2);
  return { label, playerTurnNumber };
}

type ScratchItemProps = {
  who: '自' | '相';
  state: ScratchState;
};

function ScratchItem({ who, state }: ScratchItemProps): JSX.Element {
  const found = state === '発見済';
  return (
    <div
      className={`scratch${found ? ' found' : ''}`}
      title={`痕跡: ${who}`}
      data-state={state}
    >
      <span className="dot" aria-hidden="true" />
      <span>
        痕跡 {who}{' '}
        {found ? (
          <strong>{state}</strong>
        ) : (
          <span className="state-unfound">{state}</span>
        )}
      </span>
    </div>
  );
}

// ------------------------------------------------------------------
// TopBar 本体
// ------------------------------------------------------------------

export function TopBar(props: TopBarProps): JSX.Element {
  const {
    turn,
    firstPlayer,
    scratchTrace,
    effectStackCount,
    narratorName = 'ナレーター',
    copyright = '© 青山剛昌／小学館 © TOMY',
  } = props;

  const { label, playerTurnNumber } = computeChapterTag(
    turn.number,
    turn.player,
    firstPlayer,
  );
  const chapterText = `${label} ${playerTurnNumber}ターン目`;

  return (
    <div className="topbar" role="banner">
      <div className="topbar-left">
        <span className="chapter-tag" aria-label={chapterText}>
          <span className="ico" aria-hidden="true" />
          {chapterText}
        </span>
      </div>

      <div className="topbar-center">
        <ScratchItem who="自" state={scratchTrace.self} />
        <div
          className="effect-stack"
          aria-label={`効果スタック ${effectStackCount} 件`}
        >
          効果スタック: {effectStackCount}
        </div>
        <ScratchItem who="相" state={scratchTrace.opp} />
      </div>

      <div className="topbar-right">
        <div className="narrator" aria-label={`ナレーター: ${narratorName}`}>
          <div className="narrator-avatar" aria-hidden="true" />
          <span className="narrator-name">{narratorName}</span>
        </div>
        <span className="copyright">{copyright}</span>
      </div>
    </div>
  );
}

export default TopBar;
