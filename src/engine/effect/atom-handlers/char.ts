// engine.effect.atom-handlers/char — Phase 3a 分割 (case body 無改変移送, 2026-06-22)
import { mutate } from '../../mutate/index.js';
import { scene as readScene } from '../../read/scene.js';
import { tryRePickFromAtom } from '../resolve-picks.js';
import { isShortFormDelta } from '../atom-pick-spec.js';
import { removeExcludedSourceCardId } from '../../read/effect-source.js';
import { resolvePlayer, resolveBindRef, resolveDeltaToNumber, hasNorMax, paShortFormAwait } from './_shared.js';
import type { Player } from './_shared.js';
import type { GameState, AtomVerb, EffectCtx, CausalOutcome, PublicCausalZone } from '../../types/index.js';
import { recordEffectCausalOperation } from '../../log/effect-causal.js';
import { advanceIndexedZoneEpoch } from '../../state/indexed-zone-epoch.js';
import { advanceDeckEpochAndRebaseBindings } from '../deck-occurrence-authority.js';
import { _peekPendingSetCardReplacementSide } from '../pending-state.js';

function sceneOwnerOf(s: GameState, uid: string): Player | undefined {
  if (s.players.self.scene.some((card) => card.uid === uid)) return 'self';
  if (s.players.opp.scene.some((card) => card.uid === uid)) return 'opp';
  return undefined;
}

function recordSceneValueChange(
  s: GameState,
  ctx: EffectCtx,
  uid: string,
  outcome: CausalOutcome,
): void {
  const owner = sceneOwnerOf(s, uid);
  if (owner === undefined) return;
  recordEffectCausalOperation(s, ctx, {
    actor: ctx.source.player,
    kind: 'value-change',
    source: { kind: 'player', side: ctx.source.player },
    targets: [{ kind: 'scene-card', side: owner, uid }],
    outcome,
  });
}

function recordStackMove(
  s: GameState,
  ctx: EffectCtx,
  sourceSide: Player,
  sourceZone: PublicCausalZone,
  hostUid: string,
  count: number,
): void {
  const hostOwner = sceneOwnerOf(s, hostUid);
  if (hostOwner === undefined || count < 1) return;
  recordEffectCausalOperation(s, ctx, {
    actor: ctx.source.player,
    kind: 'zone-move',
    source: { kind: 'zone', side: sourceSide, zone: sourceZone },
    targets: [{ kind: 'scene-card', side: hostOwner, uid: hostUid }],
    outcome: { type: 'move', from: sourceZone, to: 'scene', count },
  });
}

