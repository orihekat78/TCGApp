// scripts/smoke/format-md — Phase 9-A smoke Markdown formatter (pure)
// AggregateReport → human-readable Markdown 文字列

import type { AggregateReport } from './aggregate.js';

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((n / total) * 100).toFixed(1)}%`;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n) + '...';
}

export function formatMarkdown(report: AggregateReport): string {
  const lines: string[] = [];
  const s = report.summary;
  const runtimeS = (s.totalDurationMs / 1000).toFixed(1);

  lines.push(`# Smoke ${report.totalGames}戦レポート — ${report.runId}`);
  lines.push('');
  lines.push(`- engine: \`${report.engineSha}\``);
  lines.push(`- runtime: ${runtimeS} s`);
  lines.push(`- 構成: heuristic × heuristic`);
  lines.push('');

  lines.push('## 集計');
  lines.push('');
  lines.push('| 項目 | 値 |');
  lines.push('|---|---|');
  lines.push(`| A デッキ勝利 | ${s.winsA} / ${s.totalGames} (${pct(s.winsA, s.totalGames)}) |`);
  lines.push(`| B デッキ勝利 | ${s.winsB} / ${s.totalGames} (${pct(s.winsB, s.totalGames)}) |`);
  lines.push(`| タイムアウト | ${s.timeouts} (${pct(s.timeouts, s.totalGames)}) |`);
  lines.push(`| エンジン例外 | ${s.exceptions} |`);
  lines.push(`| 平均ターン数 | ${s.avgTurns.toFixed(2)} |`);
  lines.push(`| ターン数 p50 / p95 | ${s.p50Turns.toFixed(1)} / ${s.p95Turns.toFixed(1)} |`);
  lines.push(`| 最大ターン数 | ${s.maxTurns} |`);
  // Phase 9-H: profile=true で smoke 実行された場合のみ per-turn ms percentile を表示
  if (s.p50TurnMs !== undefined) {
    lines.push(
      `| ターン処理時間 (ms) avg / p50 / p95 / p99 / max | ${s.avgTurnMs!.toFixed(2)} / ${s.p50TurnMs.toFixed(2)} / ${s.p95TurnMs!.toFixed(2)} / ${s.p99TurnMs!.toFixed(2)} / ${s.maxTurnMs!.toFixed(2)} |`,
    );
  }
  lines.push('');

  lines.push('## デッキ別');
  lines.push('');
  lines.push('| マッチアップ | 戦数 | 勝率 (A) | 勝率 (B) | 平均ターン | timeout | exception |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const p of report.perPairing) {
    lines.push(
      `| ${p.deckA} vs ${p.deckB} | ${p.games} | ${pct(p.winsA, p.games)} | ${pct(p.winsB, p.games)} | ${p.avgTurns.toFixed(1)} | ${p.timeouts} | ${p.exceptions} |`,
    );
  }
  lines.push('');

  lines.push('## 異常 (再現用 seed)');
  lines.push('');
  if (report.anomalies.length === 0) {
    lines.push('_異常なし_');
  } else {
    const ANOMALY_DISPLAY_CAP = 20;
    const total = report.anomalies.length;
    const shown = report.anomalies.slice(0, ANOMALY_DISPLAY_CAP);
    for (const a of shown) {
      const pair = `${a.pairing.deckA} vs ${a.pairing.deckB}`;
      if (a.reason === 'timeout') {
        lines.push(`- \`${a.seed}\` — timeout @ turn ${a.turn} (${pair})`);
      } else {
        const err = a.error ? ` — ${truncate(a.error, 120)}` : '';
        lines.push(`- \`${a.seed}\` — exception @ turn ${a.turn} (${pair})${err}`);
      }
    }
    if (total > ANOMALY_DISPLAY_CAP) {
      lines.push('');
      lines.push(`_+${total - ANOMALY_DISPLAY_CAP} more anomalies — see JSON for the full list_`);
    }
    lines.push('');
    lines.push('### 再現コマンド');
    lines.push('');
    lines.push('```bash');
    lines.push('tsx scripts/smoke/run-1000.ts --seed=<seed>');
    lines.push('```');
  }
  lines.push('');

  return lines.join('\n');
}
