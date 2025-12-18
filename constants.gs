/**
 * 定数定義
 * アプリケーション全体で使用する定数を一元管理
 */

// ==================== イベント種別 ====================

/**
 * 記念日の種別
 * @enum {string}
 */
const EVENT_TYPES = {
  BIRTHDAY: '誕生日',
  ANNIVERSARY: '入社周年'
};

// ==================== 承認値 ====================

/**
 * お祝いメッセージ公開の承認値
 * @enum {string}
 */
const APPROVAL_VALUES = {
  OK: 'OK',
  NG: 'NG'
};

// ==================== API設定 ====================

/**
 * API関連の設定値
 */
const API_CONFIG = {
  /** SmartHR APIの1ページあたりの取得件数 */
  SMARTHR_PER_PAGE: 100,
  /** レート制限対策の待機時間（ミリ秒） */
  RATE_LIMIT_DELAY_MS: 100
};

// ==================== セキュリティ ====================

/**
 * セキュリティ関連の設定値
 */
const SECURITY = {
  /** Slackリプレイ攻撃防止のウィンドウ（秒） */
  REPLAY_WINDOW_SECONDS: 300
};

// ==================== デフォルト値 ====================

/**
 * デフォルト値
 */
const DEFAULTS = {
  /** プロフィール画像が取得できない場合のデフォルト画像 */
  PROFILE_IMAGE_URL: 'https://a.slack-edge.com/80588/img/slackbot_72.png'
};

// ==================== メッセージテンプレート ====================

/**
 * メッセージテンプレート
 */
const MESSAGE_TEMPLATES = {
  /** 誕生日の前日DM説明文 */
  BIRTHDAY_PRE_DAY: '明日はあなたの *お誕生日* です！',
  /** 入社周年の前日DM説明文（{years}は置換） */
  ANNIVERSARY_PRE_DAY: '明日で *勤続{years}年* を迎えます！',
  /** 誕生日のヘッダーメッセージ */
  BIRTHDAY_HEADER: '<!here> *誕生日を迎えた方がいらっしゃいます！ギフトを贈ってお祝いしましょう:present:*',
  /** 入社周年のヘッダーメッセージ */
  ANNIVERSARY_HEADER: '<!here> *入社記念日を迎えた方がいます！ギフトを贈ってお祝いしましょう:present:*'
};

// ==================== アクションIDプレフィックス ====================

/**
 * Slack InteractivityのアクションIDプレフィックス
 */
const ACTION_ID_PREFIX = {
  APPROVAL_OK: 'approval_ok_',
  APPROVAL_NG: 'approval_ng_',
  GIFT_SELECT: 'gift_select_'
};

// ==================== ログレベル ====================

/**
 * ログレベル（数値が大きいほど重要度が高い）
 * @enum {number}
 */
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

/**
 * 現在のログレベル設定
 * DEBUG: 全てのログを出力
 * INFO: INFO以上を出力
 * WARN: WARN以上を出力
 * ERROR: ERRORのみ出力
 */
const CURRENT_LOG_LEVEL = LOG_LEVELS.DEBUG;
