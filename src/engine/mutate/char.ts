// engine.mutate.char — キャラ修正プリミティブ
// rules: 03-field-areas.md (状態), 09-cutin-disguise.md (変装引継ぎ), 13-keywords.md, 19-special-rules.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import { stackedCardCount, type AbilityDef, type GameState, type StackedCardEntry } from '@/engine/types';
import { event } from '../event/index.js'; // engine拡張 wave#2 cluster9: removeOneSetCard で setcard:leave emit
import { def as readDef } from '../read/def.js';
import { advanceIndexedZoneEpoch } from '../state/indexed-zone-epoch.js';
import { evalCond } from '../cond/eval.js';
import { matchOneFilter } from '../target/candidates.js';
import { pushPendingSetCardReplacementSide, type PendingSetCardReplacementSide } from '../effect/pending-state.js';

type Player = 'self' | 'opp';
// engine拡張 wave#2 cluster3 (2026-06-13): 'action' = 「アクション終了時まで」(rules/08 §6-7)。
// '_action' suffix キーは clearTurnEffects('action') + turn-end safety net の 2 経路で清掃される。
// ⚠ grantKeyword には 'action' を渡さないこと (grantedKeywords は suffix 無し格納で action 清掃対象外)。
type ModScope = 'turn' | 'contact' | 'permanent' | 'action';

/** uid でキャラを探す */
function findChar(s: GameState, uid: string) {
  for (const p of ['self', 'opp'] as const) {
    const c = s.players[p].scene.find(c => c.uid === uid);
    if (c) return { char: c, player: p as Player };
    const slot = s.players[p].partnerAreaMR;
    if (slot && (slot.uid === uid || uid === `partnerMR:${p}`)) return { char: slot, player: p as Player };
  }
  return null;
}

/**
 * AP 修正 (rules/19 下限なし)
 * - scope='permanent': turnEffects['apMod_permanent'] に積む
 * - scope='turn': turnEffects['apMod_turn'] に積む
 * - scope='contact': turnEffects['apMod_contact'] に積む
 */
function modifyAP(s: GameState, uid: string, delta: number, scope: ModScope): void {
  const turnEffects = findActorTurnEffects(s, uid);
  if (!turnEffects) return;
  const key = `apMod_${scope}`;
  const current = (turnEffects[key] as number | undefined) ?? 0;
  turnEffects[key] = current + delta;
}

/**
 * LP 修正 (rules/19 下限なし, 11 LP≤0で推理証拠0枚)
 * - scope='permanent': turnEffects['lpMod_permanent'] に積む
 * - scope='turn': turnEffects['lpMod_turn'] に積む
 * - scope='contact': turnEffects['lpMod_contact'] に積む
 */
function modifyLP(s: GameState, uid: string, delta: number, scope: ModScope): void {
  const found = findChar(s, uid);
  if (!found) return;
  const key = `lpMod_${scope}`;
  const current = (found.char.turnEffects[key] as number | undefined) ?? 0;
  found.char.turnEffects[key] = current + delta;
}

/**
 * レベル修正 (rules/19 下限なし) — engine-extension #2 (2026-06-05)
 * - scope='permanent': turnEffects['lvlMod_permanent'] に積む
 * - scope='turn': turnEffects['lvlMod_turn'] に積む
 * - scope='contact': turnEffects['lvlMod_contact'] に積む
 * 読みは read.char.level (3 scope 合算) と target/candidates.ts (filter level 評価) に
 * 反映済 (modifyAP/LP と同 pattern)。
 */
function modifyLevel(s: GameState, uid: string, delta: number, scope: ModScope): void {
  const found = findChar(s, uid);
  if (!found) return;
  const key = `lvlMod_${scope}`;
  const current = (found.char.turnEffects[key] as number | undefined) ?? 0;
  found.char.turnEffects[key] = current + delta;
}

/** apOverride を直接設定 (rules/19 元のLP/APを0にする等) */
function setOverrideAP(s: GameState, uid: string, val: number | null): void {
  const found = findChar(s, uid);
  if (!found) return;
  found.char.apOverride = val;
}

/** engine defer-unlock mini-wave (2026-07-09): 「ターン終了時まで元のAPを X にする」(B05022)。
 * turnEffects['apOverride_turn'] に積む (apMod_turn と同 suffix 規約)。read.char.ap が base 差替で
 * honor (rules/19 QA: 能力/効果による +/- 修整は残る)。null = 解除。clearTurnEffects('turn') で失効。 */
function setOverrideAPTurn(s: GameState, uid: string, val: number | null): void {
  const found = findChar(s, uid);
  if (!found) return;
  if (val === null) delete found.char.turnEffects['apOverride_turn'];
  else found.char.turnEffects['apOverride_turn'] = val;
}

/** lpOverride を直接設定 */
function setOverrideLP(s: GameState, uid: string, val: number | null): void {
  const found = findChar(s, uid);
  if (!found) return;
  found.char.lpOverride = val;
}

/** engine mini-wave (2026-07-10): 「ターン終了時まで元のLPを X にする」(B01045/B01054/B09011)。
 * setOverrideAPTurn の完全対称。read.char.lp が base 差替で honor (rules/19 QA: 修整±は残る)。
 * null = 解除。clearTurnEffects('turn') で失効。 */
function setOverrideLPTurn(s: GameState, uid: string, val: number | null): void {
  const found = findChar(s, uid);
  if (!found) return;
  if (val === null) delete found.char.turnEffects['lpOverride_turn'];
  else found.char.turnEffects['lpOverride_turn'] = val;
}

