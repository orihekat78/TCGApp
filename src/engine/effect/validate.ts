// engine.effect.validate / engine.cards.validate — static lint pass
// spec: .claude/specs/engine-api-effect-descriptor.md
// rules: 15-abilities-effects.md
//
// 設計メモ:
//   - Effect は JSON シリアライズ可能を維持 (kind:'custom' のみ例外)
//   - AtomVerb は既知 union のいずれかであること
//   - forEach.over は最低限の shape チェック (kind in {self,pick,all,fromBound})
//   - conditional は if + then を必須
//   - choice は options に1件以上
//
//   - cards.validate は ability.id 重複 + 各 ability.effect の validate +
//     ruleRefs の `.claude/rules/<file>.md` 実在チェック
//   - ruleRefs は 'rules/<file>.md§<anchor>' or 'rules/<file>.md' の形式を許容
//   - file 存在チェックは Node fs.existsSync (build-time / test-time のみ)

import { existsSync } from 'node:fs';
import { resolve as resolvePath, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Effect, ValidationResult, CardDef } from '../types/index.js';

// 既知 AtomVerb の runtime リスト。Effect 型のリテラル union とズレないよう
// 同期する必要がある (effect.ts AtomVerb)。
const ATOM_VERBS = new Set<string>([
  'draw', 'discard', 'mill', 'fileAdd', 'filePopToHand',
  'evidenceGain', 'evidenceLose', 'evidenceFlip',
  'evidenceToHand', 'handAddFromRemove',
  'sceneEnter', 'sceneSwitch', 'sceneRemove', 'sceneSetState', 'sceneDisguise',
  'charModifyAP', 'charModifyLP', 'charSetAP', 'charSetLP',
  'charOverrideAP', 'charOverrideLP',
  'charGrantKeyword', 'charRevokeKeyword', 'charDisableOriginal',
  'charSetTurnEffect', 'charSetCard', 'charStackCard',
  'partnerAssist', 'partnerSetState', 'partnerSolveCase',
  'caseToResolved',
  'startContact', 'endActionEarly',
  'deckRevealUntil', 'deckToBottomBound', 'deckShuffle',
  'log', 'noop',
]);

const TARGETING_KINDS = new Set<string>(['self', 'pick', 'all', 'fromBound']);

/**
 * Validate an Effect Descriptor:
 * - JSON-serializable shape (function values only allowed inside `kind:'custom'`)
 * - atom.verb known
 * - forEach.over: kind in {self,pick,all,fromBound}
 * - conditional: has `if` and `then`
 * - choice: options.length >= 1
 */
export function validate(eff: Effect): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  walk(eff, '', errors, warnings);
  if (errors.length > 0) return { ok: false, errors };
  return warnings.length > 0 ? { ok: true, warnings } : { ok: true };
}

