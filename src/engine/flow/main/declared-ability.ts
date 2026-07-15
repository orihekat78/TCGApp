// engine.flow.main.useDeclaredAbility — 宣言能力使用 (rules/05 04.)
// rules: 21-declared-ability-cost.md, 17-icons.md (【ターン①/②】), 24-qa-naming-stun.md
//
// 重要 (rules/21, 24):
//   - 名乗り状態でも宣言能力は使用可能 (例外)
//   - active 状態である必要はない (ただし sleep コストは sleep キャラには支払えない)
//   - 【ターン①/②】は declaredUseCount[abilId] で管理 (rules/15)
//
// Phase 4 境界:
//   - canDeclaredAbility は対象キャラ存在 + 回数制限のみ判定
//   - useDeclaredAbility は flag/log + effect:declared hook の emit のみ
//   - cost は呼出元の responsibility (engine.cost.canPay/pay を ctx に渡す)
//   - 実際の Effect 実行は Phase 5 のカード登録で listener が pendingEffects に積む

import type { GameState, AbilityDef, EffectCtx } from '../../types/index.js';
import { mutate } from '../../mutate/index.js';
import { event } from '../../event/index.js';
import { def as readDef } from '../../read/def.js';
import { char as readChar } from '../../read/char.js'; // BUG-067: ability.limit enforcement
import { evalCond } from '../../cond/eval.js';          // BUG-099: ability.condition gate
import { resolveEffectPicks } from '../../effect/resolve-picks.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';

function getHumanPlayerSide(): 'self' | 'opp' | null {
  return (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
}

/**
 * findCardOnBoard — uid のカードを場 (scene / case / partner-area) から探す。
 *
 * user_request 20260522_01 #5 fix: 旧 `findSceneChar` は scene のみ走査だったため
 * 事件カード (uid 'case:self'/'case:opp') の declared ability が canDeclaredAbility
 * で常に false 判定され UI から発動不可だった。case + partner も含める。
 */
export function findCardOnBoard(
  state: GameState,
  uid: string,
): { player: 'self' | 'opp'; cardId: string; area: 'scene' | 'case' | 'partner-area' | 'hand' } | null {
  // mega-wave W6 step11 (2026-07-04, row999 item3): hand sentinel uid (`hand:${p}:${cardId}` —
  // listeners/triggered.ts collectCardsInPlay の生成規約と 1:1 対称)。B06103 ジン
  // 「この能力はこのカードが手札にある場合に宣言できる」(scope:'on-hand' declared) の resolve 用。
  if (uid.startsWith('hand:')) {
    const [, hp, ...rest] = uid.split(':');
    const cardId = rest.join(':');
    if ((hp !== 'self' && hp !== 'opp') || !cardId) return null;
    if (state.players[hp].hand.includes(cardId)) return { player: hp, cardId, area: 'hand' };
    return null;
  }
  if (uid === 'case:self' || uid === 'case:opp') {
    const p: 'self' | 'opp' = uid === 'case:self' ? 'self' : 'opp';
    const cardId = state.players[p].case.cardId;
    if (cardId) return { player: p, cardId, area: 'case' };
    return null;
  }
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p: 'self' | 'opp' = uid === 'partner:self' ? 'self' : 'opp';
    const cardId = state.players[p].partner.cardId;
    if (cardId) return { player: p, cardId, area: 'partner-area' };
    return null;
  }
  // MR partner-area (rules/18/21:10): PA 常駐 MR の宣言能力を resolve (area='partner-area')。
  if (uid === 'partnerMR:self' || uid === 'partnerMR:opp') {
    const p: 'self' | 'opp' = uid === 'partnerMR:self' ? 'self' : 'opp';
    const slot = state.players[p].partnerAreaMR;
    if (slot) return { player: p, cardId: slot.cardId, area: 'partner-area' };
    return null;
  }
  for (const p of ['self', 'opp'] as const) {
    const c = state.players[p].scene.find((c) => c.uid === uid);
    if (c) return { player: p, cardId: c.cardId, area: 'scene' };
  }
  return null;
}

