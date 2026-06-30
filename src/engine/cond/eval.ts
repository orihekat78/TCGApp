// engine.cond.eval — Condition evaluator
// spec: Phase 3 Group B Task 3.6
// rules: 17-icons.md §条件アイコン, 13-keywords.md, 15-abilities-effects.md,
//        18-mr.md, 19-special-rules.md, 25-qa-effects-resolution.md
//
// Condition unmet → "ability/effect not held at all" (rules/17 Point).

import type { GameState, Condition, EffectCtx, Candidate, SceneCharacter } from '@/engine/types';
import { candidates, matchOneFilter } from '@/engine/target/candidates.js';
import { resolve as resolveTarget } from '@/engine/target/resolve.js';
import { lookupCardDef, allCardNameComponentsForDef } from '@/engine/target/card-def-registry.js';
import { char as charRead } from '@/engine/read/char.js';
import { defHasKeyword } from '@/engine/read/keyword.js'; // wave#2 cluster2: boundMatchesFilter keyword 判定

/** Type predicate: narrows a Candidate to the 'char' variant. */
function isCharCandidate(c: Candidate): c is { kind: 'char'; uid: string; cardId: string; player: 'self' | 'opp' } {
  return c.kind === 'char';
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
    case 'partnerColor': {
      const owner = ctx.source.player;
      const partner = state.players[owner].partner;
      const d = lookupCardDef(partner.cardId);
      const want = Array.isArray(cond.color) ? cond.color : [cond.color];
      const have = d?.colors ?? [];
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
      // (D11021=婚活 は両方に持つため後方互換 / 古城系 gating を解禁)。
      const traits = [...(d?.caseTraits ?? []), ...(d?.traits ?? [])];
      return traits.includes(cond.trait);
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
      const owner = ctx.source.player;
      const wants = Array.isArray(cond.cardName) ? cond.cardName : [cond.cardName];
      for (const c of state.players[owner].scene) {
        const d = lookupCardDef(c.cardId);
        if (!d) continue;
        const components = allCardNameComponentsForDef(d);
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
      const used = charRead.declaredUseCount(state, cond.uid, cond.abilityId);
      return used < cond.max;
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
      const count = state.players[p].remove.filter(id => {
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
      const count = state.players[p].remove.filter(id => {
        const d = lookupCardDef(id);
        const traits = d?.traits ?? [];
        return wants.some(w => traits.includes(w));
      }).length;
      return count >= cond.n;
    }
    case 'removeNameAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      const wants = Array.isArray(cond.cardName) ? cond.cardName : [cond.cardName];
      const count = state.players[p].remove.filter(id => {
        const d = lookupCardDef(id);
        if (!d) return false;
        const components = allCardNameComponentsForDef(d);
        return wants.some(w => components.includes(w));
      }).length;
      return count >= cond.n;
    }
    // engine additive: removeCountAtLeast — リムーブエリアの総枚数 (filter 無し) が n 以上か (B03104)。
    // removeColor/Trait/NameAtLeast の unfiltered 版。使用中イベント自身は未だ remove に無いため
    // 数えない (B03104 qAndA と整合 — 効果解決時点で remove に置かれていない)。
    case 'removeCountAtLeast': {
      const p = resolvePlayer(cond.player, ctx);
      return state.players[p].remove.length >= cond.n;
    }
    // engine additive wave (2026-06-29d): 直前に支払ったコストで除去されたカードの素性で分岐 (B03003/B04077/B06078)。
    // removeDeckTop コストが ctx.costPaid['removeDeckTop'].ids へ除去 cardId を記録 (cost/pay.ts)。除去済カードは
    // 盤面不在ゆえ matchOneFilter(c=null = CardDef 印字値、boundMatchesFilter/enterSource と同流儀) で判定。
    // n=必要一致数 (既定1)。ids 不在 (cost 未払い/別 cost のみ) → 0 一致 → false。
    case 'costRemovedMatches': {
      const rec = ctx.costPaid?.['removeDeckTop'] as { ids?: string[] } | undefined;
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
    // BUG-145 (self-state micro-cluster, 2026-06-15): ref が指すキャラの状態判定。
    // 「このキャラをスリープさせ(…)てもよい」を already-sleep で gate する用途
    // (PR138/PR144/B04049 等を conditional{if:not{charStateIs $self sleep}} でラップ)。
    // resolveCharsForRef は scene の char uid のみ返す (空なら .some=false)。
    case 'charStateIs': {
      const uids = resolveCharsForRef(state, cond.ref, ctx);
      return uids.some(uid => charRead.state(state, uid) === cond.state);
    }
    case 'contactOpponentApHigher': {
      // D11007 a3: contact:start payload から aUid (attacker) / bUid (defender) を取得。
      // 自分 (ctx.source.uid) が攻撃者 (aUid) として、相手 (bUid) の AP が自分より高いコンタクトのみ true。
      // BUG-098: 旧実装は自分の関与を確認せず、任意のコンタクト (defender>attacker) で過剰発火していた。
      // 【自分ターン中】= 自分が攻撃するので攻撃者 (aUid) 限定で十分 (rules/07-08)。
      const payload = ctx.triggerPayload as { aUid?: string; bUid?: string } | undefined;
      if (!payload?.aUid || !payload?.bUid) return false;
      if (payload.aUid !== ctx.source.uid) return false; // 自分が攻撃者のコンタクトのみ
      const aAp = charRead.ap(state, payload.aUid);
      const bAp = charRead.ap(state, payload.bUid);
      return bAp > aAp;
    }
    case 'guardedBySelf': {
      // D11016 a1: action:guarded payload.guardUid が自分 (ctx.source.uid) と一致するとき true
      // (「このキャラがガードしたとき」= 自分のガードのみ発火、rules/07。BUG-097)
      const guardUid = (ctx.triggerPayload as { guardUid?: string } | undefined)?.guardUid;
      return guardUid === ctx.source.uid;
    }
    case 'enterOrderEquals': {
      // D11014 a1 / D11003 / D11009 driver: enter hook payload.enterOrderThisTurn が n と一致するか
      // rules/17 §【疾風 N】: 「自分の現場にこのターン N番目に登場したとき」
      // (累積 enterOrder ではなく、ターン境界でリセットされる counter を参照)
      const payload = ctx.triggerPayload as { enterOrderThisTurn?: number } | undefined;
      return payload?.enterOrderThisTurn === cond.n;
    }
    case 'boundMatchesFilter': {
      // D11014 a2 driver: ctx.bindings[bindKey][0] の cardId を TargetFilter で評価
      // (「〚カード名[X]〛を登場させた場合」を declarative 化)
      const bound = ctx.bindings?.[cond.bindKey];
      if (!Array.isArray(bound) || bound.length === 0) return false;
      const cardId = (bound[0] as { cardId?: string }).cardId;
      if (typeof cardId !== 'string') return false;
      const d = lookupCardDef(cardId);
      const f = cond.filter;
      // CardDef-driven filter のみサポート (SceneCharacter state 系は対象外)
      if (f.cardId !== undefined) {
        const ids = Array.isArray(f.cardId) ? f.cardId : [f.cardId];
        if (!ids.includes(cardId)) return false;
      }
      if (f.cardName !== undefined) {
        const wants = Array.isArray(f.cardName) ? f.cardName : [f.cardName];
        const components = d ? allCardNameComponentsForDef(d) : [];
        if (!wants.some(w => components.includes(w))) return false;
      }
      // cluster16: cardNameNot (「〚カード名[X]〛以外」) — matchOneFilter / targetFilterToPredicate と同式。
      // 第4の filter-eval サイト (本関数は matchOneFilter 非委譲の inline 評価)。3経路 sync 必須 (cluster2 教訓)。
      if (f.cardNameNot !== undefined) {
        const nots = Array.isArray(f.cardNameNot) ? f.cardNameNot : [f.cardNameNot];
        const components = d ? allCardNameComponentsForDef(d) : [];
        if (nots.some(w => components.includes(w))) return false;
      }
      if (f.trait !== undefined) {
        const wants = Array.isArray(f.trait) ? f.trait : [f.trait];
        const traits = d?.traits ?? [];
        if (!wants.some(w => traits.includes(w))) return false;
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
      if (f.levelMin !== undefined && (d?.level ?? 0) < f.levelMin) return false;
      if (f.levelMax !== undefined && (d?.level ?? 0) > f.levelMax) return false;
      // wave#2 cluster2 (2026-06-12): keyword/kind/ap/lp が silent drop されていた (BUG-117/118 同型、
      // targetFilterToPredicate と並ぶ第3の drop サイト)。keyword は defHasKeyword (単一真実源)、
      // 数値は printed 値判定 (bound カードは scene candidate を持たない — targetFilterToPredicate と同式)。
      if (f.keyword !== undefined) {
        const wants = Array.isArray(f.keyword) ? f.keyword : [f.keyword];
        if (!wants.some(w => defHasKeyword(d, w))) return false;
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
    // engine拡張 wave#2 cluster15 (2026-06-16): removal-observer (反撃カード一族)。
    // leave:to-remove payload snapshot {uid,cause,side,byUid} を **scene 再取得せず** 読む
    // (除去キャラは splice 済 = triggerCharMatches L298 の scene.find は使えない、13198)。
    // side/cause/by を owner-relative に評価。rules/07-08/17/18/22。
    // spec: .claude/specs/engine-cluster15-contact-removal-observer-design.md
    case 'removedCharMatches': {
      const pl = ctx.triggerPayload as
        | { uid?: string; cause?: string; side?: 'self' | 'opp'; byUid?: string; removedChar?: SceneCharacter }
        | undefined;
      if (!pl || (pl.side !== 'self' && pl.side !== 'opp')) return false;
      // side: payload.side === owner → 'self' (自分のキャラが除去された) / それ以外 → 'opp'。
      const sameSide = pl.side === ctx.source.player;
      if (cond.side === 'self' && !sameSide) return false;
      if (cond.side === 'opp' && sameSide) return false;
      // cause: 'contact-ap' 等で限定 (省略 = 方法問わず、rules/17)。
      if (cond.cause !== undefined && pl.cause !== cond.cause) return false;
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
      const esPayload = ctx.triggerPayload as { viaEffect?: boolean; sourceCardId?: string } | undefined;
      if (cond.viaEffect !== undefined && (esPayload?.viaEffect ?? false) !== cond.viaEffect) return false;
      if (cond.sourceFilter) {
        const scId = esPayload?.sourceCardId;
        if (typeof scId !== 'string') return false;
        const cand: Candidate = { kind: 'char', uid: '', cardId: scId, player: ctx.source.player };
        if (!matchOneFilter(state, scId, cond.sourceFilter, null, cand)) return false;
      }
      return true;
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
  true: true, false: true, not: true, and: true, or: true, turn: true,
  partnerColor: true, caseColor: true, caseColorNot: true, caseTrait: true, fileAtLeast: true, caseStatus: true,
  bond: true, sceneHas: true, apAtLeast: true, lpAtLeast: true, evidenceAtLeast: true,
  evidenceDiff: true, sceneCountCompare: true, // engine additive wave (2026-06-30, B05103/B05081)
  handAtLeast: true, handAtMost: true, handCountAtLeastOther: true, // Task D E1 (2026-06-12)
  fileTopType: true,
  fileTopMatches: true, triggerPlayerIs: true, // Task D E3 (2026-06-12)
  scratchTrace: true, flag: true, declaredUseUnder: true, bound: true,
  removeColorAtLeast: true, removeTraitAtLeast: true, removeNameAtLeast: true, removeCountAtLeast: true,
  sceneLpSum: true, costRemovedMatches: true, // engine additive wave (2026-06-29d)
  enterCountAtMost: true, // engine additive (2026-06-29, B09089)
  stackedCountAtLeast: true, charStateIs: true, // charStateIs: BUG-145 (2026-06-15)
  contactOpponentApHigher: true, guardedBySelf: true,
  enterOrderEquals: true, boundMatchesFilter: true, triggerCharMatches: true,
  setCardMatches: true, // engine additive (2026-06-29, B06046)
  charTurnEffect: true, // Task D E4 (2026-06-12)
  triggerActionKind: true, // engine拡張 wave#2 cluster3 (2026-06-13)
  enterSource: true, // engine拡張 wave#2 cluster11 (2026-06-15, BUG-146 coupled)
  removedCharMatches: true, // engine拡張 wave#2 cluster15 (2026-06-16): removal-observer (反撃カード一族)
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
