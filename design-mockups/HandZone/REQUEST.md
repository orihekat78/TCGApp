# Task 7.11 HandZone — Claude Design 依頼書

手札ゾーン (MTGA 型フラット並び + hover-pop 拡大 + 使用不可 disabled 表示)。

## 使い方

1. claude.ai の Claude Design → New prototype → High fidelity
2. 下の「プロンプト」を貼り付け
3. その下の「添付コンテキスト」を additional context として貼り付け
4. Create
5. 納品物 (TSX / CSS / demo HTML) を `design-mockups/HandZone/` に保存

---

## プロンプト

```
名探偵コナンTCG Web ゲームの React コンポーネント「HandZone」を高忠実プロトタイプとして作成してください。

## 仕様
- 機能: 自分の手札 (CardId[]) を 88×124px のカードで横並び表示。
  MTGA 型の「フラット展開」レイアウトで、相手の手札は枚数バッジのみで非表示。
- レイアウト: 横並びフレックス、bottom 配置 (画面下端 130px)、gap 8px、中央寄せ
- 各カード:
  - 左上に cost バッジ (円形、22×22px、cost 数値) — 色は青系 (デフォルト) / 黄系 (color-yellow)
  - 右上に type-badge (「キャラ」「イベント」)
  - 上端 9px の color-stripe (青/黄/赤/緑/紫)
  - 中央に art (silhouette placeholder)
  - 中段に name (1-2 行、min-height 22px)
  - 下段に stats (AP / LP / Lv の 3 カラム、mono フォント、イベントは "—")
- 状態オーバーレイ:
  - .featured: hover/focus 時に translateY(-12px) + scale(1.04)、neon-blue glow
    → デモでは中央のカードに常時付与してホバー演出を可視化
  - .disabled: opacity 0.4 + grayscale 0.4 (色不一致で使用不可)、title 属性で理由を表示
- 相手手札ストリップ (opp-hand-strip): プレイマット上端の細いストリップに
  「相手 7」のような件数表示 + 横並びの mini card-back のみ (これは別 task で
  Playmat に直接挿入予定。本依頼では取り扱わない、HandZone は自分側のみ)

## 制約
- TypeScript + React (関数コンポーネント)
- props: { cards: HandCardMeta[]; canUse?: (card) => boolean; featuredCardId?: string | null }
  - HandCardMeta 型は別途記載 (下記)
  - canUse: 各カードが使用可能かを判定 (false → .disabled 適用)
  - featuredCardId: 「ホバー中」相当のカード ID を強調表示 (デモ用)
- スタイルは CSS variables を使用 (--color-blue, --color-yellow, --color-red,
  --color-green, --color-purple, --neon-blue, --text-* など)、色のハードコード禁止
- クラス名は添付 HTML mock の class 構造を流用 (.hand-zone, .hand-card.color-*,
  .hand-card.featured, .hand-card.disabled, .cost, .type-badge, .color-stripe,
  .art, .silhouette, .name, .stats, .ap, .lp, .lv)
- 公式ルールには触れない (静的表示のみ、クリック・ドラッグは Phase 8)
- 版権配慮: 「江戸川コナン / 工藤新一 / 服部平次」等の原作キャラ名は使わない。
  ダミーカード名はパブリックドメイン的な架空探偵 (Holmes / Watson / Dupin /
  Marple / Adler 等) でOK

## 出力
1. HandZone.tsx — 関数コンポーネント本体 (HandZone + 内部の HandCard)
2. HandZone.css — クラス構造をそのまま流用 (色は CSS 変数で外出し)
3. HandZone-demo.html — 4 ケース表示:
   - 5 枚の手札 (color-yellow ×3 + color-blue ×2、うち 1 枚 .featured、1 枚 .disabled)
   - 0 枚 (empty 表示)
   - 7 枚で overflow (画面幅を超えないように間隔調整、または horizontal scroll)
   - 1 枚 (single card, featured)
```

---

## 添付コンテキスト

