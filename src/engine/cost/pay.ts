// engine.cost.pay — Cost payment (mutates draft)
// spec: Phase 3 Group B Task 3.5
// rules: 21-declared-ability-cost.md, 25-qa-effects-resolution.md (viaCost flag)
//
// IMPORTANT:
//   - Caller MUST invoke pay() inside a produce() block; the function mutates the draft.
//   - During payment we set ctx.viaCost = true. Downstream emit logic can read this
//     to suppress "by own ability" hooks (rules/25). TODO Phase 3.10: wire viaCost
//     into event.emit so triggered abilities do not fire from cost-payment mutations.
//   - canPay() should be called first; pay() throws if a step cannot be paid.

import type { GameState, Cost, EffectCtx, PayResult, Candidate } from '@/engine/types';
import { candidates } from '@/engine/target/candidates.js';
import { mutate } from '@/engine/mutate/index.js';
import { canPay } from './evaluate.js';
import { resolveDynNumber } from '@/engine/dyn/eval.js';
// attribution mini-wave (2026-07-10): costPaid 導出値 (level/kind) の印字値参照。dyn/eval.ts と同一 import 元。
import { def as readDef } from '@/engine/read/def.js';

/**
 * Pay a Cost. Mutates the draft in place.
 * Sets ctx.viaCost = true while executing. Restores prior value when done.
 */
export function pay(state: GameState, cost: Cost, ctx: EffectCtx): PayResult {
  const prevViaCost = ctx.viaCost;
  ctx.viaCost = true;

  try {
    const result: PayResult = { paidItems: [], releasedTriggers: [] };
    payInner(state, cost, ctx, result);
    return result;
  } finally {
    ctx.viaCost = prevViaCost;
  }
}

