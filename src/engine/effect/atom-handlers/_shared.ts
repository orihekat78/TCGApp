// engine.effect.atom-handlers/_shared — Phase 3a: 共有 helper / 型 / side-channel
// 元 atom-handlers.ts L14-309 を無改変移送 + export 付与 (refactor Phase 3a, 2026-06-22)
import type { GameState, AtomVerb, EffectCtx } from '../../types/index.js';
import type { TargetFilter } from '../../types/effect.js';
import { mutate } from '../../mutate/index.js';
import { cards as engineCards } from '../../cards/index.js';
import { tryRePickFromAtom } from '../resolve-picks.js';
import { buildShortFormPick } from '../atom-pick-spec.js';
import { evalDyn } from '../../dyn/eval.js';
import { defHasKeyword } from '../../read/keyword.js';
import { allCardNameComponentsForDef } from '../../target/card-def-registry.js';

declare global {
  // eslint-disable-next-line no-var
  var __pendingDeckRevealSide: PendingDeckRevealSide | null | undefined;
}

export type PendingDeckRevealSide = {
  player: 'self' | 'opp';
  /** デッキ上から公開した順番のカード ID (matched 含む末尾) */
  revealed: string[];
  /** filter match した cardId、null なら全公開でも不一致 */
  matched: string | null;
  /**
   * BUG-132 GAP-1: chooseMatch (「1枚まで」) の human pick が未解決の間 true。
   * DeckRevealOverlay は自動進行 (toBottom→shuffle→dismiss) を停止して公開リストを
   * 表示し続け、EffectPickerModal (z-index 上位) の選択/decline を待つ。
   * pick 解決の再入時に確定 matched で再 set される (awaitingPick 無し → 通常演出)。
   */
  awaitingPick?: boolean;
};

export function _drainPendingDeckRevealSide(): PendingDeckRevealSide | null {
  const v = (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | null }).__pendingDeckRevealSide ?? null;
  (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | null }).__pendingDeckRevealSide = null;
  return v;
}

// BUG-136: deckToBottomBound「残りを好きな順番でデッキの下に移す」の順序選択 side-channel
// (side-channel-pattern.md 準拠)。human 所有 & 2 枚以上を底へ移したときのみ set し、UI の
// DeckReorderModal が並べ替えを surface する。AI / spectator / smoke (__humanPlayerSide が
// 当該 player でない) では set しないため従来挙動 byte-equal (公開順固定 = 合法な一choice)。
declare global {
  // eslint-disable-next-line no-var
  var __pendingDeckReorderSide: PendingDeckReorderSide | null | undefined;
}

export type PendingDeckReorderSide = {
  player: 'self' | 'opp';
  /** デッキ底へ移した cardId 群 (現在の底ブロック、公開順)。human が任意順に並べ替える対象 */
  cardIds: string[];
};

export function _drainPendingDeckReorderSide(): PendingDeckReorderSide | null {
  const v = (globalThis as { __pendingDeckReorderSide?: PendingDeckReorderSide | null }).__pendingDeckReorderSide ?? null;
  (globalThis as { __pendingDeckReorderSide?: PendingDeckReorderSide | null }).__pendingDeckReorderSide = null;
  return v;
}

// mega-wave W6 step9 (2026-07-04, row65): startContact atom が生成した ActionContext.id の
// 片道通知 (effect atom → React store の produce 境界越え、hirameki/misread/deckReveal と同型)。
// UI 側は drain → store.setActiveActionId(id) で useContactFlowDriver が拾う。
// ⚠ scalar なので同一 effect chain 内で startContact が複数回発火すると後勝ち上書き —
// 現 exemplar (B06020/B06042) は 0-1 pick 単発なので到達しない。複数発火カードが出たら
// pendingEffectPick 同様の queue 化が要る (row65 risks(4))。
declare global {
  // eslint-disable-next-line no-var
  var __pendingContactStartAxId: string | null | undefined;
}

