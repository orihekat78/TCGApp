// engine.cond.eval — Condition evaluator
// spec: Phase 3 Group B Task 3.6
// rules: 17-icons.md §条件アイコン, 13-keywords.md, 15-abilities-effects.md,
//        18-mr.md, 19-special-rules.md, 25-qa-effects-resolution.md
//
// Condition unmet → "ability/effect not held at all" (rules/17 Point).

import type { GameState, Condition, EffectCtx, Candidate, SceneCharacter } from '@/engine/types';
import { boundCandidate, candidates, effectiveLevelForCandidate, matchOneFilter, effectiveKeywordForCard, effectiveNameComponents, effectiveTraitNames, printedKeywordForCard, resolveBoundLevelFilter } from '@/engine/target/candidates.js';
import { resolve as resolveTarget } from '@/engine/target/resolve.js';
import { lookupCardDef, allCardNameComponentsForDef, cardNameComponents } from '@/engine/target/card-def-registry.js';
import { char as charRead } from '@/engine/read/char.js';
import { def as readDef } from '@/engine/read/def.js'; // mega-wave W6 step1: boundIsMr の MR 判定 (循環なし — read/def は types のみ import)
import { defHasNoOriginalAbilityExceptIcons } from '@/engine/read/keyword.js';
import { removeExcludedSourceCardId } from '@/engine/read/effect-source.js';

/** Type predicate: narrows a Candidate to the 'char' variant. */
function isCharCandidate(c: Candidate): c is { kind: 'char'; uid: string; cardId: string; player: 'self' | 'opp' } {
  return c.kind === 'char';
}

/**
 * engine E3 P11 (2026-07-02): 自プレイヤーの case card 継続能力 partnerColorsOverride を走査。
 * 成立中 (type==='continuous' + ability.condition honor) の override 色集合を返す。不在時 undefined
 * (呼び出し側で partner 印字色にフォールバック)。scene-cap.ts sceneCap と同流儀の case-def-continuous read。
 * module-local (read/ に切り出すと read→cond/eval 逆依存で循環) — 同 module の evalCond/lookupCardDef を直接利用。
 */
function partnerColorsOverride(state: GameState, owner: 'self' | 'opp'): string[] | undefined {
  const caseId = state.players[owner].case.cardId;
  if (!caseId) return undefined;
  const caseDef = lookupCardDef(caseId);
  if (!caseDef) return undefined;
  const caseCtx = { source: { player: owner, area: 'case', cardId: caseId }, bindings: {} } as unknown as EffectCtx;
  for (const ab of caseDef.abilities ?? []) {
    if (ab.type !== 'continuous') continue;
    const ov = ab.continuousModifier?.partnerColorsOverride;
    if (ov === undefined) continue;
    if (ab.condition && !evalCond(state, ab.condition, caseCtx)) continue;
    return ov;
  }
  return undefined;
}

function removeIdsForCondition(state: GameState, player: 'self' | 'opp', ctx: EffectCtx): string[] {
  const remove = state.players[player].remove;
  const sourceCardId = removeExcludedSourceCardId(ctx, player);
  if (sourceCardId === undefined) return remove;
  // Normal events/Hirameki are appended after the pre-existing remove pile in
  // the compatibility lifecycle.  lastIndexOf preserves older same-ID copies.
  const sourceIndex = remove.lastIndexOf(sourceCardId);
  return sourceIndex === -1 ? remove : remove.filter((_, index) => index !== sourceIndex);
}

/**
 * Evaluate a Condition to boolean using current state + ctx.
 */
