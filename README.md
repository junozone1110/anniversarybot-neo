# Anniversary Bot

従業員の誕生日および入社周年（1年・3年・5年・10年）を祝うSlack Bot。Google Apps Script（GAS）で構築。SmartHR APIと連携して従業員情報を自動同期。

## 機能

- **前日DM通知**: 翌日が記念日の従業員にDMで確認（OK/NG選択 + ギフト選択）
- **当日チャンネル投稿**: OKと回答した従業員のお祝いメッセージをチャンネルに投稿
- **ギフト選択**: 従業員が希望するギフトを選択可能
- **SmartHR連携**: 従業員情報をSmartHR APIから自動同期（差分更新対応）

## 処理フロー

```
[前日 12:00頃]
  ├─ 対象従業員を抽出
  ├─ DMで通知（OK/NG選択）
  ├─ OK選択時にギフト選択
  └─ 回答をスプレッドシートに記録

[当日 13:00頃]
  ├─ OKと回答した従業員を抽出
  └─ チャンネルでお祝いメッセージを投稿
```

## ファイル構成

```
├── config.gs        # 設定値（スプレッドシートID、チャンネルID、SmartHR設定）
├── constants.gs     # 定数定義（イベント種別、承認値、ログレベル等）
├── utils.gs         # ユーティリティ関数（日付計算、ログ出力、バリデーション）
├── spreadsheet.gs   # スプレッドシート読み書き関数
├── slack-api.gs     # Slack API関連関数
├── slack-blocks.gs  # Block Kitメッセージ構築
├── smarthr.gs       # SmartHR API連携
├── webapp.gs        # Web App（doPost）- Interactivity処理
├── main.gs          # メイン処理（トリガー実行）
└── tests.gs         # テスト関数
```

## セットアップ

### 1. スプレッドシートの準備

以下の3シートを作成:

**従業員一覧**
| A列 | B列 | C列 | D列 | E列 | F列 | G列 | H列 | I列 | J列 |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| ビジネスネーム（姓） | ビジネスネーム（名） | 姓カナ | 名カナ | メールアドレス | 社員番号 | 生年月日 | 入社年月日 | 退職年月日 | Slack ID |

**ギフト一覧**
| A列 | B列 | C列 |
|-----|-----|-----|
| ギフトID | ギフト名 | 詳細ページURL |

**回答記録**
| A列 | B列 | C列 | D列 | E列 | F列 | G列 |
|-----|-----|-----|-----|-----|-----|-----|
| 記録日時 | 従業員ID | 記念日種別 | 記念日 | 公開OK/NG | 選択ギフトID | 通知済フラグ |

### 2. Slack Appの作成

1. https://api.slack.com/apps にアクセス
2. 「Create New App」→「From scratch」
3. App名とワークスペースを選択

**必要なBot Token Scopes:**
- `chat:write` - メッセージ送信
- `im:write` - DM送信
- `users:read` - ユーザー情報取得
- `users:read.email` - メールアドレスからユーザー検索

**Interactivity設定:**
- Interactivityを有効化
- Request URLにGAS Web App URLを設定

### 3. SmartHR APIの設定（任意）

1. SmartHR管理画面でAPIアクセストークンを発行
2. `config.gs` の `SMARTHR_SUBDOMAIN` を設定
3. スクリプトプロパティに `SMARTHR_ACCESS_TOKEN` を追加

### 4. GASプロジェクトの設定

1. https://script.google.com で新規プロジェクト作成
2. 各 `.gs` ファイルを作成してコードをコピー
3. `config.gs` の以下を変更:
   - `SPREADSHEET_ID`: 自分のスプレッドシートID
   - `CELEBRATION_CHANNEL_ID`: お祝い投稿先チャンネルID
   - `SMARTHR_SUBDOMAIN`: SmartHRのサブドメイン（SmartHR連携する場合）

4. スクリプトプロパティを設定（プロジェクトの設定 → スクリプト プロパティ）:
   - `SLACK_BOT_TOKEN`: Bot Token（xoxb-で始まる）
   - `SLACK_SIGNING_SECRET`: Signing Secret
   - `ADMIN_SLACK_ID`: （任意）エラー通知先の管理者Slack ID
   - `SMARTHR_ACCESS_TOKEN`: （任意）SmartHR APIアクセストークン

### 5. Web Appのデプロイ

1. 「デプロイ」→「新しいデプロイ」
2. 種類: ウェブアプリ
3. 次のユーザーとして実行: 自分
4. アクセスできるユーザー: 全員
5. デプロイ後、Web App URLをSlack AppのRequest URLに設定

### 6. トリガーの設定

GASエディタで `setupTriggers` 関数を実行:
- 毎日12:00 → 前日DM通知
- 毎日13:00 → 当日お祝い投稿

## 使用方法

### 手動実行

- `sendPreDayNotifications`: 前日DM通知を手動実行
- `sendCelebrationMessages`: 当日お祝い投稿を手動実行

### トリガー管理

- `setupTriggers`: トリガーを設定
- `deleteTriggers`: トリガーを削除

### SmartHR連携

- `syncEmployeesFromSmartHr`: 従業員情報をSmartHRから同期（差分更新）
- `updateActiveEmployeeSlackIds`: 在籍中従業員のSlack IDをメールアドレスから取得

### テスト関数

- `testSmartHrConnection`: SmartHR API接続テスト
- `testSlackIdLookup`: Slack IDルックアップテスト
- `testAllConnections`: 全接続テスト

## ログレベル設定

`constants.gs` の `CURRENT_LOG_LEVEL` で出力レベルを変更可能:
- `LOG_LEVELS.DEBUG`: 全てのログを出力
- `LOG_LEVELS.INFO`: INFO以上を出力
- `LOG_LEVELS.WARN`: WARN以上を出力
- `LOG_LEVELS.ERROR`: ERRORのみ出力

## 入社周年の対象年数

デフォルトで1年、3年、5年、10年が対象。`config.gs` の `ANNIVERSARY_YEARS` で変更可能。

## 注意事項

- GASの実行時間制限（最大6分）があるため、大量の従業員がいる場合はバッチ処理を検討
- トリガーの実行時刻は±15分のズレがある場合がある
- Botをお祝い投稿先チャンネルに招待しておく必要がある
- SmartHR連携は差分更新に対応（`updated_at`フィールドを使用）

## ライセンス

MIT
