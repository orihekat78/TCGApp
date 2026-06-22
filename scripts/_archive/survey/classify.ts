/**
 * Task A 再分類サーベイ — gate 検出トリアージ (2026-06-07, inline 分類)
 *
 * capability-map.txt (現行 engine 権威リファレンス) の「依然 DEFER のゲート」を
 * テキストパターンとして符号化し、remaining-to-classify.json の各 rep を
 *   ⚫ black  = 構造ブロッカ (partner-area entity slot / ビッグジュエル)
 *   🟡 yellow = engine 新機能要 (どの不足機能かラベル付き)
 *   🟢 green? = 既知ブロッカ未検出 = engine変更0 実装可能 **候補** (要 hand-verify)
 * に振り分ける。green は false-green が危険なので必ず人手で全句マッピング確認する。
 *
 * 出力: .claude/specs/catalog-survey-2026-06-06/classify-triage.json
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SURVEY_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '.claude', 'specs', 'catalog-survey-2026-06-06');

interface Todo {
  rep: string; size: number; kind: string; members: string[]; title: string;
  color: string; level: string; ap: string; lp: string; features: string;
  effect: string; cutIn: string; hirameki: string; henso: string;
}

/** gate 定義: label + verdict + 正規表現 (text 全体に対し test)。優先順位は配列順。 */
interface Gate { label: string; verdict: 'black' | 'yellow'; re: RegExp; note?: string }