export function _setPendingContactStartAxId(id: string): void {
  (globalThis as { __pendingContactStartAxId?: string | null }).__pendingContactStartAxId = id;
}

export function _drainPendingContactStartAxId(): string | null {
  const v = (globalThis as { __pendingContactStartAxId?: string | null }).__pendingContactStartAxId ?? null;
  (globalThis as { __pendingContactStartAxId?: string | null }).__pendingContactStartAxId = null;
  return v;
}

/**
 * BUG-045 (#9 spectator stall fix の副産物): deckRevealUntil 等で
 * TargetFilter (declarative object) を predicate に変換するヘルパ。
 * src/engine/target/candidates.ts matchOneFilter の cardId-based subset。
 * 対応: cardId / color / trait / apMin/Max / lpMin/Max / levelMin/Max / kind ('character' | 'event')。
 *
 * BUG-117 (2026-06-05): apMin/apMax/lpMin/lpMax が未実装で **黙って drop** されていた。
 *   型 (TargetFilter) には在るため typecheck は通り、B01013「LP0の青」/ B01053「LP2以上の白」が
 *   LP 条件を無視して最初の色一致キャラを拾っていた (Playwright で実機検出)。
 *   deck 内のカードは scene candidate (turnEffects/override) を持たないため、printed 値
 *   (d.ap/d.lp/d.level、undefined は 0) で判定する = matchOneFilter の非現場ケースと同式。
 */
export function targetFilterToPredicate(filter: TargetFilter | undefined): (cardId: string) => boolean {
  if (!filter) return () => true;
  return (cardId: string) => {
    const d = engineCards.get(cardId);
    if (!d) return false;
    if (filter.cardId !== undefined) {
      const ids = Array.isArray(filter.cardId) ? filter.cardId : [filter.cardId];
      if (!ids.includes(cardId)) return false;
    }
    if (filter.color !== undefined) {
      const wants = Array.isArray(filter.color) ? filter.color : [filter.color];
      if (!wants.some(w => d.colors.includes(w))) return false;
    }
    // engine additive (2026-06-27): colorNot (「【X】以外の色を持つ」) — matchOneFilter /
    // boundMatchesFilter と同式 (3経路 sync)。some説 (公式 B08079): 全色が notSet 内のとき除外。
    if (filter.colorNot !== undefined) {
      const nots = Array.isArray(filter.colorNot) ? filter.colorNot : [filter.colorNot];
      if (!d.colors.some(c => !nots.includes(c))) return false;
    }
    if (filter.trait !== undefined) {
      const wants = Array.isArray(filter.trait) ? filter.trait : [filter.trait];
      if (!wants.some(w => d.traits?.includes(w))) return false;
    }
    // BUG-117: AP/LP filter (printed 値判定 — deck card は override/turnEffect を持たない)
    const ap = d.ap ?? 0;
    if (filter.apMin !== undefined && ap < filter.apMin) return false;
    if (filter.apMax !== undefined && ap > filter.apMax) return false;
    const lp = d.lp ?? 0;
    if (filter.lpMin !== undefined && lp < filter.lpMin) return false;
    if (filter.lpMax !== undefined && lp > filter.lpMax) return false;
    if (filter.levelMin !== undefined && (d.level ?? 0) < filter.levelMin) return false;
    if (filter.levelMax !== undefined && (d.level ?? Infinity) > filter.levelMax) return false;
    // mega-wave W5 (2026-07-04, r47 review nit): levelIn / 未解決 levelInBound。levelIn は printed 判定
    // (deck/remove カードに修飾は乗らない)。levelInBound は本経路 (deckRevealUntil 等 cardId-based) では
    // 解決機構が無い = fail-closed で全不一致 (silent drop 防止)。ctx 付き解決は candidates() 経由のみ。
    if (filter.levelIn !== undefined && !filter.levelIn.includes(d.level ?? 0)) return false;
    if (filter.levelInBound !== undefined) return false;
    // BUG-118: kind は TargetFilter 型に昇格済 (matchOneFilter と統一)
    if (filter.kind !== undefined && d.kind !== filter.kind) return false;
    // wave#2 cluster2 (2026-06-12): keyword / cardName が silent drop されていた (BUG-117/118 同型
    // ドリフト)。matchOneFilter と同じ単一真実源 (defHasKeyword / allCardNameComponentsForDef) に委譲。
    // hasSetCards / custom / actedCharThisTurn (wave-7 P17) は deck カードに state / closure / turnEffects が
    // 無く本質的に評価不能 → 非対応のまま (matchOneFilter の scene candidate 専用 semantics)。deck-look/reveal
    // 経路 (picks.ts) の filter でこれら board-only 軸を使うカードは想定外 (現状 0)。
    if (filter.keyword !== undefined) {
      const wants = Array.isArray(filter.keyword) ? filter.keyword : [filter.keyword];
      if (!wants.some(w => defHasKeyword(d, w))) return false;
    }
    if (filter.cardName !== undefined) {
      const wants = Array.isArray(filter.cardName) ? filter.cardName : [filter.cardName];
      const components = allCardNameComponentsForDef(d);
      if (!wants.some(w => components.includes(w))) return false;
    }
    // cluster16: cardNameNot (「〚カード名[X]〛以外」) — matchOneFilter / boundMatchesFilter と同式。
    if (filter.cardNameNot !== undefined) {
      const nots = Array.isArray(filter.cardNameNot) ? filter.cardNameNot : [filter.cardNameNot];
      const components = allCardNameComponentsForDef(d);
      if (nots.some(w => components.includes(w))) return false;
    }
    return true;
  };
}

