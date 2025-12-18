/**
 * SmartHR API関連関数
 */

// ==================== 同期日時管理 ====================

const LAST_SYNC_PROPERTY_KEY = 'SMARTHR_LAST_SYNC_TIMESTAMP';

/**
 * 前回同期日時を取得
 * @returns {Date|null} 前回同期日時（未設定の場合はnull）
 */
function getLastSyncTimestamp() {
  const timestamp = PropertiesService.getScriptProperties().getProperty(LAST_SYNC_PROPERTY_KEY);
  if (!timestamp) {
    return null;
  }
  return new Date(timestamp);
}

/**
 * 同期日時を保存
 * @param {Date} timestamp - 同期日時（省略時は現在時刻）
 */
function setLastSyncTimestamp(timestamp) {
  const ts = timestamp || new Date();
  PropertiesService.getScriptProperties().setProperty(
    LAST_SYNC_PROPERTY_KEY,
    ts.toISOString()
  );
  console.log('同期日時を設定: ' + ts.toISOString());
}

/**
 * 同期日時をリセット（次回は全件取得になる）
 */
function resetLastSyncTimestamp() {
  PropertiesService.getScriptProperties().deleteProperty(LAST_SYNC_PROPERTY_KEY);
  console.log('同期日時をリセットしました。次回は全件取得されます。');
}

/**
 * 同期日時を現在時刻に設定（手動実行用）
 */
function setLastSyncTimestampNow() {
  const now = new Date();
  setLastSyncTimestamp(now);
  console.log(`同期日時を設定しました: ${now.toISOString()}`);
}

/**
 * SmartHR APIを呼び出す共通関数
 * @param {string} endpoint - APIエンドポイント（例: 'crews'）
 * @param {Object} params - クエリパラメータ
 * @returns {Object} APIレスポンス
 */
function callSmartHrApi(endpoint, params = {}) {
  const token = getSmartHrAccessToken();

  if (!SMARTHR_SUBDOMAIN || SMARTHR_SUBDOMAIN === 'YOUR_SUBDOMAIN') {
    throw new Error('SMARTHR_SUBDOMAIN が設定されていません。config.gsで設定してください。');
  }

  let url = `https://${SMARTHR_SUBDOMAIN}.smarthr.jp/api/v1/${endpoint}`;

  // クエリパラメータを追加
  const queryParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  if (queryParams) {
    url += `?${queryParams}`;
  }

  const options = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode >= 400) {
    const errorBody = response.getContentText();
    logError(`SmartHR API Error (${endpoint})`, new Error(`HTTP ${responseCode}: ${errorBody}`));
    throw new Error(`SmartHR API Error: HTTP ${responseCode}`);
  }

  const data = safeJsonParse(response.getContentText());
  if (data === null) {
    throw new Error('SmartHR API Error: Invalid JSON response');
  }

  return {
    data: data,
    headers: response.getAllHeaders()
  };
}

/**
 * SmartHRから全従業員を取得（ページネーション対応）
 * @returns {Array<Object>} 従業員オブジェクトの配列
 */
function getAllCrewsFromSmartHr() {
  const allCrews = [];
  let page = 1;
  const perPage = API_CONFIG.SMARTHR_PER_PAGE;

  logDebug('SmartHRから従業員一覧を取得開始');

  while (true) {
    const result = callSmartHrApi('crews', {
      page: page,
      per_page: perPage
    });

    const crews = result.data;

    if (!crews || crews.length === 0) {
      break;
    }

    allCrews.push(...crews);
    logDebug(`ページ ${page}: ${crews.length}件取得 (累計: ${allCrews.length}件)`);

    // 取得件数がper_page未満なら最後のページ
    if (crews.length < perPage) {
      break;
    }

    page++;

    // レート制限対策
    Utilities.sleep(API_CONFIG.RATE_LIMIT_DELAY_MS);
  }

  logDebug(`SmartHRから従業員一覧取得完了: ${allCrews.length}件`);
  return allCrews;
}