function walk(node: unknown, path: string, errors: string[], warnings: string[]): void {
  if (node === null || typeof node !== 'object') {
    if (typeof node === 'function') {
      errors.push(`${path}: function value outside kind:'custom' is not JSON-serializable`);
    }
    return;
  }
  const obj = node as Record<string, unknown>;
  const kind = obj['kind'];
  switch (kind) {
    case 'sequence':
    case 'parallel': {
      const steps = obj['steps'];
      if (!Array.isArray(steps)) {
        errors.push(`${path}.steps: expected array`);
        return;
      }
      steps.forEach((s, i) => walk(s, `${path}.steps[${i}]`, errors, warnings));
      return;
    }
    case 'choice': {
      const options = obj['options'];
      if (!Array.isArray(options) || options.length < 1) {
        errors.push(`${path}.options: choice must have at least 1 option`);
        return;
      }
      options.forEach((o, i) => walk(o, `${path}.options[${i}]`, errors, warnings));
      return;
    }
    case 'optional': {
      walk(obj['effect'], `${path}.effect`, errors, warnings);
      return;
    }
    case 'conditional': {
      if (obj['if'] === undefined) errors.push(`${path}.if: required for conditional`);
      if (obj['then'] === undefined) errors.push(`${path}.then: required for conditional`);
      if (obj['else'] !== undefined) walk(obj['else'], `${path}.else`, errors, warnings);
      // `if` itself is a Condition (allowed to be a non-function structure or
      // kind:'custom' with a check function — but Condition is engine-internal
      // and outside Effect's JSON contract, so we don't deep-walk it).
      walk(obj['then'], `${path}.then`, errors, warnings);
      return;
    }
    case 'forEach': {
      const over = obj['over'] as Record<string, unknown> | undefined;
      if (!over || typeof over !== 'object') {
        errors.push(`${path}.over: required for forEach`);
      } else if (typeof over['kind'] !== 'string' || !TARGETING_KINDS.has(over['kind'])) {
        errors.push(`${path}.over.kind: must be one of ${Array.from(TARGETING_KINDS).join('|')}`);
      }
      walk(obj['do'], `${path}.do`, errors, warnings);
      return;
    }
    case 'replace': {
      walk(obj['with'], `${path}.with`, errors, warnings);
      return;
    }
    case 'negate': {
      return;
    }
    case 'atom': {
      const verb = obj['verb'];
      if (typeof verb !== 'string' || !ATOM_VERBS.has(verb)) {
        errors.push(`${path}.verb: unknown atom verb "${String(verb)}"`);
      }
      // args is treated opaquely here; per-verb arg validation belongs to runAtom.
      return;
    }
    case 'custom': {
      // custom is exempt from JSON-serialization check; do not walk fn.
      if (typeof obj['fn'] !== 'function') {
        errors.push(`${path}.fn: custom Effect requires fn: (state, ctx) => void`);
      }
      return;
    }
    default:
      errors.push(`${path}.kind: unknown Effect kind "${String(kind)}"`);
  }
}

// --- engine.cards.validate ---

// Resolve project root relative to this file so test-time and build-time both work.
// __dirname equivalent for ESM:
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// This file lives at src/engine/effect/validate.ts → project root is ../../..
const PROJECT_ROOT = resolvePath(__dirname, '..', '..', '..');
const RULES_DIR = resolvePath(PROJECT_ROOT, '.claude', 'rules');

/**
 * Validate an array of CardDef:
 * - ability ids unique within a def
 * - each ability.effect passes engine.effect.validate
 * - ruleRefs entries point to existing files under .claude/rules/
 *
 * Note: ability shape is currently typed as `unknown[]` until Phase 5
 * formalises AbilityDef. This validator narrows on the fly.
 */
export function validateCards(defs: CardDef[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const def of defs) {
    const seen = new Set<string>();
    const abilities = (def.abilities ?? []) as unknown[];
    abilities.forEach((ab, i) => {
      if (!ab || typeof ab !== 'object') return;
      const a = ab as Record<string, unknown>;
      const abId = a['id'];
      if (typeof abId === 'string') {
        if (seen.has(abId)) {
          errors.push(`card ${def.id}: duplicate ability id "${abId}"`);
        }
        seen.add(abId);
      }
      const eff = a['effect'];
      if (eff !== undefined) {
        const r = validate(eff as Effect);
        if (!r.ok) {
          for (const e of r.errors) {
            errors.push(`card ${def.id} ability[${i}]: ${e}`);
          }
        }
      }
    });

    // ruleRefs: 'rules/11-reasoning.md' or 'rules/11-reasoning.md§<anchor>'
    for (const ref of def.ruleRefs ?? []) {
      const stripped = ref.split('§')[0];
      const trimmed = stripped.replace(/^rules\//, '');
      const filePath = resolvePath(RULES_DIR, trimmed);
      if (!existsSync(filePath)) {
        errors.push(`card ${def.id}: ruleRefs entry "${ref}" — file not found at ${filePath}`);
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return warnings.length > 0 ? { ok: true, warnings } : { ok: true };
}