/**
 * 宣言能力の【ターン①/②】判定。
 *   - Phase 4 では maxPerTurn を引数で受けず、abilId が登録時に持つ前提で
 *     エンジン側はカウントの読み取りのみ提供する。
 *   - 呼出元 (UI / カードリスナ) が `engine.read.char.declaredUseCount` を見て
 *     上限超過なら canDeclaredAbility=false を返すよう拡張可能。
 *   - 暫定: useCount の参照を提供するのみ。
 */

/**
 * findDeclaredAbility — uid/area を考慮した宣言能力 lookup の共有 helper
 * (mega-wave W6 step11, row999 item4)。
 *
 * ① カード自身の印字 abilities を優先。
 * ② area='scene' の場合のみ、host キャラの **faceUp** setCards (rules/16 — 裏向きセットは
 *    イベントとして扱われない) を走査し、type:'declared' + scope:'on-set-host' の rider を探す
 *    (listeners/triggered.ts の riderAbilities walk と同型を declared 用に再利用)。
 *    B07014 弁当型携帯FAX「このイベントがセットされているキャラは『【宣言】【ターン1】〜』を持つ」。
 *
 * canDeclaredAbility / useDeclaredAbility / activateDeclaredAbility / UI enumerators の
 * 呼出点は必ず本関数を共有すること — 個別複製は triggered 側 walk との 2 経路 non-sync
 * drift を生む (cluster2「filter-eval 3経路 sync」教訓と同種)。
 * ⚠ rider の ability.id は host 印字 abilities や他 rider と衝突しうる (card-def.ts の
 * authoring hazard 注記と同じ — rider 側 id は card-unique 命名を徹底)。先勝ち。
 */
export function findDeclaredAbility(
  state: GameState,
  uid: string,
  cardId: string,
  area: 'scene' | 'case' | 'partner-area' | 'hand',
  abilId: string,
): AbilityDef | undefined {
  const printed = area === 'scene' && readChar.originalAbilitiesDisabled(state, uid)
    ? undefined
    : readDef.card(cardId)?.abilities?.find((a: AbilityDef) => a.id === abilId);
  if (printed) return printed;
  if (area !== 'scene') return undefined;
  for (const p of ['self', 'opp'] as const) {
    const host = state.players[p].scene.find((c) => c.uid === uid);
    if (!host) continue;
    // gap② (2026-07-11, B06042): charGrantAbility で付与された declared ability
    // (turnEffects.grantedAbilities[] の type:'declared') を宿主キャラの宣言能力として解決する。
    // rider (on-set-host) walk と同順で、印字 abilities に無い abilId をここで拾う。
    const granted = host.turnEffects['grantedAbilities'];
    if (Array.isArray(granted)) {
      const g = (granted as AbilityDef[]).find((a) => a.id === abilId && a.type === 'declared');
      if (g) return g;
    }
    for (const entry of host.setCards) {
      if (!entry.faceUp) continue;
      const rider = readDef.card(entry.cardId)?.abilities?.find(
        (a: AbilityDef) => a.id === abilId && a.type === 'declared' && a.scope === 'on-set-host',
      );
      if (rider) return rider;
    }
    return undefined;
  }
  return undefined;
}

/**
 * grantedDeclaredAbilitiesOf — 指定 scene char に charGrantAbility で付与された
 * declared ability を列挙する共有 helper (gap② 2026-07-11, B06042)。
 * findDeclaredAbility の granted 走査と 1:1 対称 — UI/AI enumerator が印字 abilities に
 * granted declared を合流させるために使う (rider walk の enumerator 版と同じ役割)。
 */
export function grantedDeclaredAbilitiesOf(
  char: { turnEffects?: Record<string, unknown> } | undefined,
): AbilityDef[] {
  const granted = char?.turnEffects?.['grantedAbilities'];
  if (!Array.isArray(granted)) return [];
  return (granted as AbilityDef[]).filter((a) => a && a.type === 'declared');
}