export function atomCharModifyAP(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
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
      const maOwner = sceneOwnerOf(s, maUid);
      mutate.char.modifyAP(s, maUid, maDelta, maScope);
      if (maOwner !== undefined && maDelta !== 0) {
        recordEffectCausalOperation(s, ctx, {
          actor: ctx.source.player,
          kind: 'value-change',
          source: { kind: 'player', side: ctx.source.player },
          targets: [{ kind: 'scene-card', side: maOwner, uid: maUid }],
          outcome: { type: 'count', amount: maDelta, unit: 'ap' },
        });
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyAP', target: maUid, result: `${maDelta >= 0 ? '+' : ''}${maDelta}/${maScope}` });
      return;
    }

export function atomCharModifyLP(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
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
      const mlOwner = sceneOwnerOf(s, mlUid);
      mutate.char.modifyLP(s, mlUid, mlDelta, mlScope);
      if (mlOwner !== undefined && mlDelta !== 0) {
        recordEffectCausalOperation(s, ctx, {
          actor: ctx.source.player,
          kind: 'value-change',
          source: { kind: 'player', side: ctx.source.player },
          targets: [{ kind: 'scene-card', side: mlOwner, uid: mlUid }],
          outcome: { type: 'count', amount: mlDelta, unit: 'lp' },
        });
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLP', target: mlUid, result: `${mlDelta >= 0 ? '+' : ''}${mlDelta}/${mlScope}` });
      return;
    }

export function atomCharModifyLevel(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
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
      const mlvOwner = sceneOwnerOf(s, mlvUid);
      mutate.char.modifyLevel(s, mlvUid, mlvDelta, mlvScope);
      if (mlvOwner !== undefined && mlvDelta !== 0) {
        recordEffectCausalOperation(s, ctx, {
          actor: ctx.source.player,
          kind: 'value-change',
          source: { kind: 'player', side: ctx.source.player },
          targets: [{ kind: 'scene-card', side: mlvOwner, uid: mlvUid }],
          outcome: { type: 'count', amount: mlvDelta, unit: 'level' },
        });
      }
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charModifyLevel', target: mlvUid, result: `${mlvDelta >= 0 ? '+' : ''}${mlvDelta}/${mlvScope}` });
      return;
    }

export function atomCharOverrideAP(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-068: bind ref 解決を配線
      const oaUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof oaUid !== 'string' || oaUid.startsWith('$')) return;
      const oaVal = a.val as number | null;
      const oaChar = readScene.byUid(s, oaUid);
      const oaBefore = a.scope === 'turn' ? oaChar?.turnEffects['apOverride_turn'] : oaChar?.apOverride;
      // engine defer-unlock mini-wave (2026-07-09): scope:'turn' = 「ターン終了時まで元のAPを X にする」
      // (B05022)。turnEffects['apOverride_turn'] ベース (rules/19 QA: 修整±は残る = read.char.ap の
      // base のみ差替)。clearTurnEffects('turn') で失効。scope 未指定は従来の恒久 apOverride (byte 不変)。
      if (a.scope === 'turn') {
        mutate.char.setOverrideAPTurn(s, oaUid, oaVal);
      } else {
        mutate.char.setOverrideAP(s, oaUid, oaVal);
      }
      const oaAfterChar = readScene.byUid(s, oaUid);
      const oaAfter = a.scope === 'turn' ? oaAfterChar?.turnEffects['apOverride_turn'] : oaAfterChar?.apOverride;
      if (oaBefore !== oaAfter) {
        recordSceneValueChange(s, ctx, oaUid, oaVal === null
          ? { type: 'state', state: 'success' }
          : { type: 'count', amount: oaVal, unit: 'ap' });
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charOverrideAP', target: oaUid, result: oaVal === null ? 'reset' : String(oaVal) });
      return;
    }

export function atomCharOverrideLP(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-068: bind ref 解決を配線
      const olUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof olUid !== 'string' || olUid.startsWith('$')) return;
      const olVal = a.val as number | null;
      const olChar = readScene.byUid(s, olUid);
      const olBefore = a.scope === 'turn' ? olChar?.turnEffects['lpOverride_turn'] : olChar?.lpOverride;
      // engine mini-wave (2026-07-10): scope:'turn' = 「ターン終了時まで元のLPを X にする」
      // (B01045/B01054/B09011)。charOverrideAP scope:'turn' と完全対称。scope 未指定は従来恒久 (byte 不変)。
      if (a.scope === 'turn') {
        mutate.char.setOverrideLPTurn(s, olUid, olVal);
      } else {
        mutate.char.setOverrideLP(s, olUid, olVal);
      }
      const olAfterChar = readScene.byUid(s, olUid);
      const olAfter = a.scope === 'turn' ? olAfterChar?.turnEffects['lpOverride_turn'] : olAfterChar?.lpOverride;
      if (olBefore !== olAfter) {
        recordSceneValueChange(s, ctx, olUid, olVal === null
          ? { type: 'state', state: 'success' }
          : { type: 'count', amount: olVal, unit: 'lp' });
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charOverrideLP', target: olUid, result: olVal === null ? 'reset' : String(olVal) });
      return;
    }

export function atomCharGrantKeyword(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // Task D E0 addendum (2026-06-12): PA 短縮形対応 (B09032 解禁条件)。
      // 明示 uid:'$pick'+target 形は初期 walk push となり human 経路で後続 step の bind が
      // 喪失するため、pick carrier に使う場合は短縮形 (runtime push) が必須。
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, a.player as Player); // BUG-174: side は相対値のまま渡す (sidesForQuery が owner 相対解釈 — 絶対値だと owner='opp' で反転)
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
      const grantChar = readScene.byUid(s, grantUid);
      const keywordAlreadyGranted = grantScope === 'permanent'
        ? grantChar?.keywordOverrides.granted.includes(grantKw) === true
        : ((grantChar?.turnEffects.grantedKeywords as string[] | undefined) ?? []).includes(grantKw);
      mutate.char.grantKeyword(s, grantUid, grantKw, grantScope);
      if (grantChar !== null && !keywordAlreadyGranted) {
        recordSceneValueChange(s, ctx, grantUid, { type: 'state', state: 'success' });
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charGrantKeyword', target: grantUid, result: `${grantKw}/${grantScope}` });
      return;
    }

export function atomCharRevokeKeyword(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const revokeUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof revokeUid !== 'string' || revokeUid.startsWith('$')) return;
      const revokeKw = a.kw as string;
      // engine additive (2026-06-29): scope:'turn' = 印字キーワードを「ターン終了時まで失う」(B06068 京極真)。
      // 既定 'permanent' は従来どおり granted-splice (外部付与キーワードの恒久除去)。現出荷カードに
      // charRevokeKeyword 使用は0件ゆえ既定挙動は不変 (回帰0)。turn は revokedKeywords へ積み read.char.keywords が減算。
      const revokeScope = (a.scope as 'turn' | 'permanent' | undefined) ?? 'permanent';
      const revokeChar = readScene.byUid(s, revokeUid);
      const keywordWillChange = revokeScope === 'turn'
        ? !((revokeChar?.turnEffects.revokedKeywords as string[] | undefined) ?? []).includes(revokeKw)
        : revokeChar?.keywordOverrides.granted.includes(revokeKw) === true;
      if (revokeScope === 'turn') {
        mutate.char.revokeKeywordTurn(s, revokeUid, revokeKw);
      } else {
        mutate.char.revokeKeyword(s, revokeUid, revokeKw);
      }
      if (revokeChar !== null && keywordWillChange) {
        recordSceneValueChange(s, ctx, revokeUid, { type: 'state', state: 'success' });
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charRevokeKeyword', target: revokeUid, result: `${revokeKw}/${revokeScope}` });
      return;
    }

export function atomCharGrantTrait(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // engine A1 wave (2026-07-11, B05101 毛利小五郎): 特徴付与。charGrantKeyword の trait 版。
      // 本 consumer は uid:'$self' (triggered actor 自身) のみ — pick 短縮形は不要 (必要になったら
      // charGrantKeyword 同型で後付け可)。scope 既定 'permanent' = ターン終了で切れない (B05101)。
      const gtUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof gtUid !== 'string' || gtUid.startsWith('$')) return;
      const gtTrait = a.trait as string;
      const gtScope = (a.scope as 'turn' | 'permanent' | undefined) ?? 'permanent';
      const gtChar = readScene.byUid(s, gtUid);
      const gtKey = gtScope === 'turn' ? 'grantedTraits_turn' : 'grantedTraits_permanent';
      const traitAlreadyGranted = ((gtChar?.turnEffects[gtKey] as string[] | undefined) ?? []).includes(gtTrait);
      mutate.char.grantTrait(s, gtUid, gtTrait, gtScope);
      if (gtChar !== null && !traitAlreadyGranted) {
        recordSceneValueChange(s, ctx, gtUid, { type: 'state', state: 'success' });
      }
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charGrantTrait', target: gtUid, result: `${gtTrait}/${gtScope}` });
      return;
    }

export function atomCharRevokeTrait(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // engine A1 wave (2026-07-11, B05101): 特徴剥奪 (grantTrait の鏡像)。印字/継続双方から read.char.traits が減算。
      const rtUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof rtUid !== 'string' || rtUid.startsWith('$')) return;
      const rtTrait = a.trait as string;
      const rtScope = (a.scope as 'turn' | 'permanent' | undefined) ?? 'permanent';
      const rtChar = readScene.byUid(s, rtUid);
      const rtKey = rtScope === 'turn' ? 'revokedTraits_turn' : 'revokedTraits_permanent';
      const traitAlreadyRevoked = ((rtChar?.turnEffects[rtKey] as string[] | undefined) ?? []).includes(rtTrait);
      mutate.char.revokeTrait(s, rtUid, rtTrait, rtScope);
      if (rtChar !== null && !traitAlreadyRevoked) {
        recordSceneValueChange(s, ctx, rtUid, { type: 'state', state: 'success' });
      }
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charRevokeTrait', target: rtUid, result: `${rtTrait}/${rtScope}` });
      return;
    }

