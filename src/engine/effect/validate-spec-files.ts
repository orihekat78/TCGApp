// engine.effect.validate-spec-files — Node 専用 ruleRefs 実在チェック
// spec: .claude/specs/engine-api-effect-descriptor.md
// rules: 15-abilities-effects.md
//
// 設計メモ:
//   - validate.ts (pure DSL 検証) から node:fs 依存を分離した dev-time lint。
//   - effect/index.ts からは **意図的に re-export しない**。
//     ブラウザバンドルに node:* externalized proxy が混入するのを避けるため、
//     tests / scripts からのみ直接 import すること。
//   - 共通ルール: `'rules/<file>.md'` or `'rules/<file>.md§<anchor>'` 形式の
//     ruleRefs を持つカードの参照ファイルが `.claude/rules/` 配下に存在するか
//     を verify する。

import { existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CardDef, ValidationResult } from '../types/index.js';

// __dirname equivalent for ESM:
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// This file lives at src/engine/effect/validate-spec-files.ts → project root is ../../..
const PROJECT_ROOT = resolvePath(__dirname, '..', '..', '..');
const RULES_DIR = resolvePath(PROJECT_ROOT, '.claude', 'rules');

/**
 * 全 CardDef の `ruleRefs` エントリが `.claude/rules/<file>.md` として
 * 実在することを verify する。
 *
 * - ref フォーマット: `'rules/<file>.md'` or `'rules/<file>.md§<anchor>'`
 * - anchor 部 (§以降) は除外してファイルパス解決
 *
 * 戻り値:
 *   - 全件 OK: `{ ok: true }`
 *   - 1件以上不在: `{ ok: false, errors: [...] }`
 */
export function validateRuleRefs(defs: CardDef[]): ValidationResult {
  const errors: string[] = [];
  for (const def of defs) {
    for (const ref of def.ruleRefs ?? []) {
      const stripped = ref.split('§')[0];
      const trimmed = stripped.replace(/^rules\//, '');
      const filePath = resolvePath(RULES_DIR, trimmed);
      if (!existsSync(filePath)) {
        errors.push(`card ${def.id}: ruleRefs entry "${ref}" — file not found at ${filePath}`);
      }
    }
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true };
}