### ① HTML mock 抜粋

```html
<!-- design-mockups/01-board-mockup.html 1551-1601 行 -->
<div class="hand-zone">
  <div class="hand-card color-yellow">
    <div class="cost">5</div>
    <div class="type-badge">キャラ</div>
    <div class="color-stripe"></div>
    <div class="art"><div class="silhouette"></div></div>
    <div class="name">サンプル A</div>
    <div class="stats"><span class="ap">5000</span><span class="lp">1</span><span class="lv">5</span></div>
  </div>
  <div class="hand-card color-yellow featured">
    <div class="cost">8</div>
    <div class="type-badge">キャラ</div>
    <div class="color-stripe"></div>
    <div class="art"><div class="silhouette"></div></div>
    <div class="name">サンプル B (featured)</div>
    <div class="stats"><span class="ap">8000</span><span class="lp">1</span><span class="lv">8</span></div>
  </div>
  <div class="hand-card color-yellow">
    <div class="cost">3</div>
    <div class="type-badge">イベント</div>
    <div class="color-stripe"></div>
    <div class="art"><div class="silhouette"></div></div>
    <div class="name">サンプルイベント</div>
    <div class="stats"><span class="ap">—</span><span class="lp">—</span><span class="lv">3</span></div>
  </div>
  <div class="hand-card color-blue disabled" title="色不一致で使用不可">
    <div class="cost">4</div>
    <div class="type-badge">キャラ</div>
    <div class="color-stripe"></div>
    <div class="art"><div class="silhouette"></div></div>
    <div class="name">サンプル D (disabled)</div>
    <div class="stats"><span class="ap">6000</span><span class="lp">1</span><span class="lv">4</span></div>
  </div>
</div>
```

### ② CSS mock 抜粋

```css
.hand-zone {
  position: absolute; left: 124px; right: 232px; bottom: 56px; height: 130px;
  display: flex; align-items: flex-end; justify-content: center; gap: 8px;
  padding: 0 20px;
  z-index: 10;
}
.hand-card {
  width: 88px; height: 124px;
  border-radius: 5px;
  background: linear-gradient(160deg, #1a2638 0%, #0a1320 100%);
  border: 1.5px solid #2a4a6e;
  position: relative;
  display: flex; flex-direction: column;
  overflow: visible;
  box-shadow: 0 4px 12px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05);
  flex-shrink: 0;
  transition: transform .25s ease-out;
}
.hand-card.color-blue { border-color: #4a8ad8; box-shadow: 0 4px 12px rgba(0,0,0,0.6), 0 0 0 1px rgba(78,138,216,0.5); }
.hand-card.color-yellow { border-color: #e0b830; box-shadow: 0 4px 12px rgba(0,0,0,0.6), 0 0 0 1px rgba(224,184,48,0.5); }
.hand-card.featured {
  transform: translateY(-12px) scale(1.04);
  box-shadow: 0 8px 24px rgba(78,195,255,0.5), 0 0 0 2px var(--neon-blue);
  z-index: 5;
}
.hand-card.disabled {
  opacity: 0.4; filter: grayscale(0.4);
}
.hand-card .color-stripe { height: 9px; border-radius: 4px 4px 0 0; flex-shrink: 0; }
.hand-card.color-blue   .color-stripe { background: var(--color-blue); }
.hand-card.color-yellow .color-stripe { background: var(--color-yellow); }
.hand-card .art {
  flex: 1; margin: 4px;
  background: linear-gradient(135deg, rgba(78,195,255,0.08), rgba(0,0,0,0.4));
  border-radius: 3px;
  display: flex; align-items: center; justify-content: center;
}
.hand-card .art .silhouette {
  width: 70%; height: 70%;
  background: radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.2), rgba(0,0,0,0.6));
  border-radius: 50% 50% 40% 40%;
  filter: blur(1px);
}
.hand-card .name {
  font-size: 9.5px; font-weight: 700; padding: 3px 4px;
  text-align: center; line-height: 1.15;
  background: rgba(0,0,0,0.5);
  min-height: 22px;
  display: flex; align-items: center; justify-content: center;
}
.hand-card .stats {
  display: flex; justify-content: space-between; align-items: center;
  padding: 3px 4px; gap: 2px;
  background: rgba(0,0,0,0.65);
  font-size: 9.5px; font-weight: 800; font-family: var(--font-mono);
}
.hand-card .ap { color: #ff9b6e; }
.hand-card .lp { color: #ffd75e; }
.hand-card .lv { color: #6ed1ff; }
.hand-card .cost {
  position: absolute; top: -6px; left: -6px;
  width: 22px; height: 22px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, #5ec1ff, #1f5e9a);
  border: 1.5px solid #fff;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--font-mono); font-size: 11px; font-weight: 800;
  color: #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,0.5);
}
.hand-card.color-yellow .cost {
  background: radial-gradient(circle at 30% 30%, #ffd75e, #a07020);
}
.hand-card .type-badge {
  position: absolute; top: 14px; right: -4px;
  font-size: 8px; font-weight: 700;
  background: rgba(0,0,0,0.85); color: #fff;
  padding: 2px 5px;
  border-radius: 2px;
  border: 1px solid rgba(255,255,255,0.15);
  letter-spacing: 0.05em;
}
```

