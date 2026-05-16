// Phase 8.6α: GuardPickerModal tests

import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  GuardPickerModal,
  buildGuardCandidates,
  type GuardPickerCandidate,
} from '@/ui/components/GuardPickerModal';
import type { SceneCharacter } from '@/engine/types/game-state';

const cands: GuardPickerCandidate[] = [
  { uid: 'u1', cardId: 'D08003', name: '毛利蘭', ap: 5000, lp: 2 },
  { uid: 'u2', cardId: 'D08005', name: '工藤新一', ap: 6000, lp: 3 },
];

describe('GuardPickerModal', () => {
  it('returns null when open=false', () => {
    const html = renderToString(
      <GuardPickerModal open={false} candidates={cands} onPick={vi.fn()} onSkip={vi.fn()} />,
    );
    expect(html).toBe('');
  });

  it('renders header and skip button when open=true', () => {
    const html = renderToString(
      <GuardPickerModal
        open
        candidates={cands}
        attackerName="服部平次"
        onPick={vi.fn()}
        onSkip={vi.fn()}
      />,
    );
    expect(html).toContain('data-testid="guard-picker-modal"');
    expect(html).toContain('ガード判定');
    expect(html).toContain('服部平次');
    expect(html).toContain('ガードしない');
  });

  it('renders each candidate as a button with name and stats', () => {
    const html = renderToString(
      <GuardPickerModal open candidates={cands} onPick={vi.fn()} onSkip={vi.fn()} />,
    );
    expect(html).toContain('data-testid="guard-cand-u1"');
    expect(html).toContain('data-testid="guard-cand-u2"');
    expect(html).toContain('毛利蘭');
    expect(html).toContain('工藤新一');
    expect(html).toMatch(/AP\D*5000/);
    expect(html).toMatch(/LP\D*3/);
  });

  it('shows empty message when candidates is empty', () => {
    const html = renderToString(
      <GuardPickerModal open candidates={[]} onPick={vi.fn()} onSkip={vi.fn()} />,
    );
    expect(html).toContain('ガードできるキャラがいません');
  });
});

describe('buildGuardCandidates', () => {
  const baseCh = (uid: string, state: 'active' | 'sleep' | 'stun'): SceneCharacter =>
    ({
      uid,
      cardId: 'D08003',
      state,
      isNamed: false,
      apOverride: null,
      lpOverride: null,
      setCards: [],
      stackedCards: 0,
      enterOrder: 0,
      enterTurn: 1,
    } as unknown as SceneCharacter);

  it('includes only active characters', () => {
    const resolver = () => ({ name: 'N', ap: 1000, lp: 1 });
    const out = buildGuardCandidates(
      [baseCh('a', 'active'), baseCh('b', 'sleep'), baseCh('c', 'stun'), baseCh('d', 'active')],
      resolver,
    );
    expect(out.map((c) => c.uid).sort()).toEqual(['a', 'd']);
  });
});
