// engine.effect.atom-handlers/core — Phase 3a 分割 (case body 無改変移送, 2026-06-22)
import { mutate } from '../../mutate/index.js';
import { event } from '../../event/index.js';
import { tryRePickFromAtom } from '../resolve-picks.js';
import { ATOM_PICK_SPEC, buildShortFormPick } from '../atom-pick-spec.js';
import { candidates as targetCandidates } from '../../target/candidates.js';
import { requireField, resolvePlayer, resolveBindRef, normalizeTargetToString, hasNorMax } from './_shared.js';
import type { Player } from './_shared.js';
import type { GameState, AtomVerb, EffectCtx, FileCard, TargetingRef } from '../../types/index.js';

export function atomDraw(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
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

// engine additive wave-4 (2026-07-01): drawUpToHandSize — 「手札が N 枚になるまでカードを引く」
// (B08047 沖矢昴「ターン終了時、手札が2枚になるまで引く」)。draw(max(0, n − 現手札)) の決定論 verb。
// 手札が既に N 枚以上なら draw 0 (draw-up 方向のみ、捨てない)。mutate.deck.draw は内部で手札 push +
// デッキ0時リフレッシュ (rules/14、足りなければ可能な限り) を担うため atomDraw と同じ薄いラッパー。
// discard-down 版 (B07076「N枚になるまでリムーブ」= pick 要) / 引いた枚数 return (B04048) は別 variant で DEFER。
export function atomDrawUpToHandSize(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const drawPlayer = resolvePlayer(a.player, ctx);
      const target = requireField<number>(a, 'n', 'number');
      const need = Math.max(0, target - s.players[drawPlayer].hand.length);
      if (need > 0) mutate.deck.draw(s, drawPlayer, need);
      mutate.log.append(s, {
        ts: Date.now(),
        player: drawPlayer,
        turn: s.turn.number,
        action: 'effect:drawUpToHandSize',
        result: `${need}→${target}`,
      });
      return;
    }

export function atomDiscard(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
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

// engine additive: discardRandom — 手札からランダムに n 枚リムーブする (B01077「相手は手札を1枚ランダムに
// リムーブする」, 公式 QA = 相手が選べず確率均等)。atomDiscard と異なり **pick を持たない** (ランダム =
// プレイヤー choice 不要) → awaiting-pick 経路なし。ctx.rng (無ければ Math.random) で決定的に選ぶ (deck.shuffle
// と同式、smoke 再現性)。手札 < n なら可能な限り (rules/15)。zone = hand → remove (discardToRemove)。
export function atomDiscardRandom(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
  const drP = resolvePlayer(a.player, ctx);
  const n = requireField<number>(a, 'n', 'number');
  const hand = s.players[drP].hand;
  const k = Math.min(n, hand.length);
  if (k <= 0) {
    mutate.log.append(s, { ts: Date.now(), player: drP, turn: s.turn.number, action: 'effect:discardRandom', result: '0' });
    return;
  }
  // 手札 cardId 配列のコピーを Fisher-Yates shuffle し先頭 k 枚を選ぶ (均等確率)。重複 cardId は
  // discardToRemove (hand.remove = indexOf+splice) が1要素につき1インスタンス除去 → count は正確に k。
  const rand = ctx.rng ?? Math.random;
  const pool = hand.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  const picked = pool.slice(0, k);
  mutate.hand.discardToRemove(s, drP, picked);
  // BUG-114 同型: リムーブした cardId を bind ($discarded dyn で後続 chain step が参照可能)。
  if (typeof a.bind === 'string' && picked.length > 0) {
    (ctx.bindings as Record<string, unknown>)[a.bind] = picked.map((cardId) => ({ cardId }));
  }
  mutate.log.append(s, { ts: Date.now(), player: drP, turn: s.turn.number, action: 'effect:discardRandom', result: String(picked.length) });
}

// engine additive wave (2026-06-28): handReveal — 「手札から filter 一致を1枚公開してもよい。そうした場合〜」
// (B08082 a1 / B07022)。atomDiscard の clone から mutate.hand.discardToRemove を除去 = zone 変化なし (公開のみ、
// 公式Q&A: 解決後に手札へ戻してよい)。短縮形 ({player, max, filter}) は discard と同一 pick path
// (buildShortFormPick → tryRePickFromAtom)。resolve-picks が 0候補時に chainStepNoApply を自動設定するため
// 短縮形 0候補の gate は infra 任せ。resolved target が 0枚 (辞退) のときは本 handler で chainStepNoApply を立てる。
export function atomHandReveal(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      const hrP = resolvePlayer(a.player, ctx);
      const hrArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handReveal.defaultArea, a, hrP, hrP) }
        : a;
      // exact-N gate (2026-06-28, B09061 a1): 短縮形 n:N (= pick {min:N,max:N}) は「N枚公開する」=
      // 固定数 (rules/15「N枚」、「まで」なし) = all-or-nothing。手札の filter 一致が N 枚未満なら
      // 公開不可 → chainStepNoApply で「そうした場合」を gate。max:N (a.n 不在、n.min=0「N枚まで」) は
      // 0..N 可ゆえ gate しない (従来の resolved 0枚 gate-on-0 のみ)。
      // 判定は **短縮形 entry の候補数** で行う: drain 経路 (apply-pick generic Pattern B) は resolved
      // target を単一に collapse するため resolved length では「<N」を検出できない。reveal は zone 不変
      // ゆえ availability さえ満たせば後段は単一 collapse でも mechanical に等価 (bind は n:1 のみ load-bearing)。
      // ★未対応 (B09061=trait filter 単独ゆえ無害、将来カードで注意): (1) distinctNames:true + n:N は
      //   候補列挙が distinct を無視するため availN を過大計数する (列挙時 distinct enforce 無し)。(2) 明示
      //   target 配列 + n:N は a.target!==undefined ゆえ本 gate を素通り (resolved gate-on-0 のみ)。(3) [解消済
      //   BUG-165 wave-10 2026-07-02: n≥2 の generic Pattern B collapse を apply-pick/resolve-picks で修正、
      //   bind に全選択が入る]。(4) filter 内 {dyn} (levelMax:{dyn} 等) + n:N は本 gate が
      //   resolveTargetFilterDyn を通さず raw filter で count するため availN が誤算 (実 pick 経路は dyn 解決済)。
      //   これら 4 組合せのカードは authoring 前に本 gate 拡張が必要。
      if (a.target === undefined && typeof a.n === 'number') {
        const availN = targetCandidates(s, hrArgs.target as TargetingRef, ctx).length;
        if (availN < (a.n as number)) {
          (ctx.dyn ??= {}).chainStepNoApply = true;
          mutate.log.append(s, { ts: Date.now(), player: hrP, turn: s.turn.number, action: 'effect:handReveal', result: 'gate-skip' });
          return;
        }
      }
      if (!Array.isArray(hrArgs.target)) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: hrArgs }, ctx, { byPlayer: hrP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: hrP, turn: s.turn.number, action: 'effect:handReveal:awaiting-pick' });
        return;
      }
      const target = hrArgs.target as string[];
      // 公開のみ = zone 変化なし (mutate を呼ばない、カードは手札に残る)。
      // discard の bind と同型: 公開した cardId を ctx.bindings に格納 ($revealed 色読み companion の足場)。
      if (typeof a.bind === 'string' && target.length > 0) {
        (ctx.bindings as Record<string, unknown>)[a.bind] = target.map((cardId) => ({ cardId }));
      }
      // 0枚公開 (候補無し or 辞退) → chainStepNoApply で「そうした場合」を gate (mill gate と同型)。
      if (target.length === 0) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
      }
      mutate.log.append(s, { ts: Date.now(), player: hrP, turn: s.turn.number, action: 'effect:handReveal', result: String(target.length) });
      return;
    }

