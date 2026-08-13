import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const tempDirs: string[] = [];
const RELEASE_COMMIT = 'a'.repeat(40);

function tempDir(): string {
  const directory = mkdtempSync(join(tmpdir(), 'conan-authority-refresh-test-'));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of tempDirs.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('packet-bounded authority grounding', () => {
  it('grounds against the immutable release prior when the current prior has drifted', () => {
    const { runGroundAuthorityDiff } = require('../../scripts/cards/ground-authority-diff.cjs');
    const calls: string[][] = [];
    const packet = { basis: { releaseCommit: RELEASE_COMMIT }, diff: { added: ['B00002'] } };
    const historicalPrior = { prior: 'at-release' };

    runGroundAuthorityDiff({
      projectRoot: 'C:/project',
      packetPath: 'C:/packet/packet.json',
      loadPrior: () => { throw new Error('current prior must not be loaded'); },
      loadPriorAtCommit: (commit: string, root: string) => {
        expect(commit).toBe(RELEASE_COMMIT);
        expect(root).toBe(resolve('C:/project'));
        return historicalPrior;
      },
      readPacket: () => packet,
      validatePacket: (actual: unknown, prior: unknown) => {
        expect(actual).toBe(packet);
        expect(prior).toBe(historicalPrior);
      },
      capturePacket: () => [],
      createOutput: () => 'C:/packet/ground-authority-safe',
      ground: (ids: string[]) => calls.push(ids),
    });

    expect(calls).toEqual([['B00002']]);
  });

  it('reconstructs a bootstrap release prior from its catalog when field index did not exist', () => {
    const { loadPriorAuthorityAtReleaseCommit } = require('../../scripts/cards/ground-authority-diff.cjs');
    const source = { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' };
    const cardNums = ['B00001', 'B00002'];
    const rawHash = createHash('sha256').update(cardNums.join('\n')).digest('hex');
    const files: Record<string, string> = {
      '.claude/specs/cards-data/status.json': JSON.stringify({ source, hashes: { rawCardNums: rawHash, tsvCardNums: rawHash, normalizedFaq: 'f'.repeat(64) }, printings: { raw: 2, tsv: 2 } }),
      '.claude/specs/cards-data/qa-hash-snapshot.json': JSON.stringify({ source, normalizedFaqHash: 'f'.repeat(64), conflicts: [], items: [] }),
      'meta-app/src/data/cardCatalog.generated.ts': `export const CARD_CATALOG: readonly CardDef[] = ${JSON.stringify(cardNums.map((num) => ({ num })))};`,
    };

    const prior = loadPriorAuthorityAtReleaseCommit({
      projectRoot: 'C:/project',
      releaseCommit: RELEASE_COMMIT,
      verifyCommit: () => undefined,
      readGitFile: (_commit: string, relative: string) => {
        if (!(relative in files)) throw new Error('missing commit file');
        return files[relative];
      },
      gitFileExists: (_commit: string, relative: string) => relative in files,
    });

    expect(prior.fieldIndex).toMatchObject({ bootstrap: true, cards: [{ cardNum: 'B00001' }, { cardNum: 'B00002' }] });
  });

  it('reconstructs a regular release prior from its historical field index', () => {
    const { loadPriorAuthorityAtReleaseCommit } = require('../../scripts/cards/ground-authority-diff.cjs');
    const { buildAuthorityFieldIndex } = require('../../scripts/cards/authority-refresh.cjs');
    const source = { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' };
    const fieldIndex = buildAuthorityFieldIndex([officialCard()], source);
    const rawHash = createHash('sha256').update('B00001').digest('hex');
    const files: Record<string, string> = {
      '.claude/specs/cards-data/status.json': JSON.stringify({ source, hashes: { rawCardNums: rawHash, tsvCardNums: rawHash, normalizedFaq: 'f'.repeat(64) }, printings: { raw: 1, tsv: 1 } }),
      '.claude/specs/cards-data/qa-hash-snapshot.json': JSON.stringify({ source, normalizedFaqHash: 'f'.repeat(64), conflicts: [], items: [] }),
      '.claude/specs/cards-data/authority-field-index.json': JSON.stringify(fieldIndex),
    };

    const prior = loadPriorAuthorityAtReleaseCommit({
      projectRoot: 'C:/project',
      releaseCommit: RELEASE_COMMIT,
      verifyCommit: () => undefined,
      readGitFile: (_commit: string, relative: string) => files[relative],
      gitFileExists: (_commit: string, relative: string) => relative in files,
    });

    expect(prior.fieldIndex).toEqual(fieldIndex);
  });

  it('rejects malformed authority files from the release commit', () => {
    const { loadPriorAuthorityAtReleaseCommit } = require('../../scripts/cards/ground-authority-diff.cjs');

    expect(() => loadPriorAuthorityAtReleaseCommit({
      projectRoot: 'C:/project',
      releaseCommit: RELEASE_COMMIT,
      verifyCommit: () => undefined,
      readGitFile: () => '{',
      gitFileExists: () => false,
    })).toThrow(/tracked authority status is invalid JSON/i);
  });

  it.each([
    ['a malformed release commit', 'not-a-commit', /releaseCommit is invalid/i],
    ['a missing release commit', RELEASE_COMMIT, /release commit is unavailable/i],
    ['a non-ancestor release commit', RELEASE_COMMIT, /release commit is not an ancestor/i],
  ])('rejects %s before grounding', (_name, releaseCommit, error) => {
    const { runGroundAuthorityDiff } = require('../../scripts/cards/ground-authority-diff.cjs');
    const ground = () => { throw new Error('ground must not run'); };
    const packet = { basis: { releaseCommit }, diff: { added: ['B00002'] } };
    expect(() => runGroundAuthorityDiff({
      projectRoot: 'C:/project',
      packetPath: 'C:/packet/packet.json',
      readPacket: () => packet,
      loadPriorAtCommit: () => { throw new Error(_name.includes('malformed') ? 'authority packet releaseCommit is invalid' : _name.includes('missing') ? 'authority packet release commit is unavailable' : 'authority packet release commit is not an ancestor of HEAD'); },
      ground,
    })).toThrow(error);
  });

  it('rejects a tampered packet before grounding', () => {
    const { runGroundAuthorityDiff } = require('../../scripts/cards/ground-authority-diff.cjs');
    const ground = () => { throw new Error('ground must not run'); };

    expect(() => runGroundAuthorityDiff({
      projectRoot: 'C:/project',
      packetPath: 'C:/packet/packet.json',
      readPacket: () => ({ basis: { releaseCommit: RELEASE_COMMIT }, diff: { added: [] } }),
      loadPriorAtCommit: () => ({ prior: 'historical' }),
      validatePacket: () => { throw new Error('authority packet basis does not match prior authority'); },
      ground,
    })).toThrow(/basis does not match prior authority/i);
  });

  it('validates the external packet and grounds only its exact sorted added printings', () => {
    const { runGroundAuthorityDiff } = require('../../scripts/cards/ground-authority-diff.cjs');
    const calls: string[][] = [];
    const packet = { diff: { added: ['B00002', 'B00010'] } };

    const result = runGroundAuthorityDiff({
      projectRoot: 'C:/project',
      packetPath: 'C:/packet/packet.json',
      loadPriorAtCommit: () => ({ prior: true }),
      readPacket: () => packet,
      validatePacket: (actual: unknown, prior: unknown, options: unknown) => {
        expect(actual).toBe(packet);
        expect(prior).toEqual({ prior: true });
        expect(options).toEqual({ packetRoot: resolve('C:/packet'), projectRoot: resolve('C:/project') });
      },
      capturePacket: () => [],
      createOutput: () => 'C:/packet/ground-authority-safe',
      ground: (ids: string[]) => calls.push(ids),
    });

    expect(calls).toEqual([['B00002', 'B00010']]);
    expect(result).toEqual({ ids: ['B00002', 'B00010'], packetPath: resolve('C:/packet/packet.json'), outputPath: 'C:/packet/ground-authority-safe', stagedResiduePath: null, grounded: true });
  });

  it('returns an explicit no-op receipt for an empty packet delta without creating output or spawning a child', () => {
    const { runGroundAuthorityDiff } = require('../../scripts/cards/ground-authority-diff.cjs');
    const createOutput = () => { throw new Error('output must not be created'); };
    const ground = () => { throw new Error('child must not run'); };

    const result = runGroundAuthorityDiff({
      projectRoot: 'C:/project', packetPath: 'C:/packet/packet.json',
      readPacket: () => ({ basis: { releaseCommit: RELEASE_COMMIT }, diff: { added: [] } }),
      loadPriorAtCommit: () => ({}), validatePacket: () => undefined,
      capturePacket: () => [], assertUnchanged: () => undefined,
      createOutput, ground,
    });

    expect(result).toEqual({ ids: [], packetPath: resolve('C:/packet/packet.json'), outputPath: null, stagedResiduePath: null, grounded: false });
  });

  it('reports the isolated stage residue on successful grounding', () => {
    const { runGroundAuthorityDiff } = require('../../scripts/cards/ground-authority-diff.cjs');
    const result = runGroundAuthorityDiff({
      projectRoot: 'C:/project', packetPath: 'C:/packet/packet.json',
      readPacket: () => ({ basis: { releaseCommit: RELEASE_COMMIT }, diff: { added: ['B00002'] } }),
      loadPriorAtCommit: () => ({}), validatePacket: () => undefined,
      capturePacket: () => [{ relative: 'snapshot/.claude/specs/cards-data/ct-p01/character.tsv' }],
      assertUnchanged: () => undefined, captureTree: () => [], assertTreeUnchanged: () => undefined,
      stageTsv: () => ({ path: 'C:/safe/stage', files: [] }), assertOutput: () => undefined,
      createOutput: () => ({ path: 'C:/safe/output' }), assertStagedTsv: () => undefined,
      removeStagedTsv: () => 'C:/safe/.stage.cleanup-1', ground: () => undefined, verifyCommit: () => undefined,
    });
    expect(result.stagedResiduePath).toBe('C:/safe/.stage.cleanup-1');
  });

  it('surfaces the isolated stage residue when setup after staging fails', () => {
    const { runGroundAuthorityDiff } = require('../../scripts/cards/ground-authority-diff.cjs');
    let caught: Error & { stagedResiduePath?: string } | undefined;
    try {
      runGroundAuthorityDiff({
        projectRoot: 'C:/project', packetPath: 'C:/packet/packet.json',
        readPacket: () => ({ basis: { releaseCommit: RELEASE_COMMIT }, diff: { added: ['B00002'] } }),
        loadPriorAtCommit: () => ({}), validatePacket: () => undefined,
        capturePacket: () => [{ relative: 'snapshot/.claude/specs/cards-data/ct-p01/character.tsv' }],
        assertUnchanged: () => undefined, captureTree: () => [], assertTreeUnchanged: () => undefined,
        stageTsv: () => ({ path: 'C:/safe/stage', files: [] }),
        createOutput: () => { throw new Error('output setup failed'); },
        removeStagedTsv: () => 'C:/safe/.stage.cleanup-2',
      });
    } catch (error) { caught = error as Error & { stagedResiduePath?: string }; }
    expect(caught?.message).toContain('staged residue: C:/safe/.stage.cleanup-2');
    expect(caught?.stagedResiduePath).toBe('C:/safe/.stage.cleanup-2');
  });

  it('preserves the residue reported by a stage-creation failure without contradictory unavailable text', () => {
    const { runGroundAuthorityDiff } = require('../../scripts/cards/ground-authority-diff.cjs');
    const stagedFailure = Object.assign(new Error('stage acquisition failed; staged residue: C:/safe/.stage.cleanup-3'), {
      stagedResiduePath: 'C:/safe/.stage.cleanup-3',
    });
    let caught: (Error & { stagedResiduePath?: string }) | undefined;
    try {
      runGroundAuthorityDiff({
        projectRoot: 'C:/project', packetPath: 'C:/packet/packet.json',
        readPacket: () => ({ basis: { releaseCommit: RELEASE_COMMIT }, diff: { added: ['B00002'] } }),
        loadPriorAtCommit: () => ({}), validatePacket: () => undefined,
        capturePacket: () => [{ relative: 'snapshot/.claude/specs/cards-data/ct-p01/character.tsv' }],
        assertUnchanged: () => undefined, captureTree: () => [], assertTreeUnchanged: () => undefined,
        stageTsv: () => { throw stagedFailure; },
      });
    } catch (error) { caught = error as Error & { stagedResiduePath?: string }; }
    expect(caught?.stagedResiduePath).toBe('C:/safe/.stage.cleanup-3');
    expect(caught?.message).toContain('staged residue: C:/safe/.stage.cleanup-3');
    expect(caught?.message).not.toContain('unavailable');
    expect(caught?.cause).toBe(stagedFailure);
  });

  it('treats distinct inherited and cleanup residue paths as a visible fail-closed conflict', () => {
    const { residueError } = require('../../scripts/cards/ground-authority-diff.cjs');
    const incoming = Object.assign(new Error('inner failure'), { stagedResiduePath: 'C:/safe/inner' });
    const wrapped = residueError(incoming, 'C:/safe/outer');
    expect(wrapped.stagedResiduePath).toBe('C:/safe/outer');
    expect(wrapped.stagedResiduePaths).toEqual(['C:/safe/outer', 'C:/safe/inner']);
    expect(wrapped.message).toContain('staged residue conflict: C:/safe/outer, C:/safe/inner');
    expect(wrapped.cause).toBe(incoming);
  });

  it('creates grounding output outside the packet root', () => {
    const { createGroundOutput } = require('../../scripts/cards/ground-authority-diff.cjs');
    const packetRoot = tempDir();
    const output = createGroundOutput(packetRoot);
    tempDirs.push(output.path);
    expect(resolve(output.path).startsWith(resolve(packetRoot))).toBe(false);
  });

  it('rejects a temp-base junction that resolves into the packet root without touching its sentinel', () => {
    const { createGroundOutput } = require('../../scripts/cards/ground-authority-diff.cjs');
    const packetRoot = tempDir();
    const projectRoot = tempDir();
    const junctionParent = tempDir();
    const junction = join(junctionParent, 'temp');
    const sentinel = join(packetRoot, 'sentinel.txt');
    writeFileSync(sentinel, 'unchanged');
    symlinkSync(packetRoot, junction, 'junction');

    expect(() => createGroundOutput(packetRoot, projectRoot, { tempBase: junction })).toThrow(/temp base.*unsafe|outside/i);
    expect(readFileSync(sentinel, 'utf8')).toBe('unchanged');
    expect(readdirSync(packetRoot).sort()).toEqual(['sentinel.txt']);
  });

  it('rejects a staged TSV whose bytes do not match the validated packet manifest', () => {
    const { stageValidatedTsv } = require('../../scripts/cards/ground-authority-diff.cjs');
    const packetRoot = tempDir();
    const projectRoot = tempDir();
    const relative = 'snapshot/.claude/specs/cards-data/ct-p01/character.tsv';
    const file = join(packetRoot, relative);
    mkdirSync(join(packetRoot, 'snapshot', '.claude', 'specs', 'cards-data', 'ct-p01'), { recursive: true });
    writeFileSync(file, 'cardNum\nMALICIOUS\n');
    const stat = require('node:fs').lstatSync(file);
    const rootStat = require('node:fs').lstatSync(packetRoot);
    const directory = join(packetRoot, 'snapshot', '.claude', 'specs', 'cards-data', 'ct-p01');
    const directoryStat = require('node:fs').lstatSync(directory);
    expect(() => stageValidatedTsv([{
      file, relative, dev: stat.dev, ino: stat.ino, size: stat.size, sha256: '0'.repeat(64),
      ancestors: [{ path: directory, dev: directoryStat.dev, ino: directoryStat.ino }, { path: packetRoot, dev: rootStat.dev, ino: rootStat.ino }],
    }], { packetRoot, projectRoot, tempBase: tempDir() })).toThrow(/source changed/i);
  });

  it('rejects staged TSV tampering before a grounding receipt can be accepted', () => {
    const { assertStagedTsvUnchanged } = require('../../scripts/cards/ground-authority-diff.cjs');
    const stage = tempDir();
    const staged = join(stage, '0000.tsv');
    writeFileSync(staged, 'cardNum\nB00001\n');
    const stageStat = require('node:fs').lstatSync(stage);
    const fileStat = require('node:fs').lstatSync(staged);
    const digest = createHash('sha256').update(readFileSync(staged)).digest('hex');
    const pin = { path: stage, dev: stageStat.dev, ino: stageStat.ino, files: [{ file: staged, dev: fileStat.dev, ino: fileStat.ino, size: fileStat.size, sha256: digest }] };
    expect(() => assertStagedTsvUnchanged(pin)).not.toThrow();
    writeFileSync(staged, 'cardNum\nMALICIOUS\n');
    expect(() => assertStagedTsvUnchanged(pin)).toThrow(/staged TSV changed/i);
  });

  it('does not recursively clean a victim directory swapped into a failed TSV stage', () => {
    const { stageValidatedTsv } = require('../../scripts/cards/ground-authority-diff.cjs');
    const packetRoot = tempDir();
    const projectRoot = tempDir();
    const tempBase = tempDir();
    const source = join(packetRoot, 'snapshot', '.claude', 'specs', 'cards-data', 'ct-p01', 'character.tsv');
    mkdirSync(join(packetRoot, 'snapshot', '.claude', 'specs', 'cards-data', 'ct-p01'), { recursive: true });
    writeFileSync(source, 'cardNum\nB00001\n');
    const sourceStat = require('node:fs').lstatSync(source);
    const ancestor = join(packetRoot, 'snapshot', '.claude', 'specs', 'cards-data', 'ct-p01');
    const ancestorStat = require('node:fs').lstatSync(ancestor);
    const packetStat = require('node:fs').lstatSync(packetRoot);
    const stage = join(tempBase, 'stage');
    const victim = join(tempBase, 'victim');
    mkdirSync(stage);
    mkdirSync(victim);
    writeFileSync(join(victim, 'sentinel.txt'), 'do not delete');
    const stageStat = require('node:fs').lstatSync(stage);
    const digest = createHash('sha256').update(readFileSync(source)).digest('hex');
    const pin = { path: stage, dev: stageStat.dev, ino: stageStat.ino };

    expect(() => stageValidatedTsv([{
      file: source, relative: 'snapshot/.claude/specs/cards-data/ct-p01/character.tsv', dev: sourceStat.dev, ino: sourceStat.ino, size: sourceStat.size, sha256: digest,
      ancestors: [{ path: ancestor, dev: ancestorStat.dev, ino: ancestorStat.ino }, { path: packetRoot, dev: packetStat.dev, ino: packetStat.ino }],
    }], {
      packetRoot, projectRoot, makeStage: () => pin,
      writeStaged: () => {
        rmSync(stage, { recursive: true, force: true });
        renameSync(victim, stage);
        throw new Error('injected stage write failure');
      },
    })).toThrow(/injected stage write failure|stage changed/i);
    expect(readFileSync(join(stage, 'sentinel.txt'), 'utf8')).toBe('do not delete');
  });

  it('never deletes a replacement victim swapped after stage cleanup precheck', () => {
    const { removeStage } = require('../../scripts/cards/ground-authority-diff.cjs');
    const parent = tempDir();
    const stage = join(parent, 'stage');
    const victim = join(parent, 'victim');
    mkdirSync(stage);
    mkdirSync(victim);
    writeFileSync(join(stage, '0000.tsv'), 'cardNum\nB00001\n');
    writeFileSync(join(victim, 'sentinel.txt'), 'preserve');
    const stageStat = require('node:fs').lstatSync(stage);
    const file = join(stage, '0000.tsv');
    const fileStat = require('node:fs').lstatSync(file);
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
    const pin = { path: stage, dev: stageStat.dev, ino: stageStat.ino, files: [{ file, dev: fileStat.dev, ino: fileStat.ino, size: fileStat.size, sha256: digest }] };

    expect(() => removeStage(pin, {
      rename: (from: string, to: string) => {
        renameSync(from, `${from}-owned`);
        renameSync(victim, from);
        renameSync(`${from}-owned`, to);
      },
    })).not.toThrow();
    expect(readFileSync(join(stage, 'sentinel.txt'), 'utf8')).toBe('preserve');
  });

  it('fails closed without deleting a victim swapped into the isolated cleanup path', () => {
    const { removeStage } = require('../../scripts/cards/ground-authority-diff.cjs');
    const parent = tempDir();
    const stage = join(parent, 'stage');
    const victim = join(parent, 'victim');
    mkdirSync(stage);
    mkdirSync(victim);
    writeFileSync(join(stage, '0000.tsv'), 'cardNum\nB00001\n');
    writeFileSync(join(victim, 'sentinel.txt'), 'preserve');
    const stageStat = require('node:fs').lstatSync(stage);
    const file = join(stage, '0000.tsv');
    const fileStat = require('node:fs').lstatSync(file);
    const digest = createHash('sha256').update(readFileSync(file)).digest('hex');
    const pin = { path: stage, dev: stageStat.dev, ino: stageStat.ino, files: [{ file, dev: fileStat.dev, ino: fileStat.ino, size: fileStat.size, sha256: digest }] };

    expect(() => removeStage(pin, {
      rename: (from: string, to: string) => {
        renameSync(from, `${from}-owned`);
        renameSync(victim, to);
      },
    })).toThrow(/cleanup identity changed/i);
    const isolated = readdirSync(parent).find((name) => name.includes('.stage.cleanup-'));
    expect(isolated).toBeTruthy();
    expect(readFileSync(join(parent, isolated!, 'sentinel.txt'), 'utf8')).toBe('preserve');
    expect(readFileSync(join(parent, 'stage-owned', '0000.tsv'), 'utf8')).toContain('B00001');
  });

  it('does not pass hostile Node loader environment to the grounding child', () => {
    const { runGroundAuthorityDiff } = require('../../scripts/cards/ground-authority-diff.cjs');
    const priorNodeOptions = process.env.NODE_OPTIONS;
    const priorNodePath = process.env.NODE_PATH;
    process.env.NODE_OPTIONS = '--require C:/attacker.cjs';
    process.env.NODE_PATH = 'C:/attacker';
    try {
      runGroundAuthorityDiff({
        projectRoot: 'C:/project', packetPath: 'C:/packet/packet.json',
        readPacket: () => ({ basis: { releaseCommit: RELEASE_COMMIT }, diff: { added: ['B00002'] } }),
        loadPriorAtCommit: () => ({}), validatePacket: () => undefined,
        capturePacket: () => [], createOutput: () => 'C:/packet/out',
        ground: (_ids: string[], options: { env: NodeJS.ProcessEnv }) => {
          expect(options.env.NODE_OPTIONS).toBeUndefined();
          expect(options.env.NODE_PATH).toBeUndefined();
          expect(options.env.CONAN_CARDS_DATA_DIR).toBe(resolve('C:/packet/snapshot/.claude/specs/cards-data'));
        },
      });
    } finally {
      if (priorNodeOptions === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = priorNodeOptions;
      if (priorNodePath === undefined) delete process.env.NODE_PATH; else process.env.NODE_PATH = priorNodePath;
    }
  });

  it('rejects packet artifact injection after validation before the child can run', () => {
    const { runGroundAuthorityDiff } = require('../../scripts/cards/ground-authority-diff.cjs');
    let checks = 0;
    expect(() => runGroundAuthorityDiff({
      projectRoot: 'C:/project', packetPath: 'C:/packet/packet.json',
      readPacket: () => ({ basis: { releaseCommit: RELEASE_COMMIT }, diff: { added: [] } }),
      loadPriorAtCommit: () => ({}), validatePacket: () => undefined,
      capturePacket: () => [{ file: 'C:/packet/snapshot/.claude/specs/cards-data/ct-p01/character.tsv' }],
      assertUnchanged: () => {
        checks += 1;
        if (checks === 1) throw new Error('authority packet source set changed while grounding');
      },
      ground: () => { throw new Error('ground must not run'); },
    })).toThrow(/source set changed/i);
  });

  it('detects an unmanifested TSV inserted into the validated packet snapshot', () => {
    const { assertPacketArtifactsUnchanged, snapshotPacketArtifacts } = require('../../scripts/cards/ground-authority-diff.cjs');
    const packetRoot = tempDir();
    const relative = 'snapshot/.claude/specs/cards-data/ct-p01/character.tsv';
    const file = join(packetRoot, relative);
    mkdirSync(join(packetRoot, 'snapshot', '.claude', 'specs', 'cards-data', 'ct-p01'), { recursive: true });
    writeFileSync(file, 'cardNum\nB00001\n');
    const bytes = readFileSync(file);
    const packet = { artifacts: [{ path: relative, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }] };
    const snapshot = snapshotPacketArtifacts(packet, packetRoot);
    expect(() => assertPacketArtifactsUnchanged(snapshot, packetRoot)).not.toThrow();
    writeFileSync(join(packetRoot, 'snapshot', '.claude', 'specs', 'cards-data', 'ct-p01', 'injected.tsv'), 'cardNum\nPR999\n');
    expect(() => assertPacketArtifactsUnchanged(snapshot, packetRoot)).toThrow(/source set changed/i);
  });

  it('rejects output identity changes before the grounding child', () => {
    const { runGroundAuthorityDiff } = require('../../scripts/cards/ground-authority-diff.cjs');
    expect(() => runGroundAuthorityDiff({
      projectRoot: 'C:/project', packetPath: 'C:/packet/packet.json',
      readPacket: () => ({ basis: { releaseCommit: RELEASE_COMMIT }, diff: { added: ['B00002'] } }),
      loadPriorAtCommit: () => ({}), validatePacket: () => undefined,
      capturePacket: () => [], assertUnchanged: () => undefined,
      createOutput: () => ({ path: 'C:/packet/out', snapshot: { dev: 1, ino: 1 } }),
      assertOutput: () => { throw new Error('authority grounding output changed before child'); },
      ground: () => { throw new Error('ground must not run'); },
    })).toThrow(/output changed before child/i);
  });

  it('rejects arbitrary IDs beside the packet argument', () => {
    const { parseGroundAuthorityArgs } = require('../../scripts/cards/ground-authority-diff.cjs');
    expect(() => parseGroundAuthorityArgs(['--packet', 'C:/packet/packet.json', 'B00001']))
      .toThrow(/only accepts --packet/i);
    expect(() => parseGroundAuthorityArgs(['--packet', 'C:/packet/other.json']))
      .toThrow(/only accepts --packet/i);
  });

  it('refuses an unsorted packet delta instead of changing the selected printings', () => {
    const { runGroundAuthorityDiff } = require('../../scripts/cards/ground-authority-diff.cjs');
    const ground = () => { throw new Error('ground must not run'); };

    expect(() => runGroundAuthorityDiff({
      projectRoot: 'C:/project',
      packetPath: 'C:/packet/packet.json',
      loadPriorAtCommit: () => ({}),
      readPacket: () => ({ diff: { added: ['B00010', 'B00002'] } }),
      validatePacket: () => undefined,
      ground,
    })).toThrow(/unique and sorted/i);
  });
});

function officialCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    card_id: '0001',
    title: 'Card one',
    card_num: 'B00001',
    show_hide: '表示',
    date: '2026-01-01 00:00:00',
    package: 'CT-P01 set',
    category1: null,
    category2: null,
    category3: null,
    region: '日本',
    main_thumb: 'B00001.jpg',
    main_path: 'one.jpg',
    sub_thumb: null,
    sub_path: null,
    color: '青',
    type: 'キャラ',
    rarity: 'C',
    cost: '1',
    ap: '1000',
    lp: '1',
    feature: 'Effect one',
    drawing: '原作',
    flavor_txt: null,
    difficulty_first: null,
    difficulty_second: null,
    illustrator: null,
    copyright: 'copyright',
    hirameki: null,
    cut_in: null,
    q_a: null,
    linkto: null,
    contain: null,
    henso: null,
    created_at: '2026-01-01T00:00:00.000000Z',
    updated_at: '2026-01-01T00:00:00.000000Z',
    rcp_showhide: 1,
    rcp_limit: 3,
    rcp_caution: null,
    rcp_sameid_limit: 3,
    release_date: '2026-01-01 00:00:00',
    ...overrides,
  };
}

function officialResponse(payload: unknown, overrides: Record<string, unknown> = {}) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return {
    ok: true,
    status: 200,
    url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards?page=1',
    redirected: false,
    headers: new Headers({ 'content-type': 'application/json', 'content-length': String(bytes.byteLength) }),
    arrayBuffer: async () => bytes.buffer,
    ...overrides,
  };
}

function officialPage(cards: unknown[]) {
  return { data: cards, total: cards.length, lastPage: 1, page: 1 };
}

function refreshPacketArtifact(packet: { artifacts: Array<{ bytes: number; path: string; sha256: string }> }, packetRoot: string, artifactPath: string) {
  const artifact = packet.artifacts.find((entry) => entry.path === artifactPath);
  if (!artifact) throw new Error(`missing fixture artifact: ${artifactPath}`);
  const bytes = readFileSync(join(packetRoot, ...artifactPath.split('/')));
  artifact.bytes = bytes.byteLength;
  artifact.sha256 = createHash('sha256').update(bytes).digest('hex');
}

describe('official authority diff', () => {
  it('emits every exact change in ordinal order', () => {
    const { buildAuthorityDiff } = require('../../scripts/cards/authority-diff.cjs');
    const prior = {
      fieldIndex: {
        cards: [
          { cardNum: 'B00010', fields: { title: 'old-title', feature: 'same' } },
          { cardNum: 'B00002', fields: { title: 'same', feature: 'old-feature' } },
          { cardNum: 'B00001', fields: { title: 'removed' } },
        ],
      },
      qaSnapshot: {
        items: [
          { qaId: 'qa:z', answerHash: 'same-answer' },
          { qaId: 'qa:changed', answerHash: 'old-answer' },
          { qaId: 'qa:removed', answerHash: 'old-answer' },
        ],
      },
    };
    const next = {
      fieldIndex: {
        cards: [
          { cardNum: 'B00011', fields: { title: 'added' } },
          { cardNum: 'B00002', fields: { title: 'same', feature: 'new-feature' } },
          { cardNum: 'B00010', fields: { title: 'new-title', feature: 'same' } },
        ],
      },
      qaSnapshot: {
        items: [
          { qaId: 'qa:new', answerHash: 'new-answer' },
          { qaId: 'qa:z', answerHash: 'same-answer' },
          { qaId: 'qa:changed', answerHash: 'new-answer' },
        ],
      },
    };

    expect(buildAuthorityDiff(prior, next)).toEqual({
      schemaVersion: 1,
      added: ['B00011'],
      removed: ['B00001'],
      changedFields: [
        { cardNum: 'B00002', fields: ['feature'] },
        { cardNum: 'B00010', fields: ['title'] },
      ],
      qaAdded: ['qa:new'],
      qaRemoved: ['qa:removed'],
      qaAnswerChanged: ['qa:changed'],
    });
  });
});

describe('official authority acquisition', () => {
  it.each([
    {
      name: 'a redirect response',
      response: officialResponse(officialPage([officialCard()]), {
        status: 302,
        ok: false,
        url: 'https://attacker.invalid/cards?page=1',
        redirected: true,
      }),
      error: /redirect/i,
    },
    {
      name: 'a non-JSON response',
      response: officialResponse(officialPage([officialCard()]), {
        headers: new Headers({ 'content-type': 'text/html' }),
      }),
      error: /content type/i,
    },
    {
      name: 'an oversized response header',
      response: officialResponse(officialPage([officialCard()]), {
        headers: new Headers({ 'content-type': 'application/json', 'content-length': '2049' }),
      }),
      error: /byte limit/i,
    },
  ])('rejects $name without retrying', async ({ response, error }) => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');
    let calls = 0;

    await expect(fetchOfficialCardsOnce({
      fetchImpl: async () => {
        calls += 1;
        return response;
      },
      maxResponseBytes: 2048,
      delay: async () => undefined,
    })).rejects.toThrow(error);
    expect(calls).toBe(1);
  });

  it.each([
    ['a missing card number', [officialCard({ card_num: '' })], /missing card_num/i],
    ['duplicate card numbers', [officialCard(), officialCard()], /duplicate card_num/i],
    ['an unknown response field', [officialCard({ unexpected: 'field' })], /schema/i],
  ])('rejects %s', async (_name, cards, error) => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');

    await expect(fetchOfficialCardsOnce({
      fetchImpl: async () => officialResponse(officialPage(cards)),
      delay: async () => undefined,
    })).rejects.toThrow(error);
  });

  it.each([
    ['a duplicate numeric ID', [officialCard(), officialCard({ card_num: 'B00002', card_id: '0002' })], /duplicate numeric id.*1/i],
    ['an invalid updated timestamp', [officialCard({ updated_at: 'not-a-timestamp' })], /invalid updated_at.*B00001/i],
    ['an impossible updated date', [officialCard({ updated_at: '2026-02-31T00:00:00Z' })], /invalid updated_at.*B00001/i],
    ['an invalid created timestamp', [officialCard({ created_at: '2026-01-01' })], /invalid created_at.*B00001/i],
  ])('rejects %s in fetched authority', async (_name, cards, error) => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');
    await expect(fetchOfficialCardsOnce({
      fetchImpl: async () => officialResponse(officialPage(cards)),
      delay: async () => undefined,
    })).rejects.toThrow(error);
  });

  it('accepts the official null created_at representation while retaining the field', async () => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');
    const snapshot = await fetchOfficialCardsOnce({
      fetchImpl: async () => officialResponse(officialPage([officialCard({ created_at: null })])),
      delay: async () => undefined,
    });

    expect(snapshot.cards).toHaveLength(1);
    expect(snapshot.cards[0]).toHaveProperty('created_at', null);
  });

  it('enforces the byte limit when Content-Length is absent', async () => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');

    await expect(fetchOfficialCardsOnce({
      fetchImpl: async () => officialResponse(officialPage([officialCard()]), {
        headers: new Headers({ 'content-type': 'application/json' }),
      }),
      maxResponseBytes: 64,
      delay: async () => undefined,
    })).rejects.toThrow(/byte limit/i);
  });

  it('rejects a catalog that changes between two complete acquisitions', async () => {
    const { acquireStableOfficialCards } = require('../../scripts/cards/authority-refresh.cjs');
    let calls = 0;

    await expect(acquireStableOfficialCards({
      fetchImpl: async () => {
        calls += 1;
        const title = calls === 1 ? 'First value' : 'Changed value';
        return officialResponse(officialPage([officialCard({ title })]));
      },
      delay: async () => undefined,
    })).rejects.toThrow(/changed between acquisitions/i);
    expect(calls).toBe(2);
  });

  it('canonicalizes response object and card order before comparing acquisitions', async () => {
    const { acquireStableOfficialCards } = require('../../scripts/cards/authority-refresh.cjs');
    const first = officialCard({ card_num: 'B00002', id: 2, card_id: '0002' });
    const second = officialCard();
    let calls = 0;

    const snapshot = await acquireStableOfficialCards({
      fetchImpl: async () => {
        calls += 1;
        const cards = calls === 1
          ? [first, second]
          : [Object.fromEntries(Object.entries(second).reverse()), Object.fromEntries(Object.entries(first).reverse())];
        return officialResponse(officialPage(cards));
      },
      delay: async () => undefined,
    });

    expect(snapshot.cards.map((card: { card_num: string }) => card.card_num)).toEqual(['B00001', 'B00002']);
    expect(snapshot.acquisitionDigests).toEqual([snapshot.digest, snapshot.digest]);
  });

  it('acquires and compares every page in both complete snapshots', async () => {
    const { acquireStableOfficialCards } = require('../../scripts/cards/authority-refresh.cjs');
    const cards = [officialCard(), officialCard({ id: 2, card_id: '0002', card_num: 'B00002' })];
    let calls = 0;

    const snapshot = await acquireStableOfficialCards({
      fetchImpl: async (url: string) => {
        calls += 1;
        const page = Number(new URL(url).searchParams.get('page'));
        return officialResponse({ data: [cards[page - 1]], total: 2, lastPage: 2, page }, { url });
      },
      delay: async () => undefined,
    });

    expect(calls).toBe(4);
    expect(snapshot.cards.map((card: { card_num: string }) => card.card_num)).toEqual(['B00001', 'B00002']);
  });

  it('rejects duplicate card numbers split across pages', async () => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');

    await expect(fetchOfficialCardsOnce({
      fetchImpl: async (url: string) => {
        const page = Number(new URL(url).searchParams.get('page'));
        return officialResponse({ data: [officialCard({ id: page })], total: 2, lastPage: 2, page }, { url });
      },
      delay: async () => undefined,
    })).rejects.toThrow(/duplicate card_num.*B00001/i);
  });

  it('rejects pagination metadata drift on a later page', async () => {
    const { fetchOfficialCardsOnce } = require('../../scripts/cards/authority-refresh.cjs');

    await expect(fetchOfficialCardsOnce({
      fetchImpl: async (url: string) => {
        const page = Number(new URL(url).searchParams.get('page'));
        const card = officialCard({ id: page, card_id: String(page).padStart(4, '0'), card_num: `B${String(page).padStart(5, '0')}` });
        return officialResponse({ data: [card], total: page === 1 ? 2 : 3, lastPage: 2, page }, { url });
      },
      delay: async () => undefined,
    })).rejects.toThrow(/pagination metadata changed/i);
  });
});