export type Player = 'self' | 'opp';

/**
 * 必須スカラーフィールドの実行時検証。
 * 呼び出し元が typo などで undefined を渡した場合に mutate 層へ伝搬する前に検知する。
 * optional フィールド・nullable フィールドはここでは検証しない。
 */
export function requireField<T>(args: Record<string, unknown>, key: string, kind: 'string' | 'number' | 'boolean' | 'object'): T {
  const v = args[key];
  if (kind === 'object') {
    if (v === null || typeof v !== 'object') {
      throw new Error(`atom args missing ${kind} field "${key}"`);
    }
  } else if (typeof v !== kind) {
    throw new Error(`atom args missing ${kind} field "${key}" (got ${typeof v})`);
  }
  return v as T;
}

/**
 * BUG-079: card DSL の `player: 'self'` リテラルを ctx.source.player ベースで
 * relative resolution する。'self' = source card の owner、'opp' = opp-of-owner。
 *
 * 旧コードは `resolvePlayer(a.player, ctx)` でリテラル絶対 ID として処理していたため、
 * CPU 側 (opp) の card の `player: 'self'` が人間 (絶対 self) に効果を向けて
 * いた。cond/eval.ts の `resolvePlayer` と同じ慣習を atom 側にも統一。
 */
export function resolvePlayer(p: unknown, ctx: EffectCtx): Player {
  const owner = ctx.source.player as Player;
  if (p === 'self') return owner;
  if (p === 'opp')  return owner === 'self' ? 'opp' : 'self';
  // 想定外の入力は明示 throw (旧 requireField<Player> の保護を維持)
  throw new Error(`atom args missing string field "player" (got ${typeof p})`);
}

/**
 * Atom Verb → engine.mutate.* ディスパッチャ
 * 未知の verb は Error を throw する (defensive)
 */
/**
 * user_request 20260522_01 #12 fix: bind 参照 `$key.field` を ctx.bindings から
 * 解決する helper。
 *
 * D11019 等で `args: { cardId: '$matched.cardId' }` のような bind 参照が
 * atom handler に未解決のまま到達して `cardId='$matched.cardId'` の scene char
 * が作られ ?? 表示になっていたのを修正。
 *
 * pattern: `$<bindKey>.<field>` (例: `$matched.cardId`, `$matched.uid`)
 * - bindKey が ctx.bindings にあり、配列の先頭要素から field を取り出して返却
 * - 未解決 / 想定外 → 元 value をそのまま返す (caller 側で warning)
 */