/**
 * SmartHRから従業員詳細を取得
 * @param {string} crewId - 従業員ID（SmartHRの内部ID）
 * @returns {Object} 従業員詳細オブジェクト
 */
function getCrewDetail(crewId) {
  const result = callSmartHrApi(`crews/${crewId}`);
  return result.data;
}

/**
 * カスタムフィールドからSlack IDを抽出
 * @param {Array<Object>} customFields - カスタムフィールドの配列
 * @returns {string} Slack ID（見つからない場合は空文字）
 */
function extractSlackIdFromCustomFields(customFields) {
  if (!customFields || !Array.isArray(customFields)) {
    return '';
  }

  for (const field of customFields) {
    // カスタムフィールドのテンプレート名または名前で検索
    const fieldName = field.custom_field_template?.name || field.name || '';

    if (fieldName === SMARTHR_SLACK_ID_FIELD_NAME) {
      return field.value || '';
    }
  }

  return '';
}

/**
 * SmartHRの従業員データをスプレッドシート形式に変換
 * @param {Object} crew - SmartHRの従業員データ
 * @param {string} slackId - Slack ID
 * @returns {Object} スプレッドシート形式の従業員データ
 */
function convertCrewToEmployee(crew, slackId) {
  // ビジネスネームがあればそちらを優先、なければ本名を使用
  const lastName = crew.business_last_name || crew.last_name || '';
  const firstName = crew.business_first_name || crew.first_name || '';
  const lastNameKana = crew.business_last_name_yomi || crew.last_name_yomi || '';
  const firstNameKana = crew.business_first_name_yomi || crew.first_name_yomi || '';

  return {
    id: crew.emp_code || '',
    lastName: lastName,
    firstName: firstName,
    lastNameKana: lastNameKana,
    firstNameKana: firstNameKana,
    email: crew.email || '',
    slackId: slackId,
    hireDate: crew.entered_at ? new Date(crew.entered_at) : null,
    birthday: crew.birth_at ? new Date(crew.birth_at) : null,
    retiredDate: crew.resigned_at ? new Date(crew.resigned_at) : null
  };
}

/**
 * 従業員一覧から詳細情報（Slack ID含む）を取得
 * @param {Array<Object>} crews - SmartHRの従業員一覧
 * @returns {Array<Object>} スプレッドシート形式の従業員データ配列
 */
function fetchEmployeeDetailsWithSlackIds(crews) {
  const employees = [];
  let processedCount = 0;
  let errorCount = 0;

  for (const crew of crews) {
    try {
      // 詳細を取得（カスタムフィールドを含む）
      const detail = getCrewDetail(crew.id);

      // カスタムフィールドからSlack IDを抽出
      const slackId = extractSlackIdFromCustomFields(detail.custom_fields);

      // スプレッドシート形式に変換
      const employee = convertCrewToEmployee(detail, slackId);

      // 従業員IDが空でない場合のみ追加
      if (employee.id) {
        employees.push(employee);
      }

      processedCount++;

      // 進捗ログ（50件ごと）
      if (processedCount % 50 === 0) {
        logDebug(`詳細取得進捗: ${processedCount}/${crews.length}件`);
      }

      // レート制限対策
      Utilities.sleep(API_CONFIG.RATE_LIMIT_DELAY_MS);

    } catch (error) {
      logError(`従業員詳細取得エラー (ID: ${crew.id})`, error);
      errorCount++;
      // エラーが発生しても続行
    }
  }

  // エラーが多い場合は警告
  if (errorCount > 0) {
    logDebug(`詳細取得完了（エラー: ${errorCount}件）`);
  }

  return employees;
}

/**
 * SmartHRから従業員データを取得してスプレッドシートを同期（差分更新）
 * メイン同期関数（トリガーから呼び出し）
 * @param {boolean} updateSlackIds - Slack IDも更新するか（デフォルト: true）
 */
