// tests/cards/m1-megasweep/B02031.manual — 平次のバイク (event) 手書き probe (engine 実評価)
//
// 公式テキスト (payloads/B02031.json fullTexts):
//   effect: このイベントを自分の現場にいる【緑】の〚特徴［探偵］〛のキャラ1枚にセットする。\n
//           このイベントがセットされているキャラは〚突撃［キャラ］〛と「このキャラは相手の現場にいる
//           アクティブ状態のキャラを指定してアクションできる。」を持つ。
//   hirameki: 【ヒラメキ】（証拠からリムーブされるときに発動する）カードを1枚引く。
//   Q&A: 「セットする」= キャラ1枚に付いた状態。host が現場を離れるとリムーブ。
//        現場にキャラが1枚もなくても使用可 — セットできない場合は解決後リムーブへ (できるならば必ずセット)。
//
// novel句 (refusedLines) を全て production dispatch で踏む:
//   a1 triggered(scope on-hand, hook effect:declared selfOnly matcher=event-use):
//        charSetCard{fromSelf, player:self, n:1, filter:{color:緑, trait:[探偵], kind:character}}
//        = 使用イベント自身を own remove から引き、【緑】〚探偵〛own-scene キャラ1枚に faceUp セット。
//        (decoy: 非緑 / 非探偵 / 相手現場 は候補外 / host 不在は remove に留まる QA 経路)
//   a2 continuous(scope on-set-host): grantKeywords → ['突撃[キャラ]', 'text:actionTargetsActive']
//        = セットされた host が 突撃[キャラ] と actionTargetsActive を得る (read.char.keywords/hasTextAbility 実評価)。
//        非 host キャラには漏れない (on-set-host = per-host)。
//   a3 triggered(scope on-evidence, hook evidence:remove-by-action optional): draw 1
//        = ヒラメキ draw (settled clone、参考として descriptor 検証のみ)。
//
// production dispatch:
//   - a1+a2: handUseCard(side, 'B02031') → runAllUntilEmpty → pending pick を drain (host 選択) →
//            read.char.setCards / read.char.keywords / read.char.hasTextAbility で結果を実評価。
//   - owner='opp' 反転 pin (BUG-174): handUseCard(s,'opp',...) で opp が使用 → opp 現場の host に
//            セット、opp host が keyword を得る。self 側は不変 (side 相対解釈が反転しない)。
//
// カード本体 / engine は編集禁止。test 側のみ調整して green。
//
// rules: 13-keywords.md, 16-card-set.md, 22-qa-action-contact.md, 10-action-event.md, 14-refresh.md, 15-abilities-effects.md

import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyGameState } from '@/engine/state-factory';
import { event } from '@/engine/event/index';
import { registerTriggeredListener, _resetTriggeredRegistered } from '@/engine/listeners/triggered';
import { register as registerCardDef, _resetRegistry as resetDefRegistry } from '@/engine/read/def';
import { handUseCard } from '@/engine/flow/main/hand-use-card';
import { runAllUntilEmpty } from '@/engine/resolve/index';
import {
  _drainPendingEffectPickSide,
  _clearPendingEffectPickQueue,
  _clearPendingEffectOptionalSide,
} from '@/engine/effect/pending-state';
import { applyPickAndContinuation } from '@/engine/effect/apply-pick';
import { _resetUidCounter } from '@/engine/mutate/scene';
import { char as readChar } from '@/engine/read/char';
import { B02031 } from '@/cards/ct-p02/B02031';
import type { CardDef, GameState, Player, SceneCharacter } from '@/engine/types';

type Side = 'self' | 'opp';

// --- synthetic defs (prefix DEC_ で id 衝突回避) ---
function ch(id: string, over: Partial<CardDef> = {}): CardDef {
  return {
    id, no: `9/${id}`, kind: 'character', names: [id], colors: ['緑'],
    level: 3, ap: 3000, lp: 1, traits: ['探偵'], keywords: [], rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...over,
  };
}
// filler def — draw/mill が cardId を要しても解決できるよう
function filler(id: string): CardDef {
  return { id, no: id, kind: 'character', names: [id], colors: ['赤'], level: 1, ap: 1000, lp: 1, traits: [], keywords: [], rarity: 'C', imageUrl: '', abilities: [], ruleRefs: [] };
}

const HOST_OK = 'DEC_HOST_OK';   // 緑 / 探偵 / character → 唯一の valid host
const DEC_COLOR = 'DEC_COLOR';    // 赤 / 探偵            → color decoy
const DEC_TRAIT = 'DEC_TRAIT';    // 緑 / 警察            → trait decoy
const OPP_HOST = 'DEC_OPP_HOST';  // 緑 / 探偵 (相手現場)  → side decoy

function mkSceneChar(cardId: string, uid: string): SceneCharacter {
  return {
    cardId, uid, state: 'active', isNamed: false, enterOrder: 1, enterOrderThisTurn: 1,
    setCards: [], stackedCards: 0, keywordOverrides: { granted: [], disabledOriginal: false },
    apOverride: null, lpOverride: null, turnEffects: { contactImmune: false, removeOnTurnEnd: false },
    declaredUseCount: {},
  } as SceneCharacter;
}

