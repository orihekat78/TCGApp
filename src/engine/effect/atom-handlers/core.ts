// engine.effect.atom-handlers/core — Phase 3a 分割 (case body 無改変移送, 2026-06-22)
import { mutate } from '../../mutate/index.js';
import { invokeLeaveToRemoveOfCard } from '../invoke-leave-to-remove.js';
import { invokeHiramekiOfCard } from '../invoke-hirameki.js';
import { event } from '../../event/index.js';
import { def as readDef } from '../../read/def.js'; // W6 step3 (r63): useEventFromHand の kind guard
import { tryRePickFromAtom } from '../resolve-picks.js';
// WC2b (2026-07-11): invokeHiramekiOfCard atom-level optional prompt 用 (pending-state は leaf — cycle 無し)。
import { pushPendingEffectOptionalSide, setPendingOptionalResume, setPendingOptionalBindings, setPendingOptionalCostPaid } from '../pending-state.js';
import { ATOM_PICK_SPEC, buildShortFormPick } from '../atom-pick-spec.js';
import { candidates as targetCandidates } from '../../target/candidates.js';
import { requireField, resolvePlayer, resolveBindRef, normalizeTargetToString, hasNorMax, resolveDeltaToNumber } from './_shared.js';
import { isDynObject, resolveDynNumber } from '../../dyn/eval.js';
import type { Player } from './_shared.js';
import type { GameState, AtomVerb, EffectCtx, FileCard, TargetingRef } from '../../types/index.js';

export function atomDraw(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-072: deck.draw が手札への push まで内部で行う + effect 経由の draw を log に残す
      const drawPlayer = resolvePlayer(a.player, ctx);
      // mini-wave #3 (2026-07-10): n は number | {dyn} (B05092「移した枚数と同じ数のカードを引く」
      // = {dyn:'$bound.$moved.count'})。number は従来 byte 互換 (resolveDeltaToNumber は number passthrough)。
      const drawN = typeof a.n === 'number' ? a.n : resolveDeltaToNumber(a.n, s, ctx);
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
      // M2後半 (2026-07-10, B04048): 引いた cardId 群を bind (「引いた枚数と同じ数」を後段
      // handToDeckBottom n:{dyn:'$bound.<key>.count'} が読む)。mill/discard と同 idiom (0枚は書かない)。
      const drawn = need > 0 ? mutate.deck.draw(s, drawPlayer, need) : [];
      if (typeof a.bind === 'string' && drawn.length > 0) {
        (ctx.bindings as Record<string, unknown>)[a.bind] = drawn.map((cardId) => ({ cardId }));
      }
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
      // M2後半 (2026-07-10, B07100): chooser:'source' — 「(自分が) 選び、相手はそれをリムーブする」。
      // 選ぶ主語 = 能力所有者 (ctx.source.player)、手札所有者 (dcP) と分離する。pending 側は
      // BUG-175 の ownerPlayer 分離が chooser≠owner の再実行座標系を既に支える。未指定は従来
      // どおり手札所有者が選ぶ (byte 互換)。
      const dcChooser = a.chooser === 'source' ? ctx.source.player : dcP;
      const dcArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.discard.defaultArea, a, dcChooser, a.player as Player) }
        : a;
      if (!Array.isArray(dcArgs.target)) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: dcArgs }, ctx, { byPlayer: dcChooser, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, {
          ts: Date.now(),
          player: dcP,
          turn: s.turn.number,
          action: 'effect:discard:awaiting-pick',
        });
        return;
      }
      const target = dcArgs.target as string[];
      // W3 (r17): byPlayer = 効果起動側 (相対 player と乖離しうる — 「相手の効果によって」判定用)
      mutate.hand.discardToRemove(s, resolvePlayer(a.player, ctx), target, { byPlayer: ctx.source.player });
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

// engine mini-wave #3 (2026-07-10): handToDeckBottom — 手札から N 枚 (pick) をデッキの下へ移す
// (B05092「手札からカードを4枚まで好きな順番でデッキの下に移し、…移した枚数と同じ数のカードを引く」)。
// atomDiscard の PB 短縮形 clone (dest = remove でなくデッキ末尾)。「好きな順番」= picked 順で push
// (デッキ下の順は非公開情報 rules/02 — 順序は所有者選択、engine は picked 順を尊重)。
// リムーブではないため hand:removed は emit しない (rules/03 zone 移動のみ)。bind = 移した cardId 群。
export function atomHandToDeckBottom(s: GameState, a0: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // M2後半 (2026-07-10, B04048): n:{dyn:'$bound.<key>.count'} を handler-local で解決
      // (「引いた枚数と同じ数の手札を…デッキの下に移す」)。evidenceFlip dyn-max と同封じ込め
      // (共有 helper は byte 不変)。解決値 <=0 は「0枚移す」= no-op (pick を出さない)。
      const a = isDynObject(a0.n) ? { ...a0, n: resolveDynNumber(a0.n, s, ctx) } : a0;
      if (isDynObject(a0.n) && (a.n as number) <= 0) {
        mutate.log.append(s, { ts: Date.now(), player: resolvePlayer(a.player, ctx), turn: s.turn.number, action: 'effect:handToDeckBottom', result: 'dyn-n-0' });
        return;
      }
      const hdP = resolvePlayer(a.player, ctx);
      // multi-pick は cardIds:'$pick.cardIds' contract 必須 (B09034/B08028 同型 — short-form N>1 は
      // normalizeTargetToString で 1 枚に collapse する engine-wide 既知罠。miniwave3 probe で実測)。
      const hdRawCardIds = (a as { cardIds?: unknown }).cardIds;
      if (hdRawCardIds === '$pick.cardIds') {
        if (a.target && typeof a.target === 'object' && !Array.isArray(a.target)) {
          tryRePickFromAtom(s, { kind: 'atom', verb, args: a }, ctx, { byPlayer: hdP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
          mutate.log.append(s, { ts: Date.now(), player: hdP, turn: s.turn.number, action: 'effect:handToDeckBottom:awaiting-pick' });
        }
        return;
      }
      if (Array.isArray(hdRawCardIds)) {
        return hdMove(s, a, ctx, hdP, hdRawCardIds as string[]);
      }
      const hdArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handToDeckBottom!.defaultArea, a, hdP, a.player as Player) }
        : a;
      if (!Array.isArray(hdArgs.target)) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: hdArgs }, ctx, { byPlayer: hdP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: hdP, turn: s.turn.number, action: 'effect:handToDeckBottom:awaiting-pick' });
        return;
      }
      return hdMove(s, a, ctx, hdP, hdArgs.target as string[]);
    }

