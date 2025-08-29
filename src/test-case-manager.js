import fs from 'fs';
import path from 'path';
import inquirer from 'inquirer';
import chalk from 'chalk';
import iconv from 'iconv-lite';

class TestCaseManager {
  constructor() {
    this.testCasesPath = path.join(process.cwd(), 'config', 'test-cases.json');
    this.testCases = this.loadTestCases();
  }

  loadTestCases() {
    try {
      if (fs.existsSync(this.testCasesPath)) {
        const data = fs.readFileSync(this.testCasesPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(chalk.red('テストケース読み込みエラー:'), error.message);
    }
    
    return {
      test_cases: [],
      last_updated: new Date().toISOString(),
      version: '1.0.0'
    };
  }

  saveTestCases(options = {}) {
    try {
      const dir = path.dirname(this.testCasesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // 新規作成時は既存ファイルをリネーム
      if (options.createNew && fs.existsSync(this.testCasesPath)) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const backupPath = path.join(dir, `test-cases-backup-${timestamp}.json`);
        
        // 既存ファイルをバックアップ
        fs.renameSync(this.testCasesPath, backupPath);
        console.log(chalk.gray(`📦 既存ファイルをバックアップ: ${path.basename(backupPath)}`));
        
        // resetContentが指定されていてもtestCasesが空でない場合は、そのまま使用
        // （自動生成時は既に新しいテストケースが設定されているため）
        if (options.resetContent && (!this.testCases.test_cases || this.testCases.test_cases.length === 0)) {
          this.testCases = {
            test_cases: [],
            last_updated: new Date().toISOString(),
            version: '1.0.0'
          };
        }
      }
      
      this.testCases.last_updated = new Date().toISOString();
      fs.writeFileSync(this.testCasesPath, JSON.stringify(this.testCases, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error(chalk.red('テストケース保存エラー:'), error.message);
      return false;
    }
  }

  async listTestCases() {
    console.log(chalk.cyan('\n📋 テストケース一覧\n'));

    if (this.testCases.test_cases.length === 0) {
      console.log(chalk.yellow('⚠️  テストケースがありません'));
      console.log(chalk.gray('💡 "./web-test generate" でテストケースを作成してください'));
      return;
    }

    // テーブル作成
    const table = new Table({
      head: [
        chalk.cyan('ID'),
        chalk.cyan('カテゴリ'),
        chalk.cyan('テストケース名'),
        chalk.cyan('優先度'),
        chalk.cyan('ステップ数'),
        chalk.cyan('作成日')
      ],
      colWidths: [8, 15, 30, 10, 12, 20],
      wordWrap: true
    });

    // カテゴリごとにグループ化
    const categorizedTests = {};
    this.testCases.test_cases.forEach(tc => {
      if (!categorizedTests[tc.test_category]) {
        categorizedTests[tc.test_category] = [];
      }
      categorizedTests[tc.test_category].push(tc);
    });

    // カテゴリごとにソートして表示
    Object.keys(categorizedTests).sort().forEach(category => {
      categorizedTests[category].forEach(tc => {
        const priorityColor = tc.priority === 'High' ? chalk.red :
                            tc.priority === 'Medium' ? chalk.yellow :
                            chalk.green;

        table.push([
          chalk.bold(tc.test_id),
          tc.test_category,
          tc.test_case_name,
          priorityColor(tc.priority),
          tc.test_steps.length,
          new Date(tc.created_date).toLocaleDateString('ja-JP')
        ]);
      });
    });

    console.log(table.toString());
    
    // サマリー表示
    this.showSummary();
  }

  showSummary() {
    const total = this.testCases.test_cases.length;
    const highPriority = this.testCases.test_cases.filter(tc => tc.priority === 'High').length;
    const mediumPriority = this.testCases.test_cases.filter(tc => tc.priority === 'Medium').length;
    const lowPriority = this.testCases.test_cases.filter(tc => tc.priority === 'Low').length;

    const categories = {};
    this.testCases.test_cases.forEach(tc => {
      categories[tc.test_category] = (categories[tc.test_category] || 0) + 1;
    });

    console.log(chalk.cyan('\n📊 サマリー'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`総テストケース数: ${chalk.bold(total)}`);
    console.log(`優先度別: ${chalk.red(`High: ${highPriority}`)} | ${chalk.yellow(`Medium: ${mediumPriority}`)} | ${chalk.green(`Low: ${lowPriority}`)}`);
    console.log(`カテゴリ数: ${Object.keys(categories).length}`);
    
    if (Object.keys(categories).length > 0) {
      console.log('\nカテゴリ別:');
      Object.entries(categories).forEach(([category, count]) => {
        console.log(`  • ${category}: ${count}件`);
      });
    }
    
    console.log(chalk.gray('─'.repeat(40)));
  }

  async showUI() {
    console.log(chalk.cyan('\n🗂️ テストケース管理\n'));

    const choices = [
      '1. テストケース一覧',
      '2. テストケース詳細表示',
      '3. テストケース編集',
      '4. テストケース削除',
      '5. テストケース複製',
      '6. テストケースエクスポート',
      '7. テストケースインポート',
      '8. カテゴリ管理',
      '9. 終了'
    ];

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '操作を選択してください:',
        choices
      }
    ]);

    switch (action.charAt(0)) {
      case '1':
        await this.listTestCases();
        break;
      case '2':
        await this.showTestCaseDetail();
        break;
      case '3':
        await this.editTestCase();
        break;
      case '4':
        await this.deleteTestCase();
        break;
      case '5':
        await this.duplicateTestCase();
        break;
      case '6':
        await this.exportTestCases();
        break;
      case '7':
        await this.importTestCases();
        break;
      case '8':
        await this.manageCategories();
        break;
      case '9':
        console.log(chalk.green('✅ テストケース管理を終了しました'));
        return;
    }

    await this.showUI();
  }

  async showTestCaseDetail() {
    if (this.testCases.test_cases.length === 0) {
      console.log(chalk.yellow('⚠️  テストケースがありません'));
      return;
    }

    const { testId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'testId',
        message: 'テストケースを選択:',
        choices: this.testCases.test_cases.map(tc => ({
          name: `${tc.test_id} - ${tc.test_case_name}`,
          value: tc.test_id
        }))
      }
    ]);

    const testCase = this.testCases.test_cases.find(tc => tc.test_id === testId);
    
    if (!testCase) {
      console.log(chalk.red('❌ テストケースが見つかりません'));
      return;
    }

    console.log(chalk.cyan(`\n📄 テストケース詳細: ${testCase.test_id}\n`));
    console.log(chalk.gray('─'.repeat(60)));
    
    console.log(chalk.bold('基本情報:'));
    console.log(`  ID: ${testCase.test_id}`);
    console.log(`  名前: ${testCase.test_case_name}`);
    console.log(`  カテゴリ: ${testCase.test_category}`);
    console.log(`  優先度: ${this.getPriorityColored(testCase.priority)}`);
    console.log(`  前提条件: ${testCase.preconditions}`);
    console.log(`  期待結果: ${testCase.expected_result}`);
    
    console.log(chalk.bold('\nテストステップ:'));
    testCase.test_steps.forEach(step => {
      console.log(`  ${step.step_number}. ${step.description}`);
      console.log(chalk.gray(`     アクション: ${step.action} | ターゲット: ${step.target}`));
      if (step.value) {
        console.log(chalk.gray(`     値: ${step.value}`));
      }
    });

    if (testCase.assertion) {
      console.log(chalk.bold('\nアサーション:'));
      console.log(`  タイプ: ${testCase.assertion.type}`);
      console.log(`  値: ${testCase.assertion.value}`);
    }

    if (testCase.test_data) {
      console.log(chalk.bold('\nテストデータ:'));
      Object.entries(testCase.test_data).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    }

    console.log(chalk.bold('\nメタデータ:'));
    console.log(`  作成日: ${new Date(testCase.created_date).toLocaleString('ja-JP')}`);
    console.log(`  更新日: ${new Date(testCase.updated_date).toLocaleString('ja-JP')}`);
    
    if (testCase.screenshots && testCase.screenshots.length > 0) {
      console.log(`  スクリーンショット: ${testCase.screenshots.length}枚`);
    }

    console.log(chalk.gray('─'.repeat(60)));

    // Playwrightコード表示オプション
    const { showCode } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'showCode',
        message: 'Playwrightコードを表示しますか？',
        default: false
      }
    ]);

    if (showCode) {
      console.log(chalk.cyan('\n📝 Playwrightコード:\n'));
      console.log(chalk.gray(testCase.generated_playwright_code));
    }
  }

  getPriorityColored(priority) {
    switch (priority) {
      case 'High':
        return chalk.red(priority);
      case 'Medium':
        return chalk.yellow(priority);
      case 'Low':
        return chalk.green(priority);
      default:
        return priority;
    }
  }

  async editTestCase() {
    if (this.testCases.test_cases.length === 0) {
      console.log(chalk.yellow('⚠️  編集するテストケースがありません'));
      return;
    }

    const { testId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'testId',
        message: '編集するテストケースを選択:',
        choices: this.testCases.test_cases.map(tc => ({
          name: `${tc.test_id} - ${tc.test_case_name}`,
          value: tc.test_id
        }))
      }
    ]);

    const testCase = this.testCases.test_cases.find(tc => tc.test_id === testId);
    
    if (!testCase) {
      console.log(chalk.red('❌ テストケースが見つかりません'));
      return;
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'test_case_name',
        message: 'テストケース名:',
        default: testCase.test_case_name
      },
      {
        type: 'input',
        name: 'test_category',
        message: 'テストカテゴリ:',
        default: testCase.test_category
      },
      {
        type: 'list',
        name: 'priority',
        message: '優先度:',
        choices: ['High', 'Medium', 'Low'],
        default: testCase.priority
      },
      {
        type: 'input',
        name: 'preconditions',
        message: '前提条件:',
        default: testCase.preconditions
      },
      {
        type: 'input',
        name: 'expected_result',
        message: '期待結果:',
        default: testCase.expected_result
      }
    ]);

    Object.assign(testCase, answers);
    testCase.updated_date = new Date().toISOString();
    
    if (this.saveTestCases()) {
      console.log(chalk.green(`✅ テストケース ${testCase.test_id} を更新しました`));
    }
  }

  async deleteTestCase(testId = null) {
    if (this.testCases.test_cases.length === 0) {
      console.log(chalk.yellow('⚠️  削除するテストケースがありません'));
      return;
    }

    if (!testId) {
      const answer = await inquirer.prompt([
        {
          type: 'list',
          name: 'testId',
          message: '削除するテストケースを選択:',
          choices: this.testCases.test_cases.map(tc => ({
            name: `${tc.test_id} - ${tc.test_case_name}`,
            value: tc.test_id
          }))
        }
      ]);
      testId = answer.testId;
    }

    const testCase = this.testCases.test_cases.find(tc => tc.test_id === testId);
    
    if (!testCase) {
      console.log(chalk.red(`❌ テストケース ${testId} が見つかりません`));
      return;
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `本当にテストケース "${testCase.test_case_name}" (${testCase.test_id}) を削除しますか？`,
        default: false
      }
    ]);

    if (confirm) {
      const index = this.testCases.test_cases.findIndex(tc => tc.test_id === testId);
      this.testCases.test_cases.splice(index, 1);
      
      if (this.saveTestCases()) {
        console.log(chalk.green(`✅ テストケース ${testId} を削除しました`));
        
        // 関連するテストファイルも削除
        this.deleteTestFile(testCase);
      }
    }
  }

  deleteTestFile(testCase) {
    const testsDir = path.join(process.cwd(), 'tests');
    const testFileName = `${testCase.test_id}_${testCase.test_case_name.replace(/[^a-zA-Z0-9]/g, '_')}.spec.js`;
    const testFilePath = path.join(testsDir, testFileName);

    if (fs.existsSync(testFilePath)) {
      try {
        fs.unlinkSync(testFilePath);
        console.log(chalk.gray(`  削除: tests/${testFileName}`));
      } catch (error) {
        console.error(chalk.red('テストファイル削除エラー:'), error.message);
      }
    }
  }

  async duplicateTestCase() {
    if (this.testCases.test_cases.length === 0) {
      console.log(chalk.yellow('⚠️  複製するテストケースがありません'));
      return;
    }

    const { testId } = await inquirer.prompt([
      {
        type: 'list',
        name: 'testId',
        message: '複製するテストケースを選択:',
        choices: this.testCases.test_cases.map(tc => ({
          name: `${tc.test_id} - ${tc.test_case_name}`,
          value: tc.test_id
        }))
      }
    ]);

    const originalTestCase = this.testCases.test_cases.find(tc => tc.test_id === testId);
    
    if (!originalTestCase) {
      console.log(chalk.red('❌ テストケースが見つかりません'));
      return;
    }

    const { newName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newName',
        message: '新しいテストケース名:',
        default: `${originalTestCase.test_case_name} (コピー)`,
        validate: (input) => input.length > 0 || 'テストケース名を入力してください'
      }
    ]);

    // 新しいテストケースを作成
    const newTestCase = JSON.parse(JSON.stringify(originalTestCase));
    newTestCase.test_id = this.generateTestId();
    newTestCase.test_case_name = newName;
    newTestCase.created_date = new Date().toISOString();
    newTestCase.updated_date = new Date().toISOString();

    this.testCases.test_cases.push(newTestCase);
    
    if (this.saveTestCases()) {
      console.log(chalk.green(`✅ テストケース ${newTestCase.test_id} を作成しました`));
    }
  }

  generateTestId() {
    const existingIds = this.testCases.test_cases.map(tc => tc.test_id);
    let id = 1;
    let testId;
    
    do {
      testId = `TC${String(id).padStart(3, '0')}`;
      id++;
    } while (existingIds.includes(testId));
    
    return testId;
  }

  async exportTestCasesWithOptions(options = {}) {
    const format = options.format || 'csv';
    const encoding = options.encoding || 'shift_jis';
    
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    let filename;
    let content;

    switch (format) {
      case 'json':
        filename = `test-cases-export-${timestamp}.json`;
        content = JSON.stringify(this.testCases, null, 2);
        break;
      
      case 'csv':
        filename = `test-cases-export-${timestamp}.csv`;
        content = this.convertToCSV();
        break;
      
      case 'markdown':
        filename = `test-cases-export-${timestamp}.md`;
        content = this.convertToMarkdown();
        break;
      
      default:
        console.error(chalk.red(`未対応の形式: ${format}`));
        return;
    }

    const filepath = path.join(exportDir, filename);
    
    try {
      // エンコーディングに応じて保存
      if (encoding === 'shift_jis') {
        const sjisBuffer = iconv.encode(content, 'Shift_JIS');
        fs.writeFileSync(filepath, sjisBuffer);
        console.log(chalk.green(`✅ エクスポート完了: exports/${filename} (Shift-JIS)`));
      } else if (encoding === 'utf8_bom') {
        const BOM = '\uFEFF';
        fs.writeFileSync(filepath, BOM + content, 'utf8');
        console.log(chalk.green(`✅ エクスポート完了: exports/${filename} (UTF-8 BOM)`));
      } else {
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(chalk.green(`✅ エクスポート完了: exports/${filename} (UTF-8)`));
      }
    } catch (error) {
      console.error(chalk.red('エクスポートエラー:'), error.message);
    }
  }

  async exportTestCases() {
    const { format, encoding } = await inquirer.prompt([
      {
        type: 'list',
        name: 'format',
        message: 'エクスポート形式を選択:',
        choices: [
          { name: 'JSON形式', value: 'json' },
          { name: 'CSV形式', value: 'csv' },
          { name: 'Markdown形式', value: 'markdown' }
        ]
      },
      {
        type: 'list',
        name: 'encoding',
        message: '文字エンコーディングを選択:',
        choices: [
          { name: 'Shift-JIS (Excel互換)', value: 'shift_jis' },
          { name: 'UTF-8 (BOM付き)', value: 'utf8_bom' },
          { name: 'UTF-8 (BOMなし)', value: 'utf8' }
        ],
        default: 'shift_jis'
      }
    ]);

    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    let filename;
    let content;

    switch (format) {
      case 'json':
        filename = `test-cases-export-${timestamp}.json`;
        content = JSON.stringify(this.testCases, null, 2);
        break;
      
      case 'csv':
        filename = `test-cases-export-${timestamp}.csv`;
        content = this.convertToCSV();
        break;
      
      case 'markdown':
        filename = `test-cases-export-${timestamp}.md`;
        content = this.convertToMarkdown();
        break;
    }

    const filepath = path.join(exportDir, filename);
    
    try {
      // エンコーディングに応じて保存
      if (encoding === 'shift_jis') {
        // Shift-JISで保存
        const sjisBuffer = iconv.encode(content, 'Shift_JIS');
        fs.writeFileSync(filepath, sjisBuffer);
        console.log(chalk.green(`✅ エクスポート完了: exports/${filename} (Shift-JIS)`));
      } else if (encoding === 'utf8_bom') {
        // UTF-8 BOM付きで保存
        const BOM = '\uFEFF';
        fs.writeFileSync(filepath, BOM + content, 'utf8');
        console.log(chalk.green(`✅ エクスポート完了: exports/${filename} (UTF-8 BOM)`));
      } else {
        // UTF-8で保存
        fs.writeFileSync(filepath, content, 'utf8');
        console.log(chalk.green(`✅ エクスポート完了: exports/${filename} (UTF-8)`));
      }
      
      // 追加で別エンコーディング版も作成（CSVの場合）
      if (format === 'csv') {
        if (encoding !== 'shift_jis') {
          // Shift-JIS版も作成
          const sjisFilename = filename.replace('.csv', '_sjis.csv');
          const sjisPath = path.join(exportDir, sjisFilename);
          const sjisBuffer = iconv.encode(content, 'Shift_JIS');
          fs.writeFileSync(sjisPath, sjisBuffer);
          console.log(chalk.green(`   追加: exports/${sjisFilename} (Shift-JIS)`));
        }
        if (encoding !== 'utf8_bom') {
          // UTF-8 BOM付き版も作成
          const bomFilename = filename.replace('.csv', '_utf8.csv');
          const bomPath = path.join(exportDir, bomFilename);
          const BOM = '\uFEFF';
          fs.writeFileSync(bomPath, BOM + content, 'utf8');
          console.log(chalk.green(`   追加: exports/${bomFilename} (UTF-8 BOM)`));
        }
      }
    } catch (error) {
      console.error(chalk.red('エクスポートエラー:'), error.message);
    }
  }

  convertToCSV() {
    const headers = [
      'テストID',
      'カテゴリ',
      'テストケース名',
      '優先度',
      'URL',
      '前提条件',
      'ステップ数',
      '期待結果',
      '作成日',
      '更新日'
    ];

    const rows = [headers.join(',')];
    
    this.testCases.test_cases.forEach(tc => {
      // アスタリスクを削除し、クリーンな値にする
      const cleanValue = (str) => {
        if (!str) return '';
        return String(str).replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
      };
      
      const row = [
        tc.test_id,
        `"${cleanValue(tc.test_category)}"`,
        `"${cleanValue(tc.test_case_name)}"`,
        tc.priority,
        tc.target_url || '',
        `"${cleanValue(tc.preconditions)}"`,
        tc.test_steps.length,
        `"${cleanValue(tc.expected_result)}"`,
        tc.created_date,
        tc.updated_date
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  convertToMarkdown() {
    let markdown = '# テストケース一覧\n\n';
    markdown += `生成日時: ${new Date().toLocaleString('ja-JP')}\n\n`;
    markdown += `総テストケース数: ${this.testCases.test_cases.length}\n\n`;

    // カテゴリごとにグループ化
    const categorizedTests = {};
    this.testCases.test_cases.forEach(tc => {
      if (!categorizedTests[tc.test_category]) {
        categorizedTests[tc.test_category] = [];
      }
      categorizedTests[tc.test_category].push(tc);
    });

    Object.keys(categorizedTests).sort().forEach(category => {
      markdown += `## ${category}\n\n`;
      
      categorizedTests[category].forEach(tc => {
        markdown += `### ${tc.test_id}: ${tc.test_case_name}\n\n`;
        markdown += `- **優先度**: ${tc.priority}\n`;
        markdown += `- **URL**: ${tc.target_url || ''}\n`;
        markdown += `- **前提条件**: ${tc.preconditions}\n`;
        markdown += `- **期待結果**: ${tc.expected_result}\n`;
        markdown += `- **ステップ数**: ${tc.test_steps.length}\n\n`;
        
        markdown += '**テストステップ**:\n\n';
        tc.test_steps.forEach(step => {
          markdown += `${step.step_number}. ${step.description}\n`;
        });
        markdown += '\n---\n\n';
      });
    });

    return markdown;
  }

  async importTestCases() {
    const { filepath } = await inquirer.prompt([
      {
        type: 'input',
        name: 'filepath',
        message: 'インポートするJSONファイルのパス:',
        validate: (input) => {
          if (!input) return 'ファイルパスを入力してください';
          if (!fs.existsSync(input)) return 'ファイルが存在しません';
          if (!input.endsWith('.json')) return 'JSONファイルを指定してください';
          return true;
        }
      }
    ]);

    try {
      const data = fs.readFileSync(filepath, 'utf8');
      const importedData = JSON.parse(data);
      
      if (!importedData.test_cases || !Array.isArray(importedData.test_cases)) {
        console.log(chalk.red('❌ 無効なフォーマット: test_casesが見つかりません'));
        return;
      }

      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'インポート方法:',
          choices: [
            { name: '既存のテストケースに追加', value: 'append' },
            { name: '既存のテストケースを置き換え', value: 'replace' },
            { name: 'キャンセル', value: 'cancel' }
          ]
        }
      ]);

      if (action === 'cancel') {
        return;
      }

      if (action === 'replace') {
        this.testCases = importedData;
      } else {
        // IDの重複を防ぐ
        importedData.test_cases.forEach(tc => {
          const existingTest = this.testCases.test_cases.find(existing => existing.test_id === tc.test_id);
          if (existingTest) {
            tc.test_id = this.generateTestId();
          }
          this.testCases.test_cases.push(tc);
        });
      }

      if (this.saveTestCases()) {
        console.log(chalk.green(`✅ ${importedData.test_cases.length}件のテストケースをインポートしました`));
      }
    } catch (error) {
      console.error(chalk.red('インポートエラー:'), error.message);
    }
  }

  async manageCategories() {
    const categories = {};
    this.testCases.test_cases.forEach(tc => {
      categories[tc.test_category] = (categories[tc.test_category] || 0) + 1;
    });

    console.log(chalk.cyan('\n📂 カテゴリ管理\n'));
    
    if (Object.keys(categories).length === 0) {
      console.log(chalk.yellow('⚠️  カテゴリがありません'));
      return;
    }

    console.log('現在のカテゴリ:');
    Object.entries(categories).forEach(([category, count]) => {
      console.log(`  • ${category}: ${count}件`);
    });

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '操作を選択:',
        choices: [
          'カテゴリ名を変更',
          'カテゴリを統合',
          'キャンセル'
        ]
      }
    ]);

    if (action === 'カテゴリ名を変更') {
      await this.renameCategory();
    } else if (action === 'カテゴリを統合') {
      await this.mergeCategories();
    }
  }

  async renameCategory() {
    const categories = [...new Set(this.testCases.test_cases.map(tc => tc.test_category))];
    
    const { oldName } = await inquirer.prompt([
      {
        type: 'list',
        name: 'oldName',
        message: '変更するカテゴリを選択:',
        choices: categories
      }
    ]);

    const { newName } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newName',
        message: '新しいカテゴリ名:',
        validate: (input) => input.length > 0 || 'カテゴリ名を入力してください'
      }
    ]);

    let count = 0;
    this.testCases.test_cases.forEach(tc => {
      if (tc.test_category === oldName) {
        tc.test_category = newName;
        tc.updated_date = new Date().toISOString();
        count++;
      }
    });

    if (this.saveTestCases()) {
      console.log(chalk.green(`✅ ${count}件のテストケースのカテゴリを "${newName}" に変更しました`));
    }
  }

  async mergeCategories() {
    const categories = [...new Set(this.testCases.test_cases.map(tc => tc.test_category))];
    
    if (categories.length < 2) {
      console.log(chalk.yellow('⚠️  統合するには2つ以上のカテゴリが必要です'));
      return;
    }

    const { sourceCategories } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'sourceCategories',
        message: '統合元のカテゴリを選択:',
        choices: categories,
        validate: (input) => input.length > 0 || '少なくとも1つのカテゴリを選択してください'
      }
    ]);

    const { targetCategory } = await inquirer.prompt([
      {
        type: 'list',
        name: 'targetCategory',
        message: '統合先のカテゴリを選択:',
        choices: categories.filter(c => !sourceCategories.includes(c))
      }
    ]);

    let count = 0;
    this.testCases.test_cases.forEach(tc => {
      if (sourceCategories.includes(tc.test_category)) {
        tc.test_category = targetCategory;
        tc.updated_date = new Date().toISOString();
        count++;
      }
    });

    if (this.saveTestCases()) {
      console.log(chalk.green(`✅ ${count}件のテストケースを "${targetCategory}" に統合しました`));
    }
  }
}

