# Task 7.6 CaseArea — Claude Design 依頼書

事件カード + 「事件編 / 解決編」検事印スタンプ + 必要証拠数表示。

## 使い方

1. claude.ai の Claude Design → New prototype → High fidelity
2. 下の「プロンプト」を貼り付け
3. その下の「添付コンテキスト」を additional context として貼り付け
4. Create
5. 納品物 (TSX / CSS / demo HTML) を `design-mockups/CaseArea/` に保存

---

## プロンプト

```
名探偵コナンTCG Web ゲームの React コンポーネント「CaseArea」を高忠実プロトタイプとして作成してください。

## 仕様
- 機能: プレイヤーの事件カード + 必要証拠数 + 事件編/解決編スタンプを表示
- レイアウト: 縦並び、上から zone-label / case-card / evidence-required の 3 行
- 事件カードは portrait (縦) 形式: 84×118px (タイトル + メタ + 証拠 Lv)
- 検事印スタンプ:
  - 「事件編」(青、--case-editing #3366ff)
  - 「解決編」(赤、--case-resolved #ee2255)
  - カード右上に絶対配置、わずかに傾ける (8deg 事件編 / -6deg 解決編)
  - 白背景 + カラーボーダー + ドロップシャドウ (検事印イメージ)
- 必要証拠数: "必要証拠 7（先攻）" or "必要証拠 6（後攻）"、数字は accent-gold で強調

## 制約
- TypeScript + React (関数コンポーネント、JSX.Element 型)
- props: { case: CaseInfo; turnOrder: 'first' | 'second'; side: 'self' | 'opp' }
- スタイルは CSS variables を使用 (--case-editing, --case-resolved, --accent-gold,
  --color-blue, --color-yellow, --text-* など)、色のハードコード禁止
- クラス名は添付 HTML mock の class 構造を流用 (.zone.case-zone, .case-card.portrait,
  .case-title, .case-meta, .case-lv, .case-stamp, .case-stamp.resolved, .evidence-required)
- 公式ルールには触れない (静的表示のみ、操作系は Phase 8)
- 版権配慮: 「江戸川コナン」等の原作キャラ名は使わない。ダミー事件タイトルは
  パブリックドメイン的なミステリ系 (例: 「月光に潜む古城の影」「霧の駅の謎」) でOK

## 出力
1. CaseArea.tsx — 関数コンポーネント本体
2. CaseArea.css — クラス構造をそのまま流用 (色は CSS 変数で外出し)
3. CaseArea-demo.html — 4 ケース表示:
   - 先攻 (必要 7) × 事件編
   - 先攻 × 解決編
   - 後攻 (必要 6) × 事件編
   - 後攻 × 解決編
```

---

## 添付コンテキスト

### ① HTML mock 抜粋 (視覚 SoT)

```html
<!-- design-mockups/01-board-mockup.html 1297-1311 行 -->
<div class="case-col">
  <div class="zone case-zone">
    <div class="zone-label"><span>事件</span></div>
    <div class="case-card portrait color-blue">
      <div class="case-title">月光に潜む<br>古城の影</div>
      <div class="case-meta">
        <span>EVT・青</span>
        <span class="case-lv">Lv 7</span>
      </div>
      <div class="case-stamp">事件編</div>
    </div>
    <div class="evidence-required">必要証拠 <strong>7</strong>（先攻）</div>
  </div>
</div>
```

### ② CSS mock 抜粋