function hdMove(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, hdP: 'self' | 'opp', hdTarget: string[]): void {
      const hdHand = s.players[hdP].hand;
      // M2後半 (2026-07-10, B04048): shuffleMoved — 「シャッフルしてデッキの下に移す」= 移動群のみ
      // 順序無作為化 (Fisher-Yates、mutate.deck.shuffle と同 idiom)。デッキ全体 shuffle
      // (shuffleThenDrawMoved、B05092) とは別物。既存カードは未指定 = picked 順 push 不変。
      if ((a as { shuffleMoved?: unknown }).shuffleMoved === true) {
        hdTarget = [...hdTarget];
        for (let i = hdTarget.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          const tmp = hdTarget[i]; hdTarget[i] = hdTarget[j]; hdTarget[j] = tmp;
        }
      }
      const movedIds: string[] = [];
      for (const cid of hdTarget) {
        const i = hdHand.indexOf(cid);
        if (i === -1) continue; // 防御的 (rules/15 可能な限り)
        hdHand.splice(i, 1);
        s.players[hdP].deck.push(cid);
        movedIds.push(cid);
      }
      if (typeof a.bind === 'string' && movedIds.length > 0) {
        (ctx.bindings as Record<string, unknown>)[a.bind] = movedIds.map((cardId) => ({ cardId }));
      }
      // shuffleThenDrawMoved (B05092「…デッキの下に移し、デッキをシャッフルする。移した枚数と同じ数の
      // カードを引く」): atom 内蔵で move → shuffle → 同数 draw を印字順に実行。別 step の
      // draw n:{dyn:'$bound...count'} は初期 walk が bind 前に 0 へ literalize するため不可
      // (miniwave3 実測。walk-literalize latent は DEFERRED-INDEX 記録)。自己完結が正準。
      if ((a as { shuffleThenDrawMoved?: unknown }).shuffleThenDrawMoved === true) {
        mutate.deck.shuffle(s, hdP);
        if (movedIds.length > 0) mutate.deck.draw(s, hdP, movedIds.length);
      }
      mutate.log.append(s, { ts: Date.now(), player: hdP, turn: s.turn.number, action: 'effect:handToDeckBottom', result: String(movedIds.length) });
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
  mutate.hand.discardToRemove(s, drP, picked, { byPlayer: ctx.source.player }); // W3 (r17)
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
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handReveal.defaultArea, a, hrP, a.player as Player) }
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
      // W3 (r18): 公開 observer hook (B09004)。zone 不変のまま emit のみ (mutate.hand.emitReveal 単一ソース)。
      mutate.hand.emitReveal(s, hrP, target);
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

// engine wave A1 (2026-07-02 G39 継続): partnerAreaRemove — 「自分のパートナーエリアにある
// 〚特徴[ビッグジュエル]〛のカードを N 枚リムーブ」(B07037 n:2 /PR263 n:1)。atomHandReveal の clone
// (短縮形 pick + exact-N gate + gate-on-0 + bind) に **実 zone 変化** (mutate.partner.removeAreaCardsToRemove)
// を足したもの。defaultArea='partner-area' (candidates case 'partner-area' が partnerAreaCards を列挙、
// wave-12)。「N枚リムーブしてもよい」の optional/「そうした場合」はカード側 (optional{chain[…]}) が担い、
// 本 verb は exact-N (n:N) all-or-nothing: PA 候補 < N なら chainStepNoApply で chain break (B07055/B03094 同型)。
export function atomPartnerAreaRemove(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      const paP = resolvePlayer(a.player, ctx);
      const paArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.partnerAreaRemove.defaultArea, a, paP, a.player as Player) }
        : a;
      // exact-N gate (handReveal 同型): 短縮形 n:N は「N枚リムーブ」= 固定数 (rules/15「N枚」、「まで」なし)。
      // PA の filter 一致が N 枚未満なら実行不可 → chainStepNoApply で「そうした場合」を gate。
      if (a.target === undefined && typeof a.n === 'number') {
        const availN = targetCandidates(s, paArgs.target as TargetingRef, ctx).length;
        if (availN < (a.n as number)) {
          (ctx.dyn ??= {}).chainStepNoApply = true;
          mutate.log.append(s, { ts: Date.now(), player: paP, turn: s.turn.number, action: 'effect:partnerAreaRemove', result: 'gate-skip' });
          return;
        }
      }
      if (!Array.isArray(paArgs.target)) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: paArgs }, ctx, { byPlayer: paP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: paP, turn: s.turn.number, action: 'effect:partnerAreaRemove:awaiting-pick' });
        return;
      }
      const target = paArgs.target as string[];
      mutate.partner.removeAreaCardsToRemove(s, paP, target);
      // discard/handReveal と同型: リムーブした cardId を bind (後続 chain step が $removed 等で参照可)。
      if (typeof a.bind === 'string' && target.length > 0) {
        (ctx.bindings as Record<string, unknown>)[a.bind] = target.map((cardId) => ({ cardId }));
      }
      // 0枚 (候補無し or 辞退) → chainStepNoApply で「そうした場合」を gate (mill/handReveal 同型)。
      if (target.length === 0) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
      }
      mutate.log.append(s, { ts: Date.now(), player: paP, turn: s.turn.number, action: 'effect:partnerAreaRemove', result: String(target.length) });
      return;
    }

