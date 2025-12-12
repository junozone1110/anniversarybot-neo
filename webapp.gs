/**
 * Web App (doPost) - Slack Interactivity 処理
 */

/**
 * POSTリクエストを処理（Slack Interactivityのエンドポイント）
 * @param {Object} e - イベントオブジェクト
 * @returns {GoogleAppsScript.Content.TextOutput} レスポンス
 */
function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    // リクエスト検証
    if (!verifySlackRequest(e)) {
      logError('Slack署名検証失敗', new Error('Invalid signature'));
      return ContentService.createTextOutput('Invalid signature').setMimeType(ContentService.MimeType.TEXT);
    }

    // ペイロードをパース
    const payload = JSON.parse(e.parameter.payload);

    // 重複実行防止
    const actions = payload.actions;
    if (actions && actions.length > 0) {
      const triggerId = payload.trigger_id || '';

      // ロックを取得（既に処理中なら即座にスキップ）
      if (!lock.tryLock(100)) {
        return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
      }

      // キャッシュで重複チェック
      const cache = CacheService.getScriptCache();
      const cacheKey = `processed_${triggerId}`;
      if (cache.get(cacheKey)) {
        lock.releaseLock();
        return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
      }

      // 処理済みとしてキャッシュに記録（60秒間）
      cache.put(cacheKey, 'processed', 60);
    }

    // アクション処理
    handleInteractiveAction(payload);

    // ロックを解放
    lock.releaseLock();

    return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    logError('doPost エラー', error);
    notifyAdminError(`doPost処理でエラー: ${error.message}`);
    try { lock.releaseLock(); } catch (e) {}
    return ContentService.createTextOutput('Error').setMimeType(ContentService.MimeType.TEXT);
  }
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

    // GASの制約でheadersが取得できない場合がある
    if (!timestamp || !slackSignature) {
      return true;
    }

    // リプレイ攻撃対策：5分以上前のリクエストは拒否
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(timestamp)) > 60 * 5) {
      return false;
    }

    // 署名を計算
    const sigBasestring = `v0:${timestamp}:${e.postData.contents}`;
    const signature = Utilities.computeHmacSha256Signature(sigBasestring, signingSecret);
    const signatureHex = 'v0=' + signature.map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');

    return signatureHex === slackSignature;
  } catch (error) {
    logError('署名検証でエラー', error);
    return true;
  }
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

  // アクションIDからタイプと情報を抽出
  // フォーマット: {type}_{employeeId}_{eventDate}
  const parts = actionId.split('_');

  if (actionId.startsWith('approval_ok_') || actionId.startsWith('approval_ng_')) {
    // OK/NGボタンの処理
    const approval = actionId.startsWith('approval_ok_') ? 'OK' : 'NG';
    const employeeId = parts[2];
    const eventDateStr = parts[3];
    const eventDate = parseDate(eventDateStr);

    handleApprovalAction(employeeId, eventDate, approval, responseUrl);

  } else if (actionId.startsWith('gift_select_')) {
    // ギフト選択の処理
    const employeeId = parts[2];
    const eventDateStr = parts[3];
    const eventDate = parseDate(eventDateStr);
    const giftId = action.selected_option.value;

    handleGiftSelectAction(employeeId, eventDate, giftId, responseUrl);
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

    if (approval === 'OK') {
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
 * ギフト選択アクションを処理
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @param {string} giftId - ギフトID
 * @param {string} responseUrl - Slack response URL
 */
function handleGiftSelectAction(employeeId, eventDate, giftId, responseUrl) {
  try {
    // スプレッドシートを更新
    updateResponseGift(employeeId, eventDate, giftId);

    // ギフト名を取得
    const gift = getGiftById(giftId);
    const giftName = gift ? gift.name : giftId;

    // 現在の回答記録を取得
    const response = getResponseByEmployeeAndDate(employeeId, eventDate);

    // OKが選択されている場合のみ確認メッセージを更新
    if (response && response.approval === 'OK') {
      const blocks = buildResponseConfirmationBlocks('OK', giftName);
      sendResponseUrlMessage(responseUrl, blocks);
    }
  } catch (error) {
    logError('ギフト選択処理でエラー', error);
    notifyAdminError(`ギフト選択処理でエラー: ${error.message}`);
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
