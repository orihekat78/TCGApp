// user_request 20260521_01 #12: SpectatorHUD tests

import { describe, it, expect, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';
import { SpectatorHUD } from '@/ui/components/SpectatorHUD';
import { useGameStateStore } from '@/ui/state/store';

describe('SpectatorHUD', () => {
  beforeEach(() => {
    useGameStateStore.setState({ spectatorMode: false, aiSpeedMs: 400 });
  });

  it('renders nothing when spectatorMode === false', () => {
    const html = renderToString(<SpectatorHUD />);
    expect(html).toBe('');
  });

  it('renders HUD when spectatorMode === true', () => {
    useGameStateStore.setState({ spectatorMode: true, aiSpeedMs: 400 });
    const html = renderToString(<SpectatorHUD />);
    expect(html).toContain('spectator-hud');
    expect(html).toContain('AI 速度');
    expect(html).toContain('400ms');
  });

  it('marks current speed button as is-active', () => {
    useGameStateStore.setState({ spectatorMode: true, aiSpeedMs: 800 });
    const html = renderToString(<SpectatorHUD />);
    // 800ms ボタンが is-active + aria-pressed="true"
    expect(html).toMatch(/class="spectator-hud-preset is-active"[^>]*data-testid="spectator-speed-800"[^>]*aria-pressed="true"/);
    // 400ms ボタンは is-active なし + aria-pressed="false"
    expect(html).toMatch(/class="spectator-hud-preset "[^>]*data-testid="spectator-speed-400"[^>]*aria-pressed="false"/);
  });

  it('exposes 5 preset buttons (200/400/800/1500/3000ms)', () => {
    useGameStateStore.setState({ spectatorMode: true, aiSpeedMs: 400 });
    const html = renderToString(<SpectatorHUD />);
    expect(html).toContain('data-testid="spectator-speed-200"');
    expect(html).toContain('data-testid="spectator-speed-400"');
    expect(html).toContain('data-testid="spectator-speed-800"');
    expect(html).toContain('data-testid="spectator-speed-1500"');
    expect(html).toContain('data-testid="spectator-speed-3000"');
  });

  it('current text reflects aiSpeedMs value', () => {
    useGameStateStore.setState({ spectatorMode: true, aiSpeedMs: 1500 });
    const html = renderToString(<SpectatorHUD />);
    expect(html).toContain('1500ms');
    expect(html).not.toContain('>400ms<');
  });
});