export function resolveBindRef(value: unknown, ctx: EffectCtx): unknown {
  if (typeof value !== 'string') return value;
  if (!value.startsWith('$')) return value;
  // $self (no dot) → ctx.source.uid (source card's uid)
  // 多くのカード (D11007 a3 charModifyAP / D08005 charGrantKeyword / D11005 charSetTurnEffect 等)
  // が「このキャラ自身」を指すために $self を使う。
  if (value === '$self') {
    return ctx.source.uid ?? value;
  }
  // 2026-06-06 タスクC: $trigger.<field> → トリガ payload のキャラ参照。「そのキャラ」(=反応の
  // きっかけになったキャラ) を effect target にするための binding。payload は hook ごとに形が
  // 異なるため uid は payload.uid ?? payload.byUid で吸収 (reasoning:end={uid,player,gained} /
  // action:declare={byUid,target} / leave:to-remove={uid,cause})。runtime ctx は entryToCtx で
  // triggerPayload を持つ (stack.ts)。B05080「そのキャラをLP-1」等で使用。
  if (value.startsWith('$trigger.')) {
    const tfield = value.slice('$trigger.'.length);
    const tp = (ctx as { triggerPayload?: Record<string, unknown> }).triggerPayload;
    if (!tp || typeof tp !== 'object') return value;
    if (tfield === 'uid') return (tp['uid'] ?? tp['byUid']) ?? value;
    return tp[tfield] ?? value;
  }
  // mega-wave W6 step2 (2026-07-04, rows 74/999 統合): $dyn.<key> → ctx.dyn[<key>]。
  // charSetTurnEffect val:'$dyn.declaredName' (PR105 nameOverride) 等が使う。既存 prefix 分岐は
  // 無変更の additive ブランチ。未供給 key は元値 passthrough (caller 側 defensive、他 prefix と同 posture)。
  if (value.startsWith('$dyn.')) {
    const dkey = value.slice('$dyn.'.length);
    const dynObj = ctx.dyn as Record<string, unknown> | undefined;
    return dynObj && dkey in dynObj ? dynObj[dkey] : value;
  }
  const dot = value.indexOf('.');
  if (dot < 0) return value;
  const key = value.slice(1, dot);
  const field = value.slice(dot + 1);
  // BUG-091: ctx.bindings のキー規約が混在する。contact.ts は `contact` ($無し) で格納し、
  // deckRevealUntil は `$matched` / `$revealed` ($込み、a.bind/a.bindMatch をそのまま使用) で格納する。
  // まず $無しキー (contact 等) を引き、無ければ $込みキー ($matched 等) に fallback する
  // (純粋に additive — 従来 $無しで解決していたカードの挙動は不変)。
  let binding = (ctx.bindings as Record<string, unknown>)[key];
  if (!Array.isArray(binding) || binding.length === 0) {
    binding = (ctx.bindings as Record<string, unknown>)[value.slice(0, dot)];
  }
  if (!Array.isArray(binding) || binding.length === 0) return value;
  const first = binding[0] as Record<string, unknown>;
  const fieldVal = first[field];
  return fieldVal ?? value;
}

/**
 * BUG-114: explicit-uid の charModifyAP/LP/Level における delta 解決。
 * 短縮形 (pick) 経路は resolveDynArgs で literal 化されるが、explicit-uid 経路 (uid='$contact.byUid' 等)
 * は従来 number 専用だった (`a.delta as number`)。{dyn} delta を runtime に evalDyn で数値化する
 * (B05040 '$discarded.level * 1000' / B08055 '$discarded.ap')。number はそのまま (既存挙動不変)。
 * 非有限値は 0 (NaN ガード、AP/LP を汚染しない)。
 */
