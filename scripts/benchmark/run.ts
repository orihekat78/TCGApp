// scripts/benchmark/run — Phase 9-H パフォーマンス計測ランナー
// spec: .claude/specs/phase-9-h-performance.md
//
// 役割:
//   - smoke/run-1000.ts と同じ 1000 戦 AI vs AI を `--profile` 有効固定で実行
//   - per-turn 経過 ms の p50 / p95 / p99 を report に含める
//   - baseline target: 1 turn ≤ 100ms
//
// CLI:
//   npm run benchmark       # 1000 戦 profile (~3-4 sec on Phase 7-3 baseline)
//   npm run benchmark -- --verbose
//
// 実装: run-1000.ts のロジックを再利用 (process.argv に --profile を強制注入)。
// 既存 smoke が profile=false 維持で smoke baseline (525/475) も無変動なまま、
// benchmark だけが per-turn 計測を出す cleaner な責務分離。

// process.argv から '--profile' が既に含まれているかを確認、無ければ追加
if (!process.argv.includes('--profile')) {
  process.argv.push('--profile');
}

// run-1000.ts の main 実行を発火 (top-level await ではなく副作用 import で main() 実行を起動)
import('../smoke/run-1000.js').then(() => {
  // run-1000.ts の main() は自動で呼ばれる (script entry pattern)
}).catch((err) => {
  console.error('[benchmark] failed:', err);
  process.exit(1);
});
