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

export function runAtom(s: GameState, verb: AtomVerb, args: unknown, ctx: EffectCtx): void {
  const a = args as Record<string, unknown>;
  switch (verb) {
    // --- ドロー / FILE / 証拠 ---
    case 'draw': {
      // deck.draw が手札への push まで内部で行う
      mutate.deck.draw(s, requireField<Player>(a, 'player', 'string'), requireField<number>(a, 'n', 'number'));
      return;
    }
    case 'discard': {
      // BUG-065 (本格対応) で resolve-picks.ts が pattern B (uid なし + target.kind='pick')
      // の解決をサポートするよう拡張済み。ここに到達した時点で a.target は string[] のはず。
      // ただし cands 0 件などで resolver が解決できなかった場合の安全網として
      // skip + log を維持 (本来到達しないパスだが防御として残す)。
      // 元: BUG-045 で導入された暫定 skip。BUG-065 で resolver 拡張により本格対応。
      if (!Array.isArray(a.target)) {
        mutate.log.append(s, {
          ts: Date.now(),
          player: a.player as Player,
          turn: s.turn.number,
          action: 'discard:skip-unresolved-pick',
        });
        return;
      }
      const target = a.target as string[];
      mutate.hand.discardToRemove(s, a.player as Player, target);
      return;
    }
    case 'mill': {
      mutate.deck.removeFromTop(s, a.player as Player, a.n as number);
      return;
    }
    case 'fileAdd': {
      mutate.file.addFromDeckTop(s, a.player as Player, a.n as number);
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
      return;
    }
    case 'evidenceGain': {
      const p = a.player as Player;
      const n = a.n as number;
      mutate.evidence.addFromDeck(s, p, n, false, { turn: s.turn.number, via: 'effect' });
      return;
    }
    case 'evidenceLose': {
      const p = a.player as Player;
      const n = a.n as number;
      for (let i = 0; i < n; i++) {
        const removed = mutate.evidence.removeTop(s, p);
        if (!removed) break;
      }
      return;
    }
    case 'evidenceFlip': {
      mutate.evidence.flipFaceUp(s, a.player as Player, a.idx as number);
      return;
    }
    // --- 証拠 / 手札 (G25/G30) ---
    case 'evidenceToHand': {
      const p = a.player as Player;
      const target = a.target as string;
      const list = s.players[p].evidence;
      const idx = list.findIndex(e => e.cardId === target);
      if (idx !== -1) {
        list.splice(idx, 1);
        mutate.hand.add(s, p, [target]);
      }
      return;
    }
    case 'handAddFromRemove': {
      const p = a.player as Player;
      const target = a.target as string;
      const rem = s.players[p].remove;
      const idx = rem.indexOf(target);
      if (idx !== -1) {
        rem.splice(idx, 1);
        mutate.hand.add(s, p, [target]);
      }
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
      const newChar = mutate.scene.enter(s, requireField<Player>(a, 'player', 'string'), cardId, {
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
      const newChar = mutate.scene.switchEnter(s, a.player as Player, a.cardId as string, a.removeUid as string, {
        named: (a.named as boolean | undefined) ?? false,
        viaEffect,
      });
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
      mutate.scene.removeToRemove(s, a.uid as string, (a.cause as RemoveCause) ?? 'effect');
      return;
    }
    case 'sceneSetState': {
      mutate.scene.setState(s, a.uid as string, a.state as 'active' | 'sleep' | 'stun');
      return;
    }
    case 'sceneDisguise': {
      mutate.char.disguiseInto(s, a.uid as string, a.newCardId as string);
      return;
    }

    // --- キャラ修正 ---
    case 'charModifyAP': {
      mutate.char.modifyAP(s, a.uid as string, a.delta as number, a.scope as 'turn' | 'contact' | 'permanent');
      return;
    }
    case 'charModifyLP': {
      mutate.char.modifyLP(s, a.uid as string, a.delta as number, a.scope as 'turn' | 'contact' | 'permanent');
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
      mutate.char.setOverrideAP(s, a.uid as string, a.val as number | null);
      return;
    }
    case 'charOverrideLP': {
      mutate.char.setOverrideLP(s, a.uid as string, a.val as number | null);
      return;
    }
    case 'charGrantKeyword': {
      // user_request 20260522_01 #12 fix: $matched.uid 等の bind ref 解決
      const grantUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof grantUid !== 'string' || grantUid.startsWith('$')) return;
      mutate.char.grantKeyword(s, grantUid, a.kw as string, (a.scope as 'turn' | 'contact' | 'permanent' | undefined) ?? 'permanent');
      return;
    }
    case 'charRevokeKeyword': {
      const revokeUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof revokeUid !== 'string' || revokeUid.startsWith('$')) return;
      mutate.char.revokeKeyword(s, revokeUid, a.kw as string);
      return;
    }
    case 'charDisableOriginal': {
      mutate.char.disableOriginalAbilities(s, a.uid as string);
      return;
    }
    case 'charSetTurnEffect': {
      mutate.char.setTurnEffect(s, a.uid as string, a.key as string, a.val);
      return;
    }
    case 'charSetCard': {
      mutate.char.setCard(s, a.uid as string, a.cardId as string, a.faceUp as boolean);
      return;
    }
    case 'charStackCard': {
      mutate.char.stackCard(s, a.uid as string, a.n as number);
      return;
    }

    // --- パートナー / 事件 ---
    case 'partnerAssist': {
      mutate.partner.assist(s, a.player as Player);
      return;
    }
    case 'partnerSetState': {
      mutate.partner.setState(s, a.player as Player, a.state as 'active' | 'sleep' | 'stun');
      return;
    }
    case 'partnerSolveCase': {
      mutate.partner.solveCase(s, a.player as Player);
      return;
    }
    case 'caseToResolved': {
      const p = a.player as Player;
      mutate.case.toResolved(s, p);
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
      return;
    }
    case 'deckShuffle': {
      // rules/04, 14, 26 — デッキ基本シャッフル (D11019 等で使用)
      const p = a.player as Player;
      mutate.deck.shuffle(s, p, ctx.rng);
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