export function atomMill(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-073: effect log
      const millP = resolvePlayer(a.player, ctx);
      // M2後半 (2026-07-10, PR265): n:{dyn:'$bound.<key>.level'} を handler-local で解決
      // (「そのカードのレベルと同じ枚数リムーブする」)。chain 経路は pre-walk (resolveDynArgs) を
      // 通らず、前段 bind は実行時確定のため handler 側で数値化する (souza x:{dyn} / atomDraw と同型。
      // number は素通り = 既存 literal 消費者 byte 互換)。
      const millN = typeof a.n === 'number' ? a.n : resolveDeltaToNumber(a.n, s, ctx);
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
      const millRemoved = mutate.deck.removeFromTop(s, millP, millN);
      // engine defer-unlock mini-wave (2026-07-09): 「これによって〜がリムーブされた場合」(PR132/PR201) 用に
      // リムーブした cardId を bind (discard/handReveal/partnerAreaRemove と同型)。refresh より前に確定 —
      // binding は cardId snapshot なので refresh でデッキへ戻っても boundAnyMatchesFilter (印字値評価) は不変。
      if (typeof a.bind === 'string' && millRemoved.length > 0) {
        (ctx.bindings as Record<string, unknown>)[a.bind] = millRemoved.map((cardId) => ({ cardId }));
      }
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
      // mini-wave #3 (2026-07-10): n (既定 1) + gate (all-or-nothing、B03110「FILEエリアのカードを上から
      // 2枚手札に加える」= 2枚揃わなければ以降解決不可 QA)。poppable = アシストパートナー除外後の枚数
      // (popTop の skip 対象と同一集合)。n=1・gate 無しは従来経路 byte 互換。
      const fpN = typeof a.n === 'number' ? a.n : 1;
      if (fpN !== 1 || a.gate === true) {
        const poppable = s.players[p].file.filter((f) => f.type !== 'assisted-partner').length;
        if (a.gate === true && poppable < fpN) {
          (ctx.dyn ??= {}).chainStepNoApply = true;
          mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:filePopToHand', result: `gate-fail (${poppable}<${fpN})` });
          return;
        }
        let fpMoved = 0;
        for (let i = 0; i < fpN; i++) {
          const fpc = mutate.file.popTop(s, p);
          if (!fpc) break;
          mutate.hand.add(s, p, [fpc.cardId]);
          event.emit(s, 'file:pop', { player: p, popped: fpc }, { player: p });
          fpMoved++;
        }
        if (fpMoved === 0) (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:filePopToHand', result: `n=${fpN} moved=${fpMoved}` });
        return;
      }
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
      // S1 wave (2026-07-11, B09105): requireExact (opt-in) — 「FILE を上から N 枚リムーブしてもよい。
      // そうした場合〜」で N 枚に満たない場合は後続を gate (公式Q&A: FILE 1枚では以降の効果を解決
      // できない)。リムーブ自体は可能な限り行う (rules/15「可能な限り」、Q&A は以降の解決のみ否定)。
      // 既存 consumer は未宣言 → 0枚 break のみの従来挙動 byte 互換。
      if ((a as { requireExact?: boolean }).requireExact === true && removedIds.length < frN) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
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
        // step12 batch3 (2026-07-04, B06085 第3句): faceUp arg 素通し — 「デッキのカードを上から
        // 1枚**表向き**で証拠として得る」。未指定は従来通り裏向き (rules/01)。
        mutate.evidence.addFromDeck(s, p, 1, a.faceUp === true, { turn: s.turn.number, via: 'effect' });
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

export function atomToPartnerArea(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // 「このカードをパートナーエリアに移す」(rules/03 §パートナーエリア、engine wave-12 G39)。
      // selfToEvidence と同型の deterministic self 経路 (pick 不要): イベント使用後 handUseCard /
      // next-hint が当該カードをリムーブへ置き、hirameki も evidence.removeTop が remove へ移動済 →
      // どちらの経路でも解決時カードは owner の remove 内。mutate.partner.addAreaCardFromRemove が
      // lastIndexOf splice + 不在 no-op (B06026 Q&A 同型) + remove:exit emit + PA push (上限なし) を行う。
      // ctx.source.cardId = 当該カード自身、ctx.source.player = 使用者/証拠所有者。
      const tpaP = resolvePlayer((a.player as 'self' | 'opp' | undefined) ?? 'self', ctx);
      // Cluster WB1 (2026-07-11, B07030 a1後段 / B07061): pick-form — 「リムーブエリアにある〚特徴
      //   [ビッグジュエル]〛を1枚まで選び、PAに移す」。removeAreaToDeckTop と同型 (PB pick + sourceSplice)、
      //   dest = PA (addAreaCardFromRemove が remove splice + remove:exit emit + PA push を行う)。target/n/max
      //   があれば pick-form、無ければ従来の自己移動形 (args:{}、B07059/B07060/PR195 等) = byte 互換。
      if (a.target !== undefined || hasNorMax(a)) {
        const tpaArgs = (a.target === undefined && hasNorMax(a))
          ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.toPartnerArea!.defaultArea, a, tpaP, a.player as Player) }
          : a;
        const tpaTarget = normalizeTargetToString(tpaArgs.target);
        if (!tpaTarget) {
          tryRePickFromAtom(s, { kind: 'atom', verb, args: tpaArgs }, ctx, { byPlayer: tpaP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
          mutate.log.append(s, { ts: Date.now(), player: tpaP, turn: s.turn.number, action: 'effect:toPartnerArea:awaiting-pick' });
          return;
        }
        const tpaPicked = mutate.partner.addAreaCardFromRemove(s, tpaP, tpaTarget);
        // 0枚 (skip/不在) → chain gate (removeAreaToDeckTop と同型、「してもよい。そうした場合」対応)。
        if (!tpaPicked) (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, { ts: Date.now(), player: tpaP, turn: s.turn.number, action: 'effect:toPartnerArea', target: tpaTarget, result: tpaPicked ? 'ok' : 'not-found' });
        return;
      }
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
      // engine E3 P53 (2026-07-03): all = 「(自分の)証拠をすべて表向きにする」(B09107)。選択なし、全 idx faceUp 化。
      // 順序不変 (flipFaceUp は faceUp フラグのみ true 化)。証拠 0 枚は no-op。
      if (a.all === true) {
        const evList = s.players[flipP].evidence;
        for (let i = 0; i < evList.length; i++) mutate.evidence.flipFaceUp(s, flipP, i);
        mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', target: 'all', result: evList.length === 0 ? 'none' : 'ok' });
        return;
      }
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
      // mega-wave W5 (2026-07-03, r38): max の {dyn} 短縮形を handler local で literalize
      // (B08028「この効果によって表向きにした枚数と同じ数まで」= max:{dyn:'$bound.$flipped.count'})。
      // 共有 helper (hasNorMax/buildShortFormPick) は byte 不変 — 未解決 {dyn} が他 atom へ漏れる
      // footgun を封じ込め (本 handler だけが dyn-max を知る)。解決後 max<=0 は「0枚まで選ぶ」= no-op
      // (mirror-count 0 で pick を出さない、rules/15「〜まで」0可)。
      const ctrl = ctx.source.player;
      const aResolved = isDynObject(a.max) ? { ...a, max: resolveDynNumber(a.max, s, ctx) } : a;
      if (isDynObject(a.max) && (aResolved.max as number) <= 0) {
        mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', target: 'dyn-max-0', result: 'none' });
        return;
      }
      // ③-multi (r38): cardIds 契約 = evidenceFlipDown ①② の faceDown/flipFaceUp 版 clone。
      //   ① cardIds:'$pick.cardIds' 未解決 → short-form なら target を構築して side-channel enqueue
      //   ② cardIds 配列 (resolved) → 各 cardId の裏向き証拠を 1 枚ずつ表向き + bind writeback
      const rawCardIds = (aResolved as { cardIds?: unknown }).cardIds;
      if (rawCardIds === '$pick.cardIds') {
        // decline (0枚 skip、applyPickSkipAndContinuation runDeclinedAtom=true 経路): flip 0 で解決。
        // bind は空配列を書く — $bound.<key>.count が 0 を返し、後続 mirror step (B08028 step2) が
        // 正しく no-op になる (unbound のままだと defensive 0 だが、明示 [] で「0枚 flip した」を記録)。
        if ((aResolved as { __declined?: unknown }).__declined === true) {
          if (typeof aResolved.bind === 'string') {
            (ctx.bindings as Record<string, unknown>)[aResolved.bind] = [];
          }
          mutate.log.append(s, { ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip', target: 'declined', result: '0' });
          return;
        }
        const mTarget = (aResolved.target && typeof aResolved.target === 'object')
          ? aResolved.target
          : (hasNorMax(aResolved) ? buildShortFormPick(ATOM_PICK_SPEC.evidenceFlip.defaultArea, aResolved, ctrl, (aResolved.player as Player) ?? 'opp') : undefined);
        if (mTarget) {
          tryRePickFromAtom(s, { kind: 'atom', verb, args: { ...aResolved, target: mTarget } }, ctx, {
            byPlayer: ctrl,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, { ts: Date.now(), player: ctrl, turn: s.turn.number, action: 'effect:evidenceFlip:awaiting-pick' });
        }
        return;
      }
      if (Array.isArray(rawCardIds)) {
        const evl = s.players[flipP].evidence;
        const flippedIds: string[] = [];
        for (const cid of rawCardIds as string[]) {
          if (typeof cid !== 'string') continue;
          const i = evl.findIndex(e => e.cardId === cid && !e.faceUp);
          if (i !== -1) { mutate.evidence.flipFaceUp(s, flipP, i); flippedIds.push(cid); }
        }
        // bind writeback (core.ts 他 atom の a.bind idiom と同一行形): 実際に flip した分のみ。
        // $bound.<key>.count が「この効果によって表向きにした枚数」を正確に映す (B08028)。
        if (typeof aResolved.bind === 'string') {
          (ctx.bindings as Record<string, unknown>)[aResolved.bind] = flippedIds.map(cardId => ({ cardId }));
        }
        mutate.log.append(s, {
          ts: Date.now(), player: flipP, turn: s.turn.number, action: 'effect:evidenceFlip',
          target: flippedIds.join(','), result: rawCardIds.length === 0 ? '0' : (flippedIds.length ? 'ok' : 'not-found'),
        });
        return;
      }
      // ③ pick 形 = 「(相手の)裏向きの証拠を N つまで選び、表向きにする」。chooser=controller、
      //    candidate area side = a.side(既定は a.player) で証拠 owner を指す、faceDown=裏向き限定。
      const efArgs = (aResolved.target === undefined && hasNorMax(aResolved))
        ? { ...aResolved, target: buildShortFormPick(ATOM_PICK_SPEC.evidenceFlip.defaultArea, aResolved, ctrl, (aResolved.player as Player) ?? 'opp') }
        : aResolved;
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

// engine additive A2 (2026-07-11, B03040 和田進一): peekOwnEvidence — 「自分の証拠を上から1つ見る。
// （裏向きの証拠を見た場合、その後、元に戻す）」= 状態変化を伴わない私的閲覧 (evidenceFlip の「表向きに
// 固定」とは意味が正反対 — 永続 flip ではなく peek のみ)。zone/faceUp 完全不変。UI へ private 通知する
// のみ (log entry で表現)。証拠 0 枚は no-op。fromTop = 末尾 = 1番上 (evidence push=末尾=最上部)。
export function atomPeekOwnEvidence(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, _verb: AtomVerb): void {
  const p = resolvePlayer(a.player, ctx); // 既定 self (「自分の証拠」)
  const evList = s.players[p].evidence;
  if (evList.length === 0) {
    mutate.log.append(s, { ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:evidencePeek', result: 'none' });
    return;
  }
  const top = evList[evList.length - 1];
  mutate.log.append(s, {
    ts: Date.now(), player: p, turn: s.turn.number,
    action: 'effect:evidencePeek', target: top.cardId, result: top.faceUp ? 'faceUp' : 'faceDown',
  });
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
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.evidenceToHand.defaultArea, a, p, a.player as Player) }
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
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handToEvidence.defaultArea, a, hteP, a.player as Player) }
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

export function atomHandToFileBottom(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine mega-wave W1 (2026-07-03, P41): 手札1枚を FILE の1番下に **表向き** で移す (B05045 a2
      // 「手札を1枚FILEエリアにあるカードの1番下に表向きで移す」)。handToEvidence の exact-clone
      // (PB pick defaultArea 'hand')。FILE 1番下 = mutate.file.insertBottomFaceUp (unshift、rules/05)。
      const hfbP = resolvePlayer(a.player, ctx);
      const hfbArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handToFileBottom!.defaultArea, a, hfbP, a.player as Player) }
        : a;
      const hfbT = hfbArgs.target;
      if (!Array.isArray(hfbT) && typeof hfbT !== 'string') {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: hfbArgs }, ctx, { byPlayer: hfbP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: hfbP, turn: s.turn.number, action: 'effect:handToFileBottom:awaiting-pick' });
        return;
      }
      const hfbIds = Array.isArray(hfbT) ? (hfbT as string[]) : [hfbT as string];
      let hfbMoved = 0;
      for (const cardId of hfbIds) {
        // 手札に実在する場合のみ移動 (無い cardId は no-op = FILE に湧かせない)
        const hIdx = s.players[hfbP].hand.indexOf(cardId);
        if (hIdx === -1) continue;
        s.players[hfbP].hand.splice(hIdx, 1);
        mutate.file.insertBottomFaceUp(s, hfbP, cardId);
        hfbMoved++;
      }
      mutate.log.append(s, { ts: Date.now(), player: hfbP, turn: s.turn.number, action: 'effect:handToFileBottom', result: String(hfbMoved) });
      return;
    }

export function atomUseEventFromHand(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine mega-wave W6 step3 (2026-07-04, r63 P18): 効果内から手札のイベントを filter 一致で
      // pick (0..1) して即時使用 (「手札からレベル6以下のイベントを1枚まで使用する」B08026/D10005/B05042)。
      // atomHandToFileBottom clone (PB pick defaultArea 'hand')。使用手順は hand-use-card.ts の event
      // 分岐と**同順序厳守**: ① effect:declared emit (viaEffect:true) ② hand.remove ③ remove.add —
      // emit が先でないと on-hand scope 判定 (collectCardsInPlay の hand sentinel) が使用イベント自身の
      // 効果を見つけられない。公式Q&A: 効果による使用は FILE 枚数・事件色制限をバイパス (canHandUseCard
      // 非経由がそのままバイパスの実装形)。
      const uefP = resolvePlayer(a.player, ctx);
      // B09034「能力や効果によっても使用できない」の防御的再ゲート (candidates は ban を見ないため
      // pick 構築より前に落とす — human に無意味な pick を出させない)。
      if (s.turnState[uefP].eventUseBanned) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
        mutate.log.append(s, { ts: Date.now(), player: uefP, turn: s.turn.number, action: 'effect:useEventFromHand:banned' });
        return;
      }
      const uefArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.useEventFromHand!.defaultArea, a, uefP, a.player as Player) }
        : a;
      const uefT = uefArgs.target;
      if (!Array.isArray(uefT) && typeof uefT !== 'string') {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: uefArgs }, ctx, { byPlayer: uefP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: uefP, turn: s.turn.number, action: 'effect:useEventFromHand:awaiting-pick' });
        return;
      }
      const uefIds = Array.isArray(uefT) ? (uefT as string[]) : [uefT as string];
      let uefUsed = 0;
      for (const cardId of uefIds) {
        // 手札に実在する場合のみ使用 (無い cardId は no-op)
        if (!s.players[uefP].hand.includes(cardId)) continue;
        // 混成 review NIT 対応 (2026-07-04): イベント以外は使用しない (author が filter:{kind:'event'}
        // を書き漏らした時にキャラカードが silent にリムーブ行きになる footgun の防御 1 行)。
        if (readDef.card(cardId)?.kind !== 'event') {
          mutate.log.append(s, { ts: Date.now(), player: uefP, turn: s.turn.number, action: 'effect:useEventFromHand:not-event', target: cardId });
          continue;
        }
        event.emit(
          s,
          'effect:declared',
          { kind: 'event-use', cardId, player: uefP, viaEffect: true },
          { player: uefP, cardId },
        );
        mutate.hand.remove(s, uefP, [cardId]);
        mutate.remove.add(s, uefP, [cardId]);
        uefUsed++;
      }
      if (uefUsed === 0) {
        // 0枚 (辞退/候補なし) → 「そうした場合」gate (handReveal gate-on-0 と同型)
        (ctx.dyn ??= {}).chainStepNoApply = true;
      }
      mutate.log.append(s, { ts: Date.now(), player: uefP, turn: s.turn.number, action: 'effect:useEventFromHand', result: String(uefUsed) });
      return;
    }

