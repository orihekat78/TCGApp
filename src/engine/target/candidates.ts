// engine.target.candidates — enumerate target candidates per TargetingRef/TargetQuery
// spec: Phase 3 Group B Task 3.4
// rules: 15-abilities-effects.md §対象指定の解釈, 19-special-rules.md §複数名カード

import type {
  GameState,
  TargetingRef,
  TargetQuery,
  TargetFilter,
  Candidate,
  SceneCharacter,
  EffectCtx,
  CardDef,
} from '@/engine/types';
import { lookupCardDef, allCardNameComponentsForDef, cardNameComponents } from './card-def-registry.js';
import { defHasKeyword } from '@/engine/read/keyword.js';

// BUG-113: 数値フィルタの有効値に continuousModifier.apDelta/lpDelta (継続効果 dyn) を含める。
// read/char.ts → cond/eval.ts → candidates.ts の静的 import 循環を避けるため late-binding (register) で注入。
// read/char.ts が module load 時に registerContinuousDelta(continuousDelta) を呼ぶ。未登録なら 0 (旧挙動 = 無害)。
// 再帰遮断: matchOneFilter → continuousDelta → evalCond(継続条件) → sceneHas → candidates → matchOneFilter …
// の無限再帰を _inContinuousDelta フラグで防ぐ (再入時は 0 を返す = 旧挙動)。これが省略の本来の理由 (BUG-113 cycle 注記)。
type ContinuousDeltaFn = (s: GameState, uid: string, which: 'apDelta' | 'lpDelta' | 'lvlDelta') => number;
let continuousDeltaImpl: ContinuousDeltaFn | null = null;
let _inContinuousDelta = false;
export function registerContinuousDelta(fn: ContinuousDeltaFn): void {
  continuousDeltaImpl = fn;
}
// BUG-157 (2026-06-27): read.char.ap/lp/level も本 guarded wrapper 経由で continuousDelta を読むため export。
// read.char は従来 local continuousDelta を直呼びしていた (無 guard entry) → continuous apDelta(gated lpAtLeast)
// ⇄ lpDelta(gated apAtLeast) 等で無限相互再帰 (stack overflow)。本 wrapper 経由で matchOneFilter と同 posture
// (再入時 base 0 で depth-2 終端) に統一する。
export function continuousDeltaSafe(s: GameState, uid: string | undefined, which: 'apDelta' | 'lpDelta' | 'lvlDelta'): number {
  if (continuousDeltaImpl === null || _inContinuousDelta || uid === undefined) return 0;
  _inContinuousDelta = true;
  try {
    return continuousDeltaImpl(s, uid, which);
  } finally {
    _inContinuousDelta = false;
  }
}

// engine拡張 wave#2 cluster13 (2026-06-15): 他キャラへの AP/LP buff aura (continuousModifier.apDeltaAura/lpDeltaAura)。
// continuousDelta と同じ late-binding + 再帰 guard。auraDelta 本体は read/char.ts (board-scan) に実装し register する。
// matchOneFilter と read.char.ap/lp の両方が auraDeltaSafe 経由で合算する (filter-AP と combat-AP を一致させる = BUG-117 原則)。
// 未登録 / 既存カード (aura 未宣言) は 0 = no-op (smoke baseline 不変)。auraDelta 内の matchOneFilter 再入は
// _inAuraDelta で 0 化 (auraFilter の AP 判定が aura を二重計上しない)。_inContinuousDelta 中も 0 (BUG-113 cycle と同 posture)。
type AuraDeltaFn = (s: GameState, uid: string, which: 'apDeltaAura' | 'lpDeltaAura') => number;
let auraDeltaImpl: AuraDeltaFn | null = null;
let _inAuraDelta = false;
export function registerAuraDelta(fn: AuraDeltaFn): void {
  auraDeltaImpl = fn;
}
export function auraDeltaSafe(s: GameState, uid: string | undefined, which: 'apDeltaAura' | 'lpDeltaAura'): number {
  if (auraDeltaImpl === null || _inAuraDelta || _inContinuousDelta || uid === undefined) return 0;
  _inAuraDelta = true;
  try {
    return auraDeltaImpl(s, uid, which);
  } finally {
    _inAuraDelta = false;
  }
}

