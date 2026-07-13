// engine.read.char — キャラ単位派生情報セレクタ (純粋関数)
// rules: 03-field-areas.md (状態), 11-reasoning.md (LP≤0), 13-keywords.md, 19-special-rules.md

import type { GameState, CardId, SetCardEntry, EffectCtx, Candidate, TargetFilter, AbilityScope, FilteredAssaultGrant } from '@/engine/types';
import { scene } from './scene.js';
import { def } from './def.js';
import { evalCond } from '../cond/eval.js';
import { evalDyn } from '../dyn/eval.js';
// BUG-113: candidates.ts の数値フィルタへ continuousDelta を late-binding で注入 (静的循環回避)。
// candidates は read/char を import しない (read/keyword/def は leaf) ため本 import は循環を作らない。
// cluster13 (2026-06-15): aura buff も同経路で late-binding (registerAuraDelta) + matchOneFilter で auraFilter 有効値判定。
import { registerContinuousDelta, registerAuraDelta, auraDeltaSafe, continuousDeltaSafe, matchOneFilter, registerTraitNameGrant, traitNameGrantSafe } from '../target/candidates.js';

// 常時有効型 continuousModifier.apDelta/lpDelta を read 時に再計算・合算する。
// keywords() の grantKeywords walk (BUG-030) と同じ continuous 経路。
// rules/24 §常時有効型: condition 成立中のみ加算、条件外で即失効 → read 毎に evalCond 判定。
// delta は dyn 式 {dyn} (evalDyn) / 定数 / closure の3形 (card-def.ts ContinuousDelta)。
// MR partner-area (rules/18, engine/mr-partner-area-core 2026-06-23): uid の所属 side を返す。
// scene + partnerAreaMR slot を走査。continuous/keyword reader は side ctx を要するため共通化。
function ownerSideOf(s: GameState, uid: string): 'self' | 'opp' | null {
  if (s.players.self.scene.some(c => c.uid === uid)) return 'self';
  if (s.players.opp.scene.some(c => c.uid === uid)) return 'opp';
  if (uid === 'partnerMR:self' && s.players.self.partnerAreaMR) return 'self';
  if (uid === 'partnerMR:opp' && s.players.opp.partnerAreaMR) return 'opp';
  return null;
}
/** uid が PA-MR sentinel か (area=partner-area)。 */
function isPartnerMrUid(uid: string): boolean {
  return uid === 'partnerMR:self' || uid === 'partnerMR:opp';
}
/** PA 常駐 (area=partner-area) で有効な scope か (rules/18: on-partner-area=PA+現場、always=どこでも)。 */
function scopeActiveInPartnerArea(scope: AbilityScope | undefined): boolean {
  return scope === 'on-partner-area' || scope === 'always';
}

/**
 * engine mega-wave W2 (2026-07-03, P07/r24): bearer 自身の continuous boolean token reader。
 * continuousDelta の boolean 版 — bearer (現場 or PA-MR) の continuous ability を walk し、
 * continuousModifier[token]===true かつ ability.condition 成立 (rules/24 常時有効型: 条件成立中のみ) で true。
 * 不在時 false = 挙動不変 (既存カードは未宣言)。consumer: target-expander.candidates (untargetableByAction) /
 * _canAction (selfActionBan) / canActionAgainstCase (caseActionBan) / canCutIn (selfCutinBanInContact)。
 */
function selfContinuousFlag(
  s: GameState,
  uid: string,
  // W2b (2026-07-03, r27): mustBeSelectedByOppEvent (B08087) — effect-pick forced-inclusion flag。
  // scene.byUid のみ走査 = 「現場にいる場合に有効」(公式Q&A) が自動整合。
  token: 'untargetableByAction' | 'caseActionBan' | 'selfActionBan' | 'selfCutinBanInContact' | 'mustBeSelectedByOppEvent',
): boolean {
  const char = scene.byUid(s, uid);
  if (!char) return false;
  const d = def.card(char.cardId);
  if (!d) return false;
  const owner = ownerSideOf(s, uid);
  if (!owner) return false;
  const inPA = isPartnerMrUid(uid);
  const ctx = { source: { player: owner, uid, area: inPA ? 'partner-area' : 'scene' }, bindings: {} } as EffectCtx;
  for (const ability of d.abilities ?? []) {
    if (ability.type !== 'continuous') continue;
    if (inPA && !scopeActiveInPartnerArea(ability.scope)) continue;
    if (ability.continuousModifier?.[token] !== true) continue;
    if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
    return true;
  }
  return false;
}

function continuousDelta(s: GameState, uid: string, which: 'apDelta' | 'lpDelta' | 'lvlDelta'): number {
  const char = scene.byUid(s, uid);
  if (!char) return 0;
  const d = def.card(char.cardId);
  if (!d) return 0;
  // owner side 解決 (scene + PA-MR slot)。PA-MR は scope on-partner-area/always のみ有効。
  const owner = ownerSideOf(s, uid);
  if (!owner) return 0;
  const inPA = isPartnerMrUid(uid);
  const ctx = { source: { player: owner, uid, area: inPA ? 'partner-area' : 'scene' }, bindings: {} } as EffectCtx;
  let total = 0;
  for (const ability of d.abilities ?? []) {
    if (ability.type !== 'continuous') continue;
    if (inPA && !scopeActiveInPartnerArea(ability.scope)) continue;
    const delta = ability.continuousModifier?.[which];
    if (delta === undefined) continue;
    if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
    if (typeof delta === 'number') {
      total += delta;
    } else if (typeof delta === 'function') {
      total += delta(s, { uid }) || 0;
    } else if (typeof delta === 'object' && 'dyn' in delta) {
      // NaN ガード (typeof NaN==='number'): 将来 '/' を含む dyn 式が NaN を返しても AP を汚染しない
      const v = evalDyn(s, delta.dyn, ctx);
      if (typeof v === 'number' && Number.isFinite(v)) total += v;
    }
  }
  // engine additive (2026-06-29c): on-set-host rider — faceUp でセットされたカード def の
  // scope:'on-set-host' continuous を host に合算する (装備イベント、B06063 せんぷう剣【自分ターン中】AP+2000)。
  // 裏向きセット (faceUp:false) は情報を持たない (rules/16) → 除外。ctx は host uid で構築済なので rider の
  // dyn/condition は host を参照する (【自分ターン中】等)。host 自身の walk と同じ accumulation。
  // gate=scope==='on-set-host' (新 scope、既存カード未宣言 → 回帰0)。set card の on-scene 能力は漏れない。
  for (const entry of char.setCards ?? []) {
    if (!entry.faceUp) continue;
    const sd = def.card(entry.cardId);
    if (!sd) continue;
    for (const ability of sd.abilities ?? []) {
      if (ability.type !== 'continuous') continue;
      if (ability.scope !== 'on-set-host') continue;
      const delta = ability.continuousModifier?.[which];
      if (delta === undefined) continue;
      if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
      if (typeof delta === 'number') {
        total += delta;
      } else if (typeof delta === 'function') {
        total += delta(s, { uid }) || 0;
      } else if (typeof delta === 'object' && 'dyn' in delta) {
        const v = evalDyn(s, delta.dyn, ctx);
        if (typeof v === 'number' && Number.isFinite(v)) total += v;
      }
    }
  }
  return total;
}