/**
 * キーワード付与 (rules/13)
 * - scope='permanent': keywordOverrides.granted に追加 (重複なし)
 * - scope='turn': turnEffects['grantedKeywords'] に追加
 */
function grantKeyword(s: GameState, uid: string, kw: string, scope: ModScope = 'permanent'): void {
  const found = findChar(s, uid);
  if (!found) return;

  if (scope === 'permanent') {
    const granted = found.char.keywordOverrides.granted;
    if (!granted.includes(kw)) {
      granted.push(kw);
    }
  } else {
    // turn/contact: turnEffects['grantedKeywords'] に積む
    const key = 'grantedKeywords';
    const current = (found.char.turnEffects[key] as string[] | undefined) ?? [];
    if (!current.includes(kw)) {
      current.push(kw);
    }
    found.char.turnEffects[key] = current;
  }
}

/** キーワードを取り除く (granted から削除) */
function revokeKeyword(s: GameState, uid: string, kw: string): void {
  const found = findChar(s, uid);
  if (!found) return;
  const granted = found.char.keywordOverrides.granted;
  const idx = granted.indexOf(kw);
  if (idx !== -1) {
    granted.splice(idx, 1);
  }
}

/**
 * キーワードを「ターン終了時まで失う」(engine additive 2026-06-29、B06068 京極真)。
 * permanent な revokeKeyword (granted-splice) と異なり、印字 (CardDef.keywords) / continuous 由来も含めて
 * 失わせるため turnEffects['revokedKeywords'] へ積む (read.char.keywords が最終集合から減算)。
 * grantedKeywords (付与) の鏡像。clearTurnEffects('turn') で清掃される (rules/19 §「失う」効果はターン scope)。
 */
function revokeKeywordTurn(s: GameState, uid: string, kw: string): void {
  const found = findChar(s, uid);
  if (!found) return;
  const te = found.char.turnEffects;
  const cur = (te['revokedKeywords'] as string[] | undefined) ?? [];
  if (!cur.includes(kw)) cur.push(kw);
  te['revokedKeywords'] = cur;
}

/**
 * 特徴 (trait) の付与 / 剥奪 (engine A1 wave 2026-07-11、B05101 毛利小五郎)。
 * charGrantKeyword / charRevokeKeyword の trait 版。特徴は keywordOverrides のような専用 char field を
 * 持たないため turnEffects へ積む (GameState 形状不変 = 既存カード byte 互換)。
 * - scope='permanent' (既定): 'grantedTraits_permanent' / 'revokedTraits_permanent' — clearTurnEffects('turn')
 *   の削除リストに **無い** ため turn 終了で失効しない (「ターン終了時に切れない」B05101)。'_permanent' suffix は
 *   apMod_permanent 等と同じ生存 key。変装 (disguiseInto は cardId のみ差替) でも turnEffects 保持ゆえ
 *   自動引継ぎ (rules/23 B05101 Q&A「入れ替わったキャラにも引き継がれる」)。
 * - scope='turn': 'grantedTraits_turn' / 'revokedTraits_turn' — clearTurnEffects('turn') で清掃 (下参照)。
 * read.char.traits が printed ∪ granted − revoked を集約する。既存カードは未宣言 → [] (回帰0)。
 */
function grantTrait(s: GameState, uid: string, trait: string, scope: 'permanent' | 'turn' = 'permanent'): void {
  const found = findChar(s, uid);
  if (!found) return;
  const key = scope === 'turn' ? 'grantedTraits_turn' : 'grantedTraits_permanent';
  const cur = (found.char.turnEffects[key] as string[] | undefined) ?? [];
  if (!cur.includes(trait)) cur.push(trait);
  found.char.turnEffects[key] = cur;
}

/** 特徴を失う (grantTrait の鏡像)。printed / granted 双方を read.char.traits が最終集合から減算する。 */
function revokeTrait(s: GameState, uid: string, trait: string, scope: 'permanent' | 'turn' = 'permanent'): void {
  const found = findChar(s, uid);
  if (!found) return;
  const key = scope === 'turn' ? 'revokedTraits_turn' : 'revokedTraits_permanent';
  const cur = (found.char.turnEffects[key] as string[] | undefined) ?? [];
  if (!cur.includes(trait)) cur.push(trait);
  found.char.turnEffects[key] = cur;
}

/** 元の能力を無効にする (rules/19) MR能力は無効にならない */
function disableOriginalAbilities(s: GameState, uid: string, scope: 'turn' | 'permanent' = 'permanent'): void {
  const found = findChar(s, uid);
  if (!found) return;
  if (scope === 'turn') {
    found.char.turnEffects['originalAbilitiesDisabled_turn'] = true;
  } else {
    found.char.keywordOverrides.disabledOriginal = true;
  }
}

/** turnEffects に任意のキー/値を設定 */
function setTurnEffect(s: GameState, uid: string, key: string, val: unknown): void {
  const found = findChar(s, uid);
  if (!found) return;
  // W6 step4 (2026-07-04): defensive init — 型上 turnEffects は必須だが、古い test fixture 等が
  // raw object を scene に push するケースで undefined になりうる (triggered.ts の per-char 疾風
  // 記録が全 enter で本関数を通るようになったため顕在化)。実ゲーム経路 (mutate.scene.enter) は常に初期化済。
  found.char.turnEffects ??= { contactImmune: false, removeOnTurnEnd: false };
  found.char.turnEffects[key] = val;
}

