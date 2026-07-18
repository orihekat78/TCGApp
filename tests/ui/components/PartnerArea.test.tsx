// Phase 7 Task 7.5: PartnerArea tests

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { registerAll } from '@/cards';
import type { PartnerOnBoard } from '@/engine/types/game-state.js';
import { PartnerArea } from '@/ui/components/PartnerArea';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const resolveCard = (cardId: string): ResolvedCardMeta => ({
  name: cardId === 'P-Conan' ? '江戸川 コナン' : '萩原 千速',
  color: cardId === 'P-Conan' ? 'blue' : 'yellow',
  ap: 0,
  lp: 1,
  lv: 0,
});

function strip(html: string): string {
  return html.replace(/<!--.*?-->/g, '');
}

function makePartner(overrides: Partial<PartnerOnBoard> = {}): PartnerOnBoard {
  return {
    cardId: 'P-Conan',
    state: 'active',
    location: 'partner-area',
    ...overrides,
  };
}

describe('PartnerArea', () => {
  it('renders empty (only keyhole watermark) when partner is null', () => {
    const html = strip(renderToString(
      <PartnerArea partner={null} side="self" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/partner-area side-self/);
    expect(html).toMatch(/zone-watermark-keyhole/);
    expect(html).not.toMatch(/class="card /);
    expect(html).not.toMatch(/partner-info/);
  });

  it('renders the partner card + info when location=partner-area', () => {
    const html = strip(renderToString(
      <PartnerArea partner={makePartner()} side="self" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/class="card color-blue"/);
    expect(html).toMatch(/data-card-id="P-Conan"/);
    expect(html).toMatch(/江戸川 コナン/);
    expect(html).toMatch(/青 \/ LP 1/);
    expect(html).toMatch(/アクティブ/);
  });

  it('renders sleep state (rotate -90 via class)', () => {
    const html = strip(renderToString(
      <PartnerArea
        partner={makePartner({ state: 'sleep' })}
        side="self"
        resolveCard={resolveCard}
      />,
    ));
    expect(html).toMatch(/class="card color-blue sleep"/);
    expect(html).toMatch(/スリープ/);
  });

  it('renders stun state', () => {
    const html = strip(renderToString(
      <PartnerArea
        partner={makePartner({ state: 'stun' })}
        side="self"
        resolveCard={resolveCard}
      />,
    ));
    expect(html).toMatch(/class="card color-blue stun"/);
    expect(html).toMatch(/スタン/);
  });

  it('shows "アシスト中" status tag when location=file-area, no card rendered', () => {
    const html = strip(renderToString(
      <PartnerArea
        partner={makePartner({ location: 'file-area', state: 'sleep' })}
        side="self"
        resolveCard={resolveCard}
      />,
    ));
    expect(html).toMatch(/status-tag assist/);
    expect(html).toMatch(/アシスト中/);
    expect(html).not.toMatch(/class="card /);
  });

  it('shows "MR リムーブ" status tag when location=mr-removed', () => {
    const html = strip(renderToString(
      <PartnerArea
        partner={makePartner({ location: 'mr-removed' })}
        side="self"
        resolveCard={resolveCard}
      />,
    ));
    expect(html).toMatch(/status-tag mr/);
    expect(html).toMatch(/MR リムーブ/);
    expect(html).not.toMatch(/class="card /);
  });

  it('applies side-opp class for opponent', () => {
    const html = strip(renderToString(
      <PartnerArea partner={makePartner()} side="opp" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/partner-area side-opp/);
  });

  it('renders different color partner correctly', () => {
    const html = strip(renderToString(
      <PartnerArea
        partner={makePartner({ cardId: 'P-Chihaya' })}
        side="self"
        resolveCard={resolveCard}
      />,
    ));
    expect(html).toMatch(/class="card color-yellow"/);
    expect(html).toMatch(/萩原 千速/);
    expect(html).toMatch(/黄 \/ LP 1/);
  });
});

describe('PartnerArea partner-area cards', () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  beforeEach(() => {
    registerAll();
  });

  afterEach(() => {
    if (root) act(() => root!.unmount());
    container?.remove();
    root = null;
    container = null;
  });

  it('renders duplicate B07059 partner-area cards with their real official image source and independent detail controls', () => {
    const onExpand = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(
      <PartnerArea
        partner={null}
        side="self"
        resolveCard={resolveCard}
        paCards={['B07059', 'B07059']}
        onExpand={onExpand}
      />,
    ));

    const primaries = [...container.querySelectorAll<HTMLButtonElement>('[data-testid^="pa-card-self-"]')];
    const details = [...container.querySelectorAll<HTMLButtonElement>('[data-testid^="pa-card-detail-self-"]')];
    expect(primaries).toHaveLength(2);
    expect(details).toHaveLength(2);
    const primaryLabels = primaries.map((button) => button.getAttribute('aria-label'));
    const detailLabels = details.map((button) => button.getAttribute('aria-label'));
    expect(primaryLabels.every((label) => label?.includes('詳細を表示'))).toBe(true);
    expect(detailLabels.every((label) => label?.includes('詳細を表示'))).toBe(true);
    expect(new Set(primaryLabels).size).toBe(2);
    expect(new Set(detailLabels).size).toBe(2);
    expect(primaries.every((button) => button instanceof HTMLButtonElement)).toBe(true);
    expect(details.every((button) => button instanceof HTMLButtonElement)).toBe(true);
    expect(container.querySelectorAll('.pa-card img.card-art')).toHaveLength(2);
    const images = [...container.querySelectorAll<HTMLImageElement>('.pa-card img.card-art')];
    expect(images.every((image) => image.src.endsWith('/1762414010617160.jpg'))).toBe(true);
    expect(images.every((image) => !image.src.startsWith('data:image/svg+xml'))).toBe(true);
    expect(container.querySelector('button button')).toBeNull();

    act(() => details[1]!.click());
    expect(onExpand).toHaveBeenCalledWith('B07059');

    const context = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    act(() => primaries[0]!.dispatchEvent(context));
    expect(context.defaultPrevented).toBe(true);
    expect(onExpand).toHaveBeenLastCalledWith('B07059');
    expect(onExpand).toHaveBeenCalledTimes(2);
  });
});
