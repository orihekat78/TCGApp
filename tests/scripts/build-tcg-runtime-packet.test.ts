import { describe, expect, it } from 'vitest';

import {
  buildRuntimePacket,
  parseCliArguments,
  validateRuntimePacketInputs,
  verifyRuntimePacket,
} from '../../scripts/build-tcg-runtime-packet.mjs';

const registry = {
  schemaVersion: 1,
  sources: [
    {
      sourceId: 'CONAN-VICTORY',
      path: '.claude/rules/01-victory-conditions.md',
      classification: 'validated-rule',
      status: 'validated',
      sourceVersion: 'Ver.2.4',
    },
    {
      sourceId: 'PLAY-POLICY',
      path: '.claude/specs/tcg-expert-play/ai-decision-policy.md',
      classification: 'reviewed-policy',
      status: 'reviewed',
      sourceVersion: 'workspace-review-1',
    },
  ],
};

const manifest = {
  schemaVersion: 1,
  row: '026',
  ruleBaseline: 'Ver.2.4',
  informationMode: 'public-ui-only',
  allowedOperations: ['visible-click', 'visible-read'],
  sources: [
    { sourceId: 'CONAN-VICTORY', lineStart: 1, lineEnd: 2 },
    { sourceId: 'PLAY-POLICY', lineStart: 1, lineEnd: 1 },
  ],
  unresolved: [],
};

const files = new Map([
  ['.claude/rules/01-victory-conditions.md', '# victory\nWin with evidence.\nOther text.\n'],
  ['.claude/specs/tcg-expert-play/ai-decision-policy.md', '# policy\nPublic only.\n'],
]);
const readText = (path: string) => files.get(path);
const context = {
  sourceCommit: 'f58365649e220d63992751fbec93680b5172f379',
  generatedAt: '2026-07-27T00:00:00.000Z',
  isWorktreeClean: true,
};