function syncEmployeesFromSmartHr(updateSlackIds = true) {
  logDebug('SmartHR同期処理を開始（差分更新モード）');
  const syncStartTime = new Date();

  try {
    // 1. 前回同期日時を取得
    const lastSync = getLastSyncTimestamp();
    if (lastSync) {
      logDebug(`前回同期: ${lastSync.toISOString()}`);
    } else {
      logDebug('初回同期（全件取得）');
    }

    // 2. SmartHRから全従業員の基本情報を取得
    const allCrews = getAllCrewsFromSmartHr();

    if (allCrews.length === 0) {
      logDebug('SmartHRに従業員が存在しません');
      return;
    }

    // 3. 前回同期以降に更新された従業員のみ抽出
    let targetCrews;
    if (lastSync) {
      targetCrews = allCrews.filter(crew => {
        if (!crew.updated_at) return true; // updated_atがない場合は対象に含める
        const updatedAt = new Date(crew.updated_at);
        return updatedAt > lastSync;
      });
      logDebug(`更新対象: ${targetCrews.length}件 / 全${allCrews.length}件`);
    } else {
      targetCrews = allCrews;
      logDebug(`初回のため全件対象: ${targetCrews.length}件`);
    }

    // 4. 更新対象がなければスキップ
    if (targetCrews.length === 0) {
      logDebug('更新対象の従業員がいません');
      setLastSyncTimestamp(syncStartTime);
      return;
    }

    // 5. 対象従業員の詳細を取得
    const employees = fetchEmployeeDetailsWithSlackIds(targetCrews);
    logDebug(`従業員データ変換完了: ${employees.length}件`);

    // 6. スプレッドシートを部分更新
    const result = upsertEmployees(employees);

    // 7. キャッシュをクリア（新しいデータを反映）
    clearCache();

    // 8. 同期日時を保存
    setLastSyncTimestamp(syncStartTime);

    logDebug(`SmartHR同期処理完了: 更新${result.updated}件, 追加${result.added}件`);

    // 9. 新規追加があればSlack IDを更新
    if (updateSlackIds && result.added > 0) {
      logDebug('新規従業員のSlack ID更新処理を開始');
      updateAllSlackIds();
    }

  } catch (error) {
    logError('SmartHR同期処理でエラー', error);
    notifyAdminError(`SmartHR同期エラー: ${error.message}`);
    throw error;
  }
}

/**
 * SmartHRから全件同期（強制的に全従業員を更新）
 * @param {boolean} updateSlackIds - Slack IDも更新するか（デフォルト: true）
 */
function syncAllEmployeesFromSmartHr(updateSlackIds = true) {
  logDebug('SmartHR全件同期処理を開始');

  try {
    // 1. SmartHRから全従業員の基本情報を取得
    const crews = getAllCrewsFromSmartHr();

    if (crews.length === 0) {
      logDebug('SmartHRに従業員が存在しません');
      return;
    }

    // 2. 全従業員の詳細を取得
    const employees = fetchEmployeeDetailsWithSlackIds(crews);
    logDebug(`従業員データ変換完了: ${employees.length}件`);

    // 3. スプレッドシートを全件上書き
    updateEmployeeSheet(employees);

    // 4. キャッシュをクリア
    clearCache();

    // 5. 同期日時を保存
    setLastSyncTimestamp(new Date());

    logDebug(`SmartHR全件同期処理完了: ${employees.length}件の従業員を更新`);

    // 6. Slack IDを更新
    if (updateSlackIds) {
      logDebug('Slack ID更新処理を開始');
      updateAllSlackIds();
    }

  } catch (error) {
    logError('SmartHR全件同期処理でエラー', error);
    notifyAdminError(`SmartHR全件同期エラー: ${error.message}`);
    throw error;
  }
}