const HUMAN = globalThis as { __humanPlayerSide?: Side | null };

beforeEach(() => {
  event._resetRegistry();
  _resetTriggeredRegistered();
  resetDefRegistry();
  _resetUidCounter();
  _clearPendingEffectPickQueue();
  _clearPendingEffectOptionalSide();
  registerCardDef(B02031);
  registerCardDef(ch(HOST_OK, { colors: ['緑'], traits: ['探偵'] }));
  registerCardDef(ch(DEC_COLOR, { colors: ['赤'], traits: ['探偵'] }));
  registerCardDef(ch(DEC_TRAIT, { colors: ['緑'], traits: ['警察'] }));
  registerCardDef(ch(OPP_HOST, { colors: ['緑'], traits: ['探偵'] }));
  for (let i = 0; i < 8; i++) registerCardDef(filler(`__F${i}`));
  registerTriggeredListener();
  HUMAN.__humanPlayerSide = 'self';
});

interface RecordedPick { atomVerb: string; candidates: { uid: string; cardId: string }[]; }

// production dispatch: handUseCard(side) → runAllUntilEmpty → pending pick を script 順に drain。
// 各 pick の候補 (uid+cardId) を記録して decoy 除外検証に使う。picks は cardId 配列。
function driveEventUse(s: GameState, side: Side, cardId: string, picks: string[]): RecordedPick[] {
  HUMAN.__humanPlayerSide = side; // acting side を human に = pick が AI 自動解決されず pending queue に surface
  const recorded: RecordedPick[] = [];
  handUseCard(s, side, cardId);
  runAllUntilEmpty(s);
  let i = 0;
  for (let guard = 0; guard < 30; guard++) {
    const pick = _drainPendingEffectPickSide();
    if (!pick) break;
    const cands = (pick.candidates as Array<{ uid: string; cardId: string }>).map((c) => ({ uid: c.uid, cardId: c.cardId }));
    recorded.push({ atomVerb: pick.atomVerb, candidates: cands });
    const want = picks[i++];
    if (want === undefined) throw new Error(`[B02031] pick "${pick.atomVerb}" surfaced but picks exhausted (cands=${cands.map((c) => c.cardId).join(',')})`);
    const hit = cands.find((c) => c.cardId === want);
    if (!hit) throw new Error(`[B02031] pickCardId "${want}" not among candidates of "${pick.atomVerb}" (got: ${cands.map((c) => c.cardId).join(',') || '∅'})`);
    applyPickAndContinuation(s, pick, hit.uid);
  }
  if (i < picks.length) throw new Error(`[B02031] ${picks.length - i} leftover pick(s) but no more prompts surfaced (over-scripted)`);
  return recorded;
}

// side が緑イベントを手札使用できる live state (case色=緑 / FILE≥level6 で色/レベルゲート充足)
function board(actingSide: Side): GameState {
  const s = createEmptyGameState();
  s.turn = { number: 5, player: actingSide, phase: 'main', isFirstPlayerFirstTurn: false } as GameState['turn'];
  for (const side of ['self', 'opp'] as Side[]) {
    s.players[side].case.colors = ['緑'];
    s.players[side].file = Array.from({ length: 7 }, () => ({ type: 'card-back' as const, cardId: '__FILE__' }));
    s.players[side].deck = Array.from({ length: 6 }, (_v, i) => `__F${i % 8}`);
  }
  return s;
}

describe('B02031 平次のバイク — descriptor shape', () => {
  it('id/kind/色/lv + a1 charSetCard fromSelf(緑探偵) / a2 on-set-host grant 突撃[キャラ]+actionTargetsActive / a3 ヒラメキ draw', () => {
    expect(B02031.id).toBe('B02031');
    expect(B02031.kind).toBe('event');
    expect(B02031.colors).toEqual(['緑']);
    expect(B02031.level).toBe(6);

    const [a1, a2, a3] = B02031.abilities;
    expect(a1.type).toBe('triggered');
    expect(a1.trigger).toMatchObject({ hook: 'effect:declared', selfOnly: true });
    expect(a1.effect).toMatchObject({ kind: 'atom', verb: 'charSetCard', args: { player: 'self', fromSelf: true, n: 1, filter: { color: '緑', trait: ['探偵'], kind: 'character' } } });

    expect(a2.type).toBe('continuous');
    expect((a2 as { scope?: string }).scope).toBe('on-set-host');
    expect((a2.continuousModifier!.grantKeywords as () => string[])()).toEqual(['突撃[キャラ]', 'text:actionTargetsActive']);

    expect(a3.type).toBe('triggered');
    expect(a3.trigger).toMatchObject({ hook: 'evidence:remove-by-action', optional: true });
    expect(a3.effect).toMatchObject({ kind: 'atom', verb: 'draw', args: { n: 1, player: 'self' } });
  });
});

