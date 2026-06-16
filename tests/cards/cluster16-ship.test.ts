// engine拡張 wave#2 cluster16 — ship gate5: 出荷カードの filter 値が公式テキスト文言どおりの
// 候補集合を生むかを decoy 盤面で 1対1 検証 (CLAUDE.md セルフレビュー「画面処理=カードテキスト文言」)。
//   - cardNameNot 除外 (B03113 / B06081 / B03053): 除外名カードを decoy に置き、候補から外れること
//   - deckReveal filterAny OR (B03016 / B04012 / B07035): OR の各枝 (cardName / trait) が match、
//     非該当 decoy は非 match、base filter(kind) との AND、「カード」vs「キャラ」(kind 有無) を検証
// 抽出は **実出荷 AbilityDef** から行う (spec の filter 値そのものをテスト、再記述しない)。
// spec: .claude/specs/engine-cluster16-filter-predicate-expressiveness-design.md
// rules: 15 (まで=0可), 19 (split-name), 20 (登場色制限)
import { describe, it, expect, beforeEach } from 'vitest';
import { matchOneFilter } from '@/engine/target/candidates';
import { runAtom } from '@/engine/effect/atom-handlers';
import { createEmptyGameState } from '@/engine/state-factory';
import { register as registerCardDef, _resetRegistry } from '@/engine/read/def';
import { makeCtx } from '../helpers/fixtures';
import type { CardDef, Candidate, GameState, TargetFilter, EffectDescriptor, AbilityDef } from '@/engine/types';
import { B03113 } from '@/cards/ct-p03/B03113';
import { B03053 } from '@/cards/ct-p03/B03053';
import { B03016 } from '@/cards/ct-p03/B03016';
import { B04012 } from '@/cards/ct-p04/B04012';
import { B06081 } from '@/cards/ct-p06/B06081';
import { B07035 } from '@/cards/ct-p07/B07035';

function defOf(o: Partial<CardDef> & { id: string }): CardDef {
  return {
    id: o.id, no: o.no ?? 'NO', kind: 'character', names: ['default'],
    colors: [], traits: [], level: 4, ap: 4000, lp: 1, rarity: 'C',
    imageUrl: '', abilities: [], ruleRefs: [], ...o,
  };
}
const cand = (cardId: string): Candidate => ({ kind: 'card', cardId, area: 'deck', player: 'self' });

// 出荷 ability の effect ツリー (optional/chain/sequence/conditional) を walk し、最初の指定 verb の args を返す。
function findArgs(eff: EffectDescriptor | undefined, verb: string): Record<string, unknown> | null {
  if (!eff || typeof eff !== 'object') return null;
  const e = eff as Record<string, unknown>;
  if (e.kind === 'atom' && e.verb === verb) return e.args as Record<string, unknown>;
  for (const k of ['effect', 'then', 'else']) {
    const r = findArgs(e[k] as EffectDescriptor | undefined, verb);
    if (r) return r;
  }
  for (const k of ['steps']) {
    for (const s of (e[k] as EffectDescriptor[] | undefined) ?? []) {
      const r = findArgs(s, verb);
      if (r) return r;
    }
  }
  return null;
}
const abilityArgs = (card: CardDef, abilityIdx: number, verb: string) =>
  findArgs((card.abilities[abilityIdx] as AbilityDef).effect, verb);

const s = (): GameState => createEmptyGameState();