function payInner(state: GameState, cost: Cost, ctx: EffectCtx, acc: PayResult): void {
  switch (cost.kind) {
    case 'sleepSelf': {
      const uid = ctx.source.uid;
      if (!uid) throw new Error('cost.pay: sleepSelf requires ctx.source.uid');
      mutate.scene.setState(state, uid, 'sleep');
      acc.paidItems.push({ kind: 'sleepSelf', details: { uid } });
      return;
    }
    // BUG-156 修正 (2026-06-27): 旧実装は `targets = ctx.picked ?? cands` を全件 sleep していた。
    //   ctx.picked は cost 経路で production 未配線 (UI/AI が surface する cost picker は flipFaceUpEvidence
    //   のみ、ctx.picked は全 cost で dead) → cands=候補全 active 一致を sleep し、cost.target.n.max を
    //   honor せず 2+ active 候補で全 sleep (rules/15「1枚」違反 = over-pay)。
    //   stunChar (下記 case) と完全同形に是正: n.max cap + active gate + head-fixed。
    //   (1) active gate — canPay が ≥1 active を要求 (evaluate.ts sleepChar) ゆえ pay 時 active 保証。
    //       非 active cand は元々 setState(sleep) が no-op (sleep=同状態 / stun=rules/03 でスタン維持) → skip しても挙動不変。
    //   (2) maxN — ctx.picked 配線後はその選択を優先 (Infinity)、未配線時は pick の n.max ぶんだけ sleep。
    //   「どの active を sleep するか」の player-choice は全 target-pick cost 共通の pre-existing 制約 (別 initiative)。
    case 'sleepChar': {
      const cands = candidates(state, cost.target, ctx);
      const targets = ctx.picked ?? cands;
      const maxN = ctx.picked ? Infinity : (cost.target.kind === 'pick' ? cost.target.n.max : Infinity);
      let slept = 0;
      for (const cand of targets) {
        if (slept >= maxN) break;
        if (cand.kind !== 'char') continue;
        const c = state.players.self.scene.find(x => x.uid === cand.uid)
          ?? state.players.opp.scene.find(x => x.uid === cand.uid);
        if (!c || c.state !== 'active') continue;
        mutate.scene.setState(state, cand.uid, 'sleep');
        acc.paidItems.push({ kind: 'sleepChar', details: { uid: cand.uid } });
        slept++;
      }
      return;
    }
    // engine additive wave (2026-06-24): stunChar — sleepChar と対称だが新規ゆえ「N枚」counts を faithful に守る。
    //   (1) active なターゲットのみ stun 化 (コスト文「アクティブ状態の[X]」、mixed-state で非active を誤らない)。
    //   (2) ctx.picked 未配線 (sleepChar 由来の over-pay = BUG-156) の現状で、pick の n.max ぶんだけ stun し
    //       複数 active 候補の全スタン (「1枚」違反) を防ぐ。ctx.picked 配線後はその選択を優先 (maxN=∞)。
    case 'stunChar': {
      const cands = candidates(state, cost.target, ctx);
      const targets = ctx.picked ?? cands;
      const maxN = ctx.picked ? Infinity : (cost.target.kind === 'pick' ? cost.target.n.max : Infinity);
      let stunned = 0;
      for (const cand of targets) {
        if (stunned >= maxN) break;
        if (cand.kind !== 'char') continue;
        const c = state.players.self.scene.find(x => x.uid === cand.uid)
          ?? state.players.opp.scene.find(x => x.uid === cand.uid);
        if (!c || c.state !== 'active') continue;
        mutate.scene.setState(state, cand.uid, 'stun');
        acc.paidItems.push({ kind: 'stunChar', details: { uid: cand.uid } });
        stunned++;
      }
      return;
    }
    case 'removeFromHand': {
      const targets = pickCandidates(state, cost.target, ctx, cost.n);
      const ids = targets
        .filter((c): c is Candidate & { kind: 'card' } => c.kind === 'card')
        .map(c => c.cardId);
      // W3 (r17): 宣言コスト由来は hand:removed を emit しない (rules/21)
      mutate.hand.discardToRemove(state, ctx.source.player, ids, { viaCost: true });
      acc.paidItems.push({ kind: 'removeFromHand', details: { ids } });
      // attribution mini-wave (2026-07-10): costRemovedMatches{key:'removeFromHand'} (B09060) と
      // dyn $cost.removeFromHand.level (B09050「リムーブしたカードとレベルが同じか低い」) が読む。
      // level は先頭 1 枚の印字値 (対象カードは n=1 のみ。removeDeckTop の ids 記録と同型)。
      if (!ctx.costPaid) ctx.costPaid = {};
      ctx.costPaid['removeFromHand'] = { ids, level: readDef.card(ids[0])?.level };
      return;
    }
    // engine additive wave (2026-06-28): revealFromHand — 手札公開 presence-check cost (B08093 a1)。
    // pay() は no-op: 公開のみでカードは手札に残る (mutate しない、消費なし)。paidItems に log のみ。
    case 'revealFromHand': {
      // n: {min,max} (attribution mini-wave 2026-07-10): B08068「好きな枚数公開」= 可変枚数。
      // picked (UI/AI 選択) が min 以上あればそれを max まで採用、無ければ filter 一致全部を max まで
      // (公開は多いほど利益 = AI fallback 最大公開)。number は従来 pickCandidates と同一挙動。
      const rfhMin = typeof cost.n === 'number' ? cost.n : cost.n.min;
      const rfhMax = typeof cost.n === 'number' ? cost.n : cost.n.max;
      const targets = (ctx.picked && ctx.picked.length >= rfhMin
        ? ctx.picked.slice(0, rfhMax)
        : candidates(state, cost.target, ctx).slice(0, rfhMax));
      const ids = targets
        .filter((c): c is Candidate & { kind: 'card' } => c.kind === 'card')
        .map(c => c.cardId);
      // W3 (r18): コスト経路の公開も hand:reveal を emit (B09004「【宣言】能力のコストによって」)
      mutate.hand.emitReveal(state, ctx.source.player, ids);
      acc.paidItems.push({ kind: 'revealFromHand', details: { ids } });
      // attribution mini-wave (2026-07-10): dyn $cost.revealFromHand.count (B08068「公開した枚数」) と
      // costRevealedMatches (B09005「公開したカードが〜の場合」) が読む。
      // S1 wave (2026-07-11, B09109 a2): cardName — 「カード名を公開したキャラのカード名に書き換える」が
      // charSetTurnEffect{key:'nameOverride', val:'$cost.revealFromHand.cardName'} で読む (先頭 1 枚の
      // 印字名。複数名カードは names[0]=複合名 — nameOverride は完全置換、rules/19 分割 override は
      // 公式裁定なしの既存設計判断と同 posture)。
      if (!ctx.costPaid) ctx.costPaid = {};
      const rfhName = ids.length > 0 ? readDef.card(ids[0])?.names?.[0] : undefined;
      ctx.costPaid['revealFromHand'] = { ids, count: ids.length, cardName: rfhName };
      return;
    }
    // engine mega-wave W1 (2026-07-03, P29): revealHandToDeckTop — 手札公開→デッキ上 cost (B05049 a1)。
    // revealFromHand との差 = 手札から抜いてデッキ上へ移す 2 mutate のみ (公式Q&A B05049:
    // 「裏向きでデッキの上に移す」= deck は CardId[] で不可視ゆえ表現済)。
    case 'revealHandToDeckTop': {
      const targets = pickCandidates(state, cost.target, ctx, cost.n);
      const ids = targets
        .filter((c): c is Candidate & { kind: 'card' } => c.kind === 'card')
        .map(c => c.cardId);
      // W3 (r18) 混成 review nit 反映: 「公開して…移す」cost も手札公開 — emit は移動前 (カードが
      // 手札に在る時点、hand:reveal の on-hand scan 契約)。B09004「【宣言】能力のコストによって」を
      // method-agnostic に被覆する (emitReveal 単一ソースの残 site)。
      mutate.hand.emitReveal(state, ctx.source.player, ids);
      mutate.hand.remove(state, ctx.source.player, ids);
      mutate.deck.toTop(state, ctx.source.player, ids);
      acc.paidItems.push({ kind: 'revealHandToDeckTop', details: { ids } });
      return;
    }
    case 'removeFromScene': {
      const targets = pickCandidates(state, cost.target, ctx, cost.n);
      const chars = targets.filter((cand): cand is Candidate & { kind: 'char' } => cand.kind === 'char');
      // One removeFromScene cost pays all selected characters simultaneously.
      // This preserves leave-trigger auras when bearer and recipient leave together.
      mutate.scene.removeToRemoveBatch(state, chars.map(cand => cand.uid), 'cost');
      for (const cand of chars) acc.paidItems.push({ kind: 'removeFromScene', details: { uid: cand.uid } });
      return;
    }
    // engine mega-wave W4 (2026-07-03, r6): 現場キャラを能力使用キャラ自身の下に重ねる cost (B09048 a2)。
    // mutate.scene.toStack = 非リムーブ離場 (rules/16 cascade + B09048 Q&A MR 非redirect)。
    case 'sceneStackUnderSelf': {
      const hostUid = ctx.source.uid;
      if (typeof hostUid !== 'string') return;
      const targets = pickCandidates(state, cost.target, ctx, cost.n);
      for (const cand of targets) {
        if (cand.kind !== 'char') continue;
        mutate.scene.toStack(state, cand.uid, hostUid);
        acc.paidItems.push({ kind: 'sceneStackUnderSelf', details: { uid: cand.uid, hostUid } });
      }
      return;
    }
    // engine mega-wave W4 (2026-07-03, r7): 手札公開→現場キャラ下に重ねる cost (B08006 a1)。
    // 公開 emit は移動前 (revealHandToDeckTop と同契約、hand:reveal on-hand scan)。
    // host 選択も cost pick (現状 deterministic first-candidate = 出荷済 cost 群と同じ既知 gap)。
    case 'handStackUnder': {
      const cardCands = pickCandidates(state, cost.cardTarget, ctx, 1);
      const hostCands = pickCandidates(state, cost.hostTarget, ctx, 1);
      const cardCand = cardCands.find((c): c is Candidate & { kind: 'card' } => c.kind === 'card');
      const hostCand = hostCands.find((c): c is Candidate & { kind: 'char' } => c.kind === 'char');
      if (!cardCand || !hostCand) return;
      mutate.hand.emitReveal(state, ctx.source.player, [cardCand.cardId]);
      mutate.hand.remove(state, ctx.source.player, [cardCand.cardId]);
      mutate.char.stackCard(state, hostCand.uid, 1);
      acc.paidItems.push({ kind: 'handStackUnder', details: { cardId: cardCand.cardId, hostUid: hostCand.uid } });
      return;
    }
    // Task D E2 (2026-06-12): 〚現場にいる…を n 枚デッキの下に移す〛コスト。
    // UI 選択 (ctx.dyn.costParams.sceneToDeckBottom.uids) を優先し、無ければ
    // pickCandidates (ctx.picked → 先頭 n) fallback。rules/09・23: リムーブではない
    // ため leave:to-remove は発火しない (scene.toDeck 経由、rules/16 set/stacked 清掃込み)。
    case 'sceneToDeckBottom': {
      const explicit = readSceneToDeckUids(ctx);
      const uids: string[] = [];
      if (explicit.length >= cost.n) {
        uids.push(...explicit.slice(0, cost.n));
      } else {
        const targets = pickCandidates(state, cost.target, ctx, cost.n);
        for (const cand of targets) {
          if (cand.kind === 'char') uids.push(cand.uid);
        }
      }
      // attribution mini-wave (2026-07-10): dyn $cost.sceneToDeckBottom.level (B07025「移した
      // キャラとレベルが同じか低い」) が読む。cardId は toDeck (splice) 前に捕捉する。
      const stdbIds: string[] = [];
      for (const uid of uids) {
        const ch = state.players[ctx.source.player].scene.find(c => c.uid === uid);
        if (ch) stdbIds.push(ch.cardId);
        mutate.scene.toDeck(state, uid, 'bottom');
        acc.paidItems.push({ kind: 'sceneToDeckBottom', details: { uid } });
      }
      if (!ctx.costPaid) ctx.costPaid = {};
      ctx.costPaid['sceneToDeckBottom'] = { ids: stdbIds, level: readDef.card(stdbIds[0])?.level };
      return;
    }
    // cluster4 (2026-06-14): 〚リムーブエリアにある…を n 枚デッキの下に移す〛コスト。
    // sceneToDeckBottom の area:'remove' 版。UI 選択 (ctx.dyn.costParams.removeAreaToDeckBottom.ids)
    // 優先、無ければ pickCandidates (ctx.picked → 先頭 n) fallback。p は自分のリムーブエリアのみ
    // (rules/21「自分の」省略 + cost.target は query.side:'self')。
    // rules/09・23: (現場からの) デッキ下移動は scene-removal ではない (leave:to-remove /【現場リムーブ時】
    // hook は発火しない)。デッキは増えるだけなので refresh は起きない (rules/14/26)。
    // ⚠ engine additive wave-4 (2026-07-01): mutate.remove.removeFromHere は **リムーブエリアからの離脱** に
    // 対し remove:exit hook を emit する (B05087/B05088、原因非依存 rules/17 類推)。本コスト経路もコストで
    // remove→deck下 へ移すため remove:exit が発火する。コスト由来発火を card 側が拾うべきか (rules/21 コスト
    // 免除) は B05087/B05088 出荷時に官報 Q&A で確定 (engine 側は method-agnostic に発火 = 正しい既定)。
    case 'removeAreaToDeckBottom': {
      const p = ctx.source.player;
      const explicit = readRemoveAreaToDeckIds(ctx);
      const ids: string[] = [];
      if (explicit.length >= cost.n) {
        ids.push(...explicit.slice(0, cost.n));
      } else {
        const targets = pickCandidates(state, cost.target, ctx, cost.n);
        for (const cand of targets) {
          if (cand.kind === 'card') ids.push(cand.cardId);
        }
      }
      mutate.remove.removeFromHere(state, p, ids);
      mutate.deck.toBottom(state, p, ids);
      for (const id of ids) acc.paidItems.push({ kind: 'removeAreaToDeckBottom', details: { id } });
      return;
    }
    // engine defer-unlock mini-wave (2026-07-09): 〚パートナーエリアにある…のカードを n 枚リムーブする〛
    // コスト (B07039 アン王女)。removeAreaToDeckBottom と同型: UI 選択 (ctx.dyn.costParams.
    // partnerAreaRemove.ids) 優先、無ければ pickCandidates fallback (AI/smoke)。p は自分の PA のみ
    // (rules/21「自分の」省略 + 公式Q&A B07039: コストでは自分のカードしか使えない)。移動は
    // mutate.partner.removeAreaCardsToRemove (atom verb partnerAreaRemove と同 mutate = lastIndexOf
    // splice + remove:exit なし — PA は remove エリアでないため exit hook 対象外、G39 契約)。
    case 'partnerAreaRemove': {
      const p = ctx.source.player;
      const explicit = readPartnerAreaRemoveIds(ctx);
      const ids: string[] = [];
      if (explicit.length >= cost.n) {
        ids.push(...explicit.slice(0, cost.n));
      } else {
        // partner 本体 candidate を除いた上で n 枚 (canPay と対称 — pickCandidates の先頭 slice に
        // {kind:'partner'} が混ざると支払い枚数が n を割るため)。
        const patTargets = candidates(state, cost.target, ctx).filter(c => c.kind === 'card').slice(0, cost.n);
        for (const cand of patTargets) {
          if (cand.kind === 'card') ids.push(cand.cardId);
        }
      }
      mutate.partner.removeAreaCardsToRemove(state, p, ids);
      for (const id of ids) acc.paidItems.push({ kind: 'partnerAreaRemove', details: { id } });
      return;
    }
    // engine additive wave (2026-06-24): 〚現場にいるキャラに裏向きでセットされているカードを合わせて n 枚
    //   リムーブする〛コスト (B08033 a2)。UI 選択 (ctx.dyn.costParams.removeSetCard.hostUids — 1 removal=1
    //   entry、repeat で同一 host から複数枚=2-from-1) を優先、無ければ self scene 順に face-down set card を
    //   n 枚 fallback (AI/smoke)。p は自分のみ (rules/21「自分の」省略、canPay も ctx.source.player 限定)。
    // 各 removal は removeOneSetCard(faceDownOnly:true, cause:'cost') 経由で表向きリムーブ + setcard:leave emit
    //   → B07034 等「離れるたび」observer が発火 (faithful: 当該 observer に ability/effect gate 無)。
    case 'removeSetCard': {
      const p = ctx.source.player;
      // rules/21「自分の」省略 → コストで使えるのは自分のカードのみ。removeOneSetCard→findChar は
      // self/opp 両 scene を探索するため、explicit hostUids を **自陣 scene の uid に filter** して
      // 相手 set card の誤リムーブを防ぐ (self-only 不変条件を engine 側で担保、review concern #3)。
      const selfUids = new Set(state.players[p].scene.map(c => c.uid));
      // hostSelf (attribution mini-wave 2026-07-10, B08041「このキャラに〜」): host を能力使用
      // キャラ自身に限定 (explicit / fallback 両経路。canPay evaluate.ts と対)。
      const hostOk = (uid: string) => !cost.hostSelf || uid === ctx.source.uid;
      const explicit = readRemoveSetCardUids(ctx).filter(u => selfUids.has(u) && hostOk(u));
      const uids: string[] = [];
      if (explicit.length >= cost.n) {
        uids.push(...explicit.slice(0, cost.n));
      } else {
        let need = cost.n;
        for (const c of state.players[p].scene) {
          if (!hostOk(c.uid)) continue;
          // anyFace (夜間 W0 2026-07-11, B05052): 表裏不問に計数。未指定は従来通り裏向きのみ。
          let fd = cost.anyFace ? c.setCards.length : c.setCards.filter(e => !e.faceUp).length;
          while (fd > 0 && need > 0) { uids.push(c.uid); fd--; need--; }
          if (need === 0) break;
        }
      }
      // attribution mini-wave (2026-07-10): costRemovedMatches{key:'removeSetCard'} (B08041
      // 「リムーブしたカードがキャラ/イベントの場合」) が読む。kinds は各除去カードの印字種別。
      const rscIds: string[] = [];
      for (const uid of uids) {
        const removed = mutate.char.removeOneSetCard(
          state, uid,
          cost.anyFace ? { cause: 'cost' } : { faceDownOnly: true, cause: 'cost' },
        );
        if (removed) {
          rscIds.push(removed);
          acc.paidItems.push({ kind: 'removeSetCard', details: { hostUid: uid, setCardId: removed } });
        }
      }
      if (!ctx.costPaid) ctx.costPaid = {};
      ctx.costPaid['removeSetCard'] = { ids: rscIds, kinds: rscIds.map(id => readDef.card(id)?.kind) };
      return;
    }
    case 'removeStackedCards': {
      const hostUid = ctx.source.uid;
      if (typeof hostUid !== 'string') throw new Error('cost.pay: removeStackedCards requires ctx.source.uid');
      const entries = mutate.char.removeStackedCards(state, hostUid, cost.n, readRemoveStackedCardInstanceIds(ctx));
      if (entries.length !== cost.n) throw new Error('cost.pay: removeStackedCards is not payable');
      const removeStart = state.players[ctx.source.player].remove.length;
      const paidEntries = entries.map((entry, offset) => ({
        cardId: entry.cardId, instanceId: entry.instanceId, removeIndex: removeStart + offset,
      }));
      state.players[ctx.source.player].remove.push(...paidEntries.map(entry => entry.cardId));
      acc.paidItems.push({ kind: 'removeStackedCards', details: { hostUid, entries: paidEntries } });
      if (!ctx.costPaid) ctx.costPaid = {};
      ctx.costPaid['removeStackedCards'] = { entries: paidEntries };
      return;
    }
    case 'removeDeckTop': {
      // mega-wave W5 (r37): n は number | {dyn} — canPay と同一式で解決 (evaluate.ts と対)。
      const rdN = resolveDynNumber(cost.n, state, ctx);
      const removed = mutate.deck.removeFromTop(state, cost.player, rdN);
      acc.paidItems.push({ kind: 'removeDeckTop', details: { removed } });
      // engine additive wave (2026-06-29d): costRemovedMatches cond (B03003/B04077/B06078
      // 「コストによって〚X〛がリムーブされた場合」) が参照する除去 cardId を ctx.costPaid へ記録。
      // flipFaceUpEvidence の count 記録と同型。複数 removeDeckTop コストは ids を accumulate (rare)。
      if (!ctx.costPaid) ctx.costPaid = {};
      const prior = (ctx.costPaid['removeDeckTop'] as { ids?: string[] } | undefined)?.ids ?? [];
      ctx.costPaid['removeDeckTop'] = { ids: [...prior, ...removed] };
      return;
    }
    // engine A3 wave (2026-07-11, B09107): デッキ全部リムーブ。removeFromTop(deck.length) で全除去。
    //   player は controller 相対 (ctx.source.player = 「自分の」rules/21)。cost.player は shape のみ。
    //   ★T2 review BLOCK (両 lens 一致、night-wA): 公式Q&A (B09107 TSV) 「リフレッシュはコストを
    //   支払った時点で (この【宣言】能力の効果を解決するより前に) 行います」— 全除去でデッキ 0 に
    //   なるため rules/14 の refresh をここで即時発火する (mill の BUG-137 guard と同 idiom)。
    //   リムーブエリア 0 (=支払前の deck が空で removed も 0) なら refresh 不能 → 支払者敗北 (rules/14)。
    case 'removeDeckAll': {
      const p = ctx.source.player;
      const removed = mutate.deck.removeFromTop(state, p, state.players[p].deck.length);
      acc.paidItems.push({ kind: 'removeDeckAll', details: { removed } });
      if (state.players[p].deck.length === 0) {
        const r = mutate.deck.refresh(state, p);
        if (!r.ok && state.gameResult === undefined) {
          const winner: 'self' | 'opp' = p === 'self' ? 'opp' : 'self';
          mutate.gameResult.set(state, winner, 'deck-out');
        }
      }
      return;
    }
    case 'discardEvidence': {
      const p = ctx.source.player;
      const ids: string[] = [];
      for (let i = 0; i < cost.n; i++) {
        const top = mutate.evidence.removeTop(state, p);
        if (top) ids.push(top.cardId);
      }
      acc.paidItems.push({ kind: 'discardEvidence', details: { ids } });
      return;
    }
    // M2後半 (2026-07-10, B06003 a1): 〚ターン終了時までLP-2する〛— lpMod_turn 書込のみ。
    // emit なし (rules/21: コストで行ったことは「効果によって」条件を満たさない。modifyLP は
    // event を発しない mutator なので追加抑止も不要)。clearTurnEffects で失効。
    case 'selfLpDeltaTurn': {
      const uid = ctx.source.uid;
      if (!uid) throw new Error('cost.pay: selfLpDeltaTurn requires ctx.source.uid');
      mutate.char.modifyLP(state, uid, cost.delta, 'turn');
      acc.paidItems.push({ kind: 'selfLpDeltaTurn', details: { uid, delta: cost.delta } });
      return;
    }
    // M2後半 (2026-07-10, B08047 a2): 〚手札が n 枚になるまで手札をリムーブする〛。
    // count = max(0, hand - n)。0 枚は no-op 成功 (公式Q&A: 実質支払なし)。head-fixed
    // (全 target-pick cost 共通の既存制約と同 posture)。viaCost で hand:removed 非 emit (rules/21)。
    case 'removeFromHandDownTo': {
      const p = ctx.source.player;
      const cnt = Math.max(0, state.players[p].hand.length - cost.n);
      const ids = state.players[p].hand.slice(0, cnt);
      if (ids.length > 0) mutate.hand.discardToRemove(state, p, ids, { viaCost: true });
      acc.paidItems.push({ kind: 'removeFromHandDownTo', details: { ids } });
      return;
    }
    case 'selfToDeckBottom': {
      const uid = ctx.source.uid;
      if (!uid) throw new Error('cost.pay: selfToDeckBottom requires ctx.source.uid');
      mutate.scene.toDeckBottom(state, uid);
      acc.paidItems.push({ kind: 'selfToDeckBottom', details: { uid } });
      return;
    }
    case 'pay': {
      for (const item of cost.items) {
        payInner(state, item, ctx, acc);
      }
      return;
    }
    case 'choice': {
      // Use ctx.dyn['costChoice'] (number index) if present, else first payable branch.
      const chooseIdx = readChosenIndex(ctx);
      const chosen = chooseIdx !== undefined ? cost.items[chooseIdx] : cost.items.find(i => canPay(state, i, ctx));
      if (!chosen) throw new Error('cost.pay: choice has no payable branch');
      payInner(state, chosen, ctx, acc);
      return;
    }
    case 'fileFrom': {
      // BUG-129 (Task D E3, 2026-06-12): 旧実装は popTop の戻り値を破棄しカードがゲームから
      // 消失していた (リフレッシュ母数バグ、rules/03/14)。FILE 所有者のリムーブエリアへ移す。
      const p = ctx.source.player;
      const ffIds: string[] = [];
      for (let i = 0; i < cost.n; i++) {
        const popped = mutate.file.popTop(state, p);
        if (popped) ffIds.push(popped.cardId);
      }
      if (ffIds.length > 0) {
        mutate.remove.add(state, p, ffIds);
      }
      acc.paidItems.push({ kind: 'fileFrom', details: { n: cost.n, ids: ffIds } });
      return;
    }
    case 'flipFaceUpEvidence': {
      const p = ctx.source.player;
      const indices = readFlipIndices(ctx);
      if (indices.length < cost.n.min || indices.length > cost.n.max) {
        throw new Error(
          `cost.pay: flipFaceUpEvidence picks ${indices.length} out of [${cost.n.min}, ${cost.n.max}]`,
        );
      }
      for (const idx of indices) {
        mutate.evidence.flipFaceUp(state, p, idx);
      }
      // Record count for $cost.flipFaceUpEvidence.count placeholder access.
      // WC2b (2026-07-11): ids も記録 — 「コストによって表向きになった【ヒラメキ】持ちカードの
      // その【ヒラメキ】を発動」(B06023/B06036) が $cost.flipFaceUpEvidence.ids で識別する。
      // flip は既に適用済みなので state.players[p].evidence[idx].cardId が表向き化した cardId (removeDeckTop.ids 同型)。
      if (!ctx.costPaid) ctx.costPaid = {};
      const flippedIds = indices
        .map(i => state.players[p].evidence[i]?.cardId)
        .filter((id): id is string => typeof id === 'string');
      ctx.costPaid['flipFaceUpEvidence'] = { count: indices.length, ids: flippedIds };
      // S1 wave (2026-07-11, B06036): fromGroupCards 用の bound 集合も書く — 「コストによって表向きに
      // なった〜のカードを1枚まで選び」が pick query {area:'evidence', fromGroupCards:'$costFlipped'}
      // で母集合を「今回 flip した証拠」に限定する (照合キー = player:evidence:index、candidates.ts
      // fromGroupCardKeys と対)。ids (cardId) だけでは同名証拠の位置区別ができないため index を持つ。
      (ctx.bindings as Record<string, unknown>)['$costFlipped'] = indices
        .filter(i => typeof state.players[p].evidence[i]?.cardId === 'string')
        .map(i => ({ kind: 'card', cardId: state.players[p].evidence[i].cardId, area: 'evidence', player: p, index: i }));
      acc.paidItems.push({ kind: 'flipFaceUpEvidence', details: { count: indices.length, indices } });
      return;
    }
    case 'custom': {
      cost.pay(state, ctx);
      acc.paidItems.push({ kind: 'custom', details: {} });
      return;
    }
    // refactor 2b: payInner は void 戻りのため case 追加漏れが TS で検知されなかった
    // (Task D wave#1 で実証)。never 代入で compile-time 検出する。到達不能。
    default: {
      const _exhaustive: never = cost;
      void _exhaustive;
      return;
    }
  }
}

