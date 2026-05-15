// Phase 7 Task 7.9: EvidenceArea tests

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { EvidenceArea } from '@/ui/components/EvidenceArea';

function strip(html: string): string {
  return html.replace(/<!--.*?-->/g, '');
}

describe('EvidenceArea', () => {
  it('renders zone shell with side class', () => {
    const html = strip(renderToString(
      <EvidenceArea count={0} requiredEvidence={7} side="self" />,
    ));
    expect(html).toMatch(/evidence-area side-self/);
    expect(html).toMatch(/<span>証拠<\/span>/);
    expect(html).toMatch(/role="button"/);
    expect(html).toMatch(/aria-label="証拠 0 \/ 7 枚"/);
  });

  it('shows 0/7 + no stack when empty', () => {
    const html = strip(renderToString(
      <EvidenceArea count={0} requiredEvidence={7} side="self" />,
    ));
    expect(html).toMatch(/class="count">0 \/ 7</);
    expect(html).toMatch(/class="count-overlay">0</);
    expect(html).not.toMatch(/class="stack-shadow/);
    expect(html).not.toMatch(/class="card-back"/);
    expect(html).toMatch(/width:\s*0%/);
  });

  it('renders 3/7 mid-progress with stack shadows + card-back', () => {
    const html = strip(renderToString(
      <EvidenceArea count={3} requiredEvidence={7} side="self" />,
    ));
    expect(html).toMatch(/class="count">3 \/ 7</);
    expect(html).toMatch(/class="count-overlay">3</);
    expect(html.match(/class="stack-shadow s\d"/g)?.length).toBe(3);
    expect(html).toMatch(/class="card-back"/);
    expect(html).toMatch(/width:\s*42\.\d+%/); // 3/7 ≈ 42.857%
  });

  it('reaches 100% progress + complete class when count >= required', () => {
    const html = strip(renderToString(
      <EvidenceArea count={7} requiredEvidence={7} side="self" />,
    ));
    expect(html).toMatch(/evidence-area side-self complete/);
    expect(html).toMatch(/width:\s*100%/);
    expect(html).toMatch(/aria-valuenow="7"/);
  });

  it('caps fillPct at 100% even when count > required', () => {
    const html = strip(renderToString(
      <EvidenceArea count={10} requiredEvidence={7} side="self" />,
    ));
    expect(html).toMatch(/width:\s*100%/);
    expect(html).toMatch(/complete/);
    expect(html).toMatch(/aria-valuenow="7"/); // capped at required
  });

  it('uses requiredEvidence=6 for second player', () => {
    const html = strip(renderToString(
      <EvidenceArea count={4} requiredEvidence={6} side="opp" />,
    ));
    expect(html).toMatch(/class="count">4 \/ 6</);
    expect(html).toMatch(/aria-valuemax="6"/);
    expect(html).toMatch(/aria-valuenow="4"/);
    // 4/6 ≈ 66.66%
    expect(html).toMatch(/width:\s*66\.\d+%/);
  });

  it('applies side-opp class for opponent', () => {
    const html = strip(renderToString(
      <EvidenceArea count={2} requiredEvidence={6} side="opp" />,
    ));
    expect(html).toMatch(/evidence-area side-opp/);
    expect(html).toMatch(/data-side="opp"/);
  });

  it('clamps negative count to 0', () => {
    const html = strip(renderToString(
      <EvidenceArea count={-5} requiredEvidence={7} side="self" />,
    ));
    expect(html).toMatch(/class="count">0 \/ 7</);
    expect(html).toMatch(/data-count="0"/);
  });
});
