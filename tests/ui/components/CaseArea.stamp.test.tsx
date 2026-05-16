// Phase 8.10h: CaseArea stamp-flip class application

import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { CaseArea } from '@/ui/components/CaseArea';

const baseInfo = {
  cardId: 'D08026',
  title: '青の古城探索事件',
  color: 'blue' as const,
  level: 7,
  requiredEvidence: 7,
  orientation: 'portrait' as const,
};

describe('CaseArea — 解決編 stamp class', () => {
  it('does NOT apply resolved class while 事件編', () => {
    const html = renderToString(
      <CaseArea
        caseInfo={{ ...baseInfo, status: '事件編' }}
        turnOrder="first"
        side="self"
      />,
    );
    expect(html).toContain('case-stamp');
    expect(html).not.toContain('case-stamp resolved');
    expect(html).not.toMatch(/case-stamp[^"]*\bresolved\b/);
  });

  it('applies resolved class when 解決編 (animation hook)', () => {
    const html = renderToString(
      <CaseArea
        caseInfo={{ ...baseInfo, status: '解決編' }}
        turnOrder="first"
        side="self"
      />,
    );
    expect(html).toMatch(/case-stamp[^"]*\bresolved\b/);
  });
});