// cli-table3の代替実装（簡易版）
class Table {
  constructor(options) {
    this.head = options.head || [];
    this.colWidths = options.colWidths || [];
    this.rows = [];
  }

  push(row) {
    this.rows.push(row);
  }

  toString() {
    let result = '';
    
    // ヘッダー
    if (this.head.length > 0) {
      result += this.head.map((h, i) => {
        const width = this.colWidths[i] || 15;
        return this.padString(h, width);
      }).join(' | ');
      result += '\n';
      result += '-'.repeat(this.colWidths.reduce((sum, w) => sum + w + 3, 0));
      result += '\n';
    }
    
    // 行
    this.rows.forEach(row => {
      result += row.map((cell, i) => {
        const width = this.colWidths[i] || 15;
        return this.padString(String(cell), width);
      }).join(' | ');
      result += '\n';
    });
    
    return result;
  }

  padString(str, width) {
    // ANSIエスケープシーケンスを除外して実際の文字列長を計算
    const strippedStr = str.replace(/\x1b\[[0-9;]*m/g, '');
    const actualLength = strippedStr.length;
    
    if (actualLength > width) {
      return str.substring(0, width - 3) + '...';
    }
    
    const padding = ' '.repeat(width - actualLength);
    return str + padding;
  }
}

export default TestCaseManager;