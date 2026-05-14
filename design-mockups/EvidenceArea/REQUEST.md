# Task 7.9 EvidenceArea — Claude Design 依頼書

証拠エリア (裏向き縦カードスタック + 7枚進捗バー + クリック展開用フック)。

## 使い方

1. claude.ai の Claude Design → New prototype → High fidelity
2. 下の「プロンプト」を貼り付け
3. その下の「添付コンテキスト」を additional context として貼り付け
4. Create
5. 納品物 (TSX / CSS / demo HTML) を `design-mockups/EvidenceArea/` に保存

---

## プロンプト

```
名探偵コナンTCG Web ゲームの React コンポーネント「EvidenceArea」を高忠実プロトタイプとして作成してください。

## 仕様
- 機能: プレイヤーの証拠エリア (推理やアクション[事件] で集めた裏向き証拠カード) を表示。
  事件レベルに対する達成率を視覚化する (先攻 必要 7 / 後攻 必要 6)。
- レイアウト: 縦並び、上から zone-label / stack-display.evidence / progress-track の 3 段
- スタック表示:
  - 中央に虫眼鏡 + 指紋エンブレム付き card-back (探偵テーマ)
  - 背後に 3 層の stack-shadow (1°/3°/-1° に傾き、2-6px ずつズラして奥行き)
  - 中央前面に count-overlay (大きな枚数バッジ、accent-gold で囲み)
- 進捗バー:
  - 下端の progress-track (枚数 / requiredEvidence を百分率で描画、accent-gold グラデ)
- zone-label の右側に "5 / 7" 形式で count を表示
- 0 枚の場合: stack-shadow と card-back を非表示にして空表現、count-overlay は "0" 表示

## 制約
- TypeScript + React (関数コンポーネント)
- props: { count: number; requiredEvidence: number; side: 'self' | 'opp' }
  - count は現在の証拠枚数 (0..requiredEvidence+)
  - requiredEvidence は 7 (先攻) or 6 (後攻)
- スタイルは CSS variables を使用 (--accent-gold, --text-*, --bg-cell, --font-mono など)、
  色のハードコード禁止
- クラス名は添付 HTML mock の class 構造を流用 (.zone.evidence-zone, .stack-display.evidence,
  .stack-shadow.s1/.s2/.s3, .card-back, .count-overlay, .progress-track, .progress-fill)
- 公式ルールには触れない (静的表示のみ、クリック展開モーダルは Phase 8)
- 操作系なし (クリック展開モーダルは Phase 8 で実装、本コンポーネントには role="button"
  + aria-label のみ付与)

## 出力
1. EvidenceArea.tsx — 関数コンポーネント本体
2. EvidenceArea.css — クラス構造をそのまま流用 (色は CSS 変数で外出し)
3. EvidenceArea-demo.html — 5 ケース表示:
   - 0 / 7 (空)
   - 3 / 7 (進捗中)
   - 5 / 7 (mock の状態)
   - 7 / 7 (完了、勝利可能)
   - 4 / 6 (後攻側、進捗中)
```

---

## 添付コンテキスト

### ① HTML mock 抜粋

```html
<!-- design-mockups/01-board-mockup.html 1312-1322 行 -->
<div class="zone evidence-zone">
  <div class="zone-label"><span>証拠</span><span class="count">5 / 7</span></div>
  <div class="stack-display evidence">
    <div class="stack-shadow s3"></div>
    <div class="stack-shadow s2"></div>
    <div class="stack-shadow s1"></div>
    <div class="card-back"><div class="monogram">DC</div><div class="magnifier"></div></div>
    <div class="count-overlay">5</div>
  </div>
  <div class="progress-track"><div class="progress-fill" style="width:71%"></div></div>
</div>
```

### ② CSS mock 抜粋 (.stack-display + .card-back の SVG)

