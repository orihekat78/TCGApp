// Phase 8.6α: GuardPickerModal
//
// rules: 07-action-flow.md / 08-contact.md
// spec: .claude/specs/2026-05-11-ui-modal-flows-contact.md
//
// 役割:
//   - 自分 (defender=self) が opp のアクション宣言を受けたとき、現場の active キャラから
//     ガード役を 1 体ピック、または「ガードしない」を選ぶ
//   - rules: active 状態必須・AP 条件なし・名乗り状態 OK
//   - 候補 0 件の場合はモーダルを開かず親側で自動 skip (本コンポーネントは表示時に保証しない)

import type { JSX } from 'react';
import type { SceneCharacter } from '@/engine/types/game-state.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { CardExpandModal } from './CardExpandModal.js';
import { SelectableCardTile } from './SelectableCardTile.js';
import './GuardPickerModal.css';

export type GuardPickerCandidate = {
  uid: string;
  cardId: string;
  name: string;
  ap: number;
  lp: number;
};

export type GuardPickerModalProps = {
  /** 表示制御 (false で非表示・null 返さず DOM ごと外す) */
  open: boolean;
  /** ガード候補 (active 状態の自分キャラ + パートナー) */
  candidates: readonly GuardPickerCandidate[];
  /** 攻撃元キャラの表示名 (ヘッダで「○○が攻撃!」を出す) */
  attackerName?: string;
  /** ガード対象選択時 */
  onPick: (uid: string) => void;
  /** 「ガードしない」選択時 */
  onSkip: () => void;
  /**
   * W2b (2026-07-03, r28): mustGuard 義務 (B09040 a2)。true のとき「ガードしない」を封じ、
   * 候補 (親側で義務 char のみに絞済) から必ず選ばせる (公式Q&A)。
   */
  mustGuard?: boolean;
};

export function GuardPickerModal(props: GuardPickerModalProps): JSX.Element | null {
  const { open, candidates, attackerName, onPick, onSkip, mustGuard } = props;
  const expandModal = useCardExpandModal();
  if (!open) return null;

  return (
    <div
      className="guard-picker-overlay"
      role="dialog"
      aria-labelledby="guard-picker-title"
      aria-modal="true"
      data-testid="guard-picker-modal"
    >
      <div className="guard-picker-modal">
        <div className="guard-picker-header">
          <h2 id="guard-picker-title">ガード判定</h2>
          {attackerName && (
            <p className="guard-picker-sub">{`${attackerName}があなたを攻撃!`}</p>
          )}
        </div>

        <div className="guard-picker-body">
          {candidates.length === 0 ? (
            <p className="guard-picker-empty">ガードできるキャラがいません</p>
          ) : (
            <ul className="guard-picker-list">
              {candidates.map((c) => (
                <li key={c.uid}>
                  <div className="guard-picker-choice" data-testid={`guard-cand-${c.uid}`}>
                    <SelectableCardTile
                      cardId={c.cardId}
                      instanceId={c.uid}
                      onSelect={onPick}
                      onExpand={expandModal.open}
                    />
                    <span className="guard-picker-stats" aria-label={`${c.name}: AP ${c.ap}, LP ${c.lp}`}>
                      AP {c.ap} / LP {c.lp}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="guard-picker-actions">
          {mustGuard === true ? (
            <p className="guard-picker-must" data-testid="guard-picker-must">
              「このキャラはガードできる場合、必ずガードする。」— ガードしない選択はできません
            </p>
          ) : (
            <button
              type="button"
              className="guard-picker-skip"
              onClick={onSkip}
              data-testid="guard-picker-skip"
            >
              ガードしない
            </button>
          )}
        </div>
      </div>
      <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </div>
  );
}

/**
 * SceneCharacter[] から GuardPickerCandidate[] へ変換するヘルパ。
 * UI 層からの呼出時に名前/AP/LP を resolveCard 経由で埋める用途。
 */
export function buildGuardCandidates(
  characters: readonly SceneCharacter[],
  resolveCard: (cardId: string) => { name: string; ap: number; lp: number },
): GuardPickerCandidate[] {
  return characters
    .filter((c) => c.state === 'active')
    .map((c) => {
      const meta = resolveCard(c.cardId);
      return {
        uid: c.uid,
        cardId: c.cardId,
        name: meta.name,
        ap: c.apOverride ?? meta.ap,
        lp: c.lpOverride ?? meta.lp,
      };
    });
}