// engine拡張 wave#2 cluster13 (2026-06-15): 他キャラへの AP/LP buff aura の board-scan reader。
// targetUid のキャラが受ける aura 合計を、**同一 side の現場**にいる continuousModifier.apDeltaAura/lpDeltaAura
// 宣言キャラ (bearer) から集計する。各 bearer につき: ability.condition (【自分ターン中】等) 成立 +
// auraExcludeSelf 時は bearer≠target + auraFilter が target に一致 (matchOneFilter = 有効値レベル/色/特徴) を満たせば加算。
// restrictsOpponent (cluster5) と同じ board-scan を数値 aura へ拡張 (rules/24 §常時有効型)。
// 不在時 0 (既存カードは aura 未宣言 → no-op、smoke baseline 不変)。再帰 guard は auraDeltaSafe (candidates.ts) が担う。
function auraDelta(s: GameState, targetUid: string, which: 'apDeltaAura' | 'lpDeltaAura'): number {
  const target = scene.byUid(s, targetUid);
  if (!target) return 0;
  const ownerSide: 'self' | 'opp' | null = s.players.self.scene.some(c => c.uid === targetUid)
    ? 'self'
    : s.players.opp.scene.some(c => c.uid === targetUid)
      ? 'opp'
      : null;
  if (!ownerSide) return 0;
  const targetCand = { kind: 'char', uid: target.uid, cardId: target.cardId, player: ownerSide } as Candidate;
  let total = 0;
  // bearer = 同 side の現場キャラ + PA 常駐 MR (rules/18 「パートナーエリアでも有効」= B08062 型 aura)。
  // PA-MR bearer は scope on-partner-area/always のみ (現場 bearer は従来どおり gate 無し = 回帰0)。
  const bearers: Array<{ char: typeof target; inPA: boolean }> =
    s.players[ownerSide].scene.map(c => ({ char: c, inPA: false }));
  const slotMr = s.players[ownerSide].partnerAreaMR;
  if (slotMr) bearers.push({ char: slotMr, inPA: true });
  for (const { char: bearer, inPA } of bearers) {
    const bd = def.card(bearer.cardId);
    if (!bd) continue;
    const bearerCtx = { source: { player: ownerSide, uid: bearer.uid, area: inPA ? 'partner-area' : 'scene' }, bindings: {} } as EffectCtx;
    for (const ability of bd.abilities ?? []) {
      if (ability.type !== 'continuous') continue;
      if (inPA && !scopeActiveInPartnerArea(ability.scope)) continue;
      const cm = ability.continuousModifier;
      const delta = cm?.[which];
      if (typeof delta !== 'number') continue;
      if (cm?.auraExcludeSelf && bearer.uid === targetUid) continue; // 「このキャラ以外」
      if (ability.condition && !evalCond(s, ability.condition, bearerCtx)) continue; // 【自分ターン中】等の常時条件
      const filter = cm?.auraFilter as TargetFilter | undefined;
      if (filter && !matchOneFilter(s, target.cardId, filter, target, targetCand)) continue;
      total += delta;
    }
  }
  // engine additive (2026-06-29): cross-side aura — 反対 side の bearer が宣言した *Opp aura を加算する
  // (「【自分ターン中】相手の現場にいる…を AP-1000」B03033)。bearer の **target と反対 side** の現場 + PA-MR を走査し、
  // ability.condition を bearer 自身の side で評価、auraFilterOpp が target に一致すれば apDeltaAuraOpp/lpDeltaAuraOpp を加算。
  // auraExcludeSelf は cross-side では常に bearer≠target ゆえ非適用。同 side 走査と完全対称 (honor site 共有)。不在時 0 (回帰0)。
  const oppSide: 'self' | 'opp' = ownerSide === 'self' ? 'opp' : 'self';
  const whichOpp = which === 'apDeltaAura' ? 'apDeltaAuraOpp' : 'lpDeltaAuraOpp';
  const oppBearers: Array<{ char: typeof target; inPA: boolean }> =
    s.players[oppSide].scene.map(c => ({ char: c, inPA: false }));
  const oppSlotMr = s.players[oppSide].partnerAreaMR;
  if (oppSlotMr) oppBearers.push({ char: oppSlotMr, inPA: true });
  for (const { char: bearer, inPA } of oppBearers) {
    const bd = def.card(bearer.cardId);
    if (!bd) continue;
    const bearerCtx = { source: { player: oppSide, uid: bearer.uid, area: inPA ? 'partner-area' : 'scene' }, bindings: {} } as EffectCtx;
    for (const ability of bd.abilities ?? []) {
      if (ability.type !== 'continuous') continue;
      if (inPA && !scopeActiveInPartnerArea(ability.scope)) continue;
      const cm = ability.continuousModifier;
      const delta = cm?.[whichOpp];
      if (typeof delta !== 'number') continue;
      if (ability.condition && !evalCond(s, ability.condition, bearerCtx)) continue; // 【自分ターン中】等 (bearer 側で評価)
      const filter = cm?.auraFilterOpp as TargetFilter | undefined;
      if (filter && !matchOneFilter(s, target.cardId, filter, target, targetCand)) continue;
      total += delta;
    }
  }
  return total;
}