export function resolveDeltaToNumber(delta: unknown, s: GameState, ctx: EffectCtx): number {
  if (typeof delta === 'number') return delta;
  if (delta !== null && typeof delta === 'object' && 'dyn' in delta) {
    const v = evalDyn(s, (delta as { dyn: string }).dyn, ctx);
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }
  return 0;
}

/**
 * BUG-074: BUG-065 で resolve-picks が pattern B 解決時に target を array (`[cardId]`)
 * で構築するよう変更。一部 atom (evidenceToHand / handAddFromRemove) は元々 string を
 * 期待していたため、両形式から最初の cardId を取り出す正規化ヘルパー。
 *
 * 戻り値:
 *   - string → そのまま返す
 *   - string[] → 先頭要素を返す (n=1 ケースのみ正しく動作。n>1 の場合は要拡張)
 *   - その他 (undefined / pick query object) → undefined (caller が awaiting-pick と判断)
 */
export function normalizeTargetToString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

/**
 * Pattern B atom (evidenceToHand / discard / handAddFromRemove) の引数省略形対応 helper。
 *
 * カード DSL 上「自分の x エリアから n 枚選ぶ」と書きたい場合、target を毎回
 * `{ kind:'pick', query:{area,side}, n:{min,max}, chooser }` で書くのは冗長。
 * `args: { player, n }` だけ渡された場合に、verb 既定の area を使って pick query を
 * 自動構築する。
 *
 * - target 既指定 (string / array / pick query object) → そのまま返す (既存挙動を破壊しない)
 * - target 未指定 + n: number → 既定の pick query を生成
 * - 上記以外 → undefined (atom-handler 側で awaiting-pick / no-op 判断)
 */
// PB/PA 短縮形の pick query 構築は buildShortFormPick (atom-pick-spec.ts) に集約。
// 短縮形成立判定 (n|max あり)。verb 毎の guard / byPlayer は各 case 側に残す (動作不変維持)。
export function hasNorMax(a: Record<string, unknown>): boolean {
  return typeof a.n === 'number' || typeof a.max === 'number';
}

/**
 * PA 短縮形 (uid-carrier) の awaiting-pick 共通処理 (refactor 2a, 2026-06-12)。
 * 旧来 11 case にコピペされていた「pick query 構築 → uid:'$pick' carrier 化 →
 * tryRePickFromAtom (side-channel set) → awaiting-pick log → return」を集約する。
 *
 * - gate 条件 (uid 不在 + verb 固有の前提 + hasNorMax) は **各 case 側に残す** (動作不変維持)
 * - chooser (= byPlayer = log player): 「誰が選ぶか」。2 規約が併存する:
 *     a) chooser = resolvePlayer(a.player) — `player`=操作者 規約 (sceneRemove/sceneToHand 等。
 *        BUG-131 調査で正と裁定)
 *     b) chooser = ctx.source.player (controller) — BUG-120 裁定 (charModify系/charSetCard/
 *        charGrant系/sceneToDeck)。`player` は対象側 (side 既定) を表す
 *   既存カードへの挙動影響を避けるため本 helper は規約を強制せず、呼出側が明示する。
 * - side: buildShortFormPick の sideDefault (a.side 指定があればそちらが優先される)
 */
export function paShortFormAwait(
  s: GameState,
  verb: AtomVerb,
  a: Record<string, unknown>,
  ctx: EffectCtx,
  chooser: Player,
  side: 'self' | 'opp' | 'either',
  area = 'scene',
): void {
  const paTarget = buildShortFormPick(area, a, chooser, side);
  const paArgs = { ...a, uid: '$pick', target: paTarget };
  tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, {
    byPlayer: chooser,
    source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
  });
  mutate.log.append(s, { ts: Date.now(), player: chooser, turn: s.turn.number, action: `effect:${verb}:awaiting-pick` });
}

