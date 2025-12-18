/**
 * Slack API関連関数
 */

/**
 * Slack APIを呼び出す共通関数（POST）
 * @param {string} endpoint - APIエンドポイント（例: 'chat.postMessage'）
 * @param {Object} payload - リクエストボディ
 * @returns {Object} APIレスポンス
 */
function callSlackApi(endpoint, payload) {
  const token = getSlackBotToken();
  const url = `https://slack.com/api/${endpoint}`;

  const options = {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = safeJsonParse(response.getContentText());

  if (!result) {
    throw new Error('Slack API Error: Invalid JSON response');
  }

  if (!result.ok) {
    logError(`Slack API Error (${endpoint})`, new Error(result.error));
    throw new Error(`Slack API Error: ${result.error}`);
  }

  return result;
}

/**
 * Slack APIを呼び出す共通関数（GET）
 * @param {string} endpoint - APIエンドポイント（例: 'users.info'）
 * @param {Object} params - クエリパラメータ
 * @returns {Object|null} APIレスポンス（エラー時はnull）
 */
function callSlackApiGet(endpoint, params = {}) {
  const token = getSlackBotToken();

  // クエリパラメータを構築
  const queryString = Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  const url = queryString
    ? `https://slack.com/api/${endpoint}?${queryString}`
    : `https://slack.com/api/${endpoint}`;

  const options = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = safeJsonParse(response.getContentText());

  if (!result) {
    logError(`Slack API Error (${endpoint}): Invalid JSON response`, new Error('Invalid JSON'));
    return null;
  }

  return result;
}

/**
 * DMチャンネルを開く
 * @param {string} userId - SlackユーザーID
 * @returns {string} DMチャンネルID
 */
function openDmChannel(userId) {
  const result = callSlackApi('conversations.open', {
    users: userId
  });
  return result.channel.id;
}

/**
 * メッセージを送信
 * @param {string} channel - チャンネルIDまたはDMチャンネルID
 * @param {string} text - フォールバックテキスト
 * @param {Array} blocks - Block Kit ブロック配列
 * @returns {Object} APIレスポンス
 */
function postMessage(channel, text, blocks = null) {
  const payload = {
    channel: channel,
    text: text
  };

  if (blocks) {
    payload.blocks = blocks;
  }

  return callSlackApi('chat.postMessage', payload);
}

/**
 * DMを送信
 * @param {string} userId - SlackユーザーID
 * @param {string} text - フォールバックテキスト
 * @param {Array} blocks - Block Kit ブロック配列
 * @returns {Object} APIレスポンス
 */
function sendDm(userId, text, blocks = null) {
  const channelId = openDmChannel(userId);
  return postMessage(channelId, text, blocks);
}

/**
 * ユーザー情報を取得
 * @param {string} userId - SlackユーザーID
 * @returns {Object} ユーザー情報
 */
function getUserInfo(userId) {
  const result = callSlackApiGet('users.info', { user: userId });

  if (!result) {
    throw new Error('Slack API Error: Invalid JSON response');
  }

  if (!result.ok) {
    logError(`Slack API Error (users.info)`, new Error(result.error));
    throw new Error(`Slack API Error: ${result.error}`);
  }

  return result.user;
}

/**
 * ユーザーのプロフィール画像URLを取得
 * @param {string} userId - SlackユーザーID
 * @returns {string} プロフィール画像URL（取得失敗時はデフォルト画像）
 */
function getUserProfileImage(userId) {
  try {
    const user = getUserInfo(userId);
    // 利用可能な最大サイズの画像を返す
    return user?.profile?.image_512 ||
           user?.profile?.image_192 ||
           user?.profile?.image_72 ||
           user?.profile?.image_48 ||
           DEFAULTS.PROFILE_IMAGE_URL;
  } catch (e) {
    logError(`プロフィール画像取得エラー (${userId})`, e);
    return DEFAULTS.PROFILE_IMAGE_URL;
  }
}

/**
 * メッセージを更新（Interactivity応答後など）
 * @param {string} channel - チャンネルID
 * @param {string} ts - メッセージのタイムスタンプ
 * @param {string} text - 新しいテキスト
 * @param {Array} blocks - 新しいBlock Kit ブロック配列
 * @returns {Object} APIレスポンス
 */
function updateMessage(channel, ts, text, blocks = null) {
  const payload = {
    channel: channel,
    ts: ts,
    text: text
  };

  if (blocks) {
    payload.blocks = blocks;
  }

  return callSlackApi('chat.update', payload);
}

/**
 * メールアドレスからSlackユーザーを検索
 * @param {string} email - メールアドレス
 * @returns {Object|null} ユーザー情報（見つからない場合はnull）
 */
function lookupUserByEmail(email) {
  if (!email) {
    return null;
  }

  const result = callSlackApiGet('users.lookupByEmail', { email: email });

  if (!result) {
    return null;
  }

  // users_not_found エラーは正常系として扱う（ユーザーが見つからないだけ）
  if (!result.ok) {
    if (result.error === 'users_not_found') {
      return null;
    }
    logError(`Slack API Error (users.lookupByEmail)`, new Error(result.error));
    return null;
  }

  return result.user;
}

/**
 * 管理者にエラー通知を送信
 * @param {string} errorMessage - エラーメッセージ
 */
function notifyAdminError(errorMessage) {
  const adminId = getAdminSlackId();
  if (!adminId) {
    logDebug('管理者Slack IDが設定されていないため、エラー通知をスキップ');
    return;
  }

  try {
    sendDm(adminId, `⚠️ Anniversary Bot エラー通知\n\n${errorMessage}`);
  } catch (e) {
    logError('管理者通知の送信に失敗', e);
  }
}