describe('official authority packet', () => {
  it('builds the exact packet entirely under an external temporary root', async () => {
    const {
      buildAuthorityFieldIndex,
      buildAuthorityPacket,
      validateAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const card = officialCard();
    const prior = {
      status: { source: { fetchedAt: '2025-12-31T00:00:00.000Z' } },
      fieldIndex: buildAuthorityFieldIndex([card], {
        url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
        fetchedAt: '2025-12-31T00:00:00.000Z',
      }),
      qaSnapshot: { items: [], conflicts: [] },
    };

    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([card])),
      delay: async () => undefined,
    });

    expect(packet.diff).toEqual({
      schemaVersion: 1,
      added: [],
      removed: [],
      changedFields: [],
      qaAdded: [],
      qaRemoved: [],
      qaAnswerChanged: [],
    });
    expect(packet.status.printings).toEqual({ raw: 1, tsv: 1 });
    expect(packet.sourceDigests.acquisitions).toEqual([
      packet.sourceDigests.officialCards,
      packet.sourceDigests.officialCards,
    ]);
    expect(packet.artifacts.length).toBeGreaterThan(3);
    expect(packet.artifacts.every((entry: { path: string }) => !entry.path.startsWith('..'))).toBe(true);
    expect(readdirSync(projectRoot)).toEqual([]);
    expect(() => validateAuthorityPacket(packet, prior, { packetRoot, projectRoot })).not.toThrow();
  });

  it('rederives a current-parser packet offline from the immutable raw artifacts of a reviewed old packet', async () => {
    const {
      buildAuthorityFieldIndex,
      buildAuthorityPacket,
      rederiveAuthorityPacket,
      validateAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const sourceRoot = tempDir();
    const outputRoot = tempDir();
    const card = officialCard({ q_a: JSON.stringify({ Question: 'Answer' }) });
    const prior = {
      status: { source: { fetchedAt: '2025-12-31T00:00:00.000Z' } },
      fieldIndex: buildAuthorityFieldIndex([card], {
        url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
        fetchedAt: '2025-12-31T00:00:00.000Z',
      }),
      qaSnapshot: { items: [], conflicts: [] },
    };
    const oldPacket = await buildAuthorityPacket({
      projectRoot,
      tempRoot: sourceRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([card])),
      delay: async () => undefined,
    });
    const qaPath = join(sourceRoot, 'snapshot', '.claude', 'specs', 'cards-data', 'qa-hash-snapshot.json');
    oldPacket.qaSnapshot.items[0].answerHash = 'f'.repeat(64);
    writeFileSync(qaPath, `${JSON.stringify(oldPacket.qaSnapshot, null, 2)}\n`);
    refreshPacketArtifact(oldPacket, sourceRoot, 'snapshot/.claude/specs/cards-data/qa-hash-snapshot.json');
    const sourcePacketPath = join(sourceRoot, 'packet.json');
    writeFileSync(sourcePacketPath, `${JSON.stringify(oldPacket, null, 2)}\n`);
    const sourcePacketBytes = readFileSync(sourcePacketPath);
    const sourcePacketSha256 = createHash('sha256').update(sourcePacketBytes).digest('hex');

    expect(() => validateAuthorityPacket(oldPacket, prior, { packetRoot: sourceRoot, projectRoot })).toThrow(
      /metadata does not match raw artifacts/i,
    );
    const originalFetch = globalThis.fetch;
    let fetchCalls = 0;
    globalThis.fetch = (async () => {
      fetchCalls += 1;
      throw new Error('network forbidden during authority rederivation');
    }) as typeof fetch;
    try {
      const rederived = await rederiveAuthorityPacket({
        projectRoot,
        sourcePacketPath,
        outputRoot,
        expectedSourcePacketSha256: sourcePacketSha256,
        expectedSourceReleaseCommit: RELEASE_COMMIT,
        releaseCommit: 'b'.repeat(40),
        prior,
      });

      expect(fetchCalls).toBe(0);
      expect(rederived.basis.releaseCommit).toBe('b'.repeat(40));
      expect(rederived.source).toEqual(oldPacket.source);
      expect(rederived.sourceDigests).toEqual(oldPacket.sourceDigests);
      expect(rederived.diff.added).toEqual(oldPacket.diff.added);
      expect(rederived.diff.removed).toEqual(oldPacket.diff.removed);
      expect(rederived.diff.changedFields).toEqual(oldPacket.diff.changedFields);
      expect(rederived.qaSnapshot.items[0].answerHash).not.toBe('f'.repeat(64));
      expect(readFileSync(sourcePacketPath)).toEqual(sourcePacketBytes);
      expect(readFileSync(
        join(outputRoot, 'snapshot', '.claude', 'specs', 'cards-data', '_raw', 'ct-p01-api.json'),
      )).toEqual(readFileSync(
        join(sourceRoot, 'snapshot', '.claude', 'specs', 'cards-data', '_raw', 'ct-p01-api.json'),
      ));
      expect(() => validateAuthorityPacket(rederived, prior, { packetRoot: outputRoot, projectRoot })).not.toThrow();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rejects an unreviewed source packet digest before writing rederived artifacts', async () => {
    const { rederiveAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const sourceRoot = tempDir();
    const outputRoot = tempDir();
    writeFileSync(join(sourceRoot, 'packet.json'), '{}\n');

    await expect(rederiveAuthorityPacket({
      projectRoot,
      sourcePacketPath: join(sourceRoot, 'packet.json'),
      outputRoot,
      expectedSourcePacketSha256: '0'.repeat(64),
      expectedSourceReleaseCommit: RELEASE_COMMIT,
      releaseCommit: 'b'.repeat(40),
      prior: {},
    })).rejects.toThrow(/source packet digest/i);
    expect(readdirSync(outputRoot)).toEqual([]);
  });

  it('rejects a raw and TSV card-number mismatch before producing a packet', async () => {
    const { buildAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();

    await expect(buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: { status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } }, fieldIndex: { cards: [] }, qaSnapshot: { items: [] } },
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
      regenerate: ({ baseDir }: { baseDir: string }) => {
        const directory = join(baseDir, 'ct-p01');
        mkdirSync(directory, { recursive: true });
        writeFileSync(join(directory, 'character.tsv'), 'cardNum\nB00002\n', 'utf8');
      },
    })).rejects.toThrow(/raw\/TSV cardNum mismatch/i);
    expect(existsSync(join(packetRoot, 'packet.json'))).toBe(false);
  });

  it('rejects conflicting official answers for one Q&A identity', async () => {
    const { buildAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const cards = [
      officialCard({ q_a: JSON.stringify({ Question: 'First answer' }) }),
      officialCard({
        id: 2,
        card_num: 'B00001P',
        main_path: 'two.jpg',
        q_a: JSON.stringify({ Question: 'Conflicting answer' }),
      }),
    ];

    await expect(buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: { status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } }, fieldIndex: { cards: [] }, qaSnapshot: { items: [] } },
      fetchImpl: async () => officialResponse(officialPage(cards)),
      delay: async () => undefined,
    })).rejects.toThrow(/Q&A conflict/i);
  });

  it.each([
    ['a removed printing', [], /removed printing B00001/i],
    ['an existing-card text change', [officialCard({ title: 'Changed title' })], /unreviewed card change B00001.*title/i],
  ])('keeps %s reviewable but not publishable', async (_name, cards, error) => {
    const {
      buildAuthorityFieldIndex,
      buildAuthorityPacket,
      validatePublishableAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const priorCard = officialCard();
    const prior = {
      status: { source: { fetchedAt: '2025-12-31T00:00:00.000Z' } },
      fieldIndex: buildAuthorityFieldIndex([priorCard], {
        url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
        fetchedAt: '2025-12-31T00:00:00.000Z',
      }),
      qaSnapshot: { items: [], conflicts: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage(cards)),
      delay: async () => undefined,
    });

    expect(() => validatePublishableAuthorityPacket(packet, prior, [], { packetRoot, projectRoot })).toThrow(error);
  });

  it('rejects artifact tampering after packet construction', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });
    const artifact = join(packetRoot, ...packet.artifacts[0].path.split('/'));
    writeFileSync(artifact, 'tampered\n', 'utf8');

    expect(() => validateAuthorityPacket(packet, prior, { packetRoot, projectRoot })).toThrow(/artifact bytes changed/i);
  });

  it('rejects a regenerated TSV semantic change and invalidates its prior review digest', async () => {
    const {
      authorityReviewDigest,
      buildAuthorityPacket,
      validateAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });
    const originalReviewDigest = authorityReviewDigest(packet);
    const forged = structuredClone(packet);
    const artifact = forged.artifacts.find((entry: { path: string }) => entry.path.endsWith('.tsv'));
    expect(artifact).toBeDefined();
    const artifactPath = join(packetRoot, ...artifact.path.split('/'));
    const changed = readFileSync(artifactPath, 'utf8').replace('Card one', 'TAMPERED');
    expect(changed).toContain('TAMPERED');
    writeFileSync(artifactPath, changed, 'utf8');
    const changedBytes = readFileSync(artifactPath);
    artifact.bytes = changedBytes.byteLength;
    artifact.sha256 = createHash('sha256').update(changedBytes).digest('hex');
    writeFileSync(join(packetRoot, 'packet.json'), `${JSON.stringify(forged, null, 2)}\n`, 'utf8');

    expect(authorityReviewDigest(forged)).not.toBe(originalReviewDigest);
    expect(() => validateAuthorityPacket(forged, prior, { packetRoot, projectRoot })).toThrow(/TSV artifacts do not match raw/i);
  });

  it('rejects forged embedded metadata even when artifact bytes stay unchanged', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });
    const forged = structuredClone(packet);
    forged.fieldIndex.cards[0].fields.title = 'f'.repeat(64);
    forged.diff = require('../../scripts/cards/authority-diff.cjs').buildAuthorityDiff(prior, forged);

    expect(() => validateAuthorityPacket(forged, prior, { packetRoot, projectRoot })).toThrow(/not bound to artifacts/i);
  });

  it('rejects duplicate numeric IDs when validating a self-consistent offline packet', async () => {
    const {
      buildAuthorityPacket,
      stableJson,
      validateAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([
        officialCard(),
        officialCard({ id: 2, card_id: '0002', card_num: 'B00002' }),
      ])),
      delay: async () => undefined,
    });
    const rawArtifact = packet.artifacts.find((entry: { path: string }) => entry.path.endsWith('-api.json'));
    expect(rawArtifact).toBeDefined();
    const rawPath = join(packetRoot, ...rawArtifact.path.split('/'));
    const raw = JSON.parse(readFileSync(rawPath, 'utf8'));
    raw.data[1].id = 1;
    writeFileSync(rawPath, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    const sourceDigest = createHash('sha256').update(Buffer.from(stableJson(raw.data))).digest('hex');
    packet.sourceDigests.officialCards = sourceDigest;
    packet.sourceDigests.acquisitions = [sourceDigest, sourceDigest];
    packet.fieldIndex.cards[1].fields.id = createHash('sha256').update(Buffer.from(stableJson(1))).digest('hex');
    const fieldIndexArtifact = packet.artifacts.find((entry: { path: string }) => entry.path.endsWith('authority-field-index.json'));
    expect(fieldIndexArtifact).toBeDefined();
    const fieldIndexPath = join(packetRoot, ...fieldIndexArtifact.path.split('/'));
    writeFileSync(fieldIndexPath, `${JSON.stringify(packet.fieldIndex, null, 2)}\n`, 'utf8');
    refreshPacketArtifact(packet, packetRoot, rawArtifact.path);
    refreshPacketArtifact(packet, packetRoot, fieldIndexArtifact.path);
    writeFileSync(join(packetRoot, 'packet.json'), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');

    expect(() => validateAuthorityPacket(packet, prior, { packetRoot, projectRoot })).toThrow(/duplicate numeric id.*1/i);
  });

  it('rejects a TSV validation temp base inside the project before writing', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });
    const previousTemp = process.env.TEMP;
    const previousTmp = process.env.TMP;
    process.env.TEMP = projectRoot;
    process.env.TMP = projectRoot;
    try {
      expect(() => validateAuthorityPacket(packet, prior, { packetRoot, projectRoot })).toThrow(/validation temporary root.*external/i);
    } finally {
      if (previousTemp === undefined) delete process.env.TEMP;
      else process.env.TEMP = previousTemp;
      if (previousTmp === undefined) delete process.env.TMP;
      else process.env.TMP = previousTmp;
    }
    expect(readdirSync(projectRoot).some((entry) => entry.startsWith('conan-authority-tsv-verify-'))).toBe(false);
  });

  it('preserves a victim directory swapped into the TSV validation temp path', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const validationRoot = tempDir();
    const victimRoot = tempDir();
    const admittedRoot = `${validationRoot}-admitted`;
    tempDirs.push(admittedRoot);
    writeFileSync(join(victimRoot, 'must-survive.txt'), 'preserve me', 'utf8');
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });

    expect(() => validateAuthorityPacket(packet, prior, {
      packetRoot,
      projectRoot,
      validationMakeTemp: () => validationRoot,
      validationRegenerate: () => {
        renameSync(validationRoot, admittedRoot);
        renameSync(victimRoot, validationRoot);
      },
    })).toThrow(/temporary root identity changed/i);
    expect(readFileSync(join(validationRoot, 'must-survive.txt'), 'utf8')).toBe('preserve me');
    expect(existsSync(admittedRoot)).toBe(true);
  });

  it('rejects a project directory returned as the TSV validation temp without deleting it', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const protectedRoot = join(projectRoot, 'must-survive');
    mkdirSync(protectedRoot);
    writeFileSync(join(protectedRoot, 'sentinel.txt'), 'preserve me', 'utf8');
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });

    expect(() => validateAuthorityPacket(packet, prior, {
      packetRoot,
      projectRoot,
      validationMakeTemp: () => protectedRoot,
    })).toThrow(/validation temporary root.*external/i);
    expect(readFileSync(join(protectedRoot, 'sentinel.txt'), 'utf8')).toBe('preserve me');
  });

  it('rejects a populated external TSV validation temp without deleting it', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const populatedRoot = tempDir();
    writeFileSync(join(populatedRoot, 'must-survive.txt'), 'preserve me', 'utf8');
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });

    expect(() => validateAuthorityPacket(packet, prior, {
      packetRoot,
      projectRoot,
      validationMakeTemp: () => populatedRoot,
    })).toThrow(/validation temporary root must be empty/i);
    expect(readFileSync(join(populatedRoot, 'must-survive.txt'), 'utf8')).toBe('preserve me');
  });

  it('rejects a junction swapped into the TSV validation temp during admission without deleting its target', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const validationRoot = tempDir();
    const admittedRoot = `${validationRoot}-admitted`;
    tempDirs.push(admittedRoot);
    writeFileSync(join(projectRoot, 'must-survive.txt'), 'preserve me', 'utf8');
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });

    expect(() => validateAuthorityPacket(packet, prior, {
      packetRoot,
      projectRoot,
      validationMakeTemp: () => validationRoot,
      validationAdmissionOperations: {
        readdir: (candidate: string) => {
          const entries = readdirSync(candidate);
          renameSync(validationRoot, admittedRoot);
          symlinkSync(projectRoot, validationRoot, 'junction');
          return entries;
        },
      },
    })).toThrow(/identity changed during admission/i);
    expect(readFileSync(join(projectRoot, 'must-survive.txt'), 'utf8')).toBe('preserve me');
    expect(existsSync(admittedRoot)).toBe(true);
  });

  it('rejects raw package files whose contents were swapped without semantic card changes', async () => {
    const {
      buildAuthorityFieldIndex,
      buildAuthorityPacket,
      validatePublishableAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const cards = [
      officialCard(),
      officialCard({ id: 2, card_id: '0002', card_num: 'B00002', package: 'CT-P02 set', main_path: 'two.jpg' }),
    ];
    const prior = {
      status: { source: { fetchedAt: '2025-12-31T00:00:00.000Z' } },
      fieldIndex: buildAuthorityFieldIndex(cards, {
        url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards',
        fetchedAt: '2025-12-31T00:00:00.000Z',
      }),
      qaSnapshot: { items: [], conflicts: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage(cards)),
      delay: async () => undefined,
    });
    expect(packet.diff.changedFields).toEqual([]);
    const rawArtifacts = packet.artifacts.filter((entry: { path: string }) => entry.path.endsWith('-api.json'));
    expect(rawArtifacts.map((entry: { path: string }) => entry.path)).toHaveLength(2);
    const firstPath = join(packetRoot, ...rawArtifacts[0].path.split('/'));
    const secondPath = join(packetRoot, ...rawArtifacts[1].path.split('/'));
    const first = readFileSync(firstPath);
    const second = readFileSync(secondPath);
    writeFileSync(firstPath, second);
    writeFileSync(secondPath, first);
    refreshPacketArtifact(packet, packetRoot, rawArtifacts[0].path);
    refreshPacketArtifact(packet, packetRoot, rawArtifacts[1].path);
    writeFileSync(join(packetRoot, 'packet.json'), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');

    expect(() => validatePublishableAuthorityPacket(packet, prior, [], { packetRoot, projectRoot })).toThrow(/raw package.*ct-p0[12]/i);
  });

  it('rejects an impossible fetchedAt across a self-consistent packet', async () => {
    const { buildAuthorityPacket, validateAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });
    const impossible = '2026-02-31T00:00:00Z';
    packet.source.fetchedAt = impossible;
    packet.status.source.fetchedAt = impossible;
    packet.fieldIndex.source.fetchedAt = impossible;
    for (const [suffix, value] of [
      ['status.json', packet.status],
      ['authority-field-index.json', packet.fieldIndex],
    ] as const) {
      const artifact = packet.artifacts.find((entry: { path: string }) => entry.path.endsWith(suffix));
      expect(artifact).toBeDefined();
      writeFileSync(join(packetRoot, ...artifact.path.split('/')), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
      refreshPacketArtifact(packet, packetRoot, artifact.path);
    }
    writeFileSync(join(packetRoot, 'packet.json'), `${JSON.stringify(packet, null, 2)}\n`, 'utf8');

    expect(() => validateAuthorityPacket(packet, prior, { packetRoot, projectRoot })).toThrow(/fetchedAt is invalid|source is invalid/i);
  });

  it('binds an approval to the exact packet review digest', async () => {
    const {
      authorityReviewDigest,
      buildAuthorityPacket,
      validatePublishableAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const prior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
    });
    const disposition = { kind: 'added', identity: 'B00001', packetDigest: authorityReviewDigest(packet) };

    expect(() => validatePublishableAuthorityPacket(packet, prior, [disposition], { packetRoot, projectRoot })).not.toThrow();
    expect(() => validatePublishableAuthorityPacket(
      packet,
      prior,
      [{ ...disposition, packetDigest: '0'.repeat(64) }],
      { packetRoot, projectRoot },
    )).toThrow(/disposition digest mismatch/i);
  });

  it('requires exact dispositions for every card and Q&A delta', async () => {
    const {
      authorityReviewDigest,
      buildAuthorityPacket,
      validatePublishableAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const baselineRoot = tempDir();
    const packetRoot = tempDir();
    const emptyPrior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const oldCards = [
      officialCard({ q_a: JSON.stringify({ 'Question one': 'Old answer' }) }),
      officialCard({ id: 2, card_id: '0002', card_num: 'B00002', main_path: 'two.jpg', q_a: JSON.stringify({ 'Question removed': 'Removed answer' }) }),
    ];
    const baseline = await buildAuthorityPacket({
      projectRoot,
      tempRoot: baselineRoot,
      fetchedAt: '2026-01-01T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: emptyPrior,
      fetchImpl: async () => officialResponse(officialPage(oldCards)),
      delay: async () => undefined,
    });
    const prior = { status: baseline.status, fieldIndex: baseline.fieldIndex, qaSnapshot: baseline.qaSnapshot };
    const nextCards = [
      officialCard({ title: 'Changed title', q_a: JSON.stringify({ 'Question one': 'New answer' }) }),
      officialCard({ id: 3, card_id: '0003', card_num: 'B00003', main_path: 'three.jpg', q_a: JSON.stringify({ 'Question added': 'Added answer' }) }),
    ];
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior,
      fetchImpl: async () => officialResponse(officialPage(nextCards)),
      delay: async () => undefined,
    });
    expect(packet.diff.added).toEqual(['B00003']);
    expect(packet.diff.removed).toEqual(['B00002']);
    expect(packet.diff.changedFields).toEqual([{ cardNum: 'B00001', fields: ['q_a', 'title'] }]);
    expect(packet.diff.qaAdded).toHaveLength(1);
    expect(packet.diff.qaRemoved).toHaveLength(1);
    expect(packet.diff.qaAnswerChanged).toHaveLength(1);
    const packetDigest = authorityReviewDigest(packet);
    const dispositions = [
      ...packet.diff.added.map((identity: string) => ({ kind: 'added', identity, packetDigest })),
      ...packet.diff.removed.map((identity: string) => ({ kind: 'removed', identity, packetDigest })),
      ...packet.diff.changedFields.map(({ cardNum: identity }: { cardNum: string }) => ({ kind: 'changed', identity, packetDigest })),
      ...new Set([...packet.diff.qaAdded, ...packet.diff.qaRemoved, ...packet.diff.qaAnswerChanged]),
    ].flatMap((entry) => typeof entry === 'string' ? [{ kind: 'qa', identity: entry, packetDigest }] : [entry]);

    expect(() => validatePublishableAuthorityPacket(packet, prior, dispositions, { packetRoot, projectRoot })).not.toThrow();
    for (let index = 0; index < dispositions.length; index += 1) {
      expect(() => validatePublishableAuthorityPacket(
        packet,
        prior,
        dispositions.filter((_, candidate) => candidate !== index),
        { packetRoot, projectRoot },
      )).toThrow(/not approved|unreviewed/i);
    }
    expect(() => validatePublishableAuthorityPacket(
      packet,
      prior,
      [...dispositions, dispositions[0]],
      { packetRoot, projectRoot },
    )).toThrow(/duplicate authority disposition/i);
    expect(() => validatePublishableAuthorityPacket(
      packet,
      prior,
      [...dispositions, { kind: 'changed', identity: 'B99999', packetDigest }],
      { packetRoot, projectRoot },
    )).toThrow(/does not match a packet change/i);
    expect(() => validatePublishableAuthorityPacket(
      packet,
      prior,
      dispositions.map((entry, index) => index === 0 ? { ...entry, kind: 'changed' } : entry),
      { packetRoot, projectRoot },
    )).toThrow(/unreviewed added printing/i);
  });

  it('rejects a temporary root nested under the project', async () => {
    const { buildAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = join(projectRoot, 'packet');
    mkdirSync(packetRoot);

    await expect(buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: { fieldIndex: { cards: [] }, qaSnapshot: { items: [] } },
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
    })).rejects.toThrow(/external to the project/i);
  });

  it('rejects a project nested under the temporary root and a non-empty temporary root', async () => {
    const { buildAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const packetRoot = tempDir();
    const projectRoot = join(packetRoot, 'project');
    mkdirSync(projectRoot);

    await expect(buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: { fieldIndex: { cards: [] }, qaSnapshot: { items: [] } },
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
    })).rejects.toThrow(/external to the project/i);

    const external = tempDir();
    writeFileSync(join(external, 'occupied'), 'x');
    await expect(buildAuthorityPacket({
      projectRoot: tempDir(),
      tempRoot: external,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: { fieldIndex: { cards: [] }, qaSnapshot: { items: [] } },
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
    })).rejects.toThrow(/must be empty/i);
  });

  it('rejects a temporary-root junction swap before any post-regeneration write', async () => {
    const { buildAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const originalRoot = `${packetRoot}-original`;
    tempDirs.push(originalRoot);

    await expect(buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: { fieldIndex: { cards: [] }, qaSnapshot: { items: [] } },
      fetchImpl: async () => officialResponse(officialPage([officialCard()])),
      delay: async () => undefined,
      regenerate: () => {
        renameSync(packetRoot, originalRoot);
        symlinkSync(projectRoot, packetRoot, process.platform === 'win32' ? 'junction' : 'dir');
      },
    })).rejects.toThrow(/temporary root/i);
    expect(readdirSync(projectRoot)).toEqual([]);
  });
});

