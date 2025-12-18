/**
 * 設定値管理
 *
 * セットアップ手順:
 * 1. SPREADSHEET_ID を自分のスプレッドシートIDに変更
 * 2. CELEBRATION_CHANNEL_ID をお祝い投稿先のチャンネルIDに変更
 * 3. GASエディタで「プロジェクトの設定」→「スクリプト プロパティ」で以下を設定:
 *    - SLACK_BOT_TOKEN: xoxb-で始まるBot Token
 *    - SLACK_SIGNING_SECRET: Slack AppのSigning Secret
 *    - ADMIN_SLACK_ID: (任意) エラー通知先の管理者Slack ID
 */

// スプレッドシートID（要変更）
const SPREADSHEET_ID = '1g1Gf1OcsP84JNFDprCmCQTmR4FVkAFzCF7C48zPzTXg';

// シート名
const SHEET_NAMES = {
  EMPLOYEES: '従業員一覧',
  GIFTS: 'ギフト一覧',
  RESPONSES: '回答記録'
};

// Slack チャンネルID（お祝いメッセージ投稿先）（要変更）
const CELEBRATION_CHANNEL_ID = 'YOUR_CHANNEL_ID';

// 入社周年の対象年数
const ANNIVERSARY_YEARS = [1, 3, 5, 10];

// ==================== SmartHR 設定 ====================

// SmartHRのサブドメイン（例: 'your-company' → https://your-company.smarthr.jp）
const SMARTHR_SUBDOMAIN = '7e540dfa42a4f78136f1bcaf';

// SmartHRでSlack IDを保存しているカスタムフィールド名
const SMARTHR_SLACK_ID_FIELD_NAME = 'slack_id';

/**
 * Slack Bot Tokenを取得
 * @returns {string} Bot Token
 */
function getSlackBotToken() {
  const token = PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN');
  if (!token) {
    throw new Error('SLACK_BOT_TOKEN が設定されていません。スクリプトプロパティに設定してください。');
  }
  return token;
}

/**
 * Slack Signing Secretを取得
 * @returns {string} Signing Secret
 */
function getSlackSigningSecret() {
  const secret = PropertiesService.getScriptProperties().getProperty('SLACK_SIGNING_SECRET');
  if (!secret) {
    throw new Error('SLACK_SIGNING_SECRET が設定されていません。スクリプトプロパティに設定してください。');
  }
  return secret;
}

/**
 * 管理者のSlack IDを取得（エラー通知用）
 * @returns {string|null} 管理者のSlack ID
 */
function getAdminSlackId() {
  return PropertiesService.getScriptProperties().getProperty('ADMIN_SLACK_ID') || null;
}

/**
 * SmartHR APIアクセストークンを取得
 * @returns {string} アクセストークン
 */
function getSmartHrAccessToken() {
  const token = PropertiesService.getScriptProperties().getProperty('SMARTHR_ACCESS_TOKEN');
  if (!token) {
    throw new Error('SMARTHR_ACCESS_TOKEN が設定されていません。スクリプトプロパティに設定してください。');
  }
  return token;
}