export function atomMill(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-073: effect log
      const millP = resolvePlayer(a.player, ctx);
      const millN = a.n as number;
      // deck-mill-gated-chain wave (2026-06-23): gate:true は「上からN枚リムーブする」が実行不能
      // (deck<N) のとき何もリムーブせず chainStepNoApply を立て、chain (「そうした場合」) を break する。
      // 公式Q&A (B01044/B03094/B05061/B06016): 「N枚リムーブが実行できない場合、それ以降の効果は
      // 解決できません」= all-or-nothing gate。filePopToHand / evidenceToHand と同型の chain-break パターン。
      // gate 未指定/false は従来挙動 (可能な限りリムーブ + refresh、B09064/B09104) を完全保持 = 回帰0。
      if (a.gate === true && s.players[millP].deck.length < millN) {
        (ctx.dyn ??= {}).chainStepNoApply = true; // Phase 3c: chain break 信号を ctx.dyn へ (resolver chain case が読む)
        mutate.log.append(s, { ts: Date.now(), player: millP, turn: s.turn.number, action: 'effect:mill', result: 'gate-skip' });
        return;
      }
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

export function atomFileAdd(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
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

export function atomFilePopToHand(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
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
        (ctx.dyn ??= {}).chainStepNoApply = true; // Phase 3c: chain break 信号を ctx.dyn へ (resolver chain case が読む)
      }
      // BUG-073: effect log (popped が無い場合も log には残す)
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:filePopToHand', result: popped ? popped.cardId : 'none' });
      return;
    }

export function atomFileRemoveTop(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
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
        (ctx.dyn ??= {}).chainStepNoApply = true; // Phase 3c: chain break 信号を ctx.dyn へ (resolver chain case が読む)
      }
      if (typeof a.bind === 'string') {
        (ctx.bindings as Record<string, unknown[]>)[a.bind] =
          removedIds.map(cardId => ({ kind: 'card', cardId, area: 'remove', player: frP }));
      }
      mutate.log.append(s, { ts: Date.now(), player: frP, turn: s.turn.number, action: 'effect:fileRemoveTop', result: removedIds.join(',') || 'none' });
      return;
    }