// engine additive wave-6 (2026-07-01, P37): 継続的 trait/name 付与 (continuousModifier.grantTraits/grantNames)。
// continuousDelta/auraDelta と同じ late-binding + 再帰 guard。effectiveGrant 本体は read/char.ts (自身の continuous
// ability walk) に実装し register する。matchOneFilter (trait/cardName/cardNameNot) + read.char.traits/names +
// cond/eval bond が本 safe wrapper 経由で **印字 ∪ granted** を評価する (BUG-117 原則: filter値==board値)。
// 付与は board char (uid 既知) のみ — c===null (hand/deck/remove/bound=cardId) は uid 無 → [] = 印字のまま
// (公式 Q&A「現場にいなければ有効でない」B07053/B08063)。再帰 guard: matchOneFilter → traitNameGrantSafe →
// grantWalk → evalCond(継続条件) → candidates → matchOneFilter … を _inTraitNameGrant で depth-2 終端
// (再入時 [] = 印字のみ。continuousDelta/auraDelta と同一機序)。未登録 / 既存カード (未宣言) は [] = no-op。
const NO_GRANT: string[] = [];
type TraitNameGrantFn = (s: GameState, uid: string, which: 'grantTraits' | 'grantNames') => string[];
let traitNameGrantImpl: TraitNameGrantFn | null = null;
let _inTraitNameGrant = false;
export function registerTraitNameGrant(fn: TraitNameGrantFn): void {
  traitNameGrantImpl = fn;
}
export function traitNameGrantSafe(s: GameState, uid: string | undefined, which: 'grantTraits' | 'grantNames'): string[] {
  if (traitNameGrantImpl === null || _inTraitNameGrant || uid === undefined) return NO_GRANT;
  _inTraitNameGrant = true;
  try {
    return traitNameGrantImpl(s, uid, which);
  } finally {
    _inTraitNameGrant = false;
  }
}

// 有効カード名 component 集合 = allCardNameComponentsForDef(印字) ∪ (granted 名を rules/19 分割展開したもの)。
// board char (c?.uid 既知) のみ granted を合流。c===null は印字のみ (deck/remove/bound=cardId)。
// export: cond/eval bond が matchOneFilter と同一の name 解決を使う (BUG-117 一貫性)。
export function effectiveNameComponents(state: GameState, d: CardDef | undefined, c: SceneCharacter | null): string[] {
  const base = d ? allCardNameComponentsForDef(d) : [];
  if (c?.uid === undefined) return base;
  const granted = traitNameGrantSafe(state, c.uid, 'grantNames');
  if (granted.length === 0) return base;
  const out = [...base];
  for (const gn of granted) {
    out.push(gn);
    for (const comp of cardNameComponents(gn)) out.push(comp);
  }
  return out;
}

type Side = 'self' | 'opp';

/**
 * Owner side resolution. EffectCtx has no explicit ownerPlayer — we use
 * ctx.source.player as the owner (the player whose card produced the effect).
 */
function ownerSide(ctx: EffectCtx): Side {
  return ctx.source.player;
}

function oppSide(p: Side): Side {
  return p === 'self' ? 'opp' : 'self';
}

function sidesForQuery(query: TargetQuery, ctx: EffectCtx): Side[] {
  const side = query.side;
  const owner = ownerSide(ctx);
  switch (side) {
    case 'self':
      return [owner];
    case 'opp':
      return [oppSide(owner)];
    case 'either':
    case undefined:
      // Default: either side (rules/15 — when only "キャラ" appears, both sides eligible)
      return ['self', 'opp'];
    case 'owner':
      return [owner];
    case 'opp-of-owner':
      return [oppSide(owner)];
  }
}

/**
 * Enumerate candidates for a TargetingRef.
 */
export function candidates(state: GameState, ref: TargetingRef, ctx: EffectCtx): Candidate[] {
  switch (ref.kind) {
    case 'self': {
      const uid = ctx.source.uid;
      if (!uid) return [];
      for (const p of ['self', 'opp'] as const) {
        const found = state.players[p].scene.find(c => c.uid === uid);
        if (found) return [{ kind: 'char', uid: found.uid, cardId: found.cardId, player: p }];
      }
      return [{
        kind: 'char',
        uid,
        cardId: ctx.source.cardId ?? '',
        player: ctx.source.player,
      }];
    }
    case 'pick':
    case 'all':
      return enumerateByQuery(state, ref.query, ctx);
    case 'fromBound': {
      const bound = ctx.bindings[ref.bindKey];
      return bound ?? [];
    }
  }
}