function pickCandidates(
  state: GameState,
  ref: import('@/engine/types').TargetingRef,
  ctx: EffectCtx,
  n: number,
): Candidate[] {
  // Prefer ctx.picked when matched against ref; otherwise take first n from candidates().
  if (ctx.picked && ctx.picked.length >= n) {
    return ctx.picked.slice(0, n);
  }
  const all = candidates(state, ref, ctx);
  return all.slice(0, n);
}

// Task D E2 (2026-06-12): UI が選んだ sceneToDeckBottom コスト対象 (readFlipIndices と同型)
function readSceneToDeckUids(ctx: EffectCtx): string[] {
  const dyn = ctx.dyn;
  const params = dyn && (dyn['costParams'] as Record<string, unknown> | undefined);
  const std = params && (params['sceneToDeckBottom'] as { uids?: string[] } | undefined);
  if (std && Array.isArray(std.uids)) {
    return std.uids;
  }
  return [];
}

// engine defer-unlock mini-wave (2026-07-09): UI が選んだ partnerAreaRemove コスト対象 cardId
// (readRemoveAreaToDeckIds と同型)。
function readPartnerAreaRemoveIds(ctx: EffectCtx): string[] {
  const dyn = ctx.dyn;
  const params = dyn && (dyn['costParams'] as Record<string, unknown> | undefined);
  const r = params && (params['partnerAreaRemove'] as { ids?: string[] } | undefined);
  if (r && Array.isArray(r.ids)) {
    return r.ids;
  }
  return [];
}

