// Phase 8.6β: CutInDisguisePickerModal tests

import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  CutInDisguisePickerModal,
  type CutInDisguiseCandidate,
} from '@/ui/components/CutInDisguisePickerModal';

const cands: CutInDisguiseCandidate[] = [
  { cardId: 'EV1', name: 'AP+2000', kind: 'cutin' },
  { cardId: 'CH1', name: '変装少年', kind: 'disguise' },
];

describe('CutInDisguisePickerModal', () => {
  it('returns null when open=false', () => {
    const html = renderToString(
      <CutInDisguisePickerModal
        open={false}
        actorLabel="1番目"
        candidates={cands}
        onPickCutIn={vi.fn()}
        onPickDisguise={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(html).toBe('');
  });

  it('renders actor label and pass button when open', () => {
    const html = renderToString(
      <CutInDisguisePickerModal
        open
        actorLabel="1番目"
        candidates={cands}
        onPickCutIn={vi.fn()}
        onPickDisguise={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(html).toContain('data-testid="cid-picker-modal"');
    expect(html).toContain('1番目');
    expect(html).toContain('data-testid="cid-pass"');
  });

  it('renders cutin and disguise candidates in separate sections', () => {
    const html = renderToString(
      <CutInDisguisePickerModal
        open
        actorLabel="2番目"
        candidates={cands}
        onPickCutIn={vi.fn()}
        onPickDisguise={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    expect(html).toContain('data-testid="cid-cutin-EV1"');
    expect(html).toContain('AP+2000');
    expect(html).toContain('data-testid="cid-disg-CH1"');
    expect(html).toContain('変装少年');
  });

  it('shows empty messages for each section when no candidates of that kind', () => {
    const html = renderToString(
      <CutInDisguisePickerModal
        open
        actorLabel="1番目"
        candidates={[]}
        onPickCutIn={vi.fn()}
        onPickDisguise={vi.fn()}
        onPass={vi.fn()}
      />,
    );
    // 2 sections × empty = 2 empty messages
    const matches = html.match(/使用可能なカードなし/g);
    expect(matches?.length).toBe(2);
  });
});