/**
 * canDeclaredAbility — 宣言能力使用可能か判定する。
 *
 * - 対象キャラが存在する
 * - 名乗り状態でも OK (rules/24)
 * - active でなくても OK (ただし sleep コストは支払不可なため別途 engine.cost.canPay 判定が必要)
 * - 【ターン①/②】 ability.limit (kind:'turn') を enforcement (BUG-067, 2026-05-28)
 *   - 'game' kind は declaredUseCount がターン境界で reset されるため将来仕様、
 *     現状未使用 (cards/_shared / cards/ct-* で全 turn:n=1)
 */
export function canDeclaredAbility(state: GameState, uid: string, abilId: string): boolean {
  const found = findCardOnBoard(state, uid);
  if (!found) return false;
  // ability.limit enforcement
  // W6 step11 (row999 item4): 印字 abilities → faceUp set-card rider (on-set-host declared) の順で解決。
  // 解決不能 (存在しない abilId / faceDown rider) は使用不可 — 旧実装は「不明 abilId → true 素通り」
  // だったが、rider 導入で faceDown セットの宣言が誤って許可されるため fail-closed 化 (rules/16)。
  const ability = findDeclaredAbility(state, uid, found.cardId, found.area, abilId);
  if (!ability) return false;
  // MR partner-area (rules/18:38, engine/mr-partner-area-core 2026-06-23): PA 常駐カード (PA-MR) の宣言能力は
  // scope on-partner-area / always のみ使用可。現場前提の on-scene 宣言能力は PA からは使えない。
  // scene/case の宣言能力 (area≠'partner-area') は不変。real partner (partner:self) は DSL 宣言能力を持たない。
  if (ability && found.area === 'partner-area' && ability.scope !== 'on-partner-area' && ability.scope !== 'always') {
    return false;
  }
  // W6 step11 (row999 item3): hand-declared 対称 gate (B06103「この能力はこのカードが手札にある
  // 場合に宣言できる」)。hand uid からは scope:'on-hand' のみ / on-hand は hand 以外から使用不可
  // (現場に出た後は同 abilId を宣言できない対称制約)。scope 未設定 (既定 on-scene 扱い) の既存
  // カードが hand uid から誤って呼ばれないことも本 gate が保証する (fail-closed)。
  if (ability && found.area === 'hand' && ability.scope !== 'on-hand') return false;
  if (ability && ability.scope === 'on-hand' && found.area !== 'hand') return false;
  if (ability?.limit?.kind === 'turn') {
    const used = readChar.declaredUseCount(state, uid, abilId);
    if (used >= ability.limit.n) return false;
  }
  // BUG-099: ability.condition gate (rules/17 §条件アイコン: 条件未達なら能力を持たない扱い=使用不可)。
  // triggered は triggered.ts:172 で評価済だが declared は未配線だった (canDeclaredAbility が
  // 存在+limit のみ判定)。UI/AI 列挙は canDeclaredAbility で gate するため修正で自動波及する。
  if (ability?.condition) {
    const ctx = {
      source: { player: found.player, uid, abilityId: abilId, area: found.area },
      bindings: {},
    } as EffectCtx;
    if (!evalCond(state, ability.condition, ctx)) return false;
  }
  return true;
}

/**
 * useDeclaredAbility — 宣言能力使用を宣言する。
 *
 * - declaredUseCount[abilId] をインクリメント
 * - effect:declared を emit
 * - ログ追加
 *
 * cost 支払いは呼出元の responsibility (Phase 4 は分離).
 */