export function evalCond(state: GameState, cond: Condition, ctx: EffectCtx): boolean {
  switch (cond.kind) {
    case 'true':
      return true;
    case 'false':
      return false;
    case 'not':
      return !evalCond(state, cond.c, ctx);
    case 'and':
      return cond.cs.every(c => evalCond(state, c, ctx));
    case 'or':
      return cond.cs.some(c => evalCond(state, c, ctx));
    case 'turn':
      return state.turn.player === resolvePlayer(cond.player, ctx);
    case 'sourceInScene':
      return typeof ctx.source.uid === 'string'
        && state.players[ctx.source.player].scene.some(c => c.uid === ctx.source.uid);
    case 'partnerColor': {
      const owner = ctx.source.player;
      const partner = state.players[owner].partner;
      const d = lookupCardDef(partner.cardId);
      const want = Array.isArray(cond.color) ? cond.color : [cond.color];
      // engine E3 P11 (2026-07-02): 自 case card の継続能力 partnerColorsOverride (PR067 探偵の目 全6色化) が
      // 成立中なら印字色の**代わりに**その色集合で評価する。scene-cap 同流儀 (type==='continuous' + ability.condition honor)。
      // inline (cond/eval 内) — 別 helper に切り出すと read→cond/eval 逆依存で循環するため。不在時は印字色 (baseline 不変)。
      const have = partnerColorsOverride(state, owner) ?? d?.colors ?? [];
      return want.some(c => have.includes(c));
    }
    case 'caseColor': {
      const owner = ctx.source.player;
      const caseInfo = state.players[owner].case;
      // CardDef is primary source of colors; caseInfo.colors is a runtime fallback
      // (used when CardDef is not yet registered, e.g. during tests or lazy loading).
      const d = lookupCardDef(caseInfo.cardId);
      const have = d?.colors ?? caseInfo.colors ?? [];
      const want = Array.isArray(cond.color) ? cond.color : [cond.color];
      if (cond.combine === 'and') {
        return want.every(c => have.includes(c));
      }
      return want.some(c => have.includes(c));
    }
    case 'caseColorNot': {
      // engine additive (2026-06-27 session62): 「事件が【X】以外の色を持つ場合」。
      // some説 (公式 B08079 ピンガ qa): 事件色のうち notSet に無い色が1つ以上で true。
      // 色解決は caseColor と同一 (CardDef primary / caseInfo.colors fallback)。
      // false ⟺ 全事件色が notSet ⊆ (事件色が空集合の場合も含む)。
      // ⚠ 素の not(caseColor X)=none説 とは 2色で非対称。「持たない」side は _shared caseMonoColor。
      const owner = ctx.source.player;
      const caseInfo = state.players[owner].case;
      const d = lookupCardDef(caseInfo.cardId);
      const have = d?.colors ?? caseInfo.colors ?? [];
      const notSet = Array.isArray(cond.color) ? cond.color : [cond.color];
      return have.some(c => !notSet.includes(c));
    }
    case 'caseTrait': {
      const owner = ctx.source.player;
      const caseInfo = state.players[owner].case;
      const d = lookupCardDef(caseInfo.cardId);
      // BUG-124: 事件カードの特徴は CardDef.caseTraits に格納される (caseTraits?: string[] —
      // 例 D08026=古城 は caseTraits:['古城'] / traits:[])。旧実装は d?.traits (キャラ特徴用) のみ
      // 参照しており、caseTraits だけに特徴を持つ事件 (古城) で【事件古城】が永久不発火だった
      // (field-drop, BUG-117/118/122/123 と同族)。caseTraits + traits の union で評価
      // (D11021=婚活パーティー は両方に持つため後方互換 / 古城系 gating を解禁)。
      const traits = [...(d?.caseTraits ?? []), ...(d?.traits ?? [])];
      return traits.includes(cond.trait);
    }
    case 'caseName': {
      const caseId = state.players[ctx.source.player].case.cardId;
      if (!caseId) return false;
      // Official 「カード名[工藤新一NYの事件]」 is one full name component.
      // Do not infer it from partial or separately listed name components.
      return lookupCardDef(caseId)?.names.includes(cond.name) ?? false;
    }
    case 'fileAtLeast': {
      const owner = ctx.source.player;
      // rules/17: アシスト中のパートナーも枚数に数える — file array already includes assisted-partner entries
      return state.players[owner].file.length >= cond.n;
    }
    case 'caseStatus': {
      const owner = ctx.source.player;
      return state.players[owner].case.status === cond.status;
    }
    case 'bond': {
      // rules/17: パートナーでは条件を満たさない — scene only
      // wave-6 (P37): effectiveNameComponents で granted 名 (「〚カード名[X]〛としても扱う」) も絆を満たす。
      //   matchOneFilter と同一の name 解決 (BUG-117 一貫性)。既存カード未宣言 → 印字のみ (回帰0)。
      const owner = ctx.source.player;
      const wants = Array.isArray(cond.cardName) ? cond.cardName : [cond.cardName];
      for (const c of state.players[owner].scene) {
        const d = lookupCardDef(c.cardId);
        if (!d) continue;
        const components = effectiveNameComponents(state, d, c);
        if (wants.some(w => components.includes(w))) return true;
      }
      return false;
    }
    case 'sceneHas': {
      const cands = candidates(state, { kind: 'all', query: cond.query }, ctx);
      const need = cond.nMin ?? 1;
      // 「それぞれカード名の異なる〚X〛のキャラがN枚以上」(B08067/PR236/PR242, rules/19): query.distinctNames=true
      //   のとき、一致候補を **カード名で dedupe** して計数する (同名2枚目は数えない)。判定は def.names[0]
      //   (印字カード名) — 現状この族 (長野県警) に分割名カード (rules/19 §「&」「『』」「()」) は無く、
      //   分割名の component 単位 distinct は out-of-scope (将来カードは per-card 再 certify で捕捉)。
      //   distinctNames は pick-resolve (target/resolve.ts) では既に honor 済だが sceneHas 計数では未評価
      //   だった (candidates 列挙は name dedupe しない)。既存カードで sceneHas+distinctNames を使うものは
      //   0 のため純 additive (smoke baseline 不変 = 回帰なし)。
      if (cond.query.distinctNames) {
        const names = new Set<string>();
        for (const c of cands) {
          if (c.kind !== 'char') continue;
          const def = lookupCardDef(c.cardId);
          if (def && def.names.length > 0) names.add(def.names[0]);
        }
        return names.size >= need;
      }
      return cands.length >= need;
    }
    case 'apAtLeast': {
      const resolved = resolveCharsForRef(state, cond.ref, ctx);
      return resolved.some(uid => charRead.ap(state, uid) >= cond.n);
    }
    case 'lpAtLeast': {
      const resolved = resolveCharsForRef(state, cond.ref, ctx);
      return resolved.some(uid => charRead.lp(state, uid) >= cond.n);
    }
    // engine additive wave (2026-06-29d): 現場キャラの LP 合計を min/max 比較 (B06003 a2)。
    // candidates() で query を列挙し char のみ charRead.lp で合算 (sceneHas と同じ列挙経路、
    // lpAtLeast と同じ charRead.lp = lpOverride/turnEffects/continuous 反映 + 負値も honor)。
    case 'sceneLpSum': {
      const cands = candidates(state, { kind: 'all', query: cond.query }, ctx);
      let sum = 0;
      for (const c of cands) if (isCharCandidate(c)) sum += charRead.lp(state, c.uid);
      if (cond.min !== undefined && sum < cond.min) return false;
      if (cond.max !== undefined && sum > cond.max) return false;
      return true;
    }
    case 'evidenceAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      return state.players[p].evidence.length >= cond.n;
    }
    // engine additive wave (2026-06-30): 証拠枚数の差で分岐 (B05103「相手の証拠が自分の証拠より N 以上
    // 多い場合」)。players[player].evidence − players[other].evidence >= n。state 直読みのみ (ctx 非依存)
    // なので queue 境界を跨いでも安全 (costRemovedMatches 系の risk 無)。
    case 'evidenceDiff': {
      const a = resolvePlayer(cond.player, ctx);
      const b = resolvePlayer(cond.other, ctx);
      return state.players[a].evidence.length - state.players[b].evidence.length >= cond.n;
    }
    // engine E3 P53 (2026-07-03): 証拠エリアの特徴計数 (B09107「証拠に〚特徴［犯人］〛が8枚以上」)。
    // removeTraitAtLeast と同型 (remove → evidence に読替)。trait 単一/配列 any-match、cardId→lookupCardDef.traits。
    case 'evidenceTraitAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      const wants = Array.isArray(cond.trait) ? cond.trait : [cond.trait];
      const count = state.players[p].evidence.filter(e => {
        const traits = effectiveTraitNames(state, e.cardId, null, { kind: 'evidence', player: p, index: 0 });
        return wants.some(w => traits.includes(w));
      }).length;
      return count >= cond.n;
    }
    // Task D E1 (2026-06-12): 手札枚数条件 (evidenceAtLeast と同流儀の state 直読み。
    // candidates() を経由しないため continuous 再帰 (BUG-113 系) に乗らない)
    // rules: 15-abilities-effects.md, 21-declared-ability-cost.md
    case 'handAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      return state.players[p].hand.length >= cond.n;
    }
    case 'handAtMost': {
      const p = resolvePlayer(cond.player, ctx);
      return state.players[p].hand.length <= cond.n;
    }
    case 'deckAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      return state.players[p].deck.length >= cond.n;
    }
    case 'handCountAtLeastOther': {
      const p = resolvePlayer(cond.player, ctx);
      const other = p === 'self' ? 'opp' : 'self';
      return state.players[p].hand.length >= state.players[other].hand.length;
    }
    // engine additive wave (2026-06-30): 自他現場キャラ枚数の比較 (B05081「自分の現場…が相手の現場…
    // より少ない場合」= cmp:'lt')。.scene.length = キャラ枚数 (oppSceneCount 同流儀)。state 直読みのみ。
    case 'sceneCountCompare': {
      const a = state.players[resolvePlayer(cond.player, ctx)].scene.length;
      const b = state.players[resolvePlayer(cond.other, ctx)].scene.length;
      switch (cond.cmp) {
        case 'lt': return a < b;
        case 'le': return a <= b;
        case 'gt': return a > b;
        case 'ge': return a >= b;
        case 'eq': return a === b;
      }
      return false; // unreachable (cmp は 5 リテラル union)
    }
    // S2 deck cluster (2026-07-10, B08057): bound 集合の要素数比較 (「合わせて3枚移した場合」)。
    // binding 不在/非配列 = 0 として比較。sceneCountCompare の cmp 流儀を bound.length に適用。
    case 'boundCountCompare': {
      const arr = ctx.bindings?.[cond.bindKey];
      const bc = Array.isArray(arr) ? arr.length : 0;
      switch (cond.cmp) {
        case 'lt': return bc < cond.n;
        case 'le': return bc <= cond.n;
        case 'gt': return bc > cond.n;
        case 'ge': return bc >= cond.n;
        case 'eq': return bc === cond.n;
      }
      return false; // unreachable
    }
    case 'fileTopType': {
      const owner = ctx.source.player;
      const file = state.players[owner].file;
      if (file.length === 0) return false;
      // "Top" = last pushed (per mutate.file.popTop semantics)
      return file[file.length - 1].type === cond.type;
    }
    // Task D E3 (2026-06-12): FILE 最上位の非 assisted-partner カードを TargetFilter で評価。
    // fileFlipTop が公開する札と同一参照 (B09021「1番上のカードがキャラの場合」)。
    // 空 / アシストパートナーのみ → false。
    case 'fileTopMatches': {
      const ftmSide = resolvePlayer(cond.side ?? 'self', ctx);
      const ftmFile = state.players[ftmSide].file;
      for (let i = ftmFile.length - 1; i >= 0; i--) {
        const fc = ftmFile[i]!;
        if (fc.type === 'assisted-partner') continue;
        if (!cond.filter) return true;
        const cand: Candidate = { kind: 'file', player: ftmSide, index: i };
        return matchOneFilter(state, fc.cardId, cond.filter, null, cand);
      }
      return false;
    }
    // Task D E3 (2026-06-12): トリガ payload.player の側一致 (file:pop 等キャラ uid を持たない hook 用)
    case 'triggerPlayerIs': {
      const tpl = ctx.triggerPayload as { player?: 'self' | 'opp' } | undefined;
      if (!tpl?.player) return false;
      const sameSide = tpl.player === ctx.source.player;
      return cond.side === 'self' ? sameSide : !sameSide;
    }
    case 'scratchTrace': {
      const p = resolvePlayer(cond.player, ctx);
      return state.scratchTrace[p] === cond.v;
    }
    case 'flag': {
      const p = resolvePlayer(cond.player, ctx);
      // turnState values may be Record<string, number> for declaredAbilityUseCount;
      // we expect boolean here so widen via unknown then compare.
      const v: unknown = state.turnState[p][cond.key];
      return v === cond.v;
    }
    case 'declaredUseUnder': {
      const used = charRead.declaredUseCount(state, cond.uid, cond.abilityId, {
        abilityOrigin: cond.abilityOrigin,
        abilityIndex: cond.abilityIndex,
      });
      return used < cond.max;
    }
    case 'sourceDeclaredUseCount': {
      const uid = ctx.source.uid;
      const abilityId = ctx.source.abilityId;
      if (typeof uid !== 'string' || typeof abilityId !== 'string') return false;
      const used = charRead.declaredUseCount(state, uid, abilityId, {
        abilityOrigin: ctx.source.abilityOrigin,
        abilityIndex: ctx.source.abilityIndex,
      });
      return cond.cmp === 'eq' ? used === cond.n : used >= cond.n;
    }
    case 'bound': {
      const bound = ctx.bindings[cond.key];
      if (cond.presence === 'matched') {
        return Array.isArray(bound) && bound.length > 0;
      }
      // 'exists' or undefined → present in bindings
      return bound !== undefined;
    }
    case 'removeColorAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      const wants = Array.isArray(cond.color) ? cond.color : [cond.color];
      const count = removeIdsForCondition(state, p, ctx).filter(id => {
        const d = lookupCardDef(id);
        // engine additive wave (2026-06-30): cardKind 指定時はカード種別で先に弾く (B08004「黒のキャラ」=
        // 黒イベントを数えない)。未指定は従来通り全種別 (回帰0)。
        if (cond.cardKind && d?.kind !== cond.cardKind) return false;
        const colors = d?.colors ?? [];
        return wants.some(w => colors.includes(w));
      }).length;
      return count >= cond.n;
    }
    case 'removeTraitAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      const wants = Array.isArray(cond.trait) ? cond.trait : [cond.trait];
      const count = removeIdsForCondition(state, p, ctx).filter(id => {
        const traits = effectiveTraitNames(state, id, null, { kind: 'card', cardId: id, area: 'remove', player: p });
        return wants.some(w => traits.includes(w));
      }).length;
      return count >= cond.n;
    }
    case 'removeNameAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      const wants = Array.isArray(cond.cardName) ? cond.cardName : [cond.cardName];
      const count = removeIdsForCondition(state, p, ctx).filter(id => {
        const d = lookupCardDef(id);
        if (!d) return false;
        const components = allCardNameComponentsForDef(d, 'remove');
        return wants.some(w => components.includes(w));
      }).length;
      return count >= cond.n;
    }
    case 'removeFilterAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      const count = removeIdsForCondition(state, p, ctx).filter((id) => {
        const cand: Candidate = { kind: 'card', cardId: id, area: 'remove', player: p };
        return cond.filters.some((filter) => matchOneFilter(state, id, filter, null, cand));
      }).length;
      return count >= cond.n;
    }
    // engine additive: removeCountAtLeast — リムーブエリアの総枚数 (filter 無し) が n 以上か (B03104)。
    // removeColor/Trait/NameAtLeast の unfiltered 版。使用中イベント自身は未だ remove に無いため
    // 数えない (B03104 qAndA と整合 — 効果解決時点で remove に置かれていない)。
    case 'removeCountAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      return removeIdsForCondition(state, p, ctx).length >= cond.n;
    }
    // engine additive wave (2026-06-29d): 直前に支払ったコストで除去されたカードの素性で分岐 (B03003/B04077/B06078)。
    // removeDeckTop コストが ctx.costPaid['removeDeckTop'].ids へ除去 cardId を記録 (cost/pay.ts)。除去済カードは
    // 盤面不在ゆえ matchOneFilter(c=null = CardDef 印字値、boundMatchesFilter/enterSource と同流儀) で判定。
    // n=必要一致数 (既定1)。ids 不在 (cost 未払い/別 cost のみ) → 0 一致 → false。
    case 'costRemovedMatches': {
      // key (attribution mini-wave 2026-07-10): 読む costPaid record を選択。既定 'removeDeckTop' =
      // 後方互換 (既存 consumer B03003/B04077/B06078 は key 無指定)。書込み側 = cost/pay.ts 各 case。
      const rec = ctx.costPaid?.[cond.key ?? 'removeDeckTop'] as { ids?: string[] } | undefined;
      const ids = rec?.ids ?? [];
      if (ids.length === 0) return false;
      const need = cond.n ?? 1;
      const player = ctx.source.player ?? 'self';
      let cnt = 0;
      for (const id of ids) {
        const cand: Candidate = { kind: 'card', cardId: id, area: 'remove', player };
        if (matchOneFilter(state, id, cond.filter, null, cand)) cnt++;
      }
      return cnt >= need;
    }
    // costRevealedMatches (attribution mini-wave 2026-07-10, B09005): revealFromHand コストで公開した
    // カードの素性で分岐。costRemovedMatches と同型 (ctx.costPaid['revealFromHand'].ids を
    // matchOneFilter(c=null=印字値) で判定)。公開カードは手札に残る (rules/21、pay は no-op reveal)
    // ため area は hand だが、判定は印字値のみで area 非依存。
    case 'costRevealedMatches': {
      const rec = ctx.costPaid?.['revealFromHand'] as { ids?: string[] } | undefined;
      const ids = rec?.ids ?? [];
      if (ids.length === 0) return false;
      const need = cond.n ?? 1;
      const player = ctx.source.player ?? 'self';
      let cnt = 0;
      for (const id of ids) {
        const cand: Candidate = { kind: 'card', cardId: id, area: 'hand', player };
        if (matchOneFilter(state, id, cond.filter, null, cand)) cnt++;
      }
      return cnt >= need;
    }
    // engine additive (2026-06-29, B09089): このターン中の登場枚数 (enterCountThisTurn) が n 以下か。
    // 「登場していない場合」= n:0。removeCountAtLeast/handAtMost と同型の player-resolved 数値直読
    // (candidates()/continuous 再帰なし → BUG-113 safe)。未初期化は 0 扱い (scene.ts:111 と同流儀)。
    // ⚠ latent (現状 unhit): STABLE cond ゆえ resolveEffectPicks が pre-walk eval する。同一 sequence 内で
    //   sceneEnter の **後** に pick 含む conditional{if:enterCountAtMost} を置くと pre-walk が enter 前 count
    //   で eager-surface し over-fire しうる (BUG-161 同型)。B09089 は [sceneRemove, conditional] で remove は
    //   enter を起こさないため pre-walk/runtime 同値 = 安全。将来カードは enter→gate 順を避けること。
    case 'enterCountAtMost': {
      const p = resolvePlayer(cond.player, ctx);
      return (state.turnState[p].enterCountThisTurn ?? 0) <= cond.n;
    }
    case 'stackedCountAtLeast': {
      const uids = resolveCharsForRef(state, cond.ref, ctx);
      return uids.some(uid => charRead.stackedCount(state, uid) >= cond.n);
    }
    case 'hostSetCardCountAtLeast': {
      const uid = ctx.source.uid;
      if (typeof uid !== 'string') return false;
      const host = state.players[ctx.source.player].scene.find(char => char.uid === uid);
      if (!host) return false;
      const count = host.setCards.filter(entry => entry.faceUp === true
        && matchOneFilter(state, entry.cardId, cond.filter, null, null)).length;
      return count >= cond.n;
    }
    case 'sceneFaceDownSetCardCountAtLeast': {
      const player = resolvePlayer(cond.player, ctx);
      const count = state.players[player].scene.reduce(
        (total, char) => total + char.setCards.filter(entry => entry.faceUp !== true).length,
        0,
      );
      return count >= cond.n;
    }
    case 'sameNameCountAtLeast': {
      const uid = ctx.source.uid;
      if (typeof uid !== 'string') return false;
      const names = charRead.names(state, uid);
      if (names.length === 0) return false;
      const wanted = new Set(names.flatMap(cardNameComponents));
      const count = state.players[ctx.source.player].scene.filter(char =>
        effectiveNameComponents(state, lookupCardDef(char.cardId), char).some(name => wanted.has(name)),
      ).length;
      return count >= cond.n;
    }
    // BUG-145 (self-state micro-cluster, 2026-06-15): ref が指すキャラの状態判定。
    // 「このキャラをスリープさせ(…)てもよい」を already-sleep で gate する用途
    // (PR138/PR144/B04049 等を conditional{if:not{charStateIs $self sleep}} でラップ)。
    // resolveCharsForRef は scene の char uid のみ返す (空なら .some=false)。
    case 'charStateIs': {
      const uids = resolveCharsForRef(state, cond.ref, ctx);
      return uids.some(uid => charRead.state(state, uid) === cond.state);
    }
    case 'charMatches': {
      const uids = resolveCharsForRef(state, cond.ref, ctx);
      for (const uid of uids) {
        for (const player of ['self', 'opp'] as const) {
          const ch = state.players[player].scene.find(c => c.uid === uid);
          if (!ch) continue;
          const cand: Candidate = { kind: 'char', uid: ch.uid, cardId: ch.cardId, player };
          if (matchOneFilter(state, ch.cardId, cond.filter, ch, cand)) return true;
        }
      }
      return false;
    }
    case 'contactOpponentApHigher': {
      // D11007 a3: contact:start payload から自分と相手の participant uid を取得。
      // 通常アクションの攻撃側だけでなく、効果で自分ターン中に発生した contact の
      // bUid 側でも「このキャラより AP の高いキャラ」を同じ相対契約で評価する。
      // BUG-098: 旧実装は自分の関与を確認せず、任意のコンタクト (defender>attacker) で過剰発火していた。
      const payload = ctx.triggerPayload as { aUid?: string; bUid?: string } | undefined;
      if (!payload?.aUid || !payload?.bUid) return false;
      const selfUid = ctx.source.uid;
      const otherUid = payload.aUid === selfUid
        ? payload.bUid
        : payload.bUid === selfUid
          ? payload.aUid
          : undefined;
      if (!selfUid || !otherUid) return false;
      return charRead.ap(state, otherUid) > charRead.ap(state, selfUid);
    }
    case 'guardedBySelf': {
      // B09014 a1: action:guarded payload.guardUid が自分 (ctx.source.uid) と一致するとき true
      // (「このキャラがガードしたとき」= 自分のガードのみ発火、rules/07)
      const guardUid = (ctx.triggerPayload as { guardUid?: string } | undefined)?.guardUid;
      return guardUid === ctx.source.uid;
    }
    case 'contactCharMatches': {
      // engine defer-unlock mini-wave (2026-07-09): コンタクト参加キャラの TargetFilter 評価
      // (B02006/B02080/PR278/D11013)。ctx.contact (cutin effect 実行時、entryToCtx が bindings.contact
      // から復元 = p-相対: byUid=自コンタクトキャラ / targetUid=相手コンタクトキャラ、buildContactBindings)
      // 優先。無ければ ctx.bindings.contact[0] を直接読む — triggered の matcherCondition 経路 (queue 時
      // gate、ctxMc は contact field を持たず gateBindings のみ)。B02080 の【ターン1】limit は queue 時
      // 無条件加算 (rules/24) のため、effect 側 conditional では非該当コンタクトで焼失する — 本 cond を
      // trigger.matcherCondition に置くことで「発動しない=未消費」を守る。
      // B02006 公式QA:「コンタクト中の**自分の**キャラがレベル5以下の特徴[少年探偵団]の場合に AP+3000」
      // = who:'byUid' (相対=自コンタクトキャラ)。filter は board char (uid 既知) で評価
      // (triggerCharMatches と同式: 実効 trait/level = matchOneFilter c!=null 経路)。fail-closed。
      const ccInfo = ctx.contact
        ?? ((ctx.bindings as Record<string, unknown[]> | undefined)?.['contact']?.[0] as
          { byUid?: string; targetUid?: string } | undefined);
      if (!ccInfo) return false;
      const ccUid = ccInfo[cond.who];
      if (typeof ccUid !== 'string' || ccUid.length === 0) return false;
      if (cond.requireSource && ccUid !== ctx.source.uid) return false;
      // scene のみ探索 — パートナーがコンタクト参加者の場合は false (fail-closed)。$contact.byUid の
      // charModifyAP も scene-only のため観測可能な不整合はない (system-wide の既存制約、review nit 記録)。
      for (const ccSide of ['self', 'opp'] as const) {
        const ch = state.players[ccSide].scene.find(c => c.uid === ccUid);
        if (ch) {
          const cand: Candidate = { kind: 'char', uid: ch.uid, cardId: ch.cardId, player: ccSide };
          return matchOneFilter(state, ch.cardId, cond.filter, ch, cand);
        }
      }
      return false;
    }
    case 'enterOrderEquals': {
      // D11014 a1 / D11003 / D11009 driver: enter hook payload.enterOrderThisTurn が n と一致するか
      // rules/17 §【疾風 N】: 「自分の現場にこのターン N番目に登場したとき」
      // (累積 enterOrder ではなく、ターン境界でリセットされる counter を参照)
      const payload = ctx.triggerPayload as { enterOrderThisTurn?: number } | undefined;
      return payload?.enterOrderThisTurn === cond.n;
    }
    case 'boundAnyMatchesFilter': {
      // engine additive wave-5 (2026-07-01, G17): bound 集合の **いずれか** が filter に一致するか。
      // boundMatchesFilter (bound[0] のみ) の N>1 版。各要素を matchOneFilter(c=null=CardDef 印字値、
      // remove-area cand は removeColorAtLeast L291 と同流儀) に委譲。空/未設定 binding は false。
      const boundSet = ctx.bindings?.[cond.bindKey];
      if (!Array.isArray(boundSet) || boundSet.length === 0) return false;
      for (const b of boundSet) {
        const { cardId: bId, player: boundPlayer } = b as { cardId?: string; player?: 'self' | 'opp' };
        if (typeof bId !== 'string') continue;
        const cand: Candidate = { kind: 'card', cardId: bId, area: 'remove', player: boundPlayer ?? ctx.source.player };
        if (matchOneFilter(state, bId, cond.filter, null, cand)) return true;
      }
      return false;
    }
    case 'boundMatchCountAtLeast': {
      const boundSet = ctx.bindings?.[cond.bindKey];
      if (!Array.isArray(boundSet)) return false;
      const declared = cond.traitBind === undefined ? undefined : ctx.bindings?.[cond.traitBind]?.[0] as { trait?: unknown } | undefined;
      const filter = typeof declared?.trait === 'string' ? { ...cond.filter, trait: declared.trait } : cond.filter;
      if (cond.traitBind !== undefined && typeof declared?.trait !== 'string') return false;
      let count = 0;
      for (const b of boundSet) {
        const { cardId, player: boundPlayer } = b as { cardId?: string; player?: 'self' | 'opp' };
        if (typeof cardId !== 'string') continue;
        const cand: Candidate = { kind: 'card', cardId, area: 'remove', player: boundPlayer ?? ctx.source.player };
        if (matchOneFilter(state, cardId, filter, null, cand)) count++;
      }
      return count >= cond.n;
    }
    case 'boundDistinctColorCount': {
      // engine additive wave-10 (2026-07-02, G17 残): bound 集合内に「filter 一致 かつ 相互に同じ色を
      // 持たない」カードが n 枚以上存在するか。B07002 a1「この効果によってそれぞれ色の異なる
      // （同じ色を持たない）〚特徴［探偵］〛のキャラを2枚リムーブした場合」。
      // - filter 判定は boundAnyMatchesFilter と同流儀 (matchOneFilter c=null = CardDef 印字値)。
      // - 「同じ色を持たない」= 色集合の pairwise 交差が空 (公式括弧書き、2色カードは rules/20 の
      //   「どちらの色としても扱う」ゆえ 1色でも共有すれば不成立)。
      // - subset 探索は DFS 全列挙 (bound は discard n:2 等の小集合、色6種ゆえ交差判定も定数)。
      //   「N枚リムーブした場合」の一般読み = 除去集合中に条件を満たす N 枚が存在 (removeTraitAtLeast 系と同型)。
      const bdcSet = ctx.bindings?.[cond.bindKey];
      if (!Array.isArray(bdcSet) || bdcSet.length === 0) return false;
      const bdcColorSets: string[][] = [];
      for (const b of bdcSet) {
        const { cardId: bId, player: boundPlayer } = b as { cardId?: string; player?: 'self' | 'opp' };
        if (typeof bId !== 'string') continue;
        const cand: Candidate = { kind: 'card', cardId: bId, area: 'remove', player: boundPlayer ?? ctx.source.player };
        if (cond.filter && !matchOneFilter(state, bId, cond.filter, null, cand)) continue;
        bdcColorSets.push(lookupCardDef(bId)?.colors ?? []);
      }
      if (bdcColorSets.length < cond.n) return false;
      const bdcDisjoint = (a: string[], b: string[]): boolean => !a.some((c) => b.includes(c));
      const bdcDfs = (start: number, chosen: string[][]): boolean => {
        if (chosen.length >= cond.n) return true;
        for (let i = start; i < bdcColorSets.length; i++) {
          if (chosen.every((cs) => bdcDisjoint(cs, bdcColorSets[i]!)) && bdcDfs(i + 1, [...chosen, bdcColorSets[i]!])) return true;
        }
        return false;
      };
      return bdcDfs(0, []);
    }
    case 'boundNameMatchesDeclared': {
      // engine mega-wave W6 step1 (2026-07-04, row 53): bound 集合のいずれかのカード名が
      // ctx.declaredNames[declareKey] (declareName verb の宣言名) と一致するか (「この効果によって
      // 指定したカード名のカードがリムーブされた場合」B09108/B09003)。分割名 (rules/19) は
      // allCardNameComponentsForDef で component any-match。bindings snapshot 参照 = 盤面再照会しない
      // (costRemovedMatches と同 posture — リフレッシュで remove から消えても判定不変)。
      // 宣言名 空/未設定・binding 空/不在 → false (「してもよい」skip 経路 defensive)。
      const declared = ctx.declaredNames?.[cond.declareKey];
      if (typeof declared !== 'string' || declared === '') return false;
      const bnSet = ctx.bindings?.[cond.bindKey];
      if (!Array.isArray(bnSet) || bnSet.length === 0) return false;
      for (const b of bnSet) {
        const bId = (b as { cardId?: string }).cardId;
        if (typeof bId !== 'string') continue;
        const d = lookupCardDef(bId);
        const area = (b as { area?: unknown }).area;
        if (d && allCardNameComponentsForDef(d, typeof area === 'string' ? area : undefined).includes(declared)) return true;
      }
      return false;
    }
    case 'boundIsMr': {
      // engine mega-wave W6 step1 (2026-07-04, row 999 item1): bound[0] が MR カードか
      // (「相手の現場にいるMRのキャラを選んだ場合」B06085)。read/def.isMR (rarity 前方一致 +
      // CardDef.isMR 明示 flag、mutate/scene.ts MR①② と同一判定) へ委譲。空/不在 → false。
      const bound = ctx.bindings?.[cond.bindKey];
      if (!Array.isArray(bound) || bound.length === 0) return false;
      const cardId = (bound[0] as { cardId?: string }).cardId;
      return typeof cardId === 'string' && readDef.isMR(cardId);
    }
    case 'leaveCauseIn': {
      // mega-wave W6 step10 (2026-07-04, row9): leave:intercept 帰属 gate
      // (「相手の能力や効果、コンタクトによって」= causes:['contact-ap','effect'])。
      // triggerPayload は consult-leave-intercept.ts が組み立てる { uid, cause, byUid, ownerPlayer }。
      const lcPayload = ctx.triggerPayload as { cause?: string } | undefined;
      return typeof lcPayload?.cause === 'string' && cond.causes.includes(lcPayload.cause);
    }
    case 'leaveOwnerIs': {
      // mega-wave W6 step10 (row9): 離場キャラ owner が ability owner 視点で self/opp
      // (「自分の現場にいる〜キャラ1枚が〜離れるとき」B01092)。
      const loPayload = ctx.triggerPayload as { ownerPlayer?: 'self' | 'opp' } | undefined;
      if (!loPayload?.ownerPlayer) return false;
      const loSame = loPayload.ownerPlayer === ctx.source.player;
      return cond.player === 'self' ? loSame : !loSame;
    }
    case 'boundCharStateIs': {
      const bound = ctx.bindings?.[cond.bindKey];
      if (!Array.isArray(bound) || bound.length === 0) return false;
      const candidate = boundCandidate(state, bound[0], ctx.source.player);
      if (candidate?.kind === 'char') {
        const live = state.players[candidate.player].scene.find(char => char.uid === candidate.uid);
        return live?.state === cond.state;
      }
      // Removal bindings retain their original state after the character is
      // gone; preserve that snapshot-only use for B09024.
      return (bound[0] as { snapState?: unknown }).snapState === cond.state;
    }
    case 'boundMatchesFilter': {
      // D11014 a2 driver: ctx.bindings[bindKey][0] の cardId を TargetFilter で評価
      // (「〚カード名[X]〛を登場させた場合」を declarative 化)
      const bound = ctx.bindings?.[cond.bindKey];
      if (!Array.isArray(bound) || bound.length === 0) return false;
      const candidate = boundCandidate(state, bound[0], ctx.source.player);
      if (!candidate) return false;
      const cardId = (bound[0] as { cardId?: string }).cardId;
      if (typeof cardId !== 'string') return false;
      const boundPlayer = (bound[0] as { player?: 'self' | 'opp' }).player ?? ctx.source.player;
      const d = lookupCardDef(cardId);
      // A nested dynamic threshold must retain live provenance (scene uid or
      // post-move hand occurrence). CardId-only snapshots remain static and
      // therefore cannot manufacture an effective level here.
      const thresholdKeys = [cond.filter.levelMaxBound?.bindKey, cond.filter.levelMinBound?.bindKey].filter((key): key is string => typeof key === 'string');
      if (thresholdKeys.some((key) => {
        const entry = ctx.bindings?.[key]?.[0] as { uid?: unknown; area?: unknown } | undefined;
        return typeof entry?.uid !== 'string' && entry?.area !== 'hand';
      })) return false;
      const f = resolveBoundLevelFilter(state, cond.filter, ctx);
      if (!f) return false;
      // CardDef-driven filter のみサポート (SceneCharacter state 系は対象外)
      if (f.cardId !== undefined) {
        const ids = Array.isArray(f.cardId) ? f.cardId : [f.cardId];
        if (!ids.includes(cardId)) return false;
      }
      if (f.cardName !== undefined) {
        const wants = Array.isArray(f.cardName) ? f.cardName : [f.cardName];
        const area = (bound[0] as { area?: unknown }).area;
        const components = d ? allCardNameComponentsForDef(d, typeof area === 'string' ? area : undefined) : [];
        if (!wants.some(w => components.includes(w))) return false;
      }
      // cluster16: cardNameNot (「〚カード名[X]〛以外」) — matchOneFilter / targetFilterToPredicate と同式。
      // 第4の filter-eval サイト (本関数は matchOneFilter 非委譲の inline 評価)。3経路 sync 必須 (cluster2 教訓)。
      if (f.cardNameNot !== undefined) {
        const nots = Array.isArray(f.cardNameNot) ? f.cardNameNot : [f.cardNameNot];
        const area = (bound[0] as { area?: unknown }).area;
        const components = d ? allCardNameComponentsForDef(d, typeof area === 'string' ? area : undefined) : [];
        if (nots.some(w => components.includes(w))) return false;
      }
      if (f.trait !== undefined) {
        const wants = Array.isArray(f.trait) ? f.trait : [f.trait];
        const traits = effectiveTraitNames(state, cardId, null, { kind: 'card', cardId, area: 'bound', player: ctx.source.player });
        if (!wants.some(w => traits.includes(w))) return false;
      }
      if (f.traitAll !== undefined) {
        const wants = Array.isArray(f.traitAll) ? f.traitAll : [f.traitAll];
        if (wants.length === 0) return false;
        const traits = effectiveTraitNames(state, cardId, null, { kind: 'card', cardId, area: 'bound', player: boundPlayer });
        if (!wants.every(w => traits.includes(w))) return false;
      }
      if (f.color !== undefined) {
        const wants = Array.isArray(f.color) ? f.color : [f.color];
        const colors = d?.colors ?? [];
        if (!wants.some(w => colors.includes(w))) return false;
      }
      // engine additive (2026-06-27): colorNot (「【X】以外の色を持つ」) — matchOneFilter /
      // targetFilterToPredicate と同式 (3経路 sync)。some説 (公式 B08079): 全色が notSet 内のとき除外。
      if (f.colorNot !== undefined) {
        const nots = Array.isArray(f.colorNot) ? f.colorNot : [f.colorNot];
        const colors = d?.colors ?? [];
        if (!colors.some(c => !nots.includes(c))) return false;
      }
      // CT-P10 B10074/B10102: this is printed-card metadata, independent of
      // original text suppression and externally granted abilities.
      if (f.hasOriginalAbility !== undefined) {
        if (!d || (d.abilities.length > 0) !== f.hasOriginalAbility) return false;
      }
      if (f.hasNoOriginalAbilityExceptIcons !== undefined) {
        if (!defHasNoOriginalAbilityExceptIcons(d, f.hasNoOriginalAbilityExceptIcons)) return false;
      }
      if (f.levelInBound !== undefined || f.levelMaxBound !== undefined || f.levelMinBound !== undefined || f.apMaxSource !== undefined) return false;
      const needsLevel = f.levelMin !== undefined || f.levelMax !== undefined || f.levelIn !== undefined;
      if (needsLevel) {
        const level = effectiveLevelForCandidate(state, candidate);
        if (level === undefined) return false;
        if (f.levelMin !== undefined && level < f.levelMin) return false;
        if (f.levelMax !== undefined && level > f.levelMax) return false;
        if (f.levelIn !== undefined && !f.levelIn.includes(level)) return false;
      }
      // wave#2 cluster2 (2026-06-12): keyword/kind/ap/lp が silent drop されていた (BUG-117/118 同型、
      // targetFilterToPredicate と並ぶ第3の drop サイト)。keyword は defHasKeyword (単一真実源)、
      // 数値は printed 値判定 (bound カードは scene candidate を持たない — targetFilterToPredicate と同式)。
      if (f.keyword !== undefined) {
        const wants = Array.isArray(f.keyword) ? f.keyword : [f.keyword];
        if (!wants.some(w => effectiveKeywordForCard(
          state,
          `bound:${boundPlayer}:${cardId}`,
          w,
          { cardId, player: boundPlayer, area: 'bound' },
        ))) return false;
      }
      if (f.keywordNot !== undefined) {
        const nots = Array.isArray(f.keywordNot) ? f.keywordNot : [f.keywordNot];
        if (nots.some(w => effectiveKeywordForCard(
          state,
          `bound:${boundPlayer}:${cardId}`,
          w,
          { cardId, player: boundPlayer, area: 'bound' },
        ))) return false;
      }
      if (f.keywordFromPrintOrConditionIcon !== undefined) {
        const wants = Array.isArray(f.keywordFromPrintOrConditionIcon) ? f.keywordFromPrintOrConditionIcon : [f.keywordFromPrintOrConditionIcon];
        if (!wants.some(w => printedKeywordForCard(
          state,
          `bound:${boundPlayer}:${cardId}`,
          w,
          { cardId, player: boundPlayer, area: 'bound' },
        ))) return false;
      }
      if (f.kind !== undefined && d?.kind !== f.kind) return false;
      const bmfAp = d?.ap ?? 0;
      if (f.apMin !== undefined && bmfAp < f.apMin) return false;
      if (f.apMax !== undefined && bmfAp > f.apMax) return false;
      const bmfLp = d?.lp ?? 0;
      if (f.lpMin !== undefined && bmfLp < f.lpMin) return false;
      if (f.lpMax !== undefined && bmfLp > f.lpMax) return false;
      return true;
    }
    case 'triggerCharMatches': {
      // 2026-06-06 タスクC: トリガ payload のキャラ (reasoning:end の推理キャラ等) を side+filter で評価。
      // Task D E4 (2026-06-12): payloadKey — uid を payload[payloadKey] から取る (例: action:guarded の
      // 'guardUid'、B09041)。payload に player が無い場合は scene 走査で side を導出する。
      const pl = ctx.triggerPayload as Record<string, unknown> | undefined;
      const tcmUid = (cond.payloadKey ? pl?.[cond.payloadKey] : pl?.['uid']) as string | undefined;
      if (!pl || typeof tcmUid !== 'string') return false;
      let tcmPlayer: 'self' | 'opp' | undefined;
      if (cond.payloadKey) {
        // payloadKey 指定時 payload.player は別キャラ (byUid 側) の可能性があるため走査で導出
        tcmPlayer = state.players.self.scene.some(c => c.uid === tcmUid) ? 'self'
          : state.players.opp.scene.some(c => c.uid === tcmUid) ? 'opp'
          : undefined;
      } else {
        // 従来経路: payload.player 必須 (挙動不変)
        tcmPlayer = pl['player'] as 'self' | 'opp' | undefined;
      }
      if (!tcmPlayer) return false;
      // Task D E2 (2026-06-12): excludeSource — 「このキャラ以外の〚X〛が登場したとき」(B09002 a1)。
      // rules/19 分割名で自カードが filter に自己一致するのを除外する。
      if (cond.excludeSource && tcmUid === ctx.source.uid) return false;
      // WB2 (2026-07-11, B01070): requireSource — 「このキャラを指定してアクションしたとき」(payloadKey:'targetUid')。
      // action:declare payload.targetUid が source 自身 uid でなければ不一致 (excludeSource の逆方向)。
      if (cond.requireSource && tcmUid !== ctx.source.uid) return false;
      // side:'self' = トリガキャラが card 所有者と同じ側 (ctx.source.player)
      const sameSide = tcmPlayer === ctx.source.player;
      if (cond.side === 'self' && !sameSide) return false;
      if (cond.side === 'opp' && sameSide) return false;
      if (cond.filter) {
        const ch = state.players[tcmPlayer].scene.find(c => c.uid === tcmUid);
        if (!ch) return false;
        const cand: Candidate = { kind: 'char', uid: ch.uid, cardId: ch.cardId, player: tcmPlayer };
        if (!matchOneFilter(state, ch.cardId, cond.filter, ch, cand)) return false;
      }
      return true;
    }
    // engine additive (2026-06-29): setcard:enter payload の set card を filter 評価 (B06046)。
    // 「このキャラに〚特徴[YAIBA]〛のカードがセットされたとき」。matcherCondition として host-self gate と and。
    // 裏向きセット (faceUp!==true) は情報を持たない (rules/16) → 必ず false。set card は scene char では
    // ないため matchOneFilter の char 引数は null (CardDef 印字属性のみ、triggerCharMatches L171 と同式)。
    case 'setCardMatches': {
      const pl = ctx.triggerPayload as { setCardId?: string; faceUp?: boolean } | undefined;
      if (!pl || typeof pl.setCardId !== 'string' || pl.faceUp !== true) return false;
      const cand: Candidate = { kind: 'char', uid: pl.setCardId, cardId: pl.setCardId, player: ctx.source.player };
      return matchOneFilter(state, pl.setCardId, cond.filter, null, cand);
    }
    case 'setCardFaceIs': {
      const pl = ctx.triggerPayload as { faceUp?: unknown } | undefined;
      return typeof pl?.faceUp === 'boolean' && pl.faceUp === cond.faceUp;
    }
    // engine additive wave-3 (2026-06-30): cutin:used payload の使用カットイン (cardId) を filter 評価 (B09086)。
    // setCardMatches と同式 — set card 同様 cutin カードは scene char ではないため matchOneFilter の char 引数は null。
    case 'triggerCutinMatches': {
      const pl = ctx.triggerPayload as { cardId?: string } | undefined;
      if (!pl || typeof pl.cardId !== 'string') return false;
      const cand: Candidate = { kind: 'char', uid: pl.cardId, cardId: pl.cardId, player: ctx.source.player };
      return matchOneFilter(state, pl.cardId, cond.filter, null, cand);
    }
    // engine mini-wave #2 (2026-07-10, cluster④): 「ネクストヒントで手札を使用したとき」判別。
    // next-hint.ts が effect:declared payload に viaNextHint:true を積む (通常手札使用には無い)。
    case 'triggerViaNextHint': {
      const pl = ctx.triggerPayload as { viaNextHint?: boolean } | undefined;
      return pl?.viaNextHint === true;
    }
    // engine mini-wave #2 (2026-07-10): 使用カード (effect:declared payload.cardId) の CardDef 印字値を
    // filter 評価 (B05005「【青】のカードを使用したとき」)。triggerCutinMatches と同式 (char=null)。
    case 'triggerCardMatches': {
      const pl = ctx.triggerPayload as { cardId?: string } | undefined;
      if (!pl || typeof pl.cardId !== 'string') return false;
      const cand: Candidate = { kind: 'char', uid: pl.cardId, cardId: pl.cardId, player: ctx.source.player };
      return matchOneFilter(state, pl.cardId, cond.filter, null, cand);
    }
    // engine mega-wave W3 (2026-07-03, r10): disguise:replaced payload の入替わり側 (newCardId) を
    // filter 評価 (B03052「〚カード名［ベルモット］〛が【変装】によって…入れ替わったとき」)。
    // triggerCutinMatches と同型 — char=null = CardDef 印字値、rules/19 分割名は cardName 経由。
    case 'disguiseReplacedByMatches': {
      const pl = ctx.triggerPayload as { newCardId?: string } | undefined;
      if (!pl || typeof pl.newCardId !== 'string') return false;
      const cand: Candidate = { kind: 'char', uid: pl.newCardId, cardId: pl.newCardId, player: ctx.source.player };
      return matchOneFilter(state, pl.newCardId, cond.filter, null, cand);
    }
    // engine mega-wave W3 (2026-07-03, r51): disguise:into payload.replacedChar (入替え元 snapshot) を
    // filter 評価 (B02047「【変装時】LP2以上の【白】のキャラと入れ替わった場合」)。removedCharMatches の
    // removedFilter と同型。uid は sentinel (`::disguise-replaced`) で scene 不在にし、新カード自身の
    // continuous/aura を混入させない。入替え直前の有効 AP/LP/level は payload.replacedEffective に固定し、
    // sentinel による旧カード側 continuous/aura 欠落も防ぐ。
    case 'disguiseReplacedMatches': {
      const pl = ctx.triggerPayload as
        | {
            player?: 'self' | 'opp';
            replacedChar?: SceneCharacter;
            replacedEffective?: { ap?: number; lp?: number; level?: number };
          }
        | undefined;
      if (!pl?.replacedChar || (pl.player !== 'self' && pl.player !== 'opp')) return false;
      const sameSide = pl.player === ctx.source.player;
      if (cond.side === 'self' && !sameSide) return false;
      if (cond.side === 'opp' && sameSide) return false;
      const rc = pl.replacedChar;
      const cand: Candidate = { kind: 'char', uid: rc.uid, cardId: rc.cardId, player: pl.player };
      const effective = pl.replacedEffective;
      if (!effective) return matchOneFilter(state, rc.cardId, cond.filter, rc, cand);
      const {
        apMin, apMax, lpMin, lpMax, levelMin, levelMax, levelIn,
        ...nonNumericFilter
      } = cond.filter;
      if (!matchOneFilter(state, rc.cardId, nonNumericFilter, rc, cand)) return false;
      if (apMin !== undefined && (effective.ap === undefined || effective.ap < apMin)) return false;
      if (apMax !== undefined && (effective.ap === undefined || effective.ap > apMax)) return false;
      if (lpMin !== undefined && (effective.lp === undefined || effective.lp < lpMin)) return false;
      if (lpMax !== undefined && (effective.lp === undefined || effective.lp > lpMax)) return false;
      if (levelMin !== undefined && (effective.level === undefined || effective.level < levelMin)) return false;
      if (levelMax !== undefined && (effective.level === undefined || effective.level > levelMax)) return false;
      if (levelIn !== undefined && (effective.level === undefined || !levelIn.includes(effective.level))) return false;
      return true;
    }
    // engine mega-wave W3 (2026-07-03, r17): hand:removed payload.byPlayer (リムーブを起こした側) を
    // カード所有者 (ctx.source.player) 視点で side 判定 (B05115「相手の能力や効果によって」= side:'opp')。
    case 'triggerByPlayerIs': {
      const pl = ctx.triggerPayload as { byPlayer?: 'self' | 'opp' } | undefined;
      if (!pl || (pl.byPlayer !== 'self' && pl.byPlayer !== 'opp')) return false;
      const same = pl.byPlayer === ctx.source.player;
      return cond.side === 'self' ? same : !same;
    }
    // engine mega-wave W3 (2026-07-03, r18): hand:reveal payload.revealed (公開 CardId[]) の cardName
    // any-match (B09004「〚カード名［工藤新一］〛か〚［毛利蘭］〛を公開したとき」)。1枚でも一致で true。
    // removeExitMatches と同じ side 規約 (省略時 'self' = 自分の手札公開)。
    case 'triggerRevealMatches': {
      const pl = ctx.triggerPayload as { player?: 'self' | 'opp'; revealed?: string[]; byPlayer?: 'self' | 'opp'; cause?: 'effect' | 'cost' } | undefined;
      if (!pl || (pl.player !== 'self' && pl.player !== 'opp') || !Array.isArray(pl.revealed)) return false;
      const reqSide = cond.side ?? 'self';
      const sameSide = pl.player === ctx.source.player;
      if (reqSide === 'self' && !sameSide) return false;
      if (reqSide === 'opp' && sameSide) return false;
      if (cond.byPlayer) {
        if (pl.byPlayer !== 'self' && pl.byPlayer !== 'opp') return false;
        if ((cond.byPlayer === 'self') !== (pl.byPlayer === ctx.source.player)) return false;
      }
      if (cond.cause && pl.cause !== cond.cause) return false;
      if (cond.cardName !== undefined) {
        const nameFilter = { cardName: cond.cardName };
        return pl.revealed.some((id) => {
          const cand: Candidate = { kind: 'card', cardId: id, area: 'hand', player: pl.player! } as Candidate;
          return matchOneFilter(state, id, nameFilter, null, cand);
        });
      }
      return true;
    }
    // engine拡張 wave#2 cluster15 (2026-06-16): removal-observer (反撃カード一族)。
    // leave:to-remove payload snapshot {uid,cause,side,byUid} を **scene 再取得せず** 読む
    // (除去キャラは splice 済 = triggerCharMatches L298 の scene.find は使えない、13198)。
    // side/cause/by を owner-relative に評価。rules/07-08/17/18/22。
    // spec: .claude/specs/engine-cluster15-contact-removal-observer-design.md
    case 'removedCharMatches': {
      const pl = ctx.triggerPayload as
        | { uid?: string; cause?: string; side?: 'self' | 'opp'; byUid?: string; byPlayer?: 'self' | 'opp'; removedChar?: SceneCharacter }
        | undefined;
      if (!pl || (pl.side !== 'self' && pl.side !== 'opp')) return false;
      // side: payload.side === owner → 'self' (自分のキャラが除去された) / それ以外 → 'opp'。
      const sameSide = pl.side === ctx.source.player;
      if (cond.side === 'self' && !sameSide) return false;
      if (cond.side === 'opp' && sameSide) return false;
      // cause: 'contact-ap' 等で限定 (省略 = 方法問わず、rules/17)。
      if (cond.cause !== undefined && pl.cause !== cond.cause) return false;
      // byPlayer (attribution mini-wave 2026-07-10): リムーブを起こした効果 owner の帰属判定
      // (「自分の能力や効果によって」B03116/B05107/B03112/B04089/91/94)。payload.byPlayer は
      // absolute Player (mutate/scene.ts emit、atom-handlers 由来のみ設定)。未設定 (legacy caller:
      // turn-end/MR②/switch/cost) は fail-closed = false。`by` (コンタクト勝者 uid) とは別軸。
      if (cond.byPlayer !== undefined) {
        if (typeof pl.byPlayer !== 'string') return false;
        const bySelf = pl.byPlayer === ctx.source.player;
        if (cond.byPlayer === 'self' && !bySelf) return false;
        if (cond.byPlayer === 'opp' && bySelf) return false;
      }
      // by: 除去者 (= contact winner aUid)。winner は contact で除去されない (rules/08) = 生存 → 再取得可。
      if (cond.by !== undefined) {
        const byUid = pl.byUid;
        if (typeof byUid !== 'string') return false;
        if (cond.by === 'self') {
          // 「このキャラとのコンタクトによって」= observer 自身が除去者。
          if (byUid !== ctx.source.uid) return false;
        } else {
          // 「自分の現場にいる(このキャラ以外の)〚filter〛のキャラとのコンタクトによって」。
          if (cond.by.excludeSource && byUid === ctx.source.uid) return false;
          const ch = state.players[ctx.source.player].scene.find(c => c.uid === byUid);
          if (!ch) return false;
          const cand: Candidate = { kind: 'char', uid: ch.uid, cardId: ch.cardId, player: ctx.source.player };
          if (!matchOneFilter(state, ch.cardId, cond.by.filter, ch, cand)) return false;
        }
      }
      // removedFilter/removedState (2026-06-23): 離場キャラ **自身** を色/特徴/レベル/状態で gate
      // (B01075/B03092/B05059 等)。payload.removedChar (splice 前 snapshot) を評価。snapshot は char.turnEffects を
      // 保持するため effective level (rules/19) が同期 eval 中は正しい。state は TargetFilter に無く matchOneFilter が
      // 見ないため removedState で独立判定する (snapshot の除去直前状態、B05059「スリープ状態の〚探偵〛」)。
      if (cond.removedState !== undefined && cond.removedState.length > 0) {
        const rc = pl.removedChar;
        if (!rc || !cond.removedState.includes(rc.state)) return false;
      }
      if (cond.removedFilter !== undefined) {
        const rc = pl.removedChar;
        if (!rc) return false;
        const cand: Candidate = { kind: 'char', uid: rc.uid, cardId: rc.cardId, player: pl.side };
        if (!matchOneFilter(state, rc.cardId, cond.removedFilter, rc, cand)) return false;
      }
      return true;
    }
    case 'removeExitMatches': {
      // engine additive wave-4 (2026-07-01): remove:exit payload (リムーブエリアから離脱したカード) を評価。
      // 「自分のリムーブエリアにある〚特徴/種別〛のカードがリムーブエリアから離れたとき」(B05087/B05088)。
      // payload={player(=リムーブエリア所有者), cardId(=離脱カード)}。離脱は cardId のみ (remove は CardId[] で
      // scene char ではない) → matchOneFilter の char 引数は null = CardDef 印字値判定 (setCardMatches/
      // triggerCutinMatches/boundMatchesFilter と同流儀)。remove-area card は turnEffects を持たないため
      // effective level/AP/LP も静的 def 値で正しい (continuousDelta は uid=null → 0)。
      const pl = ctx.triggerPayload as { player?: 'self' | 'opp'; cardId?: string } | undefined;
      if (!pl || (pl.player !== 'self' && pl.player !== 'opp') || typeof pl.cardId !== 'string') return false;
      // side: payload.player === source.player → 'self' (自分のリムーブエリア)。省略時 'self'。
      const reqSide = cond.side ?? 'self';
      const sameSide = pl.player === ctx.source.player;
      if (reqSide === 'self' && !sameSide) return false;
      if (reqSide === 'opp' && sameSide) return false;
      if (cond.removeFilter !== undefined) {
        const cand: Candidate = { kind: 'card', cardId: pl.cardId, area: 'remove', player: pl.player };
        if (!matchOneFilter(state, pl.cardId, cond.removeFilter, null, cand)) return false;
      }
      return true;
    }
    // engine拡張 wave#2 cluster3 (2026-06-13): アクション種別 ([キャラ]/[事件]) gate。
    // action:declare payload の target.kind ('char'|'case') を読む (state-machine.ts declare emit)。
    // payload 不在 / target 不在は false (発火させない安全側)。rules/22 + TSV qAndA (B01036 等 6枚)。
    case 'triggerActionKind': {
      const tak = ctx.triggerPayload as { target?: { kind?: unknown } } | undefined;
      return tak?.target?.kind === cond.v;
    }
    // Task D E4 (2026-06-12): ctx.source キャラ自身の turnEffects flag (B09041 a3
    // 「このターン中にこのキャラのアクションがガードされていた場合に宣言できる」等)
    case 'charTurnEffect': {
      const cteUid = ctx.source.uid;
      if (!cteUid) return false;
      for (const p of ['self', 'opp'] as const) {
        const ch = state.players[p].scene.find(c => c.uid === cteUid);
        if (ch) return ch.turnEffects[cond.key] === true;
      }
      return false;
    }
    // engine拡張 wave#2 cluster11 (2026-06-15, BUG-146 coupled): 効果/能力による登場の「原因カード」評価。
    // enter payload.viaEffect + payload.sourceCardId を読む (BUG-146 fix で atom 登場 emit が source を登場キャラに
    // 統一し、原因カードを payload.sourceCardId へ移送)。sourceFilter は CardDef-static (matchOneFilter c=null = 印字値、
    // 原因カードが既に盤面を離れていても可、fileTopMatches/boundMatchesFilter と同流儀)。
    // sourceCardId 不在 (EffectStackEntrySource.cardId は optional) / non-effect 登場は不一致 (安全側 false)。
    case 'enterSource': {
      const esPayload = ctx.triggerPayload as { viaEffect?: boolean; sourceCardId?: string; sourcePlayer?: 'self' | 'opp' } | undefined;
      if (cond.viaEffect !== undefined && (esPayload?.viaEffect ?? false) !== cond.viaEffect) return false;
      // WB2 (2026-07-11, B05009): side — 原因カードの所有側 (payload.sourcePlayer) が登場キャラ (ctx.source) と
      // 同側か。「自分のキャラの能力によって登場」= side:'self'。sourcePlayer 不在 emit (旧経路) は undefined→不一致。
      if (cond.side) {
        const sameSide = esPayload?.sourcePlayer === ctx.source.player;
        if (cond.side === 'self' && !sameSide) return false;
        if (cond.side === 'opp' && sameSide) return false;
      }
      if (cond.sourceFilter) {
        const scId = esPayload?.sourceCardId;
        if (typeof scId !== 'string') return false;
        const cand: Candidate = { kind: 'char', uid: '', cardId: scId, player: ctx.source.player };
        if (!matchOneFilter(state, scId, cond.sourceFilter, null, cand)) return false;
      }
      return true;
    }
    // mega-wave W6 step3 (2026-07-04, r63 P19): 「このイベントが能力や効果によって使用されていた場合」
    // (B07026)。effect:declared payload の kind==='event-use' 明示ガード必須 — cutin ({abilityId:'cutin'}) /
    // hirameki 等 別 shape の triggerPayload で誤発火させない (resolve-picks forcedInclusionUids の既知
    // 落とし穴と同型)。viaEffect 無指定 emit (hand-use-card/next-hint = player-action 起源) は
    // undefined??false=false で「手札の使用/ネクストヒント」起源として自然判別 (既存2 emit 無改修)。
    case 'eventUseSource': {
      const eus = ctx.triggerPayload as { kind?: unknown; viaEffect?: boolean } | undefined;
      if (eus?.kind !== 'event-use') return false;
      return (eus.viaEffect ?? false) === cond.viaEffect;
    }
    // mega-wave W6 step6 (2026-07-04, r79/B08014): 「このターン中にこのキャラが自分のMRの能力に
    // よって選ばれていた」。書き手 = resolver.ts atom dispatch 前 guard → mutate.char.tagSelectedByOwnMr。
    // 読取は ctx.source 自身の turnEffects snapshot (発動前後を問わず turn 内 monotonic、B08014 Q&A)。
    case 'selfSelectedByOwnMrThisTurn': {
      const ssUid = ctx.source.uid;
      if (typeof ssUid !== 'string') return false;
      return state.players[ctx.source.player].scene.find(c => c.uid === ssUid)?.turnEffects['selectedByOwnMr'] === true;
    }
    // mega-wave W6 step6 (2026-07-04, r79/B09047): PA-MR slot の存在 + printed colors 数
    // (partner (strict singleton) の色とは別物 — partnerAreaMR slot を読む。誤読 typo 注意)。
    case 'paMrColorCountMin': {
      const pmSide = resolvePlayer(cond.side, ctx);
      const pmMr = state.players[pmSide].partnerAreaMR;
      if (!pmMr) return false;
      return (lookupCardDef(pmMr.cardId)?.colors ?? []).length >= cond.min;
    }
    case 'custom':
      return cond.check(state, ctx);
    // refactor 2b: case 追加漏れの compile-time 検出 (noImplicitReturns 無効のため明示 guard)。到達不能。
    default: {
      const _exhaustive: never = cond;
      void _exhaustive;
      return false;
    }
  }
}