describe('B02031 a1+a2 — event-use → 緑探偵にセット → host が突撃[キャラ]+actionTargetsActive を得る (engine 実評価)', () => {
  it('S1 happy: HOST_OK(緑探偵) にセット / 非緑・非探偵・相手現場は候補外 / host が両キーワード取得・非hostは非付与', () => {
    const s = board('self');
    s.players.self.hand = ['B02031'];
    s.players.self.scene = [mkSceneChar(HOST_OK, 'host#1'), mkSceneChar(DEC_COLOR, 'dcol#1'), mkSceneChar(DEC_TRAIT, 'dtra#1')];
    s.players.opp.scene = [mkSceneChar(OPP_HOST, 'opp#1')];

    const rec = driveEventUse(s, 'self', 'B02031', [HOST_OK]);

    // pick#0 = charSetCard host 選択。decoy 3種が候補外であること。
    expect(rec.length, 'host pick が 1 回 surface').toBe(1);
    const cands = rec[0].candidates.map((c) => c.cardId);
    expect(cands, '非緑 DEC_COLOR は color filter で候補外').not.toContain(DEC_COLOR);
    expect(cands, '非探偵 DEC_TRAIT は trait filter で候補外').not.toContain(DEC_TRAIT);
    expect(cands, '相手現場 OPP_HOST は player:self で候補外').not.toContain(OPP_HOST);
    expect(cands, 'HOST_OK のみが候補').toContain(HOST_OK);

    // a1 WRITE: イベント自身が HOST_OK に faceUp セットされ、手札から抜けた
    expect(readChar.setCards(s, 'host#1'), 'B02031 が host にセット').toContain('B02031');
    expect(s.players.self.hand.includes('B02031'), 'イベントは手札に残らない').toBe(false);

    // a2 READ (on-set-host grant): host が両キーワードを得る
    expect(readChar.keywords(s, 'host#1'), 'host が 突撃[キャラ] を得る').toContain('突撃[キャラ]');
    expect(readChar.hasTextAbility(s, 'host#1', 'actionTargetsActive'), 'host が actionTargetsActive を得る').toBe(true);

    // 非 host (別現場キャラ) には漏れない (on-set-host = per-host)
    expect(readChar.keywords(s, 'dcol#1'), '非hostのDEC_COLORは付与なし').not.toContain('突撃[キャラ]');
    expect(readChar.hasTextAbility(s, 'dtra#1', 'actionTargetsActive'), '非hostのDEC_TRAITは付与なし').toBe(false);
  });

  it('S2 host不在: 緑探偵キャラが現場にいない → セット不成立、イベントは remove に留まる (公式Q&A)', () => {
    const s = board('self');
    s.players.self.hand = ['B02031'];
    // 現場は非適格キャラ (赤探偵) のみ → valid host 0
    s.players.self.scene = [mkSceneChar(DEC_COLOR, 'dcol#1')];

    const rec = driveEventUse(s, 'self', 'B02031', []); // 有効候補0 → pick なし想定 (auto no-op)

    expect(rec.length, '有効 host 0 → pick surface せず (強制セット不成立)').toBe(0);
    expect(s.players.self.remove.includes('B02031'), 'イベントは解決後 remove に留まる (QA: セットできる相手がいない)').toBe(true);
    expect(readChar.setCards(s, 'dcol#1'), '非適格キャラにはセットされない').not.toContain('B02031');
    expect(readChar.keywords(s, 'dcol#1'), '非適格キャラは keyword 付与なし').not.toContain('突撃[キャラ]');
  });

  it('S3 owner=opp (BUG-174): opp が使用 → opp現場のhostにセット / opp hostが取得 / self側は不変 (side反転しない)', () => {
    const s = board('opp');
    s.players.opp.hand = ['B02031'];
    s.players.opp.scene = [mkSceneChar(OPP_HOST, 'ohost#1')];
    // self 側にも同型キャラを置き、誤って self host にセットされないことを pin
    s.players.self.scene = [mkSceneChar(HOST_OK, 'shost#1')];

    const rec = driveEventUse(s, 'opp', 'B02031', [OPP_HOST]);

    const cands = rec[0].candidates.map((c) => c.cardId);
    expect(cands, 'opp 使用 → 候補は opp 現場 (self host は候補外)').not.toContain(HOST_OK);
    expect(cands, 'opp host が候補').toContain(OPP_HOST);

    expect(readChar.setCards(s, 'ohost#1'), 'opp host にセット').toContain('B02031');
    expect(readChar.keywords(s, 'ohost#1'), 'opp host が 突撃[キャラ] を得る').toContain('突撃[キャラ]');
    expect(readChar.hasTextAbility(s, 'ohost#1', 'actionTargetsActive'), 'opp host が actionTargetsActive を得る').toBe(true);

    // self 側は完全に無関係
    expect(readChar.setCards(s, 'shost#1'), 'self host には何もセットされない').not.toContain('B02031');
    expect(readChar.keywords(s, 'shost#1'), 'self host は付与なし').not.toContain('突撃[キャラ]');
    expect(s.players.self.remove.includes('B02031'), 'self remove には入らない').toBe(false);
  });
});