describe('authority bootstrap', () => {
  it('loads a hash-verified tracked card-number set without raw field claims', () => {
    const { loadPriorAuthority } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const cardsDataRoot = join(projectRoot, '.claude', 'specs', 'cards-data');
    const catalogRoot = join(projectRoot, 'meta-app', 'src', 'data');
    mkdirSync(cardsDataRoot, { recursive: true });
    mkdirSync(catalogRoot, { recursive: true });
    const cardNums = ['B00002', 'B00001'];
    const hash = require('node:crypto').createHash('sha256').update('B00001\nB00002', 'utf8').digest('hex');
    writeFileSync(join(cardsDataRoot, 'status.json'), JSON.stringify({
      schemaVersion: 1,
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      printings: { raw: 2, tsv: 2 },
      hashes: { rawCardNums: hash, tsvCardNums: hash, normalizedFaq: 'a'.repeat(64) },
    }));
    writeFileSync(join(cardsDataRoot, 'qa-hash-snapshot.json'), JSON.stringify({
      schemaVersion: 1,
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      normalizedFaqHash: 'a'.repeat(64),
      items: [],
      conflicts: [],
    }));
    writeFileSync(join(catalogRoot, 'cardCatalog.generated.ts'), `const decoy = { "num": "PR999" };\nexport const CARD_CATALOG: readonly CardDef[] = ${JSON.stringify(cardNums.map((num) => ({ num })), null, 2)};\nconst decoyAfter = { "num": "PR998" };\n`);

    const prior = loadPriorAuthority(projectRoot);

    expect(prior.fieldIndex).toEqual({
      schemaVersion: 1,
      bootstrap: true,
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      cards: [
        { cardNum: 'B00001', updatedAt: null, fields: {} },
        { cardNum: 'B00002', updatedAt: null, fields: {} },
      ],
    });
    expect(JSON.stringify(prior)).not.toContain('Card one');
  });

  it('flags only existing printings updated after the bootstrap snapshot', () => {
    const { buildAuthorityDiffForPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const prior = {
      status: { source: { fetchedAt: '2026-01-01T00:00:00.000Z' } },
      fieldIndex: {
        bootstrap: true,
        cards: [
          { cardNum: 'B00001', fields: {}, updatedAt: null },
          { cardNum: 'B00002', fields: {}, updatedAt: null },
        ],
      },
      qaSnapshot: { items: [] },
    };
    const next = {
      fieldIndex: {
        cards: [
          { cardNum: 'B00001', updatedAt: '2025-12-31T23:59:59.000Z', fields: { title: 'hash-1' } },
          { cardNum: 'B00002', updatedAt: '2026-01-01T00:00:01.000Z', fields: { title: 'hash-2' } },
          { cardNum: 'B00003', updatedAt: '2026-01-02T00:00:00.000Z', fields: { title: 'hash-3' } },
        ],
      },
      qaSnapshot: { items: [] },
    };

    expect(buildAuthorityDiffForPacket(prior, next)).toEqual({
      schemaVersion: 1,
      added: ['B00003'],
      removed: [],
      changedFields: [{ cardNum: 'B00002', fields: ['$bootstrap'] }],
      qaAdded: [],
      qaRemoved: [],
      qaAnswerChanged: [],
    });
  });

  it('rejects an invalid existing-printing timestamp during bootstrap review', () => {
    const { buildAuthorityDiffForPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const prior = {
      status: { source: { fetchedAt: '2026-01-01T00:00:00.000Z' } },
      fieldIndex: { bootstrap: true, cards: [{ cardNum: 'B00001', fields: {}, updatedAt: null }] },
      qaSnapshot: { items: [] },
    };
    const next = {
      fieldIndex: { cards: [{ cardNum: 'B00001', updatedAt: 'not-a-date', fields: { title: 'hash' } }] },
      qaSnapshot: { items: [] },
    };

    expect(() => buildAuthorityDiffForPacket(prior, next)).toThrow(/invalid updatedAt.*B00001/i);
  });

  it('rejects a tracked catalog whose card-number hash does not match status', () => {
    const { loadPriorAuthority } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const cardsDataRoot = join(projectRoot, '.claude', 'specs', 'cards-data');
    const catalogRoot = join(projectRoot, 'meta-app', 'src', 'data');
    mkdirSync(cardsDataRoot, { recursive: true });
    mkdirSync(catalogRoot, { recursive: true });
    writeFileSync(join(cardsDataRoot, 'status.json'), JSON.stringify({
      schemaVersion: 1,
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      printings: { raw: 1, tsv: 1 },
      hashes: { rawCardNums: '0'.repeat(64), tsvCardNums: '0'.repeat(64), normalizedFaq: 'a'.repeat(64) },
    }));
    writeFileSync(join(cardsDataRoot, 'qa-hash-snapshot.json'), JSON.stringify({
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      normalizedFaqHash: 'a'.repeat(64),
      items: [],
      conflicts: [],
    }));
    writeFileSync(join(catalogRoot, 'cardCatalog.generated.ts'), 'export const CARD_CATALOG: readonly CardDef[] = [{ "num": "B00001" }];\n');

    expect(() => loadPriorAuthority(projectRoot)).toThrow(/catalog card-number hash/i);
  });

  it('rejects prior Q&A provenance that does not match tracked status', () => {
    const { loadPriorAuthority } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const cardsDataRoot = join(projectRoot, '.claude', 'specs', 'cards-data');
    mkdirSync(cardsDataRoot, { recursive: true });
    writeFileSync(join(cardsDataRoot, 'status.json'), JSON.stringify({
      schemaVersion: 1,
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      printings: { raw: 0, tsv: 0 },
      hashes: { rawCardNums: createHash('sha256').update('').digest('hex'), tsvCardNums: createHash('sha256').update('').digest('hex'), normalizedFaq: 'a'.repeat(64) },
    }));
    writeFileSync(join(cardsDataRoot, 'qa-hash-snapshot.json'), JSON.stringify({
      schemaVersion: 1,
      source: { url: 'https://example.invalid/cards', fetchedAt: '2025-01-01T00:00:00.000Z' },
      normalizedFaqHash: 'a'.repeat(64),
      items: [],
      conflicts: [],
    }));
    writeFileSync(join(cardsDataRoot, 'authority-field-index.json'), JSON.stringify({
      schemaVersion: 1,
      source: { url: 'https://www.takaratomy.co.jp/products/conan-cardgame/cardlist/cards', fetchedAt: '2026-01-01T00:00:00.000Z' },
      cards: [],
    }));

    expect(() => loadPriorAuthority(projectRoot)).toThrow(/Q&A source.*status/i);
  });
});

describe('authority packet CLI', () => {
  function gitFixture(overrides: Record<string, string> = {}) {
    const values: Record<string, string> = {
      '--show-toplevel': 'C:/repo\n',
      '--abbrev-ref': 'main\n',
      '--porcelain=v1': '',
      HEAD: 'a'.repeat(40) + '\n',
      'origin/main': 'a'.repeat(40) + '\n',
      ...overrides,
    };
    return (_command: string, args: string[]) => {
      const key = args.includes('--show-toplevel')
        ? '--show-toplevel'
        : args.includes('--abbrev-ref')
          ? '--abbrev-ref'
          : args.includes('--porcelain=v1')
            ? '--porcelain=v1'
            : args.at(-1)!;
      return values[key];
    };
  }

  it('accepts only clean synchronized main', () => {
    const { assertCleanSynchronizedMain } = require('../../scripts/cards/build-authority-packet.cjs');
    expect(() => assertCleanSynchronizedMain('C:/repo', gitFixture())).not.toThrow();
  });

  it.each([
    ['a dirty tree', { '--porcelain=v1': ' M file.ts\n' }, /must be clean/i],
    ['a non-main branch', { '--abbrev-ref': 'feature\n' }, /branch must be main/i],
    ['a divergent HEAD', { 'origin/main': 'b'.repeat(40) + '\n' }, /must equal origin\/main/i],
  ])('rejects %s before acquisition', (_name, overrides, error) => {
    const { assertCleanSynchronizedMain } = require('../../scripts/cards/build-authority-packet.cjs');
    expect(() => assertCleanSynchronizedMain('C:/repo', gitFixture(overrides))).toThrow(error);
  });

  it('registers the fail-closed packet command', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'package.json'), 'utf8'));
    expect(pkg.scripts['cards:authority:packet']).toBe('node scripts/cards/build-authority-packet.cjs');
  });

  it('removes the packet if Git state changes during acquisition', async () => {
    const { runAuthorityPacketCli } = require('../../scripts/cards/build-authority-packet.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    let dirty = false;
    const git = gitFixture({ '--show-toplevel': `${projectRoot}\n` });
    const changingGit = (command: string, args: string[]) => {
      if (args.includes('--porcelain=v1') && dirty) return ' M changed.ts\n';
      return git(command, args);
    };

    await expect(runAuthorityPacketCli({
      projectRoot,
      git: changingGit,
      tempBase: tmpdir(),
      makeTemp: () => packetRoot,
      loadPrior: () => ({ fieldIndex: { cards: [] }, qaSnapshot: { items: [] } }),
      build: async () => {
        writeFileSync(join(packetRoot, 'packet.json'), '{}\n');
        dirty = true;
        return { sourceDigests: { officialCards: 'f'.repeat(64) }, diff: {} };
      },
    })).rejects.toThrow(/must be clean/i);
    expect(existsSync(packetRoot)).toBe(false);
  });

  it.each([
    ['dirty', { '--porcelain=v1': ' M changed.ts\n' }, /must be clean/i],
    ['non-main', { '--abbrev-ref': 'feature\n' }, /branch must be main/i],
    ['diverged', { 'origin/main': `${'b'.repeat(40)}\n` }, /must equal origin\/main/i],
  ])('stops a %s CLI preflight before prior reads, temp creation, or build', async (_name, overrides, error) => {
    const { runAuthorityPacketCli } = require('../../scripts/cards/build-authority-packet.cjs');
    let sideEffects = 0;
    await expect(runAuthorityPacketCli({
      projectRoot: 'C:/repo',
      git: gitFixture(overrides),
      makeTemp: () => { sideEffects += 1; return tempDir(); },
      loadPrior: () => { sideEffects += 1; return {}; },
      build: async () => { sideEffects += 1; return {}; },
    })).rejects.toThrow(error);
    expect(sideEffects).toBe(0);
  });

  it('rejects a clean postflight HEAD change and removes the full failed packet tree', async () => {
    const { runAuthorityPacketCli } = require('../../scripts/cards/build-authority-packet.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    let headReads = 0;
    const git = gitFixture({ '--show-toplevel': `${projectRoot}\n` });
    const changingHead = (command: string, args: string[]) => {
      if (args.length === 2 && args[0] === 'rev-parse' && args[1] === 'HEAD') {
        headReads += 1;
        return `${(headReads === 1 ? 'a' : 'b').repeat(40)}\n`;
      }
      if (args.length === 2 && args[0] === 'rev-parse' && args[1] === 'origin/main' && headReads > 1) return `${'b'.repeat(40)}\n`;
      return git(command, args);
    };

    await expect(runAuthorityPacketCli({
      projectRoot,
      git: changingHead,
      makeTemp: () => packetRoot,
      loadPrior: () => ({ fieldIndex: { cards: [] }, qaSnapshot: { items: [] } }),
      build: async () => {
        mkdirSync(join(packetRoot, 'snapshot'));
        writeFileSync(join(packetRoot, 'snapshot', 'raw.json'), '{}');
        writeFileSync(join(packetRoot, 'packet.json'), '{}');
        return { sourceDigests: { officialCards: 'f'.repeat(64) }, diff: {} };
      },
    })).rejects.toThrow(/Git state changed during acquisition/i);
    expect(existsSync(packetRoot)).toBe(false);
  });

  it('never deletes a replacement directory after the admitted temp identity is swapped', async () => {
    const { runAuthorityPacketCli } = require('../../scripts/cards/build-authority-packet.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const victimRoot = tempDir();
    const admittedRoot = `${packetRoot}-admitted`;
    tempDirs.push(admittedRoot);
    writeFileSync(join(victimRoot, 'must-survive.txt'), 'preserve me', 'utf8');
    const git = gitFixture({ '--show-toplevel': `${projectRoot}\n` });

    await expect(runAuthorityPacketCli({
      projectRoot,
      git,
      makeTemp: () => packetRoot,
      loadPrior: () => ({ fieldIndex: { cards: [] }, qaSnapshot: { items: [] } }),
      build: async () => {
        renameSync(packetRoot, admittedRoot);
        renameSync(victimRoot, packetRoot);
        throw new Error('forced build failure after temp swap');
      },
    })).rejects.toThrow(/forced build failure/i);

    expect(readFileSync(join(packetRoot, 'must-survive.txt'), 'utf8')).toBe('preserve me');
    expect(existsSync(admittedRoot)).toBe(true);
  });

  it('rejects an empty victim swapped into the temp path during admission', () => {
    const { assertExternalEmptyTemp } = require('../../scripts/cards/build-authority-packet.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const victimRoot = tempDir();
    const admittedRoot = `${packetRoot}-admitted`;
    tempDirs.push(admittedRoot);
    let lstatCalls = 0;

    expect(() => assertExternalEmptyTemp(projectRoot, packetRoot, {
      lstat: (candidate: string) => {
        lstatCalls += 1;
        const stat = require('node:fs').lstatSync(candidate);
        if (lstatCalls === 1) {
          renameSync(packetRoot, admittedRoot);
          renameSync(victimRoot, packetRoot);
        }
        return stat;
      },
    })).toThrow(/identity changed during admission/i);
    expect(readdirSync(packetRoot)).toEqual([]);
    expect(existsSync(admittedRoot)).toBe(true);
  });

  it('rejects a direct packet build temp swapped during admission before network or regeneration', async () => {
    const { buildAuthorityPacket } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const packetRoot = tempDir();
    const victimRoot = tempDir();
    const admittedRoot = `${packetRoot}-admitted`;
    tempDirs.push(admittedRoot);
    let lstatCalls = 0;
    let fetchCalls = 0;
    let regenerateCalls = 0;

    await expect(buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit: RELEASE_COMMIT,
      prior: {
        status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
        fieldIndex: { cards: [] },
        qaSnapshot: { items: [] },
      },
      fetchImpl: async () => {
        fetchCalls += 1;
        return officialResponse(officialPage([officialCard()]));
      },
      delay: async () => undefined,
      regenerate: async () => {
        regenerateCalls += 1;
      },
      tempAdmissionOperations: {
        lstat: (candidate: string) => {
          lstatCalls += 1;
          const stat = require('node:fs').lstatSync(candidate);
          if (lstatCalls === 1) {
            renameSync(packetRoot, admittedRoot);
            renameSync(victimRoot, packetRoot);
          }
          return stat;
        },
      },
    })).rejects.toThrow(/identity changed during admission/i);
    expect(fetchCalls).toBe(0);
    expect(regenerateCalls).toBe(0);
    expect(readdirSync(packetRoot)).toEqual([]);
    expect(existsSync(admittedRoot)).toBe(true);
  });

  it('rejects a default temporary base inside the project before build or filesystem mutation', async () => {
    const { runAuthorityPacketCli } = require('../../scripts/cards/build-authority-packet.cjs');
    const projectRoot = tempDir();
    const git = gitFixture({ '--show-toplevel': `${projectRoot}\n` });
    const previousTemp = process.env.TEMP;
    const previousTmp = process.env.TMP;
    let buildCalls = 0;
    process.env.TEMP = projectRoot;
    process.env.TMP = projectRoot;
    try {
      await expect(runAuthorityPacketCli({
        projectRoot,
        git,
        loadPrior: () => ({ fieldIndex: { cards: [] }, qaSnapshot: { items: [] } }),
        build: async () => {
          buildCalls += 1;
          return { sourceDigests: { officialCards: 'f'.repeat(64) }, diff: {} };
        },
      })).rejects.toThrow(/temporary base.*external/i);
    } finally {
      if (previousTemp === undefined) delete process.env.TEMP;
      else process.env.TEMP = previousTemp;
      if (previousTmp === undefined) delete process.env.TMP;
      else process.env.TMP = previousTmp;
    }
    expect(buildCalls).toBe(0);
    expect(readdirSync(projectRoot)).toEqual([]);
  });
});

