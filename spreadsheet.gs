/**
 * スプレッドシート読み書き関数
 */

// ==================== キャッシュ ====================

/** @type {Array<Object>|null} 従業員データのキャッシュ */
let _employeesCache = null;

/** @type {Array<Object>|null} ギフトデータのキャッシュ */
let _giftsCache = null;

/**
 * キャッシュをクリア
 * データ更新後や新しいトリガー実行時に呼び出す
 */
function clearCache() {
  _employeesCache = null;
  _giftsCache = null;
}

// ==================== 基本操作 ====================

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
  LAST_NAME: 0,        // A: ビジネスネーム（姓）
  FIRST_NAME: 1,       // B: ビジネスネーム（名）
  LAST_NAME_KANA: 2,   // C: ビジネスネーム（姓カナ）
  FIRST_NAME_KANA: 3,  // D: ビジネスネーム（名カナ）
  EMAIL: 4,            // E: メールアドレス
  EMP_CODE: 5,         // F: 社員番号
  BIRTHDAY: 6,         // G: 生年月日
  HIRE_DATE: 7,        // H: 入社年月日
  RETIRED_DATE: 8,     // I: 退職年月日
  SLACK_ID: 9          // J: Slack ID
};

/**
 * 全従業員データを取得
 * @param {boolean} useCache - キャッシュを使用するか（デフォルト: true）
 * @returns {Array<Object>} 従業員オブジェクトの配列
 */
function getAllEmployees(useCache = true) {
  // キャッシュが有効で存在する場合はキャッシュを返す
  if (useCache && _employeesCache) {
    return _employeesCache;
  }

  const sheet = getSheet(SHEET_NAMES.EMPLOYEES);
  const data = sheet.getDataRange().getValues();

  // ヘッダー行をスキップ
  const employees = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row[EMPLOYEE_COLUMNS.EMP_CODE]) continue; // 社員番号が空の行はスキップ

    const retiredDate = parseDate(row[EMPLOYEE_COLUMNS.RETIRED_DATE]);

    employees.push({
      id: String(row[EMPLOYEE_COLUMNS.EMP_CODE]),
      lastName: row[EMPLOYEE_COLUMNS.LAST_NAME],
      firstName: row[EMPLOYEE_COLUMNS.FIRST_NAME],
      lastNameKana: row[EMPLOYEE_COLUMNS.LAST_NAME_KANA],
      firstNameKana: row[EMPLOYEE_COLUMNS.FIRST_NAME_KANA],
      name: `${row[EMPLOYEE_COLUMNS.LAST_NAME]}${row[EMPLOYEE_COLUMNS.FIRST_NAME]}`,
      email: row[EMPLOYEE_COLUMNS.EMAIL],
      slackId: row[EMPLOYEE_COLUMNS.SLACK_ID],
      hireDate: parseDate(row[EMPLOYEE_COLUMNS.HIRE_DATE]),
      birthday: parseDate(row[EMPLOYEE_COLUMNS.BIRTHDAY]),
      retiredDate: retiredDate,
      isRetired: retiredDate !== null
    });
  }

  // キャッシュに保存
  _employeesCache = employees;
  return employees;
}

/**
 * アクティブな従業員のみ取得（退職者を除く）
 * @returns {Array<Object>} アクティブな従業員オブジェクトの配列
 */
function getActiveEmployees() {
  return getAllEmployees().filter(emp => !emp.isRetired);
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

/**
 * 従業員一覧シートを上書き更新
 * @param {Array<Object>} employees - 従業員オブジェクトの配列
 */
function updateEmployeeSheet(employees) {
  const sheet = getSheet(SHEET_NAMES.EMPLOYEES);
  const columnCount = 10; // A〜J列

  // ヘッダー行を保持しつつ、データ部分をクリア
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, columnCount).clearContent();
  }

  if (employees.length === 0) {
    logDebug('更新する従業員データがありません');
    return;
  }

  // 従業員データを2次元配列に変換
  const data = employees.map(emp => [
    emp.lastName,        // A: ビジネスネーム（姓）
    emp.firstName,       // B: ビジネスネーム（名）
    emp.lastNameKana,    // C: ビジネスネーム（姓カナ）
    emp.firstNameKana,   // D: ビジネスネーム（名カナ）
    emp.email,           // E: メールアドレス
    emp.id,              // F: 社員番号
    emp.birthday,        // G: 生年月日
    emp.hireDate,        // H: 入社年月日
    emp.retiredDate,     // I: 退職年月日
    emp.slackId          // J: Slack ID
  ]);

  // 一括書き込み
  sheet.getRange(2, 1, data.length, columnCount).setValues(data);

  logDebug(`従業員一覧シートを更新: ${data.length}件`);
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
 * @param {boolean} useCache - キャッシュを使用するか（デフォルト: true）
 * @returns {Array<{id: string|number, name: string, url: string}>} ギフトオブジェクトの配列
 */
