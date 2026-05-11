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
import { FILE_CARD_BACK_PLACEHOLDER } from '../types/index.js';
import { mutate } from '../mutate/index.js';

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
      mutate.scene.enter(s, requireField<Player>(a, 'player', 'string'), requireField<string>(a, 'cardId', 'string'), {
        named: (a.named as boolean | undefined) ?? false,
        viaEffect: (a.viaEffect as boolean | undefined) ?? false,
      });
      return;
    }
    case 'sceneSwitch': {
      mutate.scene.switchEnter(s, a.player as Player, a.cardId as string, a.removeUid as string, {
        named: (a.named as boolean | undefined) ?? false,
        viaEffect: (a.viaEffect as boolean | undefined) ?? false,
      });
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
      mutate.char.grantKeyword(s, a.uid as string, a.kw as string, (a.scope as 'turn' | 'contact' | 'permanent' | undefined) ?? 'permanent');
      return;
    }
    case 'charRevokeKeyword': {
      mutate.char.revokeKeyword(s, a.uid as string, a.kw as string);
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
      mutate.case.toResolved(s, a.player as Player);
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
      const filter = a.filter as ((cardId: string) => boolean) | undefined;
      const bindKey = a.bind as string | undefined;
      const bindMatchKey = a.bindMatch as string | undefined;
      const deck = s.players[p].deck;
      const revealed: string[] = [];
      let matched: string | null = null;
      // デッキ上から 1 枚ずつ、filter にマッチしたら停止
      for (const cardId of deck) {
        revealed.push(cardId);
        if (filter && filter(cardId)) {
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