// ───────────────────────── G1 cardNameNot 除外 ─────────────────────────
describe('cluster16 ship — cardNameNot 除外 (出荷カードの pick filter)', () => {
  // B03113 シェリー: 「リムーブの【カットイン】を持つレベル6以下の【黒】の〚シェリー〛以外のキャラ」
  describe('B03113 sceneEnter filter (カットイン/Lv6以下/黒/シェリー以外/キャラ)', () => {
    const filter = abilityArgs(B03113, 0, 'sceneEnter')!.filter as TargetFilter;
    beforeEach(() => {
      _resetRegistry();
      // 除外名 (黒/カットイン/Lv5) — 名前以外は全条件を満たす decoy → cardNameNot のみで外れること
      registerCardDef(defOf({ id: 'SHERRY', names: ['シェリー'], colors: ['黒'], level: 5, keywords: ['カットイン'] }));
      // 適格 (黒/カットイン/Lv6/別名)
      registerCardDef(defOf({ id: 'VALID', names: ['ベルモット'], colors: ['黒'], level: 6, keywords: ['カットイン'] }));
      // レベル超過 (Lv7)
      registerCardDef(defOf({ id: 'LV7', names: ['ジン'], colors: ['黒'], level: 7, keywords: ['カットイン'] }));
      // カットイン無し
      registerCardDef(defOf({ id: 'NOCUT', names: ['ウォッカ'], colors: ['黒'], level: 4, keywords: [] }));
      // 色違い (青)
      registerCardDef(defOf({ id: 'BLUE', names: ['キャンティ'], colors: ['青'], level: 4, keywords: ['カットイン'] }));
    });
    it('シェリー(除外名)は候補外 / 別名の適格カードは候補内', () => {
      expect(matchOneFilter(s(), 'SHERRY', filter, null, cand('SHERRY'))).toBe(false); // cardNameNot
      expect(matchOneFilter(s(), 'VALID', filter, null, cand('VALID'))).toBe(true);
    });
    it('レベル超過/カットイン無し/色違いも候補外 (filter 各条件)', () => {
      expect(matchOneFilter(s(), 'LV7', filter, null, cand('LV7'))).toBe(false);   // levelMax:6
      expect(matchOneFilter(s(), 'NOCUT', filter, null, cand('NOCUT'))).toBe(false); // keyword:カットイン
      expect(matchOneFilter(s(), 'BLUE', filter, null, cand('BLUE'))).toBe(false);  // color:黒
    });
    it('shipped filter が cardNameNot:シェリー を実際に持つ (spec 値検証)', () => {
      expect(filter.cardNameNot).toBe('シェリー');
    });
  });

  // B06081 保本ひかる: 「現場の〚保本ひかる〛以外のキャラ」
  describe('B06081 sceneRemove filter (保本ひかる以外/キャラ)', () => {
    const filter = abilityArgs(B06081, 0, 'sceneRemove')!.filter as TargetFilter;
    beforeEach(() => {
      _resetRegistry();
      registerCardDef(defOf({ id: 'HOMOTO', names: ['保本ひかる'] }));
      registerCardDef(defOf({ id: 'OTHER', names: ['工藤有希子'] }));
    });
    it('保本ひかる(自名)は候補外 / 別名キャラは候補内', () => {
      expect(matchOneFilter(s(), 'HOMOTO', filter, null, cand('HOMOTO'))).toBe(false);
      expect(matchOneFilter(s(), 'OTHER', filter, null, cand('OTHER'))).toBe(true);
      expect(filter.cardNameNot).toBe('保本ひかる');
    });
  });

  // B03053 鈴木綾子: 「リムーブの〚鈴木綾子〛以外の〚鈴木財閥〛のキャラ」
  describe('B03053 handAddFromRemove filter (鈴木綾子以外/鈴木財閥/キャラ)', () => {
    const filter = abilityArgs(B03053, 1, 'handAddFromRemove')!.filter as TargetFilter;
    beforeEach(() => {
      _resetRegistry();
      registerCardDef(defOf({ id: 'AYAKO', names: ['鈴木綾子'], traits: ['鈴木財閥'] }));   // 除外名 (財閥だが綾子)
      registerCardDef(defOf({ id: 'SONOKO', names: ['鈴木園子'], traits: ['鈴木財閥'] }));  // 適格
      registerCardDef(defOf({ id: 'NONFIN', names: ['毛利蘭'], traits: ['高校生'] }));      // 非財閥
    });
    it('鈴木綾子(除外名)は候補外 / 別の鈴木財閥キャラは候補内 / 非財閥は候補外', () => {
      expect(matchOneFilter(s(), 'AYAKO', filter, null, cand('AYAKO'))).toBe(false);  // cardNameNot
      expect(matchOneFilter(s(), 'SONOKO', filter, null, cand('SONOKO'))).toBe(true);
      expect(matchOneFilter(s(), 'NONFIN', filter, null, cand('NONFIN'))).toBe(false); // trait:鈴木財閥
      expect(filter.cardNameNot).toBe('鈴木綾子');
    });
  });
});

