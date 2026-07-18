// user_request 20260522_01 #12 BUG-061: deckRevealUntil 演出 overlay
// 2026-06-01 (user 指摘 #1): カード画像を表示 + 「残りをデッキの下へ」「シャッフル」の演出を追加。
//
// 役割:
//   - useGameStateStore.pendingDeckReveal を subscribe
//   - phase='reveal': 公開カードを画像つきで 0.5 秒ずつ順次フェード in / matched を highlight
//   - phase='toBottom': matched 以外を「デッキの下へ」スライドダウン演出 (公式: 残りをデッキ下へ)
//   - phase='shuffle': 山札シャッフル演出 (公式: デッキをシャッフル)
//   - 各 phase 後 auto-dismiss
//
// side-channel-pattern.md 4 点 checklist の (3) UI 側実装

import type { JSX } from 'react';
import { useEffect, useState } from 'react';
import { useGameStateStore } from '@/ui/state/store.js';
import { def as readDef } from '@/engine/read/def.js';
import { useCardExpandModal } from '@/ui/hooks/useCardExpandModal.js';
import { CardArt } from './CardArt.js';
import { CardExpandModal } from './CardExpandModal.js';
import './DeckRevealOverlay.css';

type Phase = 'reveal' | 'toBottom' | 'shuffle';

export function DeckRevealOverlay(): JSX.Element | null {
  const pending = useGameStateStore((s) => s.pendingDeckReveal);
  const setPending = useGameStateStore((s) => s.setPendingDeckReveal);
  const expandModal = useCardExpandModal();
  // S2 B01022 (2026-07-10): deck-window pick (sceneEnter query.area='deck') の未解決中も hold。
  // chooseMatch (awaitingPick) と違い pendingDeckReveal 自体は完了形で set されるため、
  // pendingEffectPick 側を見て「公開カードから選択中」の間は自動進行を止める。
  // 解決で pendingEffectPick が消え、この effect が再実行されて通常演出 (toBottom→shuffle) が走る
  // (= engine 側でも deckToBottomBound/deckShuffle が続けて解決されるタイミングと同期)。
  const deckWindowPickActive = useGameStateStore((s) => {
    const p = s.pendingEffectPick;
    if (!p) return false;
    const area = (p.atomArgs as { target?: { query?: { area?: string } } } | undefined)?.target?.query?.area;
    return area === 'deck';
  });
  const downstreamDecisionActive = useGameStateStore((s) => {
    if (s.pendingDeckReorder !== null) return true;
    const p = s.pendingEffectPick;
    if (p?.atomVerb !== 'sceneEnter') return false;
    const area = (p.atomArgs as { target?: { query?: { area?: string } } }).target?.query?.area;
    return area === 'hand';
  });
  const [phase, setPhase] = useState<Phase>('reveal');

  useEffect(() => {
    // B04026 等は公開選択後、順序決定/手札登場へ進む。
    // 公開モーダルに統合済みの snapshot を残し、後から誤った shuffle 演出を出さない。
    if (pending && pending.awaitingPick !== true && downstreamDecisionActive) {
      setPending(null);
    }
  }, [pending, downstreamDecisionActive, setPending]);

  useEffect(() => {
    if (!pending) {
      setPhase('reveal');
      return;
    }
    setPhase('reveal');
    // BUG-132 GAP-1: chooseMatch (「1枚まで」) の human pick 未解決中は hold —
    // 公開リストを表示したまま自動進行 (toBottom→shuffle→dismiss) を停止し、
    // EffectPickerModal (z-index 9700 > overlay 9050) の選択/decline を待つ。
    // pick 解決の再入で awaitingPick 無しの pending が再 set され通常演出で完了する。
    // S2 B01022: deck-window pick 未解決中も同様に hold (上記 deckWindowPickActive)。
    if (pending.awaitingPick === true || deckWindowPickActive) {
      return;
    }
    // reveal: 1 枚 0.5 秒 + 余韻 / toBottom: 1.1 秒 / shuffle: 1.0 秒
    const revealMs = pending.revealed.length * 500 + 500;
    const toBottomMs = 1100;
    const shuffleMs = 1000;
    const t1 = setTimeout(() => setPhase('toBottom'), revealMs);
    const t2 = setTimeout(() => setPhase('shuffle'), revealMs + toBottomMs);
    const t3 = setTimeout(() => setPending(null), revealMs + toBottomMs + shuffleMs);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [pending, setPending, deckWindowPickActive]);

  if (!pending) return null;
  // 公開選択は CardListModal へ統合。後続の並べ替え/手札登場の操作も遮らない。
  if (pending.awaitingPick === true || deckWindowPickActive || downstreamDecisionActive) return null;

  const playerLabel = pending.player === 'self' ? '自分' : '相手';
  const headerText = phase === 'reveal'
    ? `${playerLabel}のデッキを公開中…`
    : phase === 'toBottom'
      ? '残りのカードをデッキの下へ…'
      : 'デッキをシャッフル中…';

  return (
    <>
    <div className="deck-reveal-overlay" role="status" data-testid="deck-reveal-overlay">
      <div className="deck-reveal-box">
        <div className="deck-reveal-header" data-testid="deck-reveal-header">
          {headerText}
        </div>

        {phase !== 'shuffle' ? (
          <div className={`deck-reveal-list phase-${phase}`} data-testid="deck-reveal-list">
            {pending.revealed.map((cardId, idx) => {
              const name = readDef.card(cardId)?.names?.[0] ?? cardId;
              const isMatched =
                pending.matched === cardId && idx === pending.revealed.length - 1;
              return (
                <div
                  key={`${cardId}-${idx}`}
                  className={`deck-reveal-card ${isMatched ? 'is-matched' : 'is-rest'}`}
                  style={{ ['--reveal-index' as string]: String(idx) }}
                  data-testid={`deck-reveal-card-${idx}`}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    expandModal.open(cardId);
                  }}
                >
                  <span className="deck-reveal-card-num">{idx + 1}</span>
                  <CardArt cardId={cardId} alt={name} className="deck-reveal-card-art" />
                  <span className="deck-reveal-card-name">{name}</span>
                  {isMatched && <span className="deck-reveal-match-badge">登場!</span>}
                  <button
                    type="button"
                    className="deck-reveal-card-detail"
                    data-testid={`deck-reveal-detail-${idx}`}
                    aria-label={`${name}（${idx + 1}枚目）の詳細を表示`}
                    onClick={() => expandModal.open(cardId)}
                  >
                    Details
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="deck-reveal-shuffle" data-testid="deck-reveal-shuffle">
            <span className="deck-shuffle-card s1" />
            <span className="deck-shuffle-card s2" />
            <span className="deck-shuffle-card s3" />
            <span className="deck-shuffle-card s4" />
          </div>
        )}
      </div>
    </div>
    <CardExpandModal cardId={expandModal.expandedCard} onClose={expandModal.close} />
    </>
  );
}