/**
 * mega-wave W6 step6 (2026-07-04, r79/B08014): 「このターン中に自分のMRの能力によって選ばれた」標識。
 * resolver.ts の atom dispatch 前 guard (_mrSelectCharUids) が呼ぶ。ownerMustBe = MR 能力の所有側 —
 * 「**自分の**MRの能力」なので選ばれたキャラが MR と同じ side の現場に居る場合のみ true を書く
 * (相手の MR に選ばれても B08014 の条件は満たさない)。不在/相手側 uid は defensive no-op。
 * 清掃 = clearTurnEffects('turn')。
 */
function tagSelectedByOwnMr(s: GameState, uid: string, ownerMustBe: 'self' | 'opp'): void {
  const c = s.players[ownerMustBe].scene.find(x => x.uid === uid);
  if (!c) return;
  c.turnEffects['selectedByOwnMr'] = true;
}

/**
 * ターン終了時の turnEffects クリーンアップ
 * scope='turn': turn 系エフェクト (apMod_turn, lpMod_turn, lvlMod_turn,
 *   apMod_contact, lpMod_contact, lvlMod_contact, grantedKeywords) を削除
 */
function clearTurnEffects(s: GameState, uid: string, scope: 'turn' | 'opp-turn' | 'action' | 'contact'): void {
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p: Player = uid === 'partner:self' ? 'self' : 'opp';
    const te = s.players[p].partner.turnEffects;
    if (!te) return;
    if (scope === 'turn') {
      delete te['apMod_turn'];
      delete te['apMod_contact'];
      for (const key of Object.keys(te)) {
        if (key.endsWith('_action')) delete te[key];
      }
    } else if (scope === 'action') {
      for (const key of Object.keys(te)) {
        if (key.endsWith('_action')) delete te[key];
      }
    } else if (scope === 'contact') {
      delete te['apMod_contact'];
    }
    return;
  }
  const found = findChar(s, uid);
  if (!found) return;
  const te = found.char.turnEffects;
  if (scope === 'turn') {
    delete te['apMod_turn'];
    delete te['lpMod_turn'];
    delete te['apMod_contact'];
    delete te['lpMod_contact'];
    // BUG-119: charModifyLevel (engine-extension #2) が追加した lvlMod_turn / lvlMod_contact が
    // ここで未削除だったため scope:'turn' のレベル修正 (「ターン終了時までレベル±N」) が永続化していた。
    // ap/lp の turn/contact と対称に turn 終了で解除する (read.char.level / filter level に波及していた)。
    delete te['lvlMod_turn'];
    delete te['lvlMod_contact'];
    // engine defer-unlock mini-wave (2026-07-09): 「ターン終了時まで元のAPを0」(B05022、BUG-119 教訓:
    // 新 turn キーは必ずここに列挙)。
    delete te['apOverride_turn'];
    delete te['lpOverride_turn'];
    delete te['grantedKeywords'];
    // engine additive (2026-06-29): revokeKeywordTurn が積んだ「ターン終了時まで失う」キーワード (B06068)。
    delete te['revokedKeywords'];
    // engine A1 wave (2026-07-11): scope:'turn' の trait 付与/剥奪 (grantTrait/revokeTrait)。
    // '_permanent' 版は「ターン終了時に切れない」ため **ここでは消さない** (B05101、grantedTraits_permanent /
    // revokedTraits_permanent は apMod_permanent と同じ生存 key)。BUG-119 教訓: 新 turn キーは必ずここに列挙。
    delete te['grantedTraits_turn'];
    delete te['revokedTraits_turn'];
    // Task D E4 (2026-06-12): textual-ability token / granted ability の清掃 (BUG-119 教訓:
    // 新 turn キーは必ずここに列挙)。typed flag は delete でなく false リセット (型整合)。
    delete te['actionTargetsActive'];
    delete te['sleepGuard'];
    delete te['mustGuard'];
    delete te['toDeckBottomOnTurnEnd'];
    delete te['wasGuardedThisTurn'];
    delete te['grantedAbilities'];
    // engine additive wave-7 (2026-07-02, P17): 「このターン中にアクション[キャラ]した」flag
    // (declare が立て、TargetFilter.actedCharThisTurn が honor)。ターン終了で失効 (B08049)。
    delete te['actedCharThisTurn'];
    delete te['removedOpponentByContactThisTurn'];
    delete te['enteredByCutinEffectThisTurn'];
    // mega-wave W6 step4 (2026-07-04, r58/B09090): waive 消費痕跡。
    delete te['shippuWaived'];
    // BUG-170 水平展開: shippuFiredCharThisTurn は **ここでは削除しない** — B09070 a3
    // 「ターン終了時、このターン中に【疾風】を発動していたすべてのキャラをアクティブにする」が
    // phase:end:start queue の解決時 (endTurn 清掃の後) に本 flag を読む。selectedByOwnMr と
    // 同じくターン開始境界 (flow/turn.ts startTurn) で清掃する。
    // mega-wave W6 step6 (2026-07-04, r79/B08014) → BUG-170 (同日修正): 「このターン中に自分の
    // MRの能力によって選ばれた」標識は **ここでは削除しない**。endTurn は phase:end:start の
    // trigger を queue した直後に本清掃を同期実行するが、queue された granted ability の
    // conditional は caller の runAllUntilEmpty (= 清掃の後) で解決される (rules/25 解決時参照)
    // ため、ここで消すと B08014「選ばれていなかった場合」が常に成立してしまう。
    // 清掃は flow/turn.ts startTurn (次ターン開始境界) が行う (noAutoActivateBySourceUid と同様の
    // 非対称清掃 key)。
    // engine additive wave-8 (2026-07-02, P15): 「このキャラは推理できない。」(B09072 a2、ターン終了時まで)
    // 付与を解除。canReason が本キーを読む (reason-ban)。actedCharThisTurn 同様 boolean flag key。
    delete te['cannotReason'];
    // mega-wave W6 step2 (2026-07-04, PR105): カード名書き換え「ターン終了時まで」の清掃
    // (read.char.names が完全置換 read、BUG-119 教訓: 新 turn キーは必ずここに列挙)。
    // ⚠ row 74 の noAutoActivateBySourceUid (step5) は **意図的にここへ追加しない** —
    // 「次の自分のオートフェイズでアクティブにならない」はターンを跨いで持続する lock のため
    // turn-end 清掃すると効果が消える (消費側 auto-phase が読み捨て時に自前で解除する設計)。
    delete te['nameOverride'];
    delete te['originalAbilitiesDisabled_turn'];
    te.contactImmune = false;
    te.removeOnTurnEnd = false;
    // _action suffix もターン終了で確実に切れる (アクション終了清掃の safety net)
    for (const key of Object.keys(te)) {
      if (key.endsWith('_action')) delete te[key];
    }
  } else if (scope === 'opp-turn') {
    // BUG-101: D11005 挑発 (mustBeTargeted) は「相手のターン終了時まで」。
    // endTurn(p) が相手 (非p=設定者) scene を清掃する経路から呼ばれる。
    delete te['mustBeTargeted'];
    // Task D E4: '_oppTurn' suffix の token (sleepGuard_oppTurn 等、B09054) も同タイミングで切れる
    for (const key of Object.keys(te)) {
      if (key.endsWith('_oppTurn')) delete te[key];
    }
  } else if (scope === 'action') {
    // Task D E4 (2026-06-12): rules/08 §6-7 — アクション終了時に切れる効果 ('_action' suffix)。
    // contact-end→action-end 遷移と abortIfMissing の両経路から呼ばれる
    // (同一ターン 2 回目のアクションへ stale な contactImmune_action 等を持ち越さない)。
    for (const key of Object.keys(te)) {
      if (key.endsWith('_action')) delete te[key];
    }
  } else if (scope === 'contact') {
    // BUG-143: rules/08 §6 — カットインによる効果 (apMod_contact / lpMod_contact / lvlMod_contact) は
    // コンタクト終了時に切れる。state-machine の contact-end 遷移から呼ばれ、同一ターン 2 回目以降の
    // コンタクトへ stale な修正を持ち越さない。turn-end safety net (scope:'turn') は二重保険で残置。
    delete te['apMod_contact'];
    delete te['lpMod_contact'];
    delete te['lvlMod_contact'];
  }
}

