/**
 * トリアージ・スイープ (2026-06-15) — 全未実装カードの現行 engine 再分類
 *
 * 目的: ゴール地点確定。未実装カタログ全体 (= catalog − live ALL_CARDS) を distinct signature 化し、
 *       **現行 engine (cluster1〜14 + BUG-132/140/144〜146 出荷後)** の gate 一覧に対し決定的に再分類する。
 *
 * 2026-06-06 の classify.ts (catalog-survey) は engine が ALL_CARDS=978 時点の gate で書かれており、以降
 *   - continuous-aura 数値 (cluster13: apDeltaAura/lpDeltaAura/auraFilter)
 *   - enter-source level/attribute (cluster11: enterSource condition)
 *   - multi-card sceneEnter (cluster14: sceneEnter cardIds)
 *   - nested-filter-dyn / FILE枚数以下レベル登場 (cluster12)
 *   - charModifyLevel / sceneToDeck / fileRemoveTop / fileFlipTop / removeAreaAllToDeckBottom verb
 * が解消済のため、それらを yellow と誤判定する。本スクリプトは **解消済 gate を除去 + 新 gate を追加** した
 * 現行 gate 一覧で全 signature を再分類する。
 *
 * ⚠ 決定論分類はあくまで **certify queue の優先付け + 明白ケースの bucketing** に使う HEURISTIC。
 *    真の gate 判定は per-card certify (grounding→敵対 refute) で確定する (card-wave skill / triage 教訓:
 *    「landscape の未精読 gate の risk 評価は信用しない」)。partial gate は保守的に yellow→certify 送り。
 *
 * 出力: .tmp/sweep/landscape.json (全分類) + .tmp/sweep/certify-queue.json (rep + clone + 優先順)
 * 使い方: npx tsx scripts/survey/sweep-2026-06-15.ts
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALL_CARDS } from '@/cards/index.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = join(ROOT, '.claude', 'specs', 'cards-data');
const OUT_DIR = join(ROOT, '.tmp', 'sweep');

type Kind = 'character' | 'event' | 'case' | 'partner';
interface CatalogCard {
  cardNum: string; title: string; kind: Kind; pkg: string;
  color: string; level: string; ap: string; lp: string; features: string;
  effect: string; cutIn: string; hirameki: string; henso: string;
}

function parseTsv(path: string): Record<string, string>[] {
  const raw = readFileSync(path, 'utf8').replace(/\r/g, '');
  const lines = raw.split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const header = lines[0].split('\t');
  return lines.slice(1).map((line) => {
    const cells = line.split('\t');
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ''));
    return row;
  });
}

function loadCatalog(): CatalogCard[] {
  const pkgs = readdirSync(DATA_DIR).filter((d) => /^(ct-[dp]\d\d|pr-\d\d)$/.test(d));
  const out: CatalogCard[] = [];
  const kinds: Kind[] = ['character', 'event', 'case', 'partner'];
  for (const pkg of pkgs) {
    for (const kind of kinds) {
      const path = join(DATA_DIR, pkg, `${kind}.tsv`);
      if (!existsSync(path)) continue;
      for (const r of parseTsv(path)) {
        if (!r.cardNum) continue;
        out.push({
          cardNum: r.cardNum, title: r.title ?? '', kind, pkg,
          color: r.color ?? '', level: r.level ?? '', ap: r.ap ?? '', lp: r.lp ?? '',
          features: r.features ?? '', effect: r.effect ?? '', cutIn: r.cutIn ?? '',
          hirameki: r.hirameki ?? '', henso: r.henso ?? '',
        });
      }
    }
  }
  return out;
}

/** 保守的 signature (build-remaining.ts と同一)。色違い・数値違い・名前違いの同型再録のみ merge。 */
function signature(c: CatalogCard): string {
  const body = [c.kind, c.effect, c.cutIn, c.hirameki, c.henso].join('');
  return body
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/\d+/g, '#')
    .replace(/[赤青黄緑白黒]/g, '◆')
    .replace(/［[^］]*］/g, '［・］')
    .replace(/\s+/g, '')
    .trim();
}

