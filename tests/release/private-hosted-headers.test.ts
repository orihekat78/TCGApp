import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { beforeAll, describe, expect, it } from 'vitest';

const EXPECTED = `/*
  Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://www.takaratomy.co.jp; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'; worker-src 'none'
  Cache-Control: no-store, max-age=0
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  X-Robots-Tag: noindex, nofollow, noarchive
`;

function cardImageStems(): Set<string> {
  const source = readdirSync('src/cards', { recursive: true, encoding: 'utf8' })
    .filter(path => path.endsWith('.ts'))
    .map(path => readFileSync(`src/cards/${path.replaceAll('\\', '/')}`, 'utf8'))
    .join('\n');
  return new Set(
    [...source.matchAll(/\bimageUrl:\s*['"]([^'"]+)['"]/g)]
      .map(([, filename]) => filename.toLowerCase().replace(/\.[^.]+$/, '')),
  );
}

function isCardImagePayload(path: string, knownStems: Set<string>): boolean {
  const normalized = path.replaceAll('\\', '/').toLowerCase();
  const basename = normalized.split('/').at(-1) ?? '';
  return /(?:^|\/)cards?(?:\/|$)/.test(normalized)
    || /(?:^|[-_.])[bdp]\d{5}p?(?:[-_.]|$)/.test(basename)
    || [...knownStems].some(stem => basename.startsWith(stem));
}

describe('private hosted security headers', () => {
  let buildOutput = '';

  beforeAll(() => {
    const npmCli = process.env.npm_execpath;
    if (!npmCli) throw new Error('npm_execpath is required');
    const result = spawnSync(process.execPath, [npmCli, 'run', 'build'], {
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production' },
    });
    if (result.error) throw result.error;
    buildOutput = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
  });

  it('defines the exact fail-closed policy for every path', () => {
    expect(readFileSync('public/_headers', 'utf8')).toBe(EXPECTED);
  });

  it('copies the exact policy into the production build', () => {
    expect(readFileSync('dist/_headers', 'utf8')).toBe(EXPECTED);
  });

  it('pins the release toolchain and ignores Wrangler state', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as {
      packageManager?: string;
      engines?: { node?: string };
      devDependencies?: Record<string, string>;
    };
    expect(pkg.packageManager).toBe('npm@11.12.1');
    expect(pkg.engines?.node).toBe('24.x');
    expect(pkg.devDependencies?.wrangler).toBe('4.118.0');
    expect(readFileSync('.gitignore', 'utf8').split(/\r?\n/)).toContain('.wrangler/');
  });

  it('aligns setup, CI, and operator guidance with the pinned toolchain', () => {
    const setup = readFileSync('scripts/setup-and-run.ps1', 'utf8');
    expect(setup).toContain('$RequiredNodeMajor = 24');
    expect(setup).toContain("$RequiredNpmVersion = '11.12.1'");
    expect(setup).toContain('if ($major -ne $RequiredNodeMajor)');
    expect(setup).toContain('if ($npmVersion -ne $RequiredNpmVersion)');
    expect(setup).not.toContain('& npm install');

    for (const path of ['.github/workflows/ci.yml', '.github/workflows/cards-sync.yml']) {
      const workflow = readFileSync(path, 'utf8');
      expect(workflow).toContain('node-version: 24');
      expect(workflow).toContain('npm install --global npm@11.12.1');
      expect(workflow).toContain('test "$(npm --version)" = "11.12.1"');
    }

    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain('Node.js 24.x');
    expect(readme).toContain('npm 11.12.1');
    expect(readme).toContain('`npm ci`。起動ごとに実行');
    expect(readme).not.toContain('初回のみ、最新ならスキップ');
  });

  it('runs npm ci on every setup invocation and fails closed', () => {
    const setup = readFileSync('scripts/setup-and-run.ps1', 'utf8');
    const lockGuard = setup.indexOf("if (-not (Test-Path 'package-lock.json'))");
    const npmCi = setup.indexOf('& npm ci');
    const failureGuard = setup.indexOf('if ($LASTEXITCODE -ne 0)', npmCi);

    expect(setup).not.toContain('LastWriteTime');
    expect(setup).not.toContain('$needInstall');
    expect(setup).not.toContain('インストールをスキップ');
    expect(setup.match(/& npm ci/g)).toHaveLength(1);
    expect(lockGuard).toBeGreaterThan(-1);
    expect(npmCi).toBeGreaterThan(lockGuard);
    expect(failureGuard).toBeGreaterThan(npmCi);
  });

  it('keeps Node and removed image helpers outside the browser boundary', () => {
    const source = [
      'src/engine/cards/registry.ts',
      'src/ui/services/cardImage.ts',
      'src/ui/hooks/useCardImage.ts',
    ].map(path => readFileSync(path, 'utf8')).join('\n');
    for (const forbidden of ['tsv-loader-fs', 'fetchCardImageUrl', 'localStorage']) {
      expect(source).not.toContain(forbidden);
    }
    expect(source).not.toMatch(/\bHEAD\b/);
    const nodeLoader = readFileSync('src/engine/cards/tsv-loader-fs.ts', 'utf8');
    expect(nodeLoader).not.toContain('registry.ts');
    expect(nodeLoader).not.toContain('await import()');

    const assetNames = readdirSync('dist/assets').filter(name => name.endsWith('.js'));
    expect(assetNames.length).toBeGreaterThan(0);
    expect(assetNames.some(name => name.includes('tsv-loader-fs'))).toBe(false);
    const javascript = assetNames
      .map(name => readFileSync(`dist/assets/${name}`, 'utf8'))
      .join('\n');
    for (const forbidden of [
      'tsv-loader-fs',
      'node:fs',
      'node:path',
      'node:url',
      'readFileSync',
      'fileURLToPath',
      '.claude/specs/cards-data',
      'fetchCardImageUrl',
      'localStorage',
      '__game',
    ]) {
      expect(javascript).not.toContain(forbidden);
    }
    expect(buildOutput).not.toContain('externalized for browser compatibility');
  });

  it('ships only the static application boundary', () => {
    const files = readdirSync('dist', { recursive: true, encoding: 'utf8' })
      .map(path => path.replaceAll('\\', '/'));
    const knownStems = cardImageStems();
    expect(knownStems.size).toBeGreaterThan(0);
    expect(isCardImagePayload('assets/1743743100639068-build.svg', knownStems)).toBe(true);
    expect(isCardImagePayload('assets/ui-background.webp', knownStems)).toBe(false);
    expect(files.filter(path => path.split('/').at(-1) === '_headers')).toHaveLength(1);
    expect(files.some(path => path.endsWith('.map'))).toBe(false);
    expect(files.filter(path => isCardImagePayload(path, knownStems))).toEqual([]);
    expect(files.some(path => /(?:^|\/)(?:functions|_worker\.js|_routes\.json)(?:\/|$)/i.test(path)))
      .toBe(false);

    const javascript = files
      .filter(path => path.endsWith('.js'))
      .map(path => readFileSync(`dist/${path}`, 'utf8'))
      .join('\n');
    for (const forbidden of ['cloudflare:', '__STATIC_CONTENT_MANIFEST', 'miniflare', 'workerd']) {
      expect(javascript).not.toContain(forbidden);
    }
  });
});
