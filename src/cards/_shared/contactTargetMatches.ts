// cards/_shared/contactTargetMatches
// rules: 08-contact.md, 09-cutin-disguise.md, 22-qa-action-contact.md
// spec: .claude/specs/card-condition-catalog.md
//
// 「〚カード名/特徴/色〛のキャラに【カットイン】した/する場合」= **コンタクト中の自分のキャラ**
// ($contact.byUid、buildContactBindings の p-相対) が指定の カード名 / 特徴 / 色 のいずれかに
// 一致するかを判定する Condition を返す。
//
// ⚠ BUG-177 (2026-07-09): 旧実装は ctx.contact.targetUid (コンタクト相手) を読む custom closure
// だったが、B02006 公式Q&A「(少年探偵団が指定されガードしたのが別キャラの場合) いいえ。コンタクト中の
// **自分の**キャラがレベル5以下の特徴［少年探偵団］の場合にAP＋3000できる」により、
// 「〜のキャラに【カットイン】する」= カットインで支援する自分のコンタクトキャラと確定 →
// who:'byUid' (相対=自コンタクトキャラ) に修正。消費者 11 枚 (B04025/B04060/B06041/B06092/B06101/
// B07009/B07050/B08071/B08086/D10011/PR087、全て同構文) は本 helper 経由で一括修正。
// D11013 (inline custom だった) も同 wave で contactCharMatches へ直接移行。
// 実装は custom closure → engine cond 'contactCharMatches' (defer-unlock mini-wave 出荷、
// JSON シリアライズ可能) への委譲に置換 (Effect Descriptor 最大活用規約)。
// 共通クラスは破壊的変更禁止だが、本変更は公式裁定違反の修正 (挙動が仕様と逆) のため例外。

import type { Condition } from '@/engine/types';

export function contactTargetMatches(opts: {
  names?: string[];
  traits?: string[];
  colors?: string[];
}): Condition {
  // 旧 closure はカテゴリ間 OR (names/traits/colors のいずれか一致で true)。matchOneFilter の
  // filter field は AND 合成のため、カテゴリごとに contactCharMatches を作り or で束ねる
  // (単一カテゴリの消費者は単体 cond に縮約 = 大半)。cardName/trait/color の配列は
  // matchOneFilter 側で any-match (カテゴリ内 OR、旧実装と同値)。
  const conds: Condition[] = [];
  if (opts.names && opts.names.length) {
    conds.push({ kind: 'contactCharMatches', who: 'byUid', filter: { cardName: opts.names } });
  }
  if (opts.traits && opts.traits.length) {
    conds.push({ kind: 'contactCharMatches', who: 'byUid', filter: { trait: opts.traits } });
  }
  if (opts.colors && opts.colors.length) {
    conds.push({ kind: 'contactCharMatches', who: 'byUid', filter: { color: opts.colors } });
  }
  if (conds.length === 0) return { kind: 'false' };
  if (conds.length === 1) return conds[0];
  return { kind: 'or', cs: conds };
}
