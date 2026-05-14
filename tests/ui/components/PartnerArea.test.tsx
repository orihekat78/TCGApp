// Phase 7 Task 7.5: PartnerArea tests

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { PartnerOnBoard } from '@/engine/types/game-state.js';
import { PartnerArea } from '@/ui/components/PartnerArea';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';

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