```css
.stack-display {
  flex: 1; position: relative;
  display: flex; align-items: center; justify-content: center;
}
.stack-display .card-back {
  width: 64px; height: 90px;
  transform: rotate(-2deg);
  background:
    radial-gradient(circle at 6px 6px, rgba(255,215,0,0.5) 0 1.5px, transparent 2px),
    radial-gradient(circle at calc(100% - 6px) 6px, rgba(255,215,0,0.5) 0 1.5px, transparent 2px),
    radial-gradient(circle at 6px calc(100% - 6px), rgba(255,215,0,0.5) 0 1.5px, transparent 2px),
    radial-gradient(circle at calc(100% - 6px) calc(100% - 6px), rgba(255,215,0,0.5) 0 1.5px, transparent 2px),
    linear-gradient(160deg, #1f2438 0%, #0a0e1c 100%);
  border: 1px solid rgba(255,215,0,0.28);
  position: relative;
}
/* Evidence stack: 虫眼鏡 + 指紋 SVG が card-back 中央に乗る */
.stack-display.evidence .card-back::before {
  content: "";
  position: absolute; inset: 0;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 90'><g fill='none' stroke='%23ffd75e' stroke-width='1.4' opacity='0.85'><circle cx='28' cy='38' r='16'/><circle cx='28' cy='38' r='13' opacity='0.5'/><line x1='40' y1='50' x2='52' y2='66' stroke-width='3.5' stroke-linecap='round'/><circle cx='28' cy='38' r='1.5' fill='%23ffd75e'/></g><g fill='none' stroke='%23ffd75e' stroke-width='0.8' opacity='0.55'><path d='M22 38 Q28 30 34 38'/><path d='M20 40 Q28 28 36 40'/><path d='M24 42 Q28 36 32 42'/></g></svg>") no-repeat center / 80% auto;
}
.stack-display .stack-shadow {
  position: absolute;
  width: 64px; height: 90px;
  border-radius: 4px;
  background: linear-gradient(160deg, #1a1f30, #0a0e1c);
  border: 1.5px solid #2a3552;
}
.stack-shadow.s1 { transform: translate(2px, 2px) rotate(1deg); }
.stack-shadow.s2 { transform: translate(4px, 4px) rotate(3deg); }
.stack-shadow.s3 { transform: translate(6px, 6px) rotate(-1deg); }
.stack-display .count-overlay {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
  background: rgba(0,0,0,0.85);
  color: var(--accent-gold);
  font-family: var(--font-mono); font-size: 22px; font-weight: 800;
  padding: 4px 12px;
  border: 1.5px solid var(--accent-gold);
  border-radius: 3px;
  text-shadow: 0 0 6px rgba(255,215,0,0.5);
}
.stack-display.evidence .count-overlay {
  box-shadow: 0 0 12px rgba(255,215,0,0.3);
}
.progress-track {
  height: 4px; margin-top: 4px;
  background: rgba(0,0,0,0.5);
  border-radius: 2px; overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #ffd75e, #ff9b3e);
  border-radius: 2px;
  box-shadow: 0 0 6px rgba(255,215,0,0.5);
}
```

### ③ CSS 変数 (`src/ui/styles/tokens.css` 由来)

```css
--accent-gold:    #ffd700;
--bg-cell:        rgba(0,0,0,0.32);
--border-zone:    #3a6ea5;
--text-primary:   #e0ecf8;
--text-secondary: #b8d4f0;
--text-muted:     #7090b5;
--font-jp:        "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif;
--font-mono:      "Cascadia Code", "Consolas", monospace;
```

### ④ ゲームルール参考 (out of scope だが動機を伝えるため)

- 証拠は「推理 (LP 枚分追加)」「アクション[事件] (1 枚追加)」で得られる
- 必要証拠数を満たして「事件解決 (アシスト後の解決編 + アクティブパートナー)」で勝利
- 先攻 = 7 枚、後攻 = 6 枚必要 (rules/01)
- 裏向きで重ねるため、内訳はゲーム中相手から見えない

---

## 注意事項

- ⚠️ 原作キャラ名は使用禁止
- ✅ FileArea の SVG とは異なるテーマ (Evidence = 虫眼鏡 + 指紋、File = 書類フォルダ)
- ✅ 0 枚時は stack-shadow / card-back を非表示にして「無証拠状態」を表現
- ✅ progress-fill の幅は count / requiredEvidence * 100%
- ✅ Phase 7 は静的表示のみ、role="button" + aria-label を付与してアクセシビリティ確保

## 納品物の置き場

`C:\Users\arumi\OneDrive\デスクトップ\conan\design-mockups\EvidenceArea\`
- `EvidenceArea.tsx`
- `EvidenceArea.css`
- `EvidenceArea-demo.html`

納品が完了したら教えてください。私が engine 型に接続して `src/ui/components/EvidenceArea.tsx` + `.css` + `src/ui/hooks/useEvidence.ts` + `tests/ui/components/EvidenceArea.test.tsx` に統合・commit します。
