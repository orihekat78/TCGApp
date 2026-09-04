import type { JSX } from 'react';
import { def as readDef } from '@/engine/read/def.js';
import { CardArt } from './CardArt.js';
import './SelectableCardTile.css';

export type SelectableCardTileProps = {
  cardId: string;
  instanceId: string;
  hidden?: boolean;
  hiddenLabel?: string;
  occurrenceLabel?: string;
  selectLabelSuffix?: string;
  selectTestId?: string;
  onSelect?: (instanceId: string) => void;
  onExpand?: (cardId: string) => void;
  selected?: boolean;
};

export function SelectableCardTile({
  cardId,
  instanceId,
  occurrenceLabel,
  selectLabelSuffix,
  hidden = false,
  hiddenLabel = '伏せられたカード',
  selectTestId,
  onSelect,
  onExpand,
  selected = false,
}: SelectableCardTileProps): JSX.Element {
  const card = hidden ? undefined : readDef.card(cardId);
  const name = card?.names[0] ?? cardId;
  const accessibleName = occurrenceLabel ? `${name} ${occurrenceLabel}` : name;
  const canExpand = !hidden && onExpand !== undefined;
  const visibleSelectSuffix = selectLabelSuffix ?? 'を選択';
  const hiddenSelectSuffix = selectLabelSuffix ?? ' を選択';

  const select = (): void => onSelect?.(instanceId);
  const expand = (): void => onExpand?.(cardId);
  const content = hidden ? (
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
  );

  return (
    <div
      className={`selectable-card-tile${hidden ? ' selectable-card-tile--hidden' : ''}${selected ? ' selectable-card-tile--selected' : ''}`}
    >
      {onSelect ? (
        <button
          type="button"
          className="selectable-card-tile__select"
          data-testid={selectTestId}
          data-instance-id={instanceId}
          data-card-id={hidden ? undefined : cardId}
          aria-label={hidden ? `${hiddenLabel}${hiddenSelectSuffix}` : `${accessibleName}${visibleSelectSuffix}`}
          aria-pressed={selected}
          onClick={select}
        >
          {content}
        </button>
      ) : (
        <div
          className="selectable-card-tile__content"
          data-instance-id={instanceId}
          data-card-id={hidden ? undefined : cardId}
        >
          {content}
        </div>
      )}
      {canExpand && (
        <button
          type="button"
          className="selectable-card-tile__detail"
          data-testid="selectable-card-tile-detail"
          aria-label={`${accessibleName}の詳細を表示`}
          onClick={expand}
        >
          <span aria-hidden="true">🔍</span>
        </button>
      )}
    </div>
  );
}
