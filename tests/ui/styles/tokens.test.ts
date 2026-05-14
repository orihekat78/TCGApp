// Phase 7 Task 7.2: tokens.css smoke test
// CSS は宣言的なので behavior test ができない。代わりに必須トークン
// が CSS ファイル内に定義されていることを文字列レベルで検証する。
// spec: .claude/specs/2026-05-11-ui-style-tokens.md

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TOKENS_PATH = resolve(__dirname, '../../../src/ui/styles/tokens.css');

describe('tokens.css', () => {
  const css = readFileSync(TOKENS_PATH, 'utf-8');

  it('defines a :root block', () => {
    expect(css).toMatch(/:root\s*\{/);
  });

  it('declares all base palette tokens', () => {
    const required = [
      '--bg-deep', '--bg-zone', '--bg-self', '--bg-opp',
      '--bg-self-1', '--bg-self-2', '--bg-opp-1', '--bg-opp-2',
      '--bg-cell',
      '--border-zone', '--border-self', '--border-opp',
    ];
    for (const tok of required) {
      expect(css).toMatch(new RegExp(`${tok}:`));
    }
  });

  it('declares accent tokens', () => {
    for (const tok of ['--accent-gold', '--accent-blue', '--neon-blue', '--keep-out']) {
      expect(css).toMatch(new RegExp(`${tok}:`));
    }
  });

  it('declares card color palette (5 colors)', () => {
    for (const c of ['blue', 'yellow', 'red', 'green', 'purple']) {
      expect(css).toMatch(new RegExp(`--color-${c}:`));
    }
  });

  it('declares state tokens with mock-derived opacity values', () => {
    expect(css).toMatch(/--state-sleep:\s*rgba\(40,\s*80,\s*200,\s*0\.6\)/);
    expect(css).toMatch(/--state-stun:\s*rgba\(220,\s*50,\s*50,\s*0\.65\)/);
    expect(css).toMatch(/--state-named:/);
  });

  it('declares case status tokens', () => {
    expect(css).toMatch(/--case-editing:/);
    expect(css).toMatch(/--case-resolved:/);
  });

  it('declares typography tokens (with --font-jp alias)', () => {
    expect(css).toMatch(/--font-primary:/);
    expect(css).toMatch(/--font-jp:\s*var\(--font-primary\)/);
    expect(css).toMatch(/--font-mono:/);
  });

  it('declares card size hierarchy for all 8 use cases', () => {
    const sizes = [
      '--card-scene-w', '--card-scene-h',
      '--card-hand-w', '--card-hand-h',
      '--card-hand-hover-w', '--card-hand-hover-h',
      '--card-detail-w', '--card-detail-h',
      '--card-file-w', '--card-file-h',
      '--card-evidence-w', '--card-evidence-h',
      '--card-case-max-w', '--card-case-max-h',
      '--card-vs-w', '--card-vs-h',
    ];
    for (const tok of sizes) {
      expect(css).toMatch(new RegExp(`${tok}:`));
    }
  });

  it('uses 22px/0a0a0a in --keep-out (mock-derived, not 18px/000)', () => {
    expect(css).toMatch(/--keep-out:[^;]*22px[^;]*#0a0a0a/);
  });
});
