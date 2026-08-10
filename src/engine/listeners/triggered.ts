// Round 4b: triggered ability の汎用 listener
//
// rules: 15-abilities-effects.md §条件発動, 17-icons.md §【登場時】等
// spec: .claude/specs/engine-api-card-abilities.md, engine-api-events.md
//
// 役割:
//   - 7 種類の hook (enter / effect:declared / action:declare / action:guarded /
//     contact:start / case:to-resolved / phase:end:start) を listener 登録
//   - 発火時に scene / partner-area / case-area / hand 上の全カードを走査
//   - 各カードの triggered ability で hook が一致するものを抽出
//   - scope / selfOnly / matcher / condition でフィルタし、合格分の effect を
//     pendingEffects へ queue
//
// 設計上の注意:
//   - Round 1-3 で hirameki / misread の 2 hook しか listener なく、enter 等の
//     triggered ability が全件 noop になっていた (BUG-005 / BUG-007) を解消
//   - 既存 hirameki / misread listener は icon ability 専用パスで残存、本 listener は
//     type='triggered' (条件発動) のみを対象とする
//   - 'effect:declared' hook では payload.cardId を見て on-hand のカード自身を判定
//     (event card 自身が「使われた」とき発動する eventRemoveByAP 等の pattern)
//   - selfOnly: scene/partner では source.uid が一致、hand では payload.cardId が一致

import { event } from '../event/registry.js';
import { def as readDef } from '../read/def.js';
import { char as readChar } from '../read/char.js'; // BUG-096: triggered ability の limit enforcement
import { abilityIsShippu } from '../read/keyword.js'; // wave-8 P15: 疾風発動 per-turn 記録
import { effectiveCutinAbilities } from '../read/hand-cutin.js';
import { effectiveTriggeredAuraAbilities } from '../read/triggered-aura.js';
import { char as charMutator } from '../mutate/char.js'; // W6 step4 (r58/B09090): per-char 疾風 flag + waive 消費
import { flag } from '../mutate/flag.js';            // BUG-096: declaredUseCount 流用
import { evalCond } from '../cond/eval.js';
import { resolveEffectPicks } from '../effect/resolve-picks.js';
import { _setDeferredEntryPickResolver } from '../resolve/stack.js';
import { HeuristicPolicy } from '@/ai/policies/heuristic.js';
import type { GameState, AbilityDef, AbilityScope, Effect, EffectCtx, EffectResolutionKind, EffectStackEntry } from '../types/index.js';
// 2026-05-27 Option C: ヒラメキは triggered hook='evidence:remove-by-action' + optional:true
// として本 listener で処理。検出時は pendingHirameki side-channel に push して fire/skip を UI に委譲。
import { pushPendingHirameki } from './hirameki.js';

// user_request 20260522_01 #6/#2: human player side の globalThis 側チャネル
// (hirameki / misread と同じ pattern)。UI 側 (App.tsx 等) が GameSetupModal で
// 「対戦開始」(spectatorMode=false) のとき 'self' を set、観戦モード/null は
// human 無し。triggered.ts は本 flag を見て auto-pick を skip する。
declare global {

  var __humanPlayerSide: 'self' | 'opp' | null | undefined;
}

