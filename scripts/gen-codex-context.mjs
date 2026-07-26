import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_ITEMS = 12;

function lines(value) {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function git(root, args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'unavailable';
  }
}

function frontmatter(content, key) {
  return content.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? 'unknown';
}

export function sortBugFilenames(names) {
  return [...names].sort((left, right) => {
    const leftId = Number(left.match(/BUG-(\d+)/)?.[1] ?? 0);
    const rightId = Number(right.match(/BUG-(\d+)/)?.[1] ?? 0);
    return rightId - leftId;
  });
}

function collectBugs(root) {
  const directory = join(root, '.claude', 'bugs');
  try {
    return sortBugFilenames(
      readdirSync(directory).filter((name) => /^BUG-\d+\.md$/.test(name)),
    )
      .map((name) => {
        const content = readFileSync(join(directory, name), 'utf8');
        const status = frontmatter(content, 'status');
        if (/修正済|closed|resolved/i.test(status)) return null;
        return `${frontmatter(content, 'id')}: ${status} - ${frontmatter(content, 'title')}`;
      })
      .filter(Boolean)
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

export function selectRecentBullets(value, limit) {
  const bullets = [];
  let current = null;
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (/^[-*]\s+/.test(line)) {
      current = line.replace(/^[-*]\s+/, '');
      bullets.push(current);
    } else if (current && line && !line.startsWith('#')) {
      current = `${current} ${line}`;
      bullets[bullets.length - 1] = current;
    } else if (line.startsWith('#')) {
      current = null;
    }
  }
  return bullets.slice(-limit);
}

function collectBullets(path, limit) {
  try {
    return selectRecentBullets(readFileSync(path, 'utf8'), limit);
  } catch {
    return [];
  }
}

function collectNextPrompt(root) {
  const path = join(root, '.claude', 'NEXT-SESSION-PROMPT.md');
  try {
    return lines(readFileSync(path, 'utf8'))
      .find((line) => !line.startsWith('#') && !line.startsWith('```')) ?? 'None recorded.';
  } catch {
    return 'None recorded.';
  }
}

function section(title, items, empty = 'None.') {
  return [`## ${title}`, '', ...(items.length ? items.map((item) => `- ${item}`) : [`- ${empty}`]), ''];
}

export function renderCodexContext(snapshot) {
  const output = [
    '# Current Codex Context',
    '',
    `latest commit time: ${snapshot.generatedAt}`,
    `branch: \`${snapshot.branch}\``,
    `latest commit: ${snapshot.latestCommit}`,
    '',
    ...section('Current Work', snapshot.memorySummary),
    ...section('Worktree', snapshot.worktree),
    ...section('Active Bugs', snapshot.activeBugs),
    '## Next Session',
    '',
    snapshot.nextPrompt,
    '',
    'Use the nearest `AGENTS.md` and `conan-router` before opening more context.',
    '',
  ];
  return output.slice(0, 80).join('\n');
}

export function generateCodexContext(root = process.cwd()) {
  const status = lines(git(root, ['status', '--short']));
  const worktree = status.slice(0, MAX_ITEMS);
  if (status.length > MAX_ITEMS) worktree.push(`... ${status.length - MAX_ITEMS} more paths`);
  return renderCodexContext({
    generatedAt: git(root, ['log', '-1', '--pretty=format:%cI']),
    branch: git(root, ['branch', '--show-current']),
    latestCommit: git(root, ['log', '-1', '--pretty=format:%h %s']),
    worktree,
    activeBugs: collectBugs(root),
    memorySummary: collectBullets(join(root, '.claude', 'memory.md'), 8),
    nextPrompt: collectNextPrompt(root),
  });
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const root = process.cwd();
  const output = join(root, '.codex', 'context', 'current.md');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, generateCodexContext(root), 'utf8');
  console.log(output);
}
