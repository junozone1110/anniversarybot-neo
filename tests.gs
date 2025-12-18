/**
 * テスト関数
 * GASエディタから手動実行してログを確認する用
 */

// ==================== SmartHR テスト ====================

/**
 * SmartHR APIの生データを確認（updated_atフィールドの存在確認）
 */
function testSmartHrRawData() {
  console.log('=== SmartHR 生データ確認 ===');
  const result = callSmartHrApi('crews', { page: 1, per_page: 1 });

  if (result.data.length > 0) {
    const crew = result.data[0];
    console.log('取得したフィールド一覧:');
    console.log(Object.keys(crew).join(', '));
    console.log('\n生データ（JSON）:');
    console.log(JSON.stringify(crew, null, 2));
  }
}

/**
 * SmartHR API接続テスト
 * GASエディタから手動実行してログを確認
 */
function testSmartHrConnection() {
  console.log('=== SmartHR API接続テスト開始 ===');

  try {
    // 1. 設定確認
    console.log(`サブドメイン: ${SMARTHR_SUBDOMAIN}`);
    const token = getSmartHrAccessToken();
    console.log('アクセストークン: 設定済み ✓');

    // 2. 従業員一覧を1件だけ取得
    console.log('\n--- 従業員一覧取得テスト ---');
    const result = callSmartHrApi('crews', { page: 1, per_page: 3 });
    console.log(`取得件数: ${result.data.length}件`);

    // 3. 取得したデータの構造を表示
    if (result.data.length > 0) {
      const crew = result.data[0];
      console.log('\n--- 従業員データサンプル（1件目） ---');
      console.log(`ID: ${crew.id}`);
      console.log(`社員番号: ${crew.emp_code}`);
      console.log(`姓: ${crew.last_name}`);
      console.log(`名: ${crew.first_name}`);
      console.log(`ビジネス姓: ${crew.business_last_name || '(未設定)'}`);
      console.log(`ビジネス名: ${crew.business_first_name || '(未設定)'}`);
      console.log(`メール: ${crew.email || '(未設定)'}`);
      console.log(`入社日: ${crew.entered_at || '(未設定)'}`);
      console.log(`生年月日: ${crew.birth_at || '(未設定)'}`);
      console.log(`退職日: ${crew.resigned_at || '(未設定)'}`);
      console.log(`在籍状況: ${crew.emp_status}`);
      console.log(`作成日時: ${crew.created_at || '(未設定)'}`);
      console.log(`更新日時: ${crew.updated_at || '(未設定)'}`);  // ← 差分更新に使用

      // 4. 詳細を取得してカスタムフィールド確認
      console.log('\n--- 従業員詳細取得テスト ---');
      const detail = getCrewDetail(crew.id);
      console.log(`カスタムフィールド数: ${detail.custom_fields?.length || 0}`);

      if (detail.custom_fields && detail.custom_fields.length > 0) {
        console.log('カスタムフィールド一覧:');
        detail.custom_fields.forEach(field => {
          const fieldName = field.custom_field_template?.name || field.name || '(名前なし)';
          console.log(`  - ${fieldName}: ${field.value || '(空)'}`);
        });
      }

      // Slack ID抽出テスト
      const slackId = extractSlackIdFromCustomFields(detail.custom_fields);
      console.log(`\nSlack ID（${SMARTHR_SLACK_ID_FIELD_NAME}フィールド）: ${slackId || '(未設定)'}`);

      // 5. 変換テスト
      console.log('\n--- データ変換テスト ---');
      const employee = convertCrewToEmployee(detail, slackId);
      console.log('変換結果:');
      console.log(JSON.stringify(employee, null, 2));
    }

    console.log('\n=== テスト完了 ✓ ===');

  } catch (error) {
    console.error('=== テスト失敗 ===');
    console.error(`エラー: ${error.message}`);
    console.error(error.stack);
  }
}

// ==================== Slack テスト ====================

/**
 * Slack ID更新のテスト（最初の3件のみ）
 */
function testSlackIdLookup() {
  console.log('=== Slack IDルックアップテスト ===');

  const sheet = getSheet(SHEET_NAMES.EMPLOYEES);
  const data = sheet.getDataRange().getValues();

  let testCount = 0;
  const maxTests = 3;

  for (let i = 1; i < data.length && testCount < maxTests; i++) {
    const row = data[i];
    const empCode = row[EMPLOYEE_COLUMNS.EMP_CODE];
    if (!empCode) continue;

    const email = row[EMPLOYEE_COLUMNS.EMAIL];
    const name = `${row[EMPLOYEE_COLUMNS.LAST_NAME]}${row[EMPLOYEE_COLUMNS.FIRST_NAME]}`;

    if (!email) {
      console.log(`${name}: メールアドレスなし`);
      testCount++;
      continue;
    }

    console.log(`\n検索: ${name} (${email})`);
    const user = lookupUserByEmail(email);

    if (user) {
      console.log(`  → 発見: ${user.id} (${user.real_name || user.name})`);
    } else {
      console.log(`  → 見つかりません`);
    }

    testCount++;
    Utilities.sleep(API_CONFIG.RATE_LIMIT_DELAY_MS);
  }

  console.log('\n=== テスト完了 ===');
}

// ==================== 全体テスト ====================

/**
 * 全接続テストを実行
 */
function testAllConnections() {
  console.log('========================================');
  console.log('=== 全接続テスト ===');
  console.log('========================================\n');

  console.log('[1/3] SmartHR API テスト');
  console.log('----------------------------------------');
  try {
    testSmartHrRawData();
    console.log('✓ SmartHR API: OK\n');
  } catch (e) {
    console.error(`✗ SmartHR API: ${e.message}\n`);
  }

  console.log('[2/3] Slack API テスト');
  console.log('----------------------------------------');
  try {
    testSlackIdLookup();
    console.log('✓ Slack API: OK\n');
  } catch (e) {
    console.error(`✗ Slack API: ${e.message}\n`);
  }

  console.log('[3/3] スプレッドシート接続テスト');
  console.log('----------------------------------------');
  try {
    const employees = getAllEmployees(false);
    console.log(`従業員数: ${employees.length}件`);
    const gifts = getAllGifts(false);
    console.log(`ギフト数: ${gifts.length}件`);
    console.log('✓ スプレッドシート: OK\n');
  } catch (e) {
    console.error(`✗ スプレッドシート: ${e.message}\n`);
  }

  console.log('========================================');
  console.log('=== テスト完了 ===');
  console.log('========================================');
}
