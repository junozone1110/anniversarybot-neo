/**
 * Web App (doPost) - Slack Interactivity 処理
 */

/**
 * POSTリクエストを処理（Slack Interactivityのエンドポイント）
 * @param {Object} e - イベントオブジェクト
 * @returns {GoogleAppsScript.Content.TextOutput} レスポンス
 */
function doPost(e) {
  try {
    // ペイロードをパース（検証より先に行い高速化）
    if (!e || !e.parameter || !e.parameter.payload) {
      return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
    }

    const payload = safeJsonParse(e.parameter.payload);
    if (!payload) {
      return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
    }

    // 重複実行防止（キャッシュのみ、軽量化）
    const triggerId = payload.trigger_id || '';
    if (triggerId) {
      const cache = CacheService.getScriptCache();
      const cacheKey = `p_${triggerId}`;
      if (cache.get(cacheKey)) {
        return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
      }
      cache.put(cacheKey, '1', 60);
    }

    // アクション処理
    handleInteractiveAction(payload);

  } catch (error) {
    logError('doPost エラー', error);
  }

  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Slackリクエストの署名を検証
 * @param {Object} e - イベントオブジェクト
 * @returns {boolean} 検証成功ならtrue
 */
function verifySlackRequest(e) {
  try {
    const signingSecret = getSlackSigningSecret();
    const timestamp = e.parameter['X-Slack-Request-Timestamp'] ||
                      (e.headers && e.headers['X-Slack-Request-Timestamp']);
    const slackSignature = e.parameter['X-Slack-Signature'] ||
                           (e.headers && e.headers['X-Slack-Signature']);

    // GASの制約でheadersが取得できない場合
    // 注意: GAS Web Appではヘッダーが取得できないことが多いため、
    // この場合は検証をスキップする（GASの制約による妥協）
    if (!timestamp || !slackSignature) {
      logDebug('署名検証スキップ: ヘッダー取得不可（GAS Web App制約）');
      // ペイロードの基本的な検証で代替
      return validatePayloadStructure(e);
    }

    // リプレイ攻撃対策：一定時間以上前のリクエストは拒否
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > SECURITY.REPLAY_WINDOW_SECONDS) {
      logDebug(`リプレイ攻撃検出: timestamp=${timestamp}, now=${now}`);
      return false;
    }

    // 署名を計算
    const sigBasestring = `v0:${timestamp}:${e.postData.contents}`;
    const signature = Utilities.computeHmacSha256Signature(sigBasestring, signingSecret);
    const signatureHex = 'v0=' + signature.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');

    const isValid = signatureHex === slackSignature;
    if (!isValid) {
      logDebug('署名不一致');
    }
    return isValid;
  } catch (error) {
    logError('署名検証でエラー', error);
    return false; // エラー時は安全側に倒す
  }
}

/**
 * ペイロード構造の基本検証（署名検証の代替）
 * @param {Object} e - イベントオブジェクト
 * @returns {boolean} 有効な構造ならtrue
 */
function validatePayloadStructure(e) {
  try {
    if (!e.parameter || !e.parameter.payload) {
      return false;
    }
    const payload = safeJsonParse(e.parameter.payload);
    if (!payload) {
      return false;
    }
    // Slack Interactivityの必須フィールドを確認
    if (!payload.type || !payload.user || !payload.response_url) {
      return false;
    }
    // typeが期待値かチェック
    const validTypes = ['block_actions', 'interactive_message', 'view_submission'];
    if (!validTypes.includes(payload.type)) {
      logDebug(`不正なpayload type: ${payload.type}`);
      return false;
    }
    return true;
  } catch (error) {
    logError('ペイロード構造検証でエラー', error);
    return false;
  }
}

/**
 * アクションIDサフィックスをパースしてemployeeIdとeventDateStrを抽出
 * @param {string} suffix - アクションIDからプレフィックスを除いた部分
 * @returns {{employeeId: string, eventDateStr: string}|null} パース結果またはnull
 */
function parseActionIdSuffix(suffix) {
  const lastUnderscoreIndex = suffix.lastIndexOf('_');
  if (lastUnderscoreIndex === -1) return null;

  return {
    employeeId: suffix.slice(0, lastUnderscoreIndex),
    eventDateStr: suffix.slice(lastUnderscoreIndex + 1)
  };
}