// mega-wave W6 step5 (2026-07-04, r50/B04072): 「相手は自分の現場にいる[filter]のキャラを指定して
// アクションできない」aura の per-target 判定。auraDelta と同型の **同 side** board-scan:
// targetUid の side の scene + PA-MR bearer を走査し、continuousModifier.untargetableByActionAura
// (TargetFilter) 宣言 + ability.condition 成立 + filter が target に一致すれば true (= 対象除外)。
// cross-side 版・auraExcludeSelf は現 exemplar で不要のため未実装 (YAGNI、auraDelta 同様に拡張可)。
// 消費 = target-expander.candidates() の負 filter のみ (ガード/guard 経路は candidates() 非経由 =
// 公式Q&A「ガードは可能」と自動整合)。再帰 guard 不要 (matchOneFilter 内部は本関数を呼び返さない)。
function auraUntargetableByAction(s: GameState, targetUid: string): boolean {
  const target = scene.byUid(s, targetUid);
  if (!target) return false;
  const ownerSide: 'self' | 'opp' | null = s.players.self.scene.some(c => c.uid === targetUid)
    ? 'self'
    : s.players.opp.scene.some(c => c.uid === targetUid)
      ? 'opp'
      : null;
  if (!ownerSide) return false;
  const targetCand = { kind: 'char', uid: target.uid, cardId: target.cardId, player: ownerSide } as Candidate;
  const bearers: Array<{ char: typeof target; inPA: boolean }> =
    s.players[ownerSide].scene.map(c => ({ char: c, inPA: false }));
  const slotMr = s.players[ownerSide].partnerAreaMR;
  if (slotMr) bearers.push({ char: slotMr, inPA: true });
  for (const { char: bearer, inPA } of bearers) {
    const bd = def.card(bearer.cardId);
    if (!bd) continue;
    const bearerCtx = { source: { player: ownerSide, uid: bearer.uid, area: inPA ? 'partner-area' : 'scene' }, bindings: {} } as EffectCtx;
    for (const ability of bd.abilities ?? []) {
      if (ability.type !== 'continuous') continue;
      if (inPA && !scopeActiveInPartnerArea(ability.scope)) continue;
      const filter = ability.continuousModifier?.untargetableByActionAura as TargetFilter | undefined;
      if (!filter) continue;
      if (ability.condition && !evalCond(s, ability.condition, bearerCtx)) continue;
      if (!matchOneFilter(s, target.cardId, filter, target, targetCand)) continue;
      return true;
    }
  }
  return false;
}

// mega-wave W6 step5 (2026-07-04, r74/B01082): 「このキャラが現場にいるかぎり、選んだキャラは
// オートフェイズにアクティブにならない」の per-target lock 判定。turnEffects['noAutoActivateBySourceUid']
// (charSetTurnEffect val:'$self' が bearer uid を書く) を読み、**bearer が現場に生存している時のみ**
// true (live 再評価 = rules/24 常時有効型と同 posture、bearer 離脱で自動解錠 — キー残置でも無効)。
// ⚠ 本キーは clearTurnEffects のどの scope でも delete しない (ターン跨ぎ永続が要件、mutate/char.ts
// の警告コメント参照)。消費 = flow/auto-phase.ts ステップ2 のみ。
// 制約: 単一 sourceUid 上書き方式 — 複数 bearer の同時 lock は後勝ち (現 exemplar B01082 のみで非該当、
// 複数 locker カードが出たら配列化)。
// S2 wave (2026-07-11, PR279): 「現場にいるこのキャラは相手のイベントの効果によってリムーブされない」
// — charProtectedFrom の opponentEventRestrict 版 (event-source 限定保護、atomSceneRemove の相手発 gate が
// def.kind==='event' 判定と併せて読む)。①自身の印字 continuous + ②faceUp setCards rider の 2 層は
// charProtectedFrom と同構造 (rules/16: 裏向きセットは能力を持たない)。
function charProtectedFromOppEvent(s: GameState, uid: string, token: 'remove'): boolean {
  const c = scene.byUid(s, uid);
  if (!c) return false;
  const owner = ownerSideOf(s, uid);
  if (!owner) return false;
  const ctx = { source: { player: owner, uid } } as Parameters<typeof evalCond>[2];
  const d = def.card(c.cardId);
  for (const ability of d?.abilities ?? []) {
    if (ability.type !== 'continuous') continue;
    if (ability.scope === 'on-set-host') continue;
    if (!ability.continuousModifier?.opponentEventRestrict?.includes(token)) continue;
    if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
    return true;
  }
  for (const entry of c.setCards) {
    if (!entry.faceUp) continue;
    const sd = def.card(entry.cardId);
    for (const ability of sd?.abilities ?? []) {
      if (ability.type !== 'continuous') continue;
      if (ability.scope !== 'on-set-host') continue;
      if (!ability.continuousModifier?.opponentEventRestrict?.includes(token)) continue;
      if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
      return true;
    }
  }
  return false;
}