function enumerateByQuery(state: GameState, query: TargetQuery, ctx: EffectCtx): Candidate[] {
  const area = query.area ?? 'scene';
  const sides = sidesForQuery(query, ctx);
  const out: Candidate[] = [];

  // engine mega-wave W4 (2026-07-03, r83 G34): fromGroup — 母集合を ctx.bindings[fromGroup] の
  // uid 集合に限定 (「その中から1枚」B01012)。binding 不在/空 = 候補0 (fail-closed)。
  // 通常列挙を走らせた後の post-filter (filter/state/side 等の既存判定を全て共有)。
  const fromGroupUids: Set<string> | null = (() => {
    if (typeof query.fromGroup !== 'string') return null;
    const bound = ctx.bindings?.[query.fromGroup];
    if (!Array.isArray(bound) || bound.length === 0) return new Set<string>();
    return new Set(bound.map(b => (b as { uid?: string }).uid).filter((u): u is string => typeof u === 'string'));
  })();
  if (fromGroupUids !== null && fromGroupUids.size === 0) return out;

  for (const side of sides) {
    switch (area) {
      case 'scene': {
        for (const c of state.players[side].scene) {
          const cand: Candidate = { kind: 'char', uid: c.uid, cardId: c.cardId, player: side };
          if (matchesQueryForChar(state, c, cand, query, ctx)) out.push(cand);
        }
        break;
      }
      case 'partner-area': {
        const cand: Candidate = { kind: 'partner', player: side };
        if (matchesFiltersByCardId(state, state.players[side].partner.cardId, query, cand)) {
          out.push(cand);
        }
        // engine wave-12 (2026-07-02 G39): PA 一般カード枠 (partnerAreaCards) の列挙。
        // 「このカードをパートナーエリアに移す」で PA 常駐したカード (B07059 等) を
        // {kind:'card', area:'partner-area'} として filter 適用の上で候補化する。
        // 全出荷カードは本 field 未使用 (undefined) → 既存カードの候補集合は不変。
        // ※ partnerAreaMR (MR slot) の targetability は公式 Q&A 未解決 (BUG-154 #3) のため列挙しない。
        const paCards = state.players[side].partnerAreaCards;
        if (paCards) {
          for (let i = 0; i < paCards.length; i++) {
            const c: Candidate = { kind: 'card', cardId: paCards[i], area: 'partner-area', player: side, index: i };
            if (matchesFiltersByCardId(state, paCards[i], query, c)) {
              out.push(c);
            }
          }
        }
        break;
      }
      case 'hand': {
        const hand = state.players[side].hand;
        for (let i = 0; i < hand.length; i++) {
          const cardId = hand[i];
          const cand: Candidate = { kind: 'card', cardId, area: 'hand', player: side, index: i };
          if (matchesFiltersByCardId(state, cardId, query, cand)) out.push(cand);
        }
        break;
      }
      case 'deck': {
        const deck = state.players[side].deck;
        for (let i = 0; i < deck.length; i++) {
          const cardId = deck[i];
          const cand: Candidate = { kind: 'card', cardId, area: 'deck', player: side, index: i };
          if (matchesFiltersByCardId(state, cardId, query, cand)) out.push(cand);
        }
        break;
      }
      case 'remove': {
        const rem = state.players[side].remove;
        for (let i = 0; i < rem.length; i++) {
          const cardId = rem[i];
          const cand: Candidate = { kind: 'card', cardId, area: 'remove', player: side, index: i };
          if (matchesFiltersByCardId(state, cardId, query, cand)) out.push(cand);
        }
        break;
      }
      case 'evidence': {
        const ev = state.players[side].evidence;
        for (let i = 0; i < ev.length; i++) {
          // engine拡張 wave (2026-06-23): faceDown=true は裏向き(未公開)の証拠のみ候補化。
          // 「裏向きの証拠を選び、表向きにする」(evidenceFlip pick) で既に表向きの証拠を除外。
          if (query.faceDown === true && ev[i].faceUp) continue;
          // engine拡張 wave (2026-06-23): faceUp=true は表向き(公開済)の証拠のみ候補化 (faceDown の逆)。
          // 「表向きの証拠を選び、裏向きにする」(evidenceFlipDown pick) で既に裏向きの証拠を除外。
          if (query.faceUp === true && !ev[i].faceUp) continue;
          const cand: Candidate = { kind: 'evidence', player: side, index: i };
          if (matchesFiltersByCardId(state, ev[i].cardId, query, cand)) out.push(cand);
        }
        break;
      }
      case 'file': {
        const file = state.players[side].file;
        for (let i = 0; i < file.length; i++) {
          const cand: Candidate = { kind: 'file', player: side, index: i };
          out.push(cand);
        }
        break;
      }
      case 'case': {
        const caseCardId = state.players[side].case.cardId;
        const cand: Candidate = { kind: 'card', cardId: caseCardId, area: 'case', player: side };
        if (matchesFiltersByCardId(state, caseCardId, query, cand)) out.push(cand);
        break;
      }
    }
  }

  // W4 r83: fromGroup post-filter (uid を持つ candidate のみ通す = scene char 前提)
  if (fromGroupUids !== null) {
    return out.filter(cand => cand.kind === 'char' && typeof cand.uid === 'string' && fromGroupUids.has(cand.uid));
  }
  return out;
}