/**
 * アクションIDをパースして構造化データを返す
 * @param {string} actionId - アクションID
 * @returns {{type: string, employeeId: string, eventDateStr: string}|null} パース結果またはnull
 */
function parseActionId(actionId) {
  // プレフィックスとタイプのマッピング
  const prefixMapping = [
    { prefix: ACTION_ID_PREFIX.APPROVAL_OK, type: 'approval_ok' },
    { prefix: ACTION_ID_PREFIX.APPROVAL_NG, type: 'approval_ng' },
    { prefix: ACTION_ID_PREFIX.GIFT_SELECT, type: 'gift_select' },
    { prefix: ACTION_ID_PREFIX.GIFT_CONFIRM, type: 'gift_confirm' },
    { prefix: ACTION_ID_PREFIX.GIFT_RETRY, type: 'gift_retry' }
  ];

  for (const { prefix, type } of prefixMapping) {
    if (actionId.startsWith(prefix)) {
      const suffix = actionId.slice(prefix.length);

      // gift_confirmの場合は employeeId_eventDate_giftId 形式
      if (type === 'gift_confirm') {
        const parts = suffix.split('_');
        if (parts.length < 3) return null;
        // 最後がgiftId、その前がeventDate（YYYY/MM/DD）
        const giftId = parts.pop();
        const eventDateStr = parts.pop();
        const employeeId = parts.join('_');
        return {
          type: type,
          employeeId: employeeId,
          eventDateStr: eventDateStr,
          giftId: giftId
        };
      }

      const parsed = parseActionIdSuffix(suffix);
      if (!parsed) return null;

      return {
        type: type,
        employeeId: parsed.employeeId,
        eventDateStr: parsed.eventDateStr
      };
    }
  }

  return null;
}

/**
 * インタラクティブアクションを処理
 * @param {Object} payload - Slackペイロード
 */
function handleInteractiveAction(payload) {
  const actions = payload.actions;
  if (!actions || actions.length === 0) {
    return;
  }

  const action = actions[0];
  const actionId = action.action_id;
  const responseUrl = payload.response_url;

  logDebug(`アクション受信: ${actionId}`);

  // アクションIDをパース
  const parsed = parseActionId(actionId);
  if (!parsed) {
    logDebug(`不明なアクションID: ${actionId}`);
    return;
  }

  // 従業員IDのバリデーション
  const validatedEmployeeId = validateEmployeeId(parsed.employeeId);
  if (!validatedEmployeeId) {
    logError(`従業員IDバリデーションエラー: ${parsed.employeeId}`, new Error('Invalid employee ID'));
    return;
  }

  const eventDate = parseDate(parsed.eventDateStr);
  if (!eventDate) {
    logError(`日付パースエラー: ${parsed.eventDateStr}`, new Error('Invalid date format'));
    return;
  }

  if (parsed.type === 'approval_ok' || parsed.type === 'approval_ng') {
    // OK/NGボタンの処理
    const approval = parsed.type === 'approval_ok' ? APPROVAL_VALUES.OK : APPROVAL_VALUES.NG;
    logDebug(`承認処理: ${validatedEmployeeId}, ${approval}`);
    handleApprovalAction(validatedEmployeeId, eventDate, approval, responseUrl);

  } else if (parsed.type === 'gift_select') {
    // ギフト選択の処理（確認画面を表示）
    const giftId = action.selected_option?.value;
    if (!giftId) {
      logError('ギフトIDが取得できません', new Error('No gift ID'));
      return;
    }
    const validatedGiftId = validateGiftId(giftId);
    if (!validatedGiftId) {
      logError(`ギフトIDバリデーションエラー: ${giftId}`, new Error('Invalid gift ID'));
      return;
    }
    logDebug(`ギフト選択（確認画面表示）: ${validatedEmployeeId}, ギフトID: ${validatedGiftId}`);
    handleGiftSelectAction(validatedEmployeeId, eventDate, validatedGiftId, responseUrl);

  } else if (parsed.type === 'gift_confirm') {
    // ギフト確定の処理
    const giftId = parsed.giftId;
    if (!giftId) {
      logError('ギフトIDが取得できません', new Error('No gift ID'));
      return;
    }
    const validatedGiftId = validateGiftId(giftId);
    if (!validatedGiftId) {
      logError(`ギフトIDバリデーションエラー: ${giftId}`, new Error('Invalid gift ID'));
      return;
    }
    logDebug(`ギフト確定処理: ${validatedEmployeeId}, ギフトID: ${validatedGiftId}`);
    handleGiftConfirmAction(validatedEmployeeId, eventDate, validatedGiftId, responseUrl);

  } else if (parsed.type === 'gift_retry') {
    // ギフト選び直しの処理
    logDebug(`ギフト選び直し: ${validatedEmployeeId}`);
    handleGiftRetryAction(validatedEmployeeId, eventDate, responseUrl);
  }
}