// S2 wave (2026-07-11, B03093): 「自分の現場にいる[filter]の[state]のキャラは、相手のイベントの効果に
// よって選ばれない」— auraUntargetableByAction の event-pick 版 board-scan。bearer = 同 side の現場
// キャラ + PA-MR。state は untargetableByOppEventAuraState (TargetFilter に state が無い removedFilter
// と同事情の companion field) で判定。配線 = resolve-picks.ts の pick 列挙直後 負 filter。
function charUntargetableByOppEvent(s: GameState, targetUid: string): boolean {
  const target = scene.byUid(s, targetUid);
  if (!target) return false;
  const ownerSide: 'self' | 'opp' | null = s.players.self.scene.some(c => c.uid === targetUid)
    ? 'self'
    : s.players.opp.scene.some(c => c.uid === targetUid)
      ? 'opp'
      : null;
  if (!ownerSide) return false;
  const targetCand = { kind: 'char', uid: target.uid, cardId: target.cardId, player: ownerSide } as Candidate;
  const bearers: Array<{ char: typeof target; inPA: boolean }> =
    s.players[ownerSide].scene.map(c => ({ char: c, inPA: false }));
  const slotMr = s.players[ownerSide].partnerAreaMR;
  if (slotMr) bearers.push({ char: slotMr, inPA: true });
  for (const { char: bearer, inPA } of bearers) {
    const bd = def.card(bearer.cardId);
    if (!bd) continue;
    const bearerCtx = { source: { player: ownerSide, uid: bearer.uid, area: inPA ? 'partner-area' : 'scene' }, bindings: {} } as EffectCtx;
    for (const ability of bd.abilities ?? []) {
      if (ability.type !== 'continuous') continue;
      if (inPA && !scopeActiveInPartnerArea(ability.scope)) continue;
      const filter = ability.continuousModifier?.untargetableByOppEventAura as TargetFilter | undefined;
      if (!filter) continue;
      const states = ability.continuousModifier?.untargetableByOppEventAuraState;
      if (states && !states.includes(target.state)) continue;
      if (ability.condition && !evalCond(s, ability.condition, bearerCtx)) continue;
      if (!matchOneFilter(s, target.cardId, filter, target, targetCand)) continue;
      return true;
    }
  }
  return false;
}

/** rules/15: opponent effects cannot select a protected character. Actions remain legal. */
function charUntargetableByOppEffect(s: GameState, targetUid: string): boolean {
  const target = scene.byUid(s, targetUid);
  const owner = ownerSideOf(s, targetUid);
  if (!target || !owner) return false;
  const targetCand = { kind: 'char', uid: target.uid, cardId: target.cardId, player: owner } as Candidate;
  const bearers: Array<{ char: typeof target; inPA: boolean }> = s.players[owner].scene.map(char => ({ char, inPA: false }));
  if (s.players[owner].partnerAreaMR) bearers.push({ char: s.players[owner].partnerAreaMR!, inPA: true });
  for (const { char: bearer, inPA } of bearers) {
    const bearerCtx = { source: { player: owner, uid: bearer.uid, area: inPA ? 'partner-area' : 'scene' }, bindings: {} } as EffectCtx;
    const abilities = [
      ...(def.card(bearer.cardId)?.abilities ?? []).filter(a => a.scope !== 'on-set-host'),
      ...(!inPA ? (bearer.setCards ?? []).filter(entry => entry.faceUp).flatMap(entry =>
        (def.card(entry.cardId)?.abilities ?? []).filter(a => a.scope === 'on-set-host')) : []),
    ];
    for (const ability of abilities) {
      if (ability.type !== 'continuous') continue;
      if (inPA && !scopeActiveInPartnerArea(ability.scope)) continue;
      const mod = ability.continuousModifier;
      if (!mod || (ability.condition && !evalCond(s, ability.condition, bearerCtx))) continue;
      if (bearer.uid === targetUid && mod.untargetableByOppEffect === true) return true;
      const filter = mod.untargetableByOppEffectAura;
      if (filter && matchOneFilter(s, target.cardId, filter, target, targetCand)) return true;
    }
  }
  return false;
}

function noAutoActivateLocked(s: GameState, uid: string): boolean {
  const c = scene.byUid(s, uid);
  if (!c) return false;
  const src = c.turnEffects['noAutoActivateBySourceUid'];
  if (typeof src !== 'string') return false;
  return !!scene.byUid(s, src); // byUid は不在時 null (undefined でない) — truthy 判定
}

// AP: apOverride 優先 / 不在なら CardDef.ap、加えて turnEffects['apMod_*'] を合算
// (charModifyAP verb は turnEffects に delta を蓄積する設計。permanent/turn/contact の
// 3 scope を全て合算)
// 2026-05-25 fix: 旧コードは turnEffects を合算せず charModifyAP の効果が AP 判定
// に反映されないバグ (D11007 a3 の AP+3000 が無効化されていた根本原因)
// rules: 19-special-rules.md (下限なし)
function ap(s: GameState, uid: string): number {
  const char = scene.byUid(s, uid);
  if (!char) return 0;
  // engine defer-unlock mini-wave (2026-07-09): 「ターン終了時まで元のAPを X にする」(B05022) は
  // turnEffects['apOverride_turn'] が base を差替 (恒久 apOverride より優先 = 後発効果勝ち)。
  // rules/19 QA: 修整 (apMod_* / continuous / aura) はその上に合算で残る。
  const apOvTurn = char.turnEffects['apOverride_turn'];
  const base = typeof apOvTurn === 'number'
    ? apOvTurn
    : (char.apOverride !== null ? char.apOverride : (def.card(char.cardId)?.ap ?? 0));
  const modPermanent = (char.turnEffects['apMod_permanent'] as number | undefined) ?? 0;
  const modTurn      = (char.turnEffects['apMod_turn']      as number | undefined) ?? 0;
  const modContact   = (char.turnEffects['apMod_contact']   as number | undefined) ?? 0;
  // engine拡張 wave#2 cluster3 (2026-06-13): scope:'action' (「アクション終了時まで」B03097/B08048)。
  // 清掃は clearTurnEffects('action') (action-end 2経路) + turn-end safety net (rules/08 §6-7)。
  const modAction    = (char.turnEffects['apMod_action']    as number | undefined) ?? 0;
  const modContinuous = continuousDeltaSafe(s, uid, 'apDelta'); // BUG-157: 再入 guard 経由 (無限相互再帰防止)
  const modAura = auraDeltaSafe(s, uid, 'apDeltaAura'); // cluster13: 他キャラ aura (guard 付き)
  return base + modPermanent + modTurn + modContact + modAction + modContinuous + modAura;
}

