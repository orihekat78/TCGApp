// Phase 9a-1 / 9a-2 / 9b / 9c: チュートリアル L0-L13 (MVP 全カバー)
//
// rules: 01-victory-conditions / 02-deck-construction / 03-field-areas /
//        05-turn-phases / 07-action-flow / 08-contact / 09-cutin-disguise /
//        10-action-event / 11-reasoning / 13-keywords / 14-refresh /
//        18-mr / 26-qa-deck-refresh
// research: .claude/research/tutorial/01-curriculum-design.md
//
// MVP コア (9a): L0 (目的) → L1 (デッキ) → L2 (場のエリア) → L3 (ターン進行)
//               → L4 (推理) → L5 (パートナー基礎)
// コンタクト 1 セット (9b): L6 (アクション宣言) → L7 (ガード判定)
//                          → L8 (コンタクト AP 判定) → L9 (カットイン) → L10 (変装)
// アドバンスド (9c): L11 (ヒラメキ / アクション[事件]) → L12 (リフレッシュ / 痕跡) → L13 (MR)
// Phase 9d 以降: インタラクティブ強化 (TutorialStepGuide ハイライト / 確認問題)

/** Round 3c-A: 各 step が指す盤面要素 (border + glow pulse + 矢印で TutorialHighlight が描画)。
 *  selector が存在しない / 解決できない step は target なしで bar のみ表示 (graceful fallback)。 */
export type TutorialTarget = {
  /** document.querySelector に渡す CSS セレクタ (例: '.actions-panel', '.case-area') */
  selector: string;
  /** 矢印の配置方向。default 'top' (target の上から下向き ▼ 矢印で指し示す) */
  placement?: 'top' | 'bottom' | 'left' | 'right';
};

export type TutorialStep = {
  id: string;
  title: string;
  body: string;
  /** Round 3c-A 追加: ハイライト対象。未設定の step は下端 tutorial bar のみ表示。
   *  全カード実装後に target 追記予定の step は skipReason コメントで明示する。 */
  target?: TutorialTarget;
};