function getAllGifts(useCache = true) {
  // キャッシュが有効で存在する場合はキャッシュを返す
  if (useCache && _giftsCache) {
    return _giftsCache;
  }

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

  // キャッシュに保存
  _giftsCache = gifts;
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
 * 従業員IDと記念日で回答記録の行を検索
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @returns {{rowIndex: number, row: Array, sheet: GoogleAppsScript.Spreadsheet.Sheet}|null} 検索結果またはnull
 */
function findResponseRowByEmployeeAndDate(employeeId, eventDate) {
  const sheet = getSheet(SHEET_NAMES.RESPONSES);
  const data = sheet.getDataRange().getValues();
  const eventDateStr = formatDate(eventDate);

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowEmployeeId = row[RESPONSE_COLUMNS.EMPLOYEE_ID];
    const rowEventDate = formatDate(parseDate(row[RESPONSE_COLUMNS.EVENT_DATE]));

    if (rowEmployeeId === employeeId && rowEventDate === eventDateStr) {
      return { rowIndex: i + 1, row, sheet };
    }
  }

  return null;
}

/**
 * 回答記録を更新（OK/NG）
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @param {string} approval - OK または NG
 */
function updateResponseApproval(employeeId, eventDate, approval) {
  const result = findResponseRowByEmployeeAndDate(employeeId, eventDate);

  if (result) {
    result.sheet.getRange(result.rowIndex, RESPONSE_COLUMNS.APPROVAL + 1).setValue(approval);
    logDebug(`回答を更新: ${employeeId}, ${approval}`);
  } else {
    logDebug(`回答記録が見つかりません: ${employeeId}, ${formatDate(eventDate)}`);
  }
}

/**
 * 回答記録を更新（ギフト選択）
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @param {string} giftId - ギフトID
 */
function updateResponseGift(employeeId, eventDate, giftId) {
  const result = findResponseRowByEmployeeAndDate(employeeId, eventDate);

  if (result) {
    result.sheet.getRange(result.rowIndex, RESPONSE_COLUMNS.GIFT_ID + 1).setValue(giftId);
    logDebug(`ギフト選択を更新: ${employeeId}, ${giftId}`);
  } else {
    logDebug(`回答記録が見つかりません: ${employeeId}, ${formatDate(eventDate)}`);
  }
}