export function atomFileFlipTop(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // Task D E3 (2026-06-12): FILE 最上位の非パートナーを表向き化 (B09021/B09108/B09023/B09005)。
      // 既に表向き / FILE 空は no-op。⚠ flip 不発でも chain break しない
      // (B09021 Q&A: 表向きにできなくても後続の AP+1000 は実行可 — fileRemoveTop と非対称)。
      const ffP = resolvePlayer(a.player, ctx);
      const ffResult = mutate.file.flipTop(s, ffP);
      mutate.log.append(s, { ts: Date.now(), player: ffP, turn: s.turn.number, action: 'effect:fileFlipTop', result: ffResult });
      return;
    }

export function atomEvidenceGain(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
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

export function atomSelfToEvidence(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
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

export function atomToPartnerArea(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // 「このカードをパートナーエリアに移す」(rules/03 §パートナーエリア、engine wave-12 G39)。
      // selfToEvidence と同型の deterministic self 経路 (pick 不要): イベント使用後 handUseCard /
      // next-hint が当該カードをリムーブへ置き、hirameki も evidence.removeTop が remove へ移動済 →
      // どちらの経路でも解決時カードは owner の remove 内。mutate.partner.addAreaCardFromRemove が
      // lastIndexOf splice + 不在 no-op (B06026 Q&A 同型) + remove:exit emit + PA push (上限なし) を行う。
      // ctx.source.cardId = 当該カード自身、ctx.source.player = 使用者/証拠所有者。
      const tpaP = resolvePlayer((a.player as 'self' | 'opp' | undefined) ?? 'self', ctx);
      const tpaCardId = ctx.source.cardId;
      if (typeof tpaCardId !== 'string' || tpaCardId.length === 0) return;
      const moved = mutate.partner.addAreaCardFromRemove(s, tpaP, tpaCardId);
      if (moved) {
        mutate.log.append(s, { ts: Date.now(), player: tpaP, turn: s.turn.number, action: 'effect:toPartnerArea', target: tpaCardId });
      }
      return;
    }

export function atomEvidenceLose(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
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

export function atomEvidenceToDeck(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
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

export function atomEvidenceFlip(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // ① 旧 idx 固定形 (後方互換): { player, idx } を直接 flip。
      if (typeof a.idx === 'number') {
        const efP = resolvePlayer(a.player, ctx);
        mutate.evidence.flipFaceUp(s, efP, a.idx);
        // BUG-073: effect log
        mutate.log.append(s, { ts: Date.now(), player: efP, turn: s.turn.number, action: 'effect:evidenceFlip', target: String(a.idx) });
        return;
      }
      // engine拡張 wave (2026-06-23): evidence-flip-faceup 有効化。a.player = 表向きにする証拠の owner
      // ('opp'=相手の証拠 をスカウト)。chooser/picker は常に controller (ctx.source.player)。
      const flipP = resolvePlayer(a.player, ctx);
      // ② fromTop = 「(相手の)証拠を上から1つ表向きにする」(B03076)。上から=末尾 (removeTop と整合)、選択なし。
      if (a.fromTop === true) {
        const evList = s.players[flipP].evidence;
        if (evList.length === 0) {
          mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', result: 'none' });
          return;
        }
        const topIdx = evList.length - 1;
        mutate.evidence.flipFaceUp(s, flipP, topIdx);
        mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', target: String(topIdx), result: 'ok' });
        return;
      }
      // ③ pick 形 = 「(相手の)裏向きの証拠を N つまで選び、表向きにする」。chooser=controller、
      //    candidate area side = a.side(既定は a.player) で証拠 owner を指す、faceDown=裏向き限定。
      const ctrl = ctx.source.player;
      const efArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.evidenceFlip.defaultArea, a, ctrl, (a.player as Player) ?? 'opp') }
        : a;
      const target = normalizeTargetToString(efArgs.target);
      if (!target) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: efArgs }, ctx, { byPlayer: ctrl, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: ctrl, turn: s.turn.number, action: 'effect:evidenceFlip:awaiting-pick' });
        return;
      }
      // pick で選ばれた cardId に対応する裏向き証拠を表向きに (同 cardId 複数は等価、evidenceToHand と同型)。
      const list = s.players[flipP].evidence;
      const idx = list.findIndex(e => e.cardId === target && !e.faceUp);
      let flipped = false;
      if (idx !== -1) { mutate.evidence.flipFaceUp(s, flipP, idx); flipped = true; }
      mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', target, result: flipped ? 'ok' : 'not-found' });
      return;
    }