export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    id: 'L0-1',
    title: 'ようこそ、名探偵',
    body: '名探偵コナンTCG は 2 人で証拠を集めて事件を解決するカードゲーム。CT-D08 と CT-D11 のデッキで対戦します。',
  },
  {
    id: 'L0-2',
    title: '勝利条件',
    body: '相手より先に事件の必要証拠数を集め、パートナーで「事件解決」を宣言したら勝利。先攻は 7 枚、後攻は 6 枚の証拠が必要。',
  },
  {
    id: 'L0-3',
    title: '進めましょう',
    body: '盤面右側の「ACTIONS」パネルから推理・アクション・ターン終了が選べます。まずは ターン終了を押してみよう。',
    target: { selector: '.actions-panel', placement: 'top' },
  },
  // ---- L1: デッキ構成 (rules/02) ----
  {
    id: 'L1-1',
    title: 'デッキの構成',
    body: 'デッキは「パートナー 1 枚 + 事件 1 枚 + メイン 40 枚」。本対戦では CT-D08 と CT-D11 を使用。',
  },
  {
    id: 'L1-2',
    title: '同じカードは最大 3 枚',
    body: 'デッキ内に同じカード ID は最大 3 枚まで。色制限はデッキ構築時には無く、ゲーム中の手札の使用時に事件と同色制限がかかる。',
  },
  // ---- L2: 場のエリア (rules/03) ----
  {
    id: 'L2-1',
    title: '8 つのエリア',
    body: '現場 (最大 5 枚) / パートナーエリア / 事件エリア / デッキ / 証拠 / FILE / リムーブ / 手札。それぞれ役割が異なる。',
    target: { selector: '.play-area', placement: 'top' },
  },
  {
    id: 'L2-2',
    title: 'カードの状態',
    body: 'アクティブ (タテ・行動可) / スリープ (横・行動不可) / スタン (逆向き・行動不可)。スタンは特殊な解除手順が必要。',
  },
  // ---- L3: ターン進行 (rules/05) ----
  {
    id: 'L3-1',
    title: '3 フェイズで進む',
    body: 'オートフェイズ → メインフェイズ → エンドフェイズ。メインフェイズが主役、ここで様々な行動を取る。',
  },
  {
    id: 'L3-2',
    title: 'オートフェイズ',
    body: '自分のパートナー + 現場キャラをアクティブに / デッキから 1 枚ドロー / FILE に 2 枚追加。先攻 1 ターン目のみ FILE 1 枚。',
  },
  {
    id: 'L3-3',
    title: 'メインフェイズの 6 行動',
    body: '手札の使用 / ネクストヒント / パートナー能力 / 宣言能力 / 推理 / アクション。好きな順番で何度でも繰り返せる (手札使用は 1 回)。',
    target: { selector: '.actions-panel', placement: 'top' },
  },
  // ---- L4: 推理 (rules/11) ----
  {
    id: 'L4-1',
    title: '推理とは',
    body: 'アクティブなキャラまたはパートナーをスリープして、そのカードの LP 分の証拠をデッキ上から集める。証拠勝利の主軸。',
    target: { selector: '.actions-panel', placement: 'top' },
  },
  {
    id: 'L4-2',
    title: 'LP の高い味方で',
    body: 'LP 3 のキャラで推理すれば 3 枚の証拠が増える。LP 0 のキャラは推理しても証拠が 0 になる点に注意。',
    target: { selector: '.partner-area.side-self', placement: 'top' },
  },
  // ---- L5: パートナー基礎 (rules/01 / 13) ----
  {
    id: 'L5-1',
    title: 'アシスト',
    body: 'パートナーをスリープして FILE に移動。FILE が 7 枚以上になると事件が「事件編 → 解決編」に進化する。',
    target: { selector: '.actions-panel', placement: 'top' },
  },
  {
    id: 'L5-2',
    title: '事件解決 ★',
    body: '解決編 + 必要証拠数 + アクティブなパートナー → 事件解決を宣言して勝利!  ただしアシストしたターンは事件解決できない。',
    target: { selector: '.case-area', placement: 'top' },
  },
  {
    id: 'L5-3',
    title: '名乗り状態',
    body: '登場したターン中のキャラは「名乗り状態」で推理 / アクション不可。「迅速」「突撃」を持つキャラだけ例外。',
    target: { selector: '.scene-area.side-self', placement: 'top' },
  },
  {
    id: 'L5-4',
    title: '練習開始!',
    body: '基本は以上です。実際に ターン終了を押してオートフェイズを体験し、アクション・推理を試してみよう。',
    target: { selector: '.actions-panel', placement: 'top' },
  },
  // ---- L6: アクション宣言 (rules/07) ----
  {
    id: 'L6-1',
    title: 'アクションとは',
    body: '自分の現場のアクティブなキャラ (or パートナー) が攻撃を仕掛ける行動。対象は相手の現場のスリープ/スタン状態のキャラ、または相手の事件。',
    target: { selector: '.actions-panel', placement: 'top' },
  },
  {
    id: 'L6-2',
    title: 'アクション宣言の流れ',
    body: '攻撃元を選び → 対象を選び → 自分の攻撃キャラをスリープ → ガード判定 → コンタクト → 判定 → 終了。9 段階の状態機械で進む。',
    target: { selector: '.actions-panel', placement: 'top' },
  },
  // ---- L7: ガード判定 (rules/07,08) ----
  {
    id: 'L7-1',
    title: 'ガードとは',
    body: '対象が攻撃された側は、自分の現場のアクティブなキャラ 1 体をスリープしてガード可能。ガードしたキャラがコンタクト相手に置き換わる。',
  },
  {
    id: 'L7-2',
    title: 'ガードしない選択',
    body: '無理に倒せない攻撃に対しては「ガードしない」=資源温存も合理的。CPU は AP 比較で判断する。',
  },
  // ---- L8: コンタクト AP 判定 (rules/08) ----
  {
    id: 'L8-1',
    title: 'コンタクト判定',
    body: '攻撃側 AP ≧ 防御側 AP なら防御側をリムーブ。AP が同じでもリムーブされる。攻撃側は判定でリムーブされない。',
  },
  {
    id: 'L8-2',
    title: '行動順',
    body: 'コンタクトは AP の低い側が 1 番目、高い側が 2 番目。同値なら攻撃された側が 1 番目。1 番目がパスして 2 番目が動いたら再行動が回る。',
  },
  // ---- L9: カットイン (rules/09) ----
  {
    id: 'L9-1',
    title: 'カットイン',
    body: 'コンタクト中に手札のカットイン持ちカードを使い、AP+ 等の効果を発生させる。1 コンタクトにつき 1 枚まで。色制限なし。',
  },
  {
    id: 'L9-2',
    title: 'カットインのタイミング',
    body: 'AP 判定の前に使えば、コンタクト中だけ AP が上昇する。使ったカードはリムーブエリアへ。',
  },
  // ---- L10: 変装 (rules/09,23) ----
  {
    id: 'L10-1',
    title: '変装',
    body: 'コンタクト中の自分のキャラを、手札の変装持ちキャラと入替。元のキャラはデッキの下へ。状態 / セット / 効果は引き継がれる。',
  },
  {
    id: 'L10-2',
    title: '変装の注意',
    body: '変装は「登場」ではないので【登場時】能力は発動しない。代わりに変装キャラの【変装時】能力が発動する。',
  },
  // ---- L11: ヒラメキ + アクション[事件] (rules/10) ----
  {
    id: 'L11-1',
    title: 'アクション[事件]',
    body: '対象を相手の事件にしてアクションすると、ガードされなければ相手の証拠を 1 枚リムーブし、自分の証拠を 1 枚追加する。',
  },
  {
    id: 'L11-2',
    title: 'ヒラメキ',
    body: 'アクション[事件] によってリムーブされる証拠カードがヒラメキを持っていたら、相手はその効果を発動できる。能力リムーブでは発動しない。',
  },
  // ---- L12: リフレッシュ + 痕跡 (rules/14, 26, 13) ----
  {
    id: 'L12-1',
    title: 'リフレッシュ',
    body: 'デッキが 0 枚になったらリムーブエリアをシャッフルしてデッキに戻す。同時に相手は証拠 1 枚を得る。',
  },
  {
    id: 'L12-2',
    title: 'デッキ切れ敗北',
    body: 'リフレッシュ時にリムーブエリアが 0 枚なら、そのプレイヤーは即敗北。終盤はデッキ消費とリムーブ補充のバランスが鍵。',
  },
  {
    id: 'L12-3',
    title: '痕跡',
    body: '相手がリフレッシュした瞬間、自分は「痕跡 [発見済み]」になる。発見済みは試合中ずっと維持され、痕跡条件カードを強化する。',
  },
  // ---- L13: MR (rules/18) ----
  {
    id: 'L13-1',
    title: 'MR キャラ',
    body: 'MR は特別ランク。相手ターン中に現場を離れる場合、パートナーエリアに移動する。自分ターン中は通常通り離れる。',
  },
  {
    id: 'L13-2',
    title: 'MR の重複登場',
    body: '自分の現場に新たな MR が登場するとき、既存の MR (現場 or パートナーエリア) は強制リムーブされる。同名かどうかは問わない。',
  },
] as const;
