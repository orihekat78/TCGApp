// engine.effect.runAtom — Atom Verb dispatcher
// spec: .claude/specs/engine-api-effect-descriptor.md
// rules: 15-abilities-effects.md and others (per verb)
//
// 設計メモ:
//   - 各 Atom Verb は engine.mutate.* プリミティブの薄いラッパー
//   - 引数は AtomArgs (verb 毎に異なる shape) → unknown 受け取り内部で narrow
//   - 全ての mutate 呼び出しは Immer draft 前提 (produce 内で呼ぶこと)
//   - charSetAP / charSetLP は Phase 5 まで未サポート (throw)。
//     charOverrideAP/LP (rules/19: 「元のAPを X にする」) のみ setOverrideAP/LP にマップ。
//   - startContact / endActionEarly は Phase 3 では log のみ。Phase 4 フローで本実装
//   - deckRevealUntil の binding shape: Candidate { kind: 'card', cardId, area: 'deck', player }

import type { GameState, AtomVerb, EffectCtx, LogEntry, FileCard, Candidate } from '../types/index.js';
import type { TargetFilter } from '../types/effect.js';
import { FILE_CARD_BACK_PLACEHOLDER } from '../types/index.js';
import { mutate } from '../mutate/index.js';
import { event } from '../event/index.js';
import { cards as engineCards } from '../cards/index.js';
import { tryRePickFromAtom } from './resolve-picks.js';

// user_request 20260522_01 #12 BUG-061: deckRevealUntil UI 演出側チャネル
// (side-channel-pattern.md 4 点 checklist 準拠)
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
};

export function _drainPendingDeckRevealSide(): PendingDeckRevealSide | null {
  const v = (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | null }).__pendingDeckRevealSide ?? null;
  (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | null }).__pendingDeckRevealSide = null;
  return v;
}

/**
 * BUG-045 (#9 spectator stall fix の副産物): deckRevealUntil 等で
 * TargetFilter (declarative object) を predicate に変換するヘルパ。
 * src/engine/target/candidates.ts matchOneFilter の cardId-based subset。
 * 対応: cardId / color / trait / levelMin/Max / kind ('character' | 'event')。
 */
function targetFilterToPredicate(filter: TargetFilter | undefined): (cardId: string) => boolean {
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
    if (filter.trait !== undefined) {
      const wants = Array.isArray(filter.trait) ? filter.trait : [filter.trait];
      if (!wants.some(w => d.traits?.includes(w))) return false;
    }
    if (filter.levelMin !== undefined && (d.level ?? 0) < filter.levelMin) return false;
    if (filter.levelMax !== undefined && (d.level ?? Infinity) > filter.levelMax) return false;
    const kind = (filter as TargetFilter & { kind?: string }).kind;
    if (kind !== undefined) {
      const want = kind === 'character' ? 'character' : kind === 'event' ? 'event' : null;
      if (want && d.kind !== want) return false;
    }
    return true;
  };
}

type Player = 'self' | 'opp';

/**
 * 必須スカラーフィールドの実行時検証。
 * 呼び出し元が typo などで undefined を渡した場合に mutate 層へ伝搬する前に検知する。
 * optional フィールド・nullable フィールドはここでは検証しない。
 */
