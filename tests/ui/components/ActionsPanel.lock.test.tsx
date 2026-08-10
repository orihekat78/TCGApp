// tests/ui/components/ActionsPanel.lock — 効果解決中ロック (rules/05 割り込み禁止)
// interactionLocked=true で全 8 メインアクションが disabled 化されること (SSR render で検証)。
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { ActionsPanel, type ActionsPanelProps } from '@/ui/components/ActionsPanel';

// 全アクションが本来は有効になる props (lock の効果を分離して見るため)。
function enabledProps(over: Partial<ActionsPanelProps> = {}): ActionsPanelProps {
  return {
    handCount: 3, handUseRemaining: 1, handUseUsed: false,
    nextHintFileCount: 2, nextHintUsed: false, canNextHint: true,
    partnerActive: true, partnerAbilityCount: 1, declaredTargetCount: 2, reasoningTotalLP: 5,
    canAssist: true, canSolveCase: true,
    actionMode: 'idle', currentPhase: 'main', canEndTurn: true,
    ...over,
  };
}
const count = (s: string, sub: string) => s.split(sub).length - 1;

describe('ActionsPanel interactionLocked', () => {
  it('renders every primary action as a native keyboard-operable button', () => {
    const html = renderToString(<ActionsPanel {...enabledProps({ onActionItemClick: () => undefined })} />);
    expect(html.match(/<button[^>]*data-action-id=/g)).toHaveLength(8);
    expect(html).not.toMatch(/<li[^>]*data-action-id=/);
  });

  it('非ロック時は有効アクションが disabled にならない', () => {
    const html = renderToString(<ActionsPanel {...enabledProps()} />);
    expect(count(html, 'aria-disabled="true"')).toBe(0);
    expect(html).not.toContain('actions-panel locked');
  });

  it('ロック時は 8 メインアクション全てが disabled + panel に locked クラス', () => {
    const html = renderToString(<ActionsPanel {...enabledProps({ interactionLocked: true })} />);
    expect(count(html, 'aria-disabled="true"')).toBe(8);
    expect(count(html, 'action-item disabled')).toBe(8);
    expect(html).toContain('actions-panel locked');
    expect(html).toMatch(/class="end-turn-btn"[^>]*disabled/);
  });

  it('有効で支払可能なパートナー能力が0件なら「能力なし」で無効化する', () => {
    const html = renderToString(<ActionsPanel {...enabledProps({ partnerAbilityCount: 0 })} />);
    expect(html).toMatch(/data-action-id="partner-ability"[^>]*aria-disabled="true"/);
    expect(html).toContain('能力なし');
    expect(html).not.toContain('パートナーの能力</span><span class="action-subtitle">使用可');
  });
});