export function atomCharDisableOriginal(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      // BUG-068: bind ref 解決を配線
      const doUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof doUid !== 'string' || doUid.startsWith('$')) return;
      const scope = (a.scope as 'turn' | 'permanent' | undefined) ?? 'permanent';
      const doChar = readScene.byUid(s, doUid);
      const alreadyDisabled = scope === 'turn'
        ? doChar?.turnEffects.originalAbilitiesDisabled_turn === true
        : doChar?.keywordOverrides.disabledOriginal === true;
      mutate.char.disableOriginalAbilities(s, doUid, scope);
      if (doChar !== null && !alreadyDisabled) {
        recordSceneValueChange(s, ctx, doUid, { type: 'state', state: 'success' });
      }
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charDisableOriginal', target: doUid, result: scope });
      return;
    }

export function atomCharGrantAbility(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // Task D E4 (2026-06-12): triggered ability の動的付与。args:
      //   { uid|'$pick'+target, ability: { id?, trigger, condition?, limit?, effect }, scope:'turn' }
      // descriptor は turnEffects.grantedAbilities[] に積まれ、triggered.ts handleHook が
      // def.abilities と合算走査。清掃は clearTurnEffects('turn')。validate.ts が JSON 性と
      // trigger.hook の許可リストを enforce (rules/15, 19)。
      if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, a.player as Player); // BUG-174: side は相対値のまま渡す (sidesForQuery が owner 相対解釈 — 絶対値だと owner='opp' で反転)
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
      // gap① (2026-07-11, B06042「【宣言】能力を与える」): spec.type / spec.scope を honor して
      // declared ability の付与を解禁する。既存カード (B07063/B02014/B08014 等) は descriptor に
      // type/scope を持たない → 'triggered' / 'on-scene' (旧固定値と byte 不変・回帰0)。
      const grantedType = spec.type === 'declared' || spec.type === 'continuous'
        ? spec.type
        : 'triggered';
      const grantedScope = typeof spec.scope === 'string' ? spec.scope : 'on-scene';
      // granted id namespace (limit:{turn} の declaredUseCount キーとして機能する)
      const baseGrantedId = typeof spec.id === 'string'
        ? spec.id
        : `granted:${ctx.source.cardId ?? '?'}:${ctx.source.abilityId ?? '?'}`;
      // gap③ / BUG-320: declared/triggered grant は、同一 host へ base id 衝突で複数付与された場合に
      // #N suffix を付ける。宣言と発動の【ターン1】はどちらも host uid + ability id で記録されるため、
      // 付与ごとの runtime identity が必要。continuous grant は回数identityを消費しないため従来idを維持。
      let grantedId = baseGrantedId;
      if (grantedType === 'declared' || grantedType === 'triggered') {
        let existingGranted: unknown;
        for (const pl of ['self', 'opp'] as const) {
          const host = s.players[pl].scene.find((c) => c.uid === cgaUid);
          if (host) { existingGranted = host.turnEffects['grantedAbilities']; break; }
        }
        if (Array.isArray(existingGranted)) {
          const dup = (existingGranted as Array<{ id?: unknown }>).filter(
            (g) => typeof g.id === 'string' && (g.id === baseGrantedId || g.id.startsWith(`${baseGrantedId}#`)),
          ).length;
          if (dup > 0) grantedId = `${baseGrantedId}#${dup}`;
        }
      }
      const grantedDef = {
        ...spec,
        id: grantedId,
        type: grantedType,
        scope: grantedScope,
        description: typeof spec.description === 'string' ? spec.description : '(granted)',
      };
      mutate.char.grantAbility(s, cgaUid, grantedDef);
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charGrantAbility', target: cgaUid, result: grantedId });
      return;
    }

