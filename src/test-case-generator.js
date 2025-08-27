import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import ConfigManager from './config-manager.js';

class TestCaseGenerator {
  constructor(options = {}) {
    this.options = options;
    this.configManager = new ConfigManager();
    this.config = this.configManager.config;
    this.testCasesPath = path.join(process.cwd(), 'config', 'test-cases.json');
    this.testCases = this.loadTestCases();
    this.recordedSteps = [];
    this.browser = null;
    this.page = null;
    this.context = null;
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

  saveTestCases() {
    try {
      const dir = path.dirname(this.testCasesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      this.testCases.last_updated = new Date().toISOString();
      fs.writeFileSync(this.testCasesPath, JSON.stringify(this.testCases, null, 2), 'utf8');
      console.log(chalk.green('✅ テストケースを保存しました'));
      return true;
    } catch (error) {
      console.error(chalk.red('テストケース保存エラー:'), error.message);
      return false;
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

  async startRecording() {
    console.log(chalk.cyan('\n🎬 Playwrightテストケース録画モード\n'));

    if (this.options.edit) {
      await this.editTestCase(this.options.edit);
      return;
    }

    const testInfo = await this.getTestCaseInfo();
    const target = this.configManager.getTestTarget(testInfo.target);
    
    if (!target) {
      console.error(chalk.red('❌ テスト対象が設定されていません'));
      return;
    }

    const spinner = ora('ブラウザを起動中...').start();

    try {
      // Playwrightブラウザ起動
      const headless = this.options.headless === 'true';
      this.browser = await chromium.launch({
        headless: headless,
        args: ['--start-maximized']
      });

      this.context = await this.browser.newContext({
        viewport: null,
        recordVideo: this.config.test_options.video_enabled ? {
          dir: path.join(process.cwd(), 'reports', 'videos')
        } : undefined
      });

      // Basic認証設定
      if (target.basic_auth && target.basic_auth.enabled) {
        await this.context.setHTTPCredentials({
          username: target.basic_auth.username,
          password: target.basic_auth.password
        });
      }

      this.page = await this.context.newPage();
      
      spinner.succeed('ブラウザを起動しました');
      
      // イベントリスナー設定
      this.setupRecordingListeners();

      // 初期URL設定
      const initialUrl = this.options.url || target.base_url;
      console.log(chalk.blue(`\n📍 録画開始: ${initialUrl}`));
      console.log(chalk.yellow('\n操作方法:'));
      console.log('  - ブラウザで通常通り操作してください');
      console.log('  - 各操作が自動的に記録されます');
      console.log('  - 録画を終了するには、ブラウザを閉じてください\n');

      await this.page.goto(initialUrl);
      this.recordedSteps.push({
        step_number: 1,
        action: 'goto',
        target: initialUrl,
        description: `${initialUrl}にアクセスする`
      });

      // ブラウザが閉じられるまで待機
      await this.page.waitForEvent('close').catch(() => {});
      
      console.log(chalk.green('\n✅ 録画を終了しました'));
      
      // テストケース作成
      await this.createTestCase(testInfo, target);

    } catch (error) {
      spinner.fail('エラーが発生しました');
      console.error(chalk.red('エラー:'), error.message);
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  setupRecordingListeners() {
    let stepNumber = 2;

    // クリックイベント
    this.page.on('click', async (element) => {
      try {
        const selector = await this.getElementSelector(element);
        const text = await element.textContent().catch(() => '');
        
        this.recordedSteps.push({
          step_number: stepNumber++,
          action: 'click',
          target: selector,
          description: `"${text || selector}"をクリックする`
        });
        
        console.log(chalk.gray(`  [記録] クリック: ${selector}`));
      } catch (error) {
        // エラーは静かに処理
      }
    });

    // 入力イベント
    this.page.on('fill', async (element, value) => {
      try {
        const selector = await this.getElementSelector(element);
        const placeholder = await element.getAttribute('placeholder').catch(() => '');
        const name = await element.getAttribute('name').catch(() => '');
        
        this.recordedSteps.push({
          step_number: stepNumber++,
          action: 'fill',
          target: selector,
          value: value,
          description: `${placeholder || name || selector}に"${value}"を入力する`
        });
        
        console.log(chalk.gray(`  [記録] 入力: ${selector} = "${value}"`));
      } catch (error) {
        // エラーは静かに処理
      }
    });

    // ナビゲーションイベント
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page.mainFrame() && frame.url() !== 'about:blank') {
        const lastStep = this.recordedSteps[this.recordedSteps.length - 1];
        
        // goto以外の操作でページ遷移した場合
        if (lastStep && lastStep.action !== 'goto') {
          console.log(chalk.gray(`  [記録] ページ遷移: ${frame.url()}`));
        }
      }
    });

    // セレクトボックス選択
    this.page.on('selectoption', async (element, values) => {
      try {
        const selector = await this.getElementSelector(element);
        
        this.recordedSteps.push({
          step_number: stepNumber++,
          action: 'selectOption',
          target: selector,
          value: values.join(', '),
          description: `${selector}で"${values.join(', ')}"を選択する`
        });
        
        console.log(chalk.gray(`  [記録] 選択: ${selector} = "${values.join(', ')}"`));
      } catch (error) {
        // エラーは静かに処理
      }
    });

    // チェックボックス
    this.page.on('check', async (element) => {
      try {
        const selector = await this.getElementSelector(element);
        
        this.recordedSteps.push({
          step_number: stepNumber++,
          action: 'check',
          target: selector,
          description: `${selector}をチェックする`
        });
        
        console.log(chalk.gray(`  [記録] チェック: ${selector}`));
      } catch (error) {
        // エラーは静かに処理
      }
    });

    this.page.on('uncheck', async (element) => {
      try {
        const selector = await this.getElementSelector(element);
        
        this.recordedSteps.push({
          step_number: stepNumber++,
          action: 'uncheck',
          target: selector,
          description: `${selector}のチェックを外す`
        });
        
        console.log(chalk.gray(`  [記録] チェック解除: ${selector}`));
      } catch (error) {
        // エラーは静かに処理
      }
    });
  }

  async getElementSelector(element) {
    // 優先度順にセレクタを取得
    const id = await element.getAttribute('id').catch(() => null);
    if (id) return `#${id}`;
    
    const name = await element.getAttribute('name').catch(() => null);
    if (name) return `[name="${name}"]`;
    
    const className = await element.getAttribute('class').catch(() => null);
    if (className) {
      const classes = className.split(' ').filter(c => c.trim());
      if (classes.length > 0) {
        return `.${classes[0]}`;
      }
    }
    
    const tagName = await element.evaluate(el => el.tagName.toLowerCase()).catch(() => 'element');
    const type = await element.getAttribute('type').catch(() => null);
    
    if (type) {
      return `${tagName}[type="${type}"]`;
    }
    
    return tagName;
  }

  async getTestCaseInfo() {
    const defaultName = this.options.name || '新規テストケース';
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'test_case_name',
        message: 'テストケース名:',
        default: defaultName,
        validate: (input) => input.length > 0 || 'テストケース名を入力してください'
      },
      {
        type: 'input',
        name: 'test_category',
        message: 'テストカテゴリ:',
        default: '一般機能'
      },
      {
        type: 'list',
        name: 'priority',
        message: '優先度:',
        choices: ['High', 'Medium', 'Low'],
        default: 'Medium'
      },
      {
        type: 'input',
        name: 'preconditions',
        message: '前提条件:',
        default: 'Webサイトが正常稼働していること'
      },
      {
        type: 'list',
        name: 'target',
        message: 'テスト対象サイト:',
        choices: this.config.test_targets.map(t => ({
          name: `${t.name} (${t.base_url})`,
          value: t.name
        }))
      }
    ]);
    
    return answers;
  }