// LP: lpOverride 優先 / 不在なら CardDef.lp、加えて turnEffects['lpMod_*'] を合算
// rules: 19-special-rules.md (下限なし), 11-reasoning.md (LP≤0 で証拠0枚)
function lp(s: GameState, uid: string): number {
  const char = scene.byUid(s, uid);
  if (!char) return 0;
  // engine mini-wave (2026-07-10): 「ターン終了時まで元のLPを X」(B01045 等) = lpOverride_turn が
  // base を差替 (恒久 lpOverride より優先 = 後発効果勝ち、apOverride_turn と対称)。修整±は残る (rules/19 QA)。
  const lpOvTurn = char.turnEffects['lpOverride_turn'];
  const base = typeof lpOvTurn === 'number'
    ? lpOvTurn
    : (char.lpOverride !== null ? char.lpOverride : (def.card(char.cardId)?.lp ?? 0));
  const modPermanent = (char.turnEffects['lpMod_permanent'] as number | undefined) ?? 0;
  const modTurn      = (char.turnEffects['lpMod_turn']      as number | undefined) ?? 0;
  const modContact   = (char.turnEffects['lpMod_contact']   as number | undefined) ?? 0;
  const modAction    = (char.turnEffects['lpMod_action']    as number | undefined) ?? 0;
  const modContinuous = continuousDeltaSafe(s, uid, 'lpDelta'); // BUG-157: 再入 guard 経由 (無限相互再帰防止)
  const modAura = auraDeltaSafe(s, uid, 'lpDeltaAura'); // cluster13: 他キャラ aura (guard 付き)
  return base + modPermanent + modTurn + modContact + modAction + modContinuous + modAura;
}

// Level: CardDef.level、加えて turnEffects['lvlMod_*'] を合算 (rules/19 下限なし)
// engine-extension #2 (2026-06-05): charModifyLevel verb 追加に伴い 3 scope 合算へ拡張
// (旧: 静的読み取りのみ → 旧挙動は modifyLevel 不使用時に互換 = base + 0 + 0 + 0)
function level(s: GameState, uid: string): number {
  const char = scene.byUid(s, uid);
  if (!char) return 0;
  const d = def.card(char.cardId);
  const base = d?.level ?? 0;
  const modPermanent = (char.turnEffects['lvlMod_permanent'] as number | undefined) ?? 0;
  const modTurn      = (char.turnEffects['lvlMod_turn']      as number | undefined) ?? 0;
  const modContact   = (char.turnEffects['lvlMod_contact']   as number | undefined) ?? 0;
  const modAction    = (char.turnEffects['lvlMod_action']    as number | undefined) ?? 0;
  // engine additive wave (2026-06-24): continuous lvlDelta (条件付き継続レベル修正) を合算 (ap/lp と対称)。
  // 不在時 +0。再帰は continuousDeltaSafe (candidates) の _inContinuousDelta guard が depth-2 で 0 化し終端。
  // BUG-157 (2026-06-27): ap/lp と対称に guard 経由へ統一 (旧 local 直呼びは無 guard entry だった)。
  const modContinuous = continuousDeltaSafe(s, uid, 'lvlDelta');
  return base + modPermanent + modTurn + modContact + modAction + modContinuous;
}

function colors(s: GameState, uid: string): string[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  const d = def.card(char.cardId);
  return d?.colors ?? [];
}

// engine additive wave-6 (2026-07-01, P37): 継続的 trait/name 付与の board reader (self-scope)。
// 自身の type:'continuous' ability の continuousModifier.grantTraits/grantNames を、ability.condition
// (【自分ターン中】等) 成立 + (PA-MR は scope on-partner-area/always のみ) の下で集める。grantKeywords の
// continuous walk (keywords() 上部 fromContinuous) と同経路。付与は現場/PA の board char のみ (owner 不在時 [])。
// re-entry guard は traitNameGrantSafe (candidates.ts) が担う (継続 condition が candidates を呼んでも depth-2 終端)。
// 既存カード未宣言 → [] (回帰0)。matchOneFilter/traits/names/bond の全 honor が本関数の結果を印字に union する。
function grantWalk(s: GameState, uid: string, which: 'grantTraits' | 'grantNames'): string[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  const d = def.card(char.cardId);
  if (!d) return [];
  const owner = ownerSideOf(s, uid);
  if (!owner) return [];
  const inPA = isPartnerMrUid(uid);
  const ctx = { source: { player: owner, uid, area: inPA ? 'partner-area' : 'scene' }, bindings: {} } as EffectCtx;
  const out: string[] = [];
  for (const ability of d.abilities ?? []) {
    if (ability.type !== 'continuous') continue;
    if (inPA && !scopeActiveInPartnerArea(ability.scope)) continue;
    const g = ability.continuousModifier?.[which];
    if (!g || g.length === 0) continue;
    if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
    out.push(...g);
  }
  return out;
}

// 複数名カード対応 (rules: 19-special-rules.md — &, 『』, () で分割名を持つ)
// wave-6 (P37): 印字 ∪ granted (grantNames、「〚カード名[X]〛としても扱う」B07053/B05012)。
function names(s: GameState, uid: string): string[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  // mega-wave W6 step2 (2026-07-04, row 999 item2 / PR105): nameOverride turnEffect は **完全置換**
  // (rules/19 Q&A「元のカード名は持っていない扱い」— grantNames の union 方式とは意図的に別ロジック)。
  // 空文字は未設定扱い (DeclareCardNameModal 空 submit 防御)。clearTurnEffects('turn') で失効。
  const override = char.turnEffects['nameOverride'] as string | undefined;
  if (override) return [override];
  const printed = def.card(char.cardId)?.names ?? [];
  const granted = traitNameGrantSafe(s, uid, 'grantNames');
  return granted.length > 0 ? [...new Set([...printed, ...granted])] : printed;
}