// engine拡張 wave (2026-06-23): evidenceFlipDown — 「自分の表向きの証拠を N つまで選び、裏向きにする」
// (evidenceFlip=表向き化 の逆 mutate)。atomHandAddFromRemove と同型の 3-path:
//   ① cardIds:'$pick.cardIds' 未解決 (await) → tryRePickFromAtom で side-channel pick を enqueue
//   ② cardIds 配列 (resolved multi) → 各 cardId の表向き証拠を 1 枚ずつ裏向きに (B05013 enter「2つまで」)
//   ③ 単一 short-form (max:1) → buildShortFormPick (faceUp 候補限定) → 1 枚裏向きに (各 hira「1つまで」)
// flipP = 裏向きにする証拠の owner (a.player 既定 self、全 4 枚「自分の」)。chooser/picker は controller。
// 順番不変 (B05013 Q&A): flipFaceDown は faceUp フラグのみ false 化 (配列位置は不変)。
export function atomEvidenceFlipDown(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      const flipP = resolvePlayer(a.player, ctx); // 既定 self
      const ctrl = ctx.source.player ?? 'self';
      const rawCardIds = (a as { cardIds?: unknown }).cardIds;
      // ① multi-pick contract 未解決 (human await): side-channel に pick を queue して return。
      if (rawCardIds === '$pick.cardIds') {
        if (a.target && typeof a.target === 'object') {
          tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, {
            byPlayer: ctrl,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, { ts: Date.now(), player: ctrl, turn: s.turn.number, action: 'effect:evidenceFlipDown:awaiting-pick' });
        }
        return;
      }
      // ② multi-pick 解決済 (0〜max 枚): 各 cardId の表向き証拠を 1 枚ずつ裏向きに。
      //   同 cardId 複数の場合も flipFaceDown で faceUp=false 化されるため次 findIndex が別個体を拾う (index-based uid と整合)。
      if (Array.isArray(rawCardIds)) {
        const list = s.players[flipP].evidence;
        const flippedIds: string[] = [];
        for (const cid of rawCardIds as string[]) {
          if (typeof cid !== 'string') continue;
          const i = list.findIndex(e => e.cardId === cid && e.faceUp);
          if (i !== -1) { mutate.evidence.flipFaceDown(s, flipP, i); flippedIds.push(cid); }
        }
        mutate.log.append(s, {
          ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlipDown',
          target: flippedIds.join(','), result: rawCardIds.length === 0 ? '0' : (flippedIds.length ? 'ok' : 'not-found'),
        });
        return;
      }
      // ③ 単一 short-form (max:1): target 未指定なら verb 既定 area (evidence) で faceUp 候補 pick を構築。
      const efArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.evidenceFlipDown.defaultArea, a, ctrl, (a.player as Player) ?? 'self') }
        : a;
      const target = normalizeTargetToString(efArgs.target);
      if (!target) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: efArgs }, ctx, { byPlayer: ctrl, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: ctrl, turn: s.turn.number, action: 'effect:evidenceFlipDown:awaiting-pick' });
        return;
      }
      const list = s.players[flipP].evidence;
      const idx = list.findIndex(e => e.cardId === target && e.faceUp);
      let flipped = false;
      if (idx !== -1) { mutate.evidence.flipFaceDown(s, flipP, idx); flipped = true; }
      mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlipDown', target, result: flipped ? 'ok' : 'not-found' });
      return;
    }