  async createTestCase(testInfo, target) {
    console.log(chalk.cyan('\n📝 テストケース情報入力\n'));

    // 期待結果とアサーションを入力
    const additionalInfo = await inquirer.prompt([
      {
        type: 'input',
        name: 'expected_result',
        message: '期待結果:',
        default: '正常に動作すること'
      },
      {
        type: 'list',
        name: 'assertion_type',
        message: 'アサーションタイプ:',
        choices: [
          { name: 'URLに特定の文字列を含む', value: 'url_contains' },
          { name: '特定のテキストが表示される', value: 'text_visible' },
          { name: '特定の要素が存在する', value: 'element_exists' },
          { name: 'タイトルに特定の文字列を含む', value: 'title_contains' },
          { name: 'なし', value: 'none' }
        ],
        default: 'url_contains'
      },
      {
        type: 'input',
        name: 'assertion_value',
        message: 'アサーション値:',
        when: (answers) => answers.assertion_type !== 'none'
      }
    ]);

    // Playwrightコード生成
    const playwrightCode = this.generatePlaywrightCode(testInfo, this.recordedSteps, additionalInfo);

    // スクリーンショット保存
    const screenshots = await this.captureScreenshots();

    // テストケース作成
    const testCase = {
      test_id: this.generateTestId(),
      test_category: testInfo.test_category,
      test_case_name: testInfo.test_case_name,
      priority: testInfo.priority,
      preconditions: testInfo.preconditions,
      test_steps: this.recordedSteps,
      expected_result: additionalInfo.expected_result,
      assertion: additionalInfo.assertion_type !== 'none' ? {
        type: additionalInfo.assertion_type,
        value: additionalInfo.assertion_value
      } : null,
      test_data: {
        target_site: target.name,
        base_url: target.base_url
      },
      generated_playwright_code: playwrightCode,
      screenshots: screenshots,
      created_date: new Date().toISOString(),
      updated_date: new Date().toISOString()
    };

    // テストケースを追加
    this.testCases.test_cases.push(testCase);
    
    if (this.saveTestCases()) {
      console.log(chalk.green(`\n✅ テストケース "${testCase.test_id}" を作成しました`));
      console.log(chalk.blue(`テストケース名: ${testCase.test_case_name}`));
      console.log(chalk.blue(`カテゴリ: ${testCase.test_category}`));
      console.log(chalk.blue(`優先度: ${testCase.priority}`));
      console.log(chalk.blue(`ステップ数: ${testCase.test_steps.length}`));
      
      // Playwrightテストファイル生成
      await this.generateTestFile(testCase);
    }
  }

