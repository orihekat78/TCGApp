# 09. 運用・保守の設計

## 結論

長期運用を見据えた以下5つの仕組みを **MVP段階から組み込む**。

## 1. カードセット追加のワークフロー

新弾発売時の対応：

```
[新弾発売]
  ↓
1. 公式 cardlist?package=CT-PXX を Playwright で取得
2. JSONを cards/<type>/<package>/ へ自動配置（フェーズB-04準拠）
3. 1カード1ファイルのスケルトン自動生成
4. 効果テキストを読みつつ実装、テスト
5. AI回帰 100戦パスで本番投入
```

→ **カードスケルトン自動生成スクリプト** を MVP に含める（`scripts/scaffold-card.ts`）。

## 2. ルールマニュアル改訂への追従

タカラトミーは **Ver 2.x** で随時改訂（現在 Ver 2.4）。改訂時の対応：

- `.claude/rules/sources.md` に **準拠バージョンを明記**
- 改訂検出: 公式PDFの URL は不変なので、ハッシュ比較で改訂を検出可能
- 改訂時は影響箇所を `.claude/rules/` に再反映 → 影響テスト追加 → リリース

```typescript
// scripts/check-rule-version.ts
const expectedHash = '...';  // 既知バージョンのハッシュ
const currentHash = await sha256(await fetch(rulePdfUrl));
if (expectedHash !== currentHash) console.warn('ルール改訂の可能性あり');
```

## 3. デバッグツール

エンジンのバグは UI からは追えない。以下を **アプリ内開発者モード** として実装：

- **イベントログビューア**: 直近の Command Log と効果スタックを時系列表示
- **状態インスペクタ**: `G` の任意領域を JSON ツリー表示
- **状態セットアップ**: テスト用に任意の盤面を構築（カード配置・状態設定）
- **ステップ実行**: 効果解決を1ステップずつ進める
- **エクスポート/インポート**: バグ報告用に状態を JSON でダンプ

→ Vite の dev mode でのみ有効化、Cmd+Shift+D で開く。

## 4. 版管理とマイグレーション

```typescript
interface SaveData {
  schemaVersion: number;     // データスキーマ版
  engineVersion: string;     // エンジン版（semver）
  rulesVersion: string;      // 準拠ルール版
  data: { ... };
}
```

- 起動時にバージョン比較
- 互換性のないスキーマは **マイグレーション関数** で順次変換
- マイグレーション失敗時は **バックアップを残し新規作成**

## 5. ロギングと観測

ローカル運用前提でも、以下は出力先を明確に持つ：

| 種別 | 出力先 |
|------|-------|
| エラー（クラッシュ） | `.cache/logs/error.log` + アプリ内通知 |
| 警告（無効状態検出） | `.cache/logs/warn.log` |
| AI 統計（千戦の勝率推移） | `.cache/logs/ai-stats/` |
| リプレイログ | `.cache/replays/<datetime>.json` |

- ローテート: 1日1ファイル、30日で自動削除
- バグ報告時にユーザーが添付できる単一の zip 出力 `pnpm bug-report`

## 6. 廃止/削除予定の追跡

- カード効果の deprecated 警告メカニズム
- ルール変更で挙動が変わるカードに `@deprecated 効果再検証要` タグ
- リリースノート自動生成（git log から差分カードを抽出）

## 関連

- [06-test-strategy.md](06-test-strategy.md) - 自動回帰
- [07-serialization-replay.md](07-serialization-replay.md) - ログ・リプレイ基盤
- [../legal/04-recommendation.md](../legal/04-recommendation.md) - キャッシュ運用
