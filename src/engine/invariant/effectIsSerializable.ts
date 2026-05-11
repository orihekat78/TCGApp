// engine.invariant.effectIsSerializable — エフェクトのシリアライズ可能性確認
// rules: CLAUDE.md (Effect Descriptor は JSON シリアライズ可能を維持)

import type { Effect } from '@/engine/types';

/**
 * エフェクトが JSON シリアライズ可能かどうかを確認する
 * custom kind 以外は throw。custom なら warning のみ
 */
export function effectIsSerializable(eff: Effect): void {
  // custom kind は警告のみ (TypeScript カスタム実装は許容)
  if ('kind' in eff && (eff as { kind: string }).kind === 'custom') {
    console.warn('effectIsSerializable: custom effect is not JSON-serializable (warning only)');
    return;
  }

  try {
    JSON.stringify(eff);
  } catch (e) {
    throw new Error(`effectIsSerializable: effect is not JSON-serializable: ${String(e)}`);
  }
}
