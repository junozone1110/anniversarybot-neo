/**
 * Slack API関連関数
 */

/**
 * Slack APIを呼び出す共通関数
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
  const result = JSON.parse(response.getContentText());

  if (!result.ok) {
    logError(`Slack API Error (${endpoint})`, new Error(result.error));
    throw new Error(`Slack API Error: ${result.error}`);
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
  const token = getSlackBotToken();
  const url = `https://slack.com/api/users.info?user=${userId}`;

  const options = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());

  if (!result.ok) {
    logError(`Slack API Error (users.info)`, new Error(result.error));
    throw new Error(`Slack API Error: ${result.error}`);
  }

  return result.user;
}

/**
 * ユーザーのプロフィール画像URLを取得
 * @param {string} userId - SlackユーザーID
 * @returns {string} プロフィール画像URL（512x512）
 */
function getUserProfileImage(userId) {
  const user = getUserInfo(userId);
  // 利用可能な最大サイズの画像を返す
  return user.profile.image_512 ||
         user.profile.image_192 ||
         user.profile.image_72 ||
         user.profile.image_48;
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

// ==================== Block Kit メッセージ構築 ====================

/**
 * 前日DM用のBlock Kitメッセージを構築（OK/NGのみ）
 * @param {Object} employee - 従業員オブジェクト
 * @param {string} eventType - 記念日種別（'誕生日' または '入社周年'）
 * @param {number} years - 勤続年数（入社周年の場合）
 * @param {Date} eventDate - 記念日
 * @param {Array<Object>} gifts - ギフト一覧（未使用、互換性のため残す）
 * @returns {Array} Block Kit ブロック配列
 */
function buildPreDayDmBlocks(employee, eventType, years, eventDate, gifts) {
  // 記念日の説明文
  let eventDescription;
  if (eventType === '誕生日') {
    eventDescription = `明日はあなたの *お誕生日* です！`;
  } else {
    eventDescription = `明日で *勤続${years}年* を迎えます！`;
  }

  // アクションIDに含める情報（employeeId_eventDate）
  const actionIdSuffix = `${employee.id}_${formatDate(eventDate)}`;

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🎉 *明日は記念日です！*`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${employee.name} さん、${eventDescription}`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'チャンネルでお祝いメッセージを投稿してもよろしいですか？'
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'OK 👍',
            emoji: true
          },
          style: 'primary',
          action_id: `approval_ok_${actionIdSuffix}`,
          value: 'OK'
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'NG 🙅',
            emoji: true
          },
          style: 'danger',
          action_id: `approval_ng_${actionIdSuffix}`,
          value: 'NG'
        }
      ]
    }
  ];

  return blocks;
}

/**
 * OK選択後のギフト選択用Block Kitメッセージを構築
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @param {Array<Object>} gifts - ギフト一覧
 * @returns {Array} Block Kit ブロック配列
 */
function buildGiftSelectBlocks(employeeId, eventDate, gifts) {
  const actionIdSuffix = `${employeeId}_${formatDate(eventDate)}`;

  // ギフト選択オプション（ギフト名を表示）
  // Slackのvalueは文字列である必要があるため、String()で変換
  const giftOptions = gifts.map(gift => ({
    text: {
      type: 'plain_text',
      text: gift.name
    },
    value: String(gift.id)
  }));

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '✅ *お祝いメッセージを投稿します！*\n\n希望するギフトを選択してください：'
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'static_select',
          placeholder: {
            type: 'plain_text',
            text: 'ギフトを選択'
          },
          action_id: `gift_select_${actionIdSuffix}`,
          options: giftOptions
        }
      ]
    }
  ];

  return blocks;
}

/**
 * 当日チャンネル投稿用のBlock Kitメッセージを構築
 * @param {Object} employee - 従業員オブジェクト
 * @param {string} eventType - 記念日種別（'誕生日' または '入社周年'）
 * @param {number} years - 勤続年数（入社周年の場合）
 * @param {Object} gift - 選択されたギフト
 * @param {string} profileImageUrl - プロフィール画像URL
 * @returns {Array} Block Kit ブロック配列
 */
function buildCelebrationBlocks(employee, eventType, years, gift, profileImageUrl) {
  // 入社日フォーマット
  const hireDateStr = employee.hireDate ? formatDate(employee.hireDate) : '';

  // ヘッダーメッセージ（@here + 太字）
  let headerText;
  if (eventType === '誕生日') {
    headerText = '<!here> *誕生日を迎えた方がいらっしゃいます！ギフトを贈ってお祝いしましょう:present:*';
  } else {
    headerText = '<!here> *入社記念日を迎えた方がいます！ギフトを贈ってお祝いしましょう:present:*';
  }

  // メインメッセージ
  let mainText;
  if (eventType === '誕生日') {
    mainText = `*${employee.name}* <@${employee.slackId}> さん、お誕生日おめでとうございます🎂`;
  } else {
    mainText = `*${employee.name}* <@${employee.slackId}> さん、勤続${years}年（${hireDateStr}入社）おめでとうございます🎉`;
  }

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: headerText
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: mainText
      },
      accessory: {
        type: 'image',
        image_url: profileImageUrl,
        alt_text: employee.name
      }
    }
  ];

  // ギフト情報がある場合
  if (gift) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `希望するギフト：*${gift.name}*`
      }
    });

    // ギフトURLがある場合はボタンを追加
    if (gift.url) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'ギフトを贈る 🎁',
              emoji: true
            },
            url: gift.url,
            action_id: 'gift_link_button'
          }
        ]
      });
    }
  }

  return blocks;
}

/**
 * DM応答後の更新メッセージを構築（OK選択時）
 * @param {string} approval - OK または NG
 * @param {string} giftName - 選択されたギフト名（あれば）
 * @returns {Array} Block Kit ブロック配列
 */
function buildResponseConfirmationBlocks(approval, giftName = null) {
  let text;
  if (approval === 'OK') {
    text = '✅ *回答を受け付けました！*\n\n明日、チャンネルでお祝いメッセージを投稿します。';
    if (giftName) {
      text += `\n選択されたギフト：*${giftName}*`;
    }
  } else {
    text = '📝 *回答を受け付けました。*\n\nチャンネルへの投稿はスキップします。';
  }

  return [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: text
      }
    }
  ];
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
