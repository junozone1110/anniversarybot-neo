/**
 * Slack Block Kit メッセージ構築関数
 */

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
  if (eventType === EVENT_TYPES.BIRTHDAY) {
    eventDescription = MESSAGE_TEMPLATES.BIRTHDAY_PRE_DAY;
  } else {
    eventDescription = MESSAGE_TEMPLATES.ANNIVERSARY_PRE_DAY.replace('{years}', years);
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
          action_id: `${ACTION_ID_PREFIX.APPROVAL_OK}${actionIdSuffix}`,
          value: APPROVAL_VALUES.OK
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: 'NG 🙅',
            emoji: true
          },
          style: 'danger',
          action_id: `${ACTION_ID_PREFIX.APPROVAL_NG}${actionIdSuffix}`,
          value: APPROVAL_VALUES.NG
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
          action_id: `${ACTION_ID_PREFIX.GIFT_SELECT}${actionIdSuffix}`,
          options: giftOptions
        }
      ]
    }
  ];

  return blocks;
}

/**
 * ギフト選択確認用Block Kitメッセージを構築
 * @param {string} employeeId - 従業員ID
 * @param {Date} eventDate - 記念日
 * @param {string} giftId - 選択されたギフトID
 * @param {string} giftName - 選択されたギフト名
 * @returns {Array} Block Kit ブロック配列
 */
function buildGiftConfirmBlocks(employeeId, eventDate, giftId, giftName) {
  const actionIdSuffix = `${employeeId}_${formatDate(eventDate)}_${giftId}`;

  const blocks = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `🎁 *選択したギフト:*\n*${giftName}*`
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'このギフトでよろしいですか？'
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '確定する ✓',
            emoji: true
          },
          style: 'primary',
          action_id: `${ACTION_ID_PREFIX.GIFT_CONFIRM}${actionIdSuffix}`,
          value: giftId
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '選び直す',
            emoji: true
          },
          action_id: `${ACTION_ID_PREFIX.GIFT_RETRY}${employeeId}_${formatDate(eventDate)}`,
          value: 'retry'
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
  if (eventType === EVENT_TYPES.BIRTHDAY) {
    headerText = MESSAGE_TEMPLATES.BIRTHDAY_HEADER;
  } else {
    headerText = MESSAGE_TEMPLATES.ANNIVERSARY_HEADER;
  }

  // メインメッセージ
  let mainText;
  if (eventType === EVENT_TYPES.BIRTHDAY) {
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
  if (approval === APPROVAL_VALUES.OK) {
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
