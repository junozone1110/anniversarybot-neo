/**
 * スプレッドシート読み書き関数
 */

/**
 * スプレッドシートを取得
 * @returns {GoogleAppsScript.Spreadsheet.Spreadsheet} スプレッドシート
 */
function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

/**
 * 指定シートを取得
 * @param {string} sheetName - シート名
 * @returns {GoogleAppsScript.Spreadsheet.Sheet} シート
 */
function getSheet(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error(`シート "${sheetName}" が見つかりません。`);
  }
  return sheet;
}

// ==================== 従業員一覧 ====================

/**
 * 従業員データの列インデックス（0始まり）
 */
const EMPLOYEE_COLUMNS = {
  ID: 0,           // A: 従業員ID
  NAME: 1,         // B: 氏名
  SLACK_ID: 2,     // C: Slack ID
  HIRE_DATE: 3,    // D: 入社日
  BIRTHDAY: 4,     // E: 誕生日
  RETIRED: 5,      // F: 退職フラグ
  ON_LEAVE: 6      // G: 休職フラグ
};

/**
 * 全従業員データを取得
 * @returns {Array<Object>} 従業員オブジェクトの配列
 */
function getAllEmployees() {
  const sheet = getSheet(SHEET_NAMES.EMPLOYEES);
  const data = sheet.getDataRange().getValues();

  // ヘッダー行をスキップ
  const employees = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[EMPLOYEE_COLUMNS.ID]) continue; // IDが空の行はスキップ

    employees.push({
      id: row[EMPLOYEE_COLUMNS.ID],
      name: row[EMPLOYEE_COLUMNS.NAME],
      slackId: row[EMPLOYEE_COLUMNS.SLACK_ID],
      hireDate: parseDate(row[EMPLOYEE_COLUMNS.HIRE_DATE]),
      birthday: parseDate(row[EMPLOYEE_COLUMNS.BIRTHDAY]),
      isRetired: row[EMPLOYEE_COLUMNS.RETIRED] === true || row[EMPLOYEE_COLUMNS.RETIRED] === 'TRUE',
      isOnLeave: row[EMPLOYEE_COLUMNS.ON_LEAVE] === true || row[EMPLOYEE_COLUMNS.ON_LEAVE] === 'TRUE'
    });
  }

  return employees;
}

/**
 * アクティブな従業員のみ取得（退職・休職を除く）
 * @returns {Array<Object>} アクティブな従業員オブジェクトの配列
 */
function getActiveEmployees() {
  return getAllEmployees().filter(emp => !emp.isRetired && !emp.isOnLeave);
}

/**
 * 従業員IDから従業員情報を取得
 * @param {string} employeeId - 従業員ID
 * @returns {Object|null} 従業員オブジェクトまたはnull
 */
function getEmployeeById(employeeId) {
  const employees = getAllEmployees();
  return employees.find(emp => emp.id === employeeId) || null;
}

// ==================== ギフト一覧 ====================

/**
 * ギフトデータの列インデックス（0始まり）
 */
const GIFT_COLUMNS = {
  ID: 0,        // A: ギフトID
  NAME: 1,      // B: ギフト名
  URL: 2        // C: 詳細ページURL
};

/**
 * 全ギフトデータを取得
 * @returns {Array<Object>} ギフトオブジェクトの配列
 */
function getAllGifts() {
  const sheet = getSheet(SHEET_NAMES.GIFTS);
  const data = sheet.getDataRange().getValues();

  const gifts = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[GIFT_COLUMNS.ID]) continue;

    gifts.push({
      id: row[GIFT_COLUMNS.ID],
      name: row[GIFT_COLUMNS.NAME],
      url: row[GIFT_COLUMNS.URL]
    });
  }

  return gifts;
}

/**
 * ギフトIDからギフト情報を取得
 * @param {string|number} giftId - ギフトID
 * @returns {Object|null} ギフトオブジェクトまたはnull
 */
function getGiftById(giftId) {
  const gifts = getAllGifts();
  // 型が異なる場合も比較できるよう、両方を文字列に変換して比較
  return gifts.find(gift => String(gift.id) === String(giftId)) || null;
}

// ==================== 回答記録 ====================

/**
 * 回答記録データの列インデックス（0始まり）
 */
const RESPONSE_COLUMNS = {
  TIMESTAMP: 0,       // A: 記録日時
  EMPLOYEE_ID: 1,     // B: 従業員ID
  EVENT_TYPE: 2,      // C: 記念日種別
  EVENT_DATE: 3,      // D: 記念日
  APPROVAL: 4,        // E: 公開OK/NG
  GIFT_ID: 5,         // F: 選択ギフトID
  NOTIFIED: 6         // G: 通知済フラグ
};

/**
 * 回答記録を追加
 * @param {Object} response - 回答記録オブジェクト
 */
function addResponse(response) {
  const sheet = getSheet(SHEET_NAMES.RESPONSES);
  sheet.appendRow([
    new Date(),                           // A: 記録日時
    response.employeeId,                  // B: 従業員ID
    response.eventType,                   // C: 記念日種別
    response.eventDate,                   // D: 記念日
    response.approval || '',              // E: 公開OK/NG
    response.giftId || '',                // F: 選択ギフトID
    false                                 // G: 通知済フラグ
  ]);
}