  generatePlaywrightCode(testInfo, steps, additionalInfo) {
    const lines = [
      `import { test, expect } from '@playwright/test';`,
      '',
      `test('${testInfo.test_case_name}', async ({ page }) => {`
    ];

    // 各ステップをコード化
    for (const step of steps) {
      switch (step.action) {
        case 'goto':
          lines.push(`  await page.goto('${step.target}');`);
          break;
        case 'click':
          lines.push(`  await page.click('${step.target}');`);
          break;
        case 'fill':
          lines.push(`  await page.fill('${step.target}', '${step.value}');`);
          break;
        case 'selectOption':
          lines.push(`  await page.selectOption('${step.target}', '${step.value}');`);
          break;
        case 'check':
          lines.push(`  await page.check('${step.target}');`);
          break;
        case 'uncheck':
          lines.push(`  await page.uncheck('${step.target}');`);
          break;
      }
    }

    // アサーション追加
    if (additionalInfo.assertion_type && additionalInfo.assertion_type !== 'none') {
      lines.push('');
      lines.push('  // アサーション');
      
      switch (additionalInfo.assertion_type) {
        case 'url_contains':
          lines.push(`  await expect(page).toHaveURL(/.*${additionalInfo.assertion_value}.*/);`);
          break;
        case 'text_visible':
          lines.push(`  await expect(page.locator('text=${additionalInfo.assertion_value}')).toBeVisible();`);
          break;
        case 'element_exists':
          lines.push(`  await expect(page.locator('${additionalInfo.assertion_value}')).toBeVisible();`);
          break;
        case 'title_contains':
          lines.push(`  await expect(page).toHaveTitle(/.*${additionalInfo.assertion_value}.*/);`);
          break;
      }
    }

    lines.push('});');
    
    return lines.join('\n');
  }

  async generateTestFile(testCase) {
    const testsDir = path.join(process.cwd(), 'tests');
    if (!fs.existsSync(testsDir)) {
      fs.mkdirSync(testsDir, { recursive: true });
    }

    const testFileName = `${testCase.test_id}_${testCase.test_case_name.replace(/[^a-zA-Z0-9]/g, '_')}.spec.js`;
    const testFilePath = path.join(testsDir, testFileName);

    try {
      fs.writeFileSync(testFilePath, testCase.generated_playwright_code, 'utf8');
      console.log(chalk.green(`✅ テストファイル生成: tests/${testFileName}`));
    } catch (error) {
      console.error(chalk.red('テストファイル生成エラー:'), error.message);
    }
  }