// wave-6 (P37): 印字 ∪ granted (grantTraits、「〚特徴[X]〛を持つ」B08063/B05012)。
function traits(s: GameState, uid: string): string[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  const printed = def.card(char.cardId)?.traits ?? [];
  const granted = traitNameGrantSafe(s, uid, 'grantTraits');
  // engine A1 wave (2026-07-11, B05101): applied trait 付与/剥奪 (mutate.char.grantTrait/revokeTrait)。
  // keywords() の grantedKeywords/revokedKeywords 経路と同型。'_permanent' はターン終了で切れない
  // (「〚特徴[警察]〛を失い、〚特徴[探偵]〛を持つ（ターン終了時に切れない）」B05101)、'_turn' は
  // clearTurnEffects('turn') で失効。revoked は **印字 + continuous grant 双方** から減算 (B05101 の
  // 「〚特徴[警察]〛と〚[警視庁]〛を失い」= 印字 trait の剥奪)。既存カード未宣言 → 全 [] (回帰0)。
  const te = char.turnEffects;
  const grantedApplied = [
    ...((te['grantedTraits_permanent'] as string[] | undefined) ?? []),
    ...((te['grantedTraits_turn'] as string[] | undefined) ?? []),
  ];
  const revoked = [
    ...((te['revokedTraits_permanent'] as string[] | undefined) ?? []),
    ...((te['revokedTraits_turn'] as string[] | undefined) ?? []),
  ];
  const unioned = [...new Set([...printed, ...granted, ...grantedApplied])];
  return revoked.length > 0 ? unioned.filter(t => !revoked.includes(t)) : unioned;
}

// keywords: granted + 元能力 (disabledOriginal の場合は元抜き)
// rules: 19-special-rules.md (元の能力を無効にする), 18-mr.md (MR能力は無効にならない)
function keywords(s: GameState, uid: string): string[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  const granted = char.keywordOverrides.granted;
  // BUG-092: scope='turn'/'contact' の付与キーワード (mutate.char.grantKeyword) は
  // turnEffects['grantedKeywords'] に積まれる。これを統合しないと突撃[事件]等の turn-scope 付与が
  // namedExceptionAllowed (突撃/迅速 の名乗り例外判定) 等で読まれず無効だった。
  // turn-scope の付与も「外部から与えられた能力」なので disabledOriginal でも残す (rules/19)。
  const turnGranted = (char.turnEffects['grantedKeywords'] as string[] | undefined) ?? [];
  // engine additive (2026-06-29): ターン終了時まで印字キーワードを失う (「ターン終了時までこのキャラは
  // 〚突撃[キャラ]〛を失う」B06068)。charRevokeKeyword scope:'turn' が turnEffects['revokedKeywords'] へ積む。
  // ⚠ 減算対象は **印字 (base CardDef.keywords) + continuous (自身の grantKeywords) のみ**。granted / turnGranted
  // (外部カードからの付与) は減算しない — 公式 B06068 Q&A「失った後に他カードの能力/効果で 突撃[キャラ] を
  // 再付与された場合はアクション[キャラ]を行える」= 外部付与は「失う」効果と独立に重なる (再付与で復活)。
  // 不在時 [] = 減算なし (既存カードは未宣言 → 回帰0)。clearTurnEffects('turn') で清掃。rules/19 §「失う」効果。
  const revoked = (char.turnEffects['revokedKeywords'] as string[] | undefined) ?? [];
  // engine additive (2026-06-29c): on-set-host rider keyword grant (装備イベント、B02013 〚突撃〛付与)。
  // faceUp でセットされたカード def の scope:'on-set-host' continuous grantKeywords を host に付与する。
  // rider は **他カードによる付与** = 外部 grant 扱い → disabledOriginal でも残り (rules/19 §他カードの付与は無効化されない)、
  // revoked (印字/自前 continuous の「失う」) の減算対象外 (granted/turnGranted と同じ外部由来)。faceDown は除外 (rules/16)。
  const fromSetHost: string[] = [];
  {
    const ownerForSet = ownerSideOf(s, uid);
    if (ownerForSet) {
      const setCtx = { source: { player: ownerForSet, uid } } as Parameters<typeof evalCond>[2];
      for (const entry of char.setCards ?? []) {
        if (!entry.faceUp) continue;
        const sd = def.card(entry.cardId);
        if (!sd) continue;
        for (const ability of sd.abilities ?? []) {
          if (ability.type !== 'continuous') continue;
          if (ability.scope !== 'on-set-host') continue;
          const grantFn = ability.continuousModifier?.grantKeywords;
          if (!grantFn) continue;
          if (ability.condition && !evalCond(s, ability.condition, setCtx)) continue;
          const kws = grantFn(s, { uid });
          if (Array.isArray(kws)) fromSetHost.push(...kws);
        }
      }
    }
  }
  if (char.keywordOverrides.disabledOriginal) {
    // 元の CardDef キーワードと continuous ability の grantKeywords は除外 (rules/19)
    // granted は外部から与えられたキーワードなので残る (rules/19 §他のカード能力/効果による付与は無効にならない)。
    // disabledOriginal では base/continuous (= 減算対象) が既に除外済 → external grant に revoke は及ばない (再付与は独立)。
    // fromSetHost (装備リダー) も外部付与ゆえ残す。
    return [...new Set([...granted, ...turnGranted, ...fromSetHost])];
  }
  const d = def.card(char.cardId);
  // 印字キーワードから revoked を減算 (「失う」効果。外部 grant は下段で union するため独立に復活しうる)。
  const base: string[] = ((d as { keywords?: string[] } | undefined)?.keywords ?? []).filter(kw => !revoked.includes(kw));

  // BUG-030 修正: scene 上の continuous + grantKeywords ability を resolve
  // rules/24 §常時有効型: 条件成立中は自動的に効果あり / 条件外で即失効
  // rules/13 §キーワード能力 + rules/17 §条件を満たしていない場合 → 能力を持っていない扱い
  const fromContinuous: string[] = [];
  if (d) {
    // owner side を解決 (scene + PA-MR slot)。PA-MR は scope on-partner-area/always のみ有効。
    const owner = ownerSideOf(s, uid);
    const inPA = isPartnerMrUid(uid);

    if (owner) {
      const ctx = { source: { player: owner, uid } } as Parameters<typeof evalCond>[2];
      for (const ability of d.abilities ?? []) {
        if (ability.type !== 'continuous') continue;
        if (inPA && !scopeActiveInPartnerArea(ability.scope)) continue;
        const grantFn = ability.continuousModifier?.grantKeywords;
        if (!grantFn) continue;
        if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
        const kws = grantFn(s, { uid });
        if (Array.isArray(kws)) fromContinuous.push(...kws);
      }
    }
  }

  // continuous (自身の grantKeywords) も revoked を減算 (印字と同じ「自前」由来)。granted/turnGranted/fromSetHost は外部付与ゆえ非減算。
  const fromContinuousKept = fromContinuous.filter(kw => !revoked.includes(kw));
  return [...new Set([...base, ...granted, ...turnGranted, ...fromContinuousKept, ...fromSetHost])];
}

