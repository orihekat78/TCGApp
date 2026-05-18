// Phase 7 Task 7.8: FileArea tests

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { FileCard } from '@/engine/types/game-state.js';
import { FileArea } from '@/ui/components/FileArea';
import type { ResolvedCardMeta } from '@/ui/components/SceneArea';

function strip(html: string): string {
  return html.replace(/<!--.*?-->/g, '');
}

const resolveCard = (cardId: string): ResolvedCardMeta => ({
  name: cardId === 'P-Conan' ? '探偵パートナー' : '???',
  color: cardId === 'P-Conan' ? 'blue' : 'yellow',
  ap: 0, lp: 1, lv: 0,
});

// Round 3: FileCard.card-back に cardId 必須 (placeholder で OK、表示は裏向き統一)
const cardBack: FileCard = { type: 'card-back', cardId: 'C-PLACE' };
const assisted = (cardId: string): FileCard => ({ type: 'assisted-partner', cardId });

describe('FileArea', () => {
  it('renders zone shell with side class', () => {
    const html = strip(renderToString(
      <FileArea cards={[]} side="self" />,
    ));
    expect(html).toMatch(/file-area side-self/);
    expect(html).toMatch(/zone file-strip/);
    expect(html).toMatch(/file-strip-header/);
    expect(html).toMatch(/<span>FILE<\/span>/);
  });

  it('shows empty state when count is 0 (no card-back, count=0)', () => {
    const html = strip(renderToString(
      <FileArea cards={[]} side="self" />,
    ));
    expect(html).toMatch(/data-count="0"/);
    expect(html).toMatch(/class="count">0</);
    expect(html).toMatch(/class="count-overlay">0</);
    expect(html).toMatch(/card-back empty/);
    // 7マス進捗はすべて空
    expect(html).not.toMatch(/class="filled"/);
  });

  it('renders 4 card-backs as a stack with count=4 and 4/7 progress', () => {
    const cards: FileCard[] = [cardBack, cardBack, cardBack, cardBack];
    const html = strip(renderToString(
      <FileArea cards={cards} side="self" />,
    ));
    expect(html).toMatch(/data-count="4"/);
    expect(html).toMatch(/class="count">4</);
    expect(html).toMatch(/class="count-overlay">4</);
    // 7マス進捗で 4 filled
    expect(html.match(/class="filled"/g)?.length).toBe(4);
    // progress-fill 幅 = 4/7 ≈ 57.14% (float)
    expect(html).toMatch(/width:\s*57\.\d+%/);
  });

  it('renders 7 card-backs at threshold (100% progress)', () => {
    const cards: FileCard[] = Array.from({ length: 7 }, () => cardBack);
    const html = strip(renderToString(
      <FileArea cards={cards} side="self" />,
    ));
    expect(html).toMatch(/data-count="7"/);
    expect(html.match(/class="filled"/g)?.length).toBe(7);
    expect(html).toMatch(/width:\s*100%/);
  });

  it('promotes assisted-partner to top of stack and renders partner mark', () => {
    const cards: FileCard[] = [cardBack, cardBack, cardBack, cardBack, cardBack, assisted('P-Conan')];
    const html = strip(renderToString(
      <FileArea cards={cards} side="self" resolveCard={resolveCard} />,
    ));
    expect(html).toMatch(/data-count="6"/);
    // Round 3: assisted-partner も card-back と同じ虫眼鏡 + monogram で表示 (名前/識別非表示)
    expect(html).toMatch(/assisted-partner/);
    expect(html).toMatch(/data-card-id="P-Conan"/);
    expect(html).not.toMatch(/partner-mark/);
    expect(html).not.toMatch(/partner-name/);
    // count バッジは 6 (FILE 全体)
    expect(html).toMatch(/class="count-overlay">6</);
  });

  it('Round 3: assisted-partner も裏向き表示 (partner-name / partner-mark 描画されない)', () => {
    const cards: FileCard[] = [cardBack, assisted('P-???')];
    const html = strip(renderToString(
      <FileArea cards={cards} side="self" />,
    ));
    // Round 3: assisted-partner 表示は card-back と統一 (虫眼鏡 + monogram)
    expect(html).toMatch(/assisted-partner/);
    expect(html).not.toMatch(/partner-name/);
    expect(html).not.toMatch(/partner-mark/);
  });

  it('respects custom threshold (e.g. 5)', () => {
    const cards: FileCard[] = [cardBack, cardBack, cardBack];
    const html = strip(renderToString(
      <FileArea cards={cards} side="self" threshold={5} />,
    ));
    // 5 マス進捗で 3 filled
    expect(html.match(/class="filled"/g)?.length).toBe(3);
    expect(html).toMatch(/aria-valuemax="5"/);
    expect(html).toMatch(/aria-valuenow="3"/);
    expect(html).toMatch(/width:\s*60%/);
  });

  it('caps fillPct at 100% even when count exceeds threshold', () => {
    const cards: FileCard[] = Array.from({ length: 10 }, () => cardBack);
    const html = strip(renderToString(
      <FileArea cards={cards} side="self" threshold={7} />,
    ));
    expect(html).toMatch(/data-count="10"/);
    expect(html.match(/class="filled"/g)?.length).toBe(7);
    expect(html).toMatch(/width:\s*100%/);
  });

  it('applies side-opp class for opponent', () => {
    const html = strip(renderToString(
      <FileArea cards={[cardBack]} side="opp" />,
    ));
    expect(html).toMatch(/file-area side-opp/);
    expect(html).toMatch(/data-side="opp"/);
  });

  it('aria-valuenow on progressbar matches min(count, threshold)', () => {
    const cards: FileCard[] = [cardBack, cardBack, cardBack];
    const html = strip(renderToString(
      <FileArea cards={cards} side="self" />,
    ));
    expect(html).toMatch(/role="progressbar"/);
    expect(html).toMatch(/aria-valuemin="0"/);
    expect(html).toMatch(/aria-valuemax="7"/);
    expect(html).toMatch(/aria-valuenow="3"/);
  });
});
