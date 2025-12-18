/**
 * ユーティリティ関数
 */

/**
 * 翌日の日付を取得
 * @returns {Date} 翌日の日付（時刻は00:00:00）
 */
function getTomorrow() {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

/**
 * 今日の日付を取得
 * @returns {Date} 今日の日付（時刻は00:00:00）
 */
function getToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

/**
 * 2つの日付の月日が一致するか判定
 * @param {Date} date1 - 日付1
 * @param {Date} date2 - 日付2
 * @returns {boolean} 月日が一致すればtrue
 */
function isSameMonthDay(date1, date2) {
  if (!date1 || !date2) return false;
  return date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * 入社日から経過年数を計算
 * @param {Date} hireDate - 入社日
 * @param {Date} targetDate - 対象日（記念日）
 * @returns {number} 経過年数
 */
function calculateYearsOfService(hireDate, targetDate) {
  if (!hireDate || !targetDate) return 0;

  let years = targetDate.getFullYear() - hireDate.getFullYear();

  // 月日がまだ来ていない場合は1年引く
  if (targetDate.getMonth() < hireDate.getMonth() ||
      (targetDate.getMonth() === hireDate.getMonth() &&
       targetDate.getDate() < hireDate.getDate())) {
    years--;
  }

  return years;
}

/**
 * 入社周年の対象かどうか判定
 * @param {number} years - 経過年数
 * @returns {boolean} 対象年数（1,3,5,10年）ならtrue
 */
function isAnniversaryYear(years) {
  return ANNIVERSARY_YEARS.includes(years);
}

/**
 * 誕生日かどうか判定
 * @param {Date} birthday - 誕生日
 * @param {Date} targetDate - 対象日
 * @returns {boolean} 誕生日ならtrue
 */
function isBirthday(birthday, targetDate) {
  return isSameMonthDay(birthday, targetDate);
}

/**
 * 入社周年かどうか判定
 * @param {Date} hireDate - 入社日
 * @param {Date} targetDate - 対象日
 * @returns {number|null} 対象年数（1,3,5,10年）の場合はその年数、それ以外はnull
 */
function getAnniversaryYears(hireDate, targetDate) {
  if (!isSameMonthDay(hireDate, targetDate)) {
    return null;
  }

  const years = calculateYearsOfService(hireDate, targetDate);
  return isAnniversaryYear(years) ? years : null;
}

/**
 * 日付をフォーマット（YYYY/MM/DD形式）
 * @param {Date} date - 日付
 * @returns {string} フォーマットされた日付文字列
 */
function formatDate(date) {
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

/**
 * 日付時刻をフォーマット（YYYY/MM/DD HH:mm形式）
 * @param {Date} date - 日付時刻
 * @returns {string} フォーマットされた日付時刻文字列
 */
function formatDateTime(date) {
  if (!date) return '';
  const dateStr = formatDate(date);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${dateStr} ${hours}:${minutes}`;
}

/**
 * 文字列からDate型に変換
 * @param {string|Date} value - 日付文字列またはDate
 * @returns {Date|null} Date型またはnull
 */
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const date = new Date(value);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * ログ出力の内部関数
 * @param {number} level - ログレベル
 * @param {string} levelName - レベル名
 * @param {string} message - メッセージ
 * @param {any} data - 追加データ（任意）
 */
function _log(level, levelName, message, data = null) {
  if (level < CURRENT_LOG_LEVEL) return;

  const timestamp = formatDateTime(new Date());
  const prefix = `[${timestamp}] ${levelName}:`;

  if (data) {
    if (level >= LOG_LEVELS.ERROR) {
      console.error(prefix, message, data);
    } else if (level >= LOG_LEVELS.WARN) {
      console.warn(prefix, message, data);
    } else {
      console.log(prefix, message, JSON.stringify(data, null, 2));
    }
  } else {
    if (level >= LOG_LEVELS.ERROR) {
      console.error(prefix, message);
    } else if (level >= LOG_LEVELS.WARN) {
      console.warn(prefix, message);
    } else {
      console.log(prefix, message);
    }
  }
}

/**
 * デバッグログ出力
 * @param {string} message - メッセージ
 * @param {any} data - 追加データ（任意）
 */
function logDebug(message, data = null) {
  _log(LOG_LEVELS.DEBUG, 'DEBUG', message, data);
}

/**
 * 情報ログ出力
 * @param {string} message - メッセージ
 * @param {any} data - 追加データ（任意）
 */
function logInfo(message, data = null) {
  _log(LOG_LEVELS.INFO, 'INFO', message, data);
}

/**
 * 警告ログ出力
 * @param {string} message - メッセージ
 * @param {any} data - 追加データ（任意）
 */
function logWarn(message, data = null) {
  _log(LOG_LEVELS.WARN, 'WARN', message, data);
}

/**
 * エラーログ出力
 * @param {string} message - メッセージ
 * @param {Error} error - エラーオブジェクト
 */
function logError(message, error) {
  _log(LOG_LEVELS.ERROR, 'ERROR', message, { message: error.message, stack: error.stack });
}

/**
 * 安全なJSONパース
 * パースに失敗した場合はエラーログを出力してフォールバック値を返す
 * @param {string} text - パースするJSON文字列
 * @param {any} fallback - パース失敗時の戻り値（デフォルト: null）
 * @returns {any} パース結果またはフォールバック値
 */
function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch (e) {
    logError('JSON parse error', e);
    return fallback;
  }
}

// ==================== 入力バリデーション ====================

/**
 * 従業員IDのバリデーション
 * @param {string|number} id - 従業員ID
 * @returns {string|null} 有効なIDまたはnull
 */
function validateEmployeeId(id) {
  if (id === null || id === undefined || id === '') {
    return null;
  }
  const strId = String(id).trim();
  // 空文字チェック
  if (strId.length === 0) {
    return null;
  }
  // 長さ制限（1〜20文字）
  if (strId.length > 20) {
    return null;
  }
  // 許可文字（英数字、ハイフン、アンダースコア）
  if (!/^[a-zA-Z0-9_-]+$/.test(strId)) {
    return null;
  }
  return strId;
}

/**
 * メールアドレスのバリデーション
 * @param {string} email - メールアドレス
 * @returns {string|null} 有効なメールアドレスまたはnull
 */
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return null;
  }
  const trimmed = email.trim().toLowerCase();
  // 簡易的なメールアドレス形式チェック
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return null;
  }
  // 長さ制限
  if (trimmed.length > 254) {
    return null;
  }
  return trimmed;
}

/**
 * Slack IDのバリデーション
 * @param {string} slackId - Slack ID
 * @returns {string|null} 有効なSlack IDまたはnull
 */
function validateSlackId(slackId) {
  if (!slackId || typeof slackId !== 'string') {
    return null;
  }
  const trimmed = slackId.trim();
  // Slack User IDは通常 U + 10文字の英数字
  if (!/^[UW][A-Z0-9]{8,12}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

/**
 * 日付文字列のバリデーション（YYYY/MM/DD形式）
 * @param {string} dateStr - 日付文字列
 * @returns {string|null} 有効な日付文字列またはnull
 */
function validateDateString(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }
  const trimmed = dateStr.trim();
  // YYYY/MM/DD形式チェック
  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(trimmed)) {
    return null;
  }
  // 実際に有効な日付かチェック
  const parsed = parseDate(trimmed);
  if (!parsed) {
    return null;
  }
  return trimmed;
}

/**
 * ギフトIDのバリデーション
 * @param {string|number} giftId - ギフトID
 * @returns {string|null} 有効なギフトIDまたはnull
 */
function validateGiftId(giftId) {
  if (giftId === null || giftId === undefined || giftId === '') {
    return null;
  }
  const strId = String(giftId).trim();
  // 長さ制限
  if (strId.length === 0 || strId.length > 50) {
    return null;
  }
  return strId;
}

/**
 * 文字列のサニタイズ（HTMLエスケープ）
 * @param {string} str - 入力文字列
 * @returns {string} サニタイズされた文字列
 */
function sanitizeString(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}
