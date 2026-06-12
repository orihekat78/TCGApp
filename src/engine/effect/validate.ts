// engine.effect.validate / engine.cards.validate — static lint pass (pure)
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
//   - cards.validate は ability.id 重複 + 各 ability.effect の validate
//   - ruleRefs の実在チェックは `./validate-spec-files.ts` (Node 専用) に分離。
//     ブラウザバンドルから node:fs 依存を切り離すため、ここでは行わない。

import type { Effect, ValidationResult, CardDef } from '../types/index.js';

// 既知 AtomVerb の runtime リスト。Effect 型のリテラル union とズレないよう
// 同期する必要がある (effect.ts AtomVerb)。
const ATOM_VERBS = new Set<string>([
  'draw', 'discard', 'mill', 'fileAdd', 'filePopToHand',
  'fileRemoveTop', 'fileFlipTop', // Task D E3 (2026-06-12)
  'evidenceGain', 'evidenceLose', 'evidenceFlip', 'selfToEvidence', 'evidenceToDeck',
  'evidenceToHand', 'handAddFromRemove', 'handAddFromDeck',
  'sceneEnter', 'sceneSwitch', 'sceneRemove', 'sceneSetState', 'sceneDisguise', 'sceneToHand',
  'sceneToDeck', // Task D E2 (2026-06-12)
  'charModifyAP', 'charModifyLP', 'charModifyLevel', 'charSetAP', 'charSetLP',
  'charOverrideAP', 'charOverrideLP',
  'charGrantKeyword', 'charRevokeKeyword', 'charDisableOriginal',
  'charGrantAbility', // Task D E4 (2026-06-12)
  'charSetTurnEffect', 'charSetCard', 'charStackCard', 'charRemoveSetCard',
  'partnerAssist', 'partnerSetState', 'partnerSolveCase',
  'caseToResolved',
  'startContact', 'endActionEarly',
  'deckRevealUntil', 'deckToBottomBound', 'deckShuffle', 'souza',
  'expandActionTargets', // D11007 v2 Phase 3
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
    case 'parallel':
    // 拡張 5: chain も同じ steps[] 構造 (semantics は resolver 側で差異)
    case 'chain': {
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
      // Task D E4 (2026-06-12): charGrantAbility は ability descriptor を JSON で運ぶ規約
      // (CLAUDE.md: Effect Descriptor の JSON シリアライズ可能性維持)。
      //  - ability 必須 (object)
      //  - ability 内に function 不可 (matcher closure / kind:'custom' effect 禁止)
      //  - trigger.hook='leave:to-remove' は禁止 (virtual-location handler が granted を走査しないため発火不能)
      if (verb === 'charGrantAbility') {
        const args = obj['args'] as Record<string, unknown> | undefined;
        const ability = args?.['ability'];
        if (!ability || typeof ability !== 'object') {
          errors.push(`${path}.args.ability: charGrantAbility requires ability descriptor object`);
        } else {
          validateGrantedAbility(ability as Record<string, unknown>, `${path}.args.ability`, errors);
        }
      }
      // args is otherwise treated opaquely here; per-verb arg validation belongs to runAtom.
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

/**
 * Task D E4 (2026-06-12): charGrantAbility の ability descriptor 検証。
 * - 深層に function があれば error (JSON シリアライズ可能性)
 * - trigger.hook / trigger.hooks[] に 'leave:to-remove' があれば error
 * - effect があれば通常の Effect として walk
 */
function validateGrantedAbility(ability: Record<string, unknown>, path: string, errors: string[]): void {
  const trig = ability['trigger'] as Record<string, unknown> | undefined;
  if (!trig || typeof trig !== 'object') {
    errors.push(`${path}.trigger: granted ability requires trigger`);
  } else {
    const hooks = [trig['hook'], ...(Array.isArray(trig['hooks']) ? trig['hooks'] : [])];
    if (hooks.includes('leave:to-remove')) {
      errors.push(`${path}.trigger: hook 'leave:to-remove' cannot be granted (virtual-location handler does not scan grantedAbilities)`);
    }
  }
  // 深層 function 検査 (effect の kind:'custom' 例外も granted では認めない)
  const stack: Array<{ v: unknown; p: string }> = [{ v: ability, p: path }];
  while (stack.length > 0) {
    const { v, p } = stack.pop()!;
    if (typeof v === 'function') {
      errors.push(`${p}: function value is not allowed inside granted ability (JSON-serializable required)`);
      continue;
    }
    if (v && typeof v === 'object') {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        stack.push({ v: child, p: `${p}.${k}` });
      }
    }
  }
}

// --- engine.cards.validate ---

/**
 * Validate an array of CardDef (pure):
 * - ability ids unique within a def
 * - each ability.effect passes engine.effect.validate
 *
 * Note: ability shape is currently typed as `unknown[]` until Phase 5
 * formalises AbilityDef. This validator narrows on the fly.
 *
 * ruleRefs 実在チェックは `validate-spec-files.ts` の `validateRuleRefs` を
 * Node 経路 (tests / scripts) から別途呼ぶこと。
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
  }

  if (errors.length > 0) return { ok: false, errors };
  return warnings.length > 0 ? { ok: true, warnings } : { ok: true };
}