/**
 * gate 定義: label + verdict + 正規表現。優先順位は配列順 (上から最初に当たった gate を採用)。
 * status: 'open'=未解消 / 'partial'=一部解消 (保守的に yellow→certify) / (resolved gate は本配列から除去済)
 * 各 gate は live src/engine grep + cluster 履歴で裏取り済 (2026-06-15)。
 */
interface Gate { label: string; verdict: 'black' | 'yellow'; status: 'open' | 'partial'; re: RegExp; note?: string }

const GATES: Gate[] = [
  // ── ⚫ BLACK: 構造ブロッカ (PlayerState に slot 無し、XL/high-risk) ──
  { label: 'partner-area-structure (ビッグジュエル/MR列挙)', verdict: 'black', status: 'open', re: /ビッグジュエル/ },
  { label: 'partner-area-structure', verdict: 'black', status: 'open',
    re: /パートナーエリア(に|の|へ)(.{0,14})(置く|移す|登場|加える|ある場合|いる場合)/,
    note: 'partner-area に本体パートナー以外のカードを置く/参照 — PlayerState slot 無 (triage 17枚, B07045同型)' },

  // ── name-designation (NEW gate, 2026-06-15 追加; engine に designat/declaredName 痕跡なし) ──
  { label: 'name-designation', verdict: 'yellow', status: 'open',
    re: /カード名を[0-9０-９]*(つ|個|枚)?\s*指定/,
    note: '「カード名を1つ指定し」宣言 UI + designated-name 比較 condition が不在 (triage 9枚, XL)' },

  // ── loseGame / partner-ability rewrite (compound, high-risk; cluster10 で 0 bare-verb 確認) ──
  { label: 'loseGame / partner-ability-rewrite', verdict: 'yellow', status: 'open',
    re: /(ゲームに(敗北|負け)|敗北する|事件解決(を|の)[^。]{0,16}(代わりに|失う|書き換|得る代|持たな)|証拠隠滅)/,
    note: '勝利条件ロジック介入 (canWin/solveCase) — 骨格ハードワイヤ改変 = 骨格凍結違反相当 (XL)' },

  // ── charSetAP/LP set-exact (throw stub; 元のAPを0/Nは charOverrideAP で別) ──
  { label: 'charSetAP/LP set-exact verb', verdict: 'yellow', status: 'open',
    re: /(?<!元の)(AP|LP|ＡＰ|ＬＰ)を[1-9０-９][0-9０-９]*に(する|して)/,
    note: 'charSetAP/charSetLP は throw stub (mutate.char.setExact 未定義)。元のAP→charOverrideAP は実装済' },

  // ── auraGrant: 他キャラへ keyword/能力テキストを継続付与 (cluster13 は数値 aura のみ) ──
  { label: 'auraGrant-keyword/textual (他キャラへ能力付与)', verdict: 'yellow', status: 'open',
    re: /(全て|すべて|全員|それぞれ|他の自分の|自分の他の|現場にいる)の?(自分の)?(現場の)?(キャラ|特徴\S{0,12}のキャラ)(は|が).{0,18}(〚|「|『|【)?(迅速|突撃|ブレット|疾風|変装|ガード|現場リムーブ時|登場時)/,
    note: 'aura で keyword/triggered 能力テキストを継続付与 (B09024型) — 数値 aura(cluster13)とは別機構' },

  // ── MR / color-count filter (isMR / N色以上 — TargetFilter に無し) ──
  { label: 'MR / color-count filter', verdict: 'yellow', status: 'open', re: /[0-9０-９]色以上/ },
  { label: 'MR / color-count filter', verdict: 'yellow', status: 'open',
    re: /(ミステリーレア|ＭＲ|[^A-Za-z]MR[^A-Za-z]).{0,20}(キャラ|カード)を(.{0,6})(選び|公開|登場|リムーブ|手札)/,
    note: 'isMR filter 無し' },

  // ── hand-count exact condition (手札がN枚ちょうど — handAtLeast は ≥N のみ) ──
  { label: 'hand-count condition (exact/becomes)', verdict: 'yellow', status: 'partial',
    re: /手札が[0-9０-９]+枚(になる|である場合|の場合|だった)/,
    note: 'handAtLeast(≥N)は実装済。exact/「N枚になるまで」は別。partial→certify で確定' },

  // ── remove-area count dyn (リムーブエリアの【カットイン】持ち枚数 等; cost/X1 は可、dyn 値は別) ──
  { label: 'remove-area keyword-count dyn', verdict: 'yellow', status: 'partial',
    re: /リムーブエリア(に|の)(ある)?[^。]{0,24}(を持つ|【カットイン】|【[赤青黄緑白黒]】)[^。]{0,12}[0-9０-９]+枚(に|につき)/,
    note: 'removeColorAtLeast condition は実装済。「1枚につき AP+N」の count dyn は別 (B07098)' },

  // ── cutin-subtype filter (【カットイン】AP+ 等の subtype) — keyword filter は icon 名のみ ──
  { label: 'cutin-subtype filter (ability-subtype presence)', verdict: 'yellow', status: 'open', re: /【カットイン】\s*(AP|LP|ＡＰ|ＬＰ)[＋+]/,
    note: 'window1 certify(D06003)で確定: keyword filter は「任意のカットイン」のみ、「【カットイン】AP+」subtype 識別子無' },

  // ── set-card → host へ triggered 能力付与 / set-card → 証拠/手札 ──
  { label: 'set-card confers ability / to evidence', verdict: 'yellow', status: 'open',
    re: /セット(されている|した)[^。]{0,40}(を持つ|を得る|の能力|証拠として得る|手札に加え)/,
    note: 'set card の能力を host が走査しない / set card→証拠 verb 無' },

  // ── grant turn-end-removal to OTHER char ──
  { label: 'grant turn-end-removal to char', verdict: 'yellow', status: 'open',
    re: /(選び|選んだ)[^。]{0,20}「?ターン終了時[^。]{0,12}リムーブ[^。]{0,4}」?を(持つ|与え)/ },

  // ── 可変枚数 discard→同数draw / 好きな枚数 select / 好きな枚数公開 ──
  { label: 'variable-count select/reveal/discard', verdict: 'yellow', status: 'open',
    re: /(好きな枚数|好きな数|手札を[^。]{0,8}まで)[^。]{0,24}(リムーブ|捨て|公開|選び|表向き|引)/,
    note: '可変枚数 select + count 結合 dyn 不在 (0枚可否も要公式照会)' },

  // ── FILE-zone effect (相手FILE表向き等; fileRemoveTop/fileFlipTop は自FILE; filePopToHand=ネクストヒント) ──
  { label: 'FILE-zone effect verb (opp/structural)', verdict: 'yellow', status: 'partial',
    re: /FILEエリア/,
    note: 'fileRemoveTop/fileFlipTop/sceneToDeck は実装済(E2/E3)。相手FILE操作/FILE枚数以下登場等は要 certify' },

  // ── 非アイコン能力 (現場リムーブ時/疾風等) の所持で filter ──
  { label: 'non-icon ability-presence filter', verdict: 'yellow', status: 'open',
    re: /(【現場リムーブ時】|【疾風】|【登場時】|【変装時】)[^。]{0,6}を?持つ(キャラ|カード|【)/,
    note: 'keyword filter は icon/keyword 名のみ。hook系(【現場リムーブ時】等)持ち filter は不可' },

  // ── card-name 書き換え verb / としても扱う / 特徴 set/remove verb ──
  { label: 'card-name rewrite / treat-as-name verb', verdict: 'yellow', status: 'open',
    re: /(カード名を[^。]{0,34}書き換え|としても扱う)/ },
  { label: 'trait set/remove verb', verdict: 'yellow', status: 'open', re: /〚?特徴［[^］]+］〛?を失/ },

  // ── untargetable / targeted-by trigger / negate ──
  { label: 'untargetable grant', verdict: 'yellow', status: 'open', re: /(能力や効果|能力|効果)によって選ばれな/ },
  { label: 'targeted-by-opponent trigger', verdict: 'yellow', status: 'open', re: /(能力や効果|能力)によって選ばれたとき/ },
  { label: 'negate/replace effect', verdict: 'yellow', status: 'open', re: /(それを|を)無効にする/ },

  // ── dynamic stat-extremum / relative filter ──
  { label: 'dynamic stat-extremum compare', verdict: 'yellow', status: 'open', re: /(もっとも|最も)(高い|低い)(LP|AP|ＬＰ|ＡＰ|レベル|キャラ)/ },
  { label: 'dynamic-AP/LP-relative filter', verdict: 'yellow', status: 'open', re: /この(キャラ|カード)の(AP|LP|ＡＰ|ＬＰ)以(下|上)の(AP|LP|ＡＰ|ＬＰ)/ },

  // ── evidence peek/move verb (証拠を見る/positional 手札移動) ──
  { label: 'evidence peek/move verb', verdict: 'yellow', status: 'open',
    re: /(自分|相手)?の?証拠を上から[0-9０-９]+つ(見る|手札に加え)/ },

  // ── evidence-gain-by-action trigger (アクション[事件]で証拠を得たとき) ──
  { label: 'evidence-gain-by-action trigger', verdict: 'yellow', status: 'open',
    re: /アクション[［[]事件[］\]][^。]{0,16}証拠を得たとき/ },

  // ── action-subtype trigger (triggerActionKind は実装済だが「した/する」効果の細分は要 certify) ──
  { label: 'action-subtype trigger/effect', verdict: 'yellow', status: 'partial',
    re: /アクション[［[](キャラ|事件)[］\]]した(とき|時)/,
    note: 'triggerActionKind condition は実装済。action[キャラ/事件] 種別 trigger は certify で確定' },

  // ── 「…」非キーワード能力テキストの付与 ──
  { label: 'grant textual (non-keyword) ability', verdict: 'yellow', status: 'open', re: /「[^」]{10,}」を(与え|持つ|持た)/ },

  // ── scene→deck effect (sceneToDeck verb は実装済 — partial で certify 確認) ──
  { label: 'scene→deck verb', verdict: 'yellow', status: 'partial',
    re: /(現場にいる|現場の|相手の現場|自分の現場|このキャラを現場|キャラを1枚まで選び、)[^。〛]{0,22}デッキの(上|下|一番上|一番下)に移す/,
    note: 'sceneToDeck verb (E2) は実装済。pick経路/相手側は certify で確定' },

  // ── play-event-from-effect / janken / cross-side count / action-target restriction / suppression ──
  { label: 'play-event-from-effect verb', verdict: 'yellow', status: 'open',
    re: /(手札から|リムーブエリアにある)[^。]{0,26}イベントを[^。]{0,10}(使用する|使う。)/ },
  { label: 'janken mechanic', verdict: 'yellow', status: 'open', re: /じゃんけん/ },
  { label: 'cross-side count compare', verdict: 'yellow', status: 'open', re: /現場にいるキャラが相手の現場にいるキャラより(少ない|多い)/ },
  { label: 'action-target restriction', verdict: 'yellow', status: 'open', re: /指定してアクションできない/ },
  { label: 'auto-activate suppression', verdict: 'yellow', status: 'open', re: /オートフェイズに[^。]{0,10}アクティブにならない/ },
  { label: 'hirameki/refresh suppression', verdict: 'yellow', status: 'partial',
    re: /(【ヒラメキ】を発動でき|リフレッシュによって証拠を得られ|証拠を得られない)/,
    note: 'setHiramekiSuppress(cluster8) は action-scope opp-hirameki。他形は certify' },

  // ── usage restriction (setEventUseBan / cluster5 restrictsOpponent は一部実装済) ──
  { label: 'usage restriction (cutin/event)', verdict: 'yellow', status: 'partial',
    re: /([】をは] ?)?(【カットイン】|イベント|【変装】)を(使用|使え|使うこと)[^。]{0,4}でき(ない|なくなる)/,
    note: 'setEventUseBan(cluster6)/restrictsOpponent aura(cluster5) は一部。対象/持続で certify' },

  // ════ window-1 certify (2026-06-15) で発見した NEW gate (決定論 regex が捕捉していなかった false-green 源) ════
  // next-hint-source trigger discriminator (「ネクストヒントで〜使用したとき」— next-hint/hand-use payload 同形)
  { label: 'next-hint-source trigger', verdict: 'yellow', status: 'open', re: /ネクストヒントで[^。]{0,16}(使用|使っ)/,
    note: 'next-hint.ts と hand-use-card.ts の effect:declared payload が同形、経路区別フィールド無 (B05005/B01005)' },
  // hand-size 由来の動的 count (draw-until-N / discard-until-N / 引いた枚数と同じ — draw.n に {dyn} 無)
  { label: 'hand-size dynamic count', verdict: 'yellow', status: 'open',
    re: /(手札が[0-9０-９]+枚になるまで|引いた枚数と同じ|手札を(すべて|全て)リムーブ)/,
    note: 'draw.n/discard.n は literal のみ、$self に handCount placeholder 無 (B07076/B08047/B04048)' },
  // used-card-level / $trigger dyn root (「そのカードのレベル以下」)
  { label: 'used-card-attr dyn ($trigger root)', verdict: 'yellow', status: 'open',
    re: /そのカードのレベル以(下|上)/,
    note: 'evalDyn placeholder root に $trigger 無、使用カードの level を pick filter へ流せない (B01005)' },
  // deck-bottom reveal/inspect primitive (デッキの下から公開 — top-only)
  { label: 'deck-bottom reveal verb', verdict: 'yellow', status: 'open', re: /デッキ[^。]{0,8}下から[^。]{0,8}公開/,
    note: 'deckRevealUntil は top のみ、bottom-reveal/inspect primitive 無 (B03049)' },
  // scene→evidence verb (このキャラを証拠として得る — selfToEvidence は event 専用)
  { label: 'scene→evidence verb', verdict: 'yellow', status: 'open',
    re: /(このキャラ|現場[^。]{0,8}キャラ)を[^。]{0,12}証拠として得る/,
    note: 'scene→evidence verb 無 (selfToEvidence は使用イベント自身のみ, B02088)' },
  // event-self-set (このイベントを〜キャラにセット — charSetCard は deck-top/bindref のみ)
  { label: 'event-self-set verb', verdict: 'yellow', status: 'open', re: /このイベントを[^。]{0,16}(キャラ|現場)[^。]{0,8}セット/,
    note: 'charSetCard は cardId を deck-top/bindref からのみ、ctx.source.cardId(使用イベント自身) を set 不可 (B01023/B02013)' },
  // hand-use color-override (色を無視 — colorAllowed ハードワイヤ)
  { label: 'hand-use color-override', verdict: 'yellow', status: 'open',
    re: /(事件(カード)?の色を無視|色を無視して(手札|使用)|色制限を(無視|受けない))/,
    note: 'hand-use-card/next-hint colorAllowed() は static def.colors 比較、per-card override 無 (B03126)' },
  // action-eligibility ban (〜の場合アクションできない — 否定的 action 抑制)
  { label: 'action-eligibility ban', verdict: 'yellow', status: 'open', re: /(いない場合|ない場合)[^。]{0,14}アクションできない/,
    note: '_canAction は active + named-exception のみ gate、否定条件 action ban 無 (B07005)' },
  // cutin/変装 ban を declared/event から (continuous-aura opponentRestrict のみが既存機構)
  { label: 'cutin/disguise ban (non-continuous)', verdict: 'yellow', status: 'open',
    re: /(【カットイン】|【変装】)(と【変装】)?を(使用|使え)[^。]{0,4}でき(ない|なくなる)/,
    note: 'opponentRestrict は continuous-aura のみ。declared/event/turn-scoped の cutin/変装 ban verb 無 (B05007/B07002/B07076)' },
  // hand→deck-bottom verb (手札をデッキの下に — hand は discard(→remove) しか出口が無い)
  { label: 'hand→deck-bottom verb', verdict: 'yellow', status: 'open', re: /手札(から|の)?[^。]{0,16}デッキの(一番)?下に移す/,
    note: 'hand→deck-bottom verb 無 (B04048)' },
  // set-card → host triggered 能力付与 (grant 非キーワード能力 via set card) — 既存 set-card gate を補強
  { label: 'set-card → host triggered ability', verdict: 'yellow', status: 'open',
    re: /(セットされているキャラは|セットした.{0,8}キャラは)[^。]{0,4}「/,
    note: 'set card が host に triggered 能力テキストを付与 (charGrantAbility は turn-scoped、set 連動不可, B01023/B03080)' },
  // usage-restriction が ability.condition 非評価 (このイベントは〜の場合に使用できる = vacuous-use のみ)
  { label: 'hand-use ability.condition not enforced', verdict: 'yellow', status: 'open',
    re: /このイベントは[^。]{0,30}場合に(のみ)?使用できる/,
    note: 'handUseGateCommon は ability.condition 非参照、「使用できる」gate は vacuous-use 近似のみ (B04027)' },

  // ════ window-2 certify (2026-06-15) で発見した NEW gate (green-candidate false-green 65% の主因、繰り返しゲート) ════
  // contact-removal-by-this-char trigger (「(このキャラとの)コンタクトによってリムーブされたとき」) — 最大の隠れゲート
  { label: 'contact-removal-by-self trigger', verdict: 'yellow', status: 'open', re: /コンタクトによってリムーブされたとき/,
    note: 'leave:to-remove payload に攻撃者 uid 無、contact:judge は card 非購読 (PR136/B01010/B04004/B05009/B07017, mem11694/B01007)' },
  // stacked-card identity 操作 (下に重なっているカード参照 / 重ねた合計 / scene-self を下に重ねる) — stackedCards は count のみ
  { label: 'stacked-card identity ops', verdict: 'yellow', status: 'open',
    re: /(下に重なっているカード|重ねた[^。]{0,10}レベルの合計|このキャラを[^。]{0,10}下に重ねる)/,
    note: 'stackedCards は識別子無 count のみ。identity/transfer/sum/cost-remove 不可 (B06005/B08003/B06008)' },
  // remove→deck-bottom EFFECT verb (selective/self-scoped) — removeAreaAllToDeckBottom は両者全件、cost-kind は宣言のみ
  { label: 'remove→deck-bottom effect verb (selective/self)', verdict: 'yellow', status: 'open',
    re: /リムーブエリア(に|の)(ある)?[^。]{0,24}デッキの(一番)?下に移/,
    note: 'removeAreaAllToDeckBottom は両者全件 drain、selective/self-scoped EFFECT verb 無 (B02076/B04038, B08066 family)' },
  // continuous level set-exact / hand-card stat modifier (「レベルNになる」「手札にある〜AP/LP」)
  { label: 'continuous level-set / hand-card stat', verdict: 'yellow', status: 'open',
    re: /(手札にある[^。]{0,12}(レベル|AP|LP|ＡＰ|ＬＰ)|レベル[0-9０-９]+になる)/,
    note: 'ContinuousModifier に level 無、charSetLevel/Override 無、hand-card stat 上書き経路無 (B01009)' },
  // set-card count condition (cross-char + 裏向き filter) — stackedCountAtLeast は per-char count のみ
  { label: 'set-card count condition', verdict: 'yellow', status: 'open',
    re: /セットされているカードが[^。]{0,10}[0-9０-９]+枚以上/,
    note: 'set card の枚数 condition (cross-char sum + faceUp filter) 無、stackedCountAtLeast は別機構 per-char (PR200)' },

  // ════ window-3 certify (2026-06-15) で発見した NEW gate ════
  // mill-bind / milled-card-identity condition (「これによって〜がリムーブされた場合」) — mill は bind しない
  { label: 'milled-card identity condition', verdict: 'yellow', status: 'open', re: /これによって[^。]{0,24}(リムーブされた|リムーブした)場合/,
    note: 'mill は removed cardId を bind しない、removeTrait/NameAtLeast は累積 remove を数えるため誤判定 (PR201/B05068)' },
  // removal-cause condition (「コンタクトによってリムーブされた場合」等 — payload.cause を読む condition 無)
  { label: 'removal-cause condition', verdict: 'yellow', status: 'open', re: /(コンタクト|効果|能力)によってリムーブされた場合/,
    note: 'leave:to-remove payload.cause を読む condition 無 (B01035, contact-removal の cause-gate 変種)' },
  // setcard:enter / set-onto trigger (「カードがセットされるたび/とき」) — setcard:leave のみ存在
  { label: 'setcard:enter trigger', verdict: 'yellow', status: 'open', re: /カード(が|を)[0-9０-９]*枚?セットされる(たび|とき)/,
    note: 'set-onto hook 無 (setcard:leave のみ)、mutate.char.setCard は emit しない (B02018)' },
  // stunChar declared cost (「スタンさせる」コスト) — sleepChar は sleep hardcode
  { label: 'stunChar cost verb', verdict: 'yellow', status: 'open', re: /(スタンさせ|スタン状態にさせ)[^。]{0,6}(：|:)/,
    note: 'stun コスト verb 無、sleepChar は sleep hardcode (B08004)' },
  // third-party cutin/disguise-use reaction (「相手が【カットイン】か【変装】を使用したとき」)
  { label: 'cutin/disguise-use reaction trigger', verdict: 'yellow', status: 'open', re: /相手が[^。]{0,4}(【カットイン】|【変装】)[^。]{0,6}を?使用したとき/,
    note: '第三者反応 hook 無 (disguise:into=selfOnly, cutin matcher は __eventUse のみ, B02030 前例 DEFER, PR029)' },
  // remove-area cardName-count dyn ($self.removeName.<name> for AP scaling)
  { label: 'remove-area name-count dyn', verdict: 'yellow', status: 'open', re: /リムーブエリア(に|の)(ある)?[^。]{0,16}［[^］]+］[^。]{0,8}[0-9０-９]+枚?につき/,
    note: 'リムーブの cardName 一致枚数で AP scaling、$self.removeName dyn placeholder 無 (PR158)' },
  // deckRevealUntil cross-field OR filter (「カード名Xか特徴Yのキャラ」reveal) — predicate は AND のみ
  { label: 'deckRevealUntil cross-field OR filter', verdict: 'yellow', status: 'open', re: /(デッキ|上から)[^。]{0,30}([カード名特徴]\S{0,10}か[特徴カード名])[^。]{0,16}(出るまで|公開)/,
    note: 'deckRevealUntil predicate は conjunctive AND のみ、filterAny 非対応 (B03016)' },
  // evidence face-down flip + pick (「表向きの証拠を裏向きにする」) — evidenceFlip は face-up専用+idx固定
  { label: 'evidence face-down-flip / pick', verdict: 'yellow', status: 'open', re: /(表向きの)?証拠を[^。]{0,8}裏向きに(する|し)/,
    note: 'evidenceFlip は face-up専用 + idx 固定 (pick 不可)、face-down 化 mutator 無 (B06017)' },

  // ── souza-discovered reference / deck top-bottom choose / mustGuard / acted-this-turn / forced-target ──
  { label: 'souza-discovered reference', verdict: 'yellow', status: 'open', re: /発見された場合/ },
  { label: 'deck top/bottom choose', verdict: 'yellow', status: 'open', re: /デッキの(上か下|一番上か一番下|下か上)に移す/ },
  { label: 'mustGuard / forced-target', verdict: 'yellow', status: 'open',
    re: /(選べる場合[^。]{0,4}必ず選ぶ|ガードできる場合[^。]{0,6}必ずガード)/,
    note: 'guard 強制の AI/UI 同時追従 (GuardPickerModal forced 化) — triage 2枚' },
  { label: 'acted-this-turn filter', verdict: 'yellow', status: 'open',
    re: /このターン中に[^。]{0,18}(アクション|推理)[^。]{0,8}(していた|した)[^。]{0,10}(キャラ|を1枚)/ },
];

