// engine.read.char — キャラ単位派生情報セレクタ (純粋関数)
// rules: 03-field-areas.md (状態), 11-reasoning.md (LP≤0), 13-keywords.md, 19-special-rules.md

import type { GameState, CardId, SetCardEntry, EffectCtx } from '@/engine/types';
import { scene } from './scene.js';
import { def } from './def.js';
import { evalCond } from '../cond/eval.js';
import { evalDyn } from '../dyn/eval.js';
// BUG-113: candidates.ts の数値フィルタへ continuousDelta を late-binding で注入 (静的循環回避)。
// candidates は read/char を import しない (read/keyword/def は leaf) ため本 import は循環を作らない。
import { registerContinuousDelta } from '../target/candidates.js';

// 常時有効型 continuousModifier.apDelta/lpDelta を read 時に再計算・合算する。
// keywords() の grantKeywords walk (BUG-030) と同じ continuous 経路。
// rules/24 §常時有効型: condition 成立中のみ加算、条件外で即失効 → read 毎に evalCond 判定。
// delta は dyn 式 {dyn} (evalDyn) / 定数 / closure の3形 (card-def.ts ContinuousDelta)。
function continuousDelta(s: GameState, uid: string, which: 'apDelta' | 'lpDelta'): number {
  const char = scene.byUid(s, uid);
  if (!char) return 0;
  const d = def.card(char.cardId);
  if (!d) return 0;
  // owner side 解決 (scene.byUid は side を返さないので inline、keywords() と同じ)
  const owner: 'self' | 'opp' | null = s.players.self.scene.some(c => c.uid === uid)
    ? 'self'
    : s.players.opp.scene.some(c => c.uid === uid)
      ? 'opp'
      : null;
  if (!owner) return 0;
  const ctx = { source: { player: owner, uid, area: 'scene' }, bindings: {} } as EffectCtx;
  let total = 0;
  for (const ability of d.abilities ?? []) {
    if (ability.type !== 'continuous') continue;
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
  return total;
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
  const base = char.apOverride !== null ? char.apOverride : (def.card(char.cardId)?.ap ?? 0);
  const modPermanent = (char.turnEffects['apMod_permanent'] as number | undefined) ?? 0;
  const modTurn      = (char.turnEffects['apMod_turn']      as number | undefined) ?? 0;
  const modContact   = (char.turnEffects['apMod_contact']   as number | undefined) ?? 0;
  const modContinuous = continuousDelta(s, uid, 'apDelta');
  return base + modPermanent + modTurn + modContact + modContinuous;
}

// LP: lpOverride 優先 / 不在なら CardDef.lp、加えて turnEffects['lpMod_*'] を合算
// rules: 19-special-rules.md (下限なし), 11-reasoning.md (LP≤0 で証拠0枚)
function lp(s: GameState, uid: string): number {
  const char = scene.byUid(s, uid);
  if (!char) return 0;
  const base = char.lpOverride !== null ? char.lpOverride : (def.card(char.cardId)?.lp ?? 0);
  const modPermanent = (char.turnEffects['lpMod_permanent'] as number | undefined) ?? 0;
  const modTurn      = (char.turnEffects['lpMod_turn']      as number | undefined) ?? 0;
  const modContact   = (char.turnEffects['lpMod_contact']   as number | undefined) ?? 0;
  const modContinuous = continuousDelta(s, uid, 'lpDelta');
  return base + modPermanent + modTurn + modContact + modContinuous;
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
  return base + modPermanent + modTurn + modContact;
}

function colors(s: GameState, uid: string): string[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  const d = def.card(char.cardId);
  return d?.colors ?? [];
}

// 複数名カード対応 (rules: 19-special-rules.md — &, 『』, () で分割名を持つ)
function names(s: GameState, uid: string): string[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  const d = def.card(char.cardId);
  return d?.names ?? [];
}

function traits(s: GameState, uid: string): string[] {
  const char = scene.byUid(s, uid);
  if (!char) return [];
  const d = def.card(char.cardId);
  return d?.traits ?? [];
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
  if (char.keywordOverrides.disabledOriginal) {
    // 元の CardDef キーワードと continuous ability の grantKeywords は除外 (rules/19)
    // granted は外部から与えられたキーワードなので残る (rules/19 §他のカード能力/効果による付与は無効にならない)
    return [...new Set([...granted, ...turnGranted])];
  }
  const d = def.card(char.cardId);
  const base: string[] = (d as { keywords?: string[] } | undefined)?.keywords ?? [];

  // BUG-030 修正: scene 上の continuous + grantKeywords ability を resolve
  // rules/24 §常時有効型: 条件成立中は自動的に効果あり / 条件外で即失効
  // rules/13 §キーワード能力 + rules/17 §条件を満たしていない場合 → 能力を持っていない扱い
  const fromContinuous: string[] = [];
  if (d) {
    // owner side を解決 (scene.byUid は side を返さないので inline)
    const owner: 'self' | 'opp' | null = s.players.self.scene.some(c => c.uid === uid)
      ? 'self'
      : s.players.opp.scene.some(c => c.uid === uid)
        ? 'opp'
        : null;

    if (owner) {
      const ctx = { source: { player: owner, uid } } as Parameters<typeof evalCond>[2];
      for (const ability of d.abilities ?? []) {
        if (ability.type !== 'continuous') continue;
        const grantFn = ability.continuousModifier?.grantKeywords;
        if (!grantFn) continue;
        if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
        const kws = grantFn(s, { uid });
        if (Array.isArray(kws)) fromContinuous.push(...kws);
      }
    }
  }

  return [...new Set([...base, ...granted, ...turnGranted, ...fromContinuous])];
}

function hasKeyword(s: GameState, uid: string, kw: string): boolean {
  return keywords(s, uid).includes(kw);
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
  return char?.stackedCards ?? 0;
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

export const char = {
  ap,
  lp,
  level,
  colors,
  names,
  traits,
  keywords,
  hasKeyword,
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