export function atomEvidenceToDeckBottom(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine mega-wave W1 (2026-07-03): 証拠を pick して **持ち主の** デッキの下へ移す
      // (「相手の証拠を1つまで選び、デッキの下に移す」B03084 a1 前段)。evidenceToHand の clone
      // (PB pick defaultArea 'evidence')。公式Q&A: どの位置の証拠でも選べる / 裏向きは確認できず
      // 裏向きのままデッキ下へ (deck は CardId[] で不可視ゆえ表現済)。リムーブではない (ヒラメキ不発動、
      // rules/10: ヒラメキは「証拠からリムーブされるとき」のみ)。
      // chooser=controller (自分が相手の証拠を選ぶ) / side=a.player (証拠の持ち主)。
      const edbP = resolvePlayer(a.player, ctx);
      const edbArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.evidenceToDeckBottom!.defaultArea, a, ctx.source.player as Player, edbP) }
        : a;
      const edbT = edbArgs.target;
      if (!Array.isArray(edbT) && typeof edbT !== 'string') {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: edbArgs }, ctx, { byPlayer: ctx.source.player as Player, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: edbP, turn: s.turn.number, action: 'effect:evidenceToDeckBottom:awaiting-pick' });
        return;
      }
      const edbIds = Array.isArray(edbT) ? (edbT as string[]) : [edbT as string];
      let edbMoved = 0;
      for (const cardId of edbIds) {
        const evList = s.players[edbP].evidence;
        const eIdx = evList.findIndex(e => e.cardId === cardId);
        if (eIdx === -1) continue; // 証拠に無い cardId は no-op
        evList.splice(eIdx, 1);
        mutate.deck.toBottom(s, edbP, [cardId]); // 持ち主のデッキの下 (裏向き)
        edbMoved++;
      }
      mutate.log.append(s, { ts: Date.now(), player: edbP, turn: s.turn.number, action: 'effect:evidenceToDeckBottom', result: String(edbMoved) });
      return;
    }