export function atomCharSetTurnEffect(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
      const teUid = resolveBindRef(a.uid, ctx) as string;
      if (typeof teUid !== 'string' || teUid.startsWith('$')) return;
      const teKey = a.key as string;
      // mega-wave W6 step2 (2026-07-04, rows 74/999 HARD merge): val を resolveBindRef へ通す
      // ($dyn.declaredName = PR105 nameOverride / $<bind>.uid 系)。リテラル (boolean/number/非$文字列)
      // は resolveBindRef が素通しするため既存カード回帰 0。
      const teVal = resolveBindRef(a.val, ctx);
      // BUG-171 (2026-07-04): 未解決 $ 参照 (供給 decline 時の '$dyn.declaredName' 等) は passthrough で
      // 返るため、そのまま書くと turnEffects が bind-ref 文字列で汚染される (PR105 skip 時に names() が
      // '$dyn.declaredName' を返した first-consumer probe 検出)。uid の startsWith('$') guard と同 posture で no-op。
      // 空文字も抑止 (review NIT: costParamsToDyn は '' でも積む → guard 素通りで無用な
      // turnEffects key が残る。read 側は falsy-guard 済で benign だが write 側で閉じる)。
      if (typeof teVal === 'string'
        && (teVal === '' || teVal.startsWith('$') || (teKey === 'nameOverride' && teVal.trim() === ''))) {
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetTurnEffect', target: teUid, result: `${teKey}=unresolved:skip` });
        return;
      }
      mutate.char.setTurnEffect(s, teUid, teKey, teVal);
      // BUG-073: effect log
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetTurnEffect', target: teUid, result: `${teKey}=${String(teVal)}` });
      return;
    }

