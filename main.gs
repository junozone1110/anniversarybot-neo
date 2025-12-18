/**
 * メイン処理（トリガー実行）
 */

/**
 * 前日12:00に実行：翌日が記念日の従業員にDMを送信
 * トリガー設定: 時間主導型 → 日付ベースのタイマー → 午前11時〜12時
 */
function sendPreDayNotifications() {
  logDebug('前日DM通知処理を開始');

  try {
    const tomorrow = getTomorrow();
    const employees = getActiveEmployees();
    const gifts = getAllGifts();

    let sentCount = 0;
    for (const employee of employees) {
      const result = checkAndNotifyEmployee(employee, tomorrow, gifts);
      if (result) sentCount++;
    }

    logDebug(`前日DM通知処理完了: ${sentCount}件送信`);

  } catch (error) {
    logError('前日DM通知処理でエラー', error);
    notifyAdminError(`前日DM通知処理でエラー: ${error.message}`);
  }
}

/**
 * 従業員が記念日対象かチェックしてDMを送信
 * @param {Object} employee - 従業員オブジェクト
 * @param {Date} targetDate - 対象日
 * @param {Array<Object>} gifts - ギフト一覧
 * @returns {boolean} 送信した場合true
 */
function checkAndNotifyEmployee(employee, targetDate, gifts) {
  // 誕生日チェック
  if (isBirthday(employee.birthday, targetDate)) {
    sendPreDayDm(employee, EVENT_TYPES.BIRTHDAY, null, targetDate, gifts);
    return true;
  }

  // 入社周年チェック
  const anniversaryYears = getAnniversaryYears(employee.hireDate, targetDate);
  if (anniversaryYears) {
    sendPreDayDm(employee, EVENT_TYPES.ANNIVERSARY, anniversaryYears, targetDate, gifts);
    return true;
  }

  return false;
}

/**
 * 前日DMを送信
 * @param {Object} employee - 従業員オブジェクト
 * @param {string} eventType - 記念日種別
 * @param {number|null} years - 勤続年数
 * @param {Date} eventDate - 記念日
 * @param {Array<Object>} gifts - ギフト一覧
 */
function sendPreDayDm(employee, eventType, years, eventDate, gifts) {
  try {
    // Block Kit メッセージを構築
    const blocks = buildPreDayDmBlocks(employee, eventType, years, eventDate, gifts);

    // DMを送信
    const fallbackText = `🎉 明日は${eventType}です！確認してください。`;
    sendDm(employee.slackId, fallbackText, blocks);

    // 回答記録に仮レコードを追加
    addResponse({
      employeeId: employee.id,
      eventType: eventType,
      eventDate: eventDate,
      approval: '',
      giftId: ''
    });

  } catch (error) {
    logError(`DM送信エラー: ${employee.name}`, error);
    notifyAdminError(`DM送信エラー（${employee.name}）: ${error.message}`);
  }
}

/**
 * 当日13:00に実行：OKと回答した従業員のお祝いメッセージをチャンネルに投稿
 * トリガー設定: 時間主導型 → 日付ベースのタイマー → 午後12時〜1時
 */
function sendCelebrationMessages() {
  logDebug('当日お祝いメッセージ投稿処理を開始');

  try {
    if (!CELEBRATION_CHANNEL_ID) {
      throw new Error('CELEBRATION_CHANNEL_ID が設定されていません');
    }

    const pendingNotifications = getPendingNotifications();

    if (pendingNotifications.length === 0) {
      logDebug('通知対象がありません');
      return;
    }

    for (const notification of pendingNotifications) {
      postCelebrationMessage(notification);
    }

    logDebug(`当日お祝いメッセージ投稿処理完了: ${pendingNotifications.length}件`);

  } catch (error) {
    logError('当日お祝いメッセージ投稿処理でエラー', error);
    notifyAdminError(`当日お祝いメッセージ投稿処理でエラー: ${error.message}`);
  }
}

/**
 * お祝いメッセージを投稿
 * @param {Object} notification - 通知レコード
 */
function postCelebrationMessage(notification) {
  try {
    const employee = getEmployeeById(notification.employeeId);
    if (!employee) {
      return;
    }

    // ギフト情報を取得
    let gift = null;
    if (notification.giftId) {
      gift = getGiftById(notification.giftId);
    }

    // 勤続年数を計算（入社周年の場合）
    let years = null;
    if (notification.eventType === EVENT_TYPES.ANNIVERSARY) {
      years = calculateYearsOfService(employee.hireDate, notification.eventDate);
    }

    // プロフィール画像を取得（エラー時は自動的にデフォルト画像が返る）
    const profileImageUrl = getUserProfileImage(employee.slackId);

    // Block Kit メッセージを構築
    const blocks = buildCelebrationBlocks(employee, notification.eventType, years, gift, profileImageUrl);

    // チャンネルに投稿
    const fallbackText = notification.eventType === EVENT_TYPES.BIRTHDAY
      ? `🎂 ${employee.name}さん、お誕生日おめでとうございます！`
      : `🎉 ${employee.name}さん、勤続${years}年おめでとうございます！`;

    postMessage(CELEBRATION_CHANNEL_ID, fallbackText, blocks);

    // 通知済フラグを更新
    markAsNotified(notification.employeeId, notification.eventDate);

  } catch (error) {
    logError(`お祝いメッセージ投稿エラー: ${notification.employeeId}`, error);
    notifyAdminError(`お祝いメッセージ投稿エラー（${notification.employeeId}）: ${error.message}`);
  }
}

// ==================== トリガー設定 ====================

/**
 * 全トリガーを設定（初回セットアップ時に1回実行）
 */
function setupTriggers() {
  // 既存のトリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }

  // SmartHR同期 毎日02:00のトリガー
  ScriptApp.newTrigger('syncEmployeesFromSmartHr')
    .timeBased()
    .atHour(2)
    .everyDays(1)
    .create();

  // 前日12:00のトリガー
  ScriptApp.newTrigger('sendPreDayNotifications')
    .timeBased()
    .atHour(12)
    .everyDays(1)
    .create();

  // 当日13:00のトリガー
  ScriptApp.newTrigger('sendCelebrationMessages')
    .timeBased()
    .atHour(13)
    .everyDays(1)
    .create();

  logDebug('トリガーを設定しました（SmartHR同期: 02:00, 前日DM: 12:00, 当日投稿: 13:00）');
}

/**
 * 全トリガーを削除
 */
function deleteTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    ScriptApp.deleteTrigger(trigger);
  }
  logDebug('全トリガーを削除しました');
}