// engine mega-wave W3 (2026-07-03, r12): リムーブ中カードの【現場リムーブ時】明示発動 (B08078 a2)。
// 実体は effect/invoke-leave-to-remove.ts leaf (emit 非経由 = 盤面 observer 波及なし)。
// args: { cardId | '$bind.ref', player? ('self' 相対、省略時効果起動側のカード所有 = self) }
export function atomInvokeLeaveToRemoveOfCard(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const ilCardId = resolveBindRef(a.cardId, ctx) as string;
      if (typeof ilCardId !== 'string' || ilCardId.startsWith('$')) return;
      const ilP = resolvePlayer(a.player ?? 'self', ctx);
      invokeLeaveToRemoveOfCard(s, ilCardId, ilP);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:invokeLeaveToRemoveOfCard', target: ilCardId });
      return;
    }

// engine night-wave WC2b (2026-07-11): 別カードの【ヒラメキ】effect を明示発動 (B06023/B06034)。
// 実体は effect/invoke-hirameki.ts leaf (emit 非経由)。
// args: { cardId | cardIds ('$bind.ref' / '$cost.flipFaceUpEvidence.ids' 等), player? ('self' 相対),
//         trait? (印字 trait gate — 例 'YAIBA'), optional? (「発動させてもよい」atom-level prompt — 下記) }。
// cardIds 配列内の各 cardId を順に invoke。
// 未解決 ($ 残り) / non-string は skip。invoke 側で def 不在・trait 不一致・hirameki 不在は no-op。
//
// optional:true (T2 review B06034): walk-level optional{} は binding-依存 conditional (boundMatchesFilter
// $flipped) の then 枝内で使えない — pre-walk が unstable-if の両枝を walk して bind 確定前に eager
// surface し (BUG-161 の unstable 側 latent)、continuation 経路の remainder は runtime resolver 直行で
// optional を surface できない (optionalRun 未設定 = silent skip)。よって「してもよい」prompt を atom 実行時
// (= bind 確定後・conditional 成立時のみ到達) に side-channel surface する。human owner → pendingEffectOptional
// (live ctx.bindings/costPaid を wave-18 resume 機構で保持、resume = optional{本 atom (flag 除去)})。
// AI / non-human → skip (walk-level optional の AI 既定 skip と同一 posture)。
export function atomInvokeHiramekiOfCard(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const ihP = resolvePlayer(a.player ?? 'self', ctx);
      const ihTrait = typeof a.trait === 'string' ? a.trait : undefined;
      if (a.optional === true) {
        const ihHuman = (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide ?? null;
        const ihCtrl = ctx.source.player;
        if (ihHuman !== null && ihCtrl === ihHuman) {
          const { optional: _ihOpt, ...ihRest } = a;
          void _ihOpt;
          pushPendingEffectOptionalSide({
            player: ihCtrl,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '', uid: ctx.source.uid ?? '' },
            triggerPayload: (ctx as { triggerPayload?: unknown }).triggerPayload,
          });
          // resume = optional{atom (flag 除去)} — applyOptionalAndContinuation の walk が
          // dyn.optionalRun で run/skip を確定する (run:false = parallel[] で完全 no-op)。
          setPendingOptionalResume({ kind: 'optional', effect: { kind: 'atom', verb: 'invokeHiramekiOfCard', args: ihRest } } as never);
          setPendingOptionalBindings({ ...(ctx.bindings as Record<string, unknown>) });
          setPendingOptionalCostPaid((ctx as { costPaid?: Record<string, unknown> }).costPaid);
          mutate.log.append(s, { ts: Date.now(), player: ihCtrl, turn: s.turn.number, action: 'effect:invokeHiramekiOfCard:awaiting-optional' });
          return;
        }
        // AI / non-human: skip (「してもよい」既定不使用 — walk-level optional と同 posture)
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:invokeHiramekiOfCard', target: 'optional-skip' });
        return;
      }
      let ihIds: string[] = [];
      if (a.cardIds !== undefined) {
        const resolved = resolveBindRef(a.cardIds, ctx);
        if (Array.isArray(resolved)) {
          ihIds = resolved.filter((x): x is string => typeof x === 'string' && !x.startsWith('$'));
        }
      } else if (a.cardId !== undefined) {
        // S1 wave (2026-07-11, B06036): cardId='$pick.cardId' + target query → Pattern B await-pick。
        // 「コストによって表向きになった〜のカードを1枚まで選び、その【ヒラメキ】の効果を発動」—
        // cost が表向きにした複数枚 (fromGroupCards:'$costFlipped') から 1 枚を選ばせる。
        // apply-pick は evidence:side:idx uid → cardId 逆引き対応済 (resolveCardIdFromPickUid)。
        // 0枚辞退 = cardId 未解決のまま re-dispatch されず → 発動なし (「1枚まで」rules/15)。
        if (a.cardId === '$pick.cardId' && a.target && typeof a.target === 'object') {
          tryRePickFromAtom(s, { kind: 'atom', verb: 'invokeHiramekiOfCard', args: a }, ctx, {
            byPlayer: ihP,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, { ts: Date.now(), player: ihP, turn: s.turn.number, action: 'effect:invokeHiramekiOfCard:awaiting-pick' });
          return;
        }
        const c = resolveBindRef(a.cardId, ctx);
        if (typeof c === 'string' && !c.startsWith('$')) ihIds = [c];
      }
      for (const cid of ihIds) invokeHiramekiOfCard(s, cid, ihP, ihTrait);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:invokeHiramekiOfCard', target: ihIds.join(',') });
      return;
    }

export function atomHandAddFromDeck(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // engine-extension #5a (2026-06-05): deck-reorder 系の補助 — bind 済 cardId をデッキから抜き手札へ。
      // 用途: 「上から N 枚見る → 1枚まで(filter)を手札に加え → 残りはデッキ下」(D01013/B01013 etc.).
      // 通常 a.cardId='$matched.cardId' で bind 解決 → デッキから splice → hand.add。
      const hadP = resolvePlayer(a.player, ctx);
      const rawHadCardId = a.cardId;
      const hadCardId = resolveBindRef(rawHadCardId, ctx) as string;
      if (typeof hadCardId !== 'string' || hadCardId.startsWith('$')) {
        // WC2a (2026-07-11, B05093): cardId='$pick.cardId' + pick query → await-pick で相手が選ぶ
        // deck-window を surface する (sceneEnter scene.ts:155 の $pick.cardId 経路と同型 Pattern B)。
        // byPlayer は owner 側 hadP を渡すだけ — resolve-picks の chooser chokepoint が target.chooser
        // ='opp-of-owner' から opp 側へ解決する。解決後 apply-pick が cardId=$pick.cardId contract で
        // 実 cardId を載せ再実行 (source.player=owner=BUG-175 ownerPlayer) → 下 splice/hand.add に合流。
        if (rawHadCardId === '$pick.cardId' && a.target && typeof a.target === 'object') {
          tryRePickFromAtom(s, { kind: 'atom', verb: 'handAddFromDeck', args: a }, ctx, {
            byPlayer: hadP,
            source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
          });
          mutate.log.append(s, { ts: Date.now(), player: hadP, turn: s.turn.number, action: 'effect:handAddFromDeck:awaiting-pick' });
          return;
        }
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
        // 解決済 (0〜max 枚): 各 cardId を source zone → hand へ移す (rules/15「〜まで」= 0 枚可 → no-op + log)。
        const cardIds = rawCardIds as string[];
        // engine A1 wave (2026-07-11, B07049/B09039): source area union (remove ∪ partner-area) —
        // 「自分のリムーブエリアかパートナーエリアにある〚特徴[ビッグジュエル]〛の…を手札に加える」。
        // candidate 列挙は PR234 の area 配列 union が既に対応 (candidates.ts 'partner-area' = partnerAreaCards)。
        // splice 側を area ごとに順に探す (pick 済 cardId は一意 zone 由来 = charStackCard/charSetCard union と同流儀)。
        // area 無指定 / ['remove'] のみ = 従来 remove-only path と byte 等価 (B09034 等の既存 consumer 回帰0)。
        // ⚠ partner-area の対象は partnerAreaCards (非MR 一般カード枠) — partnerAreaMR (MR 専用 slot) は
        // candidates 'partner-area' が列挙しない (read/candidates 実測) ため本 consumer 群では非到達 (MR slot 清掃不要)。
        const hafrSrcRaw = (a.target && typeof a.target === 'object')
          ? (a.target as { query?: { area?: string | string[] } }).query?.area : undefined;
        const hafrSrcAreas = (Array.isArray(hafrSrcRaw) ? hafrSrcRaw : [hafrSrcRaw])
          .filter((x): x is 'remove' | 'partner-area' => x === 'remove' || x === 'partner-area');
        const hafrAreas: Array<'remove' | 'partner-area'> = hafrSrcAreas.length > 0 ? hafrSrcAreas : ['remove'];
        const movedIds: string[] = [];
        for (const cid of cardIds) {
          for (const ar of hafrAreas) {
            if (ar === 'remove') {
              const remM = s.players[p].remove;
              const idx = remM.indexOf(cid);
              if (idx !== -1) { remM.splice(idx, 1); mutate.remove.emitExit(s, p, cid); mutate.hand.add(s, p, [cid]); movedIds.push(cid); break; }
            } else {
              const pa = s.players[p].partnerAreaCards;
              const idx = pa ? pa.indexOf(cid) : -1;
              if (idx !== -1) { pa!.splice(idx, 1); mutate.hand.add(s, p, [cid]); movedIds.push(cid); break; }
            }
          }
        }
        mutate.log.append(s, {
          ts: Date.now(), player: p, turn: s.turn.number, action: 'effect:handAddFromRemove',
          target: movedIds.join(','), result: cardIds.length === 0 ? '0' : (movedIds.length ? 'ok' : 'not-found'),
        });
        // S1 wave (2026-07-11, B09039 a2): gateOnZero (opt-in) — 「カードを手札に加えた場合、手札を
        // 1枚リムーブする」の「加えた場合」gate。0 枚 (辞退 or 候補喪失) なら後続 chain step を skip
        // (useEventFromHand の gate-on-0 と同型)。既存 consumer は未宣言 → byte 互換。
        if ((a as { gateOnZero?: boolean }).gateOnZero === true && movedIds.length === 0) {
          (ctx.dyn ??= {}).chainStepNoApply = true;
        }
        return;
      }
      const hafrArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.handAddFromRemove.defaultArea, a, p, a.player as Player) }
        : a;
      // M2後半 (2026-07-10, PR234 a2): target の bind 参照 ($trigger.setCardId 等) を解決してから
      // cardId 照合する。「その中から1枚」= trigger payload の厳密対象 (filter:{cardName} 代替は
      // 同名別 printing 混在で観測差)。非 '$' 文字列は resolveBindRef が素通し = 既存 byte 互換。
      const target0 = normalizeTargetToString(hafrArgs.target);
      const target = typeof target0 === 'string' ? (resolveBindRef(target0, ctx) as string) : target0;
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