export function atomCharSetCard(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // engine-extension #5b PA短縮形 (2026-06-05 残課題解消):
      // uid 未指定 + fromDeckTop + n/max で「キャラを N 枚まで選び、デッキ上端を裏向きでセット」
      // を declarative に表現できる (B02020/B02023/B02030 系)。sceneRemove/sceneToHand と同型。
      // engine additive wave (2026-06-29d): fromSelf も短縮形 pick (host 選択) を起動する。
      // host 候補 side は resolvePlayer(a.player='self')、filter (色/レベル) は a.filter (B01023 無条件 /
      // B01057【白】 / B02013 レベル7以下【青】)。再 dispatch 時 uid 解決済 → 下の fromSelf branch がセット。
      if (a.uid === undefined && (a.fromDeckTop || a.fromSelf) && typeof a.player === 'string' && hasNorMax(a)) {
        // scsP = deck-source / 既定 side (a.player 側、'opp' なら相手の現場/デッキを対象)。
        // BUG-120: 選択者 (chooser/byPlayer) は a.player ではなく **controller** (ctx.source.player)。
        //   旧コードは byPlayer=scsP を渡し、player:'opp' (B02020/B03032) で『controller が相手キャラを
        //   選ぶ』が「相手が選ぶ」に化けていた (charModifyAP/LP/Level は byPlayer=ctx.source.player で正)。
        //   deck-source は後段 resolve (L798 resolvePlayer(a.player)) が a.player を別途参照するため不変。
        paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, a.player as Player); // BUG-174: side は相対値のまま渡す (sidesForQuery が owner 相対解釈 — 絶対値だと owner='opp' で反転)
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
      // engine mega-wave W1 (2026-07-03, P28/r4): remove-area source-pick 分岐 — 「自分のリムーブエリアに
      // ある〚カード名[X]〛を1枚まで選び、裏向きでこのキャラにセットする」(B08036)。charStackCard の
      // `cardIds:'$pick.cardIds'` + source-splice 契約 (下 atomCharStackCard) を同型移植し、
      // stackCard(count) の代わりに setCard(host, cid, faceUp=false) を呼ぶ。0枚 pick は
      // chainStepNoApply を立て「セットした場合」後続を gate (rules/15 / handReveal gate-on-0 と同型)。
      if (a.cardIds !== undefined) {
        const rawSetIds = a.cardIds;
        if (rawSetIds === '$pick.cardIds') {
          if (a.target && typeof a.target === 'object') {
            const ctxP = ctx.source.player ?? 'self';
            const argsWithResolvedUid = { ...a, uid: scUid };
            tryRePickFromAtom(s, { kind: 'atom', verb, args: argsWithResolvedUid }, ctx, {
              byPlayer: ctxP,
              source: { cardId: ctx.source.cardId ?? '', abilityId: ctx.source.abilityId ?? '' },
            });
            mutate.log.append(s, { ts: Date.now(), player: ctxP, turn: s.turn.number, action: 'effect:charSetCard:awaiting-pick' });
          }
          return;
        }
        if (Array.isArray(rawSetIds)) {
          const setIds = rawSetIds as string[];
          if (setIds.length === 0) {
            (ctx.dyn ??= {}).chainStepNoApply = true; // 「セットした場合」不成立 → chain break
            mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', target: scUid, result: '0' });
            return;
          }
          // host 不在なら source を消費しない (BUG-153 と同流儀)
          if (!readScene.byUid(s, scUid)) {
            (ctx.dyn ??= {}).chainStepNoApply = true;
            mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', target: scUid, result: 'host-absent' });
            return;
          }
          // M2後半 (2026-07-10, PR234 a1): area 配列 (zone union pick) 対応 — splice は各 area を
          // 順に探して最初に見つかった zone から消費する (pick 済 cardId は一意 zone 由来)。
          const setSrcAreaRaw = ((a.target && typeof a.target === 'object')
            ? ((a.target as { query?: { area?: string | string[] } }).query?.area)
            : undefined);
          const setSrcAreas = (Array.isArray(setSrcAreaRaw) ? setSrcAreaRaw : [setSrcAreaRaw])
            .filter((x): x is 'remove' | 'hand' | 'deck' => x === 'remove' || x === 'hand' || x === 'deck');
          const setSrcSide = ((a.target && typeof a.target === 'object')
            ? ((a.target as { query?: { side?: string } }).query?.side)
            : undefined) as 'self' | 'opp' | undefined;
          const setOwnerP = ctx.source.player ?? 'self';
          // ⚠ latent (W1 review NIT): side:'opp' は絶対 opp (charStackCard L330 と同流儀の踏襲)。
          // controller が opp の場合に相対化されない — 現 consumer (B08036) は side:'self' のみで非到達。
          // opp-side source の consumer 追加時は resolvePlayer 相対化を検討 (DEFERRED-INDEX megaw1)。
          const fromPlayer = setSrcSide === 'opp' ? 'opp' : setOwnerP;
          // A resumed pick may be stale. Plan every exact occurrence before mutating any
          // source zone so a missing duplicate or moved card cannot be recreated under
          // the host, and a partially valid selection remains atomic.
          const selectedSources: Array<{ cardId: string; area: 'remove' | 'hand' | 'deck' }> = [];
          if (setSrcAreas.length > 0) {
            const remainingByArea = new Map<'remove' | 'hand' | 'deck', Map<string, number>>();
            for (const area of setSrcAreas) {
              const counts = new Map<string, number>();
              const cards = (s.players[fromPlayer] as unknown as Record<string, string[]>)[area] ?? [];
              for (const cardId of cards) counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
              remainingByArea.set(area, counts);
            }
            for (const cardId of setIds) {
              const area = setSrcAreas.find((candidate) => {
                const remaining = remainingByArea.get(candidate)?.get(cardId) ?? 0;
                if (remaining < 1) return false;
                remainingByArea.get(candidate)!.set(cardId, remaining - 1);
                return true;
              });
              if (area === undefined) {
                (ctx.dyn ??= {}).chainStepNoApply = true;
                return;
              }
              selectedSources.push({ cardId, area });
            }
          }
          const movedFrom = new Map<'remove' | 'hand' | 'deck', number>();
          for (const { cardId, area } of selectedSources) {
            const arr = (s.players[fromPlayer] as unknown as Record<string, string[]>)[area];
            const idx = arr.indexOf(cardId);
            arr.splice(idx, 1);
            if (area === 'remove') advanceIndexedZoneEpoch(s, fromPlayer, 'remove');
            movedFrom.set(area, (movedFrom.get(area) ?? 0) + 1);
            if (area === 'remove') mutate.remove.emitExit(s, fromPlayer, cardId); // remove→set-card 離脱 (wave-4 流儀)
          }
          for (const cid of setIds) {
            // M2後半 (2026-07-10, PR234 a1): faceUp:true 明示時のみ表向きセット (「表向きでセットする」)。
            // 既定は従来どおり裏向き (rules/16) — B08036 等の既存 consumer は引数無しで裏向き前提 = byte 互換。
            mutate.char.setCard(s, scUid, cid, a.faceUp === true);
          }
          const setCardOwner = sceneOwnerOf(s, scUid);
          if (setCardOwner !== undefined) {
            for (const [from, count] of movedFrom) {
              recordEffectCausalOperation(s, ctx, {
                actor: ctx.source.player,
                kind: 'zone-move',
                source: { kind: 'zone', side: fromPlayer, zone: from },
                targets: [{ kind: 'zone', side: setCardOwner, zone: 'set-card' }],
                outcome: { type: 'move', from, to: 'set-card', count },
              });
            }
          }
          mutate.log.append(s, {
            ts: Date.now(),
            player: setOwnerP,
            turn: s.turn.number,
            action: 'effect:charSetCard',
            target: scUid,
            result: a.faceUp === true ? setIds.join(',') : `set=${setIds.length}:face-down`,
          });
          return;
        }
        return;
      }
      // engine additive wave (2026-06-29d): fromSelf — 使用イベント自身 (ctx.source.cardId) を所有者の
      // remove から引き、host へ **faceUp** でセットする WRITE 経路 (B01023/B01057/B02013、session70
      // on-set-host READ の end-to-end 化)。hand-use はイベントを remove へ着地させてから効果解決するため
      // remove に在る (lastIndexOf で末尾=直近着地分を1枚)。faceUp 固定 (on-set-host rider は faceUp のみ
      // READ、rules/16)。host 不在 (現場0) は「セットできるキャラがいなければ解決後リムーブ」(公式Q&A
      // B01023) ＝ remove から引かず no-op。readScene.byUid は setCard の findChar と同一 scan (fromDeckTop
      // BUG-153 と同流儀)。faceDown 引数 (a.faceUp) は読まない — self-event set は常に faceUp。
      if (a.fromSelf === true) {
        if (!readScene.byUid(s, scUid)) {
          mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', target: scUid, result: 'host-absent' });
          return;
        }
        const selfCid = ctx.source.cardId;
        if (typeof selfCid !== 'string' || selfCid === '') return;
        const ownerP = resolvePlayer((a.player as string | undefined) ?? 'self', ctx);
        const removeArr = s.players[ownerP].remove;
        const ridx = removeArr.lastIndexOf(selfCid);
        if (ridx < 0) {
          (ctx.dyn ??= {}).chainStepNoApply = true;
          return;
        }
        removeArr.splice(ridx, 1);
        advanceIndexedZoneEpoch(s, ownerP, 'remove');
        mutate.remove.emitExit(s, ownerP, selfCid); // wave-4: remove→set-card 離脱 (原因非依存 remove:exit)
        mutate.char.setCard(s, scUid, selfCid, true);
        const setCardOwner = sceneOwnerOf(s, scUid);
        if (setCardOwner !== undefined) {
          recordEffectCausalOperation(s, ctx, {
            actor: ctx.source.player,
            kind: 'zone-move',
            source: { kind: 'zone', side: ownerP, zone: 'remove' },
            targets: [{ kind: 'zone', side: setCardOwner, zone: 'set-card' }],
            outcome: { type: 'move', from: 'remove', to: 'set-card', count: 1 },
          });
        }
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', target: scUid, result: selfCid });
        return;
      }
      // engine-extension #5b (2026-06-05): fromDeckTop オプション。
      // 「自分のデッキのカードを上から1枚裏向きでセットする」(B02018/B02020/B02023/B02030/B08054)
      // 系で使用。a.player (既定 'self') の deck.shift で 1 枚 splice → そのまま setCard。
      // (cardId 引数は無視、自動補完される)
      let scCardId: string;
      let refreshAfterSet: (() => void) | undefined;
      let deckSetSides: { deck: Player; setCard: Player } | undefined;
      if (a.fromDeckTop) {
        // BUG-153: host (scUid) が現場不在なら deck を消費しない。
        // setCard は host 不在で no-op (mutate/char.ts findChar) なので、shift を先に走らせると
        // 上端カードが deck からも setCards からも消える (カード消失)。
        // 公式Q&A (B05035): 離場時は公開した/上端のカードを「そのままデッキの上に戻す」=ここで shift せず return。
        // readScene.byUid は setCard の findChar と同一の scene scan ゆえ host 存在時は従来と完全に同挙動 (回帰0)。
        if (!readScene.byUid(s, scUid)) {
          mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', target: scUid, result: 'host-absent' });
          return;
        }
        // engine mega-wave W1 (2026-07-03, P27/r2): deckOwner:'picked-host' — セット元デッキを
        // pick した host キャラの **持ち主側** にする (PR136/PR142 伊織無我「持ち主のデッキのカードを
        // 上から1枚裏向きでセット」)。host 存在は直前 guard で保証済 → scene scan は決定的にヒット。
        // 既定枝 (deckOwner 無指定) は従来 resolvePlayer のまま byte 等価 (既存カード回帰 0)。
        const sscP = a.deckOwner === 'picked-host'
          ? (s.players.self.scene.some(c => c.uid === scUid) ? 'self' as const : 'opp' as const)
          : resolvePlayer(a.player ?? 'self', ctx);
        const setCardOwner = sceneOwnerOf(s, scUid);
        // session64 (rules/14, 26 + BUG-142 同族): デッキ0 で「上からセット」する場合、silent no-op ではなく
        // リフレッシュ後に残りを解決する (公式Q&A B08033「残り全部セット→リフレッシュ→残り分セット」)。
        // host 存在は上で確認済 → ここで refresh して安全に shift できる (draw/fileAdd/evidenceGain と同型)。
        // remove も 0 なら refresh 失敗 = deck-out 敗北 (rules/14)。
        const excludedSource = removeExcludedSourceCardId(ctx, sscP);
        const removeBeforeRefresh = s.players[sscP].remove.length;
        if (!mutate.deck.refreshAfterTake(s, sscP, excludedSource)) {
          mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charSetCard', target: scUid, result: 'empty-deck-refresh-fail' });
          return;
        }
        const refreshedBeforeSet = removeBeforeRefresh - s.players[sscP].remove.length;
        if (refreshedBeforeSet > 0) {
          recordEffectCausalOperation(s, ctx, {
            actor: ctx.source.player,
            kind: 'zone-move',
            tags: ['refresh'],
            source: { kind: 'zone', side: sscP, zone: 'remove' },
            targets: [{ kind: 'zone', side: sscP, zone: 'deck' }],
            outcome: { type: 'move', from: 'remove', to: 'deck', count: refreshedBeforeSet },
          });
        }
        scCardId = s.players[sscP].deck.shift()!;
        advanceDeckEpochAndRebaseBindings(s, ctx, sscP, [0]);
        if (setCardOwner !== undefined) deckSetSides = { deck: sscP, setCard: setCardOwner };
        // Keep the transfer atomic to observers: setCard emits setcard:enter,
        // then the completed take may refresh and emit remove:exit.
        refreshAfterSet = () => mutate.deck.refreshAfterTake(s, sscP, excludedSource);
      } else {
        scCardId = resolveBindRef(a.cardId, ctx) as string;
        if (typeof scCardId !== 'string' || scCardId.startsWith('$')) return;
      }
      mutate.char.setCard(s, scUid, scCardId, a.faceUp as boolean);
      if (deckSetSides !== undefined) {
        recordEffectCausalOperation(s, ctx, {
          actor: ctx.source.player,
          kind: 'zone-move',
          source: { kind: 'zone', side: deckSetSides.deck, zone: 'deck' },
          targets: [{ kind: 'zone', side: deckSetSides.setCard, zone: 'set-card' }],
          outcome: { type: 'move', from: 'deck', to: 'set-card', count: 1 },
        });
      }
      const removeBeforeTrailingRefresh = deckSetSides === undefined
        ? undefined
        : s.players[deckSetSides.deck].remove.length;
      refreshAfterSet?.();
      if (deckSetSides !== undefined && removeBeforeTrailingRefresh !== undefined) {
        const refreshedAfterSet = removeBeforeTrailingRefresh - s.players[deckSetSides.deck].remove.length;
        if (refreshedAfterSet > 0) {
          recordEffectCausalOperation(s, ctx, {
            actor: ctx.source.player,
            kind: 'zone-move',
            tags: ['refresh'],
            source: { kind: 'zone', side: deckSetSides.deck, zone: 'remove' },
            targets: [{ kind: 'zone', side: deckSetSides.deck, zone: 'deck' }],
            outcome: { type: 'move', from: 'remove', to: 'deck', count: refreshedAfterSet },
          });
        }
      }
      // BUG-073: effect log
      mutate.log.append(s, {
        ts: Date.now(),
        player: ctx.source.player,
        turn: s.turn.number,
        action: 'effect:charSetCard',
        target: scUid,
        result: a.faceUp === true ? scCardId : 'face-down',
      });
      return;
    }

