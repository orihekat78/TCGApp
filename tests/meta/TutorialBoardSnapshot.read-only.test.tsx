import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { TutorialBoardSnapshot } from '../../meta-app/src/screens/tutorial/TutorialBoardSnapshot';

vi.mock('@/ui/components/Playmat', () => ({
  Playmat: ({ replayReadOnly }: { replayReadOnly?: boolean }) => (
    <div data-replay-read-only={String(replayReadOnly ?? false)} />
  ),
}));

vi.mock('@/ui/fixtures/sampleGameState', () => ({
  createSampleGameState: () => ({ players: {} }),
}));

describe('TutorialBoardSnapshot read-only composition', () => {
  it('renders the shared Playmat with every live driver disabled', () => {
    const html = renderToString(
      <TutorialBoardSnapshot zones={[]} activeKey={null} paneWidth={960} />,
    );

    expect(html).toContain('data-replay-read-only="true"');
  });
});
