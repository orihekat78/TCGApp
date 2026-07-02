# デザイン刷新 — 研究知見 (2026-06-19, 2 workflow統合)

> temp の workflow 出力は消える可能性があるため要点を永続化。
> 全hex は公式素材由来 or サンプル推定。「approx/単一ソース」は **トークン確定前に再サンプル必須**。

## コナン・ビジュアル・アイデンティティ (確定的所見)
- **コナンは青基調**: コナンの上着/蝶ネクタイ = コナンブルー **#1A4FB3**(単一ソース hureaier, 要再確認)。
  MVPデッキ=「**青の古城**探索事件」。公式TCG製品も青。→ 赤default は誤り。
- **赤はロゴ専用**: 名探偵コナン ワードマーク = 緋色 **#ed2328** + 黒 **#231f20**(公式SVG verbatim、高信頼)。
  1996年からトゲトゲ(notched)の独自書体。市販フォント無し=公式素材を使う(偽造しない)。本文/数字に棘は禁止。
- **茶レンガ=原作単行本の公式identity**(ユーザー指摘で確証): 全巻並ぶと本棚が茶に染まる、作者(青山)自ら
  「レンガの壁紙だと思えば」とネタ化(Oricon)。ジャンル雰囲気でなく原作の象徴。
- **公式TCG(takaratomy, 最重要参照)**: 濃紺+白基調、赤はロゴの keystone "D" のみ。
  ロゴの "O"=**鍵穴(鍵穴/真実)**, タグライン「真実へ先にたどり着け」。flat・白背景・濃紺見出し+下線・濃紺pill CTA(~30px)。
  hex(pixel/firecrawl, 要再サンプル): navy #042C64 / #0052A4, link #0077EE, OG navy #011226→#0B2A47, 文字 #222, chip #EEE。
- **公式OG/hero背景** = ネイビー地 + **brick/code テクスチャ** + 中央グロー(ユーザー共有画像がこれ)。
- **6色のゲーム内色識別** 青緑白赤黄黒(青#1763B6 緑#2E9E5B 白#F2F2F2 赤#D8222A 黄#F2C200 黒#1A1A1A=**全て推定値**, 実カード枠を要サンプル)。
- **モチーフ**(ownable): 鍵穴 / 虫めがね(検索) / 赤い蝶ネクタイ / 丸メガネ / 犯人の黒シルエット(空状態) / 「真実はいつもひとつ」/ 金のLPバッジ。
- 書体: 表示=重ゴシック、本文=Noto Sans JP / M PLUS Rounded 1c、データ=等幅(資料風数字)。mincho/serif は本文に使わない。

## プレミアムTCG(マスターデュエル/Shadowverse)の"ワクワク"原理
- 暗い統一ステージ + **少量の発光アクセント**で高級感(広い赤面は禁止=赤属性カードと競合・エラー感)。
- **カード=物理物**: ポインタ追従3Dチルト+グレア(最も効く)。hover/詳細/高レアのみ箔。
- **段階化ジュース**: 通常操作は小、推理/事件解決/登場/勝利だけ派手(cut-in/粒子/hold)。
- 合法ターゲットzone発光、アクティブpartnerパルス。金=レアリティ/価値。

## CSS実装技法(React+素CSS, コスト)
- 3Dチルト(cheap, perspective+rotate, var per element) / 追従グレア(cheap, radial+blend) / 箔sweep(moderate, blend色-dodge, 高レアのみ)
- 金縁(cheap, @property conic-gradient ±回転::before fallback) / zone発光パルス(cheap, box-shadow) / glassmorphism(**expensive**, パネル数枚のみ)
- reveal scale+hold(cheap) / 粒子(moderate, heroのみ) / 虹text(moderate, win) / ambient背景(cheap)
- **必須**: `prefers-reduced-motion` 全対応 / transform・opacityのみ動かす / 大グリッドに blend+tilt 同時は禁止(FPS死)/ 重grid仮想化。

## do / don't (要点)
- DO: navy+白を土台、赤(#ed2328)+黒は masthead/致命手だけ、金=価値、6色は別系統で保持、カード絵を最も明るく。
- DON'T: 全面赤、アニメロゴの金グラデ(#FDB810等)をTCGに誤用、棘書体を本文に、gold乱用、Cyrillic混入の不正hex(#3CА832)使用。

## 出典 (再取得用)
- workflow scripts: `<session>/workflows/scripts/conan-visual-identity-research-*.js` / `digital-tcg-ui-research-*.js`(再実行可)。
- 主要URL: takaratomy.co.jp/products/conan-cardgame/, conan-portal.com, hureaier(コナンブルー), Oricon 100巻(レンガ), logopedia SVG。