function getHumanPlayerSide(): 'self' | 'opp' | null {
  return (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide ?? null;
}

export function _setHumanPlayerSide(side: 'self' | 'opp' | null): void {
  (globalThis as { __humanPlayerSide?: 'self' | 'opp' | null }).__humanPlayerSide = side;
}

type Player = 'self' | 'opp';

// refactor 2b (2026-06-12): export 化 — scripts/taskA-validate-specs.cjs HOOKS との同期を
// tests/engine/sync-taskA-whitelists.test.ts が機械検証するため。
export const TRIGGERED_HOOKS = [
  'enter',
  'enter:group', // engine mega-wave W4 (2026-07-03, r83): 効果登場 batch 集約 (B01012)

  'effect:declared',
  'action:pre-target', // D11007 v2 Phase 3: attacker 選択時、target 列挙前
  'action:declare',
  'action:guarded',
  'contact:start',
  'case:to-resolved',
  'phase:end:start',
  // engine defer-unlock mini-wave (2026-07-09): 「自分のターンのメインフェイズ開始時」(B05072 沖矢昴)。
  // emit は flow/turn.ts 既存 (オートフェイズ完了後 = 公式Q&A のタイミングと一致)。payload={player}、
  // キャラ uid を持たない hook のため側 gate は matcherCondition triggerPlayerIs (file:pop 同流儀)。
  // 挙動不変の機序 (wave-3 と同論拠): 既存カードは本 hook を trigger.hook に宣言しない → queue 0。
  'phase:main:start',
  // engine-extension #1: 現場リムーブ時 (rules/17 §リムーブ方法は問わない)。離場カード自身は
  // collectCardsInPlay に出ないため handleLeaveToRemoveSelf (virtual location) を併用、
  // 在場カードの「キャラがリムーブされたとき」反応は通常 in-play scan (handleHook)。
  'leave:to-remove',
  // 2026-05-27 Option C: ヒラメキ統合。payload.ev.cardId の def から
  // trigger.hook='evidence:remove-by-action' の ability を探す (in-play scan 経路と別)。
  'evidence:remove-by-action',
  // engine-extension (2026-06-06 タスクC): 推理反応 (rules/11)。doReasoning が emit する
  // reasoning:end (source={player, uid}=推理したキャラ) を card-triggerable 化。推理後 (証拠加算後) に
  // 発火。推理キャラは scene に sleep で残るため collectCardsInPlay に出る → 特別 handler 不要、
  // 通常 in-play scan (handleHook) で処理。selfOnly=「このキャラが推理したとき」(source.uid 一致)。
  'reasoning:end',
  // A reaction window after the reasoning character sleeps but before mislead
  // and evidence. Flow queues a gated continuation for the latter stages.
  'reasoning:after-sleep',
  // engine-extension (2026-06-06 タスクC): 変装時 (rules/09 §変装, 23-qa-disguise-cutin.md)。
  // flow.contact.disguise が emit する disguise:into (source={player, uid}=変装で入れ替わったキャラ。
  // uid は維持され cardId のみ変装カードに差替わる) を card-triggerable 化。変装後のキャラは scene に
  // 残り、cardId は変装カードのものに変わるため collectCardsInPlay は変装カード def を走査する →
  // 特別 handler 不要、通常 in-play scan (handleHook) で 【変装時】ability を発火。
  // selfOnly=「(変装した) このキャラが…」(source.uid=変装キャラ uid 一致)。rules/09: 変装は「登場」では
  // ないため enter hook は発火せず、disguise:into のみ発火する (登場時能力は別 hook で不発)。
  'disguise:into',
  // Task D E3 (2026-06-12): 「FILEエリアにあるカードを手札に加えたとき」(B05050) を card-triggerable 化。
  // emit 箇所: next-hint.ts:74 (既存) + filePopToHand (BUG-128 修正で追加)。payload={player, popped}。
  // キャラ uid を持たない hook のため matcherCondition は triggerPlayerIs を使う (triggerCharMatches 不適合)。
  'file:pop',
  // engine拡張 wave#2 cluster3 (2026-06-13): 「このキャラのアクション終了時」(PR086/B03073/B05108) を
  // card-triggerable 化。emit は既存 (state-machine.ts completed/aborted、source={player,uid}=actor)。
  // 公式 qAndA「アクション終了時に現場にいないキャラの能力は発動しない」は in-play scan
  // (collectCardsInPlay) + selfOnly で自然成立 (離場 actor は走査対象外、rules/22)。
  'action:end',
  // engine拡張 wave#2 cluster3 (2026-06-13): 「〜のアクション[事件]によって証拠を得たとき」
  // (B08012/B01067/D04007) を card-triggerable 化。emit は flow/action-case.ts gainSelfEvidence のみ
  // (rules/10 手順3 = 実獲得時のみ。推理/効果/refresh 由来では emit しない — この排他性が
  // 「アクション[事件]によって」の語義を構造的に保証する。pin: wave2-cluster3 test)。
  'evidence:gain',
  // engine拡張 wave#2 cluster9 (2026-06-15): 「(裏向き)セットカードが現場から離れたとき」(rules/16)。
  // emit 元 = scene.ts removeToRemove/toDeck/toHand (host splice 前、per-entry) + char.ts removeOneSetCard。
  // 離場するのは set card (ability を持たない) で、listener は in-play の B07034/B02020。
  // host が listener 自身 (B07034 self-leave Q&A) の場合も emit-before-splice で collectCardsInPlay に残る
  // → 特別 handler 不要、通常 in-play scan (handleHook) で処理。side 判定は triggerPlayerIs (file:pop 同様)。
  'setcard:leave',
  // engine additive (2026-06-29): 「このキャラにカードがセットされたとき」(rules/16)。
  // emit 元 = mutate/char.ts setCard (push 後、host 在場)。listener = host 自身 (selfOnly source.uid===host.uid)。
  // set card 自体は ability を持たない。通常 in-play scan (handleHook) で処理 = 特別 handler 不要。
  'setcard:enter',
  // engine additive wave-3 (2026-06-30): observer-hook 群 (在場の第三者キャラが観測)。3 hook とも
  // listener = 在場キャラ → 通常 in-play scan (handleHook) で処理 = 特別 handler 不要 (leave:to-remove /
  // evidence:remove-by-action のような virtual location handler は不要)。挙動不変の機序: 本ループが
  // 全 TRIGGERED_HOOKS に handleHook を登録するため emit は early-return せず in-play scan を行うが、
  // 既存カードは新 hook を trigger.hook/hooks に宣言しないため handleHook が一致 ability を見つけず
  // effect を一切 queue しない (= pendingEffects 不変、setcard:enter と同論拠)。
  //   cutin:used        — flow/contact.cutIn emit。matcher = triggerPlayerIs(側) + triggerCutinMatches(名/特徴)。
  //   misread:performed — listeners/misread + UI misreadResolve emit。matcher = triggerPlayerIs / selfOnly。
  //   evidence:removed  — mutate/evidence emit。matcher = triggerPlayerIs(持ち主側)。
  'cutin:used',
  'misread:performed',
  'evidence:removed',
  // engine mega-wave W2 (2026-07-03): ability:declared — 宣言能力使用の第三者観測 (B03057)。
  //   emit = flow/main/declared-ability (宣言成立時)。matcher = triggerCharMatches (payload.uid+player 既定) /
  //   triggerPlayerIs。listener = 在場キャラ → 通常 in-play scan (handleHook)。既存カード未宣言 = 挙動不変 (wave-3 同論拠)。
  'ability:declared',
  // engine additive wave-4 (2026-07-01): remove:exit — カードがリムーブエリアから離れたとき (離脱カード毎、
  // 原因非依存)。emit 元 = mutate.remove.emitExit 経由で全離脱経路網羅 (refresh / removeFromHere /
  // handAddFromRemove / removeAreaAllToDeckBottom / evidence.gainCard fromArea=remove。hooks.ts 参照)。
  // listener = 在場キャラ (B05087/B05088) → 通常 in-play scan (handleHook) で処理 = 特別 handler 不要。
  // 挙動不変の機序 (wave-3 と同論拠): 本ループが全 TRIGGERED_HOOKS に handleHook を登録するため emit は
  // in-play scan を行うが、既存カードが remove:exit を trigger.hook に宣言しないため effect を queue しない
  // (= pendingEffects 不変)。matcher = removeExitMatches (離脱カードの cardId→CardDef を filter 評価)。
  'remove:exit',
  // engine mega-wave W3 (2026-07-03): observer hook 3種。
  //   disguise:replaced = 被置換側自己反応 (B03052、virtual-location handler = handleDisguiseReplacedSelf)
  //   hand:removed      = 手札→リムーブ観測 (B05115、splice 前 emit ゆえ通常 in-play scan で可)
  //   hand:reveal       = 手札公開観測 (B09004、zone 不変 = 通常 in-play scan)
  'disguise:replaced',
  'hand:removed',
  'hand:reveal',
  // engine additive A2 (2026-07-11): state:change — キャラの active→sleep 遷移観測 (B03008 阿笠博士
  // 「アクティブ状態の〚少年探偵団〛がスリープになったとき」)。emit 元 = mutate/scene.ts setState
  // (active→sleep のみ、実遷移時)。listener = 在場の第三者キャラ (遷移キャラも sleep で在場) →
  // 通常 in-play scan (handleHook) で処理 = 特別 handler 不要。既存カード未宣言 = 挙動不変 (wave-3 同論拠)。
  // matcher = triggerCharMatches{payloadKey:'uid', side, filter}。
  'state:change',
] as const;

type TriggeredHook = (typeof TRIGGERED_HOOKS)[number];

type CardLocation = {
  player: Player;
  uid: string;
  cardId: string;
  // 2026-05-27 Option C: 'evidence' を追加。handleEvidenceRemovedHook が virtual な
  // 「リムーブされた証拠」を CardLocation として組み立てて handleHook の共通処理 (effect queue) を再利用する。
  area: 'scene' | 'partner-area' | 'case' | 'hand' | 'evidence';
};

function collectCardsInPlay(state: GameState): CardLocation[] {
  const result: CardLocation[] = [];
  for (const p of ['self', 'opp'] as const) {
    const ps = state.players[p];
    // scene キャラ
    for (const c of ps.scene) {
      result.push({ player: p, uid: c.uid, cardId: c.cardId, area: 'scene' });
    }
    // partner card
    if (ps.partner.cardId) {
      result.push({ player: p, uid: `partner:${p}`, cardId: ps.partner.cardId, area: 'partner-area' });
    }
    // case card (rules/06: 事件カード)
    if (ps.case.cardId) {
      result.push({ player: p, uid: `case:${p}`, cardId: ps.case.cardId, area: 'case' });
    }
    // MR partner-area (rules/18, engine/mr-partner-area-core 2026-06-23): PA 常駐 MR を別 uid
    // `partnerMR:p` + area 'partner-area' で登録 (real partner の `partner:p` と別文字列 = double-fire 防止)。
    // scope on-partner-area / always の triggered・declared ability がここから拾われる。slot の uid は
    // 既に `partnerMR:p` sentinel に書換済 (mutate/scene.placeMrInPA) なので selfOnly source.uid 照合と整合。
    if (ps.partnerAreaMR) {
      result.push({ player: p, uid: `partnerMR:${p}`, cardId: ps.partnerAreaMR.cardId, area: 'partner-area' });
    }
    // hand card (event card の on-hand ability 用)
    // on-hand ability は「使用したその1枚」が発火する。payload は cardId 単位で物理コピーを
    // 区別しないため、同一 cardId が複数あっても1 locationだけ列挙する (S3 duplicate probe)。
    for (const cardId of new Set(ps.hand)) {
      result.push({ player: p, uid: `hand:${p}:${cardId}`, cardId, area: 'hand' });
    }
  }
  return result;
}

/**
 * Bind the character that caused an enter hook while it is still live.
 *
 * The binding is deliberately made before ability gates run and is persisted
 * on the queued entry.  Consumers then rehydrate it at resolution time, so a
 * departed entrant fails closed while a still-live entrant uses current state.
 */
function triggerBindingsForHook(
  hookName: TriggeredHook,
  state: GameState,
  payload: unknown,
): EffectCtx['bindings'] {
  if (hookName !== 'enter') return {};
  const uid = (payload as { uid?: unknown } | undefined)?.uid;
  if (typeof uid !== 'string') return {};
  for (const player of ['self', 'opp'] as const) {
    const char = state.players[player].scene.find(candidate => candidate.uid === uid);
    if (char) return { $triggerChar: [{ kind: 'char', uid: char.uid, cardId: char.cardId, player }] };
  }
  return {};
}

function scopeAllowsArea(scope: AbilityScope | undefined, area: CardLocation['area']): boolean {
  // scope 未指定は 'on-scene' default (rules/15)
  const s = scope ?? 'on-scene';
  if (s === 'always') return true;
  if (s === 'on-scene') return area === 'scene';
  // on-partner-area: パートナーエリア OR 現場 (MR でも両方で動く)
  if (s === 'on-partner-area') return area === 'partner-area' || area === 'scene';
  if (s === 'on-hand') return area === 'hand';
  // 2026-05-27 Option C: on-evidence scope を許可。area='evidence' は
  // handleEvidenceRemovedHook の VIRTUAL CardLocation 経由でのみ渡る (collectCardsInPlay
  // は通常 evidence を返さない)。これで scope 整合性 check が通る。
  if (s === 'on-evidence') return area === 'evidence';
  // engine additive (2026-06-29c): on-set-host rider — set card def 上の triggered ability は
  // host (現場のセット先キャラ) の能力として発火する。riderAbilities として host CardLocation
  // (area='scene') に attribute 済なので scene を許可する (装備イベント、B05117 コンコン等)。
  if (s === 'on-set-host') return area === 'scene';
  return false;
}

function selfOnlyMatches(
  card: CardLocation,
  payload: unknown,
  source: unknown,
): boolean {
  const sourceUid = (source as { uid?: string } | undefined)?.uid;
  // on-hand のカード (event card 自身の使用検知) は payload.cardId + source.player で一致確認。
  // Round 4i-fix (BUG-032): player 比較を追加。両プレイヤー手札に同 cardId があると
  // 誤発動していた gap を塞ぐ。handUseCard は source.player を emit 時に詰めるので
  // ここで照合できる (src/engine/flow/main/hand-use-card.ts)。
  if (card.area === 'hand') {
    const payloadCardId = (payload as { cardId?: string } | undefined)?.cardId;
    const sourcePlayer = (source as { player?: string } | undefined)?.player;
    return payloadCardId === card.cardId && sourcePlayer === card.player;
  }
  // scene/partner/case は source.uid で一致確認
  return sourceUid === card.uid;
}

// BUG-132 GAP-2 (2026-06-12): effect:declared の emit 1 回 = 1 batch の連番カウンタ。
// 同一 emit で queue される全 entry (自効果 + 第三者反応) に同じ番号を付与し、
// stack.next() の pairwise gate で「自効果 → 反応」順 (rules/15 §未解決 + B08020 公式Q&A
// 「使用したイベントの効果を先に解決します」) を保証する。

function nextDeclaredBatch(state: GameState): number {
  const persisted = state.declaredBatchSeq ?? 0;
  const legacyMax = state.pendingEffects.reduce((max, entry) =>
    typeof entry.declaredBatch === 'number' ? Math.max(max, entry.declaredBatch) : max,
  0);
  return (state.declaredBatchSeq = Math.max(persisted, legacyMax) + 1);
}

function handleHook(
  hookName: TriggeredHook,
  state: GameState,
  payload: unknown,
  source: unknown,
): void {
  const inheritedBindings = ((source as { bindings?: Record<string, unknown[]> } | undefined)?.bindings ?? {}) as EffectCtx['bindings'];
  const hookBindings = triggerBindingsForHook(hookName, state, payload);
  // Hook-owned names win over an emitter-provided binding.  An enter event
  // cannot spoof the live entrant that gates and later resolves its effect.
  const queuedBindings = { ...inheritedBindings, ...hookBindings } as EffectCtx['bindings'];
  const abilityDeclaredBatch = (payload as { declaredBatch?: unknown } | undefined)?.declaredBatch;
  const declaredBatch = hookName === 'effect:declared'
    ? nextDeclaredBatch(state)
    : hookName === 'ability:declared'
      && (typeof abilityDeclaredBatch === 'number' || typeof abilityDeclaredBatch === 'string')
      ? abilityDeclaredBatch
      : undefined;
  // mega-wave W6 step4 (2026-07-04, B09090/P16): 疾風条件 waive の消費。
  // 「このターン中、**次に**自分の現場に登場したキャラは【疾風】の条件を無視できる」— armed 中の
  // owner 側へ登場した**次の 1 体**が、疾風の有無を問わず arm を消費する (公式Q&A: 疾風を持たない
  // キャラが次に登場した場合も消費され、その次に登場した疾風は条件を無視できない)。消費痕跡は
  // per-char turnEffects['shippuWaived']=true — 下の matcherCondition gate が疾風 ability に限り
  // enterOrderEquals を bypass する根拠。ability 走査より前 (= 同一 emit 内の自分の疾風にも効く)。
  // enter emit は登場 1 体につき 1 回 (sceneEnter atom / hand-use / next-hint / switchEnter 全経路)。
  if (hookName === 'enter') {
    const enterUid = (payload as { uid?: unknown } | undefined)?.uid;
    if (typeof enterUid === 'string') {
      const enterOwner = (['self', 'opp'] as const).find(p => state.players[p].scene.some(c => c.uid === enterUid));
      if (enterOwner && state.turnState[enterOwner].shippuWaiveArmed) {
        state.turnState[enterOwner].shippuWaiveArmed = false;
        charMutator.setTurnEffect(state, enterUid, 'shippuWaived', true);
      }
    }
  }
  for (const card of collectCardsInPlay(state)) {
    const def = readDef.card(card.cardId);
    if (!def) continue;
    // Task D E4 (2026-06-12): granted triggered ability (charGrantAbility) の合算走査。
    // scene のキャラのみ turnEffects.grantedAbilities を持ちうる。granted 配列が無ければ
    // 追加コストほぼゼロ (def.abilities そのまま)。limit は granted id で declaredUseCount が機能。
    const grantedHost = card.area === 'scene'
      ? state.players[card.player].scene.find(c => c.uid === card.uid)
      : card.area === 'partner-area' && card.uid === `partnerMR:${card.player}`
        ? state.players[card.player].partnerAreaMR
        : undefined;
    const grantedRaw = grantedHost?.turnEffects?.['grantedAbilities'];
    // engine additive (2026-06-29c): on-set-host rider triggered — host の faceUp set card def 上の
    // scope:'on-set-host' triggered を host (card.uid) の能力として合算する (装備イベント、B05117 コンコン
    // 「セットされているキャラが…したとき」)。裏向き (faceUp:false) は情報を持たない (rules/16) → 除外。
    // selfOnly は host uid 照合 (selfOnlyMatches が card.uid を使う)。card.area==='scene' のみ (set 先は現場)。
    // gate=scope==='on-set-host' (新 scope、既存カード未宣言 → 回帰0)。set card の on-scene triggered は漏れない。
    const riderAbilities: AbilityDef[] = [];
    if (card.area === 'scene') {
      const hostChar = state.players[card.player].scene.find(c => c.uid === card.uid);
      for (const entry of hostChar?.setCards ?? []) {
        if (!entry.faceUp) continue;
        const sd = readDef.card(entry.cardId);
        if (!sd) continue;
        for (const ability of (sd.abilities ?? []) as AbilityDef[]) {
          if (ability.type === 'triggered' && ability.scope === 'on-set-host') riderAbilities.push(ability);
        }
      }
    }
    const handCutinAbilities = card.area === 'hand'
      ? effectiveCutinAbilities(state, card.player, card.cardId).filter(a => !(def.abilities as AbilityDef[]).includes(a))
      : [];
    const triggeredAuraAbilities = card.area === 'scene'
      ? effectiveTriggeredAuraAbilities(state, {
          player: card.player,
          uid: card.uid,
          cardId: card.cardId,
          char: state.players[card.player].scene.find(c => c.uid === card.uid)!,
        })
      : [];
    const printedAbilities = readChar.originalAbilitiesDisabled(state, card.uid)
      ? []
      : (def.abilities as AbilityDef[]);
    const abilityList = ((Array.isArray(grantedRaw) && grantedRaw.length > 0) || riderAbilities.length > 0 || handCutinAbilities.length > 0 || triggeredAuraAbilities.length > 0)
      ? [...printedAbilities, ...(Array.isArray(grantedRaw) ? (grantedRaw as AbilityDef[]) : []), ...riderAbilities, ...handCutinAbilities, ...triggeredAuraAbilities]
      : printedAbilities;
    for (const ability of abilityList) {
      if (ability.type !== 'triggered') continue;
      const trig = ability.trigger;
      // multi-hook (2026-06-06 タスクC): trig.hook OR trig.hooks のいずれかが一致で発火。
      // 共有【ターンN】は limit が ability.id 単位のため自動成立 (下の limit check)。
      if (!trig || (trig.hook !== hookName && !(trig.hooks?.includes(hookName) ?? false))) continue;
      // 【カットイン】(effect:declared + optional) はコンタクト中の cutin 起動経由
      // (flow.contact.cutIn が emit する payload.abilityId==='cutin') でのみ発火する。
      // handUseCard / next-hint のキャラ召喚・イベント使用 emit (payload.kind set / abilityId なし) では
      // 発火させない — さもないと召喚毎に noop の charModifyAP($contact.byUid) entry が pendingEffects に
      // 残留し続け、効果スタック counter が毎ターン増加 + 古い resolved entry が UI を汚す
      // (CPU per-move 可視化で顕在化したバグ)。rules/09 §カットイン, rules/22。
      if (
        hookName === 'effect:declared'
        && trig.optional === true
        && (payload as { abilityId?: unknown } | undefined)?.abilityId !== 'cutin'
      ) {
        continue;
      }
      const selectedCutinId = (payload as { cutinAbilityId?: unknown } | undefined)?.cutinAbilityId;
      if (hookName === 'effect:declared' && selectedCutinId !== undefined && ability.id !== selectedCutinId) continue;
      // BUG-166/176: only the used card's own effect inherits its explicit
      // resolution lifecycle. Third-party reactions to the same declaration
      // are unrelated sources and must not masquerade as the resolving event.
      const emittedSource = source as {
        player?: unknown;
        cardId?: unknown;
        resolutionKind?: EffectResolutionKind;
      } | undefined;
      const resolutionKind = hookName === 'effect:declared'
        && trig.selfOnly === true
        && emittedSource?.player === card.player
        && emittedSource.cardId === card.cardId
        ? emittedSource.resolutionKind
        : undefined;
      const abilitySource = {
        cardId: card.cardId,
        uid: card.uid,
        abilityId: ability.id,
        description: ability.description,
        player: card.player,
        area: card.area,
        ...(resolutionKind ? { resolutionKind } : {}),
      } as const;
      // scope check
      if (!scopeAllowsArea(ability.scope, card.area)) continue;
      // selfOnly check
      if (trig.selfOnly && !selfOnlyMatches(card, payload, source)) continue;
      // matcher check (カード側で custom 判定)
      if (trig.matcher && !trig.matcher(payload, state)) continue;
      // engine mega-wave W4 (2026-07-03, r83): emit source.bindings を gate 評価 ctx にも貫通する。
      // enter:group の boundAnyMatchesFilter{bindKey:'enterGroup'} を ability.condition (=発動条件、
      // rules/24: 条件不成立なら「発動」自体しない=【ターン1】未消費) で評価するため。
      // 既存 emit は bindings を渡さない → {} で従来と byte 同一。
      const gateBindings = queuedBindings;
      // D11007 v2 (Phase 2): matcherCondition (declarative 版 matcher)
      // payload を ctx.triggerPayload に詰めて evalCond に渡す
      if (trig.matcherCondition) {
        // mega-wave W6 step4 (2026-07-04, B09090/P16): waive 消費済みキャラ (turnEffects['shippuWaived'])
        // の**疾風 ability に限り** matcherCondition (enterOrderEquals) を bypass =「条件を無視できる」。
        // selfOnly gate 通過済みゆえ card.uid = 登場キャラ自身。疾風以外の matcherCondition 持ち
        // (【疾風 N】でない enter 反応等) は bypass しない (abilityIsShippu gate)。
        const w6ShippuWaived = hookName === 'enter'
          && abilityIsShippu(ability)
          && state.players[card.player].scene.find(c => c.uid === card.uid)?.turnEffects?.['shippuWaived'] === true;
        if (!w6ShippuWaived) {
          const ctxMc = {
            source: abilitySource,
            bindings: gateBindings,
            triggerPayload: payload,
          };
          if (!evalCond(state, trig.matcherCondition, ctxMc)) continue;
        }
      }
      // Round 4i-fix: ability.condition の 6 stage gate (BUG-033)
      // partnerColor / caseTrait 等の condition が未達なら queue しない (rules/17 §条件アイコン)
      if (ability.condition) {
        const ctx = {
          source: abilitySource,
          bindings: gateBindings,
          triggerPayload: payload,
        };
        if (!evalCond(state, ability.condition, ctx)) continue;
      }
      // effect が無いと queue しても無意味
      if (!ability.effect) continue;
      // BUG-096: triggered ability の limit:{kind:'turn',n} (【ターン①/②/③】) を enforcement。
      // declared フロー (declared-ability.ts:82-84) と同じ declaredUseCount を流用
      // (SceneCharacter.declaredUseCount、resetTurnFlags がターン境界で reset、rules/17)。
      if (ability.limit?.kind === 'turn') {
        if (readChar.declaredUseCount(state, card.uid, ability.id) >= ability.limit.n) continue;
      }
      // engine additive wave-8 (2026-07-02, P15): 疾風 (enter + enterOrderEquals) が発動した時点で、
      // 発動キャラの owner 側 turnState.shippuFiredThisTurn を立てる。全 gate (selfOnly/matcher/
      // matcherCondition=enterOrderEquals/ability.condition/limit) 通過後に記録 = 実際に発動した時のみ
      // (rules/24: 効果が解決できなくても「発動した」扱い → queue 到達点で記録するのが正しい)。
      // abilityIsShippu で【登場時】(matcherCondition 無し) と区別。「このターン中、自分のキャラの
      // 【疾風】が発動していた場合」(B09072) を Condition {kind:'flag', key:'shippuFiredThisTurn'} が読む。
      // 既存カードは本 flag を読まない (write-only) → 挙動不変。清掃は endTurn (両プレイヤー) + resetTurnFlags backstop。
      if (abilityIsShippu(ability)) {
        state.turnState[card.player].shippuFiredThisTurn = true;
        // mega-wave W6 step4 (2026-07-04, r58): per-char 発動標識も同一 gate で記録
        // (per-player = turnState 履歴 / per-char = turnEffects 標識、B09070 a3 一括アクティブが
        // TargetFilter.shippuFiredCharThisTurn で読む)。清掃は次 startTurn 境界 (BUG-170 —
        // endTurn 清掃だと turn-end queue の解決時参照より先に消える)。
        charMutator.setTurnEffect(state, card.uid, 'shippuFiredCharThisTurn', true);
      }
      // Phase 7-2 (BUG-035 fix): effect 内の $pick atom を候補から substitute してから queue
      // recursive utility が atom / choice / sequence / conditional / optional 等を walk
      // Phase 7-3: chooseAtomTarget callback で verb 別ヒューリスティック選択 (敵 highest AP 等)
      // 2026-05-27 (Option C follow-up): emit source.bindings (例: cutin/contact の contact bindings)。
      // event.queue 6th arg で entry へ永続化 (runtime $contact.byUid 解決)。加えて engine wave-18:
      // walk 時 (resolveEffectPicks) の resolveCtx.bindings にも載せる — optional{...} が $contact.* /
      // ctx.contact (inContact pick, B04092 キャンティ) を surface 時に captur するため (choice の BUG-114 対称、
      // setPendingOptionalBindings)。既存 non-optional 効果の pick/$contact は従来通り runtime (entryToCtx) 解決。
      const sourceBindings = queuedBindings;
      // user_request 20260522_01 #6/#2 + BUG-054 + BUG-065-followup:
      // human player owned effect は humanChooser=true で resolveEffectPicks に
      // 渡し、$pick 検出時に side-channel `__pendingEffectPickSide` を set。
      //
      // BUG-065-followup: 旧実装は side-channel set 時に effect 全体の queue を
      // skip していたが、sequence の途中で pick が出る effect (例: D08015 a1 =
      // sequence([draw, choice([discard with pick])])) では pre-pick step
      // (draw) も失われていた。pattern A 時代は effect 全体が pick atom 1 つ
      // だったため問題にならなかった。
      //
      // 現実装: effect 全体を常に queue する。pick 未解決の atom は
      // atom-handlers の safety net (例: discard:skip-unresolved-pick) で no-op
      // 扱い。後で UI が modal でユーザー選択 → effectPickResolve dispatch で
      // 解決済み atom が単体で queue されて実行される。
      // BUG-132 GAP-2: 第三者反応 (own = trig.selfOnly===true 以外) は pick/dyn を queue 時に
      // 確定せず raw のまま queue し、stack.runOne() の遅延 substitute (下の
      // resolveDeferredEntryPicks) で解決時盤面の候補を参照する (rules/15 §解決時参照、
      // B07016/B08020 a2「（イベントを解決してからキャラを選ぶ）」)。selfOnly entry
      // (イベント自効果 / カットイン自効果 / scene rider) は従来通り queue 時解決。
      const isDeclaredReaction = (hookName === 'effect:declared' || hookName === 'ability:declared')
        && trig.selfOnly !== true;
      const resolvedEffect = ability.effect;
      // queue (side-channel set されていても skip しない、pre-pick step 実行のため)。
      // sourceBindings (contact bindings) は上で算出済 → entry に永続化 (runtime $contact.byUid 解決)。
      event.queue(
        state,
        resolvedEffect,
        {
          player: card.player,
          uid: card.uid,
          cardId: card.cardId,
          abilityId: ability.id,
          description: ability.description,
          ...(resolutionKind ? { resolutionKind } : {}),
        },
        hookName,
        payload,
        sourceBindings,
        // BUG-132 GAP-2: effect:declared のみ batch 連番 + 反応マーカーを entry に付与
        {
          deferredPicks: true,
          ...(declaredBatch !== undefined
          ? {
              declaredBatch,
              ...(isDeclaredReaction ? { declaredReaction: { abilityId: ability.id } } : {}),
            }
          : {}),
        },
      );
      // BUG-096: 発火を記録 (limit:{turn} のカウント。limit 無しは no-op)
      if (ability.limit?.kind === 'turn') {
        flag.incrDeclaredUseCount(state, card.uid, ability.id);
      }
    }
  }
}

// BUG-132 GAP-2: declaredReaction entry の遅延 pick substitute (stack.runOne から呼ばれる)。
// handleHook の queue 時 resolveEffectPicks と同じ contract を、解決時盤面に対して実行する。
// stack コアに AI import を持ち込まないため、listener 層から関数注入する (敵対レビュー反映)。
function resolveDeferredEntryPicks(state: GameState, entry: EffectStackEntry, resolveCtx: EffectCtx): Effect {
  const abilityId = entry.declaredReaction?.abilityId ?? entry.source.abilityId ?? '';
  const humanSide = getHumanPlayerSide();
  const isHumanEffect = humanSide !== null && entry.source.player === humanSide;
  // handleHook と同じ lazy instantiate (module top では circular import 発生)
  const aiPolicy = new HeuristicPolicy();
  const resolved = resolveEffectPicks(state, entry.effect, resolveCtx, {
    chooseAtomTarget: isHumanEffect ? undefined : aiPolicy.chooseAtomTarget?.bind(aiPolicy),
    runtimeAtomTargetPolicyKey: isHumanEffect ? undefined : 'heuristic',
    byPlayer: entry.source.player,
    humanChooser: isHumanEffect,
    source: { cardId: entry.source.cardId ?? '', abilityId },
  });
  // `resolveEffectPicks` leaves the queued atom as a runtime no-op carrier,
  // but retains every earlier sequence step.  Discarding the whole resolved
  // effect here also discarded those already-unblocked prefix effects.
  return resolved;
}

let _registered = false;

export function _resetTriggeredRegistered(): void {
  _registered = false;
}

export function registerTriggeredListener(): void {
  if (_registered) return;
  _registered = true;
  // BUG-132 GAP-2: 遅延 pick resolver を stack へ注入 (登録は冪等)
  _setDeferredEntryPickResolver(resolveDeferredEntryPicks);
  for (const hook of TRIGGERED_HOOKS) {
    if (hook === 'evidence:remove-by-action') {
      // 2026-05-27 Option C: ヒラメキ統合経路。in-play scan ではなく payload の cardId から
      // 直接 def を引いて ability を探す (evidence area の card は collectCardsInPlay に出ない)。
      event.on(hook, (state, payload, source) => {
        handleEvidenceRemovedHook(state, payload, source);
      });
      continue;
    }
    if (hook === 'leave:to-remove') {
      // engine-extension #1: 現場リムーブ時 (rules/17)。
      //  - 離場したカード自身の【現場リムーブ時】: scene から消えた後なので source から
      //    virtual location を組み立てて処理 (handleLeaveToRemoveSelf)
      //  - 在場カードの「キャラがリムーブされたとき」反応: 通常 in-play scan (handleHook)
      event.on(hook, (state, payload, source) => {
        handleLeaveToRemoveSelf(state, payload, source);
        handleHook('leave:to-remove', state, payload, source);
      });
      continue;
    }
    if (hook === 'disguise:replaced') {
      // engine mega-wave W3 (2026-07-03, r10): 被置換側自己反応 (B03052)。退場カードは emit 時点で
      // 既にデッキ下 = collectCardsInPlay に出ない → virtual location 専用 handler のみ。
      // 第三者 observer 型の実カードが存在しない (memberCount=2 は同カードの parallel) ため
      // handleHook の in-play scan は意図的に併走させない — 将来 observer 変種が来たら別 row で追加。
      event.on(hook, (state, payload, source) => {
        handleDisguiseReplacedSelf(state, payload, source);
      });
      continue;
    }
    if (hook === 'setcard:leave') {
      // engine additive A2 (2026-07-11, B02084 安室の愛車): セットカード自身の remove 到達自己反応。
      //  - セットカード自身の on-set-self triggered: 離場後 collectCardsInPlay に出ないため
      //    handleSetcardLeaveSelf (virtual location、faceUp gate) で処理。
      //  - 在場キャラの「セットカードが離れたとき」観測 (B07034/B02020): 通常 in-play scan (handleHook)。
      event.on(hook, (state, payload, source) => {
        handleSetcardLeaveSelf(state, payload, source);
        handleHook('setcard:leave', state, payload, source);
      });
      continue;
    }
    if (hook === 'phase:end:start') {
      event.on(hook, (state, payload, source) => {
        handleOnSetSelfPhaseEndStart(state, payload, source);
        handleHook('phase:end:start', state, payload, source);
      });
      continue;
    }
    event.on(hook, (state, payload, source) => {
      handleHook(hook, state, payload, source);
    });
  }
}

/**
 * 2026-05-27 Option C: ヒラメキ用 hook。
 * payload = { player, ev: { cardId } } (player はリムーブされた側 = ヒラメキ発動権利者)。
 * - in-play scan ではなく payload.ev.cardId から CardDef を取得
 * - virtual CardLocation を組み立てて scope/matcher/condition チェック
 * - trigger.optional=true なら pendingHirameki に push (UI が fire/skip)
 * - trigger.optional=false なら従来の triggered と同じく強制発動 (effect queue)
 */
function handleEvidenceRemovedHook(state: GameState, payload: unknown, source: unknown): void {
  const p = payload as {
    player?: 'self' | 'opp';
    ev?: { cardId?: string };
    byUid?: string;
    actionId?: string;
    causalCorrelationEventId?: string;
    occurrence?: { player?: 'self' | 'opp'; cardId?: string; removeIndex?: number };
  } | undefined;
  if (!p || !p.player || !p.ev || !p.ev.cardId) return;
  // B06049 cluster8 (2026-06-15): アクション[事件] を行った側が「相手の【ヒラメキ】は発動しない」を
  // セットしている場合 (turnState[証拠を失う側].hiramekiSuppressed)、optional/forced 両経路の
  // ヒラメキ発火をここで抑止する (action-scoped、action-end で清掃)。rules/10。
  if (state.turnState[p.player]?.hiramekiSuppressed) return;
  // engine mega-wave W2 (2026-07-03, G09/r29): 継続 aura「相手は【ヒラメキ】を発動できない」(B05079)。
  // aura 所有者 = ヒラメキ権利者 (p.player = 証拠を失う側) の **相手**。restrictsOpponent(s, banSide, ..) の
  // 語義「banSide の盤面 aura が banSide の相手を制限」(cluster5 canCutIn と同流儀)。証拠リムーブ自体は
  // 継続、ヒラメキ効果のみ不発 (rules/10 / 公式Q&A)。不在時 false = 挙動不変。
  if (readChar.restrictsOpponent(state, p.player === 'self' ? 'opp' : 'self', 'hirameki')) return;
  const def = readDef.card(p.ev.cardId);
  if (!def) return;
  const card: CardLocation = {
    player: p.player,
    uid: `evidence:${p.player}`,
    cardId: p.ev.cardId,
    area: 'evidence',
  };
  for (const ability of def.abilities as AbilityDef[]) {
    if (ability.type !== 'triggered') continue;
    const trig = ability.trigger;
    if (!trig || trig.hook !== 'evidence:remove-by-action') continue;
    if (!scopeAllowsArea(ability.scope, card.area)) continue;
    if (trig.matcher && !trig.matcher(payload, state)) continue;
    const baseCtx = {
      source: {
        cardId: card.cardId,
        uid: card.uid,
        abilityId: ability.id,
        player: card.player,
        area: card.area,
      },
      bindings: {},
      triggerPayload: payload,
    };
    if (trig.matcherCondition && !evalCond(state, trig.matcherCondition, baseCtx)) continue;
    // Ver.2.5 p.21: an invalid Hirameki may still be activated. Its icon is
    // visible to the player, while its ability text resolves as a no-op.
    // Other triggered abilities do not fire when their icon condition fails.
    const effectValid = !ability.condition || evalCond(state, ability.condition, baseCtx);
    if (!effectValid && !trig.optional) continue;
    if (!ability.effect) continue;

    if (trig.optional) {
      const occurrence = p.occurrence;
      // ヒラメキ semantics: fire/skip 選択を UI に委譲
      // (旧 hirameki.ts listener と同等の動作)
      pushPendingHirameki({
        player: card.player,
        cardId: card.cardId,
        abilityId: ability.id,
        effectValid,
        // engine wave-11 (2026-07-02): actor uid snapshot を optional 経路にも貫通
        // (forced 経路は baseCtx.triggerPayload=payload に byUid が既に載る)。hiramekiResolve が
        // queue payload に復元し '$trigger.byUid' (「アクション中のキャラ」) を解決可能にする。
        actorUid: p.byUid,
        actionId: p.actionId,
        causalCorrelationEventId: p.causalCorrelationEventId,
        occurrence: occurrence
          && occurrence.player === p.player
          && occurrence.cardId === p.ev.cardId
          && typeof occurrence.removeIndex === 'number'
          && Number.isInteger(occurrence.removeIndex)
          ? { player: occurrence.player, cardId: occurrence.cardId, removeIndex: occurrence.removeIndex }
          : undefined,
      });
      return; // 1 イベントで複数 optional は想定せず、最初の 1 件のみ
    }

    // 強制発動 (rules/15 §必須効果) — 通常 triggered と同じ経路
    // ヒラメキ用に source.bindings も伝達 (今後 $evidence.* 等を使うカードを想定)
    const sourceBindings = (source as { bindings?: Record<string, unknown[]> } | undefined)?.bindings;
    event.queue(
      state,
      ability.effect,
      { player: card.player, uid: card.uid, cardId: card.cardId, abilityId: ability.id, description: ability.description },
      'evidence:remove-by-action',
      payload,
      sourceBindings,
      { deferredPicks: true },
    );
  }
}

/**
 * engine-extension #1: 離場したキャラ自身の【現場リムーブ時】用 handler (rules/17)。
 * source = { player, uid, cardId } (リムーブされたキャラ), payload = { uid, cause }。
 * 離場後は collectCardsInPlay に出ないため source から virtual CardLocation を組み立て、
 * その def の trigger.hook='leave:to-remove' ability を scope/selfOnly/matcher/condition で
 * フィルタし effect を queue する (通常 triggered と同経路)。在場カードの反応は handleHook 側。
 */
function handleLeaveToRemoveSelf(state: GameState, payload: unknown, source: unknown): void {
  const s = source as { player?: Player; uid?: string; cardId?: string } | undefined;
  if (!s || !s.player || !s.uid || !s.cardId) return;
  // B10039: while the opposing side has an active contact leave self-trigger
  // restriction, suppress only the leaving character's own leave abilities.
  // The event still reaches handleHook below, so third-party observers remain.
  const leave = payload as { cause?: unknown } | undefined;
  const restrictionOwner: Player = s.player === 'self' ? 'opp' : 'self';
  if (leave?.cause === 'contact-ap' && readChar.restrictsOpponent(state, restrictionOwner, 'contactLeaveSelfTrigger')) return;
  const def = readDef.card(s.cardId);
  if (!def) return;
  const card: CardLocation = {
    player: s.player,
    uid: s.uid,
    cardId: s.cardId,
    area: 'scene', // 現場にいた → on-scene scope を通す (rules/17)
  };
  // M2後半 (2026-07-10, B01057 a2): host の faceUp setCards が持つ scope:'on-set-host' +
  // hook:'leave:to-remove' rider も走査する。emit 順序 = setCards→remove push → host splice → emit
  // のため in-play scan (handleHook) からは見えない — payload.removedChar (splice 前 snapshot、
  // setCards 保持) から entry 単位で def を引く (公式Q&A: 2枚セット→2つ発動)。裏向きは不発 (rules/16)。
  // source = host (uid/cardId/player) — rider の「このキャラ (host) がリムーブされたとき」座標系。
  const riderAbilities: AbilityDef[] = [];
  const removedChar = (payload as { removedChar?: { setCards?: { cardId: string; faceUp: boolean }[]; turnEffects?: Record<string, unknown>; keywordOverrides?: { disabledOriginal?: boolean } } } | undefined)?.removedChar;
  for (const entry of removedChar?.setCards ?? []) {
    if (entry.faceUp !== true) continue;
    const setDef = readDef.card(entry.cardId);
    for (const ab of (setDef?.abilities ?? []) as AbilityDef[]) {
      if (ab.type === 'triggered' && ab.scope === 'on-set-host' && ab.trigger?.hook === 'leave:to-remove') {
        riderAbilities.push(ab);
      }
    }
  }
  // engine additive A2 (2026-07-11, B07063 解禁の対): 自己 leave 型の付与済 triggered ability
  // (charGrantAbility で turnEffects.grantedAbilities に積まれた「このキャラ (被付与) がリムーブ
  // されたとき」) も走査する。離場後キャラは scene から消えているが payload.removedChar (splice 前
  // snapshot) が turnEffects を保持するため grantedAbilities を再取得できる。in-play scan (handleHook)
  // は grantedAbilities を合算するが離場カード自身は collectCardsInPlay に出ないため self-leave grant は
  // この経路でのみ拾える。裏向き/JSON descriptor そのまま (validate が function 不可を静的保証)。
  const grantedSelf = removedChar?.turnEffects?.['grantedAbilities'];
  const grantedSelfAbilities: AbilityDef[] = Array.isArray(grantedSelf)
    ? (grantedSelf as AbilityDef[]).filter(ab => ab.type === 'triggered' && ab.trigger?.hook === 'leave:to-remove')
    : [];
  const batchAuraAbilities = (payload as { triggeredAuraAbilities?: unknown } | undefined)?.triggeredAuraAbilities;
  const auraAbilities = Array.isArray(batchAuraAbilities)
    ? batchAuraAbilities as AbilityDef[]
    : removedChar
      ? effectiveTriggeredAuraAbilities(state, { player: card.player, uid: card.uid, cardId: card.cardId, char: removedChar as never })
      : [];
  const printedAbilities = readChar.originalAbilitiesDisabledOn(removedChar)
    ? []
    : (def.abilities as AbilityDef[]);
  for (const ability of [...printedAbilities, ...riderAbilities, ...grantedSelfAbilities, ...auraAbilities]) {
    if (ability.type !== 'triggered') continue;
    const trig = ability.trigger;
    if (!trig || trig.hook !== 'leave:to-remove') continue;
    // rider (on-set-host) は host 現場離場 = scope 成立済みなので area gate を通す (host 印字は従来どおり)。
    if (ability.scope !== 'on-set-host' && !scopeAllowsArea(ability.scope, card.area)) continue;
    if (trig.selfOnly && !selfOnlyMatches(card, payload, source)) continue;
    if (trig.matcher && !trig.matcher(payload, state)) continue;
    const baseCtx = {
      source: {
        cardId: card.cardId,
        uid: card.uid,
        abilityId: ability.id,
        player: card.player,
        area: card.area,
      },
      bindings: {},
      triggerPayload: payload,
    };
    if (trig.matcherCondition && !evalCond(state, trig.matcherCondition, baseCtx)) continue;
    if (ability.condition && !evalCond(state, ability.condition, baseCtx)) continue;
    if (!ability.effect) continue;

    const sourceBindings = (source as { bindings?: Record<string, unknown[]> } | undefined)?.bindings;
    event.queue(
      state,
      ability.effect,
      { player: card.player, uid: card.uid, cardId: card.cardId, abilityId: ability.id, description: ability.description },
      'leave:to-remove',
      payload,
      sourceBindings,
      { deferredPicks: true },
    );
  }
}

/**
 * engine mega-wave W3 (2026-07-03, r10): disguise:replaced (被置換側自己反応) の virtual-location
 * handler。handleLeaveToRemoveSelf と同構造 — 退場カード (fromCardId) は emit 時点で既にデッキ下 =
 * scene/collectCardsInPlay から見えないため、source={player,uid,cardId(=fromCardId)} から仮想
 * CardLocation (area:'scene' — 現場にいた、rules/17) を組み立てて def.abilities を直接走査する。
 * matcherCondition (disguiseReplacedByMatches 等) / ability.condition は evalCond で honor。
 * 既存カードは本 hook 未宣言 → 一致 0 件 = 挙動不変。
 */
function handleDisguiseReplacedSelf(state: GameState, payload: unknown, source: unknown): void {
  const s = source as { player?: Player; uid?: string; cardId?: string } | undefined;
  if (!s || !s.player || !s.uid || !s.cardId) return;
  const def = readDef.card(s.cardId);
  if (!def) return;
  const card: CardLocation = {
    player: s.player,
    uid: s.uid,
    cardId: s.cardId,
    area: 'scene', // 現場にいた → on-scene scope を通す (rules/17)
  };
  if (readChar.originalAbilitiesDisabled(state, card.uid)) return;
  for (const ability of def.abilities as AbilityDef[]) {
    if (ability.type !== 'triggered') continue;
    const trig = ability.trigger;
    if (!trig || trig.hook !== 'disguise:replaced') continue;
    if (!scopeAllowsArea(ability.scope, card.area)) continue;
    if (trig.selfOnly && !selfOnlyMatches(card, payload, source)) continue;
    if (trig.matcher && !trig.matcher(payload, state)) continue;
    const baseCtx = {
      source: {
        cardId: card.cardId,
        uid: card.uid,
        abilityId: ability.id,
        player: card.player,
        area: card.area,
      },
      bindings: {},
      triggerPayload: payload,
    };
    if (trig.matcherCondition && !evalCond(state, trig.matcherCondition, baseCtx)) continue;
    if (ability.condition && !evalCond(state, ability.condition, baseCtx)) continue;
    if (!ability.effect) continue;

    const sourceBindings = (source as { bindings?: Record<string, unknown[]> } | undefined)?.bindings;
    event.queue(
      state,
      ability.effect,
      { player: card.player, uid: card.uid, cardId: card.cardId, abilityId: ability.id, description: ability.description },
      'disguise:replaced',
      payload,
      sourceBindings,
      { deferredPicks: true },
    );
  }
}

/**
 * engine additive A2 (2026-07-11, B02084 安室の愛車): setcard:leave の **セットカード自身** 用
 * virtual-location handler。handleLeaveToRemoveSelf / handleDisguiseReplacedSelf と同構造。
 * setcard:leave payload = { player, hostUid, hostCardId, setCardId, faceUp, cause }。離場した
 * セットカードは collectCardsInPlay に出ない → payload.setCardId から def を引き、scope:'on-set-self' +
 * hook:'setcard:leave' の triggered を発火。faceUp:false は情報を持たない (rules/16 / B02084 Q&A) → 不発。
 * source uid は自己参照しない ability 用に host uid を借りる (line2 は remove-area pick で自 uid 不要)。
 */
function handleOnSetSelfPhaseEndStart(state: GameState, payload: unknown, source: unknown): void {
  charMutator.ensureSetCardInstanceIds(state);
  for (const player of ['self', 'opp'] as const) {
    for (const host of state.players[player].scene) {
      for (const setCard of host.setCards) {
        if (!setCard.faceUp) continue;
        const def = readDef.card(setCard.cardId);
        if (!def) continue;
        for (const ability of def.abilities as AbilityDef[]) {
          if (ability.type !== 'triggered' || ability.scope !== 'on-set-self') continue;
          const trigger = ability.trigger;
          if (!trigger || trigger.hook !== 'phase:end:start') continue;
          if (trigger.selfOnly && !selfOnlyMatches({ player, uid: host.uid, cardId: setCard.cardId, area: 'scene' }, payload, source)) continue;
          if (trigger.matcher && !trigger.matcher(payload, state)) continue;
          const triggerPayload = { ...(payload as Record<string, unknown>), setCardInstanceId: setCard.instanceId };
          const ctx: EffectCtx = {
            source: { cardId: setCard.cardId, uid: host.uid, abilityId: ability.id, player, area: 'scene' },
            bindings: {}, triggerPayload,
          };
          if (trigger.matcherCondition && !evalCond(state, trigger.matcherCondition, ctx)) continue;
          if (ability.condition && !evalCond(state, ability.condition, ctx)) continue;
          if (!ability.effect) continue;
          event.queue(
            state,
            ability.effect,
            { player, uid: host.uid, cardId: setCard.cardId, abilityId: ability.id, description: ability.description },
            'phase:end:start',
            triggerPayload,
            undefined,
            { deferredPicks: true },
          );
        }
      }
    }
  }
}

function handleSetcardLeaveSelf(state: GameState, payload: unknown, _source: unknown): void {
  const pl = payload as
    | { player?: Player; setCardId?: string; faceUp?: boolean; hostUid?: string }
    | undefined;
  if (!pl || !pl.player || !pl.setCardId) return;
  if (pl.faceUp !== true) return; // 裏向きセットは情報を持たない (rules/16, B02084 Q&A)
  const def = readDef.card(pl.setCardId);
  if (!def) return;
  const card: CardLocation = {
    player: pl.player,
    uid: pl.hostUid ?? pl.setCardId, // 合成 uid (on-set-self ability は自己参照しない)
    cardId: pl.setCardId,
    area: 'scene', // scope gate は on-set-self 直判定で bypass — area 値は非依存
  };
  for (const ability of def.abilities as AbilityDef[]) {
    if (ability.type !== 'triggered') continue;
    const trig = ability.trigger;
    if (!trig || trig.hook !== 'setcard:leave') continue;
    if (ability.scope !== 'on-set-self') continue;
    if (trig.matcher && !trig.matcher(payload, state)) continue;
    const baseCtx = {
      source: {
        cardId: card.cardId,
        uid: card.uid,
        abilityId: ability.id,
        player: card.player,
        area: card.area,
      },
      bindings: {},
      triggerPayload: payload,
    };
    if (trig.matcherCondition && !evalCond(state, trig.matcherCondition, baseCtx)) continue;
    if (ability.condition && !evalCond(state, ability.condition, baseCtx)) continue;
    if (!ability.effect) continue;

    event.queue(
      state,
      ability.effect,
      { player: card.player, uid: card.uid, cardId: card.cardId, abilityId: ability.id, description: ability.description },
      'setcard:leave',
      payload,
      undefined,
      { deferredPicks: true },
    );
  }
}