/**
 * 回答記録を更新（OK/NG）
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @param {string} approval - OK または NG
 */
function updateResponseApproval(employeeId, eventDate, approval) {
  const sheet = getSheet(SHEET_NAMES.RESPONSES);
  const data = sheet.getDataRange().getValues();
  const eventDateStr = formatDate(eventDate);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmployeeId = row[RESPONSE_COLUMNS.EMPLOYEE_ID];
    const rowEventDate = formatDate(parseDate(row[RESPONSE_COLUMNS.EVENT_DATE]));

    if (rowEmployeeId === employeeId && rowEventDate === eventDateStr) {
      // E列（公開OK/NG）を更新
      sheet.getRange(i + 1, RESPONSE_COLUMNS.APPROVAL + 1).setValue(approval);
      logDebug(`回答を更新: ${employeeId}, ${approval}`);
      return;
    }
  }

  logDebug(`回答記録が見つかりません: ${employeeId}, ${eventDateStr}`);
}

/**
 * 回答記録を更新（ギフト選択）
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @param {string} giftId - ギフトID
 */
function updateResponseGift(employeeId, eventDate, giftId) {
  const sheet = getSheet(SHEET_NAMES.RESPONSES);
  const data = sheet.getDataRange().getValues();
  const eventDateStr = formatDate(eventDate);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmployeeId = row[RESPONSE_COLUMNS.EMPLOYEE_ID];
    const rowEventDate = formatDate(parseDate(row[RESPONSE_COLUMNS.EVENT_DATE]));

    if (rowEmployeeId === employeeId && rowEventDate === eventDateStr) {
      // F列（選択ギフトID）を更新
      sheet.getRange(i + 1, RESPONSE_COLUMNS.GIFT_ID + 1).setValue(giftId);
      logDebug(`ギフト選択を更新: ${employeeId}, ${giftId}`);
      return;
    }
  }

  logDebug(`回答記録が見つかりません: ${employeeId}, ${eventDateStr}`);
}

/**
 * 通知済フラグを更新
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 */
function markAsNotified(employeeId, eventDate) {
  const sheet = getSheet(SHEET_NAMES.RESPONSES);
  const data = sheet.getDataRange().getValues();
  const eventDateStr = formatDate(eventDate);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmployeeId = row[RESPONSE_COLUMNS.EMPLOYEE_ID];
    const rowEventDate = formatDate(parseDate(row[RESPONSE_COLUMNS.EVENT_DATE]));

    if (rowEmployeeId === employeeId && rowEventDate === eventDateStr) {
      // G列（通知済フラグ）を更新
      sheet.getRange(i + 1, RESPONSE_COLUMNS.NOTIFIED + 1).setValue(true);
      logDebug(`通知済に更新: ${employeeId}`);
      return;
    }
  }
}

/**
 * 本日が記念日でOKかつ未通知のレコードを取得
 * @returns {Array<Object>} 対象の回答記録配列
 */
function getPendingNotifications() {
  const sheet = getSheet(SHEET_NAMES.RESPONSES);
  const data = sheet.getDataRange().getValues();
  const today = getToday();
  const todayStr = formatDate(today);

  const pending = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const eventDate = formatDate(parseDate(row[RESPONSE_COLUMNS.EVENT_DATE]));
    const approval = row[RESPONSE_COLUMNS.APPROVAL];
    const notified = row[RESPONSE_COLUMNS.NOTIFIED];

    if (eventDate === todayStr && approval === 'OK' && !notified) {
      pending.push({
        rowIndex: i + 1,
        employeeId: row[RESPONSE_COLUMNS.EMPLOYEE_ID],
        eventType: row[RESPONSE_COLUMNS.EVENT_TYPE],
        eventDate: parseDate(row[RESPONSE_COLUMNS.EVENT_DATE]),
        giftId: row[RESPONSE_COLUMNS.GIFT_ID]
      });
    }
  }

  return pending;
}

/**
 * 特定の従業員・記念日の回答記録を取得
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @returns {Object|null} 回答記録またはnull
 */
function getResponseByEmployeeAndDate(employeeId, eventDate) {
  const sheet = getSheet(SHEET_NAMES.RESPONSES);
  const data = sheet.getDataRange().getValues();
  const eventDateStr = formatDate(eventDate);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmployeeId = row[RESPONSE_COLUMNS.EMPLOYEE_ID];
    const rowEventDate = formatDate(parseDate(row[RESPONSE_COLUMNS.EVENT_DATE]));

    if (rowEmployeeId === employeeId && rowEventDate === eventDateStr) {
      return {
        rowIndex: i + 1,
        timestamp: row[RESPONSE_COLUMNS.TIMESTAMP],
        employeeId: rowEmployeeId,
        eventType: row[RESPONSE_COLUMNS.EVENT_TYPE],
        eventDate: parseDate(row[RESPONSE_COLUMNS.EVENT_DATE]),
        approval: row[RESPONSE_COLUMNS.APPROVAL],
        giftId: row[RESPONSE_COLUMNS.GIFT_ID],
        notified: row[RESPONSE_COLUMNS.NOTIFIED]
      };
    }
  }

  return null;
}