// refactor 2b (2026-06-12): Condition union の kind 一覧を value として単一ソース化
// (`satisfies Record<Condition['kind'], true>` で両方向同期を強制)。
// scripts/taskA-validate-specs.cjs CONDS との同期は tests/engine/sync-taskA-whitelists.test.ts。
const CONDITION_KIND_MAP = {
  boundMatchCountAtLeast: true,
  triggerViaNextHint: true,
  triggerCardMatches: true,
  true: true, false: true, not: true, and: true, or: true, turn: true, sourceInScene: true,
  partnerColor: true, caseColor: true, caseColorNot: true, caseTrait: true, caseName: true, fileAtLeast: true, caseStatus: true,
  bond: true, sceneHas: true, apAtLeast: true, lpAtLeast: true, evidenceAtLeast: true,
  evidenceDiff: true, sceneCountCompare: true, // engine additive wave (2026-06-30, B05103/B05081)
  boundCountCompare: true, // S2 deck cluster (2026-07-10, B08057): bound 要素数比較 (合わせてN枚 gate)
  evidenceTraitAtLeast: true, // engine E3 P53 (2026-07-03, B09107 証拠特徴計数)
  handAtLeast: true, handAtMost: true, handCountAtLeastOther: true, deckAtLeast: true, // Task D E1 (2026-06-12)
  fileTopType: true,
  fileTopMatches: true, triggerPlayerIs: true, // Task D E3 (2026-06-12)
  scratchTrace: true, flag: true, declaredUseUnder: true, sourceDeclaredUseCount: true, bound: true,
  removeColorAtLeast: true, removeTraitAtLeast: true, removeNameAtLeast: true, removeFilterAtLeast: true, removeCountAtLeast: true,
  sceneLpSum: true, costRemovedMatches: true, // engine additive wave (2026-06-29d)
  costRevealedMatches: true, // attribution mini-wave (2026-07-10)
  enterCountAtMost: true, // engine additive (2026-06-29, B09089)
  stackedCountAtLeast: true, hostSetCardCountAtLeast: true, sceneFaceDownSetCardCountAtLeast: true, sameNameCountAtLeast: true, charStateIs: true, charMatches: true, // charStateIs: BUG-145 (2026-06-15)
  contactOpponentApHigher: true, guardedBySelf: true,
  contactCharMatches: true, // engine defer-unlock mini-wave (2026-07-09, B02006/B02080/PR278)
  enterOrderEquals: true, boundCharStateIs: true, boundMatchesFilter: true, triggerCharMatches: true,
  boundAnyMatchesFilter: true, // engine additive wave-5 (2026-07-01, G17): bound 集合 any-match (PR132/D06013)
  boundDistinctColorCount: true, // engine additive wave-10 (2026-07-02, G17 残): bound 集合内 相互異色 n 枚 (B07002)
  boundNameMatchesDeclared: true, // engine mega-wave W6 step1 (2026-07-04): declareName 宣言名 ⇔ bound 集合 any-match (B09108)
  boundIsMr: true, // engine mega-wave W6 step1 (2026-07-04): bound[0] MR 判定 (B06085)
  leaveCauseIn: true, // engine mega-wave W6 step10 (2026-07-04, row9): 離脱 cause 帰属 gate (B01092/B01039)
  leaveOwnerIs: true, // engine mega-wave W6 step10 (2026-07-04, row9): 離場キャラ owner 判定 (B01092)
  eventUseSource: true, // engine mega-wave W6 step3 (2026-07-04, P19): イベント使用の起源判別 (B07026)
  selfSelectedByOwnMrThisTurn: true, // engine mega-wave W6 step6 (2026-07-04, r79): MR 選択追跡 (B08014)
  paMrColorCountMin: true, // engine mega-wave W6 step6 (2026-07-04, r79): PA-MR 色数 gate (B09047)
  setCardMatches: true, // engine additive (2026-06-29, B06046)
  setCardFaceIs: true,
  triggerCutinMatches: true, // engine additive wave-3 (2026-06-30, B09086): cutin:used 使用cutin filter
  charTurnEffect: true, // Task D E4 (2026-06-12)
  triggerActionKind: true, // engine拡張 wave#2 cluster3 (2026-06-13)
  enterSource: true, // engine拡張 wave#2 cluster11 (2026-06-15, BUG-146 coupled)
  removedCharMatches: true, // engine拡張 wave#2 cluster15 (2026-06-16): removal-observer (反撃カード一族)
  removeExitMatches: true, // engine additive wave-4 (2026-07-01): remove:exit observer (B05087/B05088)
  disguiseReplacedByMatches: true, // engine mega-wave W3 (2026-07-03, r10): 被置換反応の入替わり側 filter (B03052)
  disguiseReplacedMatches: true, // engine mega-wave W3 (2026-07-03, r51): 入替え元 snapshot filter (B02047)
  triggerByPlayerIs: true, // engine mega-wave W3 (2026-07-03, r17): hand:removed 起動側 side 判定 (B05115)
  triggerRevealMatches: true, // engine mega-wave W3 (2026-07-03, r18): hand:reveal cardName any-match (B09004)
  custom: true,
} as const satisfies Record<Condition['kind'], true>;
export const CONDITION_KINDS: ReadonlySet<string> = new Set(Object.keys(CONDITION_KIND_MAP));