export function atomRemoveAreaToDeckTop(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // mega-wave W6 step11 (2026-07-04, row999 item4 / P42): 「自分のリムーブエリアにあるキャラを
      //   1枚まで選び、デッキの上に移す」(B07014 rider)。handAddFromRemove 単一 path clone、
      //   dest = deck top (mutate.deck.toTop)。rules/15「まで」= 0枚可 (pick 型は n 未満可)。
      //   remove からの離脱なので remove:exit emit (wave-4 契約、handAddFromRemove と同じ)。
      // ⚠ removeAreaAllToDeckBottom (全件 bottom + shuffle) とは別 verb — 命名衝突注意 (row999 risks④)。
      const rtdP = resolvePlayer(a.player, ctx);
      const rtdArgs = (a.target === undefined && hasNorMax(a))
        ? { ...a, target: buildShortFormPick(ATOM_PICK_SPEC.removeAreaToDeckTop!.defaultArea, a, rtdP, a.player as Player) }
        : a;
      const rtdTarget = normalizeTargetToString(rtdArgs.target);
      if (!rtdTarget) {
        tryRePickFromAtom(s, { kind: 'atom', verb, args: rtdArgs }, ctx, { byPlayer: rtdP, source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' } });
        mutate.log.append(s, { ts: Date.now(), player: rtdP, turn: s.turn.number, action: 'effect:removeAreaToDeckTop:awaiting-pick' });
        return;
      }
      const rtdRem = s.players[rtdP].remove;
      const rtdIdx = rtdRem.indexOf(rtdTarget);
      let rtdMoved = false;
      if (rtdIdx !== -1) {
        rtdRem.splice(rtdIdx, 1);
        mutate.remove.emitExit(s, rtdP, rtdTarget); // remove→deck 離脱 (原因非依存 remove:exit)
        // engine defer-unlock mini-wave (2026-07-09): dest:'bottom' = 「デッキの下に移す」(B02076)。
        // 従来 (dest 未指定) は top 固定 (B07014) — 既存 consumer は byte 不変。
        if (a.dest === 'bottom') {
          mutate.deck.toBottom(s, rtdP, [rtdTarget]);
        } else {
          mutate.deck.toTop(s, rtdP, [rtdTarget]);
        }
        rtdMoved = true;
        // S2 deck cluster (2026-07-10, B08057): bindKey — 移動成功分を bound へ accumulate。
        // 「カードを合わせて3枚移した場合」(boundCountCompare) の材料 + deckBottomReorderBound の
        // block 特定に使う。未指定は従来挙動 (既存 consumer B07014/B02076 は byte 不変)。
        if (typeof a.bindKey === 'string') {
          const rtdPrev = ctx.bindings[a.bindKey];
          ctx.bindings[a.bindKey] = [
            ...(Array.isArray(rtdPrev) ? rtdPrev : []),
            { kind: 'card', cardId: rtdTarget, area: 'deck', player: rtdP },
          ];
        }
      }
      // engine defer-unlock mini-wave (2026-07-09): 0枚 (skip/不在) → chainStepNoApply。「〜してもよい。
      // そうした場合、カードを1枚引く」(B02076) の chain gate (discard/partnerAreaRemove と同型)。
      // 単発 path (B07014 rider) では flag は読まれない = 挙動不変。
      if (!rtdMoved) {
        (ctx.dyn ??= {}).chainStepNoApply = true;
      }
      mutate.log.append(s, { ts: Date.now(), player: rtdP, turn: s.turn.number, action: 'effect:removeAreaToDeckTop', target: rtdTarget, result: rtdMoved ? 'ok' : 'not-found' });
      return;
    }

export function atomRemoveAreaAllToDeckBottom(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
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
      // engine defer-unlock mini-wave (2026-07-09): args.player 指定時は **片側のみ** (B04038 白馬探
      // 「自分のリムーブエリアにあるすべてのカードを…」= player:'self'、resolvePlayer で所有者相対)。
      // 未指定は従来どおり両者対称 (B08027) — 既存 consumer は byte 不変。
      const raSlots = a.player === undefined
        ? (['self', 'opp'] as const)
        : ([resolvePlayer(a.player, ctx)] as const);
      for (const pp of raSlots) {
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
