import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function driverCallCount(text: string): number {
  return text.match(/\buseEffectPickFlowDriver\s*\(/g)?.length ?? 0;
}

describe('public effect decision driver ownership', () => {
  it('keeps one replay-gated owner in each public root and none in Playmat', () => {
    const app = source('src/App.tsx');
    const realMatch = source('meta-app/src/screens/RealMatchView.tsx');
    const playmat = source('src/ui/components/Playmat.tsx');

    expect(driverCallCount(app)).toBe(1);
    expect(driverCallCount(realMatch)).toBe(1);
    expect(driverCallCount(playmat)).toBe(0);
    expect(app).toContain('useEffectPickFlowDriver(replayDriver.state.log === null);');
    expect(realMatch).toContain('useEffectPickFlowDriver(replayDriver.state.log === null);');
  });
});