// cluster4 (2026-06-14): UI が選んだ removeAreaToDeckBottom コスト対象 cardId (readSceneToDeckUids と同型)
function readRemoveAreaToDeckIds(ctx: EffectCtx): string[] {
  const dyn = ctx.dyn;
  const params = dyn && (dyn['costParams'] as Record<string, unknown> | undefined);
  const r = params && (params['removeAreaToDeckBottom'] as { ids?: string[] } | undefined);
  if (r && Array.isArray(r.ids)) {
    return r.ids;
  }
  return [];
}

// engine additive wave (2026-06-24): UI が選んだ removeSetCard コスト対象の host uid 列
//   (readSceneToDeckUids と同型)。1 removal=1 entry、同一 uid の repeat で 2-from-1-char を表す。
function readRemoveSetCardUids(ctx: EffectCtx): string[] {
  const dyn = ctx.dyn;
  const params = dyn && (dyn['costParams'] as Record<string, unknown> | undefined);
  const r = params && (params['removeSetCard'] as { hostUids?: string[] } | undefined);
  if (r && Array.isArray(r.hostUids)) {
    return r.hostUids;
  }
  return [];
}

function readRemoveStackedCardInstanceIds(ctx: EffectCtx): string[] | undefined {
  const params = ctx.dyn?.['costParams'] as Record<string, unknown> | undefined;
  const selected = params?.['removeStackedCards'] as { instanceIds?: unknown } | undefined;
  return Array.isArray(selected?.instanceIds) && selected.instanceIds.every(id => typeof id === 'string')
    ? selected.instanceIds
    : undefined;
}

function readChosenIndex(ctx: EffectCtx): number | undefined {
  const dyn = ctx.dyn;
  if (dyn && typeof dyn['costChoice'] === 'number') {
    return dyn['costChoice'] as number;
  }
  return undefined;
}

function readFlipIndices(ctx: EffectCtx): number[] {
  const dyn = ctx.dyn;
  const params = dyn && (dyn['costParams'] as Record<string, unknown> | undefined);
  const fpu = params && (params['flipFaceUpEvidence'] as { indices?: number[] } | undefined);
  if (fpu && Array.isArray(fpu.indices)) {
    return fpu.indices;
  }
  return [];
}