/**
 * Task D E4 (2026-06-12): triggered ability の動的付与 (charGrantAbility verb の primitive)。
 * JSON descriptor を turnEffects.grantedAbilities[] に積む。走査は listeners/triggered.ts
 * handleHook が def.abilities と合算して行い、清掃は clearTurnEffects('turn')。
 * rules: 15 (付与元が離場しても効果は有効), 19 (元の能力無効は外部付与に及ばない)
 */
function grantAbility(s: GameState, uid: string, ability: object): void {
  const found = findChar(s, uid);
  if (!found) return;
  const te = found.char.turnEffects;
  if (!Array.isArray(te['grantedAbilities'])) {
    te['grantedAbilities'] = [];
  }
  (te['grantedAbilities'] as object[]).push(ability);
}

/**
 * キャラにカードをセット (rules/16 裏向きセット対応)
 * faceUp=false で裏向きセット (リムーブ時に表向きにしてリムーブエリアへ)
 */
/** Backfill legacy entries and allocate per-state IDs so hydration cannot collide. */
function ensureSetCardInstanceIds(s: GameState): void {
  const used = new Set<string>();
  let seq = s.setCardInstanceSeq ?? 1;
  for (const player of ['self', 'opp'] as const) {
    for (const char of s.players[player].scene) {
      for (const entry of char.setCards) {
        const id = entry.instanceId;
        if (typeof id !== 'string' || id.length === 0 || used.has(id)) {
          entry.instanceId = undefined;
          continue;
        }
        used.add(id);
        const match = /^set:(\d+)$/.exec(id);
        if (match) seq = Math.max(seq, Number(match[1]) + 1);
      }
    }
  }
  for (const player of ['self', 'opp'] as const) {
    for (const char of s.players[player].scene) {
      for (const entry of char.setCards) {
        if (entry.instanceId) continue;
        let id = `set:${seq++}`;
        while (used.has(id)) id = `set:${seq++}`;
        entry.instanceId = id;
        used.add(id);
      }
    }
  }
  s.setCardInstanceSeq = seq;
}

function setCard(s: GameState, uid: string, cardId: string, faceUp: boolean): void {
  ensureSetCardInstanceIds(s);
  const found = findChar(s, uid);
  if (!found) return;
  const { char, player } = found;
  const instanceId = `set:${s.setCardInstanceSeq!++}`;
  char.setCards.push({ cardId, faceUp, instanceId });
  // engine additive (2026-06-29): カード1枚が host にセットされた → setcard:enter emit (setcard:leave の対)。
  // push 後 (host は在場) に emit するため listener (host 自身 selfOnly) は collectCardsInPlay で捕捉される。
  // payload/source は setcard:leave と同形。cause:'effect' (本関数は atomCharSetCard 経由のみ)。
  // 既存カードは誰も setcard:enter を購読しない (setCardMatches/該当 hook を持つ印字 ability は 0 件) ため、
  // emit しても handleHook が一致 ability を見つけず pendingEffects に何も積まない = 挙動不変 (smoke byte-identical)。
  event.emit(
    s,
    'setcard:enter',
    { player, hostUid: char.uid, hostCardId: char.cardId, setCardId: cardId, setCardInstanceId: instanceId, faceUp, cause: 'effect' },
    { player, uid: char.uid, cardId: char.cardId },
  );
}