/**
 * OK/NGボタンアクションを処理
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @param {string} approval - OK または NG
 * @param {string} responseUrl - Slack response URL
 */
function handleApprovalAction(employeeId, eventDate, approval, responseUrl) {
  try {
    // スプレッドシートを更新
    updateResponseApproval(employeeId, eventDate, approval);

    if (approval === APPROVAL_VALUES.OK) {
      // OKの場合はギフト選択画面を表示
      const gifts = getAllGifts();
      const blocks = buildGiftSelectBlocks(employeeId, eventDate, gifts);
      sendResponseUrlMessage(responseUrl, blocks);
    } else {
      // NGの場合は完了メッセージを表示
      const blocks = buildResponseConfirmationBlocks(approval, null);
      sendResponseUrlMessage(responseUrl, blocks);
    }
  } catch (error) {
    logError('OK/NG処理でエラー', error);
    notifyAdminError(`OK/NG処理でエラー: ${error.message}`);
  }
}

/**
 * ギフト選択アクションを処理（確認画面を表示）
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @param {string} giftId - ギフトID
 * @param {string} responseUrl - Slack response URL
 */
function handleGiftSelectAction(employeeId, eventDate, giftId, responseUrl) {
  try {
    // ギフト名を取得
    const gift = getGiftById(giftId);
    const giftName = gift ? gift.name : giftId;

    // 確認画面を表示（まだ保存しない）
    const blocks = buildGiftConfirmBlocks(employeeId, eventDate, giftId, giftName);
    sendResponseUrlMessage(responseUrl, blocks);
  } catch (error) {
    logError('ギフト選択処理でエラー', error);
    notifyAdminError(`ギフト選択処理でエラー: ${error.message}`);
  }
}

/**
 * ギフト確定アクションを処理
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @param {string} giftId - ギフトID
 * @param {string} responseUrl - Slack response URL
 */
function handleGiftConfirmAction(employeeId, eventDate, giftId, responseUrl) {
  try {
    // スプレッドシートを更新
    updateResponseGift(employeeId, eventDate, giftId);

    // ギフト名を取得
    const gift = getGiftById(giftId);
    const giftName = gift ? gift.name : giftId;

    // 完了メッセージを表示
    const blocks = buildResponseConfirmationBlocks(APPROVAL_VALUES.OK, giftName);
    sendResponseUrlMessage(responseUrl, blocks);

    logDebug(`ギフト確定完了: ${employeeId}, ${giftName}`);
  } catch (error) {
    logError('ギフト確定処理でエラー', error);
    notifyAdminError(`ギフト確定処理でエラー: ${error.message}`);
  }
}

/**
 * ギフト選び直しアクションを処理
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @param {string} responseUrl - Slack response URL
 */
function handleGiftRetryAction(employeeId, eventDate, responseUrl) {
  try {
    // ギフト選択画面を再表示
    const gifts = getAllGifts();
    const blocks = buildGiftSelectBlocks(employeeId, eventDate, gifts);
    sendResponseUrlMessage(responseUrl, blocks);
  } catch (error) {
    logError('ギフト選び直し処理でエラー', error);
    notifyAdminError(`ギフト選び直し処理でエラー: ${error.message}`);
  }
}

/**
 * response_urlを使ってメッセージを更新
 * @param {string} responseUrl - Slack response URL
 * @param {Array} blocks - Block Kit ブロック配列
 */
function sendResponseUrlMessage(responseUrl, blocks) {
  const payload = {
    replace_original: true,
    blocks: blocks
  };

  const options = {
    method: 'post',
    headers: {
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  UrlFetchApp.fetch(responseUrl, options);
}

/**
 * GETリクエストを処理（動作確認用）
 * @param {Object} e - イベントオブジェクト
 * @returns {GoogleAppsScript.Content.TextOutput} レスポンス
 */
function doGet(e) {
  return ContentService.createTextOutput('Anniversary Bot is running!')
    .setMimeType(ContentService.MimeType.TEXT);
}