function hasKeyword(s: GameState, uid: string, kw: string): boolean {
  return keywords(s, uid).includes(kw);
}

/**
 * engine拡張 wave#2 cluster5 (2026-06-14): 相手への使用制限 aura の board-scan reader。
 * ownerSide の現場 (scene) にある type:'continuous' ability で continuousModifier.opponentRestrict が
 * token を含み、かつ ability.condition を owner ctx で満たすものが1つでもあれば true。
 * BUG-030 の grantKeywords walk (keywords() 上部) と同じ continuous + 条件評価経路を board-level に拡張
 * (rules/24 §常時有効型: 条件成立中のみ有効・条件外で即失効 / rules/17 §条件未達=能力を持っていない扱い)。
 * 不在時 false (既存カードは opponentRestrict 未宣言 → no-op、smoke baseline 不変)。
 * @param ownerSide aura を所有する側 (= 制限される側の "相手")。canCutIn/disguise 側は other = opp-of-actor を渡す。
 */
function restrictsOpponent(s: GameState, ownerSide: 'self' | 'opp', token: 'cutin' | 'disguiseTrigger' | 'refreshEvidence' | 'hirameki' | 'stunAutoActivate'): boolean {
  // bearer = 現場キャラ + PA 常駐 MR (rules/18 PA でも有効)。PA-MR は scope on-partner-area/always のみ。
  const bearers: Array<{ char: { cardId: string; uid: string }; inPA: boolean }> =
    s.players[ownerSide].scene.map(c => ({ char: c, inPA: false }));
  const slotMr = s.players[ownerSide].partnerAreaMR;
  if (slotMr) bearers.push({ char: slotMr, inPA: true });
  // mega-wave W6 step5 (2026-07-04, r74/B03046): パートナーカード自身の印字 continuous も bearer に
  // 合成する (「相手の現場にいるスタン状態のキャラはオートフェイズにアクティブにならない」= パートナー
  // 印字 aura)。生存条件 = location==='partner-area' かつ cardId 設定済 (アシスト中 file-area /
  // mr-removed は不成立 — scene-bearer の「in-play zone に居る限り有効」からの類推、公式Q&A 未確認の
  // 設計判断)。uid は sentinel (condition kind は ctx.source.player のみ参照、cond/eval 確認済)。
  // 既存 4 token は現行出荷済 partner def が opponentRestrict 未宣言のため回帰 0。
  const partnerCard = s.players[ownerSide].partner;
  if (partnerCard.cardId && partnerCard.location === 'partner-area') {
    bearers.push({ char: { cardId: partnerCard.cardId, uid: `partner:${ownerSide}` }, inPA: false });
  }
  for (const { char: c, inPA } of bearers) {
    const d = def.card(c.cardId);
    if (!d) continue;
    const ctx = { source: { player: ownerSide, uid: c.uid } } as Parameters<typeof evalCond>[2];
    for (const ability of d.abilities ?? []) {
      if (ability.type !== 'continuous') continue;
      if (inPA && !scopeActiveInPartnerArea(ability.scope)) continue;
      if (!ability.continuousModifier?.opponentRestrict?.includes(token)) continue;
      if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
      return true;
    }
  }
  return false;
}

/**
 * Task D E4 (2026-06-12): 非キーワードテキスト能力 token の統一 reader。
 * 「相手の現場にいるアクティブ状態のキャラを指定してアクションできる」(actionTargetsActive) /
 * 「スリープ状態でもガードできる」(sleepGuard) / 「コンタクトによってリムーブされない」(contactImmune) 等を
 * 2 チャネルで判定する:
 *  1. turnEffects flag — charSetTurnEffect で付与 (素 / '_oppTurn' / '_action' duration suffix)
 *  2. 'text:' 擬似キーワード — 印字常時条件型 (B09028) は continuousModifier.grantKeywords が
 *     'text:<token>' を返す。keywords() 経由なので rules/19 (元の能力無効) と自動整合。
 * rules: 13-keywords.md, 24-qa-naming-stun.md §常時有効型
 */
const TEXT_TOKEN_SUFFIXES = ['', '_oppTurn', '_action'] as const;
function hasTextAbility(s: GameState, uid: string, token: string): boolean {
  const c = scene.byUid(s, uid);
  if (!c) return false;
  for (const suf of TEXT_TOKEN_SUFFIXES) {
    if (c.turnEffects[token + suf] === true) return true;
  }
  return keywords(s, uid).includes('text:' + token);
}

function state(s: GameState, uid: string): 'active' | 'sleep' | 'stun' {
  const char = scene.byUid(s, uid);
  return char?.state ?? 'sleep';
}

function isNamed(s: GameState, uid: string): boolean {
  const char = scene.byUid(s, uid);
  return char?.isNamed ?? false;
}

// setCards: 互換性のため CardId[] を返す (cardId のみ)
// 詳細情報が必要な場合は setCardsDetailed を使用 (rules: 16-card-set.md)
function setCards(s: GameState, uid: string): CardId[] {
  const char = scene.byUid(s, uid);
  return (char?.setCards ?? []).map(e => e.cardId);
}

// setCardsDetailed: {cardId, faceUp}[] を返す (rules: 16-card-set.md 裏向き情報付き)
function setCardsDetailed(s: GameState, uid: string): SetCardEntry[] {
  const char = scene.byUid(s, uid);
  return char?.setCards ?? [];
}

function stackedCount(s: GameState, uid: string): number {
  const char = scene.byUid(s, uid);
  return char ? (Array.isArray(char.stackedCards) ? char.stackedCards.length : char.stackedCards) : 0;
}