function matchesQueryForChar(
  state: GameState,
  c: SceneCharacter,
  cand: Candidate,
  query: TargetQuery,
  ctx: EffectCtx,
): boolean {
  // excludeSelf
  if (query.excludeSelf && cand.kind === 'char' && cand.uid === ctx.source.uid) return false;

  // engine additive wave-18 (2026-07-03): inContact — pick を現コンタクト参加者に限定 (B04075/PR029/B04092)。
  // 参加者 = ctx.contact.{byUid,targetUid,guardUid}。ctx.contact は resolve 時のみ populate (BUG-104) →
  // コンタクト外の誤用や non-char 候補は不一致 = drop (安全側)。excludeSelf と同じ ctx 依存 char 述語サイト。
  if (query.inContact) {
    if (cand.kind !== 'char') return false;
    const ct = ctx.contact;
    if (!ct) return false;
    const uids = [ct.byUid, ct.targetUid, ct.guardUid];
    if (!uids.includes(cand.uid)) return false;
  }

  // state filter
  if (query.state && query.state.length > 0) {
    if (!query.state.includes(c.state)) return false;
  }

  // named filter (true=only named, false=only non-named, undefined=no filter)
  if (query.named !== undefined) {
    if (query.named !== c.isNamed) return false;
  }

  return matchesFilters(state, c.cardId, c, cand, query);
}

function matchesFiltersByCardId(
  state: GameState,
  cardId: string,
  query: TargetQuery,
  cand: Candidate,
): boolean {
  return matchesFilters(state, cardId, null, cand, query);
}

function matchesFilters(
  state: GameState,
  cardId: string,
  c: SceneCharacter | null,
  cand: Candidate,
  query: TargetQuery,
): boolean {
  if (query.filter) {
    if (!matchOneFilter(state, cardId, query.filter, c, cand)) return false;
  }
  if (query.filterAny && query.filterAny.length > 0) {
    const anyOk = query.filterAny.some(f => matchOneFilter(state, cardId, f, c, cand));
    if (!anyOk) return false;
  }
  return true;
}