### ③ CSS 変数 (`src/ui/styles/tokens.css` 由来)

```css
--color-blue:     #2b6cb5;
--color-yellow:   #d4a425;
--color-red:      #c84040;
--color-green:    #3aa67a;
--color-purple:   #8a4cc0;
--neon-blue:      #4ec3ff;
--accent-gold:    #ffd700;
--text-primary:   #e0ecf8;
--text-secondary: #b8d4f0;
--text-muted:     #7090b5;
--font-jp:        "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif;
--font-mono:      "Cascadia Code", "Consolas", monospace;
```

### ④ TypeScript 型定義

```typescript
type CardId = string;
type CardColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple';
type CardType = 'キャラ' | 'イベント';

type HandCardMeta = {
  cardId: CardId;
  name: string;
  color: CardColor;
  type: CardType;
  cost: number;     // 左上バッジ
  ap: number | null;  // イベントは null → "—" 表示
  lp: number | null;  // 同上
  lv: number;
};
```

### ⑤ ゲームルール参考 (out of scope)

- 「手札の使用」は 1 ターン 1 回まで (turnState.handUseUsed)
- 「ネクストヒント」を使ったターンは手札使用不可 (turnState.nextHintUsed)
- 事件と色が一致しないカードは「手札の使用 / ネクストヒント」で使えない
  (rules/20、ただしカットイン / ヒラメキは色制限なし)
- 上記 disabled 判定は本コンポーネントの canUse プロップに委譲

---

## 注意事項

- ⚠️ 原作キャラ名 (江戸川コナン / 工藤新一 / 怪盗キッド / 服部平次 / 佐藤美和子 / 横溝刑事 等) は使用禁止
- ✅ ダミーキャラ名はパブリックドメイン推奨 (Holmes / Watson / Dupin / Marple / Moriarty / Adler)
- ✅ .featured は hover state の prototyping。Phase 8 で onMouseEnter ハンドラを追加予定
- ✅ .disabled の title 属性 (tooltip) は accessibility のため必須
- ✅ Phase 7 は静的表示のみ、onClick / onDragStart 等のハンドラ不要
- ✅ 5 色のカードすべて demo に含めることが望ましいが、4 色でも OK

## 納品物の置き場

`C:\Users\arumi\OneDrive\デスクトップ\conan\design-mockups\HandZone\`
- `HandZone.tsx`
- `HandZone.css`
- `HandZone-demo.html`

納品が完了したら教えてください。私が engine 型に接続して `src/ui/components/HandZone.tsx` + `.css` + `src/ui/hooks/useHand.ts` + `tests/ui/components/HandZone.test.tsx` に統合・commit します。