  async captureScreenshots() {
    const screenshots = [];
    
    if (!this.config.test_options.screenshot_enabled) {
      return screenshots;
    }

    const screenshotsDir = path.join(process.cwd(), 'screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // 現在のページのスクリーンショットを撮影
    if (this.page) {
      try {
        const timestamp = Date.now();
        const filename = `recording_${timestamp}.png`;
        const filepath = path.join(screenshotsDir, filename);
        
        await this.page.screenshot({
          path: filepath,
          fullPage: true
        });
        
        screenshots.push(`screenshots/${filename}`);
        console.log(chalk.gray(`  📸 スクリーンショット保存: ${filename}`));
      } catch (error) {
        console.error(chalk.red('スクリーンショット保存エラー:'), error.message);
      }
    }

    return screenshots;
  }

  async editTestCase(testId) {
    const testCase = this.testCases.test_cases.find(tc => tc.test_id === testId);
    
    if (!testCase) {
      console.error(chalk.red(`❌ テストケース ${testId} が見つかりません`));
      return;
    }

    console.log(chalk.cyan(`\n📝 テストケース編集: ${testId}\n`));
    console.log(chalk.blue(`現在の名前: ${testCase.test_case_name}`));
    console.log(chalk.blue(`現在のカテゴリ: ${testCase.test_category}`));
    console.log(chalk.blue(`現在の優先度: ${testCase.priority}`));

    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: '編集内容を選択:',
        choices: [
          '基本情報を編集',
          'ステップを再録画',
          'アサーションを編集',
          'テストケースを削除',
          'キャンセル'
        ]
      }
    ]);

    switch (answers.action) {
      case '基本情報を編集':
        await this.editTestCaseInfo(testCase);
        break;
      case 'ステップを再録画':
        await this.rerecordTestCase(testCase);
        break;
      case 'アサーションを編集':
        await this.editAssertion(testCase);
        break;
      case 'テストケースを削除':
        await this.deleteTestCase(testCase);
        break;
      case 'キャンセル':
        return;
    }
  }

  async editTestCaseInfo(testCase) {
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

  async rerecordTestCase(testCase) {
    console.log(chalk.yellow('⚠️  既存のステップは削除され、新しく録画されます'));
    
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '続行しますか？',
        default: false
      }
    ]);

    if (confirm) {
      this.options.name = testCase.test_case_name;
      await this.startRecording();
    }
  }

  async editAssertion(testCase) {
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'assertion_type',
        message: 'アサーションタイプ:',
        choices: [
          { name: 'URLに特定の文字列を含む', value: 'url_contains' },
          { name: '特定のテキストが表示される', value: 'text_visible' },
          { name: '特定の要素が存在する', value: 'element_exists' },
          { name: 'タイトルに特定の文字列を含む', value: 'title_contains' },
          { name: 'なし', value: 'none' }
        ],
        default: testCase.assertion?.type || 'none'
      },
      {
        type: 'input',
        name: 'assertion_value',
        message: 'アサーション値:',
        default: testCase.assertion?.value || '',
        when: (answers) => answers.assertion_type !== 'none'
      }
    ]);

    if (answers.assertion_type === 'none') {
      testCase.assertion = null;
    } else {
      testCase.assertion = {
        type: answers.assertion_type,
        value: answers.assertion_value
      };
    }

    testCase.updated_date = new Date().toISOString();
    
    if (this.saveTestCases()) {
      console.log(chalk.green(`✅ アサーションを更新しました`));
    }
  }

  async deleteTestCase(testCase) {
    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: `本当にテストケース ${testCase.test_id} を削除しますか？`,
        default: false
      }
    ]);

    if (confirm) {
      const index = this.testCases.test_cases.findIndex(tc => tc.test_id === testCase.test_id);
      if (index !== -1) {
        this.testCases.test_cases.splice(index, 1);
        
        if (this.saveTestCases()) {
          console.log(chalk.green(`✅ テストケース ${testCase.test_id} を削除しました`));
        }
      }
    }
  }
}

export default TestCaseGenerator;