describe('authority packet publication', () => {
  const publisherModule = require('../../scripts/cards/publish-authority-packet.cjs');
  const publisherArmed = /^[a-f0-9]{40}$/.test(publisherModule.REVIEWED_INFRA_COMMIT);
  const armedIt = publisherArmed ? it : it.skip;
  const testPublishHead = 'e'.repeat(40);

  async function publicationFixture(releaseCommit = testPublishHead) {
    const {
      authorityReviewDigest,
      buildAuthorityPacket,
    } = require('../../scripts/cards/authority-refresh.cjs');
    const projectRoot = tempDir();
    const publisherPath = join(projectRoot, 'scripts', 'cards', 'publish-authority-packet.cjs');
    mkdirSync(join(projectRoot, 'scripts', 'cards'), { recursive: true });
    writeFileSync(publisherPath, readFileSync(resolve(__dirname, '..', '..', 'scripts', 'cards', 'publish-authority-packet.cjs')));
    const baselineRoot = tempDir();
    const packetRoot = tempDir();
    const emptyPrior = {
      status: { source: { fetchedAt: '2025-01-01T00:00:00.000Z' } },
      fieldIndex: { cards: [] },
      qaSnapshot: { items: [] },
    };
    const first = officialCard();
    const baseline = await buildAuthorityPacket({
      projectRoot,
      tempRoot: baselineRoot,
      fetchedAt: '2026-01-01T00:00:00.000Z',
      releaseCommit,
      prior: emptyPrior,
      fetchImpl: async () => officialResponse(officialPage([first])),
      delay: async () => undefined,
    });
    const cardsDataRoot = join(projectRoot, '.claude', 'specs', 'cards-data');
    mkdirSync(join(cardsDataRoot, '_raw'), { recursive: true });
    writeFileSync(join(cardsDataRoot, 'INDEX.md'), 'static authority instructions\n');
    writeFileSync(join(cardsDataRoot, '_raw', 'stale-api.json'), '{}\n');
    writeFileSync(join(cardsDataRoot, 'status.json'), `${JSON.stringify(baseline.status, null, 2)}\n`);
    writeFileSync(join(cardsDataRoot, 'qa-hash-snapshot.json'), `${JSON.stringify(baseline.qaSnapshot, null, 2)}\n`);
    writeFileSync(join(cardsDataRoot, 'authority-field-index.json'), `${JSON.stringify(baseline.fieldIndex, null, 2)}\n`);
    const prior = { status: baseline.status, fieldIndex: baseline.fieldIndex, qaSnapshot: baseline.qaSnapshot };
    const added = officialCard({
      id: 2,
      card_id: '0002',
      card_num: 'B00002',
      main_path: 'two.jpg',
      updated_at: '2026-01-02T00:00:00.000000Z',
    });
    const packet = await buildAuthorityPacket({
      projectRoot,
      tempRoot: packetRoot,
      fetchedAt: '2026-01-02T00:00:00.000Z',
      releaseCommit,
      prior,
      fetchImpl: async () => officialResponse(officialPage([first, added])),
      delay: async () => undefined,
    });
    const packetDigest = authorityReviewDigest(packet);
    const approvalRoot = tempDir();
    const approvalPath = join(approvalRoot, 'approval.json');
    writeFileSync(approvalPath, `${JSON.stringify({
      schemaVersion: 1,
      packetDigest,
      dispositions: [{ kind: 'added', identity: 'B00002', packetDigest }],
    }, null, 2)}\n`);
    return { approvalPath, cardsDataRoot, packet, packetRoot, prior, projectRoot };
  }

  function publicationGit(projectRoot: string, head: string, changes: string[] = []) {
    const {
      EXPECTED_ARMING_CHANGES,
      PACKET_RELEASE,
      REVIEWED_INFRA_COMMIT,
      REVIEWED_INFRA_PLACEHOLDER,
      REVIEWED_TASK2_COMMIT,
    } = require('../../scripts/cards/publish-authority-packet.cjs');
    return (_command: string, args: string[]) => {
      if (args.includes('--show-toplevel')) return `${projectRoot}\n`;
      if (args.includes('--abbrev-ref')) return 'main\n';
      if (args.includes('--porcelain=v1')) return '';
      if (args[0] === 'rev-list' && args.at(-1) === head) return `${head} ${REVIEWED_INFRA_COMMIT}\n`;
      if (args[0] === 'rev-list' && args.at(-1) === REVIEWED_INFRA_COMMIT) return `${REVIEWED_INFRA_COMMIT} ${REVIEWED_TASK2_COMMIT}\n`;
      if (args[0] === 'rev-list' && args.at(-1) === REVIEWED_TASK2_COMMIT) return `${REVIEWED_TASK2_COMMIT} ${PACKET_RELEASE}\n`;
      if (args[0] === 'diff-tree') {
        const from = args.at(-2);
        const to = args.at(-1);
        const selected = from === REVIEWED_TASK2_COMMIT && to === REVIEWED_INFRA_COMMIT
          ? changes
          : from === REVIEWED_INFRA_COMMIT && to === head
            ? EXPECTED_ARMING_CHANGES
            : [];
        return `${selected.join('\n')}${selected.length ? '\n' : ''}`;
      }
      if (args[0] === 'show' && args[1] === `${REVIEWED_INFRA_COMMIT}:scripts/cards/publish-authority-packet.cjs`) {
        return readFileSync(join(projectRoot, 'scripts', 'cards', 'publish-authority-packet.cjs'), 'utf8')
          .replace(
            `const REVIEWED_INFRA_COMMIT = '${REVIEWED_INFRA_COMMIT}';`,
            `const REVIEWED_INFRA_COMMIT = '${REVIEWED_INFRA_PLACEHOLDER}';`,
          );
      }
      if (args[0] === 'show' && args[1] === `${head}:scripts/cards/publish-authority-packet.cjs`) {
        return readFileSync(join(projectRoot, 'scripts', 'cards', 'publish-authority-packet.cjs'), 'utf8');
      }
      if (args.at(-1) === 'HEAD' || args.at(-1) === 'origin/main') return `${head}\n`;
      throw new Error(`unexpected Git command: ${args.join(' ')}`);
    };
  }

  it('rejects a poisoned staged static tree even when the source tree is restored', () => {
    const { stableJson } = require('../../scripts/cards/authority-refresh.cjs');
    const { assertStaticCardsDataSnapshot } = publisherModule;
    const baseDir = tempDir();
    const stagedBaseDir = tempDir();
    const reviewed = Buffer.from('reviewed static authority\n');
    writeFileSync(join(baseDir, 'INDEX.md'), reviewed);
    writeFileSync(join(stagedBaseDir, 'INDEX.md'), 'poisoned static authority\n');
    const expectedSnapshot = stableJson([{
      path: 'INDEX.md',
      type: 'file',
      bytes: reviewed.byteLength,
      sha256: createHash('sha256').update(reviewed).digest('hex'),
    }]);

    expect(() => assertStaticCardsDataSnapshot(baseDir, stagedBaseDir, expectedSnapshot)).toThrow(/staged static cards-data/i);
    expect(readFileSync(join(baseDir, 'INDEX.md'))).toEqual(reviewed);
  });

  it('accepts only an arming commit whose publisher bytes differ by the reviewed commit literal', () => {
    const {
      EXPECTED_ARMING_CHANGES,
      EXPECTED_REBASE_INFRA_CHANGES,
      PACKET_RELEASE,
      REVIEWED_INFRA_PLACEHOLDER,
      REVIEWED_TASK2_COMMIT,
      assertPublisherGitState,
    } = publisherModule;
    const reviewedInfraCommit = 'f'.repeat(40);
    const head = 'e'.repeat(40);
    const reviewedSource = `const REVIEWED_INFRA_COMMIT = '${REVIEWED_INFRA_PLACEHOLDER}';\nconst protectedBody = true;\n`;
    const currentSource = `const REVIEWED_INFRA_COMMIT = '${reviewedInfraCommit}';\nconst protectedBody = true;\n`;
    const git = (_command: string, args: string[]) => {
      if (args.includes('--show-toplevel')) return 'C:/repo\n';
      if (args.includes('--abbrev-ref')) return 'main\n';
      if (args.includes('--porcelain=v1')) return '';
      if (args[0] === 'rev-list' && args.at(-1) === head) return `${head} ${reviewedInfraCommit}\n`;
      if (args[0] === 'rev-list' && args.at(-1) === reviewedInfraCommit) return `${reviewedInfraCommit} ${REVIEWED_TASK2_COMMIT}\n`;
      if (args[0] === 'rev-list' && args.at(-1) === REVIEWED_TASK2_COMMIT) return `${REVIEWED_TASK2_COMMIT} ${PACKET_RELEASE}\n`;
      if (args[0] === 'diff-tree') {
        return `${(args.at(-1) === reviewedInfraCommit ? EXPECTED_REBASE_INFRA_CHANGES : EXPECTED_ARMING_CHANGES).join('\n')}\n`;
      }
      if (args.at(-1) === 'HEAD' || args.at(-1) === 'origin/main') return `${head}\n`;
      throw new Error(`unexpected Git command: ${args.join(' ')}`);
    };

    expect(() => assertPublisherGitState('C:/repo', git, {
      reviewedInfraCommit,
      currentSource,
      reviewedSource,
    })).not.toThrow();
    expect(() => assertPublisherGitState('C:/repo', git, {
      reviewedInfraCommit,
      currentSource: `${currentSource}const unreviewed = true;\n`,
      reviewedSource,
    })).toThrow(/changed bytes beyond/i);
  });

  armedIt('rederives the reviewed packet offline after exact reviewed lineage', async () => {
    const {
      EXPECTED_REBASE_INFRA_CHANGES,
      PACKET_RELEASE,
      rebaseAuthorityPacket,
    } = require('../../scripts/cards/publish-authority-packet.cjs');
    const fixture = await publicationFixture(PACKET_RELEASE);
    const outputRoot = tempDir();
    const head = testPublishHead;
    const sourceBytes = readFileSync(join(fixture.packetRoot, 'packet.json'));
    const result = await rebaseAuthorityPacket({
      projectRoot: fixture.projectRoot,
      packetPath: join(fixture.packetRoot, 'packet.json'),
      outputRoot,
      expectedSourcePacketSha256: createHash('sha256').update(sourceBytes).digest('hex'),
      git: publicationGit(fixture.projectRoot, head, EXPECTED_REBASE_INFRA_CHANGES),
    });
    const rebased = JSON.parse(readFileSync(result.packetPath, 'utf8'));
    const restored = structuredClone(rebased);
    restored.basis.releaseCommit = PACKET_RELEASE;

    expect(readFileSync(join(fixture.packetRoot, 'packet.json'))).toEqual(sourceBytes);
    expect(restored.source).toEqual(fixture.packet.source);
    expect(restored.sourceDigests).toEqual(fixture.packet.sourceDigests);
    expect(restored.diff).toEqual(fixture.packet.diff);
    expect(rebased.basis.releaseCommit).toBe(head);
    expect(result.reviewDigest).not.toBe(require('../../scripts/cards/authority-refresh.cjs').authorityReviewDigest(fixture.packet));
  });

  armedIt('rejects unreviewed rederivation lineage before writing packet bytes', async () => {
    const { PACKET_RELEASE, rebaseAuthorityPacket } = require('../../scripts/cards/publish-authority-packet.cjs');
    const fixture = await publicationFixture(PACKET_RELEASE);
    const outputRoot = tempDir();

    await expect(rebaseAuthorityPacket({
      projectRoot: fixture.projectRoot,
      packetPath: join(fixture.packetRoot, 'packet.json'),
      outputRoot,
      git: publicationGit(fixture.projectRoot, testPublishHead, ['M\tunexpected.ts']),
    })).rejects.toThrow(/unreviewed path/i);
    expect(readdirSync(outputRoot)).toEqual([]);
  });

  armedIt('installs every approved authority artifact as one root and preserves static files', async () => {
    const { publishAuthorityPacket } = require('../../scripts/cards/publish-authority-packet.cjs');
    const fixture = await publicationFixture();
    const result = publishAuthorityPacket({
      projectRoot: fixture.projectRoot,
      packetPath: join(fixture.packetRoot, 'packet.json'),
      approvalPath: fixture.approvalPath,
      git: publicationGit(fixture.projectRoot, testPublishHead, publisherModule.EXPECTED_REBASE_INFRA_CHANGES),
    });

    expect(result.packetDigest).toMatch(/^[a-f0-9]{64}$/);
    expect(readFileSync(join(fixture.cardsDataRoot, 'INDEX.md'), 'utf8')).toBe('static authority instructions\n');
    expect(existsSync(join(fixture.cardsDataRoot, '_raw', 'stale-api.json'))).toBe(false);
    expect(JSON.parse(readFileSync(join(fixture.cardsDataRoot, 'status.json'), 'utf8'))).toEqual(fixture.packet.status);
    expect(JSON.parse(readFileSync(join(fixture.cardsDataRoot, 'authority-field-index.json'), 'utf8'))).toEqual(fixture.packet.fieldIndex);
  });

  armedIt('rejects a stale approval before creating a stage or changing authority files', async () => {
    const { publishAuthorityPacket } = require('../../scripts/cards/publish-authority-packet.cjs');
    const fixture = await publicationFixture();
    const before = readFileSync(join(fixture.cardsDataRoot, 'status.json'));
    const approval = JSON.parse(readFileSync(fixture.approvalPath, 'utf8'));
    approval.packetDigest = '0'.repeat(64);
    approval.dispositions[0].packetDigest = approval.packetDigest;
    writeFileSync(fixture.approvalPath, `${JSON.stringify(approval, null, 2)}\n`);

    expect(() => publishAuthorityPacket({
      projectRoot: fixture.projectRoot,
      packetPath: join(fixture.packetRoot, 'packet.json'),
      approvalPath: fixture.approvalPath,
      git: publicationGit(fixture.projectRoot, testPublishHead, publisherModule.EXPECTED_REBASE_INFRA_CHANGES),
    })).toThrow(/approval digest/i);
    expect(readFileSync(join(fixture.cardsDataRoot, 'status.json'))).toEqual(before);
    expect(readdirSync(join(fixture.projectRoot, '.claude', 'specs')).filter((name) => name.startsWith('.cards-data.stage-'))).toEqual([]);
  });

  armedIt('rejects a concurrent publisher before reading or changing authority data', async () => {
    const { publishAuthorityPacket } = publisherModule;
    const { acquireCardsDataWriteLock, releaseCardsDataWriteLock } = require('../../scripts/cards/official-api.cjs');
    const fixture = await publicationFixture();
    const before = readFileSync(join(fixture.cardsDataRoot, 'status.json'));
    const lockToken = acquireCardsDataWriteLock(fixture.cardsDataRoot);

    try {
      expect(() => publishAuthorityPacket({
        projectRoot: fixture.projectRoot,
        packetPath: join(fixture.packetRoot, 'packet.json'),
        approvalPath: fixture.approvalPath,
        git: publicationGit(fixture.projectRoot, testPublishHead, publisherModule.EXPECTED_REBASE_INFRA_CHANGES),
      })).toThrow(/lock is already held/i);
      expect(readFileSync(join(fixture.cardsDataRoot, 'status.json'))).toEqual(before);
    } finally {
      expect(releaseCardsDataWriteLock(fixture.cardsDataRoot, lockToken)).toBe(true);
    }
  });

  armedIt('rejects static cards-data mutation before the atomic swap', async () => {
    const { publishAuthorityPacket } = publisherModule;
    const fixture = await publicationFixture();
    const before = readFileSync(join(fixture.cardsDataRoot, 'status.json'));
    const stableGit = publicationGit(fixture.projectRoot, testPublishHead, publisherModule.EXPECTED_REBASE_INFRA_CHANGES);
    let statusReads = 0;
    const mutatingGit = (command: string, args: string[]) => {
      if (args.includes('--porcelain=v1')) {
        statusReads += 1;
        if (statusReads === 2) writeFileSync(join(fixture.cardsDataRoot, 'INDEX.md'), 'concurrent mutation\n');
      }
      return stableGit(command, args);
    };

    expect(() => publishAuthorityPacket({
      projectRoot: fixture.projectRoot,
      packetPath: join(fixture.packetRoot, 'packet.json'),
      approvalPath: fixture.approvalPath,
      git: mutatingGit,
    })).toThrow(/static cards-data changed/i);
    expect(readFileSync(join(fixture.cardsDataRoot, 'status.json'))).toEqual(before);
    expect(readdirSync(join(fixture.projectRoot, '.claude', 'specs')).filter((name) => name.startsWith('.cards-data.stage-'))).toEqual([]);
  });

  armedIt('hashes the exact approval bytes captured before the atomic swap', async () => {
    const { publishAuthorityPacket } = publisherModule;
    const fixture = await publicationFixture();
    const approvalBytes = readFileSync(fixture.approvalPath);
    const stableGit = publicationGit(fixture.projectRoot, testPublishHead, publisherModule.EXPECTED_REBASE_INFRA_CHANGES);
    let headReads = 0;
    const replacingGit = (command: string, args: string[]) => {
      if (args.at(-1) === 'HEAD') {
        headReads += 1;
        if (headReads === 5) writeFileSync(fixture.approvalPath, '{}\n');
      }
      return stableGit(command, args);
    };

    const result = publishAuthorityPacket({
      projectRoot: fixture.projectRoot,
      packetPath: join(fixture.packetRoot, 'packet.json'),
      approvalPath: fixture.approvalPath,
      git: replacingGit,
    });
    expect(result.approvalSha256).toBe(createHash('sha256').update(approvalBytes).digest('hex'));
  });

  armedIt('rolls the whole authority root back when Git refs drift after installation', async () => {
    const { publishAuthorityPacket } = require('../../scripts/cards/publish-authority-packet.cjs');
    const fixture = await publicationFixture();
    const before = readFileSync(join(fixture.cardsDataRoot, 'status.json'));
    const stableGit = publicationGit(fixture.projectRoot, testPublishHead, publisherModule.EXPECTED_REBASE_INFRA_CHANGES);
    let headReads = 0;
    const driftingGit = (command: string, args: string[]) => {
      if (args.at(-1) === 'HEAD') {
        headReads += 1;
        if (headReads >= 5) return `${'b'.repeat(40)}\n`;
      }
      if (args.at(-1) === 'origin/main' && headReads >= 5) return `${'b'.repeat(40)}\n`;
      return stableGit(command, args);
    };

    expect(() => publishAuthorityPacket({
      projectRoot: fixture.projectRoot,
      packetPath: join(fixture.packetRoot, 'packet.json'),
      approvalPath: fixture.approvalPath,
      git: driftingGit,
    })).toThrow(/Git refs changed/i);
    expect(readFileSync(join(fixture.cardsDataRoot, 'status.json'))).toEqual(before);
    expect(readFileSync(join(fixture.cardsDataRoot, 'INDEX.md'), 'utf8')).toBe('static authority instructions\n');
  });

  it('refuses all publication mutation until the reviewed infrastructure commit is armed', async () => {
    if (publisherArmed) return;
    const { PACKET_RELEASE, rebaseAuthorityPacket } = publisherModule;
    const fixture = await publicationFixture(PACKET_RELEASE);
    const outputRoot = tempDir();

    await expect(rebaseAuthorityPacket({
      projectRoot: fixture.projectRoot,
      packetPath: join(fixture.packetRoot, 'packet.json'),
      outputRoot,
      git: publicationGit(fixture.projectRoot, testPublishHead, publisherModule.EXPECTED_REBASE_INFRA_CHANGES),
    })).rejects.toThrow(/attestation is not armed/i);
    expect(readdirSync(outputRoot)).toEqual([]);
  });

  it('registers offline rederivation and publish commands', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '..', '..', 'package.json'), 'utf8'));
    expect(pkg.scripts['cards:authority:rederive']).toBe('node scripts/cards/publish-authority-packet.cjs rederive');
    expect(pkg.scripts['cards:authority:publish']).toBe('node scripts/cards/publish-authority-packet.cjs publish');
  });
});
