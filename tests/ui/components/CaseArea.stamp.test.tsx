import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CaseArea } from '@/ui/components/CaseArea';

describe('CaseArea — 事件状態の所有', () => {
  it('事件未開始の状態も空の事件ヘッダー内に表示する', () => {
    const html = renderToString(
      <CaseArea caseInfo={null} turnOrder="first" side="self" />,
    );

    expect(html).toContain('class="case-edition-tag"');
    expect(html).toContain('aria-label="事件状態: 未開始"');
    expect(html).not.toContain('case-stamp');
  });
});