/** キャラの下に重ねる (stackedCards 加算) (rules/16) */
function stackCard(s: GameState, uid: string, count: number, cardIds?: string[]): void {
  const found = findChar(s, uid);
  if (!found) return;
  const legacyCount = stackedCardCount(found.char.stackedCards);
  const existing = Array.isArray(found.char.stackedCards)
    ? found.char.stackedCards
    : Array.from({ length: legacyCount }, (_, i) => ({ cardId: 'back-card', instanceId: `legacy:${uid}:${i}` }));
  const usedInstanceIds = new Set(existing.map(entry => entry.instanceId));
  const additions = Array.from({ length: count }, (_, i) => {
    let suffix = legacyCount + i;
    let instanceId = `stack:${uid}:${suffix}`;
    while (usedInstanceIds.has(instanceId)) instanceId = `stack:${uid}:${++suffix}`;
    usedInstanceIds.add(instanceId);
    return { cardId: cardIds?.[i] ?? 'back-card', instanceId };
  });
  found.char.stackedCards = [...existing, ...additions];
}

type SetCardReplacementEntry = GameState['players']['self']['scene'][number]['setCards'][number];

function replacementCandidates(s: GameState, player: Player, fromUid: string, ability: AbilityDef): { uid: string; cardId: string }[] {
  const replacement = ability.setCardRemovalReplacement;
  if (!replacement) return [];
  return s.players[player].scene
    .filter((char) => char.uid !== fromUid)
    .filter((char) => matchOneFilter(s, char.cardId, replacement.filter, char, { kind: 'char', uid: char.uid, cardId: char.cardId, player }))
    .map((char) => ({ uid: char.uid, cardId: char.cardId }));
}

function eligibleSetCardReplacement(s: GameState, player: Player, fromUid: string, entry: SetCardReplacementEntry): { ability: AbilityDef; candidates: { uid: string; cardId: string }[] } | null {
  if (!entry.faceUp) return null;
  const card = readDef.card(entry.cardId);
  if (!card) return null;
  for (const ability of card.abilities as AbilityDef[]) {
    if (ability.type !== 'triggered' || ability.scope !== 'on-set-self' || ability.trigger?.hook !== 'setcard:leave' || !ability.setCardRemovalReplacement) continue;
    const used = entry.replacementUseCounts?.[ability.id];
    if (ability.limit?.kind === 'turn' && used?.turn === s.turn.number && used.count >= ability.limit.n) continue;
    const ctx = { source: { cardId: entry.cardId, uid: fromUid, abilityId: ability.id, player, area: 'scene' as const }, bindings: {} };
    if (ability.condition && !evalCond(s, ability.condition, ctx)) continue;
    const candidates = replacementCandidates(s, player, fromUid, ability);
    if (candidates.length > 0) return { ability, candidates };
  }
  return null;
}

/** scene / partner actor 共通の scoped effect storage。 */
function findActorTurnEffects(s: GameState, uid: string): Record<string, unknown> | null {
  if (uid === 'partner:self' || uid === 'partner:opp') {
    const p: Player = uid === 'partner:self' ? 'self' : 'opp';
    return (s.players[p].partner.turnEffects ??= {});
  }
  const found = findChar(s, uid);
  return found?.char.turnEffects ?? null;
}

function markSetCardReplacementUsed(s: GameState, entry: SetCardReplacementEntry, abilityId: string): void {
  const counts = (entry.replacementUseCounts ??= {});
  const previous = counts[abilityId];
  counts[abilityId] = { turn: s.turn.number, count: previous?.turn === s.turn.number ? previous.count + 1 : 1 };
}

function moveSetCardEntry(s: GameState, fromUid: string, toUid: string, instanceId: string, abilityId: string): boolean {
  if (fromUid === toUid) return false;
  const from = findChar(s, fromUid);
  const to = findChar(s, toUid);
  if (!from || !to || from.player !== to.player) return false;
  const idx = from.char.setCards.findIndex((entry) => entry.instanceId === instanceId);
  if (idx < 0) return false;
  const [entry] = from.char.setCards.splice(idx, 1);
  if (!entry) return false;
  markSetCardReplacementUsed(s, entry, abilityId);
  to.char.setCards.push(entry);
  event.emit(s, 'setcard:enter', { player: from.player, hostUid: to.char.uid, hostCardId: to.char.cardId, setCardId: entry.cardId, setCardInstanceId: entry.instanceId, faceUp: entry.faceUp, cause: 'replacement' }, { player: from.player, uid: to.char.uid, cardId: to.char.cardId });
  return true;
}

