// Phase 7 Task 7.3: Playmat layout structure tests
// renderToString で SSR snapshot + class/構造アサーション

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Playmat } from '@/ui/components/Playmat';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';

const resolveCard = (_cardId: string): ResolvedCardMeta => ({
  name: '???',
  color: 'blue',
  ap: 0,
  lp: 0,
  lv: 0,
});

describe('Playmat', () => {
  it('renders the scaler + stage shell at 1920×1080', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html).toMatch(/class="scaler"/);
    expect(html).toMatch(/id="scaler"/);
    expect(html).toMatch(/class="stage"/);
  });

  it('renders background and vignette layers', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html).toMatch(/class="bg"/);
    expect(html).toMatch(/class="vignette"/);
  });

  it('renders TopBar placeholder (Task 7.12 待ち) + HandZone (real component)', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html).toMatch(/topbar-placeholder/);
    // HandZone real component (empty when no resolveHandCard)
    expect(html).toMatch(/hand-zone hand-zone--empty/);
    expect(html).toMatch(/手札なし/);
  });

  it('renders LogPanel (real component, closed by default)', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html).toMatch(/class="log-panel"/);
    expect(html).not.toMatch(/log-panel open/);
    expect(html).toMatch(/class="log-btn"/);
    expect(html).toMatch(/class="log-btn-count">0/);
  });

  it('renders EffectStackPanel (real component, closed by default with empty stack)', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html).toMatch(/class="effect-stack-panel"/);
    expect(html).not.toMatch(/effect-stack-panel open/);
    expect(html).toMatch(/effect-stack-label">効果解決</);
    expect(html).toMatch(/effect-stack-empty">—</);
  });

  it('renders both opponent and self mats inside play-area', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html).toMatch(/class="play-area"/);
    expect(html).toMatch(/class="mat opp"[^>]*data-side="opp"/);
    expect(html).toMatch(/class="mat self"[^>]*data-side="self"/);
  });

  it('mats are in opp → self order so opp can rotate 180° with KEEP OUT between', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    const oppIdx = html.indexOf('data-side="opp"');
    const keepOutIdx = html.indexOf('class="keep-out"');
    const selfIdx = html.indexOf('data-side="self"');
    expect(oppIdx).toBeGreaterThan(0);
    expect(keepOutIdx).toBeGreaterThan(oppIdx);
    expect(selfIdx).toBeGreaterThan(keepOutIdx);
  });

  it('renders KEEP OUT divider (spec 要求、mock では display:none で抑止されているが復活)', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html).toMatch(/class="keep-out"[^>]*role="separator"/);
    expect(html).toMatch(/aria-label="KEEP OUT"/);
  });

  it('renders SceneArea inside each mat with correct side prop', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html.match(/scene-area side-opp/g)?.length).toBe(1);
    expect(html.match(/scene-area side-self/g)?.length).toBe(1);
  });

  it('renders all 6 zone slots per mat: case / scene / partner / deck / remove / file', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    // 各ゾーンは 2 (opp + self) で計 12
    expect(html.match(/class="case-col"/g)?.length).toBe(2);
    expect(html.match(/case-area side-/g)?.length).toBe(2);
    expect(html.match(/evidence-area side-/g)?.length).toBe(2);
    expect(html.match(/scene-col scene-zone/g)?.length).toBe(2);
    expect(html.match(/partner-col partner-zone/g)?.length).toBe(2);
    expect(html.match(/deck-col deck-zone/g)?.length).toBe(2);
    expect(html.match(/remove-col remove-zone/g)?.length).toBe(2);
    // FileArea が file-row placeholder を置換 (zone file-strip + file-area)
    expect(html.match(/file-area side-/g)?.length).toBe(2);
  });

  it('renders CaseArea (real component, empty when null state)', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html.match(/case-area side-opp/g)?.length).toBe(1);
    expect(html.match(/case-area side-self/g)?.length).toBe(1);
    expect(html.match(/case-empty/g)?.length).toBe(2);
    // "未開始" は aria-label + 表示テキストの両方に含まれるため計 4 件
    expect(html.match(/未開始/g)?.length).toBe(4);
  });

  it('renders PartnerArea (real component) inside each mat', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html.match(/partner-area side-opp/g)?.length).toBe(1);
    expect(html.match(/partner-area side-self/g)?.length).toBe(1);
    expect(html.match(/zone-watermark-keyhole/g)?.length).toBe(2);
  });

  it('renders DeckArea (real component) inside each mat with count=0 when null state', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html.match(/deck-area side-opp/g)?.length).toBe(1);
    expect(html.match(/deck-area side-self/g)?.length).toBe(1);
    expect(html.match(/class="deck-count">0</g)?.length).toBe(2);
    expect(html.match(/deck-empty/g)?.length).toBe(2);
  });

  it('renders RemoveArea (real component) inside each mat (EMPTY when null state)', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    expect(html.match(/remove-area side-opp/g)?.length).toBe(1);
    expect(html.match(/remove-area side-self/g)?.length).toBe(1);
    expect(html.match(/class="count zero">0</g)?.length).toBe(2);
    expect(html.match(/class="stack-empty"/g)?.length).toBe(2);
  });

  it('renders empty SceneArea (5/5) when gameState is null', () => {
    const html = renderToString(<Playmat gameState={null} resolveCard={resolveCard} />);
    // 5 empty slots per mat × 2 mats = 10 .slot-empty divs
    expect(html.match(/slot-empty/g)?.length).toBe(10);
  });
});