/**
 * 通知済フラグを更新
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 */
function markAsNotified(employeeId, eventDate) {
  const result = findResponseRowByEmployeeAndDate(employeeId, eventDate);

  if (result) {
    result.sheet.getRange(result.rowIndex, RESPONSE_COLUMNS.NOTIFIED + 1).setValue(true);
    logDebug(`通知済に更新: ${employeeId}`);
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

    if (eventDate === todayStr && approval === APPROVAL_VALUES.OK && !notified) {
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
  const result = findResponseRowByEmployeeAndDate(employeeId, eventDate);

  if (!result) {
    return null;
  }

  const row = result.row;
  return {
    rowIndex: result.rowIndex,
    timestamp: row[RESPONSE_COLUMNS.TIMESTAMP],
    employeeId: row[RESPONSE_COLUMNS.EMPLOYEE_ID],
    eventType: row[RESPONSE_COLUMNS.EVENT_TYPE],
    eventDate: parseDate(row[RESPONSE_COLUMNS.EVENT_DATE]),
    approval: row[RESPONSE_COLUMNS.APPROVAL],
    giftId: row[RESPONSE_COLUMNS.GIFT_ID],
    notified: row[RESPONSE_COLUMNS.NOTIFIED]
  };
}

// ==================== 従業員データ部分更新 ====================

/**
 * 従業員データを部分更新（差分更新用）
 * 既存の従業員は更新、新規の従業員は追加
 * @param {Array<Object>} employees - 更新する従業員オブジェクトの配列
 * @returns {{updated: number, added: number}} 更新件数と追加件数
 */
function upsertEmployees(employees) {
  if (employees.length === 0) {
    return { updated: 0, added: 0 };
  }

  const sheet = getSheet(SHEET_NAMES.EMPLOYEES);
  const data = sheet.getDataRange().getValues();

  // 社員番号をキーとしたインデックスを作成（行番号を保持）
  const empCodeToRowIndex = {};
  for (let i = 1; i < data.length; i++) {
    const empCode = String(data[i][EMPLOYEE_COLUMNS.EMP_CODE]);
    if (empCode) {
      empCodeToRowIndex[empCode] = i + 1; // 1-indexed
    }
  }

  let updatedCount = 0;
  let addedCount = 0;
  const newEmployees = [];

  for (const emp of employees) {
    const empCode = String(emp.id);
    const rowIndex = empCodeToRowIndex[empCode];

    const rowData = [
      emp.lastName,        // A: ビジネスネーム（姓）
      emp.firstName,       // B: ビジネスネーム（名）
      emp.lastNameKana,    // C: ビジネスネーム（姓カナ）
      emp.firstNameKana,   // D: ビジネスネーム（名カナ）
      emp.email,           // E: メールアドレス
      emp.id,              // F: 社員番号
      emp.birthday,        // G: 生年月日
      emp.hireDate,        // H: 入社年月日
      emp.retiredDate,     // I: 退職年月日
      emp.slackId || ''    // J: Slack ID（既存を保持する場合は空で上書きしない）
    ];

    if (rowIndex) {
      // 既存の従業員を更新（Slack IDは既存値を保持）
      const existingSlackId = data[rowIndex - 1][EMPLOYEE_COLUMNS.SLACK_ID];
      if (existingSlackId && !emp.slackId) {
        rowData[EMPLOYEE_COLUMNS.SLACK_ID] = existingSlackId;
      }
      sheet.getRange(rowIndex, 1, 1, 10).setValues([rowData]);
      updatedCount++;
    } else {
      // 新規従業員として追加リストに追加
      newEmployees.push(rowData);
      addedCount++;
    }
  }

  // 新規従業員を一括追加
  if (newEmployees.length > 0) {
    const lastRow = sheet.getLastRow();
    sheet.getRange(lastRow + 1, 1, newEmployees.length, 10).setValues(newEmployees);
  }

  logDebug(`従業員データ部分更新: 更新${updatedCount}件, 追加${addedCount}件`);
  return { updated: updatedCount, added: addedCount };
}

// ==================== Slack ID 更新 ====================

/**
 * 全従業員のSlack IDをメールアドレスから取得して更新
 * 手動実行用の関数
 * @param {boolean} activeOnly - 在籍中のみ対象とするか（デフォルト: true）
 * @param {boolean} syncToSmartHr - SmartHRにも同期するか（デフォルト: true）
 */
function updateAllSlackIds(activeOnly = true, syncToSmartHr = true) {
  console.log('=== Slack ID一括更新処理を開始 ===');
  console.log(`対象: ${activeOnly ? '在籍中のみ' : '全員'}`);
  console.log(`SmartHR同期: ${syncToSmartHr ? '有効' : '無効'}`);

  const sheet = getSheet(SHEET_NAMES.EMPLOYEES);
  const data = sheet.getDataRange().getValues();

  let updatedCount = 0;
  let notFoundCount = 0;
  let alreadySetCount = 0;
  let noEmailCount = 0;
  let retiredCount = 0;

  // SmartHR同期用: 更新した従業員のリスト
  const updatedEmployees = [];

  // ヘッダー行をスキップ
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const empCode = row[EMPLOYEE_COLUMNS.EMP_CODE];
    if (!empCode) continue;

    const email = row[EMPLOYEE_COLUMNS.EMAIL];
    const currentSlackId = row[EMPLOYEE_COLUMNS.SLACK_ID];
    const retiredDate = row[EMPLOYEE_COLUMNS.RETIRED_DATE];
    const name = `${row[EMPLOYEE_COLUMNS.LAST_NAME]}${row[EMPLOYEE_COLUMNS.FIRST_NAME]}`;

    // 退職者はスキップ（activeOnlyがtrueの場合）
    if (activeOnly && retiredDate) {
      retiredCount++;
      continue;
    }

    // 既にSlack IDが設定されている場合はスキップ
    if (currentSlackId) {
      alreadySetCount++;
      continue;
    }

    // メールアドレスがない場合はスキップ
    if (!email) {
      console.log(`[スキップ] ${name}: メールアドレスなし`);
      noEmailCount++;
      continue;
    }

    // Slack APIでユーザー検索
    const user = lookupUserByEmail(email);

    if (user) {
      // Slack IDを更新（J列 = 10列目）
      sheet.getRange(i + 1, EMPLOYEE_COLUMNS.SLACK_ID + 1).setValue(user.id);
      console.log(`[更新] ${name}: ${user.id}`);
      updatedCount++;

      // SmartHR同期用にリストに追加
      updatedEmployees.push({
        empCode: String(empCode),
        slackId: user.id,
        name: name
      });
    } else {
      console.log(`[未発見] ${name}: ${email}`);
      notFoundCount++;
    }

    // レート制限対策
    Utilities.sleep(API_CONFIG.RATE_LIMIT_DELAY_MS);
  }

  // キャッシュをクリア
  clearCache();

  console.log('\n=== スプレッドシート更新完了 ===');
  console.log(`更新: ${updatedCount}件`);
  console.log(`既存: ${alreadySetCount}件`);
  console.log(`未発見: ${notFoundCount}件`);
  console.log(`メールなし: ${noEmailCount}件`);
  if (activeOnly) {
    console.log(`退職者スキップ: ${retiredCount}件`);
  }

  // SmartHRに同期
  // TODO: SmartHR APIトークンの権限追加後にコメントアウトを解除
  // if (syncToSmartHr && updatedEmployees.length > 0) {
  //   console.log('\n=== SmartHRへの同期を開始 ===');
  //   syncUpdatedSlackIdsToSmartHr(updatedEmployees);
  // }
}

/**
 * 更新された従業員のSlack IDをSmartHRに同期
 * @param {Array<{empCode: string, slackId: string, name: string}>} employees - 更新された従業員リスト
 */
function syncUpdatedSlackIdsToSmartHr(employees) {
  try {
    // カスタムフィールドテンプレートIDを取得
    const templateId = getSlackIdCustomFieldTemplateId();
    if (!templateId) {
      console.log('SmartHRにSlack IDカスタムフィールドがないため、同期をスキップ');
      return;
    }

    let syncedCount = 0;
    let errorCount = 0;

    for (const emp of employees) {
      const success = syncSingleSlackIdToSmartHr(emp.empCode, emp.slackId);
      if (success) {
        console.log(`[SmartHR同期] ${emp.name}: ${emp.slackId}`);
        syncedCount++;
      } else {
        console.log(`[SmartHR同期エラー] ${emp.name}`);
        errorCount++;
      }

      // レート制限対策
      Utilities.sleep(API_CONFIG.RATE_LIMIT_DELAY_MS);
    }

    console.log(`\nSmartHR同期完了: 成功${syncedCount}件, エラー${errorCount}件`);

  } catch (error) {
    logError('SmartHR同期でエラー', error);
    console.error('SmartHR同期でエラーが発生しました');
  }
}

/**
 * 在籍中従業員のSlack IDのみ更新（退職者を除く）
 * @param {boolean} syncToSmartHr - SmartHRにも同期するか（デフォルト: true）
 */
function updateActiveEmployeeSlackIds(syncToSmartHr = true) {
  updateAllSlackIds(true, syncToSmartHr);
}

