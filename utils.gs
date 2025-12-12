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
 * ログ出力（デバッグ用）
 * @param {string} message - メッセージ
 * @param {any} data - 追加データ（任意）
 */
function logDebug(message, data = null) {
  const timestamp = formatDateTime(new Date());
  if (data) {
    console.log(`[${timestamp}] ${message}`, JSON.stringify(data, null, 2));
  } else {
    console.log(`[${timestamp}] ${message}`);
  }
}

/**
 * エラーログ出力
 * @param {string} message - メッセージ
 * @param {Error} error - エラーオブジェクト
 */
function logError(message, error) {
  const timestamp = formatDateTime(new Date());
  console.error(`[${timestamp}] ERROR: ${message}`, error.message, error.stack);
}