export function atomEvidenceToHand(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // BUG-074: BUG-065 で resolve-picks が target を array 化 (`[cardId]`) する設計に
      // 変更されたため、string|array 両対応に正規化。未解決の pick query object の場合は
      // awaiting-pick として skip + log (D08013 a1 step 2 等で発覚)。
      // BUG-076: awaiting-pick 時に resolve-picks の tryRePickFromAtom を呼んで、
      // 残り atom 用に side-channel を再 set。これで sequence 内の連続 pattern B atom
      // が順次 modal を出せる (D08013 a1 step 2 → step 3 の連鎖)。
      // 物理動作 atom 化: { player, n } の省略形を受け取れるよう default pick target で補完
      const p = resolvePlayer(a.player, ctx);
      // engine拡張 wave (2026-06-21): fromTop = 「証拠を上から1つ手札に加え」(B03077) の deterministic top。
      // pick path をスキップし証拠スタック最上 (末尾=1番上、mutate/evidence.removeTop と整合) を手札へ。
      // 証拠0 なら no-op + __chainStepNoApply で chain break = 「そうした場合」不成立 (filePopToHand と同型)。
      // removeTop は remove エリアへ送るため使わず、手動 pop + hand.add (リムーブではなく手札移動)。
      if (a.fromTop === true) {
        const evList = s.players[p].evidence;
        if (evList.length === 0) {
          (ctx.dyn ??= {}).chainStepNoApply = true; // Phase 3c: chain break 信号を ctx.dyn へ (resolver chain case が読む)
          mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceToHand', result: 'none' });
          return;
        }
        const topId = evList[evList.length - 1]!.cardId;
        evList.pop();
        mutate.hand.add(s, p, [topId]);
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidenceToHand', target: topId, result: 'ok' });
        return;
      }
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

export function atomHandToEvidence(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine拡張 wave (2026-06-21): 手札から1枚 pick → 「裏向きで証拠として得る」(evidenceToHand の逆)。
      // discard と同型 PB pick (defaultArea 'hand')。公式Q&A B06029「手札から裏向きで得る証拠は1番上に
      // 置かれます」→ evidence.gainCard が push (末尾=証拠の1番上、mutate/evidence.removeTop と整合)。
      // fromArea:'none' = hand から先に remove 済なので remove エリアは触らない。
      const hteP = resolvePlayer(a.player, ctx);
      const hteArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handToEvidence.defaultArea, a, hteP, hteP) }
        : a;
      if (!Array.isArray(hteArgs.target)) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: hteArgs }, ctx, { byPlayer: hteP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: hteP, turn: s.turn.number, action: 'effect:handToEvidence:awaiting-pick' });
        return;
      }
      const hteTargets = hteArgs.target as string[];
      const hteFaceUp = a.faceUp === true; // 既定 false (「裏向きで証拠として得る」)
      let hteMoved = 0;
      for (const cardId of hteTargets) {
        // 手札に実在する場合のみ証拠化 (手札→証拠なので、手札に無い cardId は no-op = 証拠に湧かせない)
        const hIdx = s.players[hteP].hand.indexOf(cardId);
        if (hIdx === -1) continue;
        s.players[hteP].hand.splice(hIdx, 1);
        mutate.evidence.gainCard(s, hteP, cardId, hteFaceUp, { turn: s.turn.number, via: 'effect' }, 'none');
        hteMoved++;
      }
      mutate.log.append(s, { ts: Date.now(), player: hteP, turn: s.turn.number, action: 'effect:handToEvidence', result: String(hteMoved) });
      return;
    }