export function useDeclaredAbility(
  state: GameState,
  uid: string,
  abilId: string,
  // BUG-085: 呼出元 (UI dispatch / AI policy) が cost.pay 済みの ctx を渡す。
  // ctx.costPaid / ctx.dyn を effect 解決の resolveCtx に引き継ぐことで、
  // `$cost.flipFaceUpEvidence.count` 等の cost 依存 dyn を human-pick 境界の前に
  // 数値化できる (caseDeclaredEvidenceFlip の AP±1000×枚数)。
  ctx?: {
    costPaid?: Record<string, unknown>;
    dyn?: Record<string, unknown>;
    source?: { cardId?: string; uid?: string; abilityId?: string; player?: 'self' | 'opp'; area?: string };
  },
): void {
  let found = findCardOnBoard(state, uid);
  const src = ctx?.source;
  if (!found && src?.cardId && src.player) {
    // BUG-108 driver: selfToDeckBottom 等「自身を場から除く」コスト (D11012 a1) は
    // useDeclaredAbility 呼出前に source を場外へ移すため findCardOnBoard が null になる。
    // cost.pay 済 ctx.source (cardId/player/area) から ability を解決して救済する
    // (rules/21 の cost-first → effect-after 順序は維持。effect は $self を参照しない前提)。
    found = {
      player: src.player,
      cardId: src.cardId,
      area: (src.area as 'scene' | 'case' | 'partner-area' | 'hand') ?? 'scene',
    };
  }
  if (!found) {
    throw new Error(`useDeclaredAbility: card uid=${uid} not on board (scene/case/partner-area/hand)`);
  }
  // Public entrypoint is callable without canDeclaredAbility. A suppressed printed
  // declared ability must stop before count/log/hooks, while externally granted or
  // face-up set-card abilities with the same id remain effective. Preserve the legacy
  // unknown-id behavior for non-scene callers.
  if (found.area === 'scene' && readChar.originalAbilitiesDisabled(state, uid)) {
    const printed = readDef.card(found.cardId)?.abilities?.find((entry) => entry.id === abilId);
    if (printed?.type === 'declared'
      && !findDeclaredAbility(state, uid, found.cardId, found.area, abilId)) return;
  }
  // BUG-112: found.player を渡すことで、selfToDeckBottom 等で source が場外へ出ている場合も
  // player 単位 turnState fallback に【ターン①】カウントが記録される (off-board silent no-op 解消)。
  mutate.flag.incrDeclaredUseCount(state, uid, abilId, found.player);
  mutate.log.append(state, {
    ts: Date.now(),
    player: found.player,
    turn: state.turn.number,
    action: 'declaredAbility',
    target: `${uid}:${abilId}`,
  });
  event.emit(
    state,
    'effect:declared',
    { kind: 'declaredAbility', uid, abilId },
    { player: found.player, uid, cardId: found.cardId },
  );

  // 2026-05-26 fix: type:'declared' ability の effect を直接 queue する。
  // triggered.ts listener は `type === 'triggered'` のみ処理するため、宣言能力の
  // effect は engine 側のどこにも実行 path がなかった (D11014 a2 / D11003 a2 /
  // D11012 a1 / D08005 a2 等が silent no-op していた長年バグの根本対応)。
  // W6 step11 (row999 item4): rider declared (on-set-host) もここで初めて実行キューに積める
  const ability = findDeclaredAbility(state, uid, found.cardId, found.area, abilId);
  if (!ability) return;
  if (ability.type !== 'declared' || !ability.effect) return;

  // BUG-116 (2026-06-05): cost が定義されているのに ctx.costPaid 不在 → cost 未払い疑い。
  // useEngineDispatch.declaredAbility は action.cost && action.ctx が両方渡されたときのみ
  // engine.cost.pay を呼ぶため、e2e や直接 dispatch で渡し忘れると cost が silent skip
  // される (effect だけ走る) latent バグへの早期検出。
  // 既存挙動は変えず、warning log のみ append (rules 上はカードルール違反だが engine 層では
  // throw せず caller (UI/AI) の責務として扱う、教訓 1 と同じ pattern)。
  if (ability.cost && !ctx?.costPaid) {
    mutate.log.append(state, {
      ts: Date.now(),
      player: found.player,
      turn: state.turn.number,
      action: 'declaredAbility:cost-not-paid',
      target: `${uid}:${abilId}`,
      result: 'WARN: ability.cost 定義あり / ctx.costPaid 不在 — cost 未払いで effect 解決へ',
    });
  }

  const resolveCtx: EffectCtx = {
    source: {
      cardId: found.cardId,
      uid,
      abilityId: abilId,
      player: found.player,
      area: found.area as EffectCtx['source']['area'],
    },
    bindings: {},
    // BUG-085: cost 支払いで積まれた costPaid / dyn を effect 解決へ引き継ぐ
    // (resolveEffectPicks の dyn-arg 解決が `$cost.*` を参照するため)。
    ...(ctx?.costPaid ? { costPaid: ctx.costPaid } : {}),
    ...(ctx?.dyn ? { dyn: ctx.dyn } : {}),
  };
  const humanSide = getHumanPlayerSide();
  const isHumanEffect = humanSide !== null && found.player === humanSide;
  const aiPolicy = new HeuristicPolicy();
  const resolvedEffect = resolveEffectPicks(state, ability.effect, resolveCtx, {
    chooseAtomTarget: isHumanEffect ? undefined : aiPolicy.chooseAtomTarget?.bind(aiPolicy),
    byPlayer: found.player,
    humanChooser: isHumanEffect,
    source: { cardId: found.cardId, abilityId: abilId },
  });
  event.queue(
    state,
    resolvedEffect,
    { player: found.player, uid, cardId: found.cardId, abilityId: abilId, area: found.area },
    'declaredAbility',
    { kind: 'declaredAbility', uid, abilId },
    undefined,
    // engine additive wave (2026-06-29d): cost で積んだ costPaid を entry へ永続化 (entryToCtx が復元)。
    // costRemovedMatches cond (conditional STABLE `if` の runtime 再評価) が除去カード snapshot を読むため。
    // BUG-171 (2026-07-04): dyn も同型永続化。declaredName (AbilityCostParams → ctx.dyn) を runtime の
    // atomDeclareName / resolveBindRef('$dyn.*') まで運ぶ (B09108/B09003/PR105 first-consumer probe が検出)。
    // ⚠ pre-walk (resolveEffectPicks) が 0-candidate 短縮形 pick で書く chainStepNoApply は
    // 「queue 境界で捨てられる dead write」前提だった — persist 対象から除外して焼込を防ぐ
    // (現 reader は runtime step 冒頭 reset で inert だが、将来 reader への落とし穴予防。review NIT)。
    resolveCtx.costPaid || resolveCtx.dyn
      ? {
          ...(resolveCtx.costPaid ? { costPaid: resolveCtx.costPaid } : {}),
          ...(resolveCtx.dyn
            ? { dyn: (({ chainStepNoApply: _drop, ...rest }) => rest)(resolveCtx.dyn) }
            : {}),
        }
      : undefined,
  );
  // engine mega-wave W2 (2026-07-03, hook): ability:declared — 宣言能力使用の第三者観測 hook
  // (B03057「自分の現場にいる〚特徴[探偵]〛のキャラが【宣言】能力を使用したとき」)。
  // ★emit は宣言者自身の effect queue の **後** (W2 混成 review sonnet-lens blocker 対応):
  // handleHook が queue する observer effect は pendingEffects の挿入順 tiebreak で宣言効果の後に解決
  // される = B03057 公式Q&A「【宣言】能力の効果を先に解決します」(rules/25 / B08020 と同旨) を担保。
  // (effect:declared の declaredBatch gate と同じ意味論を挿入順で実現。degenerate な effect 無し宣言は
  // 上の early-return で emit されないが、該当カードは現プール 0。)
  // payload.uid/player は triggerCharMatches の既定経路に一致。既存カードは本 hook 未宣言 = 挙動不変。
  event.emit(
    state,
    'ability:declared',
    { uid, cardId: found.cardId, abilityId: abilId, player: found.player },
    { player: found.player, uid, cardId: found.cardId },
  );
}
