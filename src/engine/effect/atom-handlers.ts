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
import { mutate } from '../mutate/index.js';
import { event } from '../event/index.js';
import { cards as engineCards } from '../cards/index.js';
import { tryRePickFromAtom, pushPendingPickFromAtom, toPlainDeep } from './resolve-picks.js';
import { ATOM_PICK_SPEC, buildShortFormPick, isShortFormDelta } from './atom-pick-spec.js';
import { evalDyn } from '../dyn/eval.js'; // BUG-114: explicit-uid charModifyAP/LP/Level の {dyn} delta を runtime 評価
import { defHasKeyword } from '../read/keyword.js'; // wave#2 cluster2: deck 窓 filter の keyword 判定 (matchOneFilter と単一真実源)
import { allCardNameComponentsForDef } from '../target/card-def-registry.js'; // wave#2 cluster2: cardName 分割名判定 (rules/19)

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
    // BUG-117: AP/LP filter (printed 値判定 — deck card は override/turnEffect を持たない)
    const ap = d.ap ?? 0;
    if (filter.apMin !== undefined && ap < filter.apMin) return false;
    if (filter.apMax !== undefined && ap > filter.apMax) return false;
    const lp = d.lp ?? 0;
    if (filter.lpMin !== undefined && lp < filter.lpMin) return false;
    if (filter.lpMax !== undefined && lp > filter.lpMax) return false;
    if (filter.levelMin !== undefined && (d.level ?? 0) < filter.levelMin) return false;
    if (filter.levelMax !== undefined && (d.level ?? Infinity) > filter.levelMax) return false;
    // BUG-118: kind は TargetFilter 型に昇格済 (matchOneFilter と統一)
    if (filter.kind !== undefined && d.kind !== filter.kind) return false;
    // wave#2 cluster2 (2026-06-12): keyword / cardName が silent drop されていた (BUG-117/118 同型
    // ドリフト)。matchOneFilter と同じ単一真実源 (defHasKeyword / allCardNameComponentsForDef) に委譲。
    // hasSetCards / custom は deck カードに state / closure が無く本質的に評価不能 → 非対応のまま
    // (matchOneFilter の scene candidate 専用 semantics)。
    if (filter.keyword !== undefined) {
      const wants = Array.isArray(filter.keyword) ? filter.keyword : [filter.keyword];
      if (!wants.some(w => defHasKeyword(d, w))) return false;
    }
    if (filter.cardName !== undefined) {
      const wants = Array.isArray(filter.cardName) ? filter.cardName : [filter.cardName];
      const components = allCardNameComponentsForDef(d);
      if (!wants.some(w => components.includes(w))) return false;
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
 * BUG-079: card DSL の `player: 'self'` リテラルを ctx.source.player ベースで
 * relative resolution する。'self' = source card の owner、'opp' = opp-of-owner。
 *
 * 旧コードは `resolvePlayer(a.player, ctx)` でリテラル絶対 ID として処理していたため、
 * CPU 側 (opp) の card の `player: 'self'` が人間 (絶対 self) に効果を向けて
 * いた。cond/eval.ts の `resolvePlayer` と同じ慣習を atom 側にも統一。
 */
function resolvePlayer(p: unknown, ctx: EffectCtx): Player {
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
function resolveBindRef(value: unknown, ctx: EffectCtx): unknown {
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
function resolveDeltaToNumber(delta: unknown, s: GameState, ctx: EffectCtx): number {
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
function normalizeTargetToString(value: unknown): string | undefined {
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
function hasNorMax(a: Record<string, unknown>): boolean {
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
function paShortFormAwait(
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

export function runAtom(s: GameState, verb: AtomVerb, args: unknown, ctx: EffectCtx): void {
  const a = args as Record<string, unknown>;
  // Task D E0 (2026-06-12): pick-bind writeback。PA 短縮形 pick が解決済み (uid が実 uid) かつ
  // `bind` が指定されていれば、ctx.bindings[bind] に {kind:'char',uid,cardId,player} を蓄積する。
  // 後続 atom は `uid: '$<bind>.uid'` (resolveBindRef) で同一キャラを参照できる。
  // human (applyPickAndContinuation の continuation ctx) / AI (初期 walk 同期解決 → runtime
  // entryToCtx の ctx) の両経路を本 preamble 1 箇所でカバーする (rules/15 効果解決順)。
  // multi-pick は per-uid atom が順に実行されるため重複を避けつつ全 picked が蓄積される。
  if (typeof a.bind === 'string' && typeof a.uid === 'string' && !a.uid.startsWith('$')) {
    const bindUid = a.uid;
    const found = (['self', 'opp'] as const)
      .flatMap(p => s.players[p].scene.map(c => ({ c, p })))
      .find(({ c }) => c.uid === bindUid);
    if (found) {
      const bindings = ctx.bindings as Record<string, unknown[]>;
      const arr = Array.isArray(bindings[a.bind]) ? bindings[a.bind]! : (bindings[a.bind] = []);
      if (!arr.some(e => (e as { uid?: string }).uid === bindUid)) {
        arr.push({ kind: 'char', uid: bindUid, cardId: found.c.cardId, player: found.p });
      }
    }
  }
  switch (verb) {
    // --- ドロー / FILE / 証拠 ---
    case 'draw': {
      // BUG-072: deck.draw が手札への push まで内部で行う + effect 経由の draw を log に残す
      const drawPlayer = resolvePlayer(a.player, ctx);
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
      // 物理動作 atom 化: { player, n } の省略形を受け取れるよう default pick target で補完
      const dcP = resolvePlayer(a.player, ctx);
      const dcArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.discard.defaultArea, a, dcP, dcP) }
        : a;
      if (!Array.isArray(dcArgs.target)) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: dcArgs }, ctx, { byPlayer: dcP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, {
          ts: Date.now(),
          player: dcP,
          turn: s.turn.number,
          action: 'effect:discard:awaiting-pick',
        });
        return;
      }
      const target = dcArgs.target as string[];
      mutate.hand.discardToRemove(s, resolvePlayer(a.player, ctx), target);
      // BUG-114: discard したカードを bind (リムーブしたカードの level/AP を $discarded dyn で参照)。
      // 続く chain step (charModifyAP delta:{dyn:'$discarded.level*1000'}) が同一 ctx で読む (BUG-107)。
      if (typeof a.bind === 'string' && target.length > 0) {
        (ctx.bindings as Record<string, unknown>)[a.bind] = target.map((cardId) => ({ cardId }));
      }
      // BUG-072: effect 経由の discard 成功も log に残す
      mutate.log.append(s, {
        ts: Date.now(),
        player: resolvePlayer(a.player, ctx),
        turn: s.turn.number,
        action: 'effect:discard',
        result: String(target.length),
      });
      return;
    }
    case 'mill': {
      // BUG-073: effect log
      const millP = resolvePlayer(a.player, ctx);
      const millN = a.n as number;
      mutate.deck.removeFromTop(s, millP, millN);
      // BUG-137 (wave#2 cluster2, 2026-06-12): デッキ枯渇時の refresh guard が欠落していた。
      // rules/14 (デッキ 0 で即座に refresh) + rules/26 (可能な限りリムーブ → refresh →
      // 残り分は追加リムーブしない)。B09104 qAndA「可能な限りリムーブし、その後リフレッシュを行います」。
      if (s.players[millP].deck.length === 0) {
        const r = mutate.deck.refresh(s, millP);
        if (!r.ok && s.gameResult === undefined) {
          const winner: Player = millP === 'self' ? 'opp' : 'self';
          mutate.gameResult.set(s, winner, 'deck-out');
        }
      }
      mutate.log.append(s, { ts: Date.now(), player: millP, turn: s.turn.number, action: 'effect:mill', result: String(millN) });
      return;
    }
    case 'fileAdd': {
      // BUG-073: effect log
      const faP = resolvePlayer(a.player, ctx);
      const faN = a.n as number;
      // Task D E3 (2026-06-12): rules/14「FILEに置く」効果はデッキ0でリフレッシュ後に残りを解決。
      // addFromDeckTop 自体 (auto-phase 経路) は不変に保ち、effect 経路のみ 1 枚ずつ
      // refresh guard を挟む (mutate.deck.draw と同じ敗北処理)。
      for (let i = 0; i < faN; i++) {
        if (s.players[faP].deck.length === 0) {
          const r = mutate.deck.refresh(s, faP);
          if (!r.ok) {
            if (s.gameResult === undefined) {
              const winner: Player = faP === 'self' ? 'opp' : 'self';
              mutate.gameResult.set(s, winner, 'deck-out');
            }
            break;
          }
        }
        mutate.file.addFromDeckTop(s, faP, 1);
      }
      mutate.log.append(s, { ts: Date.now(), player: faP, turn: s.turn.number, action: 'effect:fileAdd', result: String(faN) });
      return;
    }
    case 'filePopToHand': {
      const p = resolvePlayer(a.player, ctx);
      const popped: FileCard | undefined = mutate.file.popTop(s, p);
      // BUG-128 (Task D E3, 2026-06-12): FileCard.card-back は Round 3 から実 cardId を保持して
      // いる (next-hint.ts:66-74 は修正済) のに、本 verb は placeholder 'card-back' を手札に
      // push する stale 実装だった。実 cardId を加え、next-hint と同じ 'file:pop' を emit する。
      // popped 無し (FILE 空 or アシストパートナーのみ) は「そうした場合」不成立 = chain break
      // (PR100/B04068 公式Q&A: FILE に無ければ以降の効果は解決できない)。
      if (popped) {
        mutate.hand.add(s, p, [popped.cardId]);
        event.emit(s, 'file:pop', { player: p, popped }, { player: p });
      } else {
        (globalThis as { __chainStepNoApply?: boolean }).__chainStepNoApply = true;
      }
      // BUG-073: effect log (popped が無い場合も log には残す)
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:filePopToHand', result: popped ? popped.cardId : 'none' });
      return;
    }
    case 'fileRemoveTop': {
      // Task D E3 (2026-06-12): FILE 上から n 枚を FILE 所有者のリムーブエリアへ。
      // rules/03 (リムーブエリア) / rules/05 (末尾が最上)。アシストパートナーは popTop が
      // 自動 skip (B09010/B09108/B09111 Q&A「パートナーカードを除いて」)。
      // 1 枚もリムーブできなければ chain break (B09105 Q&A「以降の効果は解決できない」)。
      // bind 指定でリムーブした cardId 群を ctx.bindings へ (discard a.bind と同流儀)。
      const frP = resolvePlayer(a.player, ctx);
      const frN = requireField<number>(a, 'n', 'number');
      const removedIds: string[] = [];
      for (let i = 0; i < frN; i++) {
        const popped = mutate.file.popTop(s, frP);
        if (!popped) break;
        removedIds.push(popped.cardId);
      }
      if (removedIds.length > 0) {
        mutate.remove.add(s, frP, removedIds);
      } else {
        (globalThis as { __chainStepNoApply?: boolean }).__chainStepNoApply = true;
      }
      if (typeof a.bind === 'string') {
        (ctx.bindings as Record<string, unknown[]>)[a.bind] =
          removedIds.map(cardId => ({ kind: 'card', cardId, area: 'remove', player: frP }));
      }
      mutate.log.append(s, { ts: Date.now(), player: frP, turn: s.turn.number, action: 'effect:fileRemoveTop', result: removedIds.join(',') || 'none' });
      return;
    }
    case 'fileFlipTop': {
      // Task D E3 (2026-06-12): FILE 最上位の非パートナーを表向き化 (B09021/B09108/B09023/B09005)。
      // 既に表向き / FILE 空は no-op。⚠ flip 不発でも chain break しない
      // (B09021 Q&A: 表向きにできなくても後続の AP+1000 は実行可 — fileRemoveTop と非対称)。
      const ffP = resolvePlayer(a.player, ctx);
      const ffResult = mutate.file.flipTop(s, ffP);
      mutate.log.append(s, { ts: Date.now(), player: ffP, turn: s.turn.number, action: 'effect:fileFlipTop', result: ffResult });
      return;
    }
    case 'evidenceGain': {
      const p = resolvePlayer(a.player, ctx);
      const n = a.n as number;
      // engine拡張 wave#2 cluster3 (2026-06-13, BUG-142): rules/14「証拠を得る = リフレッシュ後に
      // 残りを解決」。addFromDeck はデッキ0で silent break するため (mutate/evidence.ts)、
      // fileAdd 同型の「1枚ごと事前 deck0→refresh→add」ループで refresh を挟む。remove0 なら敗北。
      let egGained = 0;
      for (let i = 0; i < n; i++) {
        if (s.players[p].deck.length === 0) {
          const r = mutate.deck.refresh(s, p);
          if (!r.ok) {
            if (s.gameResult === undefined) {
              const winner: Player = p === 'self' ? 'opp' : 'self';
              mutate.gameResult.set(s, winner, 'deck-out');
            }
            break;
          }
        }
        mutate.evidence.addFromDeck(s, p, 1, false, { turn: s.turn.number, via: 'effect' });
        egGained++;
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceGain', result: String(egGained) });
      return;
    }
    case 'selfToEvidence': {
      // 「このカードを表向きのまま証拠として得る」(rules/01 §必要証拠数 / rules/06 §イベント)。
      // イベント使用後 handUseCard が当該カードをリムーブへ置くので、リムーブ→証拠 へ移す。
      // ctx.source.cardId = 使用したイベント自身、ctx.source.player = 使用者。
      const steP = resolvePlayer((a.player as 'self' | 'opp' | undefined) ?? 'self', ctx);
      const steCardId = ctx.source.cardId;
      if (typeof steCardId !== 'string' || steCardId.length === 0) return;
      const steFaceUp = a.faceUp === undefined ? true : a.faceUp === true;
      mutate.evidence.gainCard(s, steP, steCardId, steFaceUp, {
        turn: s.turn.number, via: 'effect', sourceCardId: steCardId,
      });
      mutate.log.append(s, { ts: Date.now(), player: steP, turn: s.turn.number, action: 'effect:selfToEvidence', target: steCardId, result: steFaceUp ? '表向き' : '裏向き' });
      return;
    }
    case 'evidenceLose': {
      const p = resolvePlayer(a.player, ctx);
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
    case 'evidenceToDeck': {
      // 2026-06-06 タスクC: 証拠最上部 n 枚をデッキ上へ戻す (B03038「この推理によって証拠を得ない」)。
      // net で「証拠 0・デッキ復元」(rules/11 §LP≤0 と同じ状態)。n は number か $trigger.gained
      // (= 推理で得た枚数 payload.gained) を resolveBindRef で解決。
      const etdP = resolvePlayer(a.player, ctx);
      const nRaw = resolveBindRef(a.n, ctx);
      const etdN = typeof nRaw === 'number' ? nRaw : 0;
      const moved = mutate.evidence.toDeckTop(s, etdP, etdN);
      mutate.log.append(s, { ts: Date.now(), player: etdP, turn: s.turn.number, action: 'effect:evidenceToDeck', result: String(moved) });
      return;
    }
    case 'evidenceFlip': {
      const efP = resolvePlayer(a.player, ctx);
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
      // 物理動作 atom 化: { player, n } の省略形を受け取れるよう default pick target で補完
      const p = resolvePlayer(a.player, ctx);
      const ethArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.evidenceToHand.defaultArea, a, p, p) }
        : a;
      const target = normalizeTargetToString(ethArgs.target);
      if (!target) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: ethArgs }, ctx, { byPlayer: p, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
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
    case 'handAddFromDeck': {
      // engine-extension #5a (2026-06-05): deck-reorder 系の補助 — bind 済 cardId をデッキから抜き手札へ。
      // 用途: 「上から N 枚見る → 1枚まで(filter)を手札に加え → 残りはデッキ下」(D01013/B01013 etc.).
      // 通常 a.cardId='$matched.cardId' で bind 解決 → デッキから splice → hand.add。
      const hadP = resolvePlayer(a.player, ctx);
      const hadCardId = resolveBindRef(a.cardId, ctx) as string;
      if (typeof hadCardId !== 'string' || hadCardId.startsWith('$')) {
        // 未解決 (bind 不在) は silent no-op
        mutate.log.append(s, { ts: Date.now(), player: hadP, turn: s.turn.number, action: 'effect:handAddFromDeck', result: 'no-bind' });
        return;
      }
      const deck = s.players[hadP].deck;
      const idx = deck.indexOf(hadCardId);
      let moved = false;
      if (idx !== -1) {
        deck.splice(idx, 1);
        mutate.hand.add(s, hadP, [hadCardId]);
        moved = true;
      }
      mutate.log.append(s, { ts: Date.now(), player: hadP, turn: s.turn.number, action: 'effect:handAddFromDeck', target: hadCardId, result: moved ? 'ok' : 'not-found' });
      return;
    }
    case 'handAddFromRemove': {
      // BUG-074: 同じく string|array 両対応に正規化
      // BUG-076: awaiting-pick 時に tryRePickFromAtom で side-channel 再 set
      // 物理動作 atom 化: { player, n } の省略形を受け取れるよう default pick target で補完
      const p = resolvePlayer(a.player, ctx);
      // cluster6 (2026-06-14) B09034「リムーブのイベントを2枚まで選び、手札に加える」用 multi-pick path。
      //   charStackCard (case 'charStackCard') と同型の cardIds:'$pick.cardIds' contract:
      //     { player, cardIds:'$pick.cardIds', target:{kind:'pick', query:{area:'remove',side:'self',
      //       filter:{kind:'event'}}, n:{min:0,max:2}, chooser:'self'} }
      //   human 経路: apply-pick.ts が picked uid → cardIds 配列を充填して再 dispatch (hasCardIdsBind)。
      //   AI 経路:   resolve-picks.ts が remove 候補から greedy に max 枚 cardIds を充填。
      //   従来 single-card path (cardIds 未指定) は下段で従来通り処理 → additive・非干渉。
      const rawCardIds = (a as { cardIds?: unknown }).cardIds;
      if (rawCardIds === '$pick.cardIds') {
        // 未解決 (human 経路の await): side-channel に pick を queue して return。
        if (a.target && typeof a.target === 'object') {
          tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, {
            byPlayer: p,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove:awaiting-pick' });
        }
        return;
      }
      if (Array.isArray(rawCardIds)) {
        // 解決済 (0〜max 枚): 各 cardId を remove → hand へ移す (rules/15「〜まで」= 0 枚可 → no-op + log)。
        const cardIds = rawCardIds as string[];
        const remM = s.players[p].remove;
        const movedIds: string[] = [];
        for (const cid of cardIds) {
          const idx = remM.indexOf(cid);
          if (idx !== -1) { remM.splice(idx, 1); mutate.hand.add(s, p, [cid]); movedIds.push(cid); }
        }
        mutate.log.append(s, {
          ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove',
          target: movedIds.join(','), result: cardIds.length === 0 ? '0' : (movedIds.length ? 'ok' : 'not-found'),
        });
        return;
      }
      const hafrArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handAddFromRemove.defaultArea, a, p, p) }
        : a;
      const target = normalizeTargetToString(hafrArgs.target);
      if (!target) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: hafrArgs }, ctx, { byPlayer: p, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
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
      // cluster14 (2026-06-15) multi-card sceneEnter: 「…キャラを2枚まで選び、登場させる」(B09010/PR042 等)。
      //   handAddFromRemove/charStackCard と同型の cardIds:'$pick.cardIds' 契約を sceneEnter に拡張する。
      //   単一 cardId path は cardIds 不在時に従来通り (additive・非干渉。骨格凍結例外: rules/20 スイッチ + defer カード)。
      //   現場満杯時の switch は switchRemoveUids[] (UI が overflow 枚数ぶん収集) を per-card に消費する。
      {
        const rawCardIdsM = (a as { cardIds?: unknown; __declined?: unknown }).cardIds;
        if (rawCardIdsM === '$pick.cardIds') {
          // FIX-B2: 0枚選択 (skipResolvesAtom decline) の再入。__declined → 0体登場 (continuation は
          //   applyPickSkipAndContinuation が別途実行)。deckRevealUntil の __declined 契約と同型。
          if ((a as { __declined?: unknown }).__declined === true) {
            mutate.log.append(s, { ts: Date.now(), player: resolvePlayer(a.player, ctx), turn: s.turn.number, action: 'effect:sceneEnter:multi-declined' });
            return;
          }
          // 未解決 await: side-channel に pick を queue (handAddFromRemove 同型)。
          if (a.target && typeof a.target === 'object') {
            const seMP = resolvePlayer(a.player, ctx);
            tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, { byPlayer: seMP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
            mutate.log.append(s, { ts: Date.now(), player: seMP, turn: s.turn.number, action: 'effect:sceneEnter:awaiting-pick' });
          }
          return;
        }
        if (Array.isArray(rawCardIdsM)) {
          // 解決済 (0〜max 枚)。各 cardId を source area から splice → enter / switchEnter。
          const cardIds = rawCardIdsM as string[];
          const enterP = resolvePlayer(a.player, ctx);
          const switchUids = Array.isArray((a as { switchRemoveUids?: unknown }).switchRemoveUids)
            ? [...((a as { switchRemoveUids?: string[] }).switchRemoveUids as string[])]
            : [];
          const viaEffectM = (a.viaEffect as boolean | undefined) ?? true;
          const enterOptsM = {
            named: (a.named as boolean | undefined) ?? true,
            viaEffect: viaEffectM,
            active: a.enterSleep === true ? false : undefined,
          };
          const srcArea = ((a.target && typeof a.target === 'object') ? (a.target as { query?: { area?: string } }).query?.area : undefined) as 'remove' | 'hand' | 'deck' | undefined;
          const srcSide = ((a.target && typeof a.target === 'object') ? (a.target as { query?: { side?: string } }).query?.side : undefined) as 'self' | 'opp' | undefined;
          for (const cid of cardIds) {
            // 単一 path と同じ inline splice (remove/hand/deck のみ)。これがないと remove に残り複製登場 (D11014 a2 class bug)。
            const fp = srcSide === 'opp' ? 'opp' : enterP;
            if (srcArea === 'remove' || srcArea === 'hand' || srcArea === 'deck') {
              const arr = s.players[fp][srcArea];
              const i = arr.indexOf(cid);
              if (i !== -1) arr.splice(i, 1);
            }
            // FIX-B3a: full は **ループ内で都度再計算** (hoist 禁止。enter で scene が伸びるため)。
            const full = s.players[enterP].scene.length >= 5;
            let nc: ReturnType<typeof mutate.scene.enter>;
            if (full) {
              const v = switchUids.shift();
              // FIX-B3b: victim が現 scene に存在するか検証 (stale/dup/illegal → skip、enter() の throw 防止)。
              if (typeof v === 'string' && !v.startsWith('$') && s.players[enterP].scene.some((c) => c.uid === v)) {
                nc = mutate.scene.switchEnter(s, enterP, cid, v, enterOptsM);
              } else {
                mutate.log.append(s, { ts: Date.now(), player: enterP, turn: s.turn.number, action: 'effect:sceneEnter:scene-full-skip', target: cid });
                continue;
              }
            } else {
              nc = mutate.scene.enter(s, enterP, cid, enterOptsM);
            }
            // BUG-146: enter emit の source は登場キャラ・原因カードは payload.sourceCardId (単一 path と同規約)。
            //   per-card emit で enterOrderThisTurn が 1 枚ずつ加算され【疾風 N】が正しく判定される (batch emit 禁止)。
            event.emit(s, 'enter', {
              uid: nc.uid, viaEffect: viaEffectM, enterOrder: nc.enterOrder,
              enterOrderThisTurn: nc.enterOrderThisTurn, sourceCardId: (ctx.source as { cardId?: string }).cardId,
            }, { player: enterP, uid: nc.uid, cardId: cid });
          }
          return;
        }
      }
      // 2026-06-04 switch-on-effect-enter (rules/20 スイッチ): 現場満杯 (5枚) の効果登場の早期分岐。
      //  - switchRemoveUid 指定済 (UI が満杯時に SceneSwitchPickerModal で退場キャラを収集) → skip せず
      //    下の解決済 path で switchEnter する。
      //  - 未指定の AI 経路 (humanSide でない側) → スイッチ選択 UI/heuristic 無しなので skip する
      //    (rules: 0枚選択=合法な辞退。modal も無駄 pick cycle も出さない、smoke 不変)。
      //  - 未指定の human 経路 → ここでは skip せず短縮形/await pick を通し、reanimate 対象を選ばせる。
      //    解決時に UI が現場満杯を検知して switch 対象を収集 → switchRemoveUid 付きで再解決される。
      {
        const seFullP = resolvePlayer(a.player, ctx);
        const seHasSwitch = typeof a.switchRemoveUid === 'string' && !(a.switchRemoveUid as string).startsWith('$');
        const seHumanSide = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
        if (s.players[seFullP].scene.length >= 5 && !seHasSwitch && seFullP !== seHumanSide) {
          mutate.log.append(s, { ts: Date.now(), player: seFullP, turn: s.turn.number, action: 'effect:sceneEnter:scene-full-skip' });
          return;
        }
      }
      // PA 短縮形 (area からの登場): cardId 不在 + from + n|max で source area pick を構築し、
      // cardId='$pick.cardId' + target を付与して下記 $pick.cardId awaiting-pick 経路に合流させる。
      // sourceSplice (remove/evidence から実体除去) は解決後の本処理が target.query.area を見て行う。
      if (a.cardId === undefined && typeof a.from === 'string' && hasNorMax(a)) {
        const seP0 = resolvePlayer(a.player, ctx);
        const seTarget = buildShortFormPick(a.from, a, seP0, seP0);
        tryRePickFromAtom(s, { kind: 'atom', verb, args: { ...a, cardId: '$pick.cardId', target: seTarget } }, ctx, { byPlayer: seP0, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: seP0, turn: s.turn.number, action: 'effect:sceneEnter:awaiting-pick' });
        return;
      }
      // 効果による登場 (atom verb 駆動) は viaEffect=true がデフォルト。
      // ただし args に明示があれば尊重する (テスト・特殊呼出用)。
      const viaEffect = (a.viaEffect as boolean | undefined) ?? true;
      // user_request 20260522_01 #12 fix: $matched.cardId 等の bind ref を解決
      // (D11019 deckRevealUntil → sceneEnter sequence で必要)
      const rawCardId = requireField<string>(a, 'cardId', 'string');
      const cardId = resolveBindRef(rawCardId, ctx) as string;
      // D11014 a2 driver 2026-05-26: cardId が `$pick.*` で未解決かつ target に
      // pick query があれば tryRePickFromAtom で side-channel set (Pattern A 同型)。
      // handAddFromRemove と同 pattern。これがないと sceneEnter は silent no-op で
      // modal が出ない長年バグ (D08024 / D11014 a2 等が影響)。
      if (typeof cardId !== 'string' || cardId.startsWith('$')) {
        if (rawCardId === '$pick.cardId' && a.target && typeof a.target === 'object') {
          const sePlayer = resolvePlayer(a.player, ctx);
          tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, {
            byPlayer: sePlayer,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, {
            ts: Date.now(), player: sePlayer, turn: s.turn.number,
            action: 'effect:sceneEnter:awaiting-pick',
          });
          return;
        }
        // それ以外の未解決 bind ref は従来通り silent no-op (BUG-048 と同 pattern)
        return;
      }
      const enterPlayer = resolvePlayer(a.player, ctx);
      // switch-on-effect-enter (rules/20): 現場満杯時は既存キャラを除去 (switchEnter) して登場する。
      // switchRemoveUid (UI が SceneSwitchPickerModal で収集した退場キャラ uid) があれば switchEnter、
      // 無ければ skip (human が switch を辞退 / AI 経路)。room があれば通常 enter。
      const seSwitchRemoveUid = resolveBindRef(a.switchRemoveUid, ctx) as string | undefined;
      const seIsFull = s.players[enterPlayer].scene.length >= 5;
      const seHasValidSwitch = typeof seSwitchRemoveUid === 'string' && !seSwitchRemoveUid.startsWith('$');
      if (seIsFull && !seHasValidSwitch) {
        mutate.log.append(s, { ts: Date.now(), player: enterPlayer, turn: s.turn.number, action: 'effect:sceneEnter:scene-full-skip', target: cardId });
        return;
      }
      // D11014 a2 driver 2026-05-26: pick query で source area が指定されていれば、
      // そこから cardId 1 枚を取り除いてから scene へ。これがないと「リムーブから
      // 登場」が「リムーブに残ったまま scene にコピー登場」になる duplication bug。
      // handAddFromRemove と同 pattern (line 360-367)。
      const sourceArea = ((a.target && typeof a.target === 'object')
        ? ((a.target as { query?: { area?: string; side?: string } }).query?.area)
        : undefined) as 'remove' | 'evidence' | 'file' | 'deck' | 'hand' | undefined;
      const sourceSide = ((a.target && typeof a.target === 'object')
        ? ((a.target as { query?: { side?: string } }).query?.side)
        : undefined) as 'self' | 'opp' | undefined;
      if (sourceArea === 'remove') {
        const fromPlayer = sourceSide === 'opp' ? 'opp' : enterPlayer;
        const arr = s.players[fromPlayer].remove;
        const idx = arr.indexOf(cardId);
        if (idx !== -1) arr.splice(idx, 1);
      } else if (sourceArea === 'hand') {
        const fromPlayer = sourceSide === 'opp' ? 'opp' : enterPlayer;
        const arr = s.players[fromPlayer].hand;
        const idx = arr.indexOf(cardId);
        if (idx !== -1) arr.splice(idx, 1);
      } else if (sourceArea === 'deck') {
        const fromPlayer = sourceSide === 'opp' ? 'opp' : enterPlayer;
        const arr = s.players[fromPlayer].deck;
        const idx = arr.indexOf(cardId);
        if (idx !== -1) arr.splice(idx, 1);
      }
      const enterOpts = {
        // BUG-093: 効果/能力による登場も「同ターン登場」= 名乗り状態 (rules/06, 17)。
        // 既定 false だと効果登場キャラが名乗りにならず、名乗り例外 (突撃/迅速) 無しでも
        // action/推理できてしまっていた。明示 false を渡さない限り名乗りで登場させる。
        named: (a.named as boolean | undefined) ?? true,
        viaEffect,
        // look-top-N (2026-06-06 タスクC, D01012): enterSleep:true で「スリープ状態で登場」(rules/03)。
        // mutate.scene.enter が active===false → 'sleep' で生成する。既定 (undefined) は従来通り active。
        active: a.enterSleep === true ? false : undefined,
      };
      // 満杯なら switchEnter (退場キャラを除去してから登場、rules/20)、room あれば通常 enter。
      const newChar = seIsFull
        ? mutate.scene.switchEnter(s, enterPlayer, cardId, seSwitchRemoveUid as string, enterOpts)
        : mutate.scene.enter(s, enterPlayer, cardId, enterOpts);
      // user_request 20260522_01 #12 fix: 新 uid を $matched に書き戻し、
      // 後続 atom (charGrantKeyword 等) が `$matched.uid` で参照できるよう
      // する。元 binding の cardId は維持しつつ uid を上書き。
      // BUG-091: deckRevealUntil は $込みキー ('$matched') で格納するため、$無し ('matched') と
      // 両方を試して登場キャラの新 uid を書き戻す (後続 $matched.uid = charGrantKeyword 参照のため)。
      const existing = ((ctx.bindings as Record<string, unknown>)['matched']
        ?? (ctx.bindings as Record<string, unknown>)['$matched']) as Record<string, unknown>[] | undefined;
      if (Array.isArray(existing) && existing.length > 0) {
        existing[0].uid = newChar.uid;
      }
      // D11014 a2 driver (2026-05-25): args.bind が指定されていれば、登場したキャラ情報
      // ({ cardId, uid }) を `ctx.bindings[bind]` に格納。後続 condition (boundMatchesFilter 等)
      // が「〚カード名[X]〛を登場させた場合」を declarative に判定できる。
      const enteredBindKey = a.bind as string | undefined;
      if (enteredBindKey) {
        ctx.bindings[enteredBindKey] = [{
          kind: 'card', cardId, area: 'scene', player: enterPlayer, uid: newChar.uid,
        } as unknown as Candidate];
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: enterPlayer, turn: s.turn.number, action: 'effect:sceneEnter', target: cardId });
      // rules/17 — 現場登場時 Hook (【登場時】・【疾風 N】判定)
      // BUG-146 (2026-06-15): enter emit の source は **登場キャラ** に統一する (hand-use-card / next-hint と同規約)。
      // 旧実装は ctx.source (= 登場を起こした原因カード) を渡しており、selfOnlyMatches (source.uid===card.uid) で
      // 効果/能力登場キャラ自身の【登場時】(selfOnly) が永久不発 + 原因カードの【登場時】が誤発火していた。
      // 原因カード (cluster11 enterSource 用) は payload.sourceCardId へ移送 (additive、既存 listener は読まない)。
      event.emit(s, 'enter', {
        uid: newChar.uid,
        viaEffect,
        enterOrder: newChar.enterOrder,
        enterOrderThisTurn: newChar.enterOrderThisTurn,
        sourceCardId: (ctx.source as { cardId?: string }).cardId,
      }, { player: enterPlayer, uid: newChar.uid, cardId });
      return;
    }
    case 'sceneSwitch': {
      const viaEffect = (a.viaEffect as boolean | undefined) ?? true;
      const swPlayer = resolvePlayer(a.player, ctx);
      // BUG-068: bind ref ($matched.cardId / $entered.uid 等) 解決を配線
      const swCardId = resolveBindRef(a.cardId, ctx) as string;
      if (typeof swCardId !== 'string' || swCardId.startsWith('$')) return;
      const swRemoveUid = resolveBindRef(a.removeUid, ctx) as string;
      if (typeof swRemoveUid !== 'string' || swRemoveUid.startsWith('$')) return;
      const newChar = mutate.scene.switchEnter(s, swPlayer, swCardId, swRemoveUid, {
        // BUG-093: 効果/能力による登場も「同ターン登場」= 名乗り状態 (rules/06, 17)。
        // 既定 false だと効果登場キャラが名乗りにならず、名乗り例外 (突撃/迅速) 無しでも
        // action/推理できてしまっていた。明示 false を渡さない限り名乗りで登場させる。
        named: (a.named as boolean | undefined) ?? true,
        viaEffect,
      });
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: swPlayer, turn: s.turn.number, action: 'effect:sceneSwitch', target: swCardId });
      // スイッチ登場も rules/17 上「登場」として enter Hook が発火する
      // BUG-146 (2026-06-15): source を登場キャラに統一 + 原因カードを payload.sourceCardId へ (sceneEnter と同様)。
      event.emit(s, 'enter', {
        uid: newChar.uid,
        viaEffect,
        enterOrder: newChar.enterOrder,
        enterOrderThisTurn: newChar.enterOrderThisTurn,
        sourceCardId: (ctx.source as { cardId?: string }).cardId,
      }, { player: swPlayer, uid: newChar.uid, cardId: swCardId });
      return;
    }
    case 'sceneRemove': {
      type RemoveCause = 'contact-ap' | 'effect' | 'switch' | 'cost' | 'misplay-overflow';
      // 物理動作 atom 化 (拡張 3): 短縮形 { player, n or max, side, filter } で uid 不在
      // の場合、PA pick query を構築 + tryRePickFromAtom で side-channel set + awaiting-pick log。
      // (D08003 a1 step 2 「現場 AP≤8000 を1枚まで選びリムーブ」等で使用)
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        // PA 短縮形 (refactor 2a): chooser=byPlayer は従来どおり srP (= a.player、操作者規約)。
        const srP = resolvePlayer(a.player, ctx);
        paShortFormAwait(s, verb, a, ctx, srP, srP);
        return;
      }
      // 「$pick」placeholder のまま atom-handler 到達 = pick で 0 枚選択された場合
      // (max: N で min=0 だと user が skip 可能)。silent no-op (log のみ)。
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneRemove', result: 'skipped' });
        return;
      }
      // BUG-068: bind ref ($matched.uid 等) 解決を配線
      const srUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof srUid !== 'string' || srUid.startsWith('$')) return;
      mutate.scene.removeToRemove(s, srUid, (a.cause as RemoveCause) ?? 'effect');
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneRemove', target: srUid });
      return;
    }
    case 'charRemoveSetCard': {
      // 2026-06-06 タスクC: キャラに裏向きでセットされたカードを1枚リムーブ (rules/16, B08034)。
      // PA 短縮形 (sceneRemove と同型): uid 不在 + n/max → pick query (filter hasSetCards:true で
      // セット card を持つキャラのみ候補化) を構築 + tryRePickFromAtom。max:1 は skip 可 → chain break で
      // 「リムーブしてもよい」を表現。resolve 後に removeOneSetCard で末尾 1 枚をリムーブエリアへ。
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        const rsP = resolvePlayer(a.player, ctx);
        paShortFormAwait(s, verb, a, ctx, rsP, rsP);
        return;
      }
      // max:1 で 0 枚選択 (skip) は uid='$pick' のまま到達 → silent no-op (sceneRemove 同型)。
      // chain の「そうした場合」break は skip 時の continuation-drop / no-candidate 時の
      // __chainStepNoApply (resolve-picks) が担うため、ここでは立てない。
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charRemoveSetCard', result: 'skipped' });
        return;
      }
      const rsUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof rsUid !== 'string' || rsUid.startsWith('$')) return;
      const removed = mutate.char.removeOneSetCard(s, rsUid);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charRemoveSetCard', target: rsUid, result: removed ?? 'none' });
      return;
    }
    case 'sceneToHand': {
      // engine-extension #4 (2026-06-05): char→hand bounce verb. PA 短縮形 (sceneRemove と同型)。
      // 「相手の現場のキャラを1枚まで選び、手札に移す」等で使用。所有者の手札に戻る点に注意。
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        const sthP = resolvePlayer(a.player, ctx);
        paShortFormAwait(s, verb, a, ctx, sthP, sthP);
        return;
      }
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneToHand', result: 'skipped' });
        return;
      }
      const sthUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof sthUid !== 'string' || sthUid.startsWith('$')) return;
      mutate.scene.toHand(s, sthUid);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneToHand', target: sthUid });
      return;
    }
    case 'sceneToDeck': {
      // Task D E2 (2026-06-12): scene→deck verb。sceneToHand と同型の PA 短縮形。
      // 「相手の現場のキャラを1枚まで選び、デッキの下に移す」(B07080/B08058/D10009 等)。
      // rules: 09/23 (リムーブでない=現場リムーブ時不発動), 16 (set/stacked リムーブ)
      // pos:'top' で「デッキの上に移す」(B05092)。移動先は所有者のデッキ。
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        // chooser=controller / side 既定=a.player (対象側) — BUG-120 系規約
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, resolvePlayer(a.player, ctx));
        return;
      }
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneToDeck', result: 'skipped' });
        return;
      }
      const stdUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof stdUid !== 'string' || stdUid.startsWith('$')) return;
      const stdPos = a.pos === 'top' ? 'top' : 'bottom';
      mutate.scene.toDeck(s, stdUid, stdPos);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneToDeck', target: stdUid, result: stdPos });
      return;
    }
    case 'sceneSetState': {
      // PA 短縮形: uid 不在 + player + state(設定する状態の文字列) + n|max → scene pick を構築。
      // a.state は「設定先の状態」なので候補 filter には載せない (buildShortFormPick は配列 state のみ拾う)。
      if (a.uid === undefined && typeof a.player === 'string' && typeof a.state === 'string' && hasNorMax(a)) {
        paShortFormAwait(s, verb, a, ctx, resolvePlayer(a.player, ctx), 'either');
        return;
      }
      const ssUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof ssUid !== 'string' || ssUid.startsWith('$')) return;
      const ssState = a.state as 'active' | 'sleep' | 'stun';
      mutate.scene.setState(s, ssUid, ssState);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneSetState', target: ssUid, result: ssState });
      return;
    }
    case 'sceneDisguise': {
      // BUG-068: bind ref 解決を配線
      const dgUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof dgUid !== 'string' || dgUid.startsWith('$')) return;
      const dgNewCardId = resolveBindRef(a.newCardId, ctx) as string;
      if (typeof dgNewCardId !== 'string' || dgNewCardId.startsWith('$')) return;
      mutate.char.disguiseInto(s, dgUid, dgNewCardId);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:sceneDisguise', target: dgUid, result: dgNewCardId });
      return;
    }

    // --- キャラ修正 ---
    case 'charModifyAP': {
      // D11014 a1 driver: PA 短縮形 — uid 不在 + delta + n/max なら pick query 構築 + tryRePickFromAtom
      // (sceneRemove 短縮形と同 pattern。「キャラを1枚まで選び AP±N」を declarative に表現)
      if (a.uid === undefined && isShortFormDelta(a.delta) && hasNorMax(a)) {
        // PA 短縮形 (dyn-delta 対応): side 既定='either', chooser=controller。
        // delta:{dyn} は pushPendingEffectPickSide / AI 経路の resolveDynArgs で literal 化される (BUG-085)。
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, 'either');
        return;
      }
      // skip-unresolved: max:N の pick が user skip (pickedUid=null) で resolve された後の handler 呼出
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyAP', result: 'skipped' });
        return;
      }
      const maUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof maUid !== 'string' || maUid.startsWith('$')) return;
      const maDelta = resolveDeltaToNumber(a.delta, s, ctx);
      const maScope = a.scope as 'turn' | 'contact' | 'permanent' | 'action';
      mutate.char.modifyAP(s, maUid, maDelta, maScope);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyAP', target: maUid, result: `${maDelta >= 0 ? '+' : ''}${maDelta}/${maScope}` });
      return;
    }
    case 'charModifyLP': {
      // PA 短縮形 (charModifyAP と同型, dyn-delta 対応): chooser/byPlayer=ctx.source.player, side 既定='either'。
      if (a.uid === undefined && isShortFormDelta(a.delta) && hasNorMax(a)) {
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, 'either');
        return;
      }
      // skip-unresolved: max:N の pick が user skip (pickedUid=null) で resolve された後の handler 呼出。
      // 機能的には下の startsWith('$') guard でも return するが、charModifyAP/Level と対称化し 'skipped' log を残す
      // (2026-06-08 adversarial review でハンドラ非対称を指摘)。
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLP', result: 'skipped' });
        return;
      }
      const mlUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof mlUid !== 'string' || mlUid.startsWith('$')) return;
      const mlDelta = resolveDeltaToNumber(a.delta, s, ctx);
      const mlScope = a.scope as 'turn' | 'contact' | 'permanent' | 'action';
      mutate.char.modifyLP(s, mlUid, mlDelta, mlScope);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLP', target: mlUid, result: `${mlDelta >= 0 ? '+' : ''}${mlDelta}/${mlScope}` });
      return;
    }
    case 'charModifyLevel': {
      // engine-extension #2 (2026-06-05): PA 短縮形 (charModifyAP/LP と同型, dyn-delta 対応)
      if (a.uid === undefined && isShortFormDelta(a.delta) && hasNorMax(a)) {
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, 'either');
        return;
      }
      // skip-unresolved: max:N の pick が user skip (pickedUid=null) で resolve された後の handler 呼出
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLevel', result: 'skipped' });
        return;
      }
      const mlvUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof mlvUid !== 'string' || mlvUid.startsWith('$')) return;
      const mlvDelta = resolveDeltaToNumber(a.delta, s, ctx);
      const mlvScope = a.scope as 'turn' | 'contact' | 'permanent' | 'action';
      mutate.char.modifyLevel(s, mlvUid, mlvDelta, mlvScope);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLevel', target: mlvUid, result: `${mlvDelta >= 0 ? '+' : ''}${mlvDelta}/${mlvScope}` });
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
      // BUG-068: bind ref 解決を配線
      const oaUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof oaUid !== 'string' || oaUid.startsWith('$')) return;
      const oaVal = a.val as number | null;
      mutate.char.setOverrideAP(s, oaUid, oaVal);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charOverrideAP', target: oaUid, result: oaVal === null ? 'reset' : String(oaVal) });
      return;
    }
    case 'charOverrideLP': {
      // BUG-068: bind ref 解決を配線
      const olUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof olUid !== 'string' || olUid.startsWith('$')) return;
      const olVal = a.val as number | null;
      mutate.char.setOverrideLP(s, olUid, olVal);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charOverrideLP', target: olUid, result: olVal === null ? 'reset' : String(olVal) });
      return;
    }
    case 'charGrantKeyword': {
      // Task D E0 addendum (2026-06-12): PA 短縮形対応 (B09032 解禁条件)。
      // 明示 uid:'$pick'+target 形は初期 walk push となり human 経路で後続 step の bind が
      // 喪失するため、pick carrier に使う場合は短縮形 (runtime push) が必須。
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, resolvePlayer(a.player, ctx));
        return;
      }
      if (a.uid === '$pick' && (a as { target?: unknown }).target === undefined) {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charGrantKeyword', result: 'skipped' });
        return;
      }
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
      // BUG-068: bind ref 解決を配線
      const doUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof doUid !== 'string' || doUid.startsWith('$')) return;
      mutate.char.disableOriginalAbilities(s, doUid);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charDisableOriginal', target: doUid });
      return;
    }
    case 'charGrantAbility': {
      // Task D E4 (2026-06-12): triggered ability の動的付与。args:
      //   { uid|'$pick'+target, ability: { id?, trigger, condition?, limit?, effect }, scope:'turn' }
      // descriptor は turnEffects.grantedAbilities[] に積まれ、triggered.ts handleHook が
      // def.abilities と合算走査。清掃は clearTurnEffects('turn')。validate.ts が JSON 性と
      // trigger.hook の許可リストを enforce (rules/15, 19)。
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, resolvePlayer(a.player, ctx));
        return;
      }
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charGrantAbility', result: 'skipped' });
        return;
      }
      const cgaUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof cgaUid !== 'string' || cgaUid.startsWith('$')) return;
      const abilitySpec = a.ability;
      if (!abilitySpec || typeof abilitySpec !== 'object') return;
      const spec = abilitySpec as Record<string, unknown>;
      // granted id namespace (limit:{turn} の declaredUseCount キーとして機能する)
      const grantedId = typeof spec.id === 'string'
        ? spec.id
        : `granted:${ctx.source.cardId ?? '?'}:${ctx.source.abilityId ?? '?'}`;
      const grantedDef = {
        ...spec,
        id: grantedId,
        type: 'triggered',
        scope: 'on-scene',
        description: typeof spec.description === 'string' ? spec.description : '(granted)',
      };
      mutate.char.grantAbility(s, cgaUid, grantedDef);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charGrantAbility', target: cgaUid, result: grantedId });
      return;
    }
    case 'charSetTurnEffect': {
      const teUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof teUid !== 'string' || teUid.startsWith('$')) return;
      const teKey = a.key as string;
      mutate.char.setTurnEffect(s, teUid, teKey, a.val);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetTurnEffect', target: teUid, result: `${teKey}=${String(a.val)}` });
      return;
    }
    case 'charSetCard': {
      // engine-extension #5b PA短縮形 (2026-06-05 残課題解消):
      // uid 未指定 + fromDeckTop + n/max で「キャラを N 枚まで選び、デッキ上端を裏向きでセット」
      // を declarative に表現できる (B02020/B02023/B02030 系)。sceneRemove/sceneToHand と同型。
      if (a.uid === undefined && a.fromDeckTop && typeof a.player === 'string' && hasNorMax(a)) {
        // scsP = deck-source / 既定 side (a.player 側、'opp' なら相手の現場/デッキを対象)。
        // BUG-120: 選択者 (chooser/byPlayer) は a.player ではなく **controller** (ctx.source.player)。
        //   旧コードは byPlayer=scsP を渡し、player:'opp' (B02020/B03032) で『controller が相手キャラを
        //   選ぶ』が「相手が選ぶ」に化けていた (charModifyAP/LP/Level は byPlayer=ctx.source.player で正)。
        //   deck-source は後段 resolve (L798 resolvePlayer(a.player)) が a.player を別途参照するため不変。
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, resolvePlayer(a.player, ctx));
        return;
      }
      // skip-unresolved: max:N の pick が user skip (pickedUid=null) で resolve された後の handler 呼出
      if (a.uid === '$pick') {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', result: 'skipped' });
        return;
      }
      // BUG-068: bind ref 解決を配線
      const scUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof scUid !== 'string' || scUid.startsWith('$')) return;
      // engine-extension #5b (2026-06-05): fromDeckTop オプション。
      // 「自分のデッキのカードを上から1枚裏向きでセットする」(B02018/B02020/B02023/B02030/B08054)
      // 系で使用。a.player (既定 'self') の deck.shift で 1 枚 splice → そのまま setCard。
      // (cardId 引数は無視、自動補完される)
      let scCardId: string;
      if (a.fromDeckTop) {
        const sscP = resolvePlayer(a.player ?? 'self', ctx);
        const sscDeck = s.players[sscP].deck;
        if (sscDeck.length === 0) {
          mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', target: scUid, result: 'empty-deck' });
          return;
        }
        scCardId = sscDeck.shift()!;
      } else {
        scCardId = resolveBindRef(a.cardId, ctx) as string;
        if (typeof scCardId !== 'string' || scCardId.startsWith('$')) return;
      }
      mutate.char.setCard(s, scUid, scCardId, a.faceUp as boolean);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', target: scUid, result: scCardId });
      return;
    }
    case 'charStackCard': {
      // D08021 driver 2026-05-26: sceneEnter (line 374) と同型の pick-await + source-area cleanup pattern を流用。
      //   - 旧 contract: { uid, n } → 即 stackedCards += n (本パスを末尾に維持)
      //   - 新 contract: { uid:'$self', cardIds:'$pick.cardIds', target:{kind:'pick',...,n:{min,max}} }
      //     → cardIds 未解決時 side-channel queue で modal、resolve 後に
      //       stack count=cardIds.length + 各 cardId を source area から splice
      //   - multi-pick (n>1) は UI 側 (CardListModal nMax>1 multi-select) と
      //     useEngineDispatch.ts effectPickResolve dispatcher の協調で実装。
      const stUid = resolveBindRef(a.uid, ctx) as string;
      const rawCardIds = a.cardIds;
      // 新 multi-pick contract: cardIds が array (resolved) or '$pick.cardIds' (await)
      if (rawCardIds === '$pick.cardIds') {
        if (a.target && typeof a.target === 'object') {
          const ctxP = ctx.source.player ?? 'self';
          // D08021 driver 2026-05-26: $self は ctx.source.uid に依存するが、effectPickResolve
          // 経由の re-dispatch では ctx.source.uid が drop される (useEngineDispatch.ts は
          // { player, cardId } のみ渡す)。tryRePickFromAtom 呼出時点で stUid に置換しておき、
          // 再 dispatch 時に handler が resolveBindRef を再実行しても解決済 uid を使えるよう保証。
          const argsWithResolvedUid = { ...a, uid: stUid };
          tryRePickFromAtom(s, { kind: 'atom', verb, args: argsWithResolvedUid }, ctx, {
            byPlayer: ctxP,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, {
            ts: Date.now(), player: ctxP, turn: s.turn.number,
            action: 'effect:charStackCard:awaiting-pick',
          });
        }
        return; // pick query 無し or await 完了 → no-op return
      }
      if (Array.isArray(rawCardIds)) {
        const cardIds = rawCardIds as string[];
        if (cardIds.length === 0) {
          // skip (n.min=0 で 0 枚 pick) → no-op + log
          mutate.log.append(s, {
            ts: Date.now(), player: ctx.source.player, turn: s.turn.number,
            action: 'effect:charStackCard', target: stUid, result: '0',
          });
          return;
        }
        const sourceArea = ((a.target && typeof a.target === 'object')
          ? ((a.target as { query?: { area?: string; side?: string } }).query?.area)
          : undefined) as 'remove' | 'hand' | 'deck' | undefined;
        const sourceSide = ((a.target && typeof a.target === 'object')
          ? ((a.target as { query?: { side?: string } }).query?.side)
          : undefined) as 'self' | 'opp' | undefined;
        const ownerP = ctx.source.player ?? 'self';
        if (sourceArea === 'remove' || sourceArea === 'hand' || sourceArea === 'deck') {
          const fromPlayer = sourceSide === 'opp' ? 'opp' : ownerP;
          const arr = (s.players[fromPlayer] as unknown as Record<string, string[]>)[sourceArea];
          for (const cid of cardIds) {
            const idx = arr?.indexOf(cid) ?? -1;
            if (idx !== -1) arr.splice(idx, 1);
          }
        }
        mutate.char.stackCard(s, stUid, cardIds.length);
        mutate.log.append(s, {
          ts: Date.now(), player: ownerP, turn: s.turn.number,
          action: 'effect:charStackCard', target: stUid, result: cardIds.join(','),
        });
        return;
      }
      // legacy: { uid, n }
      const stN = a.n as number;
      mutate.char.stackCard(s, stUid, stN);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charStackCard', target: stUid, result: String(stN) });
      return;
    }

    // --- パートナー / 事件 ---
    case 'partnerAssist': {
      const paP = resolvePlayer(a.player, ctx);
      mutate.partner.assist(s, paP);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: paP, turn: s.turn.number, action: 'effect:partnerAssist' });
      return;
    }
    case 'partnerSetState': {
      const psP = resolvePlayer(a.player, ctx);
      const psState = a.state as 'active' | 'sleep' | 'stun';
      mutate.partner.setState(s, psP, psState);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: psP, turn: s.turn.number, action: 'effect:partnerSetState', result: psState });
      return;
    }
    case 'partnerSolveCase': {
      const scP = resolvePlayer(a.player, ctx);
      mutate.partner.solveCase(s, scP);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: scP, turn: s.turn.number, action: 'effect:partnerSolveCase' });
      return;
    }
    case 'caseToResolved': {
      const p = resolvePlayer(a.player, ctx);
      // BUG-089: case:to-resolved hook emit は mutate.case.toResolved に集約
      // (assist / FILE>=7 自動移行を含む全移行経路で発火させるため)。ここでの二重 emit は不要。
      mutate.case.toResolved(s, p);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:caseToResolved' });
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
      const p = resolvePlayer(a.player, ctx);
      // BUG-045 fix: filter は declarative TargetFilter object として渡される
      // (D11019.ts 等)。predicate 関数化して使用 (旧コードは function を期待していて crash)。
      const filterArg = a.filter as TargetFilter | ((cardId: string) => boolean) | undefined;
      const filter = typeof filterArg === 'function'
        ? filterArg
        : targetFilterToPredicate(filterArg);
      const bindKey = a.bind as string | undefined;
      const bindMatchKey = a.bindMatch as string | undefined;
      // ---- BUG-132 GAP-1 再入 path (chooseMatch pick 解決後) ----
      // take: applyPickAndContinuation (Pattern B 無マーカー分岐) が target=[cardId] を載せる。
      // decline: applyPickSkipAndContinuation が __declined:true を載せる (「〜まで」=0枚可、rules/15)。
      // window は first-run の snapshot (__windowIds) を使う — pick await 中の deck 変動に影響されない。
      if (a.__windowIds !== undefined) {
        const windowIds = a.__windowIds as string[];
        const declined = a.__declined === true;
        const chosen = declined
          ? null
          : Array.isArray(a.target) ? ((a.target as string[])[0] ?? null) : null;
        if (bindMatchKey) {
          ctx.bindings[bindMatchKey] = chosen
            ? [{ kind: 'card', cardId: chosen, area: 'deck', player: p }]
            : [];
        }
        if (bindKey) {
          // decline 時は全 reveal が「残り」(公式: 加えなければ全部デッキ下へ。B08020 公式Q&A)
          let restIds: string[];
          if (chosen === null) {
            restIds = windowIds;
          } else {
            const idx = windowIds.indexOf(chosen);
            restIds = idx === -1 ? windowIds : [...windowIds.slice(0, idx), ...windowIds.slice(idx + 1)];
          }
          ctx.bindings[bindKey] = restIds.map<Candidate>(id => ({
            kind: 'card', cardId: id, area: 'deck', player: p,
          }));
        }
        // overlay: 確定 matched で再 set (awaitingPick 無し → hold 解除、通常演出で完了)
        (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | null }).__pendingDeckRevealSide = {
          player: p,
          revealed: [...windowIds],
          matched: chosen,
        };
        mutate.log.append(s, {
          ts: Date.now(), player: p, turn: s.turn.number,
          action: 'effect:deckRevealUntil',
          result: `revealed=${windowIds.length} matched=${chosen ?? (declined ? 'declined' : 'none')}`,
        });
        return;
      }
      const deck = s.players[p].deck;
      const revealed: string[] = [];
      let matched: string | null = null;
      // engine-extension #5a (2026-06-05): maxN — "上から N 枚見る" 系。
      // maxN 指定時: 上から min(deck.length, maxN) 枚を **全件** reveal してから最初の match を選ぶ。
      //   $matched = 最初の match (or null) / $revealed = match を除いた残りの全 reveal カード。
      //   この semantics で「上から N 枚見て、その中から該当 1 枚を取り、残りはデッキ下」が成立。
      // maxN 未指定時: 従来通り (filter match まで or デッキ末尾まで reveal、match で stop)。
      const maxN = a.maxN as number | undefined;
      if (maxN !== undefined) {
        // 公式テキスト "上から N 枚見る" — N 枚を全件 reveal し、その中から最初の match を採用
        const lookN = Math.min(deck.length, maxN);
        for (let i = 0; i < lookN; i++) {
          revealed.push(deck[i]!);
        }
        for (const cardId of revealed) {
          if (filter(cardId)) {
            matched = cardId;
            break;
          }
        }
      } else {
        // 従来 semantics: filter match まで 1 枚ずつ reveal、match で停止
        for (const cardId of deck) {
          revealed.push(cardId);
          if (filter(cardId)) {
            matched = cardId;
            break;
          }
        }
      }
      // ---- BUG-132 GAP-1: chooseMatch:'upTo' (「1枚まで」型) — human owner は取得/decline/identity を選択 ----
      // rules/15 「〜枚まで」=0枚可 + B08020 公式Q&A「条件を満たすカードがあっても手札に加えないことは可能」。
      // owner (効果所有者) が human のときのみ pick を surface。AI は従来 path (先頭 match 自動取得 =
      // 合法手内の固定戦略、rules/15 の選択『権』であり義務でない。smoke baseline 不変)。
      // 「まで」無し forced 型 (B01048 等 10枚) は chooseMatch を持たず本分岐に入らない (従来動作が正)。
      if (a.chooseMatch === 'upTo' && maxN !== undefined) {
        const humanSide = (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
        const owner = ctx.source.player;
        if (humanSide !== null && owner === humanSide) {
          // window 内の全 match を候補化 (従来は先頭 1 件のみ機械束縛 — identity 選択も surface)
          const matchCands = revealed
            .map((cardId, i) => ({ cardId, i }))
            .filter(({ cardId }) => filter(cardId));
          if (matchCands.length > 0) {
            pushPendingPickFromAtom({
              player: owner,
              candidates: matchCands.map(({ cardId, i }) => ({ uid: `${cardId}#${i}`, cardId, player: p })),
              atomVerb: 'deckRevealUntil',
              // 再入用に window snapshot を同梱 (deck 再走査しない)。chooseMatch 等の元 args も保持。
              // BUG-132: toPlainDeep — drafted entry.effect 由来の nested object (filter 等) を
              // plain 化して produce 境界を安全に跨ぐ (revoked-proxy crash 防止)
              atomArgs: toPlainDeep({ ...(a as Record<string, unknown>), __windowIds: [...revealed] }),
              nMin: 0, // 「まで」= 0枚可 → EffectPickerModal が「対象を選ばない」を表示 (既存配線)
              nMax: 1,
              source: {
                cardId: ctx.source.cardId ?? '',
                abilityId: (ctx.source as { abilityId?: string }).abilityId ?? '',
              },
              skipResolvesAtom: true,
            });
            // overlay は hold mode — pick 解決まで公開リストを表示し続ける (自動進行しない)
            (globalThis as { __pendingDeckRevealSide?: PendingDeckRevealSide | null }).__pendingDeckRevealSide = {
              player: p,
              revealed: [...revealed],
              matched: null,
              awaitingPick: true,
            };
            mutate.log.append(s, {
              ts: Date.now(), player: p, turn: s.turn.number,
              action: 'effect:deckRevealUntil',
              result: `revealed=${revealed.length} awaiting-pick (matches=${matchCands.length})`,
            });
            // bind 未書込のまま return → resolver の queue 増加検知が残り step を pick に同梱して停止
            return;
          }
          // match 0 件 → 従来 path へ fallthrough ($matched=[] bind、conditional 不発)
        }
      }
      // bindings に Candidate[] として保存
      // { kind: 'card', cardId, area: 'deck', player } は Candidate の card バリアントに適合する
      if (bindKey) {
        // 旧 semantics (maxN 未指定): match は revealed の最後尾 → slice(0,-1) で除く
        // 新 semantics (maxN 指定): match は revealed の任意位置 → matched の最初の出現を除外
        let restIds: string[];
        if (matched === null) {
          restIds = revealed;
        } else if (maxN === undefined) {
          restIds = revealed.slice(0, -1);
        } else {
          // 最初の matched 出現を 1 件だけ除く (同 cardId 複数あっても 1 件のみ拾われる前提)
          const idx = revealed.indexOf(matched);
          restIds = idx === -1 ? revealed : [...revealed.slice(0, idx), ...revealed.slice(idx + 1)];
        }
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
      const p = resolvePlayer(a.player, ctx);
      const bindKey = a.bindKey as string;
      const bound = ctx.bindings[bindKey];
      if (!bound || bound.length === 0) return;
      // Candidate から cardId を抽出 → デッキ下へ
      const ids = bound.map(c => {
        const cAny = c as unknown as { cardId?: string };
        return cAny.cardId ?? '';
      }).filter(id => id !== '');
      // 元のデッキから該当 ID を除去 (deckRevealUntil で公開された分はまだデッキにある)
      // BUG-132 GAP-1 防御: 実際に splice できた id のみ bottom へ移す。chooseMatch の pick await 中に
      // 他 pending entry が deck を消費した場合 (同時 trigger の window 侵食、低確率)、deck に無い id を
      // 無条件 push すると複製が生まれるため (敵対レビュー impl lens 指摘)。
      const deck = s.players[p].deck;
      const splicedIds: string[] = [];
      for (const id of ids) {
        const idx = deck.indexOf(id);
        if (idx !== -1) {
          deck.splice(idx, 1);
          splicedIds.push(id);
        }
      }
      mutate.deck.toBottom(s, p, splicedIds);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckToBottomBound', result: String(splicedIds.length) });
      return;
    }
    case 'boundToRemove': {
      // wave#2 cluster2 (2026-06-12): bound window (deckRevealUntil 公開分) をリムーブエリアへ移す
      // (B09073 a2「残りをリムーブエリアに移す」)。rules/26: 見ている間はデッキ扱い → 本 verb で
      // 初めてデッキから出る。deckToBottomBound と同じ splice 防御 (BUG-132 窓侵食複製ガード):
      // 実際に splice できた id のみ remove へ。移送完了後にデッキ 0 なら refresh
      // (B09073 qAndA「残りをリムーブエリアに移す。まで解決したところでリフレッシュ」/ rules/14。
      // 直前に remove へ移したカード自身も shuffle 対象 — rules/26 リムーブエリア遷移)。
      const p = resolvePlayer(a.player, ctx);
      const bindKey = a.bindKey as string;
      const bound = ctx.bindings[bindKey];
      if (!bound || bound.length === 0) return;
      const ids = bound.map(c => {
        const cAny = c as unknown as { cardId?: string };
        return cAny.cardId ?? '';
      }).filter(id => id !== '');
      const deck = s.players[p].deck;
      const splicedIds: string[] = [];
      for (const id of ids) {
        const idx = deck.indexOf(id);
        if (idx !== -1) {
          deck.splice(idx, 1);
          splicedIds.push(id);
        }
      }
      mutate.remove.add(s, p, splicedIds);
      if (s.players[p].deck.length === 0) {
        const r = mutate.deck.refresh(s, p);
        if (!r.ok && s.gameResult === undefined) {
          const winner: Player = p === 'self' ? 'opp' : 'self';
          mutate.gameResult.set(s, winner, 'deck-out');
        }
      }
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:boundToRemove', result: String(splicedIds.length) });
      return;
    }
    case 'deckShuffle': {
      // rules/04, 14, 26 — デッキ基本シャッフル (D11019 等で使用)
      const p = resolvePlayer(a.player, ctx);
      mutate.deck.shuffle(s, p, ctx.rng);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckShuffle' });
      return;
    }
    case 'removeAreaAllToDeckBottom': {
      // cluster4 (2026-06-14) B08027【登場時】: 自分と相手はリムーブエリアの「すべて」のカードを
      //   各自のデッキの下に移し、両者のデッキをシャッフルする。
      // ⚠ 'self'/'opp' は **絶対スロット** を意図的に走査する (resolvePlayer しない)。この verb は
      //   両プレイヤーに対称な操作 (各自の remove → 各自の deck → 各自 shuffle) なので、所有者相対では
      //   なく両スロット網羅で「自分と相手」を表現する。BUG-079 の owner-relative 規約とは別物。
      // rules/14・26: デッキへ移すだけで 0 にならない → これは「リフレッシュ」ではない (証拠付与なし、
      //   公式Q&A)。よって mutate.deck.refresh は呼ばず raw splice + toBottom + shuffle で行う。
      // rules/09・23: デッキ下移動はリムーブでないため leave hook は発火しない (raw splice)。
      // 公式テキスト通り、移動枚数 0 (remove 空) のプレイヤーも無条件でシャッフルする。
      // shuffle は ctx.rng があれば使い、無ければ mutate.deck.shuffle 内の Math.random
      //   (smoke では seeded RNG に global override されている) を使う (deckShuffle と同一契約)。
      for (const pp of ['self', 'opp'] as const) {
        const rem = s.players[pp].remove;
        if (rem.length > 0) {
          const ids = rem.splice(0, rem.length); // ALL — remove を drain
          mutate.deck.toBottom(s, pp, ids);       // 各自のデッキ下へ
        }
        mutate.deck.shuffle(s, pp, ctx.rng);
      }
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:removeAreaAllToDeckBottom' });
      return;
    }
    case 'souza': {
      // rules/13 §捜査X: defender (player) のデッキ上 X 枚を、defender の好きな順で
      // デッキの下に移す。Sub-task A (Phase 5 advance): peek 順そのまま (= defender が
      // 順番変更しない default)。AI policy chooseSouzaOrder は将来 Sub-task B/C で
      // listener / dispatcher 経由で呼ぶ予定。「発見された」参照効果は scope 外。
      const player = resolvePlayer(a.player, ctx);
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

    // --- ターンスコープ flag ---
    case 'setEventUseBan': {
      // cluster6 (2026-06-14) B09034/B09034P「このターン中、自分はイベントを使用できない。
      //   （能力や効果によっても使用できない）」。turnState[p].eventUseBanned=true をセットする
      //   turn-scoped flag verb。player 省略時は所有者 (resolvePlayer 規約: 'self'=ctx.source.player)。
      // ゲート: hand-use-card.ts handUseGateCommon / next-hint.ts (いずれも d.kind==='event' のみ)。
      //   turn:start の mutate.flag.resetTurnFlags が false に戻す。
      // 公式 Q&A (rules/25): 【カットイン】【ヒラメキ】は本制限を受けない → contact.ts / hirameki は touch しない。
      //   「イベントを使用する」効果 verb は engine に未実装 (どのカードも生成しない) → ゲート不要。
      // rules: 25 (公式 Q&A) / 12 (ネクストヒント) / 06 (イベント使い切り)
      const seubP = resolvePlayer(a.player ?? 'self', ctx);
      s.turnState[seubP].eventUseBanned = true;
      mutate.log.append(s, { ts: Date.now(), player: seubP, turn: s.turn.number, action: 'effect:setEventUseBan' });
      return;
    }
    case 'setHiramekiSuppress': {
      // cluster8 (2026-06-15) B06049 a2「このキャラがアクション[事件]したとき、アクション終了時まで
      //   相手の【ヒラメキ】は発動しない」。turnState[p].hiramekiSuppressed=true をセットする
      //   action-scoped flag verb。a2 は player:'opp' で呼ぶ (source=B06049 所有者 → 相手 = 証拠を失う側)。
      // ゲート: listeners/triggered.ts handleEvidenceRemovedHook が payload.player の本フラグを見て抑止。
      //   清掃: state-machine.ts contact-end→action-end で両プレイヤー分 false (主)、turn:start backstop。
      // rules: 10 (アクション[事件]/ヒラメキ) / 13 (キーワード) / 22 (アクション宣言時に発動)
      const shsP = resolvePlayer(a.player ?? 'self', ctx);
      s.turnState[shsP].hiramekiSuppressed = true;
      mutate.log.append(s, { ts: Date.now(), player: shsP, turn: s.turn.number, action: 'effect:setHiramekiSuppress' });
      return;
    }

    // --- メタ ---
    case 'log': {
      const entry: LogEntry = {
        ts: (a.ts as number | undefined) ?? Date.now(),
        player: a.player !== undefined ? resolvePlayer(a.player, ctx) : (ctx.source.player as Player),
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

    // D11007 v2 Phase 3 → refactor 1b (2026-06-12): declarative marker verb (下記コメント参照)
    case 'expandActionTargets': {
      // refactor 1b (2026-06-12): 旧実装は __pendingActionExpansion side-channel に push して
      // いたが消費者ゼロの dead code だった (Task D E4 grounding で grep 確認)。実際の対象拡張は
      // target-expander.ts applyPreTargetExpansion が **カード def の本 atom の args を静的 walk**
      // して読む (D11007/B01028/B05071) ため、verb 自体は declarative marker として必要。
      // handler は log のみの no-op とする (付与版は turnEffects.actionTargetsActive — Task D E4)。
      mutate.log.append(s, {
        ts: Date.now(),
        player: ctx.source.player,
        turn: s.turn.number,
        action: 'effect:expandActionTargets',
        target: ctx.source.uid ?? '',
      });
      return;
    }

    default: {
      // exhaustiveness check
      const _exhaustive: never = verb;
      throw new Error(`unknown atom verb: ${String(_exhaustive)}`);
    }
  }
}
