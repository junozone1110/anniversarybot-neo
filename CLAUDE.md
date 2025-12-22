# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

従業員の誕生日・入社周年を祝うSlack Bot（Google Apps Script）。SmartHR APIから従業員情報を同期し、Slackで通知・ギフト選択フローを提供。

## clasp コマンド

```bash
# GASにプッシュ（ローカル→GAS）
clasp push

# GASからプル（GAS→ローカル）
clasp pull

# GASエディタを開く
clasp open
```

GASエディタでテスト関数を実行する場合は `clasp open` でエディタを開き、関数選択ドロップダウンから実行。

## アーキテクチャ

### データフロー

```
SmartHR API → スプレッドシート（従業員一覧） → Slack DM（前日通知）
                                              ↓
                                   Slack Interactivity（OK/NG・ギフト選択）
                                              ↓
                                   スプレッドシート（回答記録）
                                              ↓
                                   Slack チャンネル（当日お祝い投稿）
```

### 主要ファイルの役割

| ファイル | 責務 |
|----------|------|
| `config.gs` | 設定値（スプレッドシートID、チャンネルID、SmartHR設定）。スクリプトプロパティからトークン取得 |
| `constants.gs` | 定数（EVENT_TYPES, APPROVAL_VALUES, ACTION_ID_PREFIX, LOG_LEVELS等） |
| `main.gs` | トリガー実行のエントリーポイント（sendPreDayNotifications, sendCelebrationMessages） |
| `webapp.gs` | doPost() - Slack Interactivityのエンドポイント。アクションID解析とハンドラー振り分け |
| `smarthr.gs` | SmartHR API連携。GET/PATCH、従業員同期、Slack ID書き戻し |
| `spreadsheet.gs` | スプレッドシート操作。従業員・ギフト・回答記録の読み書き、キャッシュ管理 |
| `slack-api.gs` | Slack API呼び出し（postMessage, sendDm, lookupUserByEmail等） |
| `slack-blocks.gs` | Block Kitメッセージ構築 |
| `tests.gs` | テスト関数。GASエディタから手動実行 |

### Slack Interactivity フロー

1. 前日DM送信時に `approval_ok_{employeeId}_{date}` 形式のaction_idを設定
2. ユーザーがボタン押下 → `doPost()` でペイロード受信
3. `parseActionId()` でアクション種別・従業員ID・日付を抽出
4. 対応するハンドラー（handleApprovalAction, handleGiftSelection等）を実行
5. response_urlで元メッセージを更新

### スクリプトプロパティ（機密情報）

GASの「プロジェクトの設定」→「スクリプト プロパティ」で設定:
- `SLACK_BOT_TOKEN`: xoxb-で始まるBot Token
- `SLACK_SIGNING_SECRET`: Slack AppのSigning Secret
- `SMARTHR_ACCESS_TOKEN`: SmartHR APIアクセストークン
- `ADMIN_SLACK_ID`: エラー通知先（任意）

### SmartHR カスタムフィールド

Slack ID書き戻しには `config.gs` の以下を設定:
- `SMARTHR_SLACK_ID_FIELD_NAME`: カスタムフィールド名（例: 'SlackID'）
- `SMARTHR_SLACK_ID_TEMPLATE_ID`: テンプレートID（従業員詳細APIから取得）

## 開発時の注意

- GASはグローバルスコープで全ファイルが結合される。ファイル間で関数・定数を直接参照可能
- `doPost()` はSlackの3秒タイムアウト制約あり。重い処理は避ける
- スプレッドシートの列インデックスは `EMPLOYEE_COLUMNS`, `RESPONSE_COLUMNS` で定義
- ログレベルは `constants.gs` の `CURRENT_LOG_LEVEL` で変更

## Git コミット・プッシュ時のルール

**GitHubにプッシュする際は、必ず以下を実行すること:**

1. `/commit_log` フォルダ配下に更新ログファイルを作成
2. ファイル名: `YYYY-MM-DD_HH-MM_{簡潔な説明}.md`
3. 内容に含めるもの:
   - 更新日時
   - 変更したファイル一覧
   - 変更内容の要約（何を追加/修正/削除したか）
   - 関連する背景や理由（あれば）

**ログファイルの例:**
```markdown
# 2024-12-23_16-30_smarthr-sync-fix

## 更新日時
2024-12-23 16:30

## 変更ファイル
- smarthr.gs
- config.gs
- spreadsheet.gs

## 変更内容
- SmartHR APIのカスタムフィールドパラメータ名を修正（custom_field_template_id → template_id）
- config.gsにSMARTHR_SLACK_ID_TEMPLATE_IDを追加
- spreadsheet.gsのSmartHR同期処理を有効化

## 背景
SmartHR APIのPATCHリクエストで400エラーが発生していた問題を修正
```

**プッシュ前のチェックリスト:**
1. `commit_log/` に新規ログファイルを作成したか
2. ログファイルをコミットに含めたか
3. `clasp push` でGASにも反映したか（コード変更時）
