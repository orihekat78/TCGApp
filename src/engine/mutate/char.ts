// engine.mutate.char — キャラ修正プリミティブ
// rules: 03-field-areas.md (状態), 09-cutin-disguise.md (変装引継ぎ), 13-keywords.md, 19-special-rules.md
// ⚠ 各関数は Immer draft 前提 (produce 内部で呼び出す)

import type { GameState } from '@/engine/types';
import { event } from '../event/index.js'; // engine拡張 wave#2 cluster9: removeOneSetCard で setcard:leave emit

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
  const found = findChar(s, uid);
  if (!found) return;
  const key = `apMod_${scope}`;
  const current = (found.char.turnEffects[key] as number | undefined) ?? 0;
  found.char.turnEffects[key] = current + delta;
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

/** 元の能力を無効にする (rules/19) MR能力は無効にならない */
function disableOriginalAbilities(s: GameState, uid: string): void {
  const found = findChar(s, uid);
  if (!found) return;
  found.char.keywordOverrides.disabledOriginal = true;
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
    delete te['grantedKeywords'];
    // engine additive (2026-06-29): revokeKeywordTurn が積んだ「ターン終了時まで失う」キーワード (B06068)。
    delete te['revokedKeywords'];
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
function setCard(s: GameState, uid: string, cardId: string, faceUp: boolean): void {
  const found = findChar(s, uid);
  if (!found) return;
  const { char, player } = found;
  char.setCards.push({ cardId, faceUp });
  // engine additive (2026-06-29): カード1枚が host にセットされた → setcard:enter emit (setcard:leave の対)。
  // push 後 (host は在場) に emit するため listener (host 自身 selfOnly) は collectCardsInPlay で捕捉される。
  // payload/source は setcard:leave と同形。cause:'effect' (本関数は atomCharSetCard 経由のみ)。
  // 既存カードは誰も setcard:enter を購読しない (setCardMatches/該当 hook を持つ印字 ability は 0 件) ため、
  // emit しても handleHook が一致 ability を見つけず pendingEffects に何も積まない = 挙動不変 (smoke byte-identical)。
  event.emit(
    s,
    'setcard:enter',
    { player, hostUid: char.uid, hostCardId: char.cardId, setCardId: cardId, faceUp, cause: 'effect' },
    { player, uid: char.uid, cardId: char.cardId },
  );
}

/** キャラの下に重ねる (stackedCards 加算) (rules/16) */
function stackCard(s: GameState, uid: string, count: number): void {
  const found = findChar(s, uid);
  if (!found) return;
  found.char.stackedCards += count;
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
  char.setCards = [];

  // stackedCards 分の back-card をリムーブエリアへ
  for (let i = 0; i < char.stackedCards; i++) {
    s.players[player].remove.push('back-card');
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
  opts?: { faceDownOnly?: boolean; cause?: 'effect' | 'cost' },
): string | null {
  const found = findChar(s, uid);
  if (!found) return null;
  const { char, player } = found;
  const faceDownOnly = opts?.faceDownOnly ?? false;
  const cause = opts?.cause ?? 'effect';
  let entry: { cardId: string; faceUp: boolean } | undefined;
  if (faceDownOnly) {
    let idx = -1;
    for (let i = char.setCards.length - 1; i >= 0; i--) {
      if (!char.setCards[i].faceUp) { idx = i; break; }
    }
    if (idx < 0) return null;
    entry = char.setCards.splice(idx, 1)[0];
  } else {
    entry = char.setCards.pop();
  }
  if (!entry) return null;
  s.players[player].remove.push(entry.cardId);
  // engine拡張 wave#2 cluster9: set card 1枚が現場から離れる (host は在場のまま) → setcard:leave emit。
  // rules/16: B08034「セットされているカードを1枚リムーブ」= 現場から離れる。host が scene に残るため
  // listener (host 自身 / 他キャラ) は collectCardsInPlay で捕捉される (splice 前後の懸念なし)。
  event.emit(
    s,
    'setcard:leave',
    { player, hostUid: char.uid, hostCardId: char.cardId, setCardId: entry.cardId, faceUp: entry.faceUp, cause },
    { player, uid: char.uid, cardId: char.cardId },
  );
  return entry.cardId;
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
  setOverrideLP,
  grantKeyword,
  revokeKeyword,
  revokeKeywordTurn,
  disableOriginalAbilities,
  setTurnEffect,
  tagSelectedByOwnMr,
  clearTurnEffects,
  grantAbility,
  setCard,
  stackCard,
  removeAllSetAndStacked,
  removeOneSetCard,
  disguiseInto,
};