function maybeReplaceSetCardRemoval(s: GameState, player: Player, fromUid: string, entry: SetCardReplacementEntry, allowHuman = true): boolean {
  const eligible = eligibleSetCardReplacement(s, player, fromUid, entry);
  if (!eligible || !entry.instanceId) return false;
  const human = (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide ?? null;
  if (human === player && allowHuman) {
    pushPendingSetCardReplacementSide({ player, fromUid, setCardInstanceId: entry.instanceId, candidates: eligible.candidates, source: { cardId: entry.cardId, abilityId: eligible.ability.id, uid: fromUid } });
    return true;
  }
  return moveSetCardEntry(s, fromUid, eligible.candidates[0]!.uid, entry.instanceId, eligible.ability.id);
}

/** Read-only batch admission check: would this host open a human replacement? */
function wouldDeferSetCardReplacementForHostLeave(s: GameState, uid: string): boolean {
  const found = findChar(s, uid);
  if (!found) return false;
  const human = (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide ?? null;
  if (human !== found.player) return false;
  return found.char.setCards.some((entry) => eligibleSetCardReplacement(s, found.player, uid, entry) !== null);
}

/** Suspend a human-owned replacement before the host itself is removed. */
function deferSetCardReplacementForHostLeave(
  s: GameState,
  uid: string,
  resume: NonNullable<PendingSetCardReplacementSide['resume']>,
  excludedInstanceIds: readonly string[] = [],
): boolean {
  ensureSetCardInstanceIds(s);
  const found = findChar(s, uid);
  if (!found) return false;
  const human = (globalThis as { __humanPlayerSide?: Player | null }).__humanPlayerSide ?? null;
  if (human !== found.player) return false;
  for (const entry of found.char.setCards) {
    if (entry.instanceId && excludedInstanceIds.includes(entry.instanceId)) continue;
    const eligible = eligibleSetCardReplacement(s, found.player, uid, entry);
    if (!eligible || !entry.instanceId) continue;
    pushPendingSetCardReplacementSide({ player: found.player, fromUid: uid, setCardInstanceId: entry.instanceId, candidates: eligible.candidates, source: { cardId: entry.cardId, abilityId: eligible.ability.id, uid }, resume });
    return true;
  }
  return false;
}

/** AI-safe preflight for a host that is about to leave the scene. */
function replaceEligibleSetCardsBeforeHostLeaves(s: GameState, uid: string): void {
  ensureSetCardInstanceIds(s);
  const found = findChar(s, uid);
  if (!found) return;
  for (const instanceId of found.char.setCards.map((entry) => entry.instanceId).filter((id): id is string => typeof id === 'string')) {
    const current = found.char.setCards.find((entry) => entry.instanceId === instanceId);
    if (current) maybeReplaceSetCardRemoval(s, found.player, uid, current, false);
  }
}

/** Resolve or decline an optional pre-removal set-card replacement. */
function canResolveSetCardRemovalReplacement(
  s: GameState,
  pending: PendingSetCardReplacementSide,
  toUid: string | null,
): boolean {
  const found = findChar(s, pending.fromUid);
  if (!found
    || found.player !== pending.player
    || pending.source.uid !== pending.fromUid) return false;
  const entry = found.char.setCards.find((candidate) =>
    candidate.instanceId === pending.setCardInstanceId
    && candidate.cardId === pending.source.cardId);
  if (!entry) return false;
  const eligible = eligibleSetCardReplacement(s, found.player, pending.fromUid, entry);
  if (!eligible || eligible.ability.id !== pending.source.abilityId) return false;
  if (eligible.candidates.length !== pending.candidates.length) return false;
  if (eligible.candidates.some((candidate, index) => {
    const supplied = pending.candidates[index];
    return supplied?.uid !== candidate.uid || supplied.cardId !== candidate.cardId;
  })) return false;
  return toUid === null || eligible.candidates.some((candidate) => candidate.uid === toUid);
}

function resolveSetCardRemovalReplacement(s: GameState, pending: PendingSetCardReplacementSide, toUid: string | null): boolean {
  if (!canResolveSetCardRemovalReplacement(s, pending, toUid)) return false;
  if (toUid !== null) {
    return moveSetCardEntry(s, pending.fromUid, toUid, pending.setCardInstanceId, pending.source.abilityId);
  }
  return removeOneSetCard(s, pending.fromUid, {
    setCardInstanceId: pending.setCardInstanceId,
    skipReplacement: true,
  }) !== null;
}

/** Remove exact occurrences from one host stack, preserving duplicate card IDs. */
function removeStackedCards(s: GameState, uid: string, count: number, instanceIds?: string[]): StackedCardEntry[] {
  const found = findChar(s, uid);
  if (!found || count < 1 || stackedCardCount(found.char.stackedCards) < count) return [];
  if (Array.isArray(found.char.stackedCards)) {
    const stackEntries = found.char.stackedCards;
    if (instanceIds !== undefined) {
      if (instanceIds.length !== count || new Set(instanceIds).size !== count) return [];
      const selected = instanceIds.map(id => stackEntries.find(entry => entry.instanceId === id));
      if (selected.every((entry): entry is StackedCardEntry => entry !== undefined)) {
        const selectedIds = new Set(instanceIds);
        found.char.stackedCards = stackEntries.filter(entry => !selectedIds.has(entry.instanceId));
        return stackEntries.filter(entry => selectedIds.has(entry.instanceId));
      }
      return [];
    }
    return found.char.stackedCards.splice(0, count);
  }
  found.char.stackedCards -= count;
  return Array.from({ length: count }, (_, i) => ({ cardId: 'back-card', instanceId: `legacy:${uid}:${i}` }));
}

/** Stable stacked-card candidates for a picker. Legacy count-only stacks get deterministic synthetic IDs. */
function stackedCardEntries(s: GameState, uid: string): StackedCardEntry[] {
  const found = findChar(s, uid);
  if (!found) return [];
  if (Array.isArray(found.char.stackedCards)) return found.char.stackedCards.map((entry) => ({ ...entry }));
  return Array.from({ length: found.char.stackedCards }, (_, i) => ({ cardId: 'back-card', instanceId: `legacy:${uid}:${i}` }));
}

/** Upgrade the legacy count-only representation before an identity-aware operation. */
function ensureStackedCardEntries(s: GameState, uid: string): StackedCardEntry[] | null {
  const found = findChar(s, uid);
  if (!found) return null;
  if (!Array.isArray(found.char.stackedCards)) {
    found.char.stackedCards = Array.from(
      { length: found.char.stackedCards },
      (_, i) => ({ cardId: 'back-card', instanceId: `legacy:${uid}:${i}` }),
    );
  }
  return found.char.stackedCards;
}

/** Validates a player-provided stack selection without mutating the host. */
function selectStackedCardEntries(s: GameState, uid: string, instanceIds: string[], min: number, max: number): StackedCardEntry[] | null {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min) return null;
  if (instanceIds.length < min || instanceIds.length > max || new Set(instanceIds).size !== instanceIds.length) return null;
  const candidates = stackedCardEntries(s, uid);
  const byId = new Map(candidates.map((entry) => [entry.instanceId, entry]));
  const selected = instanceIds.map((id) => byId.get(id));
  return selected.every((entry): entry is StackedCardEntry => entry !== undefined) ? selected : null;
}

/** Move exact stacked-card occurrences between hosts without recreating their identities. */
function transferStackedCards(
  s: GameState,
  fromUid: string,
  toUid: string,
  count: number,
  instanceIds?: string[],
): StackedCardEntry[] {
  const from = findChar(s, fromUid);
  const to = findChar(s, toUid);
  if (!from || !to || from.player !== to.player || fromUid === toUid || count < 1 || stackedCardCount(from.char.stackedCards) < count) return [];

  const existingTarget = Array.isArray(to.char.stackedCards)
    ? to.char.stackedCards
    : Array.from({ length: stackedCardCount(to.char.stackedCards) }, (_, i) => ({ cardId: 'back-card', instanceId: `legacy:${toUid}:${i}` }));
  const targetIds = new Set(existingTarget.map(entry => entry.instanceId));
  if (!Array.isArray(from.char.stackedCards) && instanceIds !== undefined) return [];
  const sourceEntries: StackedCardEntry[] = Array.isArray(from.char.stackedCards)
    ? from.char.stackedCards
    : Array.from({ length: count }, (_, i) => ({ cardId: 'back-card', instanceId: `legacy:${fromUid}:${i}` }));
  const selectedBefore = instanceIds === undefined
    ? sourceEntries.slice(0, count)
    : instanceIds.map(id => sourceEntries.find(entry => entry.instanceId === id)).filter((entry): entry is StackedCardEntry => entry !== undefined);
  if (selectedBefore.length !== count || selectedBefore.some(entry => targetIds.has(entry.instanceId))) return [];

  const moved = removeStackedCards(s, fromUid, count, instanceIds);
  if (moved.length !== count) return [];
  to.char.stackedCards = [...existingTarget, ...moved];
  return moved;
}

/**
 * setCards と stackedCards のクリーンアップ (離場時)
 * setCards → リムーブエリアへ
 * stackedCards → 枚数分の back-card としてリムーブエリアへ
 */
function removeAllSetAndStacked(s: GameState, uid: string): void {
  const found = findChar(s, uid);
  if (!found) return;
  const { char, player } = found;

  // setCards をリムーブエリアへ
  for (const entry of char.setCards) {
    s.players[player].remove.push(entry.cardId);
  }
  if (char.setCards.length > 0) advanceIndexedZoneEpoch(s, player, 'remove');
  char.setCards = [];

  // stackedCards 分の back-card をリムーブエリアへ
  if (Array.isArray(char.stackedCards)) {
    s.players[player].remove.push(...char.stackedCards.map(entry => entry.cardId));
    if (char.stackedCards.length > 0) advanceIndexedZoneEpoch(s, player, 'remove');
  } else {
    for (let i = 0; i < char.stackedCards; i++) s.players[player].remove.push('back-card');
    if (char.stackedCards > 0) advanceIndexedZoneEpoch(s, player, 'remove');
  }
  char.stackedCards = 0;
}

/**
 * 2026-06-06 タスクC: キャラにセットされているカードを **1枚だけ** リムーブする (rules/16)。
 * 最後にセットされた 1 枚 (setCards 末尾) を表向きにしてリムーブエリアへ。set card が無ければ no-op。
 * removeAllSetAndStacked (離場時の全クリーンアップ) と異なり、在場キャラから 1 枚だけ外す用途
 * (B08034「セットされているカードを1枚リムーブ」)。戻り値 = リムーブした cardId (無ければ null)。
 */
// engine additive wave (2026-06-24): opts 拡張 (faceDownOnly / cause)。
//   default {faceDownOnly:false, cause:'effect'} = 従来 B08034 path 挙動を完全保存 (回帰0)。
//   removeSetCard コスト (B08033 a2) は {faceDownOnly:true, cause:'cost'} で呼び、faceUp:false の
//   末尾 entry を1枚 splice する (裏向きは情報を持たず識別不可ゆえ末尾選択は任意・公平)。
function removeOneSetCard(
  s: GameState,
  uid: string,
  opts?: { faceDownOnly?: boolean; setCardId?: string; setCardInstanceId?: string; cause?: 'effect' | 'cost'; skipReplacement?: boolean },
): string | null {
  ensureSetCardInstanceIds(s);
  const found = findChar(s, uid);
  if (!found) return null;
  const { char, player } = found;
  const faceDownOnly = opts?.faceDownOnly ?? false;
  const cause = opts?.cause ?? 'effect';
  let idx = -1;
  if (typeof opts?.setCardInstanceId === 'string') {
    idx = char.setCards.findIndex((candidate) => candidate.instanceId === opts.setCardInstanceId);
    if (idx < 0) return null;
  } else if (typeof opts?.setCardId === 'string') {
    idx = char.setCards.findIndex((candidate) => candidate.cardId === opts.setCardId);
    if (idx < 0) return null;
  } else if (faceDownOnly) {
    for (let i = char.setCards.length - 1; i >= 0; i--) {
      if (!char.setCards[i].faceUp) { idx = i; break; }
    }
    if (idx < 0) return null;
  } else {
    idx = char.setCards.length - 1;
  }
  const candidate = char.setCards[idx];
  if (!candidate) return null;
  if (opts?.skipReplacement !== true && maybeReplaceSetCardRemoval(s, player, uid, candidate)) return null;
  const entry = char.setCards.splice(idx, 1)[0];
  if (!entry) return null;
  s.players[player].remove.push(entry.cardId);
  advanceIndexedZoneEpoch(s, player, 'remove');
  // engine拡張 wave#2 cluster9: set card 1枚が現場から離れる (host は在場のまま) → setcard:leave emit。
  // rules/16: B08034「セットされているカードを1枚リムーブ」= 現場から離れる。host が scene に残るため
  // listener (host 自身 / 他キャラ) は collectCardsInPlay で捕捉される (splice 前後の懸念なし)。
  event.emit(
    s,
    'setcard:leave',
    { player, hostUid: char.uid, hostCardId: char.cardId, setCardId: entry.cardId, setCardInstanceId: entry.instanceId, faceUp: entry.faceUp, cause },
    { player, uid: char.uid, cardId: char.cardId },
  );
  return entry.cardId;
}

/** Detach one exact set-card occurrence without a leave event or remove-area move. */
function takeOneSetCard(s: GameState, uid: string, setCardInstanceId: string): { cardId: string; player: Player } | null {
  ensureSetCardInstanceIds(s);
  const found = findChar(s, uid);
  if (!found) return null;
  const idx = found.char.setCards.findIndex((entry) => entry.instanceId === setCardInstanceId);
  if (idx < 0) return null;
  const [entry] = found.char.setCards.splice(idx, 1);
  if (!entry) return null;
  return { cardId: entry.cardId, player: found.player };
}

/** Move one exact set-card occurrence after validating every mutable endpoint. */
function moveOneSetCard(
  s: GameState,
  fromUid: string,
  setCardInstanceId: string,
  face: 'down' | 'up' | 'any',
  destination: { area: 'evidence'; faceUp: boolean } | { area: 'hand' } | { area: 'scene'; hostUid: string },
): { cardId: string; player: Player } | null {
  ensureSetCardInstanceIds(s);
  const from = findChar(s, fromUid);
  if (!from) return null;
  const idx = from.char.setCards.findIndex((entry) => entry.instanceId === setCardInstanceId);
  if (idx < 0) return null;
  const entry = from.char.setCards[idx];
  if (!entry || (face === 'down' && entry.faceUp) || (face === 'up' && !entry.faceUp)) return null;

  // Destination validation is deliberately before source splice. Moving to a
  // vanished, same-host, or opponent host must leave the exact occurrence in place.
  const target = destination.area === 'scene' ? findChar(s, destination.hostUid) : null;
  if (destination.area === 'scene' && (!target || target.player !== from.player || target.char.uid === from.char.uid)) return null;

  const [moved] = from.char.setCards.splice(idx, 1);
  if (!moved) return null;
  if (target) {
    // Physical attachment transfer; it is not a leave/re-enter lifecycle.
    target.char.setCards.push(moved);
  } else {
    event.emit(
      s,
      'setcard:leave',
      {
        player: from.player,
        hostUid: from.char.uid,
        hostCardId: from.char.cardId,
        setCardId: moved.cardId,
        setCardInstanceId: moved.instanceId,
        faceUp: moved.faceUp,
        cause: 'move',
        destination,
      },
      { player: from.player, uid: from.char.uid, cardId: from.char.cardId },
    );
  }
  return { cardId: moved.cardId, player: from.player };
}

/**
 * 変装: cardId のみを新カードに変更 (rules/09, 23)
 * 引継ぎテーブル:
 *   ✓ state (スリープ状態)
 *   ✓ turnEffects (contactImmune, removeOnTurnEnd, AP/LP修正, 持続効果)
 *   ✓ keywordOverrides (granted, disabledOriginal)
 *   ✓ setCards / stackedCards
 *   ✓ enterOrder / isNamed
 *   ✓ apOverride / lpOverride
 *   ✕ 元のカード名・色 (新カードのものに変わる = cardId 変更)
 * 元キャラのデッキ下移動は別途 scene.toDeckBottom で処理
 */
function disguiseInto(s: GameState, uid: string, newCardId: string): void {
  const found = findChar(s, uid);
  if (!found) return;
  // cardId だけ変更。その他すべて保持
  found.char.cardId = newCardId;
}

export const char = {
  modifyAP,
  modifyLP,
  modifyLevel,
  setOverrideAP,
  setOverrideAPTurn,
  setOverrideLPTurn,
  setOverrideLP,
  grantKeyword,
  revokeKeyword,
  revokeKeywordTurn,
  grantTrait,
  revokeTrait,
  disableOriginalAbilities,
  setTurnEffect,
  tagSelectedByOwnMr,
  clearTurnEffects,
  grantAbility,
  setCard,
  stackCard,
  removeStackedCards,
  stackedCardEntries,
  ensureStackedCardEntries,
  selectStackedCardEntries,
  transferStackedCards,
  removeAllSetAndStacked,
  removeOneSetCard,
  replaceEligibleSetCardsBeforeHostLeaves,
  wouldDeferSetCardReplacementForHostLeave,
  deferSetCardReplacementForHostLeave,
  canResolveSetCardRemovalReplacement,
  resolveSetCardRemovalReplacement,
  takeOneSetCard,
  moveOneSetCard,
  ensureSetCardInstanceIds,
  disguiseInto,
};
