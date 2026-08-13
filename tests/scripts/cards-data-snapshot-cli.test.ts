import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runGenQaTrace } from '../../scripts/gen-docs/gen-qa-trace.js';
import {
  mergeQaAdjudication,
  readQaAdjudicationQueue,
} from '../../scripts/qa-adjudication.js';

const ROOT = path.resolve(__dirname, '../..');
const { acquireCardsDataWriteLock, releaseCardsDataWriteLock } = require('../../scripts/cards/official-api.cjs');

function kernelGateEndpoint(baseDir: string) {
  const digest = createHash('sha256')
    .update(process.platform === 'win32' ? path.resolve(baseDir).toLowerCase() : path.resolve(baseDir))
    .digest('hex');
  if (process.platform === 'win32') return `\\\\.\\pipe\\conan-cards-data-${digest}`;
  return { host: '127.0.0.1', port: 49_152 + Number.parseInt(digest.slice(0, 4), 16) % 16_384 };
}

describe('cards-data reader CLIs', () => {
  const fixtures: string[] = [];

  afterEach(() => {
    for (const fixture of fixtures.splice(0)) rmSync(fixture, { recursive: true, force: true });
  });

  it('rejects a corpus read while a cards-data root swap owns the write lock', () => {
    const catalog = mkdtempSync(path.join(tmpdir(), 'conan-snapshot-cli-'));
    fixtures.push(catalog);
    mkdirSync(path.join(catalog, 'ct-p10'), { recursive: true });
    writeFileSync(
      path.join(catalog, 'ct-p10', 'character.tsv'),
      'cardNum\tcardId\ttitle\tcolor\tlevel\tap\tlp\trarity\tfeatures\timagePath\teffect\tcutIn\thirameki\thenso\tillustrator\tflavor\tqAndA\nB10097\t1\tfixture\tblue\t1\t1000\t1000\tC\t\t\t\t\t\t\t\t\t\n',
    );

    const lock = acquireCardsDataWriteLock(catalog);
    try {
      expect(() => execFileSync(process.execPath, ['scripts/compiler/tsv-corpus.cjs'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, CONAN_CARDS_DATA_DIR: catalog },
      })).toThrow(/cards-data write lock is already held/);
    } finally {
      expect(releaseCardsDataWriteLock(catalog, lock)).toBe(true);
    }
  });

  it('queues a compiler snapshot behind another reader instead of reporting busy', async () => {
    const catalog = mkdtempSync(path.join(tmpdir(), 'conan-snapshot-reader-contention-'));
    fixtures.push(catalog);
    mkdirSync(path.join(catalog, 'ct-p10'), { recursive: true });
    writeFileSync(
      path.join(catalog, 'ct-p10', 'character.tsv'),
      'cardNum\tcardId\ttitle\tcolor\tlevel\tap\tlp\trarity\tfeatures\timagePath\teffect\tcutIn\thirameki\thenso\tillustrator\tflavor\tqAndA\nB10097\t1\tfixture\tblue\t1\t1000\t1000\tC\t\t\t\t\t\t\t\t\t\n',
    );
    const officialApiPath = path.join(ROOT, 'scripts', 'cards', 'official-api.cjs');
    const compilerPath = path.join(ROOT, 'scripts', 'compiler', 'tsv-corpus.cjs');
    let holderStdout = '';
    let holderStderr = '';
    const holder = spawn(process.execPath, ['-e', `
      const fs = require('node:fs');
      const { withCardsDataSnapshot } = require(${JSON.stringify(officialApiPath)});
      withCardsDataSnapshot({
        baseDir: ${JSON.stringify(catalog)},
        read: ({ lockToken }) => {
          process.stdout.write('READY\\n');
          const state = lockToken.kernelGate.state;
          if (state.length < 4) fs.readFileSync(0, 'utf8');
          else if (Atomics.wait(state, 3, 0, 5_000) === 'timed-out') throw new Error('reader contention was not observed');
          process.stdout.write('DONE\\n');
        },
      });
    `], { stdio: ['pipe', 'pipe', 'pipe'] });
    const holderExitPromise = new Promise<number | null>((resolveExit) => holder.once('exit', resolveExit));
    holder.stdout.setEncoding('utf8');
    holder.stderr.setEncoding('utf8');
    const holderReady = new Promise<void>((resolveReady, rejectReady) => {
      let ready = false;
      holder.stdout.on('data', (value: string) => {
        holderStdout += value;
        if (!ready && holderStdout.includes('READY\n')) {
          ready = true;
          resolveReady();
        }
      });
      holder.stderr.on('data', (value: string) => { holderStderr += value; });
      holder.once('exit', (code) => {
        if (!ready) rejectReady(new Error(`snapshot holder exited before ready: ${code}\n${holderStderr}`));
      });
    });
    await holderReady;

    let compilerStdout = '';
    let compilerStderr = '';
    const compiler = spawn(process.execPath, ['-e', `
      const { loadCorpus } = require(${JSON.stringify(compilerPath)});
      const corpus = loadCorpus(${JSON.stringify(ROOT)}, ${JSON.stringify(catalog)});
      process.stdout.write(corpus.map((card) => card.id).join(','));
    `], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    compiler.stdout.setEncoding('utf8');
    compiler.stderr.setEncoding('utf8');
    compiler.stdout.on('data', (value: string) => { compilerStdout += value; });
    compiler.stderr.on('data', (value: string) => { compilerStderr += value; });
    const compilerExit = await new Promise<number | null>((resolveExit) => compiler.once('exit', resolveExit));
    holder.stdin.end();
    const holderExit = await holderExitPromise;

    expect({
      compilerExit,
      compilerStderr,
      compilerStdout,
      holderExit,
      holderStderr,
      holderStdout,
    }).toEqual({
      compilerExit: 0,
      compilerStderr: '',
      compilerStdout: 'B10097',
      holderExit: 0,
      holderStderr: '',
      holderStdout: 'READY\nDONE\n',
    });
  }, 15_000);

  it('keeps an active snapshot gate after an accepted client disconnects', async () => {
    const catalog = mkdtempSync(path.join(tmpdir(), 'conan-snapshot-client-disconnect-'));
    fixtures.push(catalog);
    const officialApiPath = path.join(ROOT, 'scripts', 'cards', 'official-api.cjs');
    let holderStdout = '';
    let holderStderr = '';
    const holder = spawn(process.execPath, ['-e', `
      const fs = require('node:fs');
      const { withCardsDataSnapshot } = require(${JSON.stringify(officialApiPath)});
      withCardsDataSnapshot({
        baseDir: ${JSON.stringify(catalog)},
        read: ({ lockToken }) => {
          process.stdout.write('READY\\n');
          if (Atomics.wait(lockToken.kernelGate.state, 3, 0, 5_000) === 'timed-out') throw new Error('client was not accepted');
          process.stdout.write('CLIENT\\n');
          fs.readFileSync(0, 'utf8');
          process.stdout.write('RELEASED\\n');
        },
      });
    `], { stdio: ['pipe', 'pipe', 'pipe'] });
    holder.stdout.setEncoding('utf8');
    holder.stderr.setEncoding('utf8');
    holder.stdout.on('data', (value: string) => { holderStdout += value; });
    holder.stderr.on('data', (value: string) => { holderStderr += value; });
    const waitForHolder = async (marker: string) => {
      for (let attempt = 0; attempt < 100; attempt += 1) {
        if (holderStdout.includes(marker)) return;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`snapshot holder did not emit ${marker}: ${holderStdout}\\n${holderStderr}`);
    };
    await waitForHolder('READY\n');

    await new Promise<void>((resolveClient, rejectClient) => {
      const client = createConnection(kernelGateEndpoint(catalog));
      client.once('connect', () => {
        client.destroy();
        resolveClient();
      });
      client.once('error', rejectClient);
    });
    await waitForHolder('CLIENT\n');

    const writer = spawn(process.execPath, ['-e', `
      const { acquireCardsDataWriteLock } = require(${JSON.stringify(officialApiPath)});
      try { acquireCardsDataWriteLock(${JSON.stringify(catalog)}); process.exitCode = 2; }
      catch (error) { process.stdout.write(String(error && error.code)); }
    `], { stdio: ['ignore', 'pipe', 'pipe'] });
    let writerStdout = '';
    let writerStderr = '';
    writer.stdout.setEncoding('utf8');
    writer.stderr.setEncoding('utf8');
    writer.stdout.on('data', (value: string) => { writerStdout += value; });
    writer.stderr.on('data', (value: string) => { writerStderr += value; });
    const writerExit = await new Promise<number | null>((resolveExit) => writer.once('exit', resolveExit));

    holder.stdin.end();
    const holderExit = await new Promise<number | null>((resolveExit) => holder.once('exit', resolveExit));
    expect({ holderExit, holderStderr, holderStdout, writerExit, writerStderr, writerStdout }).toEqual({
      holderExit: 0,
      holderStderr: '',
      holderStdout: 'READY\nCLIENT\nRELEASED\n',
      writerExit: 0,
      writerStderr: '',
      writerStdout: 'CARDS_DATA_BUSY',
    });
  }, 15_000);

  it('allows one hundred concurrent snapshots with no listener retry noise', async () => {
    const catalog = mkdtempSync(path.join(tmpdir(), 'conan-snapshot-concurrent-readers-'));
    fixtures.push(catalog);
    const officialApiPath = path.join(ROOT, 'scripts', 'cards', 'official-api.cjs');
    const activeReaderPath = path.join(catalog, '..', `${path.basename(catalog)}-active-reader`);
    const readers = Array.from({ length: 100 }, () => spawn(process.execPath, ['-e', `
      const fs = require('node:fs');
      const { withCardsDataSnapshot } = require(${JSON.stringify(officialApiPath)});
      const waitState = new Int32Array(new SharedArrayBuffer(4));
      withCardsDataSnapshot({
        baseDir: ${JSON.stringify(catalog)},
        read: () => {
          const fd = fs.openSync(${JSON.stringify(activeReaderPath)}, 'wx');
          try {
            Atomics.wait(waitState, 0, 0, 10);
            process.stdout.write('OK');
          } finally {
            fs.closeSync(fd);
            fs.rmSync(${JSON.stringify(activeReaderPath)}, { force: true });
          }
        },
      });
    `], { stdio: ['ignore', 'pipe', 'pipe'] }));
    const results = await Promise.all(readers.map(async (reader) => {
      let stdout = '';
      let stderr = '';
      reader.stdout.setEncoding('utf8');
      reader.stderr.setEncoding('utf8');
      reader.stdout.on('data', (value: string) => { stdout += value; });
      reader.stderr.on('data', (value: string) => { stderr += value; });
      const exit = await new Promise<number | null>((resolveExit) => reader.once('exit', resolveExit));
      return { exit, stderr, stdout };
    }));
    expect(results).toEqual(Array.from({ length: 100 }, () => ({ exit: 0, stderr: '', stdout: 'OK' })));
  }, 15_000);

  it('blocks every exported multi-file Q&A reader behind the shared snapshot gate', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'conan-snapshot-qa-'));
    fixtures.push(root);
    const catalog = path.join(root, '.claude', 'specs', 'cards-data');
    mkdirSync(catalog, { recursive: true });
    const lock = acquireCardsDataWriteLock(catalog);

    try {
      expect(() => readQaAdjudicationQueue({ root })).toThrow(/cards-data write lock is already held/);
      expect(() => mergeQaAdjudication({ root, check: true })).toThrow(/cards-data write lock is already held/);
      expect(() => runGenQaTrace({ checkOnly: true }, root)).toThrow(/cards-data write lock is already held/);
    } finally {
      expect(releaseCardsDataWriteLock(catalog, lock)).toBe(true);
    }
  });

  it('rejects ground while a cards-data root swap owns the write lock', () => {
    const catalog = mkdtempSync(path.join(tmpdir(), 'conan-ground-snapshot-cli-'));
    fixtures.push(catalog);
    mkdirSync(path.join(catalog, 'ct-p10'), { recursive: true });
    writeFileSync(
      path.join(catalog, 'ct-p10', 'character.tsv'),
      'cardNum\tcardId\ttitle\tcolor\tlevel\tap\tlp\trarity\tfeatures\timagePath\teffect\tcutIn\thirameki\thenso\tillustrator\tflavor\tqAndA\nB10097\t1\tfixture\tblue\t1\t1000\t1000\tC\t\t\t\t\t\t\t\t\t\n',
    );

    const lock = acquireCardsDataWriteLock(catalog);
    try {
      expect(() => execFileSync(process.execPath, ['scripts/ground-dossier.cjs', 'B10097'], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, CONAN_CARDS_DATA_DIR: catalog },
      })).toThrow(/cards-data write lock is already held/);
    } finally {
      expect(releaseCardsDataWriteLock(catalog, lock)).toBe(true);
    }
  });

});
