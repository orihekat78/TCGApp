// engine.read.keyword — CardDef がキーワード / アイコン能力を「持つ」かを判定する純粋述語。
// rules: 09-cutin-disguise.md, 10-action-event.md, 13-keywords.md, 17-icons.md
//
// 通常キーワード (迅速 / 突撃[X] / ブレット 等) は CardDef.keywords[] に格納される。
// 一方アイコン能力 (カットイン / 変装 / ヒラメキ / ミスリード) は keywords[] ではなく
// AbilityDef の type / scope / trigger 構造で表現される (2026-05-27 Option C 移行)。
//
// そのため `filter.keyword:'カットイン'` 等を keywords[] だけで判定すると永久に不一致になる
// (BUG-122: B05112「【カットイン】を持つキャラを登場」が候補0で機能しなかった)。
// 本モジュールが両表現を吸収する **単一の真実源** で、target.candidates (matchOneFilter) と
// flow.contact (isCutInCard) の双方が参照する (経路間ドリフト = BUG-117/118 同型の再発防止)。

import type { CardDef, AbilityDef, HookName } from '@/engine/types';

/**
 * カットイン能力か (flow.contact.cutIn / canCutIn の判定と同一)。
 * type:'triggered' + scope:'on-hand' + trigger:{hook:'effect:declared', optional:true}。
 */
export function abilityIsCutin(ab: AbilityDef): boolean {
  return (
    ab.type === 'triggered' &&
    ab.scope === 'on-hand' &&
    ab.trigger?.hook === 'effect:declared' &&
    ab.trigger?.optional === true
  );
}

/**
 * M2後半 (2026-07-10, D06003): CardDef が「【カットイン】<text>」を持つか — cutin ability の
 * 印字 description が text を包含するかで判定 (公式 qAndA の裁定基準は文字列包含。
 * 構造 walk (charModifyAP 有無) は「AP−」cutin や非 atom 表現で乖離しうるため不採用)。
 * エラッタ後テキストが description の正 (rules/28)。
 */
export function defHasCutinTextIncludes(def: CardDef | undefined, text: string): boolean {
  if (!def) return false;
  return (def.abilities ?? []).some(ab => abilityIsCutin(ab) && (ab.description ?? '').includes(text));
}

/**
 * ヒラメキ能力か (2026-05-27 Option C: type:'triggered' +
 * trigger:{hook:'evidence:remove-by-action', optional:true})。
 */
export function abilityIsHirameki(ab: AbilityDef): boolean {
  return (
    ab.type === 'triggered' &&
    ab.trigger?.hook === 'evidence:remove-by-action' &&
    ab.trigger?.optional === true
  );
}

/** trigger.hook + 追加 hooks[] (multi-hook trigger) をフラットに列挙する。 */
function triggerHooks(ab: AbilityDef): HookName[] {
  const t = ab.trigger;
  if (!t) return [];
  return [t.hook, ...(t.hooks ?? [])];
}

/**
 * 【現場リムーブ時】能力か (engine拡張 wave#2 cluster2, 2026-06-12)。
 * type:'triggered' + trigger.hook(s) に 'leave:to-remove' + selfOnly:true (D05007 正準形状)。
 * selfOnly でない leave:to-remove listener (「キャラがリムーブされたとき」observer 型) は
 * このキャラ自身の【現場リムーブ時】ではないため持つと判定しない。
 * presence は印字 (静的) 判定 — 条件アイコン (【相手ターン中】等) の有効性は問わない
 * (公式Q&A: B08082/B08094/B09104/B09073 ほか 8 件、rules/17 §「〜を持つ」参照)。
 */
export function abilityIsSceneRemoveTrigger(ab: AbilityDef): boolean {
  return (
    ab.type === 'triggered' &&
    ab.trigger?.selfOnly === true &&
    triggerHooks(ab).includes('leave:to-remove')
  );
}

/**
 * 【疾風 N】能力か — hook:'enter' + selfOnly + matcherCondition enterOrderEquals
 * (D11014 正準形状)。【登場時】(matcherCondition 無しの enter) とは区別する。
 */
export function abilityIsShippu(ab: AbilityDef): boolean {
  if (ab.type !== 'triggered' || ab.trigger?.selfOnly !== true) return false;
  if (!triggerHooks(ab).includes('enter')) return false;
  const mc = ab.trigger?.matcherCondition as { kind?: string } | undefined;
  return mc?.kind === 'enterOrderEquals';
}

/** アイコン能力キーワード名 → 該当 AbilityDef 述語。 */
const ICON_KEYWORD_PREDICATES: Record<string, (ab: AbilityDef) => boolean> = {
  カットイン: abilityIsCutin,
  ヒラメキ: abilityIsHirameki,
  変装: (ab) => ab.type === 'icon-disguise',
  ミスリード: (ab) => ab.type === 'icon-misread',
  // engine拡張 wave#2 cluster2: 「【現場リムーブ時】を持つ」「【疾風】を持つ」filter
  現場リムーブ時: abilityIsSceneRemoveTrigger,
  疾風: abilityIsShippu,
};

/**
 * True when each printed ability is one of the named icon abilities. This is
 * static metadata: disabled-original state and externally granted abilities
 * are intentionally irrelevant.
 */
export function defHasNoOriginalAbilityExceptIcons(def: CardDef | undefined, allowedIcons: string[]): boolean {
  if (!def) return false;
  // Normal printed keywords are original abilities too. They are not icon
  // AbilityDefs, so they must reject "X以外の元の能力を持たない" up front.
  if ((def.keywords ?? []).length > 0) return false;
  const predicates = allowedIcons.map(icon => ICON_KEYWORD_PREDICATES[icon]).filter((p): p is (ab: AbilityDef) => boolean => p !== undefined);
  if (predicates.length !== allowedIcons.length) return false;
  return (def.abilities ?? []).every(ab => predicates.some(predicate => predicate(ab)));
}

/** True only for a printed ability icon, never for ordinary keyword text. */
export function defHasIconKeyword(def: CardDef | undefined, keyword: string): boolean {
  if (!def) return false;
  const predicate = ICON_KEYWORD_PREDICATES[keyword];
  return predicate !== undefined && (def.abilities ?? []).some(predicate);
}

/**
 * CardDef がキーワード kw を「持つ」か。
 * 通常 keywords[] と、アイコン能力 (カットイン / 変装 / ヒラメキ / ミスリード) の
 * ability 構造の両方を見る。def が undefined なら false。
 */
export function defHasKeyword(def: CardDef | undefined, kw: string): boolean {
  if (!def) return false;
  if ((def.keywords ?? []).includes(kw)) return true;
  const pred = ICON_KEYWORD_PREDICATES[kw];
  if (pred) return (def.abilities ?? []).some(pred);
  return false;
}
