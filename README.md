# Anniversary Bot

従業員の誕生日および入社周年（1年・3年・5年・10年）を祝うSlack Bot。Google Apps Script（GAS）で構築。

## 機能

- **前日DM通知**: 翌日が記念日の従業員にDMで確認（OK/NG選択 + ギフト選択）
- **当日チャンネル投稿**: OKと回答した従業員のお祝いメッセージをチャンネルに投稿
- **ギフト選択**: 従業員が希望するギフトを選択可能

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
├── config.gs        # 設定値（スプレッドシートID、チャンネルID等）
├── utils.gs         # ユーティリティ関数（日付計算、ログ出力）
├── spreadsheet.gs   # スプレッドシート読み書き関数
├── slack.gs         # Slack API関連、Block Kitメッセージ構築
├── webapp.gs        # Web App（doPost）- Interactivity処理
└── main.gs          # メイン処理（トリガー実行）
```

## セットアップ

### 1. スプレッドシートの準備

以下の3シートを作成:

**従業員一覧**
| A列 | B列 | C列 | D列 | E列 | F列 | G列 |
|-----|-----|-----|-----|-----|-----|-----|
| 従業員ID | 氏名 | Slack ID | 入社日 | 誕生日 | 退職フラグ | 休職フラグ |

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

**Interactivity設定:**
- Interactivityを有効化
- Request URLにGAS Web App URLを設定

### 3. GASプロジェクトの設定

1. https://script.google.com で新規プロジェクト作成
2. 各 `.gs` ファイルを作成してコードをコピー
3. `config.gs` の以下を変更:
   - `SPREADSHEET_ID`: 自分のスプレッドシートID
   - `CELEBRATION_CHANNEL_ID`: お祝い投稿先チャンネルID

4. スクリプトプロパティを設定（プロジェクトの設定 → スクリプト プロパティ）:
   - `SLACK_BOT_TOKEN`: Bot Token（xoxb-で始まる）
   - `SLACK_SIGNING_SECRET`: Signing Secret
   - `ADMIN_SLACK_ID`: （任意）エラー通知先の管理者Slack ID

### 4. Web Appのデプロイ

1. 「デプロイ」→「新しいデプロイ」
2. 種類: ウェブアプリ
3. 次のユーザーとして実行: 自分
4. アクセスできるユーザー: 全員
5. デプロイ後、Web App URLをSlack AppのRequest URLに設定

### 5. トリガーの設定

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

## 入社周年の対象年数

デフォルトで1年、3年、5年、10年が対象。`config.gs` の `ANNIVERSARY_YEARS` で変更可能。

## 注意事項

- GASの実行時間制限（最大6分）があるため、大量の従業員がいる場合はバッチ処理を検討
- トリガーの実行時刻は±15分のズレがある場合がある
- Botをお祝い投稿先チャンネルに招待しておく必要がある

## ライセンス

MIT