const GATES: Gate[] = [
  // ── ⚫ BLACK: 構造ブロッカ (GameState 枠が無い、恒久 DEFER) ──
  { label: 'partner-area entity slot (ビッグジュエル)', verdict: 'black', re: /ビッグジュエル/ },
  { label: 'partner-area entity slot', verdict: 'black',
    re: /パートナーエリア(に|の|へ)(.{0,14})(置く|移す|登場|加える|ある場合|いる場合)/,
    note: 'partner-area に本体パートナー以外のカードを置く/参照 — GameState 枠無 (B07045同型)' },

  // ── 🟡 YELLOW: engine 新機能要 ──
  // MR / 色数 filter (isMR / 2色以上 / 色数) — TargetFilter に colorCount/isMR 無し
  { label: 'MR / color-count filter', verdict: 'yellow', re: /[0-9０-９]色以上/ },
  { label: 'MR / color-count filter', verdict: 'yellow', re: /(ミステリーレア|ＭＲ|[^A-Za-z]MR[^A-Za-z]).{0,20}(キャラ|カード)を(.{0,6})(選び|公開|登場|リムーブ|手札)/,
    note: 'isMR filter 無し' },
  // loseGame / defeat verb 無し
  { label: 'loseGame/defeat verb', verdict: 'yellow', re: /(ゲームに(敗北|負け)|敗北する)/ },
  // continuous aura — 他キャラへの継続付与 (現場の特徴X全員 / それぞれ / 他の自分のキャラは AP±)
  { label: 'continuous-aura (other chars)', verdict: 'yellow',
    re: /(全て|すべて|全員|それぞれ|他の自分の|自分の他の)の?(自分の)?(現場の)?(キャラ|特徴\S{0,12}のキャラ)(は|が|を).{0,12}(AP|LP|ＡＰ|ＬＰ)[＋－+-]/,
    note: 'continuousModifier は owner専用 (aura不可)' },
  { label: 'continuous-aura (grant keyword to others)', verdict: 'yellow',
    re: /(全て|すべて|全員|それぞれ|他の自分の|自分の他の)の?(自分の)?(現場の)?(キャラ|特徴\S{0,12}のキャラ)(は|が).{0,16}(〚|「|『)?(迅速|突撃|ブレット|疾風|変装|ガード)/,
    note: 'aura keyword grant 不可' },
  // hand-count condition (手札がN枚)
  { label: 'hand-count condition', verdict: 'yellow', re: /手札が[0-9０-９]+枚/ },
  // remove-area → deck-bottom verb
  { label: 'remove-area → deck-bottom verb', verdict: 'yellow',
    re: /リムーブ(エリア)?(にある|の)[^。]{0,40}デッキの(一番)?下/ },
  // cutin-subtype filter (【カットイン】AP+ を持つカード)
  { label: 'cutin-subtype filter', verdict: 'yellow', re: /【カットイン】[^」』]{0,12}(を持つ|」を持つ)/ },
  // set-card confers ability to host
  { label: 'set-card confers ability to host', verdict: 'yellow',
    re: /セット(されている|した)[^。]{0,40}(を持つ|を得る|の能力)/,
    note: 'set card が host へ triggered 能力付与 — engine が set-card 能力を走査しない' },
  // grant turn-end-removal to OTHER char (このキャラ自身以外へ「ターン終了時リムーブ」付与)
  { label: 'grant turn-end-removal to char', verdict: 'yellow',
    re: /(選び|選んだ)[^。]{0,20}「?ターン終了時[^。]{0,12}リムーブ[^。]{0,4}」?を(持つ|与え)/ },
  // charSetAP/charSetLP (APをNにする, 元の/0 以外で上乗せ修正残す) — throw stub
  { label: 'charSetAP/LP (set-exact) verb', verdict: 'yellow',
    re: /(?<!元の)(AP|LP|ＡＰ|ＬＰ)を[1-9０-９][0-9０-９]*に(する|して)/,
    note: 'APをNにする(mod残す)= charSetAP throw stub。元のAPを0/Nにする(charOverrideAP)は別' },
  // partner-ability rewrite (事件解決/アシストを書き換え・別能力付与)
  { label: 'partner-ability rewrite', verdict: 'yellow',
    re: /(事件解決|アシスト)(を|の)[^。]{0,16}(代わりに|失う|書き換|得る代|持たな)/ },
  // 可変枚数 discard→同数draw
  { label: 'variable discard→draw verb', verdict: 'yellow',
    re: /(好きな枚数|手札を[^。]{0,8}まで)[^。]{0,20}(リムーブ|捨て)[^。]{0,20}同じ枚数[^。]{0,8}引/ },

  // ── 追加 gate (dump 校正で発見) ──
  // FILE ゾーンを effect で操作 (filePopToHand=ネクストヒント以外の verb 無し: 相手FILE表向き/自FILEリムーブ等)
  { label: 'FILE-zone effect verb', verdict: 'yellow', re: /FILEエリア/,
    note: 'FILEゾーンの effect 操作 (相手FILE表向き/自FILE上からリムーブ/FILE枚数以下レベル登場) — filePopToHan 以外 verb 無' },
  // 非アイコン能力の所持で filter (defHasKeyword は カットイン/ヒラメキ/変装/ミスリード のみ)
  { label: 'non-icon ability-presence filter', verdict: 'yellow',
    re: /(【現場リムーブ時】|【疾風】|【登場時】|【変装時】|【ヒラメキ】を持つ)[^。]{0,6}を?持つ(キャラ|カード|【)/,
    note: '【現場リムーブ時】/【疾風】持ち等で候補 filter — keyword filter は icon 4種のみ' },
  // card-name 書き換え verb 無し
  { label: 'card-name rewrite verb', verdict: 'yellow', re: /カード名を[^。]{0,34}書き換え/ },
  // untargetable 付与 (選ばれない)
  { label: 'untargetable grant', verdict: 'yellow', re: /(能力や効果|能力|効果)によって選ばれな/ },
  // 「選ばれた/対象になった とき」trigger 無し
  { label: 'targeted-by-opponent trigger', verdict: 'yellow', re: /(能力や効果|能力)によって選ばれたとき/ },
  // negate / 無効化 (replace/negate は effect.run で throw, trigger層のみ)
  { label: 'negate/replace effect', verdict: 'yellow', re: /(それを|を)無効にする/ },
  // dynamic stat extremum (LP/APがもっとも高い/低い 比較)
  { label: 'dynamic stat-extremum compare', verdict: 'yellow', re: /(もっとも|最も)(高い|低い)(LP|AP|ＬＰ|ＡＰ|レベル|キャラ)/ },
  // evidence-gain-by-action trigger (アクション[事件]で証拠を得たとき) — hook 無し
  { label: 'evidence-gain-by-action trigger', verdict: 'yellow', re: /アクション[［[]事件[］\]][^。]{0,16}証拠を得たとき/ },
  // 可変枚数公開 cost / dyn (好きな枚数公開→合計以下)
  { label: 'variable-reveal cost / dyn', verdict: 'yellow', re: /好きな枚数[^。]{0,10}公開/ },
  // acted-this-turn filter (このターン中に〜していたキャラを選び)
  { label: 'acted-this-turn filter', verdict: 'yellow',
    re: /このターン中に[^。]{0,18}(アクション|推理)[^。]{0,8}(していた|した)[^。]{0,10}(キャラ|を1枚)/ },

  // ── 第3次 gate (dump 70-160 校正で発見) ──
  // 登場手段の summoner レベル参照 (enter payload は viaEffect/順序のみ)
  { label: 'enter-source-level filter', verdict: 'yellow',
    re: /レベル[0-9０-９]+以上の(キャラの能力|イベントの効果|カードの能力)[^。]{0,8}によって登場/ },
  // souza「発見された」参照効果 (souza は peek順そのまま戻すのみ)
  { label: 'souza-discovered reference', verdict: 'yellow', re: /発見された場合/ },
  // action:end は internal hook (card 不可)
  { label: 'action:end trigger (internal)', verdict: 'yellow', re: /アクション終了時[、,]/ },
  // アクション[キャラ]/[事件] 副種別 trigger (triggerCharMatches は payload.target 種別を見ない)
  { label: 'action-subtype trigger', verdict: 'yellow', re: /アクション[［[](キャラ|事件)[］\]]した(とき|時)/ },
  // 「…」で囲った非キーワード能力テキストの付与/付加 (keyword/expandActionTargets 以外不可)
  { label: 'grant textual (non-keyword) ability', verdict: 'yellow', re: /「[^」]{10,}」を(与え|持つ|持た)/ },
  // 継続 aura (他キャラへ、pick無し) — 【自/相手ターン中】等で「○○のキャラをAP/LP±」
  { label: 'continuous-aura (implicit, no pick)', verdict: 'yellow',
    re: /(このキャラ以外の|現場にいる)[^。選]{0,20}キャラを?(AP|LP|ＡＰ|ＬＰ)[＋－+-][0-9０-９]/ },
  // 証拠の peek / positional 手札移動 (verb 無し)
  { label: 'evidence peek/move verb', verdict: 'yellow', re: /証拠を上から[0-9０-９]+つ(見る|手札に加え)/ },
  // アクション対象制限 (○○を指定してアクションできない)
  { label: 'action-target restriction', verdict: 'yellow', re: /指定してアクションできない/ },
  // オートフェイズ自動アクティブ抑制
  { label: 'auto-activate suppression', verdict: 'yellow', re: /オートフェイズに[^。]{0,10}アクティブにならない/ },
  // 使用制限 (カットイン/イベントを使用できない)
  { label: 'usage restriction', verdict: 'yellow', re: /([】をは] ?)?(【カットイン】|イベント)を(使用|使え|使うこと)[^。]{0,4}でき(ない|なくなる)/ },
  // set-card → 証拠/手札 (持ち主が証拠として得る等; selfToEvidence は使用イベント自身のみ)
  { label: 'set-card → evidence/hand verb', verdict: 'yellow',
    re: /セットされているカード[^。]{0,16}(証拠として得る|手札に加え)/ },
  // デッキ上下を選んで戻す (souza は下のみ)
  { label: 'deck top/bottom choose', verdict: 'yellow', re: /デッキの(上か下|一番上か一番下|下か上)に移す/ },

  // ── 第4次 gate (dump 160-340 + 実 verb list 検証で発見) ──
  // 現場キャラ → デッキ上/下 (verb 無し; selfToDeckBottom は self-cost, deckToBottomBound は deck-reveal 用)
  { label: 'scene→deck verb', verdict: 'yellow',
    re: /(現場にいる|現場の|相手の現場|自分の現場|このキャラを現場|キャラを1枚まで選び、)[^。〛]{0,22}デッキの(上|下|一番上|一番下)に移す/,
    note: '現場キャラを deck へ移す effect verb 無し (selfToDeckBottom=self cost のみ)' },
  // effect からイベントを使用 (verb 無し)
  { label: 'play-event-from-effect verb', verdict: 'yellow',
    re: /(手札から|リムーブエリアにある)[^。]{0,26}イベントを[^。]{0,10}(使用する|使う。)/ },
  // 証拠 peek (自/相手の証拠を見る verb 無し)
  { label: 'evidence peek verb', verdict: 'yellow', re: /(自分|相手)の証拠を上から[0-9０-９]+つ見る/ },
  // ヒラメキ / リフレッシュ / 証拠獲得 の suppression
  { label: 'hirameki/refresh suppression', verdict: 'yellow',
    re: /(【ヒラメキ】を発動でき|リフレッシュによって証拠を得られ|証拠を得られない)/ },
  // 強制ターゲット (選べる場合必ず選ぶ)
  { label: 'forced-target modifier', verdict: 'yellow', re: /選べる場合[^。]{0,4}必ず選ぶ/ },
  // 動的 AP/LP 相対 filter (このキャラのAP以下のAP 等)
  { label: 'dynamic-AP/LP-relative filter', verdict: 'yellow', re: /この(キャラ|カード)の(AP|LP|ＡＰ|ＬＰ)以(下|上)の(AP|LP|ＡＰ|ＬＰ)/ },
  // 特徴の付与/剥奪 verb 無し (失い〜持つ)
  { label: 'trait set/remove verb', verdict: 'yellow', re: /〚?特徴［[^］]+］〛?を失/ },
  // カード名を追加 (としても扱う) — verb 無し
  { label: 'treat-as-additional-name', verdict: 'yellow', re: /としても扱う/ },
  // 登場 source の 色/特徴 参照 (enter payload は viaEffect/順序のみ)
  { label: 'enter-source-attribute filter', verdict: 'yellow',
    re: /(【[赤青黄緑白黒]】の|特徴［[^］]+］の)(イベント|キャラ)の(効果|能力)によって登場/ },
  // じゃんけん mechanic
  { label: 'janken mechanic', verdict: 'yellow', re: /じゃんけん/ },
  // 好きな数 (可変枚数) の選択/公開/表向き
  { label: 'variable count select', verdict: 'yellow', re: /好きな数[^。]{0,10}(選び|公開|表向き|引)/ },
  // 両陣営のキャラ数比較
  { label: 'cross-side count compare', verdict: 'yellow', re: /現場にいるキャラが相手の現場にいるキャラより(少ない|多い)/ },
];