export function atomCharStackCard(s: GameState, a: Record<string, unknown>, ctx: EffectCtx, verb: AtomVerb): void {
      // D08021 driver 2026-05-26: sceneEnter (line 374) と同型の pick-await + source-area cleanup pattern を流用。
      //   - 旧 contract: { uid, n } → 即 stackedCards += n (本パスを末尾に維持)
      //   - 新 contract: { uid:'$self', cardIds:'$pick.cardIds', target:{kind:'pick',...,n:{min,max}} }
      //     → cardIds 未解決時 side-channel queue で modal、resolve 後に
      //       stack count=cardIds.length + 各 cardId を source area から splice
      //   - multi-pick (n>1) は UI 側 (CardListModal nMax>1 multi-select) と
      //     useEngineDispatch.ts effectPickResolve dispatcher の協調で実装。
      //   - engine mega-wave W4 (2026-07-03, r5): fromSelf contract — host を pick し **自分自身** を
      //     その下に重ねる (B06008「このキャラをそのキャラの下に重ねる」)。PA 短縮形 (sceneSetState 同型)。
      //     scene→stack は非リムーブ離場 (mutate.scene.toStack、rules/16 + B09048 Q&A MR 非redirect)。
      //     ※ scene-source 一般方向 (「現場のキャラを選び host の下に重ねる」B06005 a2) は
      //       stacked 転送 verb が別途要るため未対応 (DEFERRED-INDEX 参照)。
      if (a.fromSelf === true) {
        if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
          paShortFormAwait(s, verb, a, ctx, ctx.source.player as Player, a.player as Player); // BUG-174: side は相対値のまま渡す (sidesForQuery が owner 相対解釈 — 絶対値だと owner='opp' で反転)
          return;
}

        const hostUid = resolveBindRef(a.uid, ctx) as string;
        if (typeof hostUid !== 'string' || hostUid.startsWith('$')) return; // decline/未解決 → no-op (chain gate は skip 側が担う)
        const selfUid = ctx.source.uid;
        if (typeof selfUid !== 'string') return;
        const sourceOwner = sceneOwnerOf(s, selfUid);
        const replacementBefore = _peekPendingSetCardReplacementSide();
        const moved = mutate.scene.toStack(s, selfUid, hostUid);
        const replacementAfter = _peekPendingSetCardReplacementSide();
        if (!moved) {
          if (replacementAfter && replacementAfter !== replacementBefore) return;
          (ctx.dyn ??= {}).chainStepNoApply = true;
          return;
        }
        if (sourceOwner !== undefined) recordStackMove(s, ctx, sourceOwner, 'scene', hostUid, 1);
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charStackCard:self-under', target: hostUid, result: selfUid });
        return;
      }
      // engine A1 wave (2026-07-11, D10009 工藤新一 a2): scene-source 方向 — 「自分の現場にいるキャラを
      // 1枚まで選び、**このキャラ (ctx.source)** の下に重ねる」。fromSelf の鏡像 (fromSelf は host を pick し
      // 自身を重ねる / 本 branch は重ねる側を pick し host=ctx.source)。sceneRemove と同じ PA 短縮形で
      // 選択 uid が a.uid に解決され、toStack(pickedUid, ctx.source.uid) で host 下へ。moved の set/stacked は
      // toStack が離場時リムーブ (rules/16)。0枚 pick ('$pick') は chainStepNoApply → 「重ねた場合」後続を gate。
      if (a.fromScene === true) {
        if (a.uid === undefined && typeof a.player === 'string' && hasNorMax(a)) {
          // host (= ctx.source.uid) を pick 前に args へ固定する。effectPickResolve/continuation 経由の
          // re-dispatch では ctx.source.uid が drop されうる (fromSelf 分岐の argsWithResolvedUid と同趣旨) ため、
          // hostUid を短縮形 args に載せて再入時に読む。
          const injected = typeof ctx.source.uid === 'string' ? { ...a, hostUid: ctx.source.uid } : a;
          paShortFormAwait(s, verb, injected, ctx, ctx.source.player as Player, a.player as Player); // BUG-174: side は相対値のまま渡す
          return;
        }
        if (a.uid === '$pick') {
          (ctx.dyn ??= {}).chainStepNoApply = true; // 「重ねた場合」不成立 (0枚選択) → chain break
          mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charStackCard:scene-under', result: 'skipped' });
          return;
        }
        const movedUid = resolveBindRef(a.uid, ctx) as string;
        if (typeof movedUid !== 'string' || movedUid.startsWith('$')) { (ctx.dyn ??= {}).chainStepNoApply = true; return; }
        const hostUid = typeof a.hostUid === 'string' ? a.hostUid : ctx.source.uid;
        if (typeof hostUid !== 'string') return;
        const sourceOwner = sceneOwnerOf(s, movedUid);
        const replacementBefore = _peekPendingSetCardReplacementSide();
        const moved = mutate.scene.toStack(s, movedUid, hostUid);
        const replacementAfter = _peekPendingSetCardReplacementSide();
        if (!moved) {
          if (replacementAfter && replacementAfter !== replacementBefore) return;
          (ctx.dyn ??= {}).chainStepNoApply = true;
          return;
        }
        if (sourceOwner !== undefined) recordStackMove(s, ctx, sourceOwner, 'scene', hostUid, 1);
        mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charStackCard:scene-under', target: hostUid, result: movedUid });
        return;
      }
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
          if (a.gateOnEmpty === true) (ctx.dyn ??= {}).chainStepNoApply = true;
          mutate.log.append(s, {
            ts: Date.now(), player: ctx.source.player, turn: s.turn.number,
            action: 'effect:charStackCard', target: stUid, result: '0',
          });
          return;
        }
        // The selected source cards must not leave their zone unless the selected host
        // still exists when this resumed pick is applied.
        if (typeof stUid !== 'string' || stUid.startsWith('$') || !readScene.byUid(s, stUid)) {
          (ctx.dyn ??= {}).chainStepNoApply = true;
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
          // Pending card picks carry only card IDs. Revalidate multiplicity at resume so
          // a stale source occurrence cannot be recreated under the host.
          const needed = new Map<string, number>();
          for (const cid of cardIds) needed.set(cid, (needed.get(cid) ?? 0) + 1);
          if ([...needed].some(([cid, n]) => (arr?.filter(id => id === cid).length ?? 0) < n)) {
            (ctx.dyn ??= {}).chainStepNoApply = true;
            return;
          }
          if (typeof a.bind === 'string') {
            (ctx.bindings as Record<string, unknown>)[a.bind] = cardIds.map(cardId => ({ cardId }));
          }
          for (const cid of cardIds) {
            const idx = arr?.indexOf(cid) ?? -1;
            if (idx !== -1) {
              arr.splice(idx, 1);
              if (sourceArea === 'remove') advanceIndexedZoneEpoch(s, fromPlayer, 'remove');
            }
          }
        } else if (typeof a.bind === 'string') {
          (ctx.bindings as Record<string, unknown>)[a.bind] = cardIds.map(cardId => ({ cardId }));
        }
        mutate.char.stackCard(s, stUid, cardIds.length, cardIds);
        if (sourceArea === 'remove' || sourceArea === 'hand' || sourceArea === 'deck') {
          const fromPlayer = sourceSide === 'opp' ? 'opp' : ownerP;
          recordStackMove(s, ctx, fromPlayer, sourceArea, stUid, cardIds.length);
        } else {
          recordSceneValueChange(s, ctx, stUid, { type: 'count', amount: cardIds.length, unit: 'card' });
        }
        mutate.log.append(s, {
          ts: Date.now(), player: ownerP, turn: s.turn.number,
          action: 'effect:charStackCard', target: stUid, result: String(cardIds.length),
        });
        return;
      }
      // legacy: { uid, n }
      const stN = a.n as number;
      mutate.char.stackCard(s, stUid, stN);
      if (Number.isSafeInteger(stN) && stN > 0) {
        recordSceneValueChange(s, ctx, stUid, { type: 'count', amount: stN, unit: 'card' });
      }
      mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charStackCard', target: stUid, result: String(stN) });
      return;
    }

