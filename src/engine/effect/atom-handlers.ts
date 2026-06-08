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
import { ATOM_PICK_SPEC, buildShortFormPick, isShortFormDelta } from './atom-pick-spec.js';
import { evalDyn } from '../dyn/eval.js'; // BUG-114: explicit-uid charModifyAP/LP/Level の {dyn} delta を runtime 評価

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

export function runAtom(s: GameState, verb: AtomVerb, args: unknown, ctx: EffectCtx): void {
  const a = args as Record<string, unknown>;
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
      mutate.log.append(s, { ts: Date.now(), player: millP, turn: s.turn.number, action: 'effect:mill', result: String(millN) });
      return;
    }
    case 'fileAdd': {
      // BUG-073: effect log
      const faP = resolvePlayer(a.player, ctx);
      const faN = a.n as number;
      mutate.file.addFromDeckTop(s, faP, faN);
      mutate.log.append(s, { ts: Date.now(), player: faP, turn: s.turn.number, action: 'effect:fileAdd', result: String(faN) });
      return;
    }
    case 'filePopToHand': {
      const p = resolvePlayer(a.player, ctx);
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
      const p = resolvePlayer(a.player, ctx);
      const n = a.n as number;
      mutate.evidence.addFromDeck(s, p, n, false, { turn: s.turn.number, via: 'effect' });
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceGain', result: String(n) });
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
      event.emit(s, 'enter', {
        uid: newChar.uid,
        viaEffect,
        enterOrder: newChar.enterOrder,
        enterOrderThisTurn: newChar.enterOrderThisTurn,
      }, ctx.source);
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
      event.emit(s, 'enter', {
        uid: newChar.uid,
        viaEffect,
        enterOrder: newChar.enterOrder,
        enterOrderThisTurn: newChar.enterOrderThisTurn,
      }, ctx.source);
      return;
    }
    case 'sceneRemove': {
      type RemoveCause = 'contact-ap' | 'effect' | 'switch' | 'cost' | 'misplay-overflow';
      // 物理動作 atom 化 (拡張 3): 短縮形 { player, n or max, side, filter } で uid 不在
      // の場合、PA pick query を構築 + tryRePickFromAtom で side-channel set + awaiting-pick log。
      // (D08003 a1 step 2 「現場 AP≤8000 を1枚まで選びリムーブ」等で使用)
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        // PA 短縮形: pick query 構築は buildShortFormPick に集約 (side 既定=srP, state 配列=状態フィルタ pass-through)。
        // uid='$pick' を明示して PA branch に乗せる。byPlayer は従来どおり srP (= a.player) を維持。
        const srP = resolvePlayer(a.player, ctx);
        const paTarget = buildShortFormPick('scene', a, srP, srP);
        const paArgs = { ...a, uid: '$pick', target: paTarget };
        tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, { byPlayer: srP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: srP, turn: s.turn.number, action: 'effect:sceneRemove:awaiting-pick' });
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
        const paTarget = buildShortFormPick('scene', a, rsP, rsP);
        const paArgs = { ...a, uid: '$pick', target: paTarget };
        tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, { byPlayer: rsP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: rsP, turn: s.turn.number, action: 'effect:charRemoveSetCard:awaiting-pick' });
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
        const paTarget = buildShortFormPick('scene', a, sthP, sthP);
        const paArgs = { ...a, uid: '$pick', target: paTarget };
        tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, { byPlayer: sthP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: sthP, turn: s.turn.number, action: 'effect:sceneToHand:awaiting-pick' });
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
    case 'sceneSetState': {
      // PA 短縮形: uid 不在 + player + state(設定する状態の文字列) + n|max → scene pick を構築。
      // a.state は「設定先の状態」なので候補 filter には載せない (buildShortFormPick は配列 state のみ拾う)。
      if (a.uid === undefined && typeof a.player === 'string' && typeof a.state === 'string' && hasNorMax(a)) {
        const ssP = resolvePlayer(a.player, ctx);
        const paTarget = buildShortFormPick('scene', a, ssP, 'either');
        const paArgs = { ...a, uid: '$pick', target: paTarget };
        tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, { byPlayer: ssP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: ssP, turn: s.turn.number, action: 'effect:sceneSetState:awaiting-pick' });
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
        // PA 短縮形 (dyn-delta 対応): side 既定='either', chooser/byPlayer=ctx.source.player を維持。
        // delta:{dyn} は pushPendingEffectPickSide / AI 経路の resolveDynArgs で literal 化される (BUG-085)。
        const maP = ctx.source.player as Player;
        const paTarget = buildShortFormPick('scene', a, maP, 'either');
        const paArgs = { ...a, uid: '$pick', target: paTarget };
        tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, { byPlayer: maP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyAP:awaiting-pick' });
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
      const maScope = a.scope as 'turn' | 'contact' | 'permanent';
      mutate.char.modifyAP(s, maUid, maDelta, maScope);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyAP', target: maUid, result: `${maDelta >= 0 ? '+' : ''}${maDelta}/${maScope}` });
      return;
    }
    case 'charModifyLP': {
      // PA 短縮形 (charModifyAP と同型, dyn-delta 対応): chooser/byPlayer=ctx.source.player, side 既定='either'。
      if (a.uid === undefined && isShortFormDelta(a.delta) && hasNorMax(a)) {
        const mlP = ctx.source.player as Player;
        const paTarget = buildShortFormPick('scene', a, mlP, 'either');
        const paArgs = { ...a, uid: '$pick', target: paTarget };
        tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, { byPlayer: mlP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLP:awaiting-pick' });
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
      const mlScope = a.scope as 'turn' | 'contact' | 'permanent';
      mutate.char.modifyLP(s, mlUid, mlDelta, mlScope);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLP', target: mlUid, result: `${mlDelta >= 0 ? '+' : ''}${mlDelta}/${mlScope}` });
      return;
    }
    case 'charModifyLevel': {
      // engine-extension #2 (2026-06-05): PA 短縮形 (charModifyAP/LP と同型, dyn-delta 対応)
      if (a.uid === undefined && isShortFormDelta(a.delta) && hasNorMax(a)) {
        const mlvP = ctx.source.player as Player;
        const paTarget = buildShortFormPick('scene', a, mlvP, 'either');
        const paArgs = { ...a, uid: '$pick', target: paTarget };
        tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, { byPlayer: mlvP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLevel:awaiting-pick' });
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
      const mlvScope = a.scope as 'turn' | 'contact' | 'permanent';
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
        const scsP = resolvePlayer(a.player, ctx);
        const scsChooser = ctx.source.player as Player;
        const paTarget = buildShortFormPick('scene', a, scsChooser, scsP);
        const paArgs = { ...a, uid: '$pick', target: paTarget };
        tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, { byPlayer: scsChooser, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: scsChooser, turn: s.turn.number, action: 'effect:charSetCard:awaiting-pick' });
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
      const p = resolvePlayer(a.player, ctx);
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

    // D11007 v2 Phase 3: action target 拡張仕様を transient side-channel に push
    // candidates() (target-expander.ts) が emit する action:pre-target hook の listener が
    // この atom を queue → resolver が drain → ここで __pendingActionExpansion に push →
    // candidates() が pop して enumeration に merge
    case 'expandActionTargets': {
      const g = globalThis as {
        __pendingActionExpansion?: Array<{
          byUid: string;
          side: 'self' | 'opp' | 'either';
          state?: ('active' | 'sleep' | 'stun')[];
          levelMin?: number;
          levelMax?: number;
        }>;
      };
      if (!g.__pendingActionExpansion) g.__pendingActionExpansion = [];
      const byUid = ctx.source.uid;
      if (!byUid) return; // source.uid 不在ならスキップ (defensive)
      g.__pendingActionExpansion.push({
        byUid,
        side: (a.side as 'self' | 'opp' | 'either' | undefined) ?? 'opp',
        state: a.state as ('active' | 'sleep' | 'stun')[] | undefined,
        levelMin: a.levelMin as number | undefined,
        levelMax: a.levelMax as number | undefined,
      });
      mutate.log.append(s, {
        ts: Date.now(),
        player: ctx.source.player,
        turn: s.turn.number,
        action: 'effect:expandActionTargets',
        target: byUid,
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