function main() {
  const implemented = new Set(ALL_CARDS.map((c) => c.id));
  const catalog = loadCatalog();
  const remaining = catalog.filter((c) => !implemented.has(c.cardNum));

  // signature でクラスタ化
  const clusters = new Map<string, CatalogCard[]>();
  for (const c of remaining) {
    const sig = signature(c);
    (clusters.get(sig) ?? clusters.set(sig, []).get(sig)!).push(c);
  }

  interface Row { rep: string; size: number; kind: Kind; title: string; text: string;
    verdict: 'black' | 'yellow' | 'greenCandidate'; gate?: string; status?: string; note?: string;
    members: string[]; color: string; level: string; ap: string; lp: string; features: string;
    effect: string; cutIn: string; hirameki: string; henso: string }

  const rows: Row[] = [];
  for (const [, members] of clusters) {
    members.sort((a, b) => a.cardNum.localeCompare(b.cardNum));
    const rep = members[0];
    const text = [rep.effect, rep.cutIn, rep.hirameki, rep.henso].filter(Boolean).join(' / ');
    let matched: Gate | undefined;
    for (const g of GATES) { if (g.re.test(text)) { matched = g; break; } }
    rows.push({
      rep: rep.cardNum, size: members.length, kind: rep.kind, title: rep.title, text,
      verdict: matched ? matched.verdict === 'black' ? 'black' : 'yellow' : 'greenCandidate',
      gate: matched?.label, status: matched?.status, note: matched?.note,
      members: members.map((m) => m.cardNum),
      color: rep.color, level: rep.level, ap: rep.ap, lp: rep.lp, features: rep.features,
      effect: rep.effect, cutIn: rep.cutIn, hirameki: rep.hirameki, henso: rep.henso,
    });
  }

  const cardsIn = (arr: Row[]) => arr.reduce((s, x) => s + x.size, 0);
  const black = rows.filter((r) => r.verdict === 'black');
  const yellow = rows.filter((r) => r.verdict === 'yellow');
  const green = rows.filter((r) => r.verdict === 'greenCandidate');

  // gate 別集計 (sig / cards)
  const byGate: Record<string, { sig: number; cards: number; status: string }> = {};
  for (const r of [...black, ...yellow]) {
    const k = r.gate!;
    if (!byGate[k]) byGate[k] = { sig: 0, cards: 0, status: r.status! };
    byGate[k].sig++; byGate[k].cards += r.size;
  }

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
  const landscape = {
    generated: 'scripts/survey/sweep-2026-06-15.ts',
    asOf: '2026-06-15 (cluster1〜14 + UI DM 出荷後, ALL_CARDS=' + implemented.size + ')',
    catalogTotal: catalog.length,
    implemented: implemented.size,
    remainingCards: remaining.length,
    distinctSignatures: clusters.size,
    counts: {
      black: { sig: black.length, cards: cardsIn(black) },
      yellow: { sig: yellow.length, cards: cardsIn(yellow) },
      greenCandidate: { sig: green.length, cards: cardsIn(green) },
    },
    byGate,
    black, yellow, greenCandidate: green,
  };
  writeFileSync(join(OUT_DIR, 'landscape.json'), JSON.stringify(landscape, null, 1));

  // certify queue: green-candidate 優先 → partial gate → open gate → black の順 (sig rep のみ、size desc)
  const prio = (r: Row) => r.verdict === 'greenCandidate' ? 0 : r.status === 'partial' ? 1 : r.verdict === 'yellow' ? 2 : 3;
  const queue = [...rows].sort((a, b) => prio(a) - prio(b) || b.size - a.size || a.rep.localeCompare(b.rep))
    .map((r) => ({
      rep: r.rep, kind: r.kind, title: r.title, color: r.color, level: r.level, ap: r.ap, lp: r.lp,
      features: r.features, effect: r.effect, cutIn: r.cutIn, hirameki: r.hirameki, henso: r.henso,
      cloneTargets: r.members.slice(1), priorVerdict: r.verdict, priorGate: r.gate ?? null, priorStatus: r.status ?? null,
    }));
  writeFileSync(join(OUT_DIR, 'certify-queue.json'), JSON.stringify({ generated: 'sweep-2026-06-15.ts', count: queue.length, items: queue }, null, 1));

  const e = console.error;
  e('=== トリアージ・スイープ landscape (2026-06-15, 現行engine) ===');
  e(`catalog total      : ${catalog.length}`);
  e(`implemented        : ${implemented.size}`);
  e(`remaining cards    : ${remaining.length}`);
  e(`distinct signatures: ${clusters.size}`);
  e(`  🟢 green-candidate (gate未検出, 要certify): ${green.length} sig / ${cardsIn(green)} cards`);
  e(`  🟡 yellow (engine新機能要)               : ${yellow.length} sig / ${cardsIn(yellow)} cards`);
  e(`  ⚫ black  (構造ブロッカ)                  : ${black.length} sig / ${cardsIn(black)} cards`);
  e('--- gate 別内訳 (sig / cards, status) [size desc] ---');
  for (const [g, v] of Object.entries(byGate).sort((a, b) => b[1].cards - a[1].cards)) {
    e(`  ${v.sig.toString().padStart(3)} sig /${v.cards.toString().padStart(4)} cards  [${v.status}]  ${g}`);
  }
  e(`\nwrote ${join(OUT_DIR, 'landscape.json')} + certify-queue.json (${queue.length} reps)`);
}

main();