// ───────────────────────── G2 deckReveal filterAny OR ─────────────────────────
describe('cluster16 ship — deckReveal filterAny cross-field OR (出荷カードの reveal filter)', () => {
  // 出荷カードの reveal args から filter/filterAny/maxN のみ採用し、match を強制 bind ('m') して
  // filterAny の **値マッチング** を分離検証する (chooseMatch:'upTo' の decline pick は rules/15 の
  // 別関心事で cluster16 非依存。ここは「どの deck カードが match 判定されるか」だけを見る)。
  function reveal(args: Record<string, unknown>, deck: string[]): string | null {
    const st = s();
    st.players.self.deck = deck;
    const ctx = makeCtx({ source: { player: 'self', area: 'scene', cardId: 'X' } });
    const a: Record<string, unknown> = { player: 'self', maxN: args.maxN, bindMatch: 'm' };
    if (args.filter !== undefined) a.filter = args.filter;
    if (args.filterAny !== undefined) a.filterAny = args.filterAny;
    runAtom(st, 'deckRevealUntil', a, ctx);
    const m = ctx.bindings['m'] as Candidate[] | undefined;
    return m && m.length ? (m[0] as { cardId: string }).cardId : null;
  }

  // B03016 円谷光彦: 「公開カードが〚阿笠博士〛か〚少年探偵団〛のキャラ」(maxN:1, kind:character)
  describe('B03016 filterAny [阿笠博士-名 OR 少年探偵団-特徴], kind:character', () => {
    const args = abilityArgs(B03016, 0, 'deckRevealUntil')!;
    beforeEach(() => {
      _resetRegistry();
      registerCardDef(defOf({ id: 'AGASA', names: ['阿笠博士'], traits: ['発明家'] }));         // 名前枝 match
      registerCardDef(defOf({ id: 'AYUMI', names: ['吉田歩美'], traits: ['少年探偵団'] }));     // 特徴枝 match
      registerCardDef(defOf({ id: 'DECOY', names: ['黒の組織'], traits: ['黒ずくめの組織'] })); // 非該当
    });
    it('名前枝(阿笠博士) match', () => expect(reveal(args, ['AGASA'])).toBe('AGASA'));
    it('特徴枝(少年探偵団) match', () => expect(reveal(args, ['AYUMI'])).toBe('AYUMI'));
    it('どちらの枝にも該当しない decoy は非 match (null)', () => expect(reveal(args, ['DECOY'])).toBe(null));
  });

  // B04012 毛利蘭: filter:{kind:character} + filterAny[妃英理 OR 工藤新一 OR 毛利探偵事務所]
  describe('B04012 filter:kind=character AND filterAny[妃英理 OR 工藤新一 OR 毛利探偵事務所]', () => {
    const args = abilityArgs(B04012, 0, 'deckRevealUntil')!;
    beforeEach(() => {
      _resetRegistry();
      registerCardDef(defOf({ id: 'ERI', names: ['妃英理'], traits: ['弁護士'] }));
      registerCardDef(defOf({ id: 'SHINICHI', names: ['工藤新一'], traits: ['高校生'] }));
      registerCardDef(defOf({ id: 'MOURI', names: ['毛利小五郎'], traits: ['毛利探偵事務所'] }));
      registerCardDef(defOf({ id: 'DECOY', names: ['灰原哀'], traits: ['黒ずくめの組織'] }));
      // 同名イベント (kind:event) — base filter kind:character の AND を検証
      registerCardDef(defOf({ id: 'EVENT_ERI', kind: 'event', names: ['妃英理'], traits: [] }));
    });
    it('3つの OR 枝 (名/名/特徴) いずれも match', () => {
      expect(reveal(args, ['ERI'])).toBe('ERI');
      expect(reveal(args, ['SHINICHI'])).toBe('SHINICHI');
      expect(reveal(args, ['MOURI'])).toBe('MOURI');
    });
    it('非該当 decoy は非 match', () => expect(reveal(args, ['DECOY'])).toBe(null));
    it('同名イベント(妃英理)は base filter kind:character の AND で除外', () =>
      expect(reveal(args, ['EVENT_ERI'])).toBe(null));
  });

  // B07035 古畑恵: filterAny[黒羽快斗 OR 怪盗キッド OR ビッグジュエル], 「カード」= kind 制約なし
  describe('B07035 filterAny[黒羽快斗 OR 怪盗キッド OR ビッグジュエル-特徴], kind 制約なし (「カード」)', () => {
    const args = abilityArgs(B07035, 0, 'deckRevealUntil')!;
    beforeEach(() => {
      _resetRegistry();
      registerCardDef(defOf({ id: 'KAITO', names: ['黒羽快斗'], traits: ['高校生'] }));
      registerCardDef(defOf({ id: 'KID', names: ['怪盗キッド'], traits: ['怪盗'] }));
      // ビッグジュエル特徴の **イベント** — 「カード」(kind 無指定) なので event も match すること
      registerCardDef(defOf({ id: 'JEWEL_EV', kind: 'event', names: ['ブルーワンダー'], traits: ['ビッグジュエル'] }));
      registerCardDef(defOf({ id: 'DECOY', names: ['毛利蘭'], traits: ['高校生'] }));
    });
    it('名前枝 (黒羽快斗 / 怪盗キッド) match', () => {
      expect(reveal(args, ['KAITO'])).toBe('KAITO');
      expect(reveal(args, ['KID'])).toBe('KID');
    });
    it('ビッグジュエル特徴の event も match (「カード」= kind 制約なし)', () =>
      expect(reveal(args, ['JEWEL_EV'])).toBe('JEWEL_EV'));
    it('非該当 decoy は非 match', () => expect(reveal(args, ['DECOY'])).toBe(null));
  });
});