```css
.case-zone { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px; }
.case-card {
  width: 116px; height: 84px;  /* landscape default */
  border-radius: 4px;
  background: linear-gradient(135deg, #2a2030 0%, #1a1422 100%);
  border: 1.5px solid #4a3050;
  position: relative;
  display: flex; flex-direction: column;
  overflow: hidden;
}
.case-card.portrait { width: 84px; height: 118px; }
.case-card.portrait .case-title { font-size: 9.5px; padding: 4px 4px; }
.case-card.portrait .case-stamp { font-size: 8.5px; padding: 1px 4px; }
.case-card.color-blue   { border-color: #4a8ad8; box-shadow: inset 0 0 0 1px rgba(78,138,216,0.25); }
.case-card.color-yellow { border-color: #e0b830; box-shadow: inset 0 0 0 1px rgba(224,184,48,0.25); }
.case-card .case-title {
  flex: 1;
  background: linear-gradient(180deg, rgba(78,195,255,0.06), rgba(0,0,0,0.5));
  display: flex; align-items: center; justify-content: center;
  padding: 4px 6px;
  font-size: 10px; font-weight: 700; line-height: 1.2;
  text-align: center;
}
.case-card .case-meta {
  display: flex; justify-content: space-between; align-items: center;
  padding: 3px 6px; font-size: 9px;
  background: rgba(0,0,0,0.6);
  font-family: var(--font-mono);
  color: var(--text-secondary);
}
.case-card .case-lv { font-weight: 800; color: #ffd75e; }
.case-stamp {
  position: absolute; top: -4px; right: -4px;
  transform: rotate(8deg);
  background: #fff; color: var(--case-editing);
  font-size: 8.5px; font-weight: 900;
  padding: 2px 6px;
  border: 2px solid var(--case-editing);
  border-radius: 2px;
  letter-spacing: 0.05em;
  box-shadow: 0 1px 4px rgba(0,0,0,0.5);
  z-index: 3;
}
.case-stamp.resolved {
  color: var(--case-resolved);
  border-color: var(--case-resolved);
  transform: rotate(-6deg);
}
.evidence-required {
  font-size: 10px; color: var(--text-secondary);
  font-family: var(--font-mono); letter-spacing: 0.05em;
  margin-top: 2px;
}
.evidence-required strong { color: var(--accent-gold); font-size: 13px; }
```

### ③ CSS 変数 (`src/ui/styles/tokens.css` 由来、そのまま使えます)

```css
--case-editing:   #3366ff;
--case-resolved:  #ee2255;
--color-blue:     #2b6cb5;
--color-yellow:   #d4a425;
--color-red:      #c84040;
--color-green:    #3aa67a;
--color-purple:   #8a4cc0;
--accent-gold:    #ffd700;
--bg-cell:        rgba(0,0,0,0.32);
--border-zone:    #3a6ea5;
--text-primary:   #e0ecf8;
--text-secondary: #b8d4f0;
--text-muted:     #7090b5;
--font-jp:        "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif;
--font-mono:      "Cascadia Code", "Consolas", monospace;
```

### ④ TypeScript 型定義

```typescript
type CaseColor = 'blue' | 'yellow' | 'red' | 'green' | 'purple';

type CaseInfo = {
  cardId: string;
  title: string;          // 事件タイトル (例: "月光に潜む古城の影")
  color: CaseColor;       // 事件色 (mock では "EVT・青" のように表示)
  level: number;          // 事件レベル (例: 7)
  status: '事件編' | '解決編';
  requiredEvidence: number; // 7 (先攻) or 6 (後攻)
};
```

---

## 注意事項

- ⚠️ 原作キャラ名 (江戸川コナン / 工藤新一 / 怪盗キッド等) は使用禁止
- ✅ ダミー事件タイトルは「月光に潜む古城の影」「霧の駅の謎」等の汎用ミステリ表記 OK
- ✅ 検事印スタンプの傾き角度・ドロップシャドウは mock 通り維持
- ✅ Phase 7 は静的表示のみ、クリック・hover ハンドラ不要 (操作系は Phase 8)

## 納品物の置き場

`C:\Users\arumi\OneDrive\デスクトップ\conan\design-mockups\CaseArea\`
- `CaseArea.tsx`
- `CaseArea.css`
- `CaseArea-demo.html`

納品が完了したら教えてください。`src/ui/components/CaseArea.tsx` + `.css` + `src/ui/hooks/useCase.ts` + `tests/ui/components/CaseArea.test.tsx` に統合・commit します。