function requireField<T>(args: Record<string, unknown>, key: string, kind: 'string' | 'number' | 'boolean' | 'object'): T {
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
function resolveBindRef(value: unknown, ctx: EffectCtx): unknown {
  if (typeof value !== 'string') return value;
  if (!value.startsWith('$')) return value;
  const dot = value.indexOf('.');
  if (dot < 0) return value;
  const key = value.slice(1, dot);
  const field = value.slice(dot + 1);
  const binding = (ctx.bindings as Record<string, unknown>)[key];
  if (!Array.isArray(binding) || binding.length === 0) return value;
  const first = binding[0] as Record<string, unknown>;
  const fieldVal = first[field];
  return fieldVal ?? value;
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
function normalizeTargetToString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  return undefined;
}

export function runAtom(s: GameState, verb: AtomVerb, args: unknown, ctx: EffectCtx): void {
  const a = args as Record<string, unknown>;
  switch (verb) {
    // --- ドロー / FILE / 証拠 ---
    case 'draw': {
      // BUG-072: deck.draw が手札への push まで内部で行う + effect 経由の draw を log に残す
      const drawPlayer = requireField<Player>(a, 'player', 'string');
      const drawN = requireField<number>(a, 'n', 'number');
      mutate.deck.draw(s, drawPlayer, drawN);
      mutate.log.append(s, {
        ts: Date.now(),
        player: drawPlayer,
        turn: s.turn.number,
        action: 'effect:draw',
        result: String(drawN),
      });
      return;
    }
    case 'discard': {
      // BUG-065 (本格対応) で resolve-picks.ts が pattern B (uid なし + target.kind='pick')
      // の解決をサポート。ここに到達した時点で a.target は string[] のはず。
      // BUG-071: pre-pick step (例: D08015 a1 step 1 draw) 実行のため、triggered
      // listener の queue skip を廃止 → human pick 待ちの atom はここで no-op skip。
      // BUG-072: skip 時の action 名を 'effect:discard:awaiting-pick' に変更し
      // UI で「効果: 手札選択待ち」と日本語表示できるよう mapping 追加。
      // BUG-076: awaiting-pick 時に tryRePickFromAtom で side-channel 再 set (連続 pick)
      if (!Array.isArray(a.target)) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, { byPlayer: a.player as Player, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, {
          ts: Date.now(),
          player: a.player as Player,
          turn: s.turn.number,
          action: 'effect:discard:awaiting-pick',
        });
        return;
      }
      const target = a.target as string[];
      mutate.hand.discardToRemove(s, a.player as Player, target);
      // BUG-072: effect 経由の discard 成功も log に残す
      mutate.log.append(s, {
        ts: Date.now(),
        player: a.player as Player,
        turn: s.turn.number,
        action: 'effect:discard',
        result: String(target.length),
      });
      return;
    }
    case 'mill': {
      // BUG-073: effect log
      const millP = a.player as Player;
      const millN = a.n as number;
      mutate.deck.removeFromTop(s, millP, millN);
      mutate.log.append(s, { ts: Date.now(), player: millP, turn: s.turn.number, action: 'effect:mill', result: String(millN) });
      return;
    }
    case 'fileAdd': {
      // BUG-073: effect log
      const faP = a.player as Player;
      const faN = a.n as number;
      mutate.file.addFromDeckTop(s, faP, faN);
      mutate.log.append(s, { ts: Date.now(), player: faP, turn: s.turn.number, action: 'effect:fileAdd', result: String(faN) });
      return;
    }
    case 'filePopToHand': {
      const p = a.player as Player;
      const popped: FileCard | undefined = mutate.file.popTop(s, p);
      // 裏向き card-back は手札に戻すとき "card-back" として加える (リバース不能なシリアライズ)
      // assisted-partner は popTop が除外するためここでは card-back のみ
      if (popped) {
        const cardId = popped.type === 'assisted-partner' ? popped.cardId : FILE_CARD_BACK_PLACEHOLDER;
        mutate.hand.add(s, p, [cardId]);
      }
      // BUG-073: effect log (popped が無い場合も log には残す)
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:filePopToHand' });
      return;
    }
    case 'evidenceGain': {
      const p = a.player as Player;
      const n = a.n as number;
      mutate.evidence.addFromDeck(s, p, n, false, { turn: s.turn.number, via: 'effect' });
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceGain', result: String(n) });
      return;
    }
    case 'evidenceLose': {
      const p = a.player as Player;
      const n = a.n as number;
      let lost = 0;
      for (let i = 0; i < n; i++) {
        const removed = mutate.evidence.removeTop(s, p);
        if (!removed) break;
        lost++;
      }
      // BUG-073: effect log (実際にロストした枚数を記録)
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceLose', result: String(lost) });
      return;
    }
    case 'evidenceFlip': {
      const efP = a.player as Player;
      const efIdx = a.idx as number;
      mutate.evidence.flipFaceUp(s, efP, efIdx);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: efP, turn: s.turn.number, action: 'effect:evidenceFlip', target: String(efIdx) });
      return;
    }
    // --- 証拠 / 手札 (G25/G30) ---
    case 'evidenceToHand': {
      // BUG-074: BUG-065 で resolve-picks が target を array 化 (`[cardId]`) する設計に
      // 変更されたため、string|array 両対応に正規化。未解決の pick query object の場合は
      // awaiting-pick として skip + log (D08013 a1 step 2 等で発覚)。
      // BUG-076: awaiting-pick 時に resolve-picks の tryRePickFromAtom を呼んで、
      // 残り atom 用に side-channel を再 set。これで sequence 内の連続 pattern B atom
      // が順次 modal を出せる (D08013 a1 step 2 → step 3 の連鎖)。
      const p = a.player as Player;
      const target = normalizeTargetToString(a.target);
      if (!target) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, { byPlayer: p, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceToHand:awaiting-pick' });
        return;
      }
      const list = s.players[p].evidence;
      const idx = list.findIndex(e => e.cardId === target);
      let moved = false;
      if (idx !== -1) {
        list.splice(idx, 1);
        mutate.hand.add(s, p, [target]);
        moved = true;
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceToHand', target, result: moved ? 'ok' : 'not-found' });
      return;
    }
    case 'handAddFromRemove': {
      // BUG-074: 同じく string|array 両対応に正規化
      // BUG-076: awaiting-pick 時に tryRePickFromAtom で side-channel 再 set
      const p = a.player as Player;
      const target = normalizeTargetToString(a.target);
      if (!target) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, { byPlayer: p, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove:awaiting-pick' });
        return;
      }
      const rem = s.players[p].remove;
      const idx = rem.indexOf(target);
      let moved = false;
      if (idx !== -1) {
        rem.splice(idx, 1);
        mutate.hand.add(s, p, [target]);
        moved = true;
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', target, result: moved ? 'ok' : 'not-found' });
      return;
    }

    // --- 現場 ---
    case 'sceneEnter': {
      // 効果による登場 (atom verb 駆動) は viaEffect=true がデフォルト。
      // ただし args に明示があれば尊重する (テスト・特殊呼出用)。
      const viaEffect = (a.viaEffect as boolean | undefined) ?? true;
      // user_request 20260522_01 #12 fix: $matched.cardId 等の bind ref を解決
      // (D11019 deckRevealUntil → sceneEnter sequence で必要)
      const rawCardId = requireField<string>(a, 'cardId', 'string');
      const cardId = resolveBindRef(rawCardId, ctx) as string;
      if (typeof cardId !== 'string' || cardId.startsWith('$')) {
        // 未解決の bind ref → no-op skip (BUG-048 と同 pattern)
        return;
      }
      const enterPlayer = requireField<Player>(a, 'player', 'string');
      const newChar = mutate.scene.enter(s, enterPlayer, cardId, {
        named: (a.named as boolean | undefined) ?? false,
        viaEffect,
      });
      // user_request 20260522_01 #12 fix: 新 uid を $matched に書き戻し、
      // 後続 atom (charGrantKeyword 等) が `$matched.uid` で参照できるよう
      // する。元 binding の cardId は維持しつつ uid を上書き。
      const bindKey = '$matched'.slice(1); // 'matched'
      const existing = (ctx.bindings as Record<string, unknown>)[bindKey];
      if (Array.isArray(existing) && existing.length > 0) {
        const entry = existing[0] as Record<string, unknown>;
        entry.uid = newChar.uid;
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: enterPlayer, turn: s.turn.number, action: 'effect:sceneEnter', target: cardId });
      // rules/17 — 現場登場時 Hook (【登場時】・【疾風 N】判定)
      event.emit(s, 'enter', {
        uid: newChar.uid,
        viaEffect,
        enterOrder: newChar.enterOrder,
      }, ctx.source);
      return;
    }
    case 'sceneSwitch': {
      const viaEffect = (a.viaEffect as boolean | undefined) ?? true;
      const swPlayer = a.player as Player;
      const swCardId = a.cardId as string;
      const newChar = mutate.scene.switchEnter(s, swPlayer, swCardId, a.removeUid as string, {
        named: (a.named as boolean | undefined) ?? false,
        viaEffect,
      });
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: swPlayer, turn: s.turn.number, action: 'effect:sceneSwitch', target: swCardId });
      // スイッチ登場も rules/17 上「登場」として enter Hook が発火する
      event.emit(s, 'enter', {
        uid: newChar.uid,
        viaEffect,
        enterOrder: newChar.enterOrder,
      }, ctx.source);
      return;
    }
    case 'sceneRemove': {
      type RemoveCause = 'contact-ap' | 'effect' | 'switch' | 'cost' | 'misplay-overflow';
      const srUid = a.uid as string;
      mutate.scene.removeToRemove(s, srUid, (a.cause as RemoveCause) ?? 'effect');
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneRemove', target: srUid });
      return;
    }
    case 'sceneSetState': {
      const ssUid = a.uid as string;
      const ssState = a.state as 'active' | 'sleep' | 'stun';
      mutate.scene.setState(s, ssUid, ssState);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneSetState', target: ssUid, result: ssState });
      return;
    }
    case 'sceneDisguise': {
      const dgUid = a.uid as string;
      const dgNewCardId = a.newCardId as string;
      mutate.char.disguiseInto(s, dgUid, dgNewCardId);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneDisguise', target: dgUid, result: dgNewCardId });
      return;
    }

    // --- キャラ修正 ---
    case 'charModifyAP': {
      const maUid = a.uid as string;
      const maDelta = a.delta as number;
      const maScope = a.scope as 'turn' | 'contact' | 'permanent';
      mutate.char.modifyAP(s, maUid, maDelta, maScope);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyAP', target: maUid, result: `${maDelta >= 0 ? '+' : ''}${maDelta}/${maScope}` });
      return;
    }
    case 'charModifyLP': {
      const mlUid = a.uid as string;
      const mlDelta = a.delta as number;
      const mlScope = a.scope as 'turn' | 'contact' | 'permanent';
      mutate.char.modifyLP(s, mlUid, mlDelta, mlScope);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLP', target: mlUid, result: `${mlDelta >= 0 ? '+' : ''}${mlDelta}/${mlScope}` });
      return;
    }
    // charSetAP / charSetLP: 「APをXにする」(修正は上乗せ) — rules/19
    // Phase 5 で mutate.char.setExact を定義するまでは未サポート。
    // charOverrideAP / charOverrideLP (「元のAPをXにする」) とは意味が異なるため
    // 誤用を即座に検知できるよう明示的にエラーを投げる。
    case 'charSetAP':
      throw new Error('charSetAP: not yet supported — Phase 5 must define mutate.char.setExact (distinct from setOverride)');
    case 'charSetLP':
      throw new Error('charSetLP: not yet supported — Phase 5 must define mutate.char.setExact');
    case 'charOverrideAP': {
      const oaUid = a.uid as string;
      const oaVal = a.val as number | null;
      mutate.char.setOverrideAP(s, oaUid, oaVal);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charOverrideAP', target: oaUid, result: oaVal === null ? 'reset' : String(oaVal) });
      return;
    }
    case 'charOverrideLP': {
      const olUid = a.uid as string;
      const olVal = a.val as number | null;
      mutate.char.setOverrideLP(s, olUid, olVal);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charOverrideLP', target: olUid, result: olVal === null ? 'reset' : String(olVal) });
      return;
    }
    case 'charGrantKeyword': {
      // user_request 20260522_01 #12 fix: $matched.uid 等の bind ref 解決
      const grantUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof grantUid !== 'string' || grantUid.startsWith('$')) return;
      const grantKw = a.kw as string;
      const grantScope = (a.scope as 'turn' | 'contact' | 'permanent' | undefined) ?? 'permanent';
      mutate.char.grantKeyword(s, grantUid, grantKw, grantScope);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charGrantKeyword', target: grantUid, result: `${grantKw}/${grantScope}` });
      return;
    }
    case 'charRevokeKeyword': {
      const revokeUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof revokeUid !== 'string' || revokeUid.startsWith('$')) return;
      const revokeKw = a.kw as string;
      mutate.char.revokeKeyword(s, revokeUid, revokeKw);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charRevokeKeyword', target: revokeUid, result: revokeKw });
      return;
    }
    case 'charDisableOriginal': {
      const doUid = a.uid as string;
      mutate.char.disableOriginalAbilities(s, doUid);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charDisableOriginal', target: doUid });
      return;
    }
    case 'charSetTurnEffect': {
      const teUid = a.uid as string;
      const teKey = a.key as string;
      mutate.char.setTurnEffect(s, teUid, teKey, a.val);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetTurnEffect', target: teUid, result: `${teKey}=${String(a.val)}` });
      return;
    }
    case 'charSetCard': {
      const scUid = a.uid as string;
      const scCardId = a.cardId as string;
      mutate.char.setCard(s, scUid, scCardId, a.faceUp as boolean);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', target: scUid, result: scCardId });
      return;
    }
    case 'charStackCard': {
      const stUid = a.uid as string;
      const stN = a.n as number;
      mutate.char.stackCard(s, stUid, stN);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charStackCard', target: stUid, result: String(stN) });
      return;
    }

    // --- パートナー / 事件 ---
    case 'partnerAssist': {
      const paP = a.player as Player;
      mutate.partner.assist(s, paP);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: paP, turn: s.turn.number, action: 'effect:partnerAssist' });
      return;
    }
    case 'partnerSetState': {
      const psP = a.player as Player;
      const psState = a.state as 'active' | 'sleep' | 'stun';
      mutate.partner.setState(s, psP, psState);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: psP, turn: s.turn.number, action: 'effect:partnerSetState', result: psState });
      return;
    }
    case 'partnerSolveCase': {
      const scP = a.player as Player;
      mutate.partner.solveCase(s, scP);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: scP, turn: s.turn.number, action: 'effect:partnerSolveCase' });
      return;
    }
    case 'caseToResolved': {
      const p = a.player as Player;
      mutate.case.toResolved(s, p);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:caseToResolved' });
      // rules/01 — 事件編→解決編 移行 Hook (一方通行)。
      // caseResolvedHandRemove 等の事件カード共通能力がここで反応する。
      event.emit(s, 'case:to-resolved', { player: p }, ctx.source);
      return;
    }

    // --- フロー (Phase 3: log のみ。Phase 4 フローで本実装) ---
    case 'startContact': {
      const entry: LogEntry = {
        ts: Date.now(),
        player: ctx.source.player,
        turn: s.turn.number,
        action: 'startContact:placeholder',
      };
      mutate.log.append(s, entry);
      return;
    }
    case 'endActionEarly': {
      const entry: LogEntry = {
        ts: Date.now(),
        player: ctx.source.player,
        turn: s.turn.number,
        action: 'endActionEarly:placeholder',
      };
      mutate.log.append(s, entry);
      return;
    }

    // --- デッキ操作 (G18/G22) ---
    case 'deckRevealUntil': {
      const p = a.player as Player;
      // BUG-045 fix: filter は declarative TargetFilter object として渡される
      // (D11019.ts 等)。predicate 関数化して使用 (旧コードは function を期待していて crash)。
      const filterArg = a.filter as TargetFilter | ((cardId: string) => boolean) | undefined;
      const filter = typeof filterArg === 'function'
        ? filterArg
        : targetFilterToPredicate(filterArg);
      const bindKey = a.bind as string | undefined;
      const bindMatchKey = a.bindMatch as string | undefined;
      const deck = s.players[p].deck;
      const revealed: string[] = [];
      let matched: string | null = null;
      // デッキ上から 1 枚ずつ、filter にマッチしたら停止
      for (const cardId of deck) {
        revealed.push(cardId);
        if (filter(cardId)) {
          matched = cardId;
          break;
        }
      }
      // bindings に Candidate[] として保存
      // { kind: 'card', cardId, area: 'deck', player } は Candidate の card バリアントに適合する
      if (bindKey) {
        const restIds = matched ? revealed.slice(0, -1) : revealed;
        ctx.bindings[bindKey] = restIds.map<Candidate>(id => ({
          kind: 'card',
          cardId: id,
          area: 'deck',
          player: p,
        }));
      }
      if (bindMatchKey) {
        ctx.bindings[bindMatchKey] = matched
          ? [{ kind: 'card', cardId: matched, area: 'deck', player: p }]
          : [];
      }
      // user_request 20260522_01 #12 BUG-061: UI 演出側チャネル
      // `__pendingDeckRevealSide` に revealed/matched を set。後続 atom が
      // 結果を消費する前 (sceneEnter / deckToBottomBound / shuffle 前) の
      // スナップショットとして公開する。
      if (revealed.length > 0) {
        (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | null }).__pendingDeckRevealSide = {
          player: p,
          revealed: [...revealed],
          matched,
        };
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckRevealUntil', result: `revealed=${revealed.length} matched=${matched ?? 'none'}` });
      return;
    }
    case 'deckToBottomBound': {
      const p = a.player as Player;
      const bindKey = a.bindKey as string;
      const bound = ctx.bindings[bindKey];
      if (!bound || bound.length === 0) return;
      // Candidate から cardId を抽出 → デッキ下へ
      const ids = bound.map(c => {
        const cAny = c as unknown as { cardId?: string };
        return cAny.cardId ?? '';
      }).filter(id => id !== '');
      // 元のデッキから該当 ID を除去 (deckRevealUntil で公開された分はまだデッキにある)
      const deck = s.players[p].deck;
      for (const id of ids) {
        const idx = deck.indexOf(id);
        if (idx !== -1) deck.splice(idx, 1);
      }
      mutate.deck.toBottom(s, p, ids);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckToBottomBound', result: String(ids.length) });
      return;
    }
    case 'deckShuffle': {
      // rules/04, 14, 26 — デッキ基本シャッフル (D11019 等で使用)
      const p = a.player as Player;
      mutate.deck.shuffle(s, p, ctx.rng);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckShuffle' });
      return;
    }
    case 'souza': {
      // rules/13 §捜査X: defender (player) のデッキ上 X 枚を、defender の好きな順で
      // デッキの下に移す。Sub-task A (Phase 5 advance): peek 順そのまま (= defender が
      // 順番変更しない default)。AI policy chooseSouzaOrder は将来 Sub-task B/C で
      // listener / dispatcher 経由で呼ぶ予定。「発見された」参照効果は scope 外。
      const player = a.player as Player;
      const x = a.x as number;
      const deck = s.players[player].deck;
      const count = Math.min(x, deck.length);
      if (count === 0) {
        mutate.log.append(s, {
          ts: Date.now(),
          player,
          turn: s.turn.number,
          action: 'souza',
          target: '',
          result: 'no-op (deck empty)',
        });
        return;
      }
      const top = deck.splice(0, count);
      mutate.deck.toBottom(s, player, top);
      mutate.log.append(s, {
        ts: Date.now(),
        player,
        turn: s.turn.number,
        action: 'souza',
        target: '',
        result: `revealed ${count}`,
      });
      return;
    }

    // --- メタ ---
    case 'log': {
      const entry: LogEntry = {
        ts: (a.ts as number | undefined) ?? Date.now(),
        player: (a.player as Player | undefined) ?? ctx.source.player,
        turn: (a.turn as number | undefined) ?? s.turn.number,
        action: (a.action as string | undefined) ?? 'log',
        target: a.target as string | undefined,
        result: a.result as string | undefined,
      };
      mutate.log.append(s, entry);
      return;
    }
    case 'noop':
      return;

    default: {
      // exhaustiveness check
      const _exhaustive: never = verb;
      throw new Error(`unknown atom verb: ${String(_exhaustive)}`);
    }
  }
}