export function evalAll(state: GameState, cs: Condition[], ctx: EffectCtx): boolean[] {
  return cs.map(c => evalCond(state, c, ctx));
}

function resolvePlayer(p: 'self' | 'opp', ctx: EffectCtx): 'self' | 'opp' {
  // 'self' / 'opp' here refer to perspective. Owner = ctx.source.player.
  // The Condition spec uses 'self' = owner; 'opp' = opp-of-owner.
  if (p === 'self') return ctx.source.player;
  return ctx.source.player === 'self' ? 'opp' : 'self';
}

function resolveCharsForRef(state: GameState, ref: import('@/engine/types').TargetingRef, ctx: EffectCtx): string[] {
  // For apAtLeast / lpAtLeast / stackedCountAtLeast we want char uids.
  // resolveTarget auto-resolves for 'self' / 'all' / 'fromBound'; for 'pick'
  // we use ctx.picked when present, else fall back to candidates.
  try {
    if (ref.kind === 'pick') {
      const picked = ctx.picked ?? candidates(state, ref, ctx);
      return picked.filter(isCharCandidate).map(c => c.uid);
    }
    const resolved = resolveTarget(state, ref, ctx);
    return resolved.filter(isCharCandidate).map(c => c.uid);
  } catch {
    return [];
  }
}

export const cond = {
  eval: evalCond,
  evalAll,
};