// turnEffect: SceneCharacter.turnEffects から任意のキーを取得
function turnEffect(s: GameState, uid: string, key: string): unknown {
  const char = scene.byUid(s, uid);
  if (!char) return undefined;
  return char.turnEffects[key];
}

// 宣言能力の使用回数 (rules: 15-abilities-effects.md 【ターン①】)
function declaredUseCount(s: GameState, uid: string, abilityId: string): number {
  // BUG-067: 事件カード (case:self / case:opp) の declared ability にも対応
  // BUG-085: declaredUseCount は BUG-067 で後から case 型に追加されたため、それ以前
  //   形状の state (一部 fixture / 旧 serialize) では未定義のことがある。canDeclaredAbility
  //   経由で AI/UI が case 宣言能力を列挙する際 (BUG-084) に未定義参照で throw していたので、
  //   optional chaining で 0 (= 未使用) に倒す。
  if (uid === 'case:self' || uid === 'case:opp') {
    const p = uid === 'case:self' ? 'self' : 'opp';
    return s.players[p].case.declaredUseCount?.[abilityId] ?? 0;
  }
  const char = scene.byUid(s, uid);
  if (char) return char.declaredUseCount?.[abilityId] ?? 0;
  // BUG-112: off-board uid (selfToDeckBottom 等でコスト支払い時に scene 離脱) は
  // player 単位 turnState.declaredAbilityUseCount[uid:abilId] に fallback 記録される。
  // uid は両 player 通じて一意なので self/opp 双方を参照。
  const key = `${uid}:${abilityId}`;
  for (const p of ['self', 'opp'] as const) {
    const rec = s.turnState[p].declaredAbilityUseCount as Record<string, number> | undefined;
    const v = rec?.[key];
    if (typeof v === 'number') return v;
  }
  return 0;
}

// engine mega-wave W4 (2026-07-03, r62 G32): filter 付き突撃 grant の走査 (B07096「突撃[レベル4以下の
// キャラ]」)。keywords() の fromContinuous walk と同型 (continuous + inPA scope gate + ability.condition
// honor、rules/24 常時型)。fromSetHost/revoked/turnGranted 相当は consumer 無し = YAGNI 省略 (rider 型の
// filtered-突撃 が出たら追加)。消費は flow/main/action.ts namedExceptionAllowed。
function filteredAssaultKeywords(s: GameState, uid: string): FilteredAssaultGrant[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  const d = def.card(char.cardId);
  if (!d) return [];
  const owner = ownerSideOf(s, uid);
  if (!owner) return [];
  const inPA = isPartnerMrUid(uid);
  const out: FilteredAssaultGrant[] = [];
  const ctx = { source: { player: owner, uid } } as Parameters<typeof evalCond>[2];
  for (const ability of d.abilities ?? []) {
    if (ability.type !== 'continuous') continue;
    if (inPA && !scopeActiveInPartnerArea(ability.scope)) continue;
    const grants = ability.continuousModifier?.grantFilteredAssault;
    if (!Array.isArray(grants) || grants.length === 0) continue;
    if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
    out.push(...grants);
  }
  return out;
}

// engine mega-wave W4 (2026-07-03, r1 P01 protection rider): 対象キャラ自身が token の対キャラ保護を
// 持つか (B05041「このイベントがセットされているキャラは、相手の能力や効果によってリムーブされず、
// スリープされず、スタンされない」)。per-target — restrictsOpponent (board-wide、player-level 制限) と
// 別経路。走査 = ①自身の continuous abilities ②faceUp setCards の scope 'on-set-host' rider
// (P01 gate#3 解禁: continuousDelta/keywords rider と同型の setCards walk)。ability.condition honor。
// 消費は atomSceneRemove/atomSceneSetState の相手発 effect gate のみ (公式Q&A: 選ぶことは妨げない /
// コンタクト除去・スイッチ・デッキ下移動は妨げない → mutation 直前 narrow-gate)。
function charProtectedFrom(s: GameState, uid: string, token: 'remove' | 'sleep' | 'stun'): boolean {
  const c = scene.byUid(s, uid);
  if (!c) return false;
  const owner = ownerSideOf(s, uid);
  if (!owner) return false;
  const ctx = { source: { player: owner, uid } } as Parameters<typeof evalCond>[2];
  // ① 自身の印字 continuous
  const d = def.card(c.cardId);
  for (const ability of d?.abilities ?? []) {
    if (ability.type !== 'continuous') continue;
    if (ability.scope === 'on-set-host') continue; // 自身に印字された rider 定義は host 用 — 自分では無効
    if (!ability.continuousModifier?.opponentRestrict?.includes(token)) continue;
    if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
    return true;
  }
  // ② faceUp setCards の on-set-host rider (rules/16: 裏向きセットは能力を持たない)
  for (const entry of c.setCards) {
    if (!entry.faceUp) continue;
    const sd = def.card(entry.cardId);
    for (const ability of sd?.abilities ?? []) {
      if (ability.type !== 'continuous') continue;
      if (ability.scope !== 'on-set-host') continue;
      if (!ability.continuousModifier?.opponentRestrict?.includes(token)) continue;
      if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
      return true;
    }
  }
  return false;
}

export const char = {
  ap,
  lp,
  level,
  colors,
  names,
  traits,
  keywords,
  hasKeyword,
  filteredAssaultKeywords,
  charProtectedFrom,
  charProtectedFromOppEvent,
  restrictsOpponent,
  auraUntargetableByAction,
  charUntargetableByOppEvent,
  charUntargetableByOppEffect,
  noAutoActivateLocked,
  selfContinuousFlag,
  hasTextAbility,
  state,
  isNamed,
  setCards,
  setCardsDetailed,
  stackedCount,
  turnEffect,
  declaredUseCount,
};

// BUG-113: module load 時に continuousDelta を candidates へ登録 (数値フィルタの有効値に反映)。
registerContinuousDelta(continuousDelta);
registerAuraDelta(auraDelta); // cluster13: 他キャラ aura board-scan を candidates へ late-bind
registerTraitNameGrant(grantWalk); // wave-6 (P37): 継続 trait/name 付与 board reader を candidates へ late-bind
