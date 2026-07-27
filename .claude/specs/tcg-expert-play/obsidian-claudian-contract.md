# Obsidian/Claudian契約

## 所有権

- repo: rules、card code、reviewed policy、registry、manifestの正本。
- Vault: private Inbox、Source note、Hypothesis、Synthesisの派生物。
- quarantine: raw log、出典不明、相手hidden、内部state。packetへ禁止。

## 昇格

Vaultからrepoへは、人間review、source ID、情報mode、適用範囲、反例を付けて
手動昇格する。自動同期しない。研究記事をルール事実へ昇格しない。

## packet import

Claudianは使用前に次を検証する。

1. `packetSha256` を再計算する。
2. repo HEADと`sourceCommit`が一致する。
3. source ID、行範囲、content hashがregistry/実ファイルと一致する。
4. `informationMode=public-ui-only`、対象row、許可操作、未解決0。
5. ルールbaselineが全`validated-rule` sourceと一致する。

一つでも違えば `stale-or-invalid-packet`。対局へ渡さない。

## invalidation

repo commit、registry分類、source内容/行範囲、ルール版、対象row、許可操作が
変わればpacketは即stale。Vault noteだけの変更はpacketを更新しない。

## 対局時

packetをfreeze。Vault書込、shell、任意MCP、web検索をしない。公式確認が必要なら
対局を`blocked`にし、repoでreview後に次のpacketを生成する。
