// cards/_shared/contactTargetMatches
// rules: 08-contact.md, 09-cutin-disguise.md, 22-qa-action-contact.md
// spec: .claude/specs/card-condition-catalog.md
//
// 「〚カード名/特徴/色〛のキャラに【カットイン】した場合」= コンタクト相手
// ($contact.targetUid) が指定の カード名 / 特徴 / 色 のいずれかに一致するかを判定する
// custom Condition を返す。
//
// 骨格凍結原則のため engine の condition kind は追加せず custom closure で表現する
// (D11013 の inline custom と同型、effect 内 conditional{if} で使う)。
// 共通クラスは破壊的変更禁止。新パターンは新クラス追加で対応。

import type { Condition, EffectCtx, GameState } from '@/engine/types';
import { engine } from '@/engine';

export function contactTargetMatches(opts: {
  names?: string[];
  traits?: string[];
  colors?: string[];
}): Condition {
  return {
    kind: 'custom',
    check: (s: GameState, ctx: EffectCtx) => {
      const tgt = ctx.contact?.targetUid;
      if (!tgt) return false;
      if (opts.names && opts.names.length) {
        const ns = engine.read.char.names(s, tgt);
        if (opts.names.some((n) => ns.includes(n))) return true;
      }
      if (opts.traits && opts.traits.length) {
        const ts = engine.read.char.traits(s, tgt);
        if (opts.traits.some((t) => ts.includes(t))) return true;
      }
      if (opts.colors && opts.colors.length) {
        const cs = engine.read.char.colors(s, tgt);
        if (opts.colors.some((c) => cs.includes(c))) return true;
      }
      return false;
    },
  };
}