function main() {
  const data = JSON.parse(readFileSync(join(SURVEY_DIR, 'remaining-to-classify.json'), 'utf8'));
  const todos: Todo[] = data.todo;

  const result: Record<string, { rep: string; size: number; kind: string; gate?: string; note?: string; text: string; title: string }[]> =
    { black: [], yellow: [], greenCandidate: [] };
  const gateCounts: Record<string, number> = {};

  for (const t of todos) {
    const text = [t.effect, t.cutIn, t.hirameki, t.henso].filter(Boolean).join(' / ');
    let matched: Gate | undefined;
    for (const g of GATES) {
      if (g.re.test(text)) { matched = g; break; }
    }
    const entry = { rep: t.rep, size: t.size, kind: t.kind, title: t.title, text, gate: matched?.label, note: matched?.note };
    if (!matched) {
      result.greenCandidate.push(entry);
    } else {
      result[matched.verdict].push(entry);
      gateCounts[matched.label] = (gateCounts[matched.label] ?? 0) + 1;
    }
  }

  const cardsIn = (arr: { size: number }[]) => arr.reduce((s, x) => s + x.size, 0);
  const out = {
    note: 'gate 検出トリアージ (自動)。greenCandidate は要 hand-verify。yellow/black は missing-feature ラベル付き。',
    counts: {
      black: { sig: result.black.length, cards: cardsIn(result.black) },
      yellow: { sig: result.yellow.length, cards: cardsIn(result.yellow) },
      greenCandidate: { sig: result.greenCandidate.length, cards: cardsIn(result.greenCandidate) },
    },
    gateCounts,
    black: result.black,
    yellow: result.yellow,
    greenCandidate: result.greenCandidate,
  };
  writeFileSync(join(SURVEY_DIR, 'classify-triage.json'), JSON.stringify(out, null, 1));

  const e = console.error;
  e('=== gate トリアージ結果 ===');
  e(`black          : ${out.counts.black.sig} sig / ${out.counts.black.cards} cards`);
  e(`yellow         : ${out.counts.yellow.sig} sig / ${out.counts.yellow.cards} cards`);
  e(`green candidate: ${out.counts.greenCandidate.sig} sig / ${out.counts.greenCandidate.cards} cards  (要 hand-verify)`);
  e('--- yellow gate 内訳 ---');
  for (const [g, n] of Object.entries(gateCounts).sort((a, b) => b[1] - a[1])) e(`  ${n.toString().padStart(3)}  ${g}`);
  e(`\nwrote classify-triage.json`);
}
main();