export function matchOneFilter(
  state: GameState,
  cardId: string,
  filter: TargetFilter,
  c: SceneCharacter | null,
  cand: Candidate,
): boolean {
  const d = lookupCardDef(cardId);

  if (filter.cardId !== undefined) {
    const ids = Array.isArray(filter.cardId) ? filter.cardId : [filter.cardId];
    if (!ids.includes(cardId)) return false;
  }

  // cardName (rules/19: split-name matching)
  // wave-6 (P37): board char は effectiveNameComponents = 印字 ∪ granted (grantNames、分割展開込)。
  if (filter.cardName !== undefined) {
    const wants = Array.isArray(filter.cardName) ? filter.cardName : [filter.cardName];
    const components = effectiveNameComponents(state, d, c);
    const ok = wants.some(w => components.includes(w));
    if (!ok) return false;
  }

  // cluster16: cardNameNot (「〚カード名[X]〛以外」) — positive cardName と対称。split-name (rules/19)
  // の component いずれかが nots に含まれたら除外。excludeSelf(uid) は同名2枚目を誤許容するため name 単位除外。
  // wave-6 (P37): granted 名 (「〚カード名[X]〛としても扱い」) も除外対象に含む (effectiveNameComponents)。
  if (filter.cardNameNot !== undefined) {
    const nots = Array.isArray(filter.cardNameNot) ? filter.cardNameNot : [filter.cardNameNot];
    const components = effectiveNameComponents(state, d, c);
    if (nots.some(w => components.includes(w))) return false;
  }

  // wave-6 (P37): board char は 印字 ∪ granted (grantTraits)。c===null は印字のみ (deck/remove)。
  if (filter.trait !== undefined) {
    const wants = Array.isArray(filter.trait) ? filter.trait : [filter.trait];
    const printed = d?.traits ?? [];
    const granted = c?.uid !== undefined ? traitNameGrantSafe(state, c.uid, 'grantTraits') : NO_GRANT;
    const traits = granted.length > 0 ? [...printed, ...granted] : printed;
    if (!wants.some(w => traits.includes(w))) return false;
  }

  if (filter.color !== undefined) {
    const wants = Array.isArray(filter.color) ? filter.color : [filter.color];
    const colors = d?.colors ?? [];
    if (!wants.some(w => colors.includes(w))) return false;
  }

  // engine additive (2026-06-27): colorNot (「【X】以外の色を持つ」) — 公式 B08079 裁定で some説。
  // X以外の色を1つでも持てば該当 (mono-X のみ除外、2色{X,Y} は Y を持つので該当)。等価: 全色が
  // notSet 内のとき除外。cardNameNot の any-match 除外とは非対称 — boundMatchesFilter / predicate と同式。
  if (filter.colorNot !== undefined) {
    const nots = Array.isArray(filter.colorNot) ? filter.colorNot : [filter.colorNot];
    const colors = d?.colors ?? [];
    if (!colors.some(c => !nots.includes(c))) return false;
  }

  if (filter.keyword !== undefined) {
    const wants = Array.isArray(filter.keyword) ? filter.keyword : [filter.keyword];
    // BUG-122: keyword は通常 keywords[] に入るが、アイコン能力 (カットイン / 変装 / ヒラメキ /
    // ミスリード) は keywords[] ではなく ability 構造で表現される。defHasKeyword が両表現を吸収する
    // (旧実装は keywords[] のみ → B05112「【カットイン】を持つキャラ」が候補0で機能しなかった)。
    if (!wants.some(w => defHasKeyword(d, w))) return false;
  }

  // BUG-118: カード種別 filter ('character' | 'event')。本関数 (target pick 候補列挙の正準経路) が
  // kind を未評価で drop しており、B04009「リムーブの【青】イベント」で kind:'event' が効かず
  // 青キャラも候補化していた。deckRevealUntil 側 (targetFilterToPredicate) は既に評価済 → 経路統一。
  if (filter.kind !== undefined && d?.kind !== filter.kind) return false;

  // Numeric filters — 効果解決時点の「有効値」で判定する (rules/15,19,22)。
  // base(override?printed) に turnEffects の ±修正 (apMod/lpMod の permanent/turn/contact) を合算。
  // 旧実装は override?printed のみで turn 修正を無視 → 疾風(AP-1000)等で debuff されたキャラが
  // 「APX以下」リムーブ圏内に入っても対象外になる / D11012「LP0の警察」が buff 済キャラを誤って含む
  // 不整合があった。read.char.ap/lp と同式 (継続効果 continuousDelta(dyn, D08005) を含む — BUG-113 修正、
  // late-binding + 再帰 guard で cycle/無限再帰を回避)。c===null (非現場 candidate) は uid 無 → continuousDelta 0。
  const base = d ?? null;
  const te = (c?.turnEffects ?? {}) as Record<string, unknown>;
  const num = (k: string): number => (typeof te[k] === 'number' ? (te[k] as number) : 0);
  const apContinuous = continuousDeltaSafe(state, c?.uid, 'apDelta');
  const lpContinuous = continuousDeltaSafe(state, c?.uid, 'lpDelta');
  // engine拡張 wave#2 cluster13 (2026-06-15): 他キャラ aura (apDeltaAura/lpDeltaAura) も合算 (第5合算サイト)。
  // read.char.ap/lp と同式を維持 — filter-AP と combat-AP を一致させる (BUG-117 原則)。既存カードは aura 不在 → 0。
  const apAura = auraDeltaSafe(state, c?.uid, 'apDeltaAura');
  const lpAura = auraDeltaSafe(state, c?.uid, 'lpDeltaAura');
  // engine拡張 wave#2 cluster3 (2026-06-13): *Mod_action を合算 (read.char と同式を維持 — 第4合算サイト。
  // 乖離すると BUG-117 型: filter 評価と表示/judge が食い違う)。pin: wave2-cluster3 test X12。
  const ap = (c?.apOverride ?? base?.ap ?? 0) + num('apMod_permanent') + num('apMod_turn') + num('apMod_contact') + num('apMod_action') + apContinuous + apAura;
  const lp = (c?.lpOverride ?? base?.lp ?? 0) + num('lpMod_permanent') + num('lpMod_turn') + num('lpMod_contact') + num('lpMod_action') + lpContinuous + lpAura;
  // engine-extension #2 (2026-06-05): charModifyLevel に伴い filter level も 3 scope 合算
  // (旧は base のみ → modifyLevel 不使用時 = base + 0 + 0 + 0 で互換)
  // engine additive wave (2026-06-24): continuous lvlDelta も合算 (read.char.level と同式 = BUG-117 原則)。既存カードは未宣言 → 0。
  const lvlContinuous = continuousDeltaSafe(state, c?.uid, 'lvlDelta');
  const level = (base?.level ?? 0) + num('lvlMod_permanent') + num('lvlMod_turn') + num('lvlMod_contact') + num('lvlMod_action') + lvlContinuous;

  if (filter.apMin !== undefined && ap < filter.apMin) return false;
  if (filter.apMax !== undefined && ap > filter.apMax) return false;
  if (filter.lpMin !== undefined && lp < filter.lpMin) return false;
  if (filter.lpMax !== undefined && lp > filter.lpMax) return false;
  if (filter.levelMin !== undefined && level < filter.levelMin) return false;
  if (filter.levelMax !== undefined && level > filter.levelMax) return false;

  if (filter.hasSetCards !== undefined) {
    const has = !!(c && c.setCards.length > 0);
    if (has !== filter.hasSetCards) return false;
  }

  // engine mega-wave W4 (2026-07-03, r82 同梱): 裏向きセット card 保持キャラ軸 (B08035 a2)。
  // hasSetCards と同 posture (c===null は保持なし扱い、boolean 両対応)。
  if (filter.hasFaceDownSetCards !== undefined) {
    const hasFd = !!(c && c.setCards.some(sc => !sc.faceUp));
    if (hasFd !== filter.hasFaceDownSetCards) return false;
  }

  // engine additive wave-7 (2026-07-02, P17): actedCharThisTurn — 「このターン中にアクション[キャラ]した」
  // board char のみ該当。記録は flow/action/state-machine.declare が target.kind==='char' 時に actor へ
  // setTurnEffect('actedCharThisTurn', true)、清掃は clearTurnEffects('turn')。hasSetCards と同じ boolean 軸
  // semantics (true/false 両対応): c===null (deck/remove/hand の印字 candidate) は現場に居らず「アクションした」
  // 概念が無いため acted=false 扱い → true 指定で除外・false 指定で一致。B08049 ジョディ【宣言】
  // 「このターン中にアクション[キャラ]していた〚特徴[FBI]〛のキャラ」。
  if (filter.actedCharThisTurn !== undefined) {
    const acted = c?.turnEffects['actedCharThisTurn'] === true;
    if (acted !== filter.actedCharThisTurn) return false;
  }

  if (filter.custom !== undefined) {
    if (!filter.custom(state, cand)) return false;
  }
  return true;
}

/**
 * Legal count range.
 */
export function legalCount(
  state: GameState,
  ref: TargetingRef,
  ctx: EffectCtx,
): { min: number; max: number } {
  switch (ref.kind) {
    case 'self':
      return { min: 1, max: 1 };
    case 'pick': {
      const cands = candidates(state, ref, ctx);
      // "N枚まで" allows 0 (rules/15). When candidates < ref.n.min the min collapses.
      const min = Math.min(ref.n.min, cands.length);
      const max = Math.min(ref.n.max, cands.length);
      return { min, max };
    }
    case 'all': {
      const cands = candidates(state, ref, ctx);
      return { min: cands.length, max: cands.length };
    }
    case 'fromBound': {
      const bound = ctx.bindings[ref.bindKey] ?? [];
      return { min: bound.length, max: bound.length };
    }
  }
}