export function atomHandAddFromDeck(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
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

export function atomHandAddFromDeckBottom(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // engine additive (2026-06-29, B03051): デッキの下から1枚を手札に加える。atomHandAddFromDeck の
      // positional 下から版 (bind ではなくデッキ末尾=「下」を1枚)。pick を持たない fixed verb (draw/souza 同型)。
      // 「下」=末尾: mutate.deck.toBottom が push する側 (deck.ts:62) → deck[length-1] / deck.pop()。
      // rules/14+26: 最後の1枚を取りデッキ0になったら即リフレッシュ (B03051 Q&A「それを手札に→リフレッシュ」)。
      const hadbP = resolvePlayer(a.player, ctx);
      // 事前0 (chain で先行効果が空にした等): take の前に refresh (atomEvidenceGain と同流儀)。
      if (s.players[hadbP].deck.length === 0) {
        const r = mutate.deck.refresh(s, hadbP);
        if (!r.ok) {
          if (s.gameResult === undefined) mutate.gameResult.set(s, hadbP === 'self' ? 'opp' : 'self', 'deck-out');
          mutate.log.append(s, { ts: Date.now(), player: hadbP, turn: s.turn.number, action: 'effect:handAddFromDeckBottom', result: 'empty-deck-refresh-fail' });
          return;
        }
      }
      const deck = s.players[hadbP].deck;
      const bottomId = deck[deck.length - 1];
      if (bottomId === undefined) {
        mutate.log.append(s, { ts: Date.now(), player: hadbP, turn: s.turn.number, action: 'effect:handAddFromDeckBottom', result: 'none' });
        return;
      }
      deck.pop();
      mutate.hand.add(s, hadbP, [bottomId]);
      // take でデッキが空になったら即リフレッシュ (rules/14 即座 / B03051 Q&A: 残1枚→手札→リフレッシュ)。
      if (s.players[hadbP].deck.length === 0 && s.gameResult === undefined) {
        const r2 = mutate.deck.refresh(s, hadbP);
        if (!r2.ok && s.gameResult === undefined) mutate.gameResult.set(s, hadbP === 'self' ? 'opp' : 'self', 'deck-out');
      }
      mutate.log.append(s, { ts: Date.now(), player: hadbP, turn: s.turn.number, action: 'effect:handAddFromDeckBottom', target: bottomId, result: 'ok' });
      return;
    }

export function atomHandAddFromRemove(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // BUG-074: 同じく string|array 両対応に正規化
      // BUG-076: awaiting-pick 時に tryRePickFromAtom で side-channel 再 set
      // 物理動作 atom 化: { player, n } の省略形を受け取れるよう default pick target で補完
      const p = resolvePlayer(a.player, ctx);
      // engine拡張 wave (2026-06-21): fromSelf = 【ヒラメキ】「このカードを手札に加える」(B06033/PR085/PR091)。
      //   hirameki の source = リムーブされた証拠カード自身。triggered.ts handleEvidenceRemovedHook が
      //   ctx.source.cardId = ev.cardId / ctx.source.player = 証拠所有者 で起動し、その直前に
      //   action-case.ts removeOpponentEvidenceTop → mutate.evidence.removeTop が ev.cardId を
      //   所有者の remove 末尾に push 済。よって pick せず ctx.source.cardId を remove から
      //   lastIndexOf (直近 push 分 = まさにこのカード) で取得し手札へ移す。同 cardId の旧コピーが
      //   remove にあっても末尾優先で正しい1枚を取る。見つからなければ no-op (防御的、通常は必ず存在)。
      //   fromTop (evidenceToHand) 同型: args:unknown ゆえ型/whitelist 同期不要・純 additive。
      if ((a as { fromSelf?: unknown }).fromSelf === true) {
        const selfCid = ctx.source.cardId;
        const remSelf = s.players[p].remove;
        const sIdx = selfCid ? remSelf.lastIndexOf(selfCid) : -1;
        if (!selfCid || sIdx === -1) {
          mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', result: 'none' });
          return;
        }
        remSelf.splice(sIdx, 1);
        mutate.remove.emitExit(s, p, selfCid); // wave-4: remove→hand 離脱 (原因非依存 remove:exit)
        mutate.hand.add(s, p, [selfCid]);
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', target: selfCid, result: 'ok' });
        return;
      }
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
          if (idx !== -1) { remM.splice(idx, 1); mutate.remove.emitExit(s, p, cid); mutate.hand.add(s, p, [cid]); movedIds.push(cid); }
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
        mutate.remove.emitExit(s, p, target); // wave-4: remove→hand 離脱 (原因非依存 remove:exit)
        mutate.hand.add(s, p, [target]);
        moved = true;
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove', target, result: moved ? 'ok' : 'not-found' });
      return;
    }

export function atomDeckShuffle(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // rules/04, 14, 26 — デッキ基本シャッフル (D11019 等で使用)
      const p = resolvePlayer(a.player, ctx);
      mutate.deck.shuffle(s, p, ctx.rng);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:deckShuffle' });
      return;
    }

export function atomRemoveAreaAllToDeckBottom(s: GameState, _a: Record<string, unknown>, ctx: EffectCtx): void {
      // cluster4 (2026-06-14) B08027【登場時】: 自分と相手はリムーブエリアの「すべて」のカードを
      //   各自のデッキの下に移し、両者のデッキをシャッフルする。
      // ⚠ 'self'/'opp' は **絶対スロット** を意図的に走査する (resolvePlayer しない)。この verb は
      //   両プレイヤーに対称な操作 (各自の remove → 各自の deck → 各自 shuffle) なので、所有者相対では
      //   なく両スロット網羅で「自分と相手」を表現する。BUG-079 の owner-relative 規約とは別物。
      // rules/14・26: デッキへ移すだけで 0 にならない → これは「リフレッシュ」ではない (証拠付与なし、
      //   公式Q&A)。よって mutate.deck.refresh は呼ばず raw splice + toBottom + shuffle で行う。
      // rules/09・23: (現場からの) デッキ下移動はリムーブでないため scene-removal hook (leave:to-remove /
      //   【現場リムーブ時】) は発火しない。一方ここは **リムーブエリアからの** 離脱なので wave-4 の
      //   remove:exit (原因非依存、rules/17 類推) は離脱カード毎に発火する (refresh / handAddFromRemove と同契約)。
      // 公式テキスト通り、移動枚数 0 (remove 空) のプレイヤーも無条件でシャッフルする。
      // shuffle は ctx.rng があれば使い、無ければ mutate.deck.shuffle 内の Math.random
      //   (smoke では seeded RNG に global override されている) を使う (deckShuffle と同一契約)。
      for (const pp of ['self', 'opp'] as const) {
        const rem = s.players[pp].remove;
        if (rem.length > 0) {
          const ids = rem.splice(0, rem.length); // ALL — remove を drain
          mutate.deck.toBottom(s, pp, ids);       // 各自のデッキ下へ
          for (const cid of ids) mutate.remove.emitExit(s, pp, cid); // wave-4: remove→deck下 離脱 emit
        }
        mutate.deck.shuffle(s, pp, ctx.rng);
      }
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:removeAreaAllToDeckBottom' });
      return;
    }