/** Move exact selected stacked occurrences from one own-scene host to another. */
export function atomCharTransferStackedCards(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
  const fromUid = resolveBindRef(a.fromUid, ctx);
  const toUid = resolveBindRef(a.toUid, ctx);
  const raw = typeof a.bind === 'string' ? (ctx.bindings as Record<string, unknown>)[a.bind] : undefined;
  const instanceIds = Array.isArray(raw)
    ? raw.map(item => (item as { instanceId?: unknown }).instanceId).filter((id): id is string => typeof id === 'string')
    : [];
  if (typeof fromUid !== 'string' || typeof toUid !== 'string' || fromUid.startsWith('$') || toUid.startsWith('$') || instanceIds.length === 0) return;
  const moved = mutate.char.transferStackedCards(s, fromUid, toUid, instanceIds.length, instanceIds);
  if (moved.length !== instanceIds.length) {
    (ctx.dyn ??= {}).chainStepNoApply = true;
    return;
  }
  mutate.log.append(s, {
    ts: Date.now(), player: ctx.source.player, turn: s.turn.number,
    action: 'effect:charTransferStackedCards', target: `${fromUid}->${toUid}`, result: instanceIds.join(','),
  });
}

export function atomCharGrantTraitAllAreasTurn(s: GameState, a: Record<string, unknown>, ctx: EffectCtx): void {
  const trait = a.trait;
  if (typeof trait !== 'string' || trait.length === 0) return;
  const player = a.player === 'opp'
    ? (ctx.source.player === 'self' ? 'opp' : 'self')
    : ctx.source.player;
  mutate.flag.grantCharacterTraitAllAreasTurn(s, player, trait);
  mutate.log.append(s, { ts: Date.now(), player: ctx.source.player, turn: s.turn.number, action: 'effect:charGrantTraitAllAreasTurn', result: `${player}:${trait}` });
}