describe('buildRuntimePacket', () => {
  it('freezes registered line ranges with provenance and content', () => {
    const inputs = { manifest, registry, ...context };

    expect(validateRuntimePacketInputs(inputs, readText)).toEqual([]);
    const packet = buildRuntimePacket(inputs, readText);
    expect(packet).toMatchObject({
      schemaVersion: 2,
      sourceCommit: context.sourceCommit,
      generatedAt: context.generatedAt,
      row: '026',
      ruleBaseline: 'Ver.2.4',
      informationMode: 'public-ui-only',
      allowedOperations: ['visible-click', 'visible-read'],
      sources: [
        {
          sourceId: 'CONAN-VICTORY',
          classification: 'validated-rule',
          sourceVersion: 'Ver.2.4',
          lineStart: 1,
          lineEnd: 2,
          content: '# victory\nWin with evidence.',
        },
        {
          sourceId: 'PLAY-POLICY',
          classification: 'reviewed-policy',
          lineStart: 1,
          lineEnd: 1,
          content: '# policy',
        },
      ],
    });
    expect(packet.packetSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(packet.sources.every((source) => /^[0-9a-f]{64}$/.test(source.sha256))).toBe(true);
    expect(buildRuntimePacket(inputs, readText)).toEqual(packet);
  });

  it.each([
    ['empty sources', { manifest: { ...manifest, sources: [] } }, 'at least one registered source'],
    ['unresolved gate', { manifest: { ...manifest, unresolved: ['Escape browser regression'] } }, 'unresolved requirement'],
    ['invalid row', { manifest: { ...manifest, row: 'bogus' } }, 'row must be three digits'],
    ['invalid mode', { manifest: { ...manifest, informationMode: 'internal-state' } }, 'informationMode'],
    ['invalid operation', { manifest: { ...manifest, allowedOperations: ['dispatch'] } }, 'allowed operation'],
    ['dirty worktree', { isWorktreeClean: false }, 'worktree is dirty'],
    ['fake commit', { sourceCommit: 'abc1234' }, '40-character Git commit'],
    [
      'unregistered source',
      { manifest: { ...manifest, sources: [{ sourceId: 'SELF-ASSERTED', lineStart: 1, lineEnd: 1 }] } },
      'source is not registered',
    ],
    [
      'line range outside file',
      { manifest: { ...manifest, sources: [{ sourceId: 'CONAN-VICTORY', lineStart: 1, lineEnd: 99 }] } },
      'line range is outside source',
    ],
    [
      'registry source path outside repository',
      {
        registry: {
          ...registry,
          sources: registry.sources.map((source) => source.sourceId === 'CONAN-VICTORY'
            ? { ...source, path: '../private-rule.md' }
            : source),
        },
      },
      'registry source path escapes repository',
    ],
    [
      'mixed rules version',
      {
        registry: {
          ...registry,
          sources: registry.sources.map((source) => source.sourceId === 'CONAN-VICTORY'
            ? { ...source, sourceVersion: 'Ver.2.5' }
            : source),
        },
      },
      'does not match rule baseline',
    ],
  ])('rejects %s', (_name, overrides, expected) => {
    const inputs = {
      manifest,
      registry,
      ...context,
      ...overrides,
    };
    expect(validateRuntimePacketInputs(inputs, readText).join('\n')).toContain(expected);
    expect(() => buildRuntimePacket(inputs, readText)).toThrow(expected);
  });

  it('rejects an unreviewed registry classification', () => {
    const unsafeRegistry = {
      ...registry,
      sources: registry.sources.map((source) => source.sourceId === 'PLAY-POLICY'
        ? { ...source, classification: 'research-untrusted', status: 'unreviewed' }
        : source),
    };
    const inputs = { manifest, registry: unsafeRegistry, ...context };
    expect(validateRuntimePacketInputs(inputs, readText).join('\n')).toContain('registry source is not approved');
  });
});

describe('parseCliArguments', () => {
  it('requires manifest and registry paths instead of trusting source flags', () => {
    expect(() => parseCliArguments([])).toThrow('Usage:');
    expect(() => parseCliArguments(['abc1234', '2026-07-27', '026', 'bogus.md'])).toThrow('unknown argument');
    expect(parseCliArguments([
      '--manifest', '.claude/specs/tcg-expert-play/row-026-runtime-input.json',
      '--registry', '.claude/research/tcg-expert-play/runtime-source-register.json',
    ])).toEqual({
      manifestPath: '.claude/specs/tcg-expert-play/row-026-runtime-input.json',
      registryPath: '.claude/research/tcg-expert-play/runtime-source-register.json',
      outputPath: undefined,
    });
  });

  it('rejects CLI paths outside the repository', () => {
    expect(() => parseCliArguments([
      '--manifest', '../row-026-runtime-input.json',
      '--registry', '.claude/research/tcg-expert-play/runtime-source-register.json',
    ])).toThrow('CLI path escapes repository');
  });
});

describe('verifyRuntimePacket', () => {
  it('accepts the untampered packet for the expected commit and row', () => {
    const packet = buildRuntimePacket({ manifest, registry, ...context }, readText);
    expect(verifyRuntimePacket(
      packet,
      registry,
      { sourceCommit: context.sourceCommit, row: '026' },
      readText,
    )).toEqual([]);
  });

  it.each([
    ['packet content', (packet: ReturnType<typeof buildRuntimePacket>) => ({
      ...packet,
      sources: packet.sources.map((source, index) => index === 0
        ? { ...source, content: `${source.content}\ntampered` }
        : source),
    }), 'packetSha256 does not match'],
    ['expected commit', (packet: ReturnType<typeof buildRuntimePacket>) => packet, 'sourceCommit does not match'],
    ['expected row', (packet: ReturnType<typeof buildRuntimePacket>) => packet, 'row does not match'],
  ])('rejects changed %s', (name, mutate, expected) => {
    const packet = mutate(buildRuntimePacket({ manifest, registry, ...context }, readText));
    const expectedContext = {
      sourceCommit: name === 'expected commit' ? '0'.repeat(40) : context.sourceCommit,
      row: name === 'expected row' ? '027' : '026',
    };
    expect(verifyRuntimePacket(packet, registry, expectedContext, readText).join('\n')).toContain(expected);
  });

  it('rejects source or registry drift after packet generation', () => {
    const packet = buildRuntimePacket({ manifest, registry, ...context }, readText);
    const changedFiles = new Map(files);
    changedFiles.set('.claude/rules/01-victory-conditions.md', '# changed\n');
    expect(verifyRuntimePacket(
      packet,
      registry,
      { sourceCommit: context.sourceCommit, row: '026' },
      (path: string) => changedFiles.get(path),
    ).join('\n')).toContain('source file hash does not match');

    const changedRegistry = {
      ...registry,
      sources: registry.sources.map((source) => source.sourceId === 'PLAY-POLICY'
        ? { ...source, sourceVersion: 'workspace-review-2' }
        : source),
    };
    expect(verifyRuntimePacket(
      packet,
      changedRegistry,
      { sourceCommit: context.sourceCommit, row: '026' },
      readText,
    ).join('\n')).toContain('registry provenance does not match');
  });
});
