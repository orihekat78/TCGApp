import type { JSX } from 'react';
import { def as readDef } from '@/engine/read/def.js';
import { CardArt } from './CardArt.js';
import './SelectableCardTile.css';

export type SelectableCardTileProps = {
  cardId: string;
  instanceId: string;
  hidden?: boolean;
  hiddenLabel?: string;
  selectTestId?: string;
  onSelect: (instanceId: string) => void;
  onExpand?: (cardId: string) => void;
};

export function SelectableCardTile({
  cardId,
  instanceId,
  hidden = false,
  hiddenLabel = '伏せられたカード',
  selectTestId,
  onSelect,
  onExpand,
}: SelectableCardTileProps): JSX.Element {
  const card = hidden ? undefined : readDef.card(cardId);
  const name = card?.names[0] ?? cardId;
  const canExpand = !hidden && onExpand !== undefined;

  const select = (): void => onSelect(instanceId);
  const expand = (): void => onExpand?.(cardId);

  return (
    <div
      className={`selectable-card-tile${hidden ? ' selectable-card-tile--hidden' : ''}`}
    >
      <button
        type="button"
        className="selectable-card-tile__select"
        data-testid={selectTestId}
        data-instance-id={instanceId}
        data-card-id={hidden ? undefined : cardId}
        aria-label={hidden ? `${hiddenLabel} を選択` : `${name}を選択`}
        onClick={select}
        onContextMenu={canExpand ? (event) => {
          event.preventDefault();
          expand();
        } : undefined}
      >
        {hidden ? (
          <>
            <span className="selectable-card-tile__art" aria-hidden="true">
              <CardArt cardId={null} alt="" className="selectable-card-tile__back-art" />
            </span>
            <span className="selectable-card-tile__hidden-label">{hiddenLabel}</span>
          </>
        ) : (
          <>
          <span className="selectable-card-tile__art" aria-hidden="true">
            <CardArt cardId={cardId} alt="" />
          </span>
          <span className="selectable-card-tile__metadata">
            <span className="selectable-card-tile__name">{name}</span>
            <span className="selectable-card-tile__id">{cardId}</span>
          </span>
          </>
        )}
      </button>
      {canExpand && (
        <button
          type="button"
          className="selectable-card-tile__detail"
          data-testid="selectable-card-tile-detail"
          aria-label={`${name}の詳細を表示`}
          onClick={expand}
        >
          詳細
        </button>
      )}
    </div>
  );
}
