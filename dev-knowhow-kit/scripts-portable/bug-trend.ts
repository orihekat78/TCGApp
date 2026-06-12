// Phase 7-A (LESSONS-LEARNED 教訓 / AUDIT-2026-05-22 派生):
// 5 再発パターン別の BUG 月次集計 script
//
// 出力: stdout に markdown 表 + .claude/reports/bug-trend-YYYY-MM-DD.md
//
// 使い方: npm run bug:trend

import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BUGS_DIR = join(process.cwd(), '.claude', 'bugs');
const REPORTS_DIR = join(process.cwd(), '.claude', 'reports');

type Cluster = 'side-channel' | 'listener' | 'ui-text' | 'modal-stack' | 'binding-ref' | 'other';

type Bug = {
  id: string;
  title: string;
  category: string;
  status: string;
  dateFound: string;
  dateFixed: string;
  rcaText: string;
  cluster: Cluster;
};

function parseFrontmatter(content: string): Record<string, string> {
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const fm: Record<string, string> = {};
  for (const line of m[1].split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    fm[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return fm;
}

function classifyCluster(b: Omit<Bug, 'cluster'>): Cluster {
  const txt = (b.title + ' ' + b.rcaText).toLowerCase();
  if (txt.includes('__pending') || txt.includes('side-channel') || txt.includes('drain')) {
    return 'side-channel';
  }
  if (txt.includes('listener') && (txt.includes('scope') || txt.includes('condition') || txt.includes('selfonly'))) {
    return 'listener';
  }
  if (b.category === 'ui-text' || b.title.includes('??')) {
    return 'ui-text';
  }
  if (b.category === 'ui-feature' && txt.includes('modal')) {
    return 'modal-stack';
  }
  if (txt.includes('$pick') || txt.includes('$matched') || txt.includes('bind ref') || txt.includes('binding')) {
    return 'binding-ref';
  }
  return 'other';
}

function loadBugs(): Bug[] {
  const files = readdirSync(BUGS_DIR)
    .filter((f) => /^BUG-\d{3}\.md$/.test(f))
    .sort();
  const bugs: Bug[] = [];
  for (const f of files) {
    const content = readFileSync(join(BUGS_DIR, f), 'utf-8');
    const fm = parseFrontmatter(content);
    // RCA テキストは ## RCA セクションから抽出 (最初の 3 段落程度)
    const rcaMatch = content.match(/## RCA[\s\S]*?(?=^## |\Z)/m);
    const rcaText = rcaMatch ? rcaMatch[0].slice(0, 800) : '';
    const base = {
      id: fm.id ?? f.replace('.md', ''),
      title: fm.title ?? '',
      category: fm.category ?? '',
      status: fm.status ?? '',
      dateFound: fm.date_found ?? '',
      dateFixed: fm.date_fixed ?? '',
      rcaText,
    };
    bugs.push({ ...base, cluster: classifyCluster(base) });
  }
  return bugs;
}

function monthOf(date: string): string {
  return date.length >= 7 ? date.slice(0, 7) : 'unknown';
}

function generateTrendReport(bugs: Bug[]): string {
  // 月 × cluster 集計 (date_found base)
  const months = new Set<string>();
  const byMonthCluster: Record<string, Record<Cluster, number>> = {};
  for (const b of bugs) {
    const m = monthOf(b.dateFound);
    months.add(m);
    if (!byMonthCluster[m]) {
      byMonthCluster[m] = { 'side-channel': 0, listener: 0, 'ui-text': 0, 'modal-stack': 0, 'binding-ref': 0, other: 0 };
    }
    byMonthCluster[m][b.cluster]++;
  }
  const sortedMonths = [...months].sort();
  const clusters: Cluster[] = ['side-channel', 'listener', 'ui-text', 'modal-stack', 'binding-ref', 'other'];

  // 全期間合計
  const totalByCluster: Record<Cluster, number> = { 'side-channel': 0, listener: 0, 'ui-text': 0, 'modal-stack': 0, 'binding-ref': 0, other: 0 };
  for (const b of bugs) totalByCluster[b.cluster]++;

  // open BUG 数 (status !== 修正済)
  const openBugs = bugs.filter((b) => b.status !== '修正済');

  const lines: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  lines.push(`# BUG Trend Report (${today})`);
  lines.push('');
  lines.push(`総 BUG 数: **${bugs.length}** / open: **${openBugs.length}** / closed (修正済): **${bugs.length - openBugs.length}**`);
  lines.push('');
  lines.push('## 再発パターン別合計');
  lines.push('');
  lines.push('| Cluster | 件数 |');
  lines.push('|---|---|');
  for (const c of clusters) lines.push(`| ${c} | ${totalByCluster[c]} |`);
  lines.push('');
  lines.push('## 月次 × cluster (date_found base)');
  lines.push('');
  lines.push('| 月 | ' + clusters.join(' | ') + ' | 合計 |');
  lines.push('|---|' + clusters.map(() => '---').join('|') + '|---|');
  for (const m of sortedMonths) {
    const row = byMonthCluster[m];
    const total = clusters.reduce((a, c) => a + row[c], 0);
    lines.push(`| ${m} | ` + clusters.map((c) => String(row[c])).join(' | ') + ` | ${total} |`);
  }
  lines.push('');
  if (openBugs.length > 0) {
    lines.push('## Open BUG (status !== 修正済)');
    lines.push('');
    for (const b of openBugs) {
      lines.push(`- ${b.id} [${b.status}] [${b.cluster}] ${b.title}`);
    }
  } else {
    lines.push('## Open BUG: なし ✨');
  }
  lines.push('');
  lines.push('## 教訓へのリンク');
  lines.push('');
  lines.push('- [LESSONS-LEARNED.md](../bugs/LESSONS-LEARNED.md) 各教訓 → enforcement script');
  lines.push('- [AUDIT-template.md](../bugs/AUDIT-template.md) 月次 audit 雛形');
  lines.push('');
  return lines.join('\n');
}

function main(): void {
  const bugs = loadBugs();
  const report = generateTrendReport(bugs);
  console.log(report);

  if (!existsSync(REPORTS_DIR)) mkdirSync(REPORTS_DIR, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const outPath = join(REPORTS_DIR, `bug-trend-${today}.md`);
  writeFileSync(outPath, report, 'utf-8');
  console.error(`\n[bug-trend] saved to ${outPath}`);
}

main();